import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

export const RISK_COLORS = {
  Low: "#2e7d32",
  Moderate: "#f9a825",
  High: "#ef6c00",
  Severe: "#c62828",
};

export async function fetchVillages() {
  const { data } = await client.get("/api/villages");
  return data;
}

export async function fetchVillage(id) {
  const { data } = await client.get(`/api/villages/${id}`);
  return data;
}

export async function fetchTrend(id) {
  const { data } = await client.get(`/api/villages/${id}/trend`);
  return data;
}

export async function fetchSensorReading(id) {
  const { data } = await client.get(`/api/villages/${id}/sensor`);
  return data;
}

export async function triggerStorm(id, intensity, durationMinutes = 10) {
  const { data } = await client.post(`/api/villages/${id}/simulate`, {
    intensity,
    duration_minutes: durationMinutes,
  });
  return data;
}

export async function clearStorm(id) {
  const { data } = await client.delete(`/api/villages/${id}/simulate`);
  return data;
}

export async function fetchReplay(eventId, villageId) {
  const { data } = await client.get(`/api/replay/${eventId}`, {
    params: villageId ? { village_id: villageId } : {},
  });
  return data;
}

export async function sendVillageAlert(id) {
  const { data } = await client.post(`/api/villages/${id}/alert`);
  return data;
}

