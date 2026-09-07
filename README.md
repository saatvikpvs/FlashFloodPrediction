# Flash Flood & Landslide Early Warning — Wayanad, Kerala

Hyper-local flash flood / landslide risk for villages in Wayanad district, built for the
NDRF flash flood prediction hackathon problem statement.

## Approach

**Deliberately not machine learning.** With 3 days and low team ML comfort, the core is a
transparent, physically-grounded rule engine: every village's risk score is a weighted
combination of five explainable factors, each computed from a real data source. A judge
(or an NDRF analyst) can see exactly *why* a village is flagged — that's a feature, not a
limitation, for a disaster-response tool. See [`backend/app/services/risk_engine.py`](backend/app/services/risk_engine.py)
for the full scoring logic and [`backend/app/config.py`](backend/app/config.py) for the
thresholds/weights.

| Factor | Weight | Source |
|---|---|---|
| Rainfall intensity (24h + 72h antecedent) | 35% | Open-Meteo Forecast API, IMD rainfall bands |
| Soil moisture / saturation | 20% | Open-Meteo Forecast API (ERA5-Land) |
| Slope & terrain | 20% | Static, hand-prepared per village |
| Historical susceptibility | 15% | Static, hand-prepared per village |
| River discharge anomaly | 10% | Open-Meteo Flood API (GloFAS) |

Two headline features:
1. **Live dashboard** — all 8 villages scored from live data, map + factor breakdown +
   a "simulate a storm" control that stands in for real IoT sensors (we have none) and
   lets you show the risk score react in real time during a demo.
2. **Historical replay** — replays the 30 July 2024 Wayanad landslide through the same
   scoring engine using Open-Meteo's historical archive. The computed risk score reaches
   Severe roughly half a day before the landslide actually struck.

### A real data limitation we found (and turned into a feature)

Open-Meteo's historical archive is ERA5-Land reanalysis (~11km grid). Testing the replay
against documented IMD gauge readings for 28-29 July 2024 showed the reanalysis captured
only ~7mm and ~51mm of rain on those two days, versus the ~204.5mm and ~372.6mm gauges
actually recorded — a 5-7x undercount. This is a known, real limitation of reanalysis
products for hyper-local convective cloudbursts over steep terrain, **and it's exactly why
the problem statement asks for local IoT rain gauges instead of relying on satellite/model
data alone.** Rather than hide the gap, `evaluate_historical_series()` in `risk_engine.py`
rescales those two days to match the documented gauge totals and flags which points were
adjusted (`gauge_calibrated`) — the replay UI discloses this. Use it in the pitch.

## Running it

**Backend** (Python 3.11+, no API keys needed — Open-Meteo is free/keyless):
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
Open http://localhost:5173. The frontend expects the API at `http://localhost:8000`
(override with a `.env` file setting `VITE_API_BASE_URL`).

## Project layout

```
backend/app/
  config.py              risk weights + IMD rainfall thresholds
  data/villages.py        the 8 demo villages (coords, slope, historical score)
  data/historical_events.py   the Wayanad 2024 event + gauge calibration
  services/open_meteo.py  Open-Meteo API client (forecast/historical/flood), with caching
  services/risk_engine.py the scoring logic + historical replay
  services/mock_iot.py    simulated sensor feed + "storm simulation" demo control
  routers/villages.py      /api/villages endpoints
  routers/replay.py        /api/replay endpoints
frontend/src/
  components/MapView.jsx       Leaflet map, colored by risk
  components/VillageDetail.jsx factor breakdown, live sensor feed, storm simulator, trend chart
  components/ReplayView.jsx    the Wayanad 2024 replay chart
  api.js                       API client
```

## Data sources

- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) — rainfall, soil moisture (free, no key)
- [Open-Meteo Historical API](https://open-meteo.com/en/docs/historical-weather-api) — ERA5-Land back to 1940 (free, no key)
- [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) — GloFAS river discharge (free, no key)
- Village slope/historical-susceptibility: hand-prepared, see `data/villages.py` for notes per village
- Wayanad 2024 event facts: [Wikipedia](https://en.wikipedia.org/wiki/2024_Wayanad_landslides), [Eos.org](https://eos.org/thelandslideblog/wayanad-landslides)

## Suggested next steps (if time allows)

- **More villages / another district** — `data/villages.py` is a flat list; adding a
  village is just adding an entry with coordinates + slope/historical estimates.
- **Thin ML layer** — a small scikit-learn model trained on rainfall-vs-disaster-day
  data, shown as a secondary "confidence" indicator alongside the rule-based score. Keep
  it additive, not load-bearing — the rule engine should keep working if this is cut.
- **Real alerts** — Twilio SMS as a stretch goal; treat as optional, don't let it block
  the core demo.
- **Deploy** — Render/Railway for the backend, Vercel for the frontend, if a shareable
  link is wanted. Not required for a live judged demo.

## Team split (suggested)

- Data ingestion (Open-Meteo client, mock IoT): 1-2 people
- Risk scoring engine + tuning weights/thresholds: 1 person
- Dashboard/map/frontend: 2 people
- Village data prep (slope/historical estimates), demo script, pitch: 1 person
