"""
Static village registry for the Wayanad, Kerala demo region.

slope_score and historical_score are static "predisposition" factors
(0-100) prepared ahead of time rather than computed live from a DEM /
disaster database, per the hackathon time-boxing decision. Real slope
comes from Western Ghats escarpment terrain; historical scores reflect
documented events (see historical_events.py) -- Chooralmala, Mundakkai
and Meppadi score highest because of the 30 July 2024 landslide, plus
(for Meppadi panchayat generally) the earlier 2019 Puthumala landslide
nearby.

Coordinates for Chooralmala/Mundakkai/Meppadi are sourced from Wikipedia
(see README sources). Other villages use town-center coordinates and
are approximate -- fine for pulling the right ~9km weather grid cell,
not surveyed to the meter.
"""

VILLAGES = [
    {
        "id": "chooralmala",
        "name": "Chooralmala",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.5021553,
        "lon": 76.1548412,
        "slope_category": "Very Steep",
        "slope_score": 95,
        "historical_score": 98,
        "notes": "Directly hit by the 30 July 2024 landslide/debris flow.",
    },
    {
        "id": "mundakkai",
        "name": "Mundakkai",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.4859333,
        "lon": 76.1559113,
        "slope_category": "Very Steep",
        "slope_score": 96,
        "historical_score": 98,
        "notes": "Directly hit by the 30 July 2024 landslide/debris flow.",
    },
    {
        "id": "meppadi",
        "name": "Meppadi",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.55786,
        "lon": 76.13199,
        "slope_category": "Steep",
        "slope_score": 75,
        "historical_score": 80,
        "notes": "Panchayat headquarters covering the 2024 disaster zone; also near the 2019 Puthumala landslide.",
    },
    {
        "id": "vythiri",
        "name": "Vythiri",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.5833,
        "lon": 76.0833,
        "slope_category": "Steep",
        "slope_score": 65,
        "historical_score": 40,
        "notes": "Taluk headquarters, hilly terrain, no major documented incident.",
    },
    {
        "id": "kalpetta",
        "name": "Kalpetta",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.6085,
        "lon": 76.0837,
        "slope_category": "Moderate",
        "slope_score": 35,
        "historical_score": 15,
        "notes": "District headquarters town, comparatively flatter and more urbanised.",
    },
    {
        "id": "mananthavady",
        "name": "Mananthavady",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.8035,
        "lon": 76.0064,
        "slope_category": "Moderate",
        "slope_score": 30,
        "historical_score": 20,
        "notes": "Northern Wayanad, plateau-like terrain.",
    },
    {
        "id": "sulthan_bathery",
        "name": "Sulthan Bathery",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.6667,
        "lon": 76.2833,
        "slope_category": "Gentle",
        "slope_score": 25,
        "historical_score": 10,
        "notes": "Eastern Wayanad, gentler terrain bordering Karnataka.",
    },
    {
        "id": "pulpally",
        "name": "Pulpally",
        "district": "Wayanad",
        "state": "Kerala",
        "lat": 11.7167,
        "lon": 76.1667,
        "slope_category": "Moderate",
        "slope_score": 40,
        "historical_score": 30,
        "notes": "Forest-edge village, moderate slope.",
    },
]

VILLAGES_BY_ID = {v["id"]: v for v in VILLAGES}
