// Expanded accordion content for a single village in the sidebar list.
// LIVE DATA reuses fields already returned by /api/villages (rain/soil/
// river) plus the shared `trend` fetch (same one VillageDetail uses) for
// the current/forecast rainfall line -- no independent API calls here.
// VILLAGE PROFILE is the static data already present on the village
// object (from data/villages.py), also with no extra fetch.
export default function VillagePanel({ village, trend, trendLoading, trendError, lastUpdated }) {
  const nowPoint =
    trend && typeof trend.now_index === "number" ? trend.points?.[trend.now_index] : null;
  const nextPoint =
    trend && typeof trend.now_index === "number" ? trend.points?.[trend.now_index + 1] : null;

  let currentRainfallText;
  if (trendLoading) {
    currentRainfallText = "Loading…";
  } else if (trendError) {
    currentRainfallText = "Live data unavailable";
  } else if (nowPoint) {
    const now = `${nowPoint.precipitation_mm.toFixed(1)}mm now`;
    const next =
      nextPoint != null ? ` · ${nextPoint.precipitation_mm.toFixed(1)}mm forecast next hr` : "";
    currentRainfallText = now + next;
  } else {
    currentRainfallText = "—";
  }

  return (
    <div className="village-accordion-panel" onClick={(e) => e.stopPropagation()}>
      <div className="accordion-section">
        <div className="accordion-section-title">
          Live data <span className="tag tag-live">LIVE · Open-Meteo</span>
        </div>
        <div className="accordion-row">
          <span className="k">Current / forecast rainfall</span>
          <span className="v">{currentRainfallText}</span>
        </div>
        <div className="accordion-row">
          <span className="k">Rainfall (24h)</span>
          <span className="v">{village.rain_24h_mm} mm</span>
        </div>
        <div className="accordion-row">
          <span className="k">Rainfall (72h antecedent)</span>
          <span className="v">{village.rain_72h_mm} mm</span>
        </div>
        <div className="accordion-row">
          <span className="k">Soil moisture</span>
          <span className="v">{village.soil_moisture_m3m3} m³/m³</span>
        </div>
        <div className="accordion-row">
          <span className="k">River discharge</span>
          <span className="v">
            {village.river_discharge_m3s != null
              ? `${village.river_discharge_m3s} m³/s (anomaly score ${village.factors.river_discharge_score.toFixed(0)}/100)`
              : "No GloFAS cell nearby"}
          </span>
        </div>
        <div className="accordion-row">
          <span className="k">Last fetched</span>
          <span className="v">{lastUpdated || "—"}</span>
        </div>
      </div>

      <div className="accordion-section">
        <div className="accordion-section-title">
          Village profile <span className="tag tag-static">PREDEFINED</span>
        </div>
        <div className="accordion-row">
          <span className="k">Location</span>
          <span className="v">
            {village.district}, {village.state}
          </span>
        </div>
        <div className="accordion-row">
          <span className="k">Coordinates</span>
          <span className="v">
            {village.lat.toFixed(4)}, {village.lon.toFixed(4)}
          </span>
        </div>
        <div className="accordion-row">
          <span className="k">Slope</span>
          <span className="v">
            {village.slope_category} ({village.factors.slope_score}/100)
          </span>
        </div>
        <div className="accordion-row">
          <span className="k">Historical susceptibility</span>
          <span className="v">{village.factors.historical_score}/100</span>
        </div>
        {village.notes && <div className="accordion-notes">{village.notes}</div>}
      </div>
    </div>
  );
}
