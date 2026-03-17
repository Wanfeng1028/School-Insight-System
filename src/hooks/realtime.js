export function normalizeTrackPayload(items) {
  return items.map((item) => ({
    id: item.id,
    color: item.color,
    label: item.label,
    points: item.points,
  }));
}

export function connectTrackStream({ onMessage, onError }) {
  const socket = new WebSocket("ws://127.0.0.1:8000/ws/tracks");

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
