# Flash Flood & Landslide Early Warning System

### Smart India Hackathon 2026 — Wayanad, Kerala pilot

| | |
|---|---|
| **Problem Statement ID** | SIH26192 |
| **Problem Statement Title** | Flash Flood Prediction System for Hilly Regions using Multi-Source Data |
| **Theme** | Disaster Management |
| **PS Category** | Software |
| **Team ID** | IR2026-1044699 |
| **Team Name** | TEAM VALOR |

---

## The problem

Flash floods and landslides in hilly terrain strike fast and hyper-locally — a cloudburst
over one ridge can miss a valley 5km away entirely. Single-source forecasting (a satellite
feed, a single model) is too coarse for this; the problem statement asks for a system that
fuses **multiple independent data sources** into one actionable, hyper-local risk signal,
with real-time alerting for the people and authorities who need to act on it.

## Our answer

A live risk-scoring system for 8 villages in Wayanad district — the site of the
30 July 2024 landslide/debris-flow disaster — that fuses five independent signals into one
transparent, explainable risk score per village, refreshed continuously, with:

- **Emergency SMS alerts** dispatched automatically once a village crosses the Severe
  threshold
- **Evacuation routing** that recalculates roads away from currently-dangerous villages
- **Citizen-facing SOS** so people on the ground can request rescue directly
- **A historical replay** that proves the engine would have flagged the actual 2024
  disaster roughly a day and a half before it struck

**Deliberately not machine learning.** With no labeled disaster dataset for this region and
a hard deadline, we built a transparent, physically-grounded rule engine instead: every
score is a weighted sum of five explainable factors, each traceable to a real data source.
An NDRF analyst — or a judge — can see exactly *why* a village is flagged. For a
disaster-response tool that has to be trusted under pressure, that's a feature, not a
compromise. See [`backend/app/services/risk_engine.py`](backend/app/services/risk_engine.py)
for the scoring logic and [`backend/app/config.py`](backend/app/config.py) for the
weights/thresholds.

### The five fused sources

| Factor | Weight | Source |
|---|---|---|
| Rainfall intensity (24h + 72h antecedent) | 35% | Open-Meteo Forecast API, scored against IMD rainfall bands |
| Soil moisture / saturation | 20% | Open-Meteo Forecast API (ERA5-Land) |
| Slope & terrain | 20% | Static, hand-prepared per village (DEM-informed) |
| Historical susceptibility | 15% | Static, hand-prepared from documented past events |
| River discharge anomaly | 10% | Open-Meteo Flood API (GloFAS) |

Rainfall dominates the weighting because it's the most direct, moment-to-moment trigger;
slope and history are static "predisposition" factors, not live signals. Composite score
maps to four bands: **Low (<25) → Moderate (25–50) → High (50–75) → Severe (75–100)**.

## What the system actually does

The frontend is one React app with three audience-specific views, switched from a single
header toggle — not three separate builds:

**Live Dashboard** (officials / NDRF)
- Full factor breakdown per village, live rainfall/soil-moisture trend chart
- SMS alert dispatch via Fast2SMS once a village's score exceeds 90
- Rescue request triage queue — dispatch / resolve incoming SOS calls
- A separate "Demo Controls" tab holding the storm simulator, the simulated IoT feed,
  and the entry point into the historical replay — kept out of the main flow so it's never
  confused with live data

**Citizen View** (the public)
- Just a risk badge and a plain-language status line — no scores, no dispatch tools
- Evacuation routes to the nearest shelter, on by default
- A "Request Rescue" button that files a real SOS into the same queue officials see

**Replay — Accuracy Evidence** (judges / validation)
- Replays the actual 30 July 2024 Wayanad landslide through the identical scoring engine
  using Open-Meteo's historical archive
- The computed score first crosses Severe (75+) at **2024-07-28, 13:00 IST**, peaking at
  91.9/100 — roughly **38 hours** before the landslide struck at ~02:17–04:30 IST on 30 July

### A real data limitation we found — and the whole reason multi-source matters

Open-Meteo's historical archive is ERA5-Land reanalysis (~11km grid). Testing the replay
against documented IMD gauge readings for 28–29 July 2024 showed the reanalysis captured
only ~7mm and ~51mm of rain on those two days, versus the ~204.5mm and ~372.6mm the gauges
actually recorded — a 5–7x undercount. This is a well-known, real limitation of
reanalysis/satellite products for hyper-local convective cloudbursts over steep terrain,
and **it's exactly why the problem statement asks for multi-source data instead of any
single feed** — a local IoT rain gauge network would have caught what the reanalysis missed.
Rather than hide the gap, `evaluate_historical_series()` in `risk_engine.py` rescales those
two days to match the documented gauge totals and flags exactly which points were adjusted
(`gauge_calibrated`) — the replay UI discloses this rather than silently smoothing it over.

## Tech stack

| | |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic, Uvicorn |
| Frontend | React 19, Vite, React-Leaflet / Leaflet, Recharts, Axios |
| Weather / hydrology data | Open-Meteo (Forecast, Historical/Archive, Flood APIs) — free, keyless |
| SMS alerts | Fast2SMS (Quick SMS route — no DLT registration needed) |
| Evacuation routing | OpenRouteService (Directions API) |

## Project layout

```
backend/app/
  config.py                    risk weights, IMD rainfall thresholds, alert-contacts registry
  main.py                      FastAPI app entrypoint
  models.py                    Pydantic response/request schemas
  data/villages.py             the 8 villages (coords, slope, historical score)
  data/historical_events.py    the Wayanad 2024 event + IMD gauge calibration
  services/open_meteo.py       Open-Meteo API client (forecast/historical/flood), with a 120s cache
  services/risk_engine.py      the scoring logic + historical replay
  services/mock_iot.py         simulated sensor feed + "storm simulation" demo control
  services/fast2sms_service.py emergency SMS dispatch
  routers/villages.py          /api/villages/* — list, trend, sensor, simulate, alert
  routers/rescue.py            /api/rescue/* — submit, list, dispatch, resolve
  routers/replay.py            /api/replay/* — historical series
frontend/src/
  App.jsx                          view/mode switch: Live Dashboard | Citizen View | Replay
  components/MapView.jsx           Leaflet map — risk-colored markers, evacuation routes, rescue pins
  components/VillageList.jsx       officials' village accordion sidebar
  components/VillageDetail.jsx     officials' factor breakdown + Demo Controls tab
  components/ScorePanel.jsx        risk score + SMS alert dispatch button
  components/CitizenView.jsx       the public-facing view
  components/RescuePanel.jsx       officials' rescue triage queue
  components/RescueRequestModal.jsx  the SOS submission form
  components/ReplayView.jsx        the Wayanad 2024 replay chart
  components/TrendChart.jsx        shared rainfall/soil-moisture/risk chart
  utils/orsRouting.js              OpenRouteService client (called directly from the browser)
  data/evacuationRoutes.js         per-village shelter + static fallback route waypoints
  api.js                           backend API client
```

## Running it

**Backend** (Python 3.11+, no API key required — Open-Meteo is free/keyless):
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

**Frontend** (Node 18+):
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

### Optional configuration

The app runs fully with zero configuration — Open-Meteo needs no key, SMS dispatch falls
back to a logged "mock mode," and evacuation routing falls back to static waypoints. To
enable the real integrations, copy the `.env.example` in each folder:

- **`backend/.env`** (see [`backend/.env.example`](backend/.env.example)) — `FAST2SMS_API_KEY`
  and `ALERT_PHONES_<VILLAGE_ID>` per village you want alert-enabled. A village with no
  `ALERT_PHONES_*` set simply has no alert contacts; nothing is hardcoded into source.
- **`frontend/.env`** (see [`frontend/.env.example`](frontend/.env.example)) — `VITE_ORS_API_KEY`
  (free at [openrouteservice.org](https://openrouteservice.org/dev/#/signup)) for live,
  hazard-avoiding road routing instead of the static fallback, and `VITE_API_BASE_URL` if
  the backend isn't on `localhost:8000`.

Both `.env` files are git-ignored — real keys and phone numbers never enter source control.

## What's real vs. simulated

Being upfront about this matters for a disaster-response pitch:

| Component | Status |
|---|---|
| Rainfall, soil moisture, river discharge | **Real** — live Open-Meteo API calls, cached 2 min |
| Risk scoring | **Real** — deterministic, fully auditable formula |
| Historical replay | **Real** — same engine, run against real archive data |
| SMS alerts | **Real** (Fast2SMS) — demo contact lists, not a verified village registry |
| Evacuation routing | **Real** (OpenRouteService), with a static-waypoint fallback if unconfigured |
| Soil-moisture / water-level sensors | **Simulated** — no physical IoT hardware; stands in for what a real deployment needs |
| Storm simulation | **Demo-only**, isolated in its own "Demo Controls" tab, never mixed with live data |
| Officials vs. citizen access | **UI-level split only** — no authentication boundary yet |
| Rescue request storage | **In-memory** — resets on backend restart; would move to a real DB in production |

## Data sources

- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) — rainfall, soil moisture (free, no key)
- [Open-Meteo Historical API](https://open-meteo.com/en/docs/historical-weather-api) — ERA5-Land back to 1940 (free, no key)
- [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) — GloFAS river discharge (free, no key)
- [Fast2SMS](https://www.fast2sms.com/) — emergency SMS dispatch
- [OpenRouteService](https://openrouteservice.org/) — evacuation route directions
- Village slope/historical-susceptibility: hand-prepared, see `data/villages.py` for notes per village
- Wayanad 2024 event facts: [Wikipedia](https://en.wikipedia.org/wiki/2024_Wayanad_landslides), [Eos.org](https://eos.org/thelandslideblog/wayanad-landslides)

## Roadmap

- **Real local IoT integration** — replace `mock_iot.py` with actual rain-gauge/soil-moisture
  hardware feeds; this is the single biggest accuracy lever, per the ERA5-Land finding above
- **Role-based authentication** — a real login boundary between the officials' dashboard and
  the public view, instead of today's UI-only split
- **Persistent storage** — move rescue requests (and eventually village history) off
  in-memory lists and into a real database
- **More villages / districts** — `data/villages.py` is a flat list; scaling out is just
  adding entries with coordinates and slope/historical estimates
- **A thin ML layer as a secondary signal** — trained on rainfall-vs-disaster-day data,
  shown alongside the rule-based score as a confidence indicator, never replacing it

---

Built by **Team Valor** for Smart India Hackathon 2026, Problem Statement SIH26192.
