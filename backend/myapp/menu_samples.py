"""Sample menu used by the 0004 migration (upgrades the old sample menu) and by `seed_menu`.

Everything here is a SAMPLE. Change names, prices, badges and pictures from the admin panel.
"""

# slug, name_en, name_ta, tagline_en, tagline_ta, theme, art, is_combo, sort_order
CATEGORIES = [
    ("meals", "Meals", "சாப்பாடு",
     "Banana-leaf meals, the way home serves them.", "வீட்டில் பரிமாறுவது போல, வாழை இலை சாப்பாடு.",
     "leaf", "meal", False, 1),
    ("biryani", "Biryani", "பிரியாணி",
     "Slow-cooked on dum. Mutton and beef on Sundays.", "தம்மில் மெதுவாகச் சமைத்தது. ஞாயிறன்று மட்டன், பீஃப்.",
     "spice", "biryani", False, 2),
    ("sides", "Side dish", "சைடு டிஷ்",
     "Something extra for your plate.", "உங்கள் தட்டுக்கு கூடுதல் சுவை.",
     "chilli", "fish", False, 3),
    ("drinks", "Drinks", "பானங்கள்",
     "Cool down after a good lunch.", "நல்ல சாப்பாட்டுக்குப் பின் ஒரு குளிர்ச்சி.",
     "sea", "drink", False, 4),
    ("combos", "Combos", "காம்போ",
     "More on one plate, for less.", "ஒரே தட்டில் அதிகம், குறைந்த விலையில்.",
     "saffron", "combo", True, 5),
]

# category, name_en, name_ta, desc_en, desc_ta, price, veg, badge, sunday_only, spice, details_en, details_ta, compare_price
DISHES = [
    ("meals", "Veg Meals", "சைவ சாப்பாடு",
     "Rice, sambar, rasam, kootu, poriyal, appalam and curd on a banana leaf.",
     "சாதம், சாம்பார், ரசம், கூட்டு, பொரியல், அப்பளம், தயிர், வாழை இலையில்.",
     "100", True, "bestseller", False, 1,
     "Rice\nSambar\nRasam\nKootu & poriyal\nAppalam\nCurd", "சாதம்\nசாம்பார்\nரசம்\nகூட்டு, பொரியல்\nஅப்பளம்\nதயிர்", None),
    ("meals", "Fish Curry Meals", "மீன் குழம்பு சாப்பாடு",
     "Rice with Tuticorin-style fish kuzhambu, fish fry, rasam, poriyal and curd.",
     "தூத்துக்குடி மீன் குழம்பு, மீன் வறுவல், ரசம், பொரியல், தயிருடன் சாதம்.",
     "160", False, "chef", False, 2,
     "Rice\nFish kuzhambu\nFish fry (1 pc)\nRasam\nPoriyal\nCurd", "சாதம்\nமீன் குழம்பு\nமீன் வறுவல் (1)\nரசம்\nபொரியல்\nதயிர்", None),
    ("meals", "Chicken Curry Meals", "சிக்கன் குழம்பு சாப்பாடு",
     "Rice with home-style chicken kuzhambu, rasam, poriyal and curd.",
     "வீட்டு முறை சிக்கன் குழம்பு, ரசம், பொரியல், தயிருடன் சாதம்.",
     "150", False, "", False, 2, "", "", None),
    ("biryani", "Chicken Biryani", "சிக்கன் பிரியாணி",
     "Seeraga samba rice slow-cooked with tender chicken. Served with raita.",
     "மென்மையான சிக்கனுடன் சீரக சம்பா பிரியாணி. தயிர் பச்சடியுடன்.",
     "180", False, "bestseller", False, 2,
     "Chicken biryani\nOnion raita\nBrinjal curry", "சிக்கன் பிரியாணி\nதயிர் பச்சடி\nகத்திரிக்காய் தொக்கு", None),
    ("biryani", "Mutton Biryani", "மட்டன் பிரியாணி",
     "Our special, cooked the home way with tender mutton.",
     "எங்கள் சிறப்பு, மென்மையான மட்டனுடன் வீட்டு முறையில்.",
     "260", False, "chef", True, 2, "", "", None),
    ("biryani", "Beef Biryani", "பீஃப் பிரியாணி",
     "Rich, slow-cooked and fragrant.",
     "மணமும் சுவையும் நிறைந்த, மெதுவாகச் சமைத்த பிரியாணி.",
     "220", False, "", True, 3, "", "", None),
    ("sides", "Fish Fry (2 pcs)", "மீன் வறுவல் (2)",
     "Coastal masala, shallow fried.", "கடற்கரை மசாலா தடவி வறுத்த மீன்.",
     "90", False, "new", False, 2, "", "", None),
    ("sides", "Chicken Curry", "சிக்கன் குழம்பு",
     "Home-style chicken curry, goes with any meal.", "எந்தச் சாப்பாட்டுக்கும் ஏற்ற வீட்டு சிக்கன் குழம்பு.",
     "120", False, "", False, 2, "", "", None),
    ("drinks", "Spiced Buttermilk", "மசாலா மோர்",
     "Neer mor with ginger, curry leaves and green chilli.", "இஞ்சி, கறிவேப்பிலை, பச்சை மிளகாயுடன் நீர் மோர்.",
     "30", True, "", False, 0, "", "", None),
    ("combos", "Meals + Fish Fry", "சாப்பாடு + மீன் வறுவல்",
     "Veg meals with 2 pcs fish fry.", "சைவ சாப்பாடு, 2 மீன் வறுவலுடன்.",
     "170", False, "", False, 1, "Veg meals\nFish fry (2 pcs)", "சைவ சாப்பாடு\nமீன் வறுவல் (2)", "190"),
    ("combos", "Biryani + Buttermilk", "பிரியாணி + மோர்",
     "Chicken biryani with spiced buttermilk.", "சிக்கன் பிரியாணி, மசாலா மோருடன்.",
     "199", False, "bestseller", False, 2, "Chicken biryani\nOnion raita\nSpiced buttermilk", "சிக்கன் பிரியாணி\nதயிர் பச்சடி\nமசாலா மோர்", "210"),
]

# old sample names that were renamed
RENAMED = {"Mutton Biryani (Sunday special)": "Mutton Biryani"}


def apply(Category, Dish, upgrade=False):
    """Create or upgrade the sample menu. Returns number of dishes created.

    upgrade=True (migration): touch only the old sample rows, hide the Tiffin section.
    """
    from decimal import Decimal

    if upgrade:
        if not Category.objects.exists():
            return 0                                   # fresh database: seed_menu will fill it
        Category.objects.filter(slug="tiffin").update(is_active=False)
        Dish.objects.filter(category__slug="tiffin").update(is_available=False)
        for old, new in RENAMED.items():
            Dish.objects.filter(name_en=old).update(name_en=new)

    cats = {}
    for slug, en, ta, ten, tta, theme, art, combo, order in CATEGORIES:
        c, created = Category.objects.get_or_create(slug=slug, defaults=dict(
            name_en=en, name_ta=ta, sort_order=order))
        if created or upgrade:
            c.name_en, c.name_ta = en, ta
            c.tagline_en = c.tagline_en or ten
            c.tagline_ta = c.tagline_ta or tta
            c.theme, c.art, c.is_combo, c.sort_order = c.theme or theme, c.art or art, combo, order
            c.save()
        cats[slug] = c

    made = 0
    for i, (cat, en, ta, den, dta, price, veg, badge, sun, spice, ext_en, ext_ta, compare) in enumerate(DISHES):
        d, created = Dish.objects.get_or_create(name_en=en, defaults=dict(
            category=cats[cat], name_ta=ta, description_en=den, description_ta=dta, price=Decimal(price),
            is_veg=veg, meal_slot="lunch", sort_order=i))
        if created or upgrade:
            d.category = cats[cat]
            d.badge, d.sunday_only, d.spice_level = badge, sun, spice
            d.details_en = d.details_en or ext_en
            d.details_ta = d.details_ta or ext_ta
            d.compare_price = Decimal(compare) if compare else None
            d.meal_slot = "lunch"
            d.sort_order = i
            if upgrade and not created:
                d.description_en, d.description_ta = den, dta
            d.save()
        made += created
    return made
