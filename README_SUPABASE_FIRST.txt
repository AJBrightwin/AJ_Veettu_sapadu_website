START HERE FOR SUPABASE

1. Run supabase/schema.sql in Supabase SQL Editor. If already run successfully, do not rerun to update existing rows.
2. Configure backend/DATABASE_URL in your hosting environment using the Supabase PostgreSQL URI. See SUPABASE_SETUP.md.
3. Install backend/requirements.txt.
4. Run the Django migration commands in SUPABASE_SETUP.md to initialize Django auth/admin/session tables while preserving the pre-created ajvs_* tables.
5. Keep all database credentials server-side only. Do not commit backend/.env.

The website remains a Django server-rendered application. The server-side Django ORM is wired to PostgreSQL via DATABASE_URL; frontend forms continue posting to Django endpoints, so private order/contact writes are not exposed directly to browser clients. Images remain in backend/media unless you separately migrate them to Supabase Storage.
