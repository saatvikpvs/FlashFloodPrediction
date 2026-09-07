"""
Service to dispatch emergency SMS alerts via Fast2SMS Quick SMS route (route=q).

Fast2SMS Quick route requires no DLT registration, which makes it ideal for
immediate demo/hackathon usage with 10-digit Indian phone numbers.
"""

import logging
from typing import Any
import requests

from app.config import get_fast2sms_api_key

logger = logging.getLogger("fast2sms")
FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


def send_sms_alert(
    village_name: str,
    risk_score: float,
    risk_level: str,
    phone_numbers: list[str],
) -> dict[str, Any]:
    """
    Sends emergency SMS via Fast2SMS Quick route to the given phone numbers.
    If FAST2SMS_API_KEY is unset or set to 'mock', operates in Demo Mock Mode
    to preserve wallet credits while validating full UI & backend flows.
    """
    if not phone_numbers:
        return {
            "success": False,
            "mock": False,
            "message": "No recipient phone numbers provided.",
            "recipients": [],
            "fast2sms_request_id": None,
        }

    api_key = get_fast2sms_api_key()

    # Short, clear emergency alert text
    alert_message = (
        f"EMERGENCY ALERT: {village_name} flash flood risk has reached {risk_level.upper()} "
        f"(Score: {risk_score:.0f}/100). High inundation probability. Evacuate to higher ground immediately!"
    )

    clean_numbers = [str(num).strip() for num in phone_numbers if str(num).strip()]
    numbers_param = ",".join(clean_numbers)

    # Demo Mock Mode check
    if not api_key or api_key.lower().strip() in ("mock", "test", "demo", "placeholder"):
        print(f"[FAST2SMS MOCK MODE] Dispatched SMS to {numbers_param}: {alert_message}")
        logger.info(
            "[FAST2SMS MOCK MODE] Dispatched SMS to %s: %s",
            numbers_param,
            alert_message,
        )
        return {
            "success": True,
            "mock": True,
            "message": f"Demo Mock Mode: SMS alert logged for {len(clean_numbers)} recipients (no API key configured).",
            "recipients": clean_numbers,
            "fast2sms_request_id": "MOCK-DEMO-FAST2SMS-001",
        }

    # Live Fast2SMS Call
    # Fast2SMS requires the authorization key in the HTTP headers:
    headers = {
        "authorization": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
    }
    payload = {
        "route": "q",
        "message": alert_message,
        "language": "english",
        "numbers": numbers_param,
    }

    print(f"[FAST2SMS] Sending real SMS to {numbers_param} via {FAST2SMS_URL}...")

    try:
        # 1. Try POST with authorization header (Fast2SMS recommended)
        response = requests.post(FAST2SMS_URL, data=payload, headers=headers, timeout=12)
        print(f"[FAST2SMS POST] HTTP {response.status_code}: {response.text}")

        data = None
        try:
            data = response.json()
        except Exception:
            pass

        # 2. If POST didn't succeed or returned an error, attempt GET fallback with query params & header
        if not data or not data.get("return"):
            print("[FAST2SMS] Attempting GET fallback...")
            get_params = {
                "route": "q",
                "message": alert_message,
                "language": "english",
                "numbers": numbers_param,
            }
            get_resp = requests.get(FAST2SMS_URL, params=get_params, headers={"authorization": api_key}, timeout=12)
            print(f"[FAST2SMS GET] HTTP {get_resp.status_code}: {get_resp.text}")
            try:
                data = get_resp.json()
            except Exception:
                pass

        if data:
            is_success = bool(data.get("return", False))
            req_id = data.get("request_id")
            msg_list = data.get("message", [])
            msg_str = " ".join(msg_list) if isinstance(msg_list, list) else str(msg_list)

            if is_success:
                return {
                    "success": True,
                    "mock": False,
                    "message": msg_str or "SMS sent successfully.",
                    "recipients": clean_numbers,
                    "fast2sms_request_id": req_id,
                }
            else:
                return {
                    "success": False,
                    "mock": False,
                    "message": msg_str or f"Fast2SMS error code {data.get('status_code')}",
                    "recipients": clean_numbers,
                    "fast2sms_request_id": req_id,
                }
        else:
            return {
                "success": False,
                "mock": False,
                "message": f"Fast2SMS returned HTTP {response.status_code}: {response.text}",
                "recipients": clean_numbers,
                "fast2sms_request_id": None,
            }

    except requests.RequestException as e:
        print(f"[FAST2SMS ERROR] Network exception: {e}")
        logger.error("Failed to reach Fast2SMS: %s", e)
        return {
            "success": False,
            "mock": False,
            "message": f"Network error contacting Fast2SMS: {str(e)}",
            "recipients": clean_numbers,
            "fast2sms_request_id": None,
        }
