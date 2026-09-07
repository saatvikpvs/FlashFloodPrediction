import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import { RISK_COLORS } from "../api";

const WAYANAD_CENTER = [11.63, 76.13];

function FlyToVillage({ village }) {
  const map = useMap();
  useEffect(() => {
    if (village) {
      map.flyTo([village.lat, village.lon], 13, { duration: 0.6 });
    }
  }, [village, map]);
  return null;
}

export default function MapView({ villages, selectedId, onSelect }) {
  const selected = villages.find((v) => v.id === selectedId);

  return (
    <MapContainer center={WAYANAD_CENTER} zoom={11} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
  );
}
