"""Built-in Django admin at /admin/ — a ready backup until your own admin panel is live.

Create a login with:  python manage.py createsuperuser
"""
from django.contrib import admin

from .models import (Category, ContactMessage, Coupon, DeliveryArea, Dish, MenuSubscriber, Order, OrderItem,
                     PolicyPage, SiteSettings)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "kitchen_open", "phone", "min_order_amount", "delivery_charge", "order_start", "order_end")

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Each active section with dishes becomes a 'chapter' on the menu page, in sort order."""
    list_display = ("name_en", "name_ta", "theme", "art", "is_combo", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("name_en",)}
    fieldsets = (
        (None, {"fields": ("name_en", "name_ta", "slug", "sort_order", "is_active")}),
        ("Menu page banner", {"fields": ("image", "tagline_en", "tagline_ta", "theme", "art", "is_combo")}),
    )


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = ("name_en", "category", "price", "is_veg", "badge", "sunday_only", "is_available", "is_special", "sort_order")
    list_editable = ("price", "badge", "sunday_only", "is_available", "is_special", "sort_order")
    list_filter = ("category", "is_veg", "is_available", "badge", "sunday_only", "is_special")
    search_fields = ("name_en", "name_ta")
    fieldsets = (
        (None, {"fields": ("category", "name_en", "name_ta", "description_en", "description_ta", "price", "is_veg")}),
        ("On the menu page", {"fields": ("badge", "sunday_only", "is_available", "is_special", "sort_order", "image", "art")}),
        ("Dish pop-up (optional)", {"fields": ("details_en", "details_ta", "spice_level", "compare_price")}),
        ("Other", {"classes": ("collapse",), "fields": ("meal_slot",)}),
    )


@admin.register(DeliveryArea)
class DeliveryAreaAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ta", "delivery_fee", "is_active", "sort_order")
    list_editable = ("delivery_fee", "is_active", "sort_order")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("dish", "dish_name", "unit_price", "quantity", "line_total")
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "customer_name", "phone", "fulfilment", "delivery_date", "delivery_slot",
                    "total", "status", "created_at")
    list_filter = ("status", "fulfilment", "is_advance", "delivery_date", "created_at")
    list_editable = ("status",)
    search_fields = ("order_number", "customer_name", "phone", "razorpay_payment_id", "coupon_code")
    date_hierarchy = "delivery_date"
    readonly_fields = ("order_number", "token", "subtotal", "delivery_fee", "discount", "total", "razorpay_order_id",
                       "razorpay_payment_id", "razorpay_signature", "paid_at", "created_at", "updated_at", "map_link")
    fieldsets = (
        (None, {"fields": ("order_number", "status", "customer_name", "phone", "email")}),
        ("When", {"fields": ("fulfilment", "delivery_date", "delivery_slot", "is_advance")}),
        ("Where", {"fields": ("address_label", "building", "address", "landmark", "map_link", "latitude", "longitude", "location_accuracy")}),
        ("Kitchen notes", {"fields": ("notes", "no_cutlery")}),
        ("Money", {"fields": ("subtotal", "delivery_fee", "coupon_code", "discount", "total")}),
        ("Razorpay", {"classes": ("collapse",), "fields": ("razorpay_order_id", "razorpay_payment_id", "razorpay_signature", "paid_at", "token", "created_at", "updated_at")}),
    )
    inlines = [OrderItemInline]

    @admin.display(description="Map")
    def map_link(self, obj):
        from django.utils.html import format_html
        return format_html('<a href="{}" target="_blank" rel="noopener">Open in Google Maps</a>', obj.map_url) if obj.map_url else "-"


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "kind", "value", "min_order", "valid_until", "used_count", "usage_limit", "is_active")
    list_editable = ("is_active",)
    search_fields = ("code",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email", "reason", "created_at", "is_read")
    list_editable = ("is_read",)
    list_filter = ("reason", "is_read", "created_at")
    search_fields = ("name", "phone", "email", "message")


@admin.register(MenuSubscriber)
class MenuSubscriberAdmin(admin.ModelAdmin):
    list_display = ("phone", "language", "is_active", "created_at")
    list_editable = ("is_active",)
    list_filter = ("is_active", "language")
    search_fields = ("phone",)


@admin.register(PolicyPage)
class PolicyPageAdmin(admin.ModelAdmin):
    list_display = ("title_en", "slug", "updated_at")
    readonly_fields = ("slug",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
