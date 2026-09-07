import { RISK_COLORS } from "../api";

export default function RiskBadge({ level, score }) {
  const color = RISK_COLORS[level] || "#666";
  return (
    <span className="risk-badge" style={{ background: color }}>
      <span className="risk-dot" />
      {level}
      {typeof score === "number" ? ` · ${score.toFixed(0)}` : ""}
    </span>
  );
}
