import RiskBadge from "./RiskBadge";

export default function VillageList({ villages, selectedId, onSelect }) {
  const sorted = [...villages].sort((a, b) => b.risk_score - a.risk_score);
  return (
    <div className="sidebar">
      <h2>Villages ({villages.length})</h2>
      {sorted.map((v) => (
        <div
          key={v.id}
          className={`village-card${v.id === selectedId ? " selected" : ""}`}
          onClick={() => onSelect(v.id)}
        >
          <div>
            <div className="name">{v.name}</div>
            <div className="sub">{v.rain_24h_mm}mm rain (24h)</div>
          </div>
          <RiskBadge level={v.risk_level} score={v.risk_score} />
        </div>
      ))}
    </div>
  );
}
