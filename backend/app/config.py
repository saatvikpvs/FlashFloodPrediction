"""
Constants for the risk engine. Thresholds are based on IMD's standard
24-hour rainfall intensity classification, which is the same standard
India's own weather service uses to call rain "heavy" / "very heavy" /
"extremely heavy". Soil moisture and slope bands are heuristic
(no local soil survey data available in a hackathon timeframe) but are
kept explicit here so they're easy to defend or recalibrate.
"""

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
