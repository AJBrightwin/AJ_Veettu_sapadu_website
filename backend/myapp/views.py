import datetime
import json
import logging
import re
from decimal import Decimal

from django.contrib import messages
from django.db import transaction
from django.db.models import Prefetch
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from . import notify, ordering, payments
from .models import (Category, ContactMessage, Coupon, DeliveryArea, Dish, MenuSubscriber, Order, OrderItem,
                     PolicyPage, SiteSettings)
from .translations import LANGS, get_lang, t

log = logging.getLogger("myapp")


# ================= Pages: Home, Our Story, Contact, language =================

def home(request):
    dishes = Dish.objects.filter(category__is_active=True).select_related("category")
    orderable = _available_dishes().select_related("category")
    specials = list(orderable.filter(is_special=True)[:6])
    if not specials:
        specials = list(orderable[:6])
    available = list(dishes.filter(is_available=True))
    return render(request, "index.html", {
        "specials": specials,
        "ticker": available[:12],                       # dish names in the moving band
        "dish_count": len(available),                    # real numbers for the counters
        "area_count": DeliveryArea.objects.filter(is_active=True).count(),
        "page": "home",
    })


def story(request):
    chapters = [(n, t(request, f"st_c{n}_t"), t(request, f"st_c{n}_d")) for n in range(1, 5)]
    return render(request, "story.html", {"page": "story", "story_chapters": chapters})


CONTACT_REASONS = [code for code, _ in ContactMessage.REASON_CHOICES]


def contact(request):
    """Contact page. Saves the message, fires optional email/WhatsApp alerts, answers JSON for fetch()."""
    wants_json = "application/json" in request.headers.get("Accept", "")
    pre = request.GET.get("reason", "")
    form = {"name": "", "phone": "", "email": "", "reason": pre if pre in CONTACT_REASONS else "", "message": ""}
    errors = {}
    if request.method == "POST":
        form = {k: request.POST.get(k, "").strip() for k in form}
        if request.POST.get("website"):                    # hidden trap field: bots only
            if wants_json:
                return JsonResponse({"ok": True, "message": t(request, "msg_sent")})
            return redirect("core:contact")
        phone = re.sub(r"\D", "", form["phone"])[-10:]
        if not form["name"]:
            errors["name"] = t(request, "err_name")
        if not re.fullmatch(r"[6-9]\d{9}", phone):
            errors["phone"] = t(request, "err_phone")
        if form["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", form["email"]):
            errors["email"] = t(request, "err_email")
        if form["reason"] not in CONTACT_REASONS:
            errors["reason"] = t(request, "err_reason")
        if not form["message"]:
            errors["message"] = t(request, "err_message")
        if not errors:
            msg = ContactMessage.objects.create(
                name=form["name"][:100], phone=phone, email=form["email"][:254],
                reason=form["reason"], message=form["message"][:2000])
            notify.contact_alert(SiteSettings.load(), msg)
            if wants_json:
                return JsonResponse({"ok": True, "message": t(request, "msg_sent")})
            messages.success(request, t(request, "msg_sent"))
            return redirect("core:contact")
        if wants_json:
            return JsonResponse({"ok": False, "errors": errors}, status=400)
    reasons = [(code, t(request, f"reason_{code}")) for code in CONTACT_REASONS]
    return render(request, "contact.html", {"form": form, "errors": errors, "reasons": reasons, "page": "contact"})


POLICY_TITLE_KEYS = {"terms": "pol_terms", "privacy": "pol_privacy", "refund": "pol_refund", "delivery": "pol_delivery"}


def policy(request, slug):
    """Terms / Privacy / Refund / Delivery. Text comes from ajvs_policy_page (edit in your admin panel)."""
    page_obj = PolicyPage.objects.filter(slug=slug).first()
    ta = get_lang(request) == "ta"
    title = ""
    body = ""
    if page_obj:
        title = (page_obj.title_ta if ta else page_obj.title_en) or page_obj.title_en
        body = (page_obj.body_ta if ta else page_obj.body_en) or page_obj.body_en
    return render(request, "policy.html", {
        "title": title or t(request, POLICY_TITLE_KEYS[slug]),
        "body": body.strip(),
        "updated": page_obj.updated_at if page_obj and body.strip() else None,
        "page": "policy",
    })


@require_POST
def subscribe(request):
    """Footer box: save a number for 'today's menu on WhatsApp'. Answers JSON for fetch(), redirects otherwise."""
    wants_json = "application/json" in request.headers.get("Accept", "")
    back = request.META.get("HTTP_REFERER") or "/"
    if not url_has_allowed_host_and_scheme(back, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        back = "/"

    def reply(ok, text):
        if wants_json:
            return JsonResponse({"ok": ok, "message": text}, status=200 if ok else 400)
        (messages.success if ok else messages.error)(request, text)
        return redirect(back)

    if request.POST.get("website"):                  # hidden trap field: only bots fill it
        return reply(True, t(request, "sub_ok"))
    phone = re.sub(r"\D", "", request.POST.get("phone", ""))[-10:]
    if not re.fullmatch(r"[6-9]\d{9}", phone):
        return reply(False, t(request, "err_phone"))
    sub, created = MenuSubscriber.objects.get_or_create(phone=phone, defaults={"language": get_lang(request)})
    if not created and not sub.is_active:
        sub.is_active = True
        sub.save(update_fields=["is_active"])
    return reply(True, t(request, "sub_ok" if created else "sub_again"))


@require_GET
def set_language(request, code):
    if code in LANGS:
        request.session["lang"] = code
    nxt = request.GET.get("next", "/")
    if not url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        nxt = "/"
    return redirect(nxt)


# ================= Menu =================

def menu_page(request):
    """Menu laid out as 'chapters'. Everything comes from the admin panel:

    * every active section with at least one dish becomes a chapter (01, 02, ...)
    * two small sections (1-2 dishes) next to each other share one row on big screens
    * the combo section shows gold combo cards
    """
    categories = (
        Category.objects.filter(is_active=True)
        .prefetch_related(Prefetch("dishes", queryset=Dish.objects.select_related("category").order_by("sort_order", "id")))
    )
    chapters = []
    for c in categories:
        dishes = list(c.dishes.all())
        if not dishes:
            continue
        n = len(chapters)
        chapters.append({
            "cat": c, "dishes": dishes, "num": f"{n + 1:02d}",
            "theme": c.theme or Category.THEMES[n % len(Category.THEMES)],
            "small": len(dishes) <= 2 and not c.is_combo,
        })
    rows, i = [], 0
    while i < len(chapters):
        if chapters[i]["small"] and i + 1 < len(chapters) and chapters[i + 1]["small"]:
            rows.append({"duo": True, "chapters": chapters[i:i + 2]})
            i += 2
        else:
            rows.append({"duo": False, "chapters": [chapters[i]]})
            i += 1
    all_dishes = [d for ch in chapters for d in ch["dishes"]]
    ta = get_lang(request) == "ta"
    dish_info = {
        str(d.id): {
            "alt": (d.name_en if ta else d.name_ta) or "",
            "details": (d.details_list_ta or d.details_list_en) if ta else d.details_list_en,
            "spice": d.spice_level,
        } for d in all_dishes
    }
    return render(request, "menu.html", {
        "dish_info": dish_info,
        "chapters": chapters, "rows": rows, "page": "menu",
        "is_sunday": Dish.is_sunday_today(),
        "has_sunday": any(d.sunday_only for d in all_dishes),
        "dish_total": len(all_dishes),
    })


# ================= Checkout & Razorpay =================

MAX_LINES = 30
MAX_QTY = 50


def _available_dishes():
    """Dishes that can be ordered right now (Sunday-only dishes only on Sundays)."""
    qs = Dish.objects.filter(is_available=True, category__is_active=True)
    if not Dish.is_sunday_today():
        qs = qs.exclude(sunday_only=True)
    return qs


def _parse_items(raw):
    """[{"id": "3", "qty": 2}, ...] -> {3: 2}. Ignores anything malformed."""
    try:
        data = json.loads(raw or "[]")
    except (ValueError, TypeError):
        return {}
    items = {}
    if not isinstance(data, list):
        return {}
    for row in data[:MAX_LINES]:
        try:
            dish_id, qty = int(row["id"]), int(row["qty"])
        except (KeyError, TypeError, ValueError):
            continue
        if dish_id > 0 and 1 <= qty <= MAX_QTY:
            items[dish_id] = min(items.get(dish_id, 0) + qty, MAX_QTY)
    return items


def _client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "")) or "unknown"


def _too_many(request, key, limit, seconds):
    """Simple per-visitor limit (stops bots hammering checkout / coupon)."""
    from django.core.cache import cache
    k = f"rl:{key}:{_client_ip(request)}"
    n = cache.get(k, 0) + 1
    cache.set(k, n, seconds)
    return n > limit


def _find_coupon(code, subtotal, phone=""):
    """-> (coupon, discount, error_key)"""
    from django.utils import timezone as tz
    code = (code or "").strip()
    if not code:
        return None, Decimal("0"), ""
    c = Coupon.objects.filter(code__iexact=code, is_active=True).first()
    today = tz.localdate()
    if not c or (c.valid_from and today < c.valid_from) or (c.valid_until and today > c.valid_until):
        return None, Decimal("0"), "co_err_coupon"
    if c.usage_limit is not None and c.used_count >= c.usage_limit:
        return None, Decimal("0"), "co_err_coupon_used"
    if subtotal < c.min_order:
        return None, Decimal("0"), "co_err_coupon_min"
    if phone and c.once_per_phone and Order.objects.filter(
            phone=phone, coupon_code__iexact=c.code).exclude(
            status__in=[Order.STATUS_PENDING, Order.STATUS_PAYMENT_FAILED, Order.STATUS_CANCELLED]).exists():
        return None, Decimal("0"), "co_err_coupon_once"
    return c, c.discount_for(subtotal), ""


def _dec(v):
    try:
        return Decimal(str(v))
    except Exception:
        return None


def checkout(request):
    """Checkout page (GET) and order placement (POST, answered as JSON for the page's script)."""
    site = SiteSettings.load()
    st = ordering.state(site)
    lang = get_lang(request)

    if request.method != "POST":
        dates = []
        d = st["earliest"]
        while d <= st["latest"]:
            dates.append(d)
            d += datetime.timedelta(days=1)
        return render(request, "checkout.html", {
            "page": "checkout", "st": st, "adv_dates": dates,
            "slots": [(s, ordering.slot_label(s, lang)) for s in st["slots"]],
            "open_label": ordering.fmt_time(site.order_start, lang), "close_label": ordering.fmt_time(site.order_end, lang),
            "has_coupons": Coupon.objects.filter(is_active=True).exists(),
            "closed_msg": t(request, "co_closed_now", start=ordering.fmt_time(site.order_start, lang), end=ordering.fmt_time(site.order_end, lang)),
        })

    def fail(errors=None, form_error="", status=400):
        return JsonResponse({"ok": False, "errors": errors or {}, "form_error": form_error}, status=status)

    if _too_many(request, "checkout", 20, 600):
        return fail(form_error=t(request, "co_err_busy"), status=429)
    if not payments.configured() and not payments.demo_mode():
        log.error("Checkout blocked: Razorpay keys are missing in .env")
        return fail(form_error=t(request, "err_payment_setup"), status=503)
    P = request.POST
    g = lambda k, n=300: (P.get(k, "") or "").strip()[:n]
    errors = {}

    # ---- when ----
    when = g("when", 10)
    if not site.kitchen_open:
        return fail(form_error=site.closed_message_ta if lang == "ta" else site.closed_message_en)
    if when == "later":
        try:
            day = datetime.date.fromisoformat(g("date", 10))
        except ValueError:
            day = None
        slot = g("slot", 20)
        if not day or not (st["earliest"] <= day <= st["latest"]):
            errors["date"] = t(request, "co_err_date")
        if slot not in st["slots"]:
            errors["slot"] = t(request, "co_err_slot")
        is_advance = True
    else:
        if not st["same_day_open"]:
            return fail(form_error=t(request, "co_closed_now", start=ordering.fmt_time(site.order_start, lang), end=ordering.fmt_time(site.order_end, lang)))
        day, slot, is_advance = st["today"], "ASAP", False

    # ---- who / where ----
    fulfil = Order.FULFIL_PICKUP if g("fulfilment", 10) == "pickup" else Order.FULFIL_DELIVERY
    name = g("name", 100)
    phone = re.sub(r"\D", "", g("phone", 20))[-10:]
    if len(name) < 2:
        errors["name"] = t(request, "err_name")
    if not re.fullmatch(r"[6-9]\d{9}", phone):
        errors["phone"] = t(request, "err_phone")
    building = address = landmark = label = ""
    lat = lng = acc = None
    if fulfil == Order.FULFIL_DELIVERY:
        building, address, landmark, label = g("building", 150), g("address", 500), g("landmark", 150), g("label", 30)
        if len(building) < 1:
            errors["building"] = t(request, "co_err_building")
        if len(address) < 8:
            errors["address"] = t(request, "err_address")
        lat, lng = _dec(g("lat", 20)), _dec(g("lng", 20))
        if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            errors["location"] = t(request, "co_err_location")
        elif site.delivery_radius_km and ordering.distance_km(float(lat), float(lng), float(site.kitchen_lat), float(site.kitchen_lng)) > site.delivery_radius_km:
            errors["location"] = t(request, "co_err_far")
        try:
            acc = max(0, min(int(float(g("acc", 10) or 0)), 100000)) or None
        except ValueError:
            acc = None

    # ---- items (prices always from the database) ----
    requested = _parse_items(P.get("items"))
    qs = Dish.objects.filter(is_available=True, category__is_active=True, pk__in=requested.keys())
    if day and day.weekday() != 6:
        qs = qs.exclude(sunday_only=True)
    dishes = {d.id: d for d in qs}
    form_error = ""
    if not requested:
        form_error = t(request, "err_cart_empty")
    elif len(dishes) != len(requested):
        form_error = t(request, "err_unavailable")
    subtotal = sum((dishes[i].price * q for i, q in requested.items() if i in dishes), Decimal("0"))
    if not form_error and site.min_order_amount and subtotal < site.min_order_amount:
        form_error = t(request, "err_min_order", amount=f"{site.min_order_amount:.0f}")

    coupon, discount, cerr = _find_coupon(g("coupon", 30), subtotal, phone if "phone" not in errors else "")
    if cerr:
        errors["coupon"] = t(request, cerr)
    if errors or form_error:
        return fail(errors, form_error)

    fee = site.delivery_charge if fulfil == Order.FULFIL_DELIVERY else Decimal("0")
    total = max(subtotal + fee - discount, Decimal("1"))
    with transaction.atomic():
        order = Order.objects.create(
            customer_name=name, phone=phone, address=address if fulfil == Order.FULFIL_DELIVERY else "Pickup",
            landmark=landmark, building=building, address_label=label, latitude=lat, longitude=lng,
            location_accuracy=acc, fulfilment=fulfil, delivery_date=day, delivery_slot=slot, is_advance=is_advance,
            delivery_area_name="Pickup" if fulfil == Order.FULFIL_PICKUP else (label or "Delivery"),
            notes=g("notes", 300), no_cutlery=P.get("no_cutlery") in ("1", "on", "true"),
            coupon_code=coupon.code if coupon else "", discount=discount,
            subtotal=subtotal, delivery_fee=fee, total=total, language=lang,
        )
        OrderItem.objects.bulk_create([
            OrderItem(order=order, dish=dishes[i], dish_name=dishes[i].name_en, unit_price=dishes[i].price,
                      quantity=q, line_total=dishes[i].price * q)
            for i, q in requested.items()
        ])
    if payments.configured():
        try:
            order.razorpay_order_id = payments.create_razorpay_order(order)
            order.save(update_fields=["razorpay_order_id", "updated_at"])
        except Exception:
            log.exception("Razorpay order create failed for %s", order.order_number)
            return fail(form_error=t(request, "err_payment_setup"), status=502)
    from django.urls import reverse
    return JsonResponse({"ok": True, "redirect": reverse("orders:pay", args=[order.token])})


@require_POST
def coupon_check(request):
    """Checkout page asks: is this code valid for this item total?"""
    if _too_many(request, "coupon", 30, 600):
        return JsonResponse({"ok": False, "message": t(request, "co_err_busy")}, status=429)
    subtotal = _dec(request.POST.get("subtotal", "0")) or Decimal("0")
    c, discount, err = _find_coupon(request.POST.get("code", ""), subtotal)
    if err:
        return JsonResponse({"ok": False, "message": t(request, err)})
    lang = get_lang(request)
    desc = (c.description_ta if lang == "ta" and c.description_ta else c.description_en) or ""
    return JsonResponse({"ok": True, "code": c.code, "discount": str(discount), "message": desc,
                         "kind": c.kind, "value": str(c.value), "max": str(c.max_discount or ""), "min": str(c.min_order)})


def pay(request, token):
    order = get_object_or_404(Order, token=token)
    if order.is_paid:
        return redirect("orders:success", token=order.token)
    demo = payments.demo_mode()
    if not demo and not order.razorpay_order_id:
        try:
            order.razorpay_order_id = payments.create_razorpay_order(order)
            order.save(update_fields=["razorpay_order_id", "updated_at"])
        except Exception:
            log.exception("Razorpay order create failed for %s", order.order_number)
            return redirect("orders:failed", token=order.token)
    return render(request, "pay.html", {"order": order, "page": "checkout", "demo": demo,
                                               "slot_text": ordering.slot_label(order.delivery_slot, get_lang(request))})


@require_POST
def verify(request, token):
    order = get_object_or_404(Order, token=token)
    if payments.demo_mode() and request.POST.get("demo") == "1":     # only on your computer without Razorpay keys
        order.mark_paid("demo_" + order.order_number)
        return redirect("orders:success", token=order.token)
    rp_order = request.POST.get("razorpay_order_id", "")
    rp_payment = request.POST.get("razorpay_payment_id", "")
    rp_sig = request.POST.get("razorpay_signature", "")
    if rp_order and rp_order == order.razorpay_order_id and payments.verify_checkout_signature(rp_order, rp_payment, rp_sig):
        order.mark_paid(rp_payment, rp_sig)
        log.info("Order %s paid (%s)", order.order_number, rp_payment)
        return redirect("orders:success", token=order.token)
    log.warning("Signature check failed for %s", order.order_number)
    if not order.is_paid:
        order.status = Order.STATUS_PAYMENT_FAILED
        order.save(update_fields=["status", "updated_at"])
    return redirect("orders:failed", token=order.token)


@csrf_exempt
@require_POST
def webhook(request):
    """Razorpay → this URL. Marks orders paid even if the customer closed the browser."""
    body = request.body.decode("utf-8")
    if not payments.verify_webhook(body, request.headers.get("X-Razorpay-Signature", "")):
        return HttpResponseBadRequest("invalid signature")
    try:
        event = json.loads(body)
        payment = event["payload"]["payment"]["entity"]
    except (ValueError, KeyError, TypeError):
        return HttpResponse("ignored")

    order = Order.objects.filter(razorpay_order_id=payment.get("order_id", "")).first()
    if not order:
        return HttpResponse("no order")

    name = event.get("event", "")
    if name in ("payment.captured", "order.paid"):
        if int(payment.get("amount", 0)) != order.amount_paise:
            log.error("Amount mismatch on %s: got %s expected %s", order.order_number, payment.get("amount"), order.amount_paise)
            return HttpResponse("amount mismatch")
        if order.mark_paid(payment.get("id", "")):
            log.info("Order %s paid via webhook", order.order_number)
    elif name == "payment.failed" and order.status == Order.STATUS_PENDING:
        order.status = Order.STATUS_PAYMENT_FAILED
        order.save(update_fields=["status", "updated_at"])
    return HttpResponse("ok")


def success(request, token):
    order = get_object_or_404(Order, token=token)
    if not order.is_paid:
        return redirect("orders:pay", token=order.token)
    lang = get_lang(request)
    day = order.delivery_date.strftime("%a, %d %b") if order.delivery_date else ""
    return render(request, "success.html", {"order": order, "page": "checkout",
                                                   "slot_text": ordering.slot_label(order.delivery_slot, lang),
                                                   "sc_sub_adv": t(request, "sc_sub_adv", day=day)})


def failed(request, token):
    order = get_object_or_404(Order, token=token)
    if order.is_paid:
        return redirect("orders:success", token=order.token)
    return render(request, "failed.html", {"order": order, "page": "checkout"})
