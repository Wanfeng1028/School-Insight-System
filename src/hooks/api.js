const API_BASE = "http://127.0.0.1:8000";

async function requestJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export function fetchHealth() {
  return requestJson("/health");
}

export function fetchOverview() {
  return requestJson("/api/overview");
}

export function fetchLogs(level = "ALL") {
  const query = level && level !== "ALL" ? `?level=${encodeURIComponent(level)}` : "";
  return requestJson(`/api/logs${query}`);
}
