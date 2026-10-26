from django.conf import settings

from .models import Dish, SiteSettings
from .translations import STRINGS, get_lang


def _cart_catalog():
    """Dishes that can be ordered right now, for the cart (photos, names, suggestions).

    Built only when a page actually uses it.
    """
    qs = Dish.objects.filter(is_available=True, category__is_active=True).select_related("category")
    if not Dish.is_sunday_today():
        qs = qs.exclude(sunday_only=True)
    out = []
    for d in qs.order_by("category__sort_order", "sort_order", "id"):
        art = d.art_key
        cat = d.category.slug.lower()
        # what to suggest first in "Complete your meal": drinks & sweets, then side dishes, then the rest
        rank = 0 if art in ("drink", "sweet") else 1 if ("side" in cat or art in ("fish", "chicken", "egg", "veg", "curry")) and not d.category.is_combo else 2
        out.append({
            "id": str(d.id), "en": d.name_en, "ta": d.name_ta or d.name_en, "price": str(d.price),
            "img": d.image.url if d.image else "", "veg": d.is_veg, "rank": rank,
        })
    return out


def site(request):
    lang = get_lang(request)
    return {
        "lang": lang,
        "T": STRINGS[lang],
        "site": SiteSettings.load(),
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        "cart_catalog": _cart_catalog,          # templates call it only when used
    }
