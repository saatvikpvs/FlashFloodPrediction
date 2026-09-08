import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  Polyline,
  Marker,
  Tooltip,
} from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import { RISK_COLORS } from "../api";
import { EVACUATION_BY_VILLAGE } from "../data/evacuationRoutes";
import { fetchOrsRoute } from "../utils/orsRouting";

const WAYANAD_CENTER = [11.63, 76.13];

// ── Tile layers ────────────────────────────────────────────────────────────────
const MAP_LAYERS = {
  street: {
    label: "🗺️ Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: "🛰️ Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  terrain: {
    label: "⛰️ Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
  },
};

const LAYER_ORDER = ["street", "satellite", "terrain"];

// Danger levels that should be avoided in route planning
const AVOID_RISK_LEVELS = new Set(["High", "Severe"]);

// ── Custom map icons ───────────────────────────────────────────────────────────
const shelterIcon = L.divIcon({
  className: "",
  html: `<div class="shelter-marker">🏥</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const blockedIcon = L.divIcon({
  className: "",
  html: `<div class="shelter-marker">⛔</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const sosIcon = L.divIcon({
  className: "",
  html: `<div class="rescue-map-marker sos">🆘</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20],
});

const helicopterIcon = L.divIcon({
  className: "",
  html: `<div class="rescue-map-marker dispatched">🚁</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20],
});

// ── FlyTo helper ──────────────────────────────────────────────────────────────
function FlyToVillage({ village }) {
  const map = useMap();
  useEffect(() => {
    if (village) map.flyTo([village.lat, village.lon], 13, { duration: 0.6 });
  }, [village, map]);
  return null;
}

// ── Route colour based on status ──────────────────────────────────────────────
function routeColor(status) {
  if (status === "blocked") return "#ef4444";
  if (status === "rerouted") return "#f97316";
  if (status === "live") return "#22c55e";
  return "#93a1bd"; // fallback / loading
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapView({ villages, selectedId, onSelect, refreshKey, rescueRequests = [] }) {
  const selected = villages.find((v) => v.id === selectedId);
  const [layerKey, setLayerKey] = useState("street");
  const [showRoutes, setShowRoutes] = useState(false);

  // routeCache: { [villageId]: { coords, blocked, status, loading } }
  const [routeCache, setRouteCache] = useState({});
  const abortRef = useRef({});

  // ── Compute which villages to route for ────────────────────────────────────
  const routeVillageIds = showRoutes
    ? selectedId && EVACUATION_BY_VILLAGE[selectedId]
      ? [selectedId]
      : Object.keys(EVACUATION_BY_VILLAGE)
    : [];

  // ── High/Severe villages used as avoid-zones ───────────────────────────────
  const dangerVillages = villages
    .filter((v) => AVOID_RISK_LEVELS.has(v.risk_level))
    .map((v) => ({ lat: v.lat, lon: v.lon, id: v.id }));

  // ── Fingerprint that changes whenever any village risk score changes ────────
  // Tracks id+score+level for every village so simulation changes are detected
  const riskFingerprint = villages
    .map((v) => `${v.id}:${v.risk_level}:${Math.round(v.risk_score)}`)
    .sort()
    .join("|");

  // ── Fetch ORS routes whenever routes panel opens or risk data changes ──────
  useEffect(() => {
    if (routeVillageIds.length === 0) return;

    // Clear the cache first so old routes don't persist while re-fetching
    setRouteCache((prev) => {
      const cleared = { ...prev };
      routeVillageIds.forEach((vid) => {
        cleared[vid] = { ...(cleared[vid] || {}), loading: true, coords: null };
      });
      return cleared;
    });

    routeVillageIds.forEach(async (vid) => {
      const routeDef = EVACUATION_BY_VILLAGE[vid];
      if (!routeDef) return;

      const village = villages.find((v) => v.id === vid);
      if (!village) return;

      // Cancel any in-flight request for this village
      if (abortRef.current[vid]) abortRef.current[vid] = false;
      const ticket = {};
      abortRef.current[vid] = ticket;

      // Avoid all danger villages EXCEPT the origin itself
      const avoidList = dangerVillages.filter((dv) => dv.id !== vid);

      const { coords, blocked, error } = await fetchOrsRoute(
        [village.lat, village.lon],
        [routeDef.shelter.lat, routeDef.shelter.lon],
        avoidList
      );

      if (abortRef.current[vid] !== ticket) return; // stale — discard

      const wasRerouted = avoidList.length > 0 && !blocked;
      const status = blocked
        ? "blocked"
        : wasRerouted
        ? "rerouted"
        : error === "no_key"
        ? "fallback"
        : "live";

      setRouteCache((prev) => ({
        ...prev,
        [vid]: {
          coords: coords || routeDef.fallbackWaypoints,
          blocked,
          status,
          loading: false,
          error,
        },
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoutes, selectedId, riskFingerprint, refreshKey]);

  // ── Tile layer cycling ─────────────────────────────────────────────────────
  const cycleLayer = () => {
    const idx = LAYER_ORDER.indexOf(layerKey);
    setLayerKey(LAYER_ORDER[(idx + 1) % LAYER_ORDER.length]);
  };
  const layer = MAP_LAYERS[layerKey];
  const nextKey = LAYER_ORDER[(LAYER_ORDER.indexOf(layerKey) + 1) % LAYER_ORDER.length];
  const nextLabel = MAP_LAYERS[nextKey].label;

  // ── Routes to draw on map ──────────────────────────────────────────────────
  const routesToDraw = routeVillageIds
    .map((vid) => ({ vid, routeDef: EVACUATION_BY_VILLAGE[vid], cached: routeCache[vid] }))
    .filter(({ routeDef }) => !!routeDef);

  // Deduplicated shelter markers
  const sheltersSeen = new Set();
  const shelterMarkers = routesToDraw.filter(({ routeDef, cached }) => {
    const key = `${routeDef.shelter.lat},${routeDef.shelter.lon}`;
    if (sheltersSeen.has(key)) return false;
    sheltersSeen.add(key);
    return true;
  });

  const anyBlocked = routesToDraw.some(({ cached }) => cached?.blocked);
  const anyRerouted = routesToDraw.some(({ cached }) => cached?.status === "rerouted");
  const anyLoading = routesToDraw.some(({ cached }) => !cached || cached.loading);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={WAYANAD_CENTER}
        zoom={11}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer key={layerKey} attribution={layer.attribution} url={layer.url} />

        {/* ── Evacuation route polylines ── */}
        {routesToDraw.map(({ vid, routeDef, cached }) => {
          // While actively re-fetching, don't show stale or fallback lines —
          // the "computing…" banner makes it clear something is happening.
          if (cached?.loading && !cached?.coords) return null;

          const useFallback = !cached?.coords;
          const coords = cached?.coords || routeDef.fallbackWaypoints;
          const status = useFallback ? "fallback" : (cached?.status || "fallback");
          const color = routeColor(status);
          return (
            <Polyline
              key={vid}
              positions={coords}
              pathOptions={{
                color,
                weight: cached?.status === "live" || cached?.status === "rerouted" ? 5 : 3.5,
                opacity: 0.9,
                dashArray: cached?.blocked ? "6 4" : cached?.status === "live" ? "none" : "10 6",
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Popup>
                <strong>
                  {cached?.blocked
                    ? "⛔ Route Blocked"
                    : cached?.status === "rerouted"
                    ? "🔄 Re-routed (avoiding hazards)"
                    : cached?.status === "live"
                    ? "✅ Live Evacuation Route"
                    : "📍 Evacuation Route (static)"}
                </strong>
                <br />
                <span style={{ color: "#555" }}>
                  {villages.find((v) => v.id === vid)?.name ?? vid}
                </span>
                <br />
                <b>→ {routeDef.shelter.name}</b>
                <br />
                {cached?.blocked ? (
                  <span style={{ color: "#c00", fontSize: "12px" }}>
                    ⚠️ No safe road found avoiding current hazard zones. Await official guidance.
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "#888" }}>{routeDef.notes}</span>
                )}
              </Popup>
            </Polyline>
          );
        })}

        {/* ── Shelter markers ── */}
        {shelterMarkers.map(({ routeDef, cached }) => {
          const isBlocked = cached?.blocked;
          return (
            <Marker
              key={`shelter-${routeDef.shelter.lat}-${routeDef.shelter.lon}`}
              position={[routeDef.shelter.lat, routeDef.shelter.lon]}
              icon={isBlocked ? blockedIcon : shelterIcon}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                {isBlocked ? "⛔ Shelter unreachable" : `🏥 ${routeDef.shelter.name}`}
              </Tooltip>
              <Popup>
                <strong>{isBlocked ? "⛔ Shelter Blocked" : "🏥 Evacuation Shelter"}</strong>
                <br />
                {routeDef.shelter.name}
                {isBlocked && (
                  <>
                    <br />
                    <span style={{ color: "#c00", fontSize: "11px" }}>
                      Route to this shelter could not avoid all hazard zones.
                    </span>
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}

        {/* ── Rescue SOS / helicopter pins ── */}
        {rescueRequests
          .filter((r) => r.status === "pending" || r.status === "dispatched")
          .map((req) => (
            <Marker
              key={req.id}
              position={[req.lat, req.lon]}
              icon={req.status === "dispatched" ? helicopterIcon : sosIcon}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                {req.status === "dispatched" ? "🚁 Rescue dispatched" : "🆘 Rescue needed"} — {req.village_name}
              </Tooltip>
              <Popup>
                <strong>{req.status === "dispatched" ? "🚁 Rescue Dispatched" : "🆘 Rescue Needed"}</strong>
                <br />
                <b>{req.village_name}</b><br />
                Severity: <b style={{textTransform:"capitalize"}}>{req.severity}</b>
                {" · "}👥 {req.people_count} {req.people_count === 1 ? "person" : "people"}
                {req.notes && <><br /><span style={{fontSize:"11px",color:"#888"}}>"{req.notes}"</span></>}
                {req.contact && <><br />📞 {req.contact}</>}
              </Popup>
            </Marker>
          ))}

        {/* ── Village markers ── */}
        {villages.map((v) => {
          const color = RISK_COLORS[v.risk_level] || "#666";
          const isSelected = v.id === selectedId;
          return (
            <CircleMarker
              key={v.id}
              center={[v.lat, v.lon]}
              radius={isSelected ? 16 : 11}
              pathOptions={{
                color: isSelected ? "#ffffff" : color,
                weight: isSelected ? 3 : 1.5,
                fillColor: color,
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelect(v.id) }}
            >
              <Popup>
                <strong>{v.name}</strong>
                <br />
                {v.risk_level} risk ({v.risk_score.toFixed(0)}/100)
                <br />
                {v.rain_24h_mm}mm rain (24h)
              </Popup>
            </CircleMarker>
          );
        })}

        <FlyToVillage village={selected} />
      </MapContainer>

      {/* ── Route status banner ── */}
      {showRoutes && (anyBlocked || anyRerouted || anyLoading) && (
        <div
          className={`route-status-banner ${
            anyBlocked ? "banner-blocked" : anyRerouted ? "banner-rerouted" : "banner-loading"
          }`}
        >
          {anyLoading && !anyBlocked && !anyRerouted
            ? "⏳ Computing live evacuation routes…"
            : anyBlocked
            ? "⛔ One or more routes blocked by hazard zones — await official guidance"
            : "🔄 Routes re-calculated to avoid current High/Severe risk areas"}
        </div>
      )}

      {/* ── Legend (shown when routes visible) ── */}
      {showRoutes && !anyLoading && (
        <div className="route-legend">
          <div className="route-legend-item">
            <span className="route-legend-line" style={{ background: "#22c55e" }} />
            Live safe route
          </div>
          <div className="route-legend-item">
            <span
              className="route-legend-line"
              style={{ background: "#f97316", borderStyle: "dashed" }}
            />
            Re-routed (avoids hazards)
          </div>
          <div className="route-legend-item">
            <span
              className="route-legend-line"
              style={{ background: "#ef4444", borderStyle: "dashed" }}
            />
            Blocked — no safe road
          </div>
        </div>
      )}

      {/* ── Map layer toggle ── */}
      <button
        className="map-layer-toggle"
        onClick={cycleLayer}
        title={`Switch to ${nextLabel}`}
        aria-label="Toggle map layer"
      >
        <span className="map-layer-toggle-icon">{MAP_LAYERS[layerKey].label.split(" ")[0]}</span>
        <span className="map-layer-toggle-text">
          {MAP_LAYERS[layerKey].label.split(" ").slice(1).join(" ")}
        </span>
        <span className="map-layer-toggle-next">→ {nextLabel}</span>
      </button>

      {/* ── Evacuation routes toggle ── */}
      <button
        className={`evacuation-toggle ${showRoutes ? "active" : ""}`}
        onClick={() => setShowRoutes((v) => !v)}
        aria-label="Toggle evacuation routes"
      >
        <span className="evacuation-toggle-icon">🚨</span>
        <span className="evacuation-toggle-text">
          {showRoutes ? "Hide Routes" : "Evacuation Routes"}
        </span>
        {showRoutes && anyLoading && (
          <span className="evacuation-toggle-badge loading">…</span>
        )}
        {showRoutes && !anyLoading && (
          <span className={`evacuation-toggle-badge ${anyBlocked ? "blocked" : ""}`}>
            {anyBlocked ? "⛔" : "ON"}
          </span>
        )}
      </button>
    </div>
  );
}
