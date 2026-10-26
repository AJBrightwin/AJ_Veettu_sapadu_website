"""All database tables for AJ Veettu Saapadu.

Table names are fixed with db_table so your separate admin panel can use the same
MySQL database. See SCHEMA.md.
"""
import datetime
import random
import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone


def new_order_token():
    """Return a 32-character token compatible with the Supabase schema."""
    return uuid.uuid4().hex


# ---------------- Site settings & contact ----------------

class SiteSettings(models.Model):
    """Single row (id=1) of business settings. Edit it from your admin panel."""

    kitchen_open = models.BooleanField(default=True, help_text="Untick to stop online orders (holiday, sold out, etc.)")
    closed_message_en = models.CharField(max_length=200, blank=True, default="Kitchen is closed right now. Please check back during order hours.")
    closed_message_ta = models.CharField(max_length=200, blank=True, default="இப்போது சமையலறை மூடப்பட்டுள்ளது. ஆர்டர் நேரத்தில் மீண்டும் வாருங்கள்.")
    order_hours_en = models.CharField(max_length=200, blank=True, default="Every day · Lunch 12 PM – 6 PM")
    order_hours_ta = models.CharField(max_length=200, blank=True, default="தினமும் · மதிய உணவு 12 – 6 மணி")
    phone = models.CharField(max_length=20, blank=True, default="+91 9751431501")
    whatsapp = models.CharField(max_length=20, blank=True, default="", help_text="Digits only with country code, e.g. 919876543210")
    email = models.EmailField(blank=True, default="")
    address_en = models.TextField(blank=True, default="1H/1668, Nigilesan Nagar,\n1st Street, Tuticorin,\nTamil Nadu")
    address_ta = models.TextField(blank=True, default="1H/1668, நிகிலேசன் நகர்,\n1வது தெரு, தூத்துக்குடி,\nதமிழ்நாடு")
    map_embed_url = models.URLField(max_length=600, blank=True, default="", help_text="Google Maps 'Embed a map' src URL")
    fssai_number = models.CharField(max_length=20, blank=True, default="")
    instagram_url = models.URLField(blank=True, default="")
    alert_email = models.EmailField(blank=True, default="", help_text="New contact messages are emailed here (also needs EMAIL_* in .env). Empty = no email alert")
    whatsapp_alert_url = models.URLField(max_length=400, blank=True, default="", help_text="Your WhatsApp bot's webhook URL. Each new contact message is POSTed here as JSON. Empty = off")
    whatsapp_alert_token = models.CharField(max_length=200, blank=True, default="", help_text="Optional secret sent as 'Authorization: Bearer <token>' to the webhook")
    swiggy_url = models.URLField(max_length=400, blank=True, default="", help_text="Your Swiggy restaurant page. Empty = button shows 'Coming soon'")
    zomato_url = models.URLField(max_length=400, blank=True, default="", help_text="Your Zomato restaurant page. Empty = button shows 'Coming soon'")
    min_order_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    delivery_charge = models.DecimalField(max_digits=8, decimal_places=2, default=85,
                                          help_text="One delivery charge for all of Tuticorin. Pickup is free")
    order_start = models.TimeField(default=datetime.time(12, 0), help_text="Same-day orders open at")
    order_end = models.TimeField(default=datetime.time(18, 0), help_text="Same-day orders close at")
    advance_min_days = models.PositiveSmallIntegerField(default=2, help_text="Advance orders: earliest day = today + this many days")
    advance_max_days = models.PositiveSmallIntegerField(default=30, help_text="Advance orders: latest day = today + this many days")
    kitchen_lat = models.DecimalField(max_digits=9, decimal_places=6, default=Decimal("8.764200"),
                                      help_text="Kitchen location (Google Maps → right-click your house → copy the numbers)")
    kitchen_lng = models.DecimalField(max_digits=9, decimal_places=6, default=Decimal("78.134800"))
    delivery_radius_km = models.PositiveSmallIntegerField(default=20, help_text="Orders further than this from the kitchen are refused. 0 = no limit")
    google_maps_key = models.CharField("Google Maps API key", max_length=100, blank=True, default="",
        help_text="Browser key starting with AIza... Empty = free OpenStreetMap is used on checkout")
    free_delivery_above = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="0 = never free")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ajvs_site_settings"
        verbose_name_plural = "site settings"

    def __str__(self):
        return "Site settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ContactMessage(models.Model):
    REASON_CHOICES = [
        ("order", "Order issue"),
        ("advance", "Advance order"),
        ("bulk", "Bulk / party order"),
        ("feedback", "Feedback"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, default="")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="other", db_index=True)
    message = models.TextField(max_length=2000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ajvs_contact_message"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class MenuSubscriber(models.Model):
    """People who asked for today's menu on WhatsApp (footer box)."""

    phone = models.CharField(max_length=10, unique=True, help_text="10-digit Indian mobile number")
    language = models.CharField(max_length=2, default="en")
    is_active = models.BooleanField(default=True, help_text="Untick if they ask to stop")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ajvs_menu_subscriber"
        ordering = ["-created_at"]

    def __str__(self):
        return self.phone


class PolicyPage(models.Model):
    """Terms, Privacy, Refund & Cancellation, Delivery. Empty body = 'being updated' message."""

    SLUGS = ["terms", "privacy", "refund", "delivery"]

    slug = models.SlugField(max_length=30, unique=True)
    title_en = models.CharField(max_length=120)
    title_ta = models.CharField(max_length=120, blank=True, default="")
    body_en = models.TextField(blank=True, default="", help_text="Plain text. Blank line = new paragraph.")
    body_ta = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ajvs_policy_page"
        ordering = ["id"]

    def __str__(self):
        return self.title_en


# ---------------- Menu ----------------

ART_CHOICES = [
    ("", "Automatic (from the name)"),
    ("meal", "Banana-leaf meals"),
    ("biryani", "Biryani pot"),
    ("curry", "Curry bowl"),
    ("fish", "Fish fry"),
    ("chicken", "Chicken fry / 65"),
    ("egg", "Egg"),
    ("veg", "Vegetables / poriyal"),
    ("sweet", "Sweet / payasam"),
    ("drink", "Drink / buttermilk"),
    ("combo", "Combo plate"),
]

# keywords used when the illustration is left on "Automatic"
ART_KEYWORDS = [
    ("combo", ("combo", "காம்போ", " + ")),
    ("biryani", ("biryani", "biriyani", "briyani", "பிரியாணி")),
    ("meal", ("meals", "meal", "sapadu", "saapadu", "thali", "சாப்பாடு")),
    ("drink", ("drink", "juice", "buttermilk", "lassi", "tea", "coffee", "soda", "lime", "மோர்", "ஜூஸ்", "பானம்")),
    ("sweet", ("sweet", "payasam", "kesari", "halwa", "dessert", "பாயசம்", "இனிப்பு", "கேசரி")),
    ("curry", ("curry", "kuzhambu", "gravy", "kurma", "குழம்பு", "குருமா")),
    ("fish", ("fish", "prawn", "crab", "squid", "seafood", "மீன்", "இறால்", "நண்டு")),
    ("egg", ("egg", "omelette", "முட்டை")),
    ("chicken", ("chicken", "mutton", "beef", "65", "chops", "fry", "சிக்கன்", "வறுவல்")),
    ("veg", ("poriyal", "kootu", "salad", "vegetable", "பொரியல்", "கூட்டு")),
    ("meal", ("rice", "சாதம்")),
]


def guess_art(*texts, default="meal"):
    text = " ".join(t for t in texts if t).lower()
    for art, words in ART_KEYWORDS:
        if any(w in text for w in words):
            return art
    return default


class Category(models.Model):
    THEME_CHOICES = [
        ("", "Automatic (a different colour for each section)"),
        ("leaf", "Banana-leaf green"),
        ("spice", "Spice brown"),
        ("sea", "Sea teal"),
        ("chilli", "Chilli maroon"),
        ("saffron", "Saffron gold"),
        ("night", "Royal night"),
    ]
    THEMES = ["leaf", "spice", "sea", "chilli", "saffron", "night"]

    name_en = models.CharField(max_length=80)
    name_ta = models.CharField(max_length=80, blank=True, default="")
    slug = models.SlugField(max_length=80, unique=True)
    tagline_en = models.CharField(max_length=160, blank=True, default="",
                                  help_text="Short line under the section name on the menu page")
    tagline_ta = models.CharField(max_length=160, blank=True, default="")
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, blank=True, default="",
                             help_text="Colour of this section's banner on the menu page")
    art = models.CharField("illustration", max_length=10, choices=ART_CHOICES, blank=True, default="",
                           help_text="Big drawing on the section banner")
    image = models.ImageField("banner photo", upload_to="categories/", blank=True, null=True,
                              help_text="Wide food photo for the section banner (landscape, about 1600×900). Empty = drawing")
    is_combo = models.BooleanField("combo section", default=False,
                                   help_text="Tick for the Combos section: its dishes show as gold combo cards")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "ajvs_category"
        ordering = ["sort_order", "id"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name_en

    @property
    def art_key(self):
        if self.art:
            return self.art
        return "combo" if self.is_combo else guess_art(self.slug, self.name_en, self.name_ta)


class Dish(models.Model):
    SLOT_ALL = "all"
    SLOT_LUNCH = "lunch"
    SLOT_DINNER = "dinner"
    SLOT_CHOICES = [(SLOT_ALL, "All day"), (SLOT_LUNCH, "Lunch"), (SLOT_DINNER, "Dinner")]
    BADGE_CHOICES = [("", "No badge"), ("bestseller", "Bestseller"), ("chef", "Chef's special"), ("new", "New")]
    SPICE_CHOICES = [(0, "Don't show"), (1, "Mild"), (2, "Medium"), (3, "Spicy")]

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="dishes")
    name_en = models.CharField(max_length=120)
    name_ta = models.CharField(max_length=120, blank=True, default="")
    description_en = models.CharField(max_length=300, blank=True, default="")
    description_ta = models.CharField(max_length=300, blank=True, default="")
    price = models.DecimalField(max_digits=8, decimal_places=2)
    image = models.ImageField(upload_to="dishes/", blank=True, null=True)
    is_veg = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True, help_text="Untick when sold out today")
    is_special = models.BooleanField(default=False, help_text="Show on the home page as today's special")
    meal_slot = models.CharField(max_length=10, choices=SLOT_CHOICES, default=SLOT_ALL)
    badge = models.CharField(max_length=12, choices=BADGE_CHOICES, blank=True, default="",
                             help_text="Small ribbon on the dish card")
    sunday_only = models.BooleanField(default=False,
                                      help_text="Can be ordered only on Sundays. Other days it shows as 'Sundays only'")
    art = models.CharField("illustration", max_length=10, choices=ART_CHOICES, blank=True, default="",
                           help_text="Drawing shown when there is no photo")
    spice_level = models.PositiveSmallIntegerField(choices=SPICE_CHOICES, default=0)
    details_en = models.TextField(blank=True, default="", max_length=800,
                                  help_text="Shown in the dish pop-up. One item per line, e.g. what comes with the meal")
    details_ta = models.TextField(blank=True, default="", max_length=800)
    compare_price = models.DecimalField("price without combo", max_digits=8, decimal_places=2, null=True, blank=True,
                                        help_text="For combos: the price if bought separately. Shows 'Save ₹…'")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ajvs_dish"
        ordering = ["category__sort_order", "sort_order", "id"]
        verbose_name_plural = "dishes"

    def __str__(self):
        return f"{self.name_en} (₹{self.price})"

    @property
    def art_key(self):
        if self.art:
            return self.art
        return guess_art(self.name_en, self.name_ta, default=self.category.art_key)

    @property
    def details_list_en(self):
        return [x.strip(" -•\t") for x in self.details_en.splitlines() if x.strip(" -•\t")]

    @property
    def details_list_ta(self):
        return [x.strip(" -•\t") for x in self.details_ta.splitlines() if x.strip(" -•\t")]

    @property
    def save_amount(self):
        if self.compare_price and self.compare_price > self.price:
            return self.compare_price - self.price
        return None

    @staticmethod
    def is_sunday_today():
        return timezone.localdate().weekday() == 6

    @property
    def can_order_today(self):
        return self.is_available and (not self.sunday_only or self.is_sunday_today())


# ---------------- Orders ----------------

from django.db import models
from django.utils import timezone


class DeliveryArea(models.Model):
    name_en = models.CharField(max_length=100)
    name_ta = models.CharField(max_length=100, blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ajvs_delivery_area"
        ordering = ["sort_order", "name_en"]

    def __str__(self):
        return f"{self.name_en} (₹{self.delivery_fee})"


class Order(models.Model):
    STATUS_PENDING = "pending_payment"
    STATUS_PAID = "paid"
    STATUS_PAYMENT_FAILED = "payment_failed"
    STATUS_PREPARING = "preparing"
    STATUS_OUT = "out_for_delivery"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending payment"),
        (STATUS_PAID, "Paid (new order)"),
        (STATUS_PAYMENT_FAILED, "Payment failed"),
        (STATUS_PREPARING, "Preparing"),
        (STATUS_OUT, "Out for delivery"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    order_number = models.CharField(max_length=20, unique=True, editable=False)
    token = models.CharField(max_length=32, default=new_order_token, unique=True, editable=False,
                             help_text="Secret id used in the customer's order links")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, default="")
    address = models.TextField(max_length=500)
    landmark = models.CharField(max_length=150, blank=True, default="")
    delivery_area = models.ForeignKey(DeliveryArea, on_delete=models.SET_NULL, null=True, related_name="orders")
    delivery_area_name = models.CharField(max_length=100, blank=True, default="")
    notes = models.CharField(max_length=300, blank=True, default="")
    FULFIL_DELIVERY = "delivery"
    FULFIL_PICKUP = "pickup"
    FULFIL_CHOICES = [(FULFIL_DELIVERY, "Delivery"), (FULFIL_PICKUP, "Pickup")]
    fulfilment = models.CharField(max_length=10, choices=FULFIL_CHOICES, default=FULFIL_DELIVERY, db_index=True)
    delivery_date = models.DateField(null=True, blank=True, db_index=True, help_text="Day the food is wanted")
    delivery_slot = models.CharField(max_length=20, blank=True, default="", help_text="ASAP or a time like 13:00-14:00")
    is_advance = models.BooleanField(default=False, help_text="Ordered for a later day")
    building = models.CharField("building / flat", max_length=150, blank=True, default="")
    address_label = models.CharField(max_length=30, blank=True, default="", help_text="Home / Office / Other")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy = models.PositiveIntegerField(null=True, blank=True, help_text="metres")
    no_cutlery = models.BooleanField(default=False)
    coupon_code = models.CharField(max_length=30, blank=True, default="")
    discount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    razorpay_order_id = models.CharField(max_length=60, blank=True, default="", db_index=True)
    razorpay_payment_id = models.CharField(max_length=60, blank=True, default="")
    razorpay_signature = models.CharField(max_length=200, blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    language = models.CharField(max_length=2, default="en")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ajvs_order"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} · {self.customer_name} · ₹{self.total} · {self.status}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._new_order_number()
        super().save(*args, **kwargs)

    @classmethod
    def _new_order_number(cls):
        stamp = timezone.localtime().strftime("%y%m%d")
        while True:
            num = f"AJVS{stamp}{random.randint(1000, 9999)}"
            if not cls.objects.filter(order_number=num).exists():
                return num

    @property
    def map_url(self):
        if self.latitude is None or self.longitude is None:
            return ""
        return f"https://www.google.com/maps?q={self.latitude},{self.longitude}"

    @property
    def slot_label(self):
        from .ordering import slot_label
        return slot_label(self.delivery_slot)

    @property
    def amount_paise(self):
        return int(round(self.total * 100))

    @property
    def is_paid(self):
        return self.status not in (self.STATUS_PENDING, self.STATUS_PAYMENT_FAILED, self.STATUS_CANCELLED)

    def mark_paid(self, payment_id, signature=""):
        """Idempotent: safe to call from both the browser callback and the webhook."""
        if self.is_paid:
            return False
        self.status = self.STATUS_PAID
        self.razorpay_payment_id = payment_id
        if signature:
            self.razorpay_signature = signature
        self.paid_at = timezone.now()
        self.save(update_fields=["status", "razorpay_payment_id", "razorpay_signature", "paid_at", "updated_at"])
        if self.coupon_code:
            Coupon.objects.filter(code__iexact=self.coupon_code).update(used_count=models.F("used_count") + 1)
        return True


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    dish = models.ForeignKey(Dish, on_delete=models.SET_NULL, null=True, related_name="order_items")
    dish_name = models.CharField(max_length=120, help_text="Name at the time of order")
    unit_price = models.DecimalField(max_digits=8, decimal_places=2, help_text="Price at the time of order")
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "ajvs_order_item"

    def __str__(self):
        return f"{self.quantity} × {self.dish_name}"


class Coupon(models.Model):
    """Promo codes customers can type at checkout. Checked again on the server for every order."""

    KIND_PERCENT = "percent"
    KIND_FLAT = "flat"
    KIND_CHOICES = [(KIND_PERCENT, "% off"), (KIND_FLAT, "₹ off")]

    code = models.CharField(max_length=30, unique=True, help_text="What the customer types, e.g. WELCOME50 (not case-sensitive)")
    description_en = models.CharField(max_length=150, blank=True, default="")
    description_ta = models.CharField(max_length=150, blank=True, default="")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=KIND_FLAT)
    value = models.DecimalField(max_digits=8, decimal_places=2, help_text="50 = ₹50 off, or 10 = 10% off")
    max_discount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Cap for % coupons (optional)")
    min_order = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Item total needed to use it")
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Total uses allowed (empty = no limit)")
    once_per_phone = models.BooleanField(default=True, help_text="Each mobile number can use it only once")
    used_count = models.PositiveIntegerField(default=0, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ajvs_coupon"
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def discount_for(self, subtotal):
        if self.kind == self.KIND_PERCENT:
            d = (subtotal * self.value / 100).quantize(Decimal("1"))
            if self.max_discount:
                d = min(d, self.max_discount)
        else:
            d = self.value
        return max(Decimal("0"), min(d, subtotal))
