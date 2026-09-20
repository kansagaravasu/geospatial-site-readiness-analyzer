"""
GeoSite AI — SMS OTP Service using Twilio Verify API
======================================================
Uses Twilio Verify (best for OTP) as primary, then falls back
to Fast2SMS / MSG91 / demo mode.

.env keys:
  TWILIO_ACCOUNT_SID    - Your Twilio Account SID
  TWILIO_AUTH_TOKEN     - Your Twilio Auth Token
  TWILIO_VERIFY_SID     - Verify Service SID (VA...)  <-- auto-created
  FAST2SMS_API_KEY      - Fast2SMS key (optional backup)
  MSG91_AUTH_KEY        - MSG91 key (optional backup)
"""

import os
import json
import urllib.request
import urllib.parse
import urllib.error
import base64
import sys


# ---------------------------------------------------------------------------
# .env loader
# ---------------------------------------------------------------------------
def _load_dotenv(path=None):
    if path is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(base, ".env")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val

_load_dotenv()


def _env(key, default=""):
    return os.environ.get(key, default).strip()


def _log(msg):
    try:
        buf = getattr(sys.stdout, "buffer", None)
        if buf:
            buf.write((msg + "\n").encode("utf-8", errors="replace"))
        else:
            print(msg)
    except Exception:
        pass


def _e164(phone):
    """Convert any phone input to E.164 format (+countrycode...)."""
    p = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not p.startswith("+"):
        p = "+" + p
    return p


def _twilio_auth():
    sid   = _env("TWILIO_ACCOUNT_SID")
    token = _env("TWILIO_AUTH_TOKEN")
    cred  = base64.b64encode(f"{sid}:{token}".encode()).decode()
    return sid, token, cred


# ===========================================================================
# PROVIDER 1 — Twilio Verify API  (best for OTP, works on trial accounts)
# ===========================================================================
def _send_via_twilio_verify(to_phone):
    """
    Sends OTP using Twilio Verify service.
    Twilio generates the code internally — we do NOT need to pass our own otp_code.
    Verification happens separately via verify_twilio_otp().
    """
    sid, token, cred = _twilio_auth()
    verify_sid = _env("TWILIO_VERIFY_SID")

    if not (sid and token and verify_sid):
        return {"success": False, "error": "Twilio Verify credentials not configured"}

    to = _e164(to_phone)
    url = f"https://verify.twilio.com/v2/Services/{verify_sid}/Verifications"
    body = urllib.parse.urlencode({
        "To":      to,
        "Channel": "sms"
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Basic {cred}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            status = data.get("status", "")
            if status in ("pending", "approved"):
                return {
                    "success":  True,
                    "provider": "twilio_verify",
                    "to":       to,
                    "status":   status,
                    "message":  f"OTP dispatched to {to} via Twilio Verify"
                }
            return {"success": False, "error": f"Twilio Verify unexpected status: {status}"}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        try:
            err_json = json.loads(err_body)
            err_msg  = err_json.get("message", err_body)
            err_code = err_json.get("code", "")
            full_err = f"HTTP {e.code} code={err_code}: {err_msg}"
        except Exception:
            full_err = f"HTTP {e.code}: {err_body[:300]}"
        return {"success": False, "error": f"Twilio Verify: {full_err}"}
    except Exception as ex:
        return {"success": False, "error": f"Twilio Verify error: {str(ex)}"}


def verify_twilio_otp(to_phone, code):
    """
    Checks the OTP code the user typed against Twilio Verify.
    Returns True if approved, False otherwise.
    """
    sid, token, cred = _twilio_auth()
    verify_sid = _env("TWILIO_VERIFY_SID")
    if not (sid and token and verify_sid):
        return None  # Not configured — skip (let auth_db verify from local DB)

    to = _e164(to_phone)
    url = f"https://verify.twilio.com/v2/Services/{verify_sid}/VerificationCheck"
    body = urllib.parse.urlencode({
        "To":   to,
        "Code": code.strip()
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Basic {cred}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "approved"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        _log(f"[SMS] Twilio VerificationCheck error {e.code}: {err_body[:200]}")
        return False
    except Exception as ex:
        _log(f"[SMS] Twilio VerificationCheck exception: {ex}")
        return False


# ===========================================================================
# PROVIDER 2 — Fast2SMS (India — free tier)
# ===========================================================================
def _send_via_fast2sms(to_phone, otp_code):
    api_key = _env("FAST2SMS_API_KEY")
    if not api_key:
        return {"success": False, "error": "Fast2SMS key not configured"}
    digits = "".join(filter(str.isdigit, to_phone))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10:
        return {"success": False, "error": f"Fast2SMS needs 10-digit Indian number, got: '{digits}'"}
    sender_id = _env("FAST2SMS_SENDER_ID", "FSTSMS")
    params = urllib.parse.urlencode({
        "authorization": api_key,
        "sender_id":     sender_id,
        "message":       f"Your GeoSite AI OTP is {otp_code}. Valid 10 min. Do not share.",
        "language":      "english",
        "route":         "q",
        "numbers":       digits,
    })
    req = urllib.request.Request(f"https://www.fast2sms.com/dev/bulkV2?{params}", method="GET")
    req.add_header("cache-control", "no-cache")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if result.get("return"):
                return {"success": True, "provider": "fast2sms",
                        "message": f"Sent via Fast2SMS to {digits}"}
            return {"success": False, "error": f"Fast2SMS: {result.get('message', result)}"}
    except Exception as ex:
        return {"success": False, "error": f"Fast2SMS error: {str(ex)}"}


# ===========================================================================
# MAIN DISPATCHER
# ===========================================================================
def send_otp_sms(phone, otp_code):
    """
    Sends OTP SMS. Priority: Twilio Verify -> Fast2SMS -> Demo.
    Returns:
        success    bool
        provider   str   'twilio_verify' | 'fast2sms' | 'demo'
        sent_real  bool  True = OTP delivered to real phone
        demo_otp   str | None  — only set in demo mode
        twilio_verify bool — True if Twilio Verify handled delivery+check
        message    str
    """
    errors = []

    # --- Twilio Verify (best option) ---
    if _env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN") and _env("TWILIO_VERIFY_SID"):
        r = _send_via_twilio_verify(phone)
        if r["success"]:
            _log(f"[SMS] Twilio Verify OTP sent to {phone}")
            return {
                **r,
                "sent_real":     True,
                "twilio_verify": True,
                "demo_otp":      None,
            }
        errors.append(f"TwilioVerify: {r.get('error')}")
        _log(f"[SMS] Twilio Verify failed: {r.get('error')}")

    # --- Fast2SMS ---
    if _env("FAST2SMS_API_KEY"):
        r = _send_via_fast2sms(phone, otp_code)
        if r["success"]:
            _log(f"[SMS] Fast2SMS sent to {phone}")
            return {**r, "sent_real": True, "twilio_verify": False, "demo_otp": None}
        errors.append(f"Fast2SMS: {r.get('error')}")
        _log(f"[SMS] Fast2SMS failed: {r.get('error')}")

    # --- Demo fallback ---
    _log(f"[SMS] DEMO MODE - OTP for {phone}: {otp_code}")
    if errors:
        _log(f"[SMS] Provider errors: {' | '.join(errors)}")
    return {
        "success":       True,
        "provider":      "demo",
        "sent_real":     False,
        "twilio_verify": False,
        "demo_otp":      otp_code,
        "message":       "Demo mode: OTP shown on screen. Configure .env for real SMS.",
    }
