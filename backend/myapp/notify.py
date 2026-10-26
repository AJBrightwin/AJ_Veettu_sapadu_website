"""Alerts for new contact messages.

Both channels are switched off until you fill in the details — the website works the same either way:

* Email    → set ``alert_email`` in ajvs_site_settings AND the EMAIL_* lines in .env
* WhatsApp → set ``whatsapp_alert_url`` (your bot's webhook) in ajvs_site_settings
             (optional ``whatsapp_alert_token`` is sent as "Authorization: Bearer <token>")

Alerts are sent in the background so the visitor never waits, and any failure is only logged.
"""
import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.core.mail import send_mail

log = logging.getLogger("myapp")


def _text(msg):
    lines = [
        "New message on AJ வீட்டு சாப்பாடு website",
        f"Reason: {msg.get_reason_display()}",
        f"Name: {msg.name}",
        f"Phone: {msg.phone}",
    ]
    if msg.email:
        lines.append(f"Email: {msg.email}")
    lines += ["", msg.message]
    return "\n".join(lines)


def _send_email(site, msg):
    if not (site.alert_email and getattr(settings, "EMAIL_HOST", "")):
        return
    try:
        send_mail(
            subject=f"[AJVS] {msg.get_reason_display()} — {msg.name}",
            message=_text(msg),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[site.alert_email],
            fail_silently=False,
        )
    except Exception:  # never break the website because of an alert
        log.exception("Contact alert email failed")


def _send_whatsapp(site, msg):
    if not site.whatsapp_alert_url:
        return
    payload = {
        "type": "contact_message",
        "id": msg.id,
        "reason": msg.reason,
        "reason_label": msg.get_reason_display(),
        "name": msg.name,
        "phone": msg.phone,
        "email": msg.email,
        "message": msg.message,
        "text": _text(msg),
        "created_at": msg.created_at.isoformat() if msg.created_at else "",
    }
    headers = {"Content-Type": "application/json"}
    if site.whatsapp_alert_token:
        headers["Authorization"] = f"Bearer {site.whatsapp_alert_token}"
    try:
        req = urllib.request.Request(site.whatsapp_alert_url, data=json.dumps(payload).encode("utf-8"),
                                     headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=6) as resp:
            resp.read()
    except Exception:
        log.exception("Contact alert to WhatsApp webhook failed")


def _run(site, msg):
    _send_email(site, msg)
    _send_whatsapp(site, msg)


def contact_alert(site, msg):
    """Send the alerts for one ContactMessage (in a background thread unless NOTIFY_ASYNC is False)."""
    if not (site.whatsapp_alert_url or (site.alert_email and getattr(settings, "EMAIL_HOST", ""))):
        return
    if getattr(settings, "NOTIFY_ASYNC", True):
        threading.Thread(target=_run, args=(site, msg), daemon=True).start()
    else:
        _run(site, msg)
