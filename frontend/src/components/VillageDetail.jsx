import { useEffect, useState, useCallback } from "react";
import RiskBadge from "./RiskBadge";
import TrendChart from "./TrendChart";
import ScorePanel from "./ScorePanel";
import { fetchSensorReading, triggerStorm, clearStorm, RISK_COLORS } from "../api";

const FACTOR_LABELS = {
  rainfall_score: "Rainfall intensity",
  soil_moisture_score: "Soil moisture / saturation",
  slope_score: "Slope & terrain",
  historical_score: "Historical susceptibility",
  river_discharge_score: "River discharge anomaly",
};

function FactorBar({ label, value }) {
  const color = value >= 75 ? RISK_COLORS.Severe : value >= 50 ? RISK_COLORS.High : value >= 25 ? RISK_COLORS.Moderate : RISK_COLORS.Low;
  return (
    <div className="factor-row">
      <div className="label-row">
        <span className="name">{label}</span>
        <span className="value">{value.toFixed(0)}/100</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function VillageDetail({ village, onRefresh, trend }) {
  const [sensor, setSensor] = useState(null);
  const [simBusy, setSimBusy] = useState(false);

  const pollSensor = useCallback(() => {
    if (!village) return;
    fetchSensorReading(village.id).then(setSensor).catch(() => {});
  }, [village?.id]);

  useEffect(() => {
    if (!village) return;
    pollSensor();
    const interval = setInterval(pollSensor, 4000);
    return () => clearInterval(interval);
  }, [village?.id, pollSensor]);

  if (!village) {
    return (
      <div className="detail-pane">
        <div className="empty">Select a village on the map or list to see its risk breakdown.</div>
      </div>
    );
  }

  async function handleSimulate(intensity) {
    setSimBusy(true);
    try {
      await triggerStorm(village.id, intensity, 10);
      await onRefresh();
      pollSensor();
    } finally {
      setSimBusy(false);
    }
  }

  async function handleClear() {
    setSimBusy(true);
    try {
      await clearStorm(village.id);
      await onRefresh();
      pollSensor();
    } finally {
      setSimBusy(false);
    }
  }

  const leadTime = village.lead_time_hours;
  let leadTimeText = null;
  if (leadTime === 0) {
    leadTimeText = "Already at the most severe rainfall band.";
  } else if (typeof leadTime === "number") {
    leadTimeText = `At forecast rainfall rates, the 24h total is projected to cross the next severity threshold in ~${leadTime.toFixed(0)}h.`;
  } else {
    leadTimeText = "Forecast horizon does not show the next threshold being crossed.";
  }

  return (
    <div className="detail-pane">
      <ScorePanel village={village} />
      <div className="lead-time-note">{leadTimeText}</div>

      <div className="section-title">Why this score — factor breakdown</div>
      {Object.entries(FACTOR_LABELS).map(([key, label]) => (
        <FactorBar key={key} label={label} value={village.factors[key]} />
      ))}

      <div className="notes-card">
        {village.notes}
        <br />
        Rain (24h): {village.rain_24h_mm}mm · Rain (72h): {village.rain_72h_mm}mm · Soil moisture:{" "}
        {village.soil_moisture_m3m3} m³/m³
        {village.river_discharge_m3s != null && <> · River discharge: {village.river_discharge_m3s} m³/s</>}
      </div>

      <div className="section-title">Simulated IoT sensor feed</div>
      <div className="sensor-card">
        <div className="sensor-tile">
          <div className="label">
            <span className="pulse-dot" />
            Soil moisture probe
          </div>
          <div className="val">{sensor ? `${sensor.soil_moisture_m3m3} m³/m³` : "…"}</div>
        </div>
        <div className="sensor-tile">
          <div className="label">
            <span className="pulse-dot" />
            Water level sensor
          </div>
          <div className="val">{sensor ? `${sensor.water_level_cm} cm` : "…"}</div>
        </div>
      </div>

      <div className="section-title">Simulate a storm (demo)</div>
      <div className="sim-controls">
        <button disabled={simBusy} onClick={() => handleSimulate("moderate")}>
          Moderate
        </button>
        <button disabled={simBusy} onClick={() => handleSimulate("severe")}>
          Severe
        </button>
        <button disabled={simBusy} onClick={() => handleSimulate("extreme")}>
          Extreme
        </button>
        <button className="clear" disabled={simBusy} onClick={handleClear}>
          Clear simulation
        </button>
      </div>

      <div className="section-title">Rainfall & soil moisture (past 3d / forecast 3d)</div>
      <div className="chart-card">
        {trend ? (
          <TrendChart points={trend.points} nowIndex={trend.now_index} timeMode="utc" />
        ) : (
          <div className="loading">Loading trend…</div>
        )}
      </div>
    </div>
  );
}
