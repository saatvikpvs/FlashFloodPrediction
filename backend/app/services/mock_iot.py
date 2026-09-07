"""
Stand-in for real IoT soil-moisture / water-level sensors, which the
team has no access to in a hackathon. Two jobs:

1. `simulated_sensor_reading` fabricates a plausible live sensor
   reading (small jitter around the real Open-Meteo soil-moisture
   baseline) so the dashboard has an "IoT feed" panel that updates.
2. `trigger_storm_simulation` lets the dashboard inject a temporary
   rainfall/soil-moisture boost for one village, so a demo can show
   the risk score climbing in real time on command instead of waiting
   for real weather to cooperate.
"""

import random
import time

_STORM_PRESETS = {
    "moderate": {"extra_rain_mm": 40.0, "extra_soil": 0.05},
    "severe": {"extra_rain_mm": 120.0, "extra_soil": 0.12},
    "extreme": {"extra_rain_mm": 220.0, "extra_soil": 0.18},
}

_active_boosts: dict[str, dict] = {}


def trigger_storm_simulation(
    village_id: str, intensity: str = "severe", duration_minutes: int = 10
) -> dict:
    preset = _STORM_PRESETS.get(intensity, _STORM_PRESETS["severe"])
    _active_boosts[village_id] = {
        "until": time.time() + duration_minutes * 60,
        "intensity": intensity,
        **preset,
    }
    return {"village_id": village_id, "intensity": intensity, "duration_minutes": duration_minutes}


def clear_storm_simulation(village_id: str) -> None:
    _active_boosts.pop(village_id, None)


def get_active_boost(village_id: str) -> dict:
    boost = _active_boosts.get(village_id)
    if not boost:
        return {"extra_rain_mm": 0.0, "extra_soil": 0.0, "intensity": None}
    if time.time() > boost["until"]:
        _active_boosts.pop(village_id, None)
        return {"extra_rain_mm": 0.0, "extra_soil": 0.0, "intensity": None}
    return boost


def simulated_sensor_reading(village_id: str, baseline_soil_moisture: float) -> dict:
    boost = get_active_boost(village_id)
    jitter = random.uniform(-0.01, 0.01)
    soil = max(0.0, min(0.6, baseline_soil_moisture + boost["extra_soil"] + jitter))
    water_level_cm = round(20 + boost["extra_rain_mm"] * 0.3 + random.uniform(-2, 2), 1)
    return {
        "village_id": village_id,
        "soil_moisture_m3m3": round(soil, 3),
        "water_level_cm": water_level_cm,
        "sensor_status": "OK",
        "simulated_intensity": boost["intensity"],
        "timestamp": time.time(),
    }
