const API_BASE = "http://127.0.0.1:8000";

async function requestJson(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function downloadReport() {
  const response = await fetch(`${API_BASE}/api/report`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("Content-Disposition") || "";
  const matched = disposition.match(/filename="?([^";]+)"?/i);
  link.href = url;
  link.download = matched?.[1] || "school-insight-report.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

export function uploadVideo(file) {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson("/api/upload", {
    method: "POST",
    body: formData,
  });
}
