"""Razorpay helpers. Keys come from .env (see .env.example)."""
import razorpay
from django.conf import settings


def configured():
    """True when real Razorpay keys are in .env (the 'xxxx' sample values don't count)."""
    k, sec = settings.RAZORPAY_KEY_ID or "", settings.RAZORPAY_KEY_SECRET or ""
    return k.startswith("rzp_") and "xxxx" not in k and len(sec) > 8 and "xxxx" not in sec


def demo_mode():
    """No Razorpay keys yet and running on your computer: the pay page offers a test 'payment'."""
    return settings.DEBUG and not configured()


def client():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_razorpay_order(order):
    """Create the matching order on Razorpay and return its id (order_xxx)."""
    rp = client().order.create(data={
        "amount": order.amount_paise,
        "currency": "INR",
        "receipt": order.order_number,
        "notes": {"order_number": order.order_number, "phone": order.phone},
    })
    return rp["id"]


def verify_checkout_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    try:
        client().utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def verify_webhook(body_text, signature):
    if not settings.RAZORPAY_WEBHOOK_SECRET or not signature:
        return False
    try:
        client().utility.verify_webhook_signature(body_text, signature, settings.RAZORPAY_WEBHOOK_SECRET)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
