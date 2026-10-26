"""Django settings for AJ_cloud (AJ Veettu Saapadu website).

Folder layout:
    AJ_Veettu_sapadu_website/
        backend/    <- this Django project (Python code, database, uploaded photos)
        frontend/   <- templates/ (HTML pages) and static/ (CSS, JS, images)

Works out of the box on your computer with SQLite.
On the server, create a .env file (copy .env.example) to switch to MySQL and add Razorpay keys.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent            # .../backend
load_dotenv(BASE_DIR / ".env")

# HTML pages, CSS, JS and images live in the separate "frontend" folder next to "backend".
FRONTEND_DIR = Path(os.environ.get("FRONTEND_DIR", BASE_DIR.parent / "frontend"))


def env_list(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-in-env")
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
]
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "myapp",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "AJ_cloud.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIR / "templates", FRONTEND_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "myapp.context_processors.site",
            ],
        },
    },
]

WSGI_APPLICATION = "AJ_cloud.wsgi.application"

# Database selection:
# 1) DATABASE_URL set to Supabase's PostgreSQL connection string -> Supabase Postgres
# 2) DB_ENGINE=mysql -> legacy MySQL deployment
# 3) otherwise -> local SQLite development
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=60,
        ssl_require=True,
    )}
elif os.environ.get("DB_ENGINE", "sqlite") == "mysql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.environ.get("DB_NAME", "ajvs_db"),
            "USER": os.environ.get("DB_USER", "ajvs_user"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "3306"),
            "OPTIONS": {"charset": "utf8mb4", "init_command": "SET sql_mode='STRICT_TRANS_TABLES'"},
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [FRONTEND_DIR / "static"]          # the frontend's CSS / JS / images
STATIC_ROOT = BASE_DIR / "staticfiles"                # collectstatic copies everything here for Nginx

# Dish photos. Point your admin panel's MEDIA_ROOT to this same folder.
MEDIA_URL = "/media/"
# Prefer the configured deployment path only when it exists on this machine.
# The .env file may contain a cPanel Linux path, which does not exist on Windows.
_configured_media_root = os.environ.get("MEDIA_ROOT", "").strip()
if _configured_media_root and Path(_configured_media_root).exists():
    MEDIA_ROOT = Path(_configured_media_root)
else:
    MEDIA_ROOT = BASE_DIR / "media"

SESSION_COOKIE_AGE = 60 * 60 * 24 * 30

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

# --- Email (only needed for contact-message alerts; leave EMAIL_HOST empty to switch email off) ---
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@localhost")
EMAIL_TIMEOUT = 10
NOTIFY_ASYNC = True   # contact alerts are sent in the background

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"myapp": {"handlers": ["console"], "level": "INFO"}},
}
