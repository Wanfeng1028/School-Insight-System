const DEFAULT_API_BASE = `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname || "127.0.0.1"}:8000`;
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

function getHeaders(token, extra = {}) {
  const headers = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error("network_error");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function login(payload) {
  return requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function register(payload) {
  return requestJson("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(payload) {
  return requestJson("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload) {
  return requestJson("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(token) {
  return requestJson("/api/auth/me", {
    headers: getHeaders(token),
  });
}

export async function logout(token) {
  return requestJson("/api/auth/logout", {
    method: "POST",
    headers: getHeaders(token),
  });
}

export function fetchHealth(token) {
  return requestJson("/health", {
    headers: getHeaders(token),
  });
}

export function fetchOverview(token) {
  return requestJson("/api/overview", {
    headers: getHeaders(token),
  });
}

export function fetchLogs(token, level = "ALL") {
  const query = level && level !== "ALL" ? `?level=${encodeURIComponent(level)}` : "";
  return requestJson(`/api/logs${query}`, {
    headers: getHeaders(token),
  });
}

export function fetchCameras(token) {
  return requestJson("/api/cameras", {
    headers: getHeaders(token),
  });
}

export function runTrackingAnalysis(token, filename = null) {
  return requestJson("/api/analysis/run", {
    method: "POST",
    headers: getHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ filename }),
  });
}

export async function downloadReport(token) {
  const response = await fetch(`${API_BASE}/api/report`, {
    headers: getHeaders(token),
  });
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

export function uploadVideo(file, cameraId, token) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("camera_id", cameraId);
  return requestJson("/api/upload", {
    method: "POST",
    headers: getHeaders(token),
    body: formData,
  });
}

export function uploadBatch(entries, token) {
  const formData = new FormData();
  entries.forEach((entry) => {
    formData.append("files", entry.file);
  });
  formData.append("camera_ids", JSON.stringify(entries.map((entry) => entry.cameraId)));
  return requestJson("/api/upload-batch", {
    method: "POST",
    headers: getHeaders(token),
    body: formData,
  });
}

export { API_BASE };


