"""All website URLs. Grouped so templates can use core:, menu: and orders: names."""
from django.urls import path

from . import views

core_urls = ([
    path("", views.home, name="home"),
    path("our-story/", views.story, name="story"),
    path("contact/", views.contact, name="contact"),
    path("lang/<str:code>/", views.set_language, name="set_language"),
    path("subscribe/", views.subscribe, name="subscribe"),
    path("terms/", views.policy, {"slug": "terms"}, name="terms"),
    path("privacy-policy/", views.policy, {"slug": "privacy"}, name="privacy"),
    path("refund-policy/", views.policy, {"slug": "refund"}, name="refund"),
    path("delivery-policy/", views.policy, {"slug": "delivery"}, name="delivery"),
], "core")

menu_urls = ([
    path("", views.menu_page, name="menu"),
], "menu")

order_urls = ([
    path("checkout/", views.checkout, name="checkout"),
    path("coupon/", views.coupon_check, name="coupon"),
    path("razorpay/webhook/", views.webhook, name="webhook"),
    path("<uuid:token>/pay/", views.pay, name="pay"),
    path("<uuid:token>/verify/", views.verify, name="verify"),
    path("<uuid:token>/success/", views.success, name="success"),
    path("<uuid:token>/failed/", views.failed, name="failed"),
], "orders")
