import { useState } from "react";
import RiskBadge from "./RiskBadge";
import VillagePanel from "./VillagePanel";

export default function VillageList({ villages, selectedId, onSelect, trend, trendLoading, trendError, lastUpdated }) {
  const [expandedId, setExpandedId] = useState(null);
  const sorted = [...villages].sort((a, b) => b.risk_score - a.risk_score);

  function handleClick(id) {
    onSelect(id);
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="sidebar">
      <h2>Villages ({villages.length})</h2>
      {sorted.map((v) => {
        const isExpanded = v.id === expandedId;
        return (
          <div key={v.id} className="village-item">
            <div
              className={`village-card${v.id === selectedId ? " selected" : ""}`}
              onClick={() => handleClick(v.id)}
            >
              <div>
                <div className="name">{v.name}</div>
                <div className="sub">{v.rain_24h_mm}mm rain (24h)</div>
              </div>
              <div className="village-card-right">
                <RiskBadge level={v.risk_level} score={v.risk_score} />
                <span className={`accordion-caret${isExpanded ? " open" : ""}`}>▾</span>
              </div>
            </div>
            {isExpanded && (
              <VillagePanel
                village={v}
                // The shared trend fetch (lifted to App) only covers the
                // currently *selected* village; only show it here when
                // this expanded row is also the selected one, otherwise
                // fall back to the "—" / loading state rather than
                // showing another village's data.
                trend={v.id === selectedId ? trend : null}
                trendLoading={v.id === selectedId ? trendLoading : false}
                trendError={v.id === selectedId ? trendError : false}
                lastUpdated={lastUpdated}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
