import sys

from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path
from django.views.static import serve

from myapp.urls import core_urls, menu_urls, order_urls

urlpatterns = [
    path("", include(core_urls)),
    path("menu/", include(menu_urls)),
    path("order/", include(order_urls)),
]

if settings.DEBUG or "runserver" in sys.argv:
    # Keep local runserver usable even when the deployment .env keeps DEBUG=False.
    if settings.DEBUG:
        urlpatterns += static(settings.STATIC_URL, document_root=settings.FRONTEND_DIR / "static")
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    else:
        urlpatterns += [
            re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.FRONTEND_DIR / "static"}),
            re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
        ]
