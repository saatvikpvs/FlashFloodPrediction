"""
Constants for the risk engine. Thresholds are based on IMD's standard
24-hour rainfall intensity classification, which is the same standard
India's own weather service uses to call rain "heavy" / "very heavy" /
"extremely heavy". Soil moisture and slope bands are heuristic
(no local soil survey data available in a hackathon timeframe) but are
kept explicit here so they're easy to defend or recalibrate.
"""

import os
from pathlib import Path

# Attempt to load .env from backend directory if present
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        # Simple fallback .env parser
        with open(_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"

# IMD 24-hour rainfall classification (mm) expressed as (mm, score)
# breakpoints for piecewise-linear interpolation, so the score climbs
# smoothly instead of jumping between bands:
#   0mm->0, light<=15.5mm->20, moderate<=64.4mm->40, heavy<=115.5mm->65,
#   very heavy<=204.4mm->85, extremely heavy (>=300mm)->100
RAIN_SCORE_BREAKPOINTS_MM = [
    (0.0, 0),
    (15.5, 20),
    (64.4, 40),
    (115.5, 65),
    (204.4, 85),
    (300.0, 100),
]

# Volumetric soil moisture (m^3/m^3) from Open-Meteo/ERA5-Land. Loamy
# and clay soils in the Western Ghats saturate around 0.40-0.50 m^3/m^3;
# we treat 0.45 as "fully saturated" -> score 100.
SOIL_MOISTURE_SATURATION_M3M3 = 0.45

# Composite risk weights. Rainfall dominates because it's the most
# direct trigger and the most reliable live signal; slope and history
# are static "predisposition" factors, not moment-to-moment triggers.
RISK_WEIGHTS = {
    "rainfall": 0.35,
    "soil_moisture": 0.20,
    "slope": 0.20,
    "historical": 0.15,
    "river_discharge": 0.10,
}

RISK_LEVEL_BANDS = [
    (25, "Low"),
    (50, "Moderate"),
    (75, "High"),
    (100.01, "Severe"),
]

RISK_LEVEL_COLORS = {
    "Low": "#2e7d32",
    "Moderate": "#f9a825",
    "High": "#ef6c00",
    "Severe": "#c62828",
}

# Fast2SMS Configuration (Quick SMS route - no DLT registration needed)
def get_fast2sms_api_key() -> str:
    key = os.getenv("FAST2SMS_API_KEY", "")
    if not key or key == "your_fast2sms_api_key_here":
        _env_path = Path(__file__).resolve().parent.parent / ".env"
        if _env_path.exists():
            with open(_env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("FAST2SMS_API_KEY="):
                        found = line.split("=", 1)[1].strip().strip("'\"")
                        if found and found != "your_fast2sms_api_key_here":
                            os.environ["FAST2SMS_API_KEY"] = found
                            return found
    return key

FAST2SMS_API_KEY = get_fast2sms_api_key()



def sanitize_phone(num: str) -> str:
    """Normalize phone number to 10-digit Indian mobile format for Fast2SMS."""
    digits = "".join(ch for ch in str(num) if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) > 10 and digits.startswith("0"):
        digits = digits[1:]
    return digits[-10:] if len(digits) >= 10 else digits


def _get_phones(env_var: str, default: list[str]) -> list[str]:
    # First check live from .env file so changes take effect immediately without restarting
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        try:
            with open(_env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith(f"{env_var}="):
                        val = line.split("=", 1)[1].strip().strip("'\"")
                        parsed = [p.strip() for p in val.split(",") if p.strip()]
                        cleaned = [sanitize_phone(p) for p in parsed if sanitize_phone(p)]
                        if cleaned:
                            return cleaned
        except Exception:
            pass

    val = os.getenv(env_var, "")
    if val:
        parsed = [p.strip() for p in val.split(",") if p.strip()]
        cleaned = [sanitize_phone(p) for p in parsed if sanitize_phone(p)]
        if cleaned:
            return cleaned
    return [sanitize_phone(p) for p in default]


class _AlertContactsRegistry(dict):
    """
    Dynamic registry that reads village phone numbers from backend/.env on demand.
    Supports ALERT_PHONES_CHOORALMALA, ALERT_PHONES_MUNDAKKAI, or any ALERT_PHONES_<VILLAGE_ID>.

    No hardcoded phone numbers here on purpose -- this file is committed to
    git, and real numbers don't belong in source/history. Configure each
    village's contacts in backend/.env (gitignored); a village with no
    ALERT_PHONES_<ID> set simply has no alert contacts, rather than
    silently falling back to numbers baked into the code.
    """
    def get(self, village_id: str, default=None):
        env_var = f"ALERT_PHONES_{village_id.upper()}"
        # Hardcoded defaults if not specified in .env
        default_contacts = []
        if village_id == "chooralmala":
            default_contacts = ["6303965339", "9581843589","8247892167","6304665995","9885275333","9121074387"]
        contacts = _get_phones(env_var, default_contacts)
        
        if contacts:
            return contacts
        return default if default is not None else []

    def __getitem__(self, village_id: str):
        contacts = self.get(village_id)
        if not contacts:
            raise KeyError(village_id)
        return contacts

    def __contains__(self, village_id: object):
        if not isinstance(village_id, str):
            return False
        return len(self.get(village_id)) > 0


# Global dynamic alert contacts registry
ALERT_CONTACTS = _AlertContactsRegistry()