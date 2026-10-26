from decimal import Decimal

from django import template

register = template.Library()


@register.simple_tag(takes_context=True)
def tr(context, obj, field):
    """{% tr dish "name" %} -> dish.name_ta in Tamil mode (if filled), else dish.name_en."""
    if obj is None:
        return ""
    if context.get("lang") == "ta":
        value = getattr(obj, f"{field}_ta", "")
        if value:
            return value
    return getattr(obj, f"{field}_en", "")


@register.filter
def rupees(value):
    """12.00 -> 12, 12.50 -> 12.50"""
    try:
        d = Decimal(value)
    except Exception:
        return value
    return f"{d:,.0f}" if d == d.to_integral_value() else f"{d:,.2f}"
