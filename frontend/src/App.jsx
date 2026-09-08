import { useEffect, useState, useCallback } from "react";
import MapView from "./components/MapView";
import VillageList from "./components/VillageList";
import VillageDetail from "./components/VillageDetail";
import ReplayView from "./components/ReplayView";
import { fetchVillages, fetchTrend } from "./api";

const POLL_MS = 60000;

export default function App() {
  const [mode, setMode] = useState("live");
  const [villages, setVillages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    // One retry with a short delay: a single dropped request (flaky
    // wifi, a cold backend restart) shouldn't surface as a hard error
    // during a live demo.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await fetchVillages();
        setVillages(data);
        setError(null);
        setSelectedId((prev) => prev ?? [...data].sort((a, b) => b.risk_score - a.risk_score)[0]?.id);
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
        return;
      } catch (e) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    setLoading(false);
    // Keep showing the last known-good data on a transient poll
    // failure; only block the whole view if we never loaded anything.
    if (villages.length === 0) {
      setError("Could not reach the prediction API. Is the backend running on port 8000?");
    }
  }, [villages.length]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Single shared trend fetch for the selected village, reused by both
  // VillageDetail's chart and the village-list accordion's "current /
  // forecast rainfall" line, so switching villages doesn't trigger two
  // independent requests for the same data.
  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setTrend(null);
      return;
    }
    let cancelled = false;
    setTrend(null);
    setTrendLoading(true);
    setTrendError(false);
    fetchTrend(selectedId)
      .then((data) => {
        if (!cancelled) {
          setTrend(data);
          setTrendLoading(false);
          // The endpoint can return 200 with an empty series when
          // Open-Meteo itself was unreachable/slow -- surface that as
          // "unavailable" too, not just a network-level fetch failure.
          setTrendError(data.available === false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrendLoading(false);
          setTrendError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedVillage = villages.find((v) => v.id === selectedId) || null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Flash Flood Early Warning</h1>
          <div className="subtitle">Wayanad District, Kerala — hyper-local risk from live rainfall, soil moisture & terrain data</div>
        </div>
        <div className="mode-toggle">
          <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>
            Live Dashboard
          </button>
          <button className={mode === "replay" ? "active" : ""} onClick={() => setMode("replay")}>
            Replay: Wayanad 2024
          </button>
        </div>
      </header>

      {mode === "replay" ? (
        <ReplayView />
      ) : loading ? (
        <div className="loading">Loading live conditions from Open-Meteo…</div>
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : (
        <div className="app-body">
          <VillageList
            villages={villages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            trend={trend}
            trendLoading={trendLoading}
            trendError={trendError}
            lastUpdated={lastUpdated}
          />
          <div className="map-pane">
            <MapView villages={villages} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <VillageDetail village={selectedVillage} onRefresh={refresh} trend={trend} />
        </div>
      )}
    </div>
  );
}
