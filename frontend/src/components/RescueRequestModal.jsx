import { useState } from "react";
import { submitRescueRequest } from "../api";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "🔴 Critical", desc: "Life-threatening, immediate help needed" },
  { value: "urgent",   label: "🟠 Urgent",   desc: "Serious risk, help needed within hours" },
  { value: "moderate", label: "🟡 Moderate",  desc: "Safe for now but need assistance" },
];

export default function RescueRequestModal({ village, onClose, onSubmitted }) {
  const [severity, setSeverity]     = useState("urgent");
  const [peopleCount, setPeopleCount] = useState(1);
  const [notes, setNotes]           = useState("");
  const [contact, setContact]       = useState("");
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitRescueRequest({
        village_id:   village.id,
        village_name: village.name,
        lat:          village.lat,
        lon:          village.lon,
        severity,
        people_count: Number(peopleCount),
        notes,
        contact: contact || null,
      });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to submit request. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🆘 Request Rescue</span>
          <span className="modal-village-tag">{village.name}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Severity */}
          <div className="modal-field">
            <label className="modal-label">Severity</label>
            <div className="severity-options">
              {SEVERITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`severity-option ${severity === opt.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={opt.value}
                    checked={severity === opt.value}
                    onChange={() => setSeverity(opt.value)}
                  />
                  <span className="severity-label">{opt.label}</span>
                  <span className="severity-desc">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* People count */}
          <div className="modal-field modal-field-row">
            <div style={{ flex: 1 }}>
              <label className="modal-label">People needing rescue</label>
              <input
                className="modal-input"
                type="number"
                min={1}
                max={999}
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 2 }}>
              <label className="modal-label">Contact number <span className="modal-optional">(optional)</span></label>
              <input
                className="modal-input"
                type="tel"
                placeholder="10-digit mobile"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="modal-field">
            <label className="modal-label">Situation notes <span className="modal-optional">(optional)</span></label>
            <textarea
              className="modal-input modal-textarea"
              placeholder="e.g. Trapped on rooftop, road washed out, elderly residents..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <div className="modal-error">⚠️ {error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="modal-btn-submit" disabled={busy}>
              {busy ? "Sending…" : "🆘 Submit Rescue Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
