import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from myapp.models import ContactMessage, DeliveryArea, Dish, MenuSubscriber, Order, PolicyPage, SiteSettings

KEY_SECRET = "test_secret_123"
HOOK_SECRET = "hook_secret_456"


def sign(msg, secret):
    return hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()


@override_settings(RAZORPAY_KEY_ID="rzp_test_x", RAZORPAY_KEY_SECRET=KEY_SECRET, RAZORPAY_WEBHOOK_SECRET=HOOK_SECRET)
class OrderFlowTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()                                  # reset the anti-spam counters between tests
        call_command("seed_menu", verbosity=0)
        self.biryani = Dish.objects.get(name_en="Chicken Biryani")   # 180
        self.idli = Dish.objects.get(name_en="Spiced Buttermilk")     # 30 (small item)
        self.area = DeliveryArea.objects.get(name_en="Millerpuram")  # fee 30

    def at(self, hour, minute=0, days=0):
        import datetime
        from django.utils import timezone
        d = timezone.localdate() + datetime.timedelta(days=days)
        return timezone.make_aware(datetime.datetime.combine(d, datetime.time(hour, minute)))

    def post_checkout(self, items, at_hour=13, **extra):
        data = {
            "fulfilment": "delivery", "when": "now", "name": "Ravi", "phone": "98765 43210",
            "building": "No 12, Lakshmi Illam", "address": "12, North Street, Millerpuram", "lat": "8.7900", "lng": "78.1400",
            "items": json.dumps(items),
        }
        data.update(extra)
        with patch("myapp.ordering.now", return_value=self.at(at_hour)), \
             patch("myapp.payments.create_razorpay_order", return_value="order_TEST123"):
            return self.client.post(reverse("orders:checkout"), data)

    # ---------- pages ----------
    def test_pages_load_in_both_languages(self):
        for code in ("en", "ta"):
            self.client.get(reverse("core:set_language", args=[code]))
            for name in ("core:home", "menu:menu", "core:story", "core:contact", "orders:checkout"):
                r = self.client.get(reverse(name))
                self.assertEqual(r.status_code, 200, f"{name} [{code}]")
        self.assertContains(self.client.get(reverse("menu:menu")), "சிக்கன் பிரியாணி")

    def test_language_switch_rejects_external_redirect(self):
        r = self.client.get(reverse("core:set_language", args=["ta"]) + "?next=https://evil.example")
        self.assertEqual(r["Location"], "/")

    def test_contact_form_saves(self):
        from myapp.models import ContactMessage
        r = self.client.post(reverse("core:contact"), {"name": "Mala", "phone": "9876543210", "reason": "bulk", "message": "Bulk order?"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(ContactMessage.objects.count(), 1)

    # ---------- checkout ----------
    def test_checkout_uses_server_prices(self):
        r = self.post_checkout([{"id": self.biryani.id, "qty": 2, "price": 1}, {"id": self.idli.id, "qty": 1}])
        order = Order.objects.get()
        self.assertEqual(r.json(), {"ok": True, "redirect": reverse("orders:pay", args=[order.token])})
        self.assertEqual(order.subtotal, Decimal("390"))
        self.assertEqual(order.delivery_fee, Decimal("85"))
        self.assertEqual(order.total, Decimal("475"))
        self.assertEqual(order.amount_paise, 47500)
        self.assertEqual(order.phone, "9876543210")
        self.assertEqual(order.razorpay_order_id, "order_TEST123")
        self.assertEqual(order.items.count(), 2)
        self.assertEqual(order.delivery_slot, "ASAP")
        self.assertIn("google.com/maps", order.map_url)

    def test_pickup_has_no_delivery_fee(self):
        self.post_checkout([{"id": self.biryani.id, "qty": 1}], fulfilment="pickup", building="", address="", lat="", lng="")
        o = Order.objects.get()
        self.assertEqual((o.fulfilment, o.delivery_fee, o.total), ("pickup", Decimal("0"), Decimal("180")))

    def test_min_order_enforced(self):
        r = self.post_checkout([{"id": self.idli.id, "qty": 1}])  # 30 < 100
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_sold_out_item_blocks_order(self):
        self.idli.is_available = False
        self.idli.save()
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}, {"id": self.idli.id, "qty": 1}])
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_kitchen_closed_blocks_order(self):
        s = SiteSettings.load(); s.kitchen_open = False; s.save()
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}])
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_invalid_phone_rejected(self):
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], phone="12345")
        self.assertIn("phone", r.json()["errors"])
        self.assertFalse(Order.objects.exists())

    # ---------- order hours & advance orders ----------
    def test_same_day_only_between_12_and_6(self):
        for hour in (9, 18, 21):
            r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], at_hour=hour)
            self.assertEqual(r.status_code, 400, hour)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.post_checkout([{"id": self.biryani.id, "qty": 1}], at_hour=17).status_code, 200)

    def test_advance_order_two_days_ahead_any_time(self):
        import datetime
        from django.utils import timezone
        day = timezone.localdate() + datetime.timedelta(days=2)
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], at_hour=21, when="later", date=day.isoformat(), slot="13:00-14:00")
        self.assertEqual(r.status_code, 200)
        o = Order.objects.get()
        self.assertTrue(o.is_advance)
        self.assertEqual((o.delivery_date, o.delivery_slot), (day, "13:00-14:00"))

    def test_advance_order_too_soon_or_bad_slot(self):
        import datetime
        from django.utils import timezone
        tomorrow = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        later = (timezone.localdate() + datetime.timedelta(days=3)).isoformat()
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], when="later", date=tomorrow, slot="13:00-14:00")
        self.assertIn("date", r.json()["errors"])
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], when="later", date=later, slot="19:00-20:00")
        self.assertIn("slot", r.json()["errors"])
        self.assertFalse(Order.objects.exists())

    def test_location_required_and_inside_area(self):
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], lat="", lng="")
        self.assertIn("location", r.json()["errors"])
        r = self.post_checkout([{"id": self.biryani.id, "qty": 1}], lat="13.0827", lng="80.2707")   # Chennai
        self.assertIn("location", r.json()["errors"])
        self.assertFalse(Order.objects.exists())

    def test_sunday_dish_only_for_sunday(self):
        import datetime
        from django.utils import timezone
        mutton = Dish.objects.get(name_en="Mutton Biryani")
        today = timezone.localdate()
        sunday = next(today + datetime.timedelta(days=k) for k in range(2, 10) if (today + datetime.timedelta(days=k)).weekday() == 6)
        monday = sunday + datetime.timedelta(days=1)
        r = self.post_checkout([{"id": mutton.id, "qty": 1}], when="later", date=monday.isoformat(), slot="12:00-13:00")
        self.assertEqual(r.status_code, 400)
        r = self.post_checkout([{"id": mutton.id, "qty": 1}], when="later", date=sunday.isoformat(), slot="12:00-13:00")
        self.assertEqual(r.status_code, 200)

    # ---------- coupons ----------
    def test_coupon_check_and_discount(self):
        from myapp.models import Coupon
        Coupon.objects.create(code="WELCOME50", kind="flat", value=50, min_order=200)
        r = self.client.post(reverse("orders:coupon"), {"code": "welcome50", "subtotal": "150"})
        self.assertFalse(r.json()["ok"])
        r = self.client.post(reverse("orders:coupon"), {"code": "welcome50", "subtotal": "360"})
        self.assertTrue(r.json()["ok"])
        self.post_checkout([{"id": self.biryani.id, "qty": 2}], coupon="WELCOME50")
        o = Order.objects.get()
        self.assertEqual((o.discount, o.total), (Decimal("50"), Decimal("395")))
        o.mark_paid("pay_X")
        self.assertEqual(Coupon.objects.get().used_count, 1)
        r = self.post_checkout([{"id": self.biryani.id, "qty": 2}], coupon="WELCOME50")     # once per phone
        self.assertIn("coupon", r.json()["errors"])

    def test_percent_coupon_cap(self):
        from myapp.models import Coupon
        c = Coupon(kind="percent", value=50, max_discount=60)
        self.assertEqual(c.discount_for(Decimal("400")), Decimal("60"))

    # ---------- payment ----------
    def make_order(self):
        self.post_checkout([{"id": self.biryani.id, "qty": 1}])
        return Order.objects.get()

    def test_valid_signature_marks_paid(self):
        o = self.make_order()
        sig = sign(f"{o.razorpay_order_id}|pay_ABC", KEY_SECRET)
        r = self.client.post(reverse("orders:verify", args=[o.token]),
                             {"razorpay_order_id": o.razorpay_order_id, "razorpay_payment_id": "pay_ABC", "razorpay_signature": sig})
        self.assertRedirects(r, reverse("orders:success", args=[o.token]))
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PAID)
        self.assertEqual(o.razorpay_payment_id, "pay_ABC")
        self.assertIsNotNone(o.paid_at)

    def test_bad_signature_fails(self):
        o = self.make_order()
        r = self.client.post(reverse("orders:verify", args=[o.token]),
                             {"razorpay_order_id": o.razorpay_order_id, "razorpay_payment_id": "pay_ABC", "razorpay_signature": "forged"})
        self.assertRedirects(r, reverse("orders:failed", args=[o.token]))
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PAYMENT_FAILED)

    def webhook(self, event, order_id, amount, secret=HOOK_SECRET):
        body = json.dumps({"event": event, "payload": {"payment": {"entity": {"id": "pay_W1", "order_id": order_id, "amount": amount}}}})
        return self.client.post(reverse("orders:webhook"), body, content_type="application/json",
                                HTTP_X_RAZORPAY_SIGNATURE=sign(body, secret))

    def test_webhook_marks_paid(self):
        o = self.make_order()
        self.assertEqual(self.webhook("payment.captured", o.razorpay_order_id, o.amount_paise).status_code, 200)
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PAID)

    def test_webhook_rejects_bad_signature(self):
        o = self.make_order()
        self.assertEqual(self.webhook("payment.captured", o.razorpay_order_id, o.amount_paise, secret="wrong").status_code, 400)
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PENDING)

    def test_webhook_amount_mismatch_not_paid(self):
        o = self.make_order()
        self.webhook("payment.captured", o.razorpay_order_id, 100)
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PENDING)

    def test_paid_is_idempotent(self):
        o = self.make_order()
        self.webhook("payment.captured", o.razorpay_order_id, o.amount_paise)
        self.webhook("payment.failed", o.razorpay_order_id, o.amount_paise)
        o.refresh_from_db()
        self.assertEqual(o.status, Order.STATUS_PAID)

    def test_pay_page_and_success_guard(self):
        o = self.make_order()
        r = self.client.get(reverse("orders:pay", args=[o.token]))
        self.assertContains(r, "order_TEST123")
        self.assertContains(r, '"amount": 26500')
        # success page should not show for an unpaid order
        self.assertRedirects(self.client.get(reverse("orders:success", args=[o.token])),
                             reverse("orders:pay", args=[o.token]))


class FooterTests(TestCase):
    def test_footer_shows_details_and_policy_links(self):
        html = self.client.get("/").content.decode()
        self.assertIn("+91 9751431501", html)
        self.assertIn('href="tel:+919751431501"', html)
        self.assertIn("Nigilesan Nagar", html)
        self.assertIn("We Care Your Health", html)
        self.assertIn("Coming soon", html)                 # Swiggy/Zomato not set yet
        for name in ("terms", "privacy", "refund", "delivery"):
            self.assertIn(reverse(f"core:{name}"), html)

    def test_swiggy_link_replaces_coming_soon(self):
        s = SiteSettings.load(); s.swiggy_url = "https://www.swiggy.com/x"; s.save()
        self.assertContains(self.client.get("/"), 'href="https://www.swiggy.com/x"')

    def test_policy_pages_empty_then_filled(self):
        self.assertEqual(PolicyPage.objects.count(), 4)    # made by the migration
        for name in ("terms", "privacy", "refund", "delivery"):
            r = self.client.get(reverse(f"core:{name}"))
            self.assertContains(r, "final touches")
        PolicyPage.objects.filter(slug="refund").update(body_en="Full refund if cancelled before cooking.")
        self.assertContains(self.client.get(reverse("core:refund")), "Full refund if cancelled")

    def test_subscribe_json_and_duplicates(self):
        url = reverse("core:subscribe")
        r = self.client.post(url, {"phone": "98765 43210"}, HTTP_ACCEPT="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ok"])
        r = self.client.post(url, {"phone": "+91 9876543210"}, HTTP_ACCEPT="application/json")
        self.assertIn("already", r.json()["message"])
        self.assertEqual(MenuSubscriber.objects.count(), 1)

    def test_subscribe_rejects_bad_number_and_bots(self):
        url = reverse("core:subscribe")
        r = self.client.post(url, {"phone": "12345"}, HTTP_ACCEPT="application/json")
        self.assertEqual(r.status_code, 400)
        self.client.post(url, {"phone": "9876543210", "website": "spam"}, HTTP_ACCEPT="application/json")
        self.assertEqual(MenuSubscriber.objects.count(), 0)

    def test_subscribe_without_js_redirects(self):
        r = self.client.post(reverse("core:subscribe"), {"phone": "9876543210"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(MenuSubscriber.objects.count(), 1)


@override_settings(NOTIFY_ASYNC=False, EMAIL_HOST="smtp.test")
class ContactPageTests(TestCase):
    def post(self, **data):
        base = {"name": "Ravi", "phone": "98765 43210", "email": "", "reason": "advance", "message": "Lunch for Friday"}
        base.update(data)
        return self.client.post(reverse("core:contact"), base, HTTP_ACCEPT="application/json")

    def test_page_shows_new_sections(self):
        for code in ("en", "ta"):
            self.client.get(reverse("core:set_language", args=[code]))
            r = self.client.get(reverse("core:contact"))
            self.assertEqual(r.status_code, 200)
            self.assertContains(r, 'data-reason="bulk"')
            self.assertContains(r, "Razorpay")
        self.client.get(reverse("core:set_language", args=["en"]))
        r = self.client.get(reverse("core:contact"))
        self.assertContains(r, "Coming soon")                    # WhatsApp/email not configured yet
        self.assertContains(r, 'class="ci-loc"')                # contact page shows only the area name

    def test_saves_with_email_and_reason(self):
        r = self.post(email="ravi@example.com")
        self.assertTrue(r.json()["ok"])
        m = ContactMessage.objects.get()
        self.assertEqual((m.phone, m.reason, m.email), ("9876543210", "advance", "ravi@example.com"))

    def test_validation_errors(self):
        r = self.post(name="", phone="12", email="bad", reason="nope", message="")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.json()["errors"]), {"name", "phone", "email", "reason", "message"})
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_bot_trap(self):
        self.post(website="spam")
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_no_alerts_until_configured(self):
        from django.core import mail
        with patch("urllib.request.urlopen") as op:
            self.post()
        self.assertEqual(len(mail.outbox), 0)
        op.assert_not_called()

    def test_email_and_whatsapp_alerts_when_configured(self):
        from django.core import mail
        s = SiteSettings.load()
        s.alert_email = "owner@example.com"; s.whatsapp_alert_url = "https://bot.example.com/hook"; s.whatsapp_alert_token = "t0k"
        s.save()
        with patch("urllib.request.urlopen") as op:
            op.return_value.__enter__.return_value.read.return_value = b"ok"
            self.post(reason="bulk")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Bulk / party order", mail.outbox[0].subject)
        req = op.call_args[0][0]
        self.assertEqual(req.headers["Authorization"], "Bearer t0k")
        self.assertEqual(json.loads(req.data)["reason"], "bulk")

    def test_alert_failure_does_not_break_the_form(self):
        s = SiteSettings.load(); s.whatsapp_alert_url = "https://bot.example.com/hook"; s.save()
        with patch("urllib.request.urlopen", side_effect=OSError("down")):
            r = self.post()
        self.assertTrue(r.json()["ok"])
        self.assertEqual(ContactMessage.objects.count(), 1)


class MenuPageTests(TestCase):
    """The menu page is built only from admin data: sections, dishes, badges, Sunday-only, combos."""

    def setUp(self):
        call_command("seed_menu", verbosity=0)
        self.area = DeliveryArea.objects.get(name_en="Millerpuram")

    def get(self, sunday):
        with patch("myapp.models.Dish.is_sunday_today", return_value=sunday):
            return self.client.get(reverse("menu:menu"))

    def test_chapters_tabs_and_tiffin_removed(self):
        r = self.get(False)
        for slug in ("meals", "biryani", "sides", "drinks", "combos"):
            self.assertContains(r, f'id="ch-{slug}"')
            self.assertContains(r, f'data-tab="{slug}"')
        self.assertNotContains(r, "Tiffin")
        self.assertContains(r, "Chapter 01")
        self.assertContains(r, "Bestseller")
        self.assertContains(r, "Chef&#x27;s special")
        self.assertContains(r, "mn-combos")
        self.assertContains(r, "Save ₹20")

    def test_small_sections_share_a_row(self):
        r = self.get(False)
        rows = r.context["rows"]
        duo = [row for row in rows if row["duo"]]
        self.assertEqual([c["cat"].slug for c in duo[0]["chapters"]], ["sides", "drinks"])
        # new section from the admin panel: appears automatically with its own colour and drawing
        from myapp.models import Category
        c = Category.objects.create(slug="sweets", name_en="Sweets", sort_order=9)
        Dish.objects.create(category=c, name_en="Semiya Payasam", price=Decimal("40"))
        r = self.get(False)
        self.assertContains(r, 'id="ch-sweets"')
        ch = [x for x in r.context["chapters"] if x["cat"].slug == "sweets"][0]
        self.assertEqual(ch["num"], "06")
        self.assertTrue(ch["theme"])
        self.assertEqual(Dish.objects.get(name_en="Semiya Payasam").art_key, "sweet")

    def test_sunday_only_locked_on_weekdays(self):
        mutton = Dish.objects.get(name_en="Mutton Biryani")
        r = self.get(False)
        self.assertNotContains(r, f'data-step data-id="{mutton.id}"')
        self.assertContains(r, "Sunday only")
        r = self.get(True)
        self.assertContains(r, f'data-step data-id="{mutton.id}"')
        self.assertContains(r, "Sunday special")

    def test_empty_menu_message(self):
        Dish.objects.all().delete()
        r = self.get(False)
        self.assertContains(r, "The menu is being updated")


@override_settings(MEDIA_ROOT=__import__("tempfile").mkdtemp())
class MenuPhotoTests(TestCase):
    def setUp(self):
        call_command("seed_menu", verbosity=0)

    def _jpeg(self):
        import io
        from PIL import Image
        b = io.BytesIO(); Image.new("RGB", (40, 30), (200, 120, 40)).save(b, "JPEG"); return b.getvalue()

    def test_sample_photo_command_fills_banners_and_dishes(self):
        call_command("load_sample_photos", verbosity=0)
        from myapp.models import Category
        self.assertTrue(Category.objects.get(slug="biryani").image)
        self.assertTrue(Dish.objects.get(name_en="Chicken Biryani").image)
        r = self.client.get(reverse("menu:menu"))
        self.assertContains(r, "mn-ban has-photo")
        self.assertContains(r, "mn-th has-img")

    def test_without_photos_drawings_are_used(self):
        r = self.client.get(reverse("menu:menu"))
        self.assertNotContains(r, "has-photo")
        self.assertContains(r, "mn-ban-art")


@override_settings(DEBUG=True, RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx", RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxx")
class DemoPaymentTests(TestCase):
    """On your computer without real Razorpay keys, the pay page offers a test payment."""

    def test_demo_payment(self):
        import datetime
        from django.utils import timezone
        call_command("seed_menu", verbosity=0)
        dish = Dish.objects.get(name_en="Chicken Biryani")
        now = timezone.make_aware(datetime.datetime.combine(timezone.localdate(), datetime.time(13, 0)))
        with patch("myapp.ordering.now", return_value=now):
            r = self.client.post(reverse("orders:checkout"), {"fulfilment": "pickup", "when": "now", "name": "Ravi", "phone": "9876543210",
                                                              "items": json.dumps([{"id": dish.id, "qty": 1}])})
        o = Order.objects.get()
        page = self.client.get(r.json()["redirect"])
        self.assertContains(page, "data-demo-pay")
        self.client.post(reverse("orders:verify", args=[o.token]), {"demo": "1"})
        o.refresh_from_db()
        self.assertTrue(o.is_paid)
        self.assertContains(self.client.get(reverse("orders:success", args=[o.token])), o.order_number)
