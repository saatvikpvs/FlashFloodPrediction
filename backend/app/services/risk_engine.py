"""
The actual prediction logic. Deliberately not machine learning: every
sub-score is a transparent function of one physical signal, so a judge
(or an NDRF analyst) can see exactly why a village is flagged. See
README.md for the full rationale and citations.
"""

from app.config import (
    ALERT_CONTACTS,
    RAIN_SCORE_BREAKPOINTS_MM,
    RISK_LEVEL_BANDS,
    RISK_WEIGHTS,
    SOIL_MOISTURE_SATURATION_M3M3,
)
from app.data.villages import VILLAGES_BY_ID
from app.services import mock_iot, open_meteo

IMD_THRESHOLDS_MM = [15.5, 64.4, 115.5, 204.4]


def _piecewise_interp(x: float, breakpoints: list[tuple[float, float]]) -> float:
    if x <= breakpoints[0][0]:
        return breakpoints[0][1]
    for (x0, y0), (x1, y1) in zip(breakpoints, breakpoints[1:]):
        if x <= x1:
            if x1 == x0:
                return y1
            frac = (x - x0) / (x1 - x0)
            return y0 + frac * (y1 - y0)
    return breakpoints[-1][1]


def rainfall_score(rain_24h_mm: float, rain_72h_mm: float) -> float:
    base = _piecewise_interp(max(0.0, rain_24h_mm), RAIN_SCORE_BREAKPOINTS_MM)
    antecedent_bonus = min(15.0, max(0.0, rain_72h_mm) / 20.0)
    return round(min(100.0, base + antecedent_bonus), 1)


def soil_moisture_score(soil_moisture_m3m3: float) -> float:
    if soil_moisture_m3m3 <= 0:
        return 0.0
    return round(
        min(100.0, (soil_moisture_m3m3 / SOIL_MOISTURE_SATURATION_M3M3) * 100.0), 1
    )


def river_discharge_score(current_m3s: float | None, median_m3s: float | None) -> float:
    if current_m3s is None or median_m3s is None or median_m3s <= 0:
        return 30.0  # no nearby GloFAS river cell -> neutral-low default
    ratio = current_m3s / median_m3s
    score = 20 + (ratio - 1.0) * 40.0
    return round(max(0.0, min(100.0, score)), 1)


def composite_score(
    rainfall: float, soil_moisture: float, slope: float, historical: float, river: float
) -> float:
    w = RISK_WEIGHTS
    total = (
        rainfall * w["rainfall"]
        + soil_moisture * w["soil_moisture"]
        + slope * w["slope"]
        + historical * w["historical"]
        + river * w["river_discharge"]
    )
    return round(min(100.0, total), 1)


def risk_level_for_score(score: float) -> str:
    for upper, label in RISK_LEVEL_BANDS:
        if score < upper:
            return label
    return RISK_LEVEL_BANDS[-1][1]


def next_rain_threshold(rain_24h_mm: float) -> float | None:
    for t in IMD_THRESHOLDS_MM:
        if rain_24h_mm < t:
            return t
    return None


def estimate_lead_time_hours(rain_24h_mm: float, hourly_forecast_precip: list) -> float | None:
    """
    Approximate hours until the 24h rainfall total crosses the next IMD
    severity threshold, assuming forecast rain simply adds to today's
    total. This ignores hours rolling off the back of the window, so it
    slightly overstates how fast the total climbs -- a deliberate,
    documented simplification, not an attempt at a precise rolling sum.
    """
    threshold = next_rain_threshold(rain_24h_mm)
    if threshold is None:
        return 0.0
    needed = threshold - rain_24h_mm
    cumulative = 0.0
    for hour_index, mm in enumerate(hourly_forecast_precip):
        cumulative += mm or 0.0
        if cumulative >= needed:
            return float(hour_index + 1)
    return None


def evaluate_village(village_id: str) -> dict:
    village = VILLAGES_BY_ID[village_id]
    live = open_meteo.fetch_live_conditions(village["lat"], village["lon"])
    flood = open_meteo.fetch_flood(village["lat"], village["lon"])

    # Apply any active "simulate storm" boost (demo-only IoT stand-in)
    # on top of the real live data pulled from Open-Meteo.
    boost = mock_iot.get_active_boost(village_id)
    rain_24h = live["rain_24h_mm"] + boost["extra_rain_mm"]
    rain_72h = live["rain_72h_mm"] + boost["extra_rain_mm"]
    soil_moisture = live["soil_moisture_m3m3"] + boost["extra_soil"]

    r_score = rainfall_score(rain_24h, rain_72h)
    s_score = soil_moisture_score(soil_moisture)
    riv_score = river_discharge_score(flood["current_m3s"], flood["median_m3s"])
    slope_score = village["slope_score"]
    hist_score = village["historical_score"]

    total = composite_score(r_score, s_score, slope_score, hist_score, riv_score)
    level = risk_level_for_score(total)
    lead_time = estimate_lead_time_hours(rain_24h, live["hourly_precip"])

    return {
        "id": village["id"],
        "name": village["name"],
        "district": village["district"],
        "state": village["state"],
        "lat": village["lat"],
        "lon": village["lon"],
        "slope_category": village["slope_category"],
        "notes": village["notes"],
        "risk_score": total,
        "risk_level": level,
        "factors": {
            "rainfall_score": r_score,
            "soil_moisture_score": s_score,
            "slope_score": slope_score,
            "historical_score": hist_score,
            "river_discharge_score": riv_score,
        },
        "rain_24h_mm": round(rain_24h, 1),
        "rain_72h_mm": round(rain_72h, 1),
        "soil_moisture_m3m3": round(soil_moisture, 3),
        "river_discharge_m3s": flood["current_m3s"],
        "lead_time_hours": lead_time,
        "data_source": "open-meteo",
        "has_alert_contacts": len(ALERT_CONTACTS.get(village["id"], [])) > 0,
        "alert_contacts_count": len(ALERT_CONTACTS.get(village["id"], [])),
    }


def _rescale_to_gauge_totals(times: list[str], precip: list, overrides_mm: dict) -> tuple[list, set]:
    """
    Open-Meteo's historical archive is ERA5-Land reanalysis (~11km
    grid), which under-samples hyper-local convective cloudbursts over
    steep terrain -- confirmed empirically for this event, where it
    showed ~5-7x less rain than IMD gauges recorded. Where a documented
    gauge total exists for a given day, scale that day's hourly values
    up so their sum matches the gauge reading, preserving the
    reanalysis's hour-to-hour shape. Returns the adjusted precip list
    plus the set of hour-indices that were rescaled, so callers can
    disclose which points are gauge-calibrated vs raw reanalysis.
    """
    if not overrides_mm:
        return precip, set()

    adjusted = list(precip)
    calibrated_indices: set = set()
    by_day: dict[str, list[int]] = {}
    for i, t in enumerate(times):
        by_day.setdefault(t[:10], []).append(i)

    for day, target_total in overrides_mm.items():
        indices = by_day.get(day)
        if not indices:
            continue
        day_values = [precip[i] or 0.0 for i in indices]
        current_total = sum(day_values)
        if current_total > 0:
            factor = target_total / current_total
            for i in indices:
                adjusted[i] = (precip[i] or 0.0) * factor
        else:
            # no rain at all in the reanalysis that day: spread the
            # documented total evenly rather than leaving it at zero
            even_share = target_total / len(indices)
            for i in indices:
                adjusted[i] = even_share
        calibrated_indices.update(indices)

    return adjusted, calibrated_indices


def evaluate_historical_series(
    village_id: str, start_date: str, end_date: str, gauge_overrides_mm: dict | None = None
) -> list[dict]:
    """
    Replays a past date range through the same scoring functions used
    live, maintaining a true rolling 24h/72h rainfall window hour by
    hour. Used to show, e.g., the risk score climbing to Severe in the
    hours before the 30 July 2024 Wayanad landslide. River discharge is
    held at a neutral score here since aligning GloFAS's historical
    record to arbitrary past windows is out of scope for the demo.
    """
    village = VILLAGES_BY_ID[village_id]
    hist = open_meteo.fetch_historical(village["lat"], village["lon"], start_date, end_date)
    if not hist["available"]:
        return []

    precip, calibrated_indices = _rescale_to_gauge_totals(
        hist["times"], hist["precip"], gauge_overrides_mm or {}
    )

    points = []
    rolling_24h: list[float] = []
    rolling_72h: list[float] = []
    for idx, (t, soil) in enumerate(zip(hist["times"], hist["soil"])):
        p = precip[idx] or 0.0
        soil = soil or 0.0

        rolling_24h.append(p)
        rolling_72h.append(p)
        if len(rolling_24h) > 24:
            rolling_24h.pop(0)
        if len(rolling_72h) > 72:
            rolling_72h.pop(0)

        r_score = rainfall_score(sum(rolling_24h), sum(rolling_72h))
        s_score = soil_moisture_score(soil)
        riv_score = 30.0
        total = composite_score(
            r_score, s_score, village["slope_score"], village["historical_score"], riv_score
        )
        points.append(
            {
                "time": t,
                "precipitation_mm": round(p, 1),
                "soil_moisture_m3m3": round(soil, 3),
                "risk_score": total,
                "risk_level": risk_level_for_score(total),
                "gauge_calibrated": idx in calibrated_indices,
            }
        )
    return points
