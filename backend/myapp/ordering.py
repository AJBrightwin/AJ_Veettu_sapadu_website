"""When customers may order.

* Same-day orders: only between SiteSettings.order_start and order_end (default 12 PM – 6 PM).
* Advance orders: any time, for a day at least `advance_min_days` ahead (default 2)
  and at most `advance_max_days` ahead (default 30), in a one-hour slot inside the same hours.
All checks run again on the server when the order is placed.
"""
import datetime
import math

from django.utils import timezone


def now():
    """Current local time (Asia/Kolkata). Tests patch this."""
    return timezone.localtime()


def fmt_time(t, lang="en"):
    """13:00 -> '1 PM', 13:30 -> '1:30 PM' (works on Windows too)."""
    h12 = t.hour % 12 or 12
    ampm = "AM" if t.hour < 12 else "PM"
    if lang == "ta":
        ampm = "காலை" if t.hour < 12 else ("மதியம்" if t.hour < 16 else "மாலை")
        return f"{ampm} {h12}" + (f":{t.minute:02d}" if t.minute else "")
    return f"{h12}{':%02d' % t.minute if t.minute else ''} {ampm}"


def slot_label(slot, lang="en"):
    if slot in ("", "ASAP"):
        return "ASAP" if lang == "en" else "உடனடியாக"
    try:
        a, b = [datetime.datetime.strptime(x, "%H:%M").time() for x in slot.split("-")]
    except ValueError:
        return slot
    return f"{fmt_time(a, lang)} – {fmt_time(b, lang)}"


def slots(site):
    """One-hour slots between opening and closing time: ['12:00-13:00', ...]."""
    out = []
    start = datetime.datetime.combine(datetime.date.today(), site.order_start)
    end = datetime.datetime.combine(datetime.date.today(), site.order_end)
    t = start
    while t + datetime.timedelta(hours=1) <= end:
        out.append(f"{t:%H:%M}-{t + datetime.timedelta(hours=1):%H:%M}")
        t += datetime.timedelta(hours=1)
    if t < end:                                   # last part-hour, e.g. 17:00-17:30
        out.append(f"{t:%H:%M}-{end:%H:%M}")
    return out


def state(site, at=None):
    at = at or now()
    today = at.date()
    t = at.time()
    open_now = bool(site.kitchen_open) and site.order_start <= t < site.order_end
    return {
        "today": today,
        "same_day_open": open_now,
        "before_open": t < site.order_start,
        "after_close": t >= site.order_end,
        "earliest": today + datetime.timedelta(days=site.advance_min_days),
        "latest": today + datetime.timedelta(days=max(site.advance_max_days, site.advance_min_days)),
        "slots": slots(site),
        "start": site.order_start,
        "end": site.order_end,
    }


def distance_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
