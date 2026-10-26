#!/usr/bin/env bash
# Run on the server after uploading new code:   bash /var/www/ajvs/deploy/update.sh
set -e
cd /var/www/ajvs/backend
source /var/www/ajvs/venv/bin/activate
pip install -q -r requirements-server.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo chown -R www-data:www-data /var/www/ajvs/backend/media /var/www/ajvs/backend/staticfiles
sudo systemctl restart ajvs
echo "Updated and restarted."
