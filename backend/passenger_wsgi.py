"""Entry point for cPanel / Hostinger "Setup Python App" (Phusion Passenger).

Not used on a VPS with Gunicorn. Safe to keep either way.
"""
import os
import sys

BACKEND = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "AJ_cloud.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
