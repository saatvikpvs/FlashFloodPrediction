import { useState } from "react";
import RiskBadge from "./RiskBadge";
import MapView from "./MapView";
import RescueRequestModal from "./RescueRequestModal";
import { RISK_COLORS } from "../api";

// Public-facing view: what a villager should see, as opposed to the
// Live Dashboard (officials/NDRF — prediction detail, alert dispatch,
// rescue triage). No factor breakdown, no simulate-storm, no send-alert,
// no rescue triage list — just "is my village at risk", the map with
// evacuation routes, and a way to ask for help.
function statusTextFor(village) {
  if (!village) return "Select your village to see its current flood/landslide risk.";
  if (village.risk_level === "Severe") {
    return "Risk is SEVERE right now. Follow official evacuation guidance and move to higher ground immediately.";
  }
  const leadTime = village.lead_time_hours;
  if (typeof leadTime === "number" && leadTime > 0) {
    return `Conditions may worsen in the next ~${leadTime.toFixed(0)} hours. Stay alert and watch for official updates.`;
  }
  if (village.risk_level === "High") {
    return "Risk is elevated. Keep monitoring official updates and be ready to move if conditions change.";
  }
  return "No immediate danger indicated for this village. Conditions are being monitored continuously.";
}

export default function CitizenView({ villages, selectedId, onSelect, refreshKey, rescueRequests, onRefresh }) {
  const [rescueModalOpen, setRescueModalOpen] = useState(false);
  const sorted = [...villages].sort((a, b) => b.risk_score - a.risk_score);
  const selected = villages.find((v) => v.id === selectedId) || null;

  return (
    <div className="app-body">
      <div className="sidebar">
        <h2>Select Your Village</h2>
        {sorted.map((v) => (
          <div
            key={v.id}
            className={`village-card${v.id === selectedId ? " selected" : ""}`}
            onClick={() => onSelect(v.id)}
          >
            <div className="name">{v.name}</div>
            <RiskBadge level={v.risk_level} />
          </div>
        ))}
      </div>

      <div className="map-pane">
        <MapView
          villages={villages}
          selectedId={selectedId}
          onSelect={onSelect}
          refreshKey={refreshKey}
          rescueRequests={rescueRequests}
          defaultShowRoutes
        />
      </div>

      <div className="detail-pane">
        {!selected ? (
          <div className="empty">Select a village on the map or list to see its status.</div>
        ) : (
          <>
            <div className="detail-header">
              <h2>{selected.name}</h2>
              <div className="loc">
                {selected.district}, {selected.state}
              </div>
            </div>

            <div className="citizen-risk-badge-row">
              <RiskBadge level={selected.risk_level} score={selected.risk_score} />
            </div>

            <div
              className="notes-card citizen-status-text"
              style={{ borderColor: RISK_COLORS[selected.risk_level] || undefined }}
            >
              {statusTextFor(selected)}
            </div>

            {selected.notes && <div className="notes-card">{selected.notes}</div>}

            <button className="rescue-request-btn" onClick={() => setRescueModalOpen(true)}>
              🆘 Request Rescue for {selected.name}
            </button>
          </>
        )}
      </div>

      {rescueModalOpen && selected && (
        <RescueRequestModal
          village={selected}
          onClose={() => setRescueModalOpen(false)}
          onSubmitted={onRefresh}
        />
      )}
    </div>
  );
}
