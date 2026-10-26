"""Put the sample food photos (myapp/sample_photos/) on the menu page.

    python manage.py load_sample_photos          # fills only dishes/sections that have no photo yet
    python manage.py load_sample_photos --force  # puts the sample photos back again

Each photo is copied into the media folder, exactly like a photo uploaded from the admin panel,
so you can change any of them later from the admin panel (Dish -> Image, Category -> Banner photo).
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from myapp.models import Category, Dish

PHOTOS = Path(__file__).resolve().parents[2] / "sample_photos"

# section slug -> banner photo
CATEGORY_PHOTOS = {
    "meals": "meals-rice-curry.jpg",
    "biryani": "chicken-biryani.jpg",
    "sides": "fish-fry.jpg",
    "drinks": "drink.jpg",
    "combos": "meals.jpg",
}

# dish name (English, as in the admin panel) -> photo
DISH_PHOTOS = {
    "Veg Meals": "meals.jpg",
    "Fish Curry Meals": "meals-rice-curry.jpg",
    "Chicken Curry Meals": "meals.jpg",
    "Chicken Biryani": "chicken-biryani.jpg",
    "Mutton Biryani": "mutton-biryani.jpg",
    "Beef Biryani": "mutton-biryani.jpg",
    "Fish Fry (2 pcs)": "fish-fry.jpg",
    "Chicken Curry": "chicken-65.jpg",
    "Chicken 65": "chicken-65.jpg",
    "Spiced Buttermilk": "drink.jpg",
    "Meals + Fish Fry": "meals.jpg",
    "Biryani + Buttermilk": "chicken-biryani.jpg",
}


class Command(BaseCommand):
    help = "Put the sample food photos on the menu page (banners and dishes)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Replace photos that are already set")

    def handle(self, *args, **opts):
        force = opts["force"]
        done = skipped = missing = 0
        jobs = []
        for slug, fname in CATEGORY_PHOTOS.items():
            c = Category.objects.filter(slug=slug).first()
            if c:
                jobs.append((c, fname, f"{slug}-banner.jpg", f"section '{c.name_en}'"))
        for name, fname in DISH_PHOTOS.items():
            d = Dish.objects.filter(name_en=name).first()
            if d:
                safe = "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-")
                jobs.append((d, fname, f"{safe}.jpg", f"dish '{name}'"))

        for obj, fname, target, label in jobs:
            src = PHOTOS / fname
            if obj.image and not force:
                skipped += 1
                self.stdout.write(f"  skip  {label} (already has a photo)")
                continue
            if not src.exists():
                missing += 1
                self.stdout.write(self.style.WARNING(f"  MISSING  {src}"))
                continue
            with src.open("rb") as fh:
                obj.image.save(target, File(fh), save=True)
            done += 1
            self.stdout.write(self.style.SUCCESS(f"  OK    {label}  <-  {fname}"))

        self.stdout.write(self.style.SUCCESS(f"\nDone: {done} photos added, {skipped} kept, {missing} missing."))
