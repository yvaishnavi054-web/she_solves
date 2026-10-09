import os
import re
import uuid
import datetime
from typing import Dict, Any, Optional, List
import requests
from dotenv import load_dotenv

load_dotenv()

# WhatsApp Business API Credentials (Meta Cloud API)
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN") or os.getenv("WHATSAPP_ACCESS_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v18.0")

# In-memory deduplication cache: hash or receipt_id -> timestamp
SENT_MESSAGES_CACHE: Dict[str, str] = {}

def format_whatsapp_message(
    msg_type: str,
    customer_name: str,
    amount: float,
    previous_balance: float,
    new_balance: float,
    payment_method: Optional[str] = None,
    payment_status: Optional[str] = None,
    receipt_id: Optional[str] = None,
    shop_name: str = "Khata Se Credit Tak Store",
    language: str = "mr"
) -> str:
    """
    Constructs compliant, professional WhatsApp message text
    for New Udhar or Payment Receipt in Marathi, Hindi, or English.
    """
    amt_str = f"₹{int(amount) if amount == int(amount) else f'{amount:.2f}'}"
    prev_str = f"₹{int(previous_balance) if previous_balance == int(previous_balance) else f'{previous_balance:.2f}'}"
    new_str = f"₹{int(new_balance) if new_balance == int(new_balance) else f'{new_balance:.2f}'}"
    rec_id = receipt_id or f"REC-{uuid.uuid4().hex[:6].upper()}"
    date_str = datetime.date.today().strftime("%d/%m/%Y")

    if msg_type == "new_udhar":
        if language == "mr":
            return (
                f"🧾 *नवीन उधारी पावती — {shop_name}*\n\n"
                f"नमस्कार *{customer_name}* जी,\n"
                f"आपल्या खात्यावर आज नवीन उधारी नोंदवली गेली आहे:\n\n"
                f"🔹 *नवीन उधारी रक्कम:* {amt_str}\n"
                f"🔹 *मागील बाकी:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *एकूण प्रलंबित बाकी:* *{new_str}*\n\n"
                f"📅 तारीख: {date_str} | नोंद क्र.: {rec_id}\n\n"
                f"_काही शंका असल्यास कृपया संपर्क साधावा. धन्यवाद!_"
            )
        elif language == "hi":
            return (
                f"🧾 *नया उधार विवरण — {shop_name}*\n\n"
                f"नमस्ते *{customer_name}* जी,\n"
                f"आपके खाते में आज नया उधार दर्ज किया गया है:\n\n"
                f"🔹 *नया उधार राशि:* {amt_str}\n"
                f"🔹 *पिछला बकाया:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *कुल बकाया राशि:* *{new_str}*\n\n"
                f"📅 दिनांक: {date_str} | रसीद क्र.: {rec_id}\n\n"
                f"_किसी भी प्रश्न हेतु दुकान पर संपर्क करें। धन्यवाद!_"
            )
        else:
            return (
                f"🧾 *Credit Notice — {shop_name}*\n\n"
                f"Hello *{customer_name}*,\n"
                f"A new credit entry has been recorded on your ledger account:\n\n"
                f"🔹 *New Credit Added:* {amt_str}\n"
                f"🔹 *Previous Balance:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *Updated Total Pending:* *{new_str}*\n\n"
                f"📅 Date: {date_str} | Entry ID: {rec_id}\n\n"
                f"_Please feel free to reach out if you have any questions. Thank you!_"
            )

    else:  # payment_receipt
        method_label = "रोख (Cash Received — Shopkeeper Confirmed)" if payment_method == "cash" else "UPI (Verified)"
        if payment_status == "unverified_upi":
            method_label = "UPI (प्रलंबित / Pending Provider Confirmation)"

        if language == "mr":
            return (
                f"✅ *पेमेंट पावती (Payment Receipt) — {shop_name}*\n\n"
                f"नमस्कार *{customer_name}* जी,\n"
                f"आपले पेमेंट यशस्वीरीत्या प्राप्त झाले आहे:\n\n"
                f"🔹 *जमा केलेली रक्कम:* *{amt_str}*\n"
                f"🔹 *पेमेंट पद्धत:* {method_label}\n"
                f"🔹 *मागील बाकी:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *उर्वरित बाकी:* *{new_str}*\n\n"
                f"📅 तारीख: {date_str} | पावती क्र.: {rec_id}\n\n"
                f"_वेळेवर पेमेंट केल्याबद्दल मनःपूर्वक धन्यवाद!_"
            )
        elif language == "hi":
            return (
                f"✅ *भुगतान रसीद (Payment Receipt) — {shop_name}*\n\n"
                f"नमस्ते *{customer_name}* जी,\n"
                f"आपका भुगतान सफलतापूर्वक प्राप्त हो गया है:\n\n"
                f"🔹 *जमा की गई राशि:* *{amt_str}*\n"
                f"🔹 *भुगतान माध्यम:* {method_label}\n"
                f"🔹 *पिछला बकाया:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *शेष बकाया राशि:* *{new_str}*\n\n"
                f"📅 दिनांक: {date_str} | रसीद क्र.: {rec_id}\n\n"
                f"_समय पर भुगतान करने के लिए बहुत-बहुत धन्यवाद!_"
            )
        else:
            return (
                f"✅ *Payment Receipt — {shop_name}*\n\n"
                f"Hello *{customer_name}*,\n"
                f"Your payment has been successfully recorded:\n\n"
                f"🔹 *Amount Paid:* *{amt_str}*\n"
                f"🔹 *Payment Mode:* {method_label}\n"
                f"🔹 *Previous Balance:* {prev_str}\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"🔸 *Remaining Pending Balance:* *{new_str}*\n\n"
                f"📅 Date: {date_str} | Receipt ID: {rec_id}\n\n"
                f"_Thank you for your prompt payment!_"
            )


def send_whatsapp_message(
    phone: str,
    msg_type: str,
    customer_name: str,
    amount: float,
    previous_balance: float,
    new_balance: float,
    payment_method: Optional[str] = "cash",
    payment_status: Optional[str] = "verified",
    receipt_id: Optional[str] = None,
    shop_name: str = "Khata Se Credit Tak Store",
    language: str = "mr"
) -> Dict[str, Any]:
    """
    Sends WhatsApp message via WhatsApp Business API if credentials exist,
    or returns a transparent demo mode response with simulated delivery status
    and direct wa.me fallback link. Prevents duplicate messages.
    """
    # Clean phone number
    clean_phone = re.sub(r'\D', '', str(phone or ''))
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"

    # Dedup check
    rec_id = receipt_id or f"TXN-{uuid.uuid4().hex[:8].upper()}"
    dedup_key = f"{clean_phone}_{msg_type}_{rec_id}_{amount}"
    if dedup_key in SENT_MESSAGES_CACHE:
        return {
            "status": "already_sent",
            "delivery_status": "Duplicate Prevented (Already Sent)",
            "message_id": SENT_MESSAGES_CACHE[dedup_key],
            "receipt_id": rec_id,
            "provider_configured": bool(WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID)
        }

    message_body = format_whatsapp_message(
        msg_type=msg_type,
        customer_name=customer_name,
        amount=amount,
        previous_balance=previous_balance,
        new_balance=new_balance,
        payment_method=payment_method,
        payment_status=payment_status,
        receipt_id=rec_id,
        shop_name=shop_name,
        language=language
    )

    encoded_text = requests.utils.quote(message_body)
    wa_fallback_link = f"https://wa.me/{clean_phone}?text={encoded_text}" if clean_phone else f"https://api.whatsapp.com/send?text={encoded_text}"

    # Check if Meta WhatsApp Business Cloud API is configured
    if WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID and clean_phone:
        try:
            url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
            headers = {
                "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
                "Content-Type": "application/json"
            }
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_phone,
                "type": "text",
                "text": {"body": message_body}
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            if resp.status_code in [200, 201]:
                res_data = resp.json()
                msg_id = res_data.get("messages", [{}])[0].get("id", f"wam_{uuid.uuid4().hex[:8]}")
                SENT_MESSAGES_CACHE[dedup_key] = msg_id
                return {
                    "status": "delivered",
                    "delivery_status": "Delivered (WhatsApp Business Cloud API)",
                    "message_id": msg_id,
                    "receipt_id": rec_id,
                    "recipient": clean_phone,
                    "customer_name": customer_name,
                    "amount": amount,
                    "previous_balance": previous_balance,
                    "new_balance": new_balance,
                    "notification_type": msg_type,
                    "message_preview": message_body,
                    "provider_configured": True,
                    "wa_link": wa_fallback_link
                }
            else:
                # Log provider error and fallback to simulated/manual link
                err_text = resp.text
                return {
                    "status": "provider_error",
                    "delivery_status": f"API Rejected ({resp.status_code}) — Fallback Available",
                    "error_detail": err_text,
                    "receipt_id": rec_id,
                    "recipient": clean_phone,
                    "customer_name": customer_name,
                    "amount": amount,
                    "previous_balance": previous_balance,
                    "new_balance": new_balance,
                    "notification_type": msg_type,
                    "message_preview": message_body,
                    "provider_configured": True,
                    "wa_link": wa_fallback_link
                }
        except Exception as e:
            return {
                "status": "network_error",
                "delivery_status": "Network Timeout — Fallback Available",
                "error_detail": str(e),
                "receipt_id": rec_id,
                "recipient": clean_phone,
                "customer_name": customer_name,
                "amount": amount,
                "previous_balance": previous_balance,
                "new_balance": new_balance,
                "notification_type": msg_type,
                "message_preview": message_body,
                "provider_configured": True,
                "wa_link": wa_fallback_link
            }

    # Demo Mode Simulation (When API credentials are not yet entered)
    simulated_id = f"demo_wa_{uuid.uuid4().hex[:10]}"
    SENT_MESSAGES_CACHE[dedup_key] = simulated_id

    return {
        "status": "demo_simulated",
        "delivery_status": "Demo Mode: Message Generated & Queued",
        "badge": "⚡ DEMO MODE",
        "message_id": simulated_id,
        "receipt_id": rec_id,
        "recipient": clean_phone or "Customer Phone",
        "customer_name": customer_name,
        "amount": amount,
        "previous_balance": previous_balance,
        "new_balance": new_balance,
        "notification_type": msg_type,
        "message_preview": message_body,
        "provider_configured": False,
        "config_required": {
            "WHATSAPP_API_TOKEN": "Missing in backend environment",
            "WHATSAPP_PHONE_NUMBER_ID": "Missing in backend environment"
        },
        "instructions": "To enable direct background delivery, configure WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env.",
        "wa_link": wa_fallback_link
    }

