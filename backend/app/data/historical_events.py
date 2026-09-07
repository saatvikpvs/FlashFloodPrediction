"""
Hand-curated historical disaster facts, used as the "historical
inventory" data source and as the input window for the /replay
endpoint. Kept as a small sourced table instead of pulling from the
NASA Global Landslide Catalog, whose public export is stale (~2016)
and gated behind a terms-of-service click-through -- not worth the
integration time for a 3-day build.

Sources: Wikipedia "2024 Wayanad landslides"; Eos.org "The 30 July 2024
Wayanad landslides in Kerala, India"; Government of India PIB/News on
Air situation reports from 30 July 2024.
"""

HISTORICAL_EVENTS = [
    {
        "id": "wayanad_2024",
        "title": "Wayanad landslides",
        "date": "2024-07-30",
        "village_ids": ["chooralmala", "mundakkai", "meppadi"],
        "rainfall_24h_before_mm": 372.6,
        "rainfall_prior_24h_mm": 204.5,
        "summary": (
            "Debris flows struck Punjirimattom, Mundakkai and Chooralmala in the "
            "early hours of 30 July 2024, after Wayanad received roughly 204.5mm "
            "of rain on 28 July and 372.6mm on 29 July -- back-to-back days both "
            "at or above IMD's 'extremely heavy rain' threshold (>=204.5mm/24h)."
        ),
        "replay_window": {"start": "2024-07-25", "end": "2024-08-01"},
        # Open-Meteo's historical archive is ERA5-Land reanalysis at
        # ~11km resolution: testing this replay against the documented
        # gauge totals below showed it captures only ~7mm and ~51mm on
        # 28/29 July -- a 5-7x underestimate. This is a known, real
        # limitation of reanalysis products for hyper-local convective
        # cloudbursts over steep terrain, and it is a live demonstration
        # of exactly why the problem statement calls for local IoT rain
        # gauges, not just satellite/reanalysis data. Rather than hide
        # the gap, evaluate_historical_series() rescales the reanalysis
        # hours on these two dates so their daily total matches the
        # documented gauge reading, and flags those points as
        # "gauge_calibrated" so the UI can disclose the substitution.
        "gauge_overrides_mm": {
            "2024-07-28": 204.5,
            "2024-07-29": 372.6,
        },
    },
]
