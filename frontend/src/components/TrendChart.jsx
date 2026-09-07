import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Live-dashboard timestamps come from the backend as naive UTC ISO
// strings ("2026-09-06T14:00"); replay timestamps come back already
// in local Kerala time (Open-Meteo's historical API was queried with
// timezone=auto for that village). Converting both the same way would
// double-shift one of them, so the caller says which it's passing.
function formatTick(iso, timeMode) {
  if (timeMode === "utc") {
    const d = new Date(iso + "Z");
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
    });
  }
  // "local": iso is already the wall-clock time to display -- format
  // via string parts only, no Date/timezone reinterpretation.
  const [datePart, timePart] = iso.split("T");
  const [, month, day] = datePart.split("-");
  return `${day} ${MONTHS[parseInt(month, 10) - 1]}, ${timePart}`;
}

export default function TrendChart({ points, nowIndex, referenceLabel, timeMode = "utc" }) {
  const data = points.map((p, i) => ({
    ...p,
    idx: i,
    label: formatTick(p.time, timeMode),
  }));
  const hasRisk = data.length > 0 && data[0].risk_score !== undefined;

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#2a3752" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#93a1bd", fontSize: 10 }}
            interval={Math.ceil(data.length / 6)}
          />
          <YAxis yAxisId="rain" tick={{ fill: "#93a1bd", fontSize: 10 }} />
          <YAxis
            yAxisId="soil"
            orientation="right"
            domain={[0, hasRisk ? 100 : 0.6]}
            tick={{ fill: "#93a1bd", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: "#141d31", border: "1px solid #2a3752", fontSize: 12 }}
            labelStyle={{ color: "#e7ecf5" }}
          />
          <defs>
            <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Bar
            yAxisId="rain"
            dataKey="precipitation_mm"
            fill="#3b82f6"
            name="Rain (mm)"
            barSize={4}
            isAnimationActive={false}
          />
          {/* Recharts silently drops children wrapped in a <>Fragment</>,
              so each conditional series/reference-line below is a
              single top-level element (or a plain array from .map),
              never grouped inside one. */}
          {hasRisk && [25, 50, 75].map((band) => (
            <ReferenceLine key={band} yAxisId="soil" y={band} stroke="#465372" strokeDasharray="2 4" />
          ))}
          {hasRisk && (
            <Area
              yAxisId="soil"
              dataKey="risk_score"
              stroke="#ef4444"
              fill="url(#riskFill)"
              dot={false}
              name="Risk score (/100)"
              strokeWidth={3}
              isAnimationActive={false}
            />
          )}
          {!hasRisk && (
            <Line
              yAxisId="soil"
              dataKey="soil_moisture_m3m3"
              stroke="#f9a825"
              dot={false}
              name="Soil moisture (m³/m³)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          )}
          {typeof nowIndex === "number" && (
            <ReferenceLine
              yAxisId="rain"
              x={data[nowIndex]?.label}
              stroke="#e7ecf5"
              strokeDasharray="4 4"
              label={{ value: referenceLabel || "Now", fill: "#e7ecf5", fontSize: 10, position: "top" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
