# AJ Veettu Saapadu — Supabase database setup

The Django backend is the trusted server and connects directly to Supabase PostgreSQL. Menu, categories, delivery areas, site settings, contact messages, subscribers, coupons, orders, order items and policy pages continue to use the Django ORM and are stored in the matching `ajvs_*` tables. The browser must never receive the database password or a Supabase `service_role` key.

## 1. Prepare Supabase
1. In Supabase, open **SQL Editor** and run `supabase/schema.sql` (the schema and seed rows supplied with this project).
2. If you already ran that SQL successfully, do not rerun it to try to repair existing data; it uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` and will not update existing rows.
3. Copy the PostgreSQL connection URI from **Project Settings → Database → Connection string**. Use the session pooler URI if your hosting provider cannot reach the direct database endpoint. URL-encode special characters in the database password.

## 2. Configure the backend
Install `backend/requirements.txt`, then set `DATABASE_URL` in your host's environment variables to that connection URI. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, and `DJANGO_CSRF_TRUSTED_ORIGINS`. Configure Razorpay and email variables only if those features are enabled. Never commit `.env` or expose database credentials in frontend JavaScript.

For local development, copy `backend/.env.example` to `backend/.env` and replace placeholders. If `DATABASE_URL` is absent, the project intentionally falls back to local SQLite.

## 3. Initialize Django's own tables safely
The supplied SQL already creates the app's final `ajvs_*` tables. Do **not** run ordinary app migrations against those tables: old migrations would attempt to create/alter tables that already exist. After confirming the Supabase tables are present and `DATABASE_URL` points to the correct project, run from `backend/`:

```bash
python manage.py migrate --fake myapp
python manage.py migrate
python manage.py check
```

The first command records the existing app schema as migrated without changing its tables; the second creates Django's built-in admin/auth/session tables. Back up your database before running setup commands. If `myapp` migration history already exists in this Supabase database, inspect `python manage.py showmigrations myapp` before using `--fake`.

## 4. Upload images separately
The SQL schema stores image paths, not image bytes. Keep the existing `backend/media/categories/` and `backend/media/dishes/` assets available to the deployed Django backend, or upload them to Supabase Storage and update the stored image paths/URL handling accordingly. This package keeps the existing Django media-file approach; database connectivity alone does not upload media to Supabase Storage.

## Important security note
The schema enables Row Level Security and intentionally defines public read-only policies for public menu content. Django's server-side PostgreSQL connection uses database credentials and does not depend on browser-side RLS policies. Never put the database URI or a service-role key in `frontend/` or client-side JavaScript. Use a least-privileged database role for production if possible.
