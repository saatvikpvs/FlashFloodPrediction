import { useState } from "react";
import RiskBadge from "./RiskBadge";
import { sendVillageAlert } from "../api";
import { playAlertSound } from "../utils/audio";

export default function ScorePanel({ village }) {
  const [sending, setSending] = useState(false);
  const [statusNotification, setStatusNotification] = useState(null);

  if (!village) return null;

  // Show the alert button for the entire "Severe" band (score ≥ 75).
  // The backend enforces its own > 90 hard gate and returns a descriptive
  // 400 error if the score hasn't crossed it yet — displayed in the toast.
  const isSevere = village.risk_level === "Severe";
  const canSendAlert = Boolean(village.has_alert_contacts && isSevere);

  async function handleSendAlert() {
    if (sending || !canSendAlert) return;

    // 1. Play immediate audible alert beep (works on mobile inside click handler)
    playAlertSound();

    setSending(true);
    setStatusNotification(null);

    try {
      const response = await sendVillageAlert(village.id);
      const recipientCount = response.recipients?.length || village.alert_contacts_count || 3;

      if (response.success && !response.mock) {
        const reqNote = response.fast2sms_request_id ? ` [Req ID: ${response.fast2sms_request_id}]` : "";
        setStatusNotification({
          type: "success",
          message: `SMS alert delivered via Fast2SMS to ${recipientCount} phone number${recipientCount === 1 ? "" : "s"}!${reqNote}`,
        });
      } else if (response.mock) {
        setStatusNotification({
          type: "error",
          message: `Mock Mode: ${response.message}. Server didn't find the real API key on start. Restart backend to load .env!`,
        });
      } else {
        setStatusNotification({
          type: "error",
          message: `Fast2SMS rejected send: ${response.message || "Unknown error"}`,
        });
      }
    } catch (err) {
      console.error("Alert dispatch failed:", err);
      const errMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to send alert via Fast2SMS";
      setStatusNotification({
        type: "error",
        message: `Alert failed: ${errMsg}`,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`score-panel ${isSevere ? "severe-alert-active" : ""}`}>
      <div className="score-panel-top">
        <div className="score-panel-title">
          <span className="village-name">{village.name}</span>
          <span className="village-region">
            {village.district}, {village.state}
          </span>
        </div>
        <div className="score-panel-badge-group">
          <span className="score-panel-number">{village.risk_score.toFixed(0)}</span>
          <RiskBadge level={village.risk_level} />
        </div>
      </div>

      {canSendAlert && (
        <div className="score-panel-alert-action">
          <button
            className={`send-alert-btn ${sending ? "busy" : ""}`}
            onClick={handleSendAlert}
            disabled={sending}
            title="Dispatch emergency SMS via Fast2SMS to registered phones"
          >
            <span className="alert-siren-icon">🚨</span>
            <span className="alert-btn-text">
              {sending ? "Sending SMS…" : "SEND ALERT"}
            </span>
          </button>
          <div className="alert-subtext">
            Severe risk detected. SMS dispatch via Fast2SMS
            {village.risk_score >= 91 ? " ready." : " — crosses send threshold at score > 90."}
          </div>
        </div>
      )}

      {statusNotification && (
        <div
          className={`score-panel-toast toast-${statusNotification.type}`}
          role="alert"
        >
          <span>{statusNotification.message}</span>
          <button
            className="toast-close"
            onClick={() => setStatusNotification(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
