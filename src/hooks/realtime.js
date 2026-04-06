const DEFAULT_API_BASE = `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname || "127.0.0.1"}:8000`;
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

function getWebSocketBase(apiBase) {
  const url = new URL(apiBase);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

export function normalizeTrackPayload(items) {
  return items.map((item) => ({
    id: item.id,
    color: item.color,
    label: item.label,
    points: item.points,
  }));
}

export function connectTrackStream({ token, onMessage, onError }) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const socket = new WebSocket(`${getWebSocketBase(API_BASE)}/ws/tracks${query}`);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "tracks") {
        onMessage(normalizeTrackPayload(payload.items));
      }
    } catch (error) {
      onError?.(error);
    }
  };

  socket.onerror = (error) => {
    onError?.(error);
  };

  return socket;
}


export function connectCameraInferenceStream({ cameraId, token, onMessage, onError }) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const path = `/ws/cameras/${encodeURIComponent(cameraId)}/inference${query}`;
  const socket = new WebSocket(`${getWebSocketBase(API_BASE)}${path}`);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "inference") {
        onMessage(payload);
      }
    } catch (error) {
      onError?.(error);
    }
  };

  socket.onerror = (error) => {
    onError?.(error);
  };

  return socket;
}
