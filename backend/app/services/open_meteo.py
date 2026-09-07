"""
Thin client around Open-Meteo's free, keyless APIs:
  - Forecast API   (live + short-term forecast rainfall & soil moisture)
  - Flood API      (GloFAS river discharge)
  - Historical/Archive API (ERA5-Land reanalysis, used for /replay)

No API key is required for any of these for non-commercial use. A small
in-memory TTL cache keeps a room full of dashboards polling this app
from hammering Open-Meteo (and from being slow) during a demo.
"""

import time
from datetime import datetime, timedelta, timezone

import requests

from app.config import (
    OPEN_METEO_ARCHIVE_URL,
    OPEN_METEO_FLOOD_URL,
    OPEN_METEO_FORECAST_URL,
)

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 120
_TIMEOUT_SECONDS = 8


def _cached_get(url: str, params: dict, cache_key: str) -> dict | None:
    now = time.time()
    hit = _CACHE.get(cache_key)
    if hit and now - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    try:
        resp = requests.get(url, params=params, timeout=_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError):
        return hit[1] if hit else None
    _CACHE[cache_key] = (now, data)
    return data


def fetch_live_conditions(lat: float, lon: float) -> dict:
    """
    Returns recent-past + forecast hourly precipitation and soil
    moisture for one point, plus rolled-up 24h/72h rainfall totals
    computed from the "past_days" actuals.
    """
    # timezone=UTC (not "auto") so the now_idx comparison below stays
    # correct regardless of the village's local offset; the frontend
    # converts to IST for display.
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,soil_moisture_0_to_7cm",
        "past_days": 3,
        "forecast_days": 3,
        "timezone": "UTC",
    }
    data = _cached_get(OPEN_METEO_FORECAST_URL, params, f"live:{lat}:{lon}")
    if not data or "hourly" not in data:
        return {
            "rain_24h_mm": 0.0,
            "rain_72h_mm": 0.0,
            "soil_moisture_m3m3": 0.0,
            "hourly_times": [],
            "hourly_precip": [],
            "available": False,
        }

    hourly = data["hourly"]
    times = hourly.get("time", [])
    precip = hourly.get("precipitation", [])
    soil = hourly.get("soil_moisture_0_to_7cm", [])

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    now_idx = 0
    for i, t in enumerate(times):
        if datetime.fromisoformat(t) <= now:
            now_idx = i
        else:
            break

    def sum_last_hours(hours: int) -> float:
        start = max(0, now_idx - hours + 1)
        window = [v for v in precip[start : now_idx + 1] if v is not None]
        return round(sum(window), 1)

    latest_soil = next(
        (v for v in reversed(soil[: now_idx + 1]) if v is not None), 0.0
    )

    return {
        "rain_24h_mm": sum_last_hours(24),
        "rain_72h_mm": sum_last_hours(72),
        "soil_moisture_m3m3": latest_soil,
        "hourly_times": times[now_idx:],
        "hourly_precip": precip[now_idx:],
        "all_times": times,
        "all_precip": precip,
        "all_soil": soil,
        "now_index": now_idx,
        "available": True,
    }


def fetch_flood(lat: float, lon: float) -> dict:
    """
    River discharge (m^3/s) from GloFAS via Open-Meteo's Flood API.
    Treated as a bonus signal: if the API has no cell nearby or is
    unreachable, callers should fall back to a neutral score rather
    than fail the whole risk calculation.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge,river_discharge_median",
        "past_days": 1,
        "forecast_days": 3,
    }
    data = _cached_get(OPEN_METEO_FLOOD_URL, params, f"flood:{lat}:{lon}")
    if not data or "daily" not in data:
        return {"current_m3s": None, "median_m3s": None, "available": False}

    daily = data["daily"]
    discharge = daily.get("river_discharge", [])
    median = daily.get("river_discharge_median", [])
    current = next((v for v in discharge if v is not None), None)
    med = next((v for v in median if v is not None), None)
    return {"current_m3s": current, "median_m3s": med, "available": current is not None}


def fetch_historical(lat: float, lon: float, start_date: str, end_date: str) -> dict:
    """
    Hourly precipitation + soil moisture for a past date range
    (YYYY-MM-DD), used to replay a documented disaster.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "precipitation,soil_moisture_0_to_7cm",
        "timezone": "auto",
    }
    data = _cached_get(
        OPEN_METEO_ARCHIVE_URL, params, f"hist:{lat}:{lon}:{start_date}:{end_date}"
    )
    if not data or "hourly" not in data:
        return {"times": [], "precip": [], "soil": [], "available": False}

    hourly = data["hourly"]
    return {
        "times": hourly.get("time", []),
        "precip": hourly.get("precipitation", []),
        "soil": hourly.get("soil_moisture_0_to_7cm", []),
        "available": True,
    }
