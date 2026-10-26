"""Load a starter menu, delivery areas and site settings.

Run once after migrating:   python manage.py seed_menu
All prices, areas and fees are SAMPLES. Change them from your admin panel.
Running it again does not create duplicates.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from myapp.menu_samples import apply
from myapp.models import DeliveryArea, Category, Dish, SiteSettings

AREAS = [
    ("Millerpuram", "மில்லர்புரம்", "30"),
    ("Tooveypuram", "டூவிபுரம்", "30"),
    ("Bryant Nagar", "பிரையண்ட் நகர்", "30"),
    ("Caldwell Colony", "கால்டுவெல் காலனி", "30"),
    ("Polpettai", "போல்பேட்டை", "40"),
    ("Meenakshipuram", "மீனாட்சிபுரம்", "40"),
    ("Anna Nagar", "அண்ணா நகர்", "40"),
]


class Command(BaseCommand):
    help = "Load sample menu, delivery areas and site settings (safe to run again)."

    def handle(self, *args, **opts):
        made = apply(Category, Dish)

        for i, (en, ta, fee) in enumerate(AREAS):
            DeliveryArea.objects.get_or_create(name_en=en, defaults={"name_ta": ta, "delivery_fee": Decimal(fee), "sort_order": i})

        s = SiteSettings.load()
        if not s.min_order_amount:
            s.min_order_amount = Decimal("100")
            s.free_delivery_above = Decimal("500")
            s.save()

        self.stdout.write(self.style.SUCCESS(f"Done. {made} new dishes added. Edit prices and areas from your admin panel."))
