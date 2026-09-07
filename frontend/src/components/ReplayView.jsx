import { useEffect, useState } from "react";
import RiskBadge from "./RiskBadge";
import TrendChart from "./TrendChart";
import { fetchReplay } from "../api";

const VILLAGE_NAMES = {
  chooralmala: "Chooralmala",
  mundakkai: "Mundakkai",
  meppadi: "Meppadi",
};

export default function ReplayView() {
  const [villageId, setVillageId] = useState("mundakkai");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReplay("wayanad_2024", villageId).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [villageId]);

  const disasterIndex = data ? data.points.findIndex((p) => p.time === "2024-07-30T03:00") : -1;
  const peakRisk = data ? Math.max(...data.points.map((p) => p.risk_score)) : null;
  const severeFirstAt = data ? data.points.find((p) => p.risk_level === "Severe") : null;

  return (
    <div className="replay-view">
      <div className="village-tabs">
        {Object.entries(VILLAGE_NAMES).map(([id, name]) => (
          <button
            key={id}
            className={id === villageId ? "active" : ""}
            onClick={() => setVillageId(id)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="loading">Loading historical replay…</div>
      ) : (
        <>
          <div className="event-card">
            <h2>
              {data.event_title} — {data.event_date}
            </h2>
            <p>{data.summary}</p>
            {severeFirstAt && (
              <p>
                <strong>
                  This system would have flagged {data.village_name} as Severe risk starting{" "}
                  {severeFirstAt.time.replace("T", " ")} IST
                </strong>{" "}
                — hours before the landslide struck at ~02:17-04:30 IST on 30 July. Peak computed risk
                score: {peakRisk.toFixed(0)}/100.
              </p>
            )}
            {data.data_quality_note && <div className="calibration-note">⚠ {data.data_quality_note}</div>}
          </div>

          <div className="section-title">
            Computed risk score, {data.village_name} (25 Jul – 1 Aug 2024)
          </div>
          <div className="chart-card">
            <TrendChart
              points={data.points}
              nowIndex={disasterIndex >= 0 ? disasterIndex : undefined}
              referenceLabel="Landslide"
              timeMode="local"
            />
          </div>
        </>
      )}
    </div>
  );
}
