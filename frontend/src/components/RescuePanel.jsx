import { useEffect, useState, useCallback } from "react";
import { fetchRescueRequests, updateRescueStatus, deleteRescueRequest } from "../api";

const SEVERITY_COLOR = {
  critical: { bg: "rgba(220,38,38,0.15)", border: "#dc2626", text: "#fca5a5", dot: "#ef4444" },
  urgent:   { bg: "rgba(234,88,12,0.15)",  border: "#ea580c", text: "#fdba74", dot: "#f97316" },
  moderate: { bg: "rgba(202,138,4,0.15)",  border: "#ca8a04", text: "#fde047", dot: "#eab308" },
};

const STATUS_META = {
  pending:    { label: "Pending",    cls: "status-pending" },
  dispatched: { label: "Dispatched", cls: "status-dispatched" },
  resolved:   { label: "Resolved",   cls: "status-resolved" },
};

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function RescuePanel({ onClose, onRequestsChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all"); // all | pending | dispatched | resolved
  const [busy, setBusy]         = useState(null);  // id of request being updated

  const load = useCallback(async () => {
    try {
      const data = await fetchRescueRequests();
      setRequests(data);
      onRequestsChange?.(data);
    } catch { /* backend may not be running */ }
    finally { setLoading(false); }
  }, [onRequestsChange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleStatus(id, status) {
    setBusy(id);
    try {
      await updateRescueStatus(id, status);
      await load();
    } finally { setBusy(null); }
  }

  async function handleDelete(id) {
    setBusy(id);
    try {
      await deleteRescueRequest(id);
      await load();
    } finally { setBusy(null); }
  }

  const visible = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const counts  = {
    pending:    requests.filter((r) => r.status === "pending").length,
    dispatched: requests.filter((r) => r.status === "dispatched").length,
    resolved:   requests.filter((r) => r.status === "resolved").length,
  };

  return (
    <div className="rescue-panel">
      {/* Header */}
      <div className="rescue-panel-header">
        <div className="rescue-panel-title">
          🆘 Rescue Requests
          {requests.length > 0 && (
            <span className="rescue-count-badge">{requests.length}</span>
          )}
        </div>
        <button className="rescue-panel-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Filter tabs */}
      <div className="rescue-filter-tabs">
        {["all", "pending", "dispatched", "resolved"].map((f) => (
          <button
            key={f}
            className={`rescue-filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && counts[f] > 0 && (
              <span className={`rescue-tab-count ${f}`}>{counts[f]}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rescue-list">
        {loading ? (
          <div className="rescue-empty">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="rescue-empty">
            {filter === "all"
              ? "No rescue requests yet. Submit one from a village's detail panel."
              : `No ${filter} requests.`}
          </div>
        ) : (
          visible.map((req) => {
            const sev  = SEVERITY_COLOR[req.severity] || SEVERITY_COLOR.moderate;
            const stat = STATUS_META[req.status]      || STATUS_META.pending;
            const isBusy = busy === req.id;

            return (
              <div
                key={req.id}
                className="rescue-card"
                style={{ background: sev.bg, borderColor: sev.border }}
              >
                {/* Top row */}
                <div className="rescue-card-top">
                  <span className="rescue-card-village">{req.village_name}</span>
                  <span className={`rescue-status-badge ${stat.cls}`}>{stat.label}</span>
                </div>

                {/* Meta row */}
                <div className="rescue-card-meta">
                  <span style={{ color: sev.dot }}>
                    ● {req.severity.charAt(0).toUpperCase() + req.severity.slice(1)}
                  </span>
                  <span>👥 {req.people_count} {req.people_count === 1 ? "person" : "people"}</span>
                  <span>🕐 {timeAgo(req.timestamp)}</span>
                  {req.contact && <span>📞 {req.contact}</span>}
                </div>

                {/* Notes */}
                {req.notes && (
                  <div className="rescue-card-notes">"{req.notes}"</div>
                )}

                {/* Actions */}
                <div className="rescue-card-actions">
                  {req.status === "pending" && (
                    <button
                      className="rescue-action-btn dispatch"
                      disabled={isBusy}
                      onClick={() => handleStatus(req.id, "dispatched")}
                    >
                      🚁 Dispatch
                    </button>
                  )}
                  {req.status === "dispatched" && (
                    <button
                      className="rescue-action-btn resolve"
                      disabled={isBusy}
                      onClick={() => handleStatus(req.id, "resolved")}
                    >
                      ✅ Resolved
                    </button>
                  )}
                  {req.status === "pending" && (
                    <button
                      className="rescue-action-btn cancel"
                      disabled={isBusy}
                      onClick={() => handleDelete(req.id)}
                    >
                      Cancel
                    </button>
                  )}
                  {req.status === "resolved" && (
                    <button
                      className="rescue-action-btn remove"
                      disabled={isBusy}
                      onClick={() => handleDelete(req.id)}
                    >
                      🗑 Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
