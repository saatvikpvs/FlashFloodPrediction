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

// Identical formatting logic to before — date + time — unchanged
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
  const [datePart, timePart] = iso.split("T");
  const [, month, day] = datePart.split("-");
  return `${day} ${MONTHS[parseInt(month, 10) - 1]}, ${timePart}`;
}

// Custom label component so "Now" / "Landslide" is always visible
// regardless of what's behind it on the chart
function RefLabel({ viewBox, text }) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const width = text.length * 6.5 + 10;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y + 4}
        width={width}
        height={17}
        rx={3}
        fill="#1b2740"
        stroke="#e7ecf5"
        strokeWidth={0.8}
      />
      <text
        x={x}
        y={y + 16}
        textAnchor="middle"
        fill="#e7ecf5"
        fontSize={10}
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  );
}

export default function TrendChart({ points, nowIndex, referenceLabel, timeMode = "utc" }) {
  const data = points.map((p, i) => ({
    ...p,
    idx: i,
    label: formatTick(p.time, timeMode),
  }));
  const hasRisk = data.length > 0 && data[0].risk_score !== undefined;

  // Limit ticks to max 6 so they don't overlap, angle them so text fits
  const tickInterval = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 44 }}>
          <CartesianGrid stroke="#2a3752" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#93a1bd", fontSize: 10 }}
            interval={tickInterval}
            angle={-40}
            textAnchor="end"
            height={56}
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
              label={<RefLabel text={referenceLabel || "Now"} />}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
