import asyncio
from datetime import datetime

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .mock_data import LOGS, OVERVIEW_DATA, TRACKS

app = FastAPI(title="School Insight System API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat() + "Z",
        "api": True,
        "redis": True,
        "ws": True,
    }


@app.get("/api/overview")
def overview():
    return OVERVIEW_DATA.model_dump()


@app.get("/api/logs")
def logs(level: str | None = None):
    if level and level != "ALL":
        return [entry.model_dump(mode="json") for entry in LOGS if entry.level == level]
    return [entry.model_dump(mode="json") for entry in LOGS]


@app.get("/api/tracks")
def tracks():
    return [entry.model_dump() for entry in TRACKS]


@app.websocket("/ws/tracks")
async def tracks_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        step = 0
        while True:
            payload = []
            for track in TRACKS:
                shifted = []
                for idx, point in enumerate(track.points):
                    dx = (step % 12) * 1.4
                    dy = ((step + idx) % 8) * 0.9
                    shifted.append([point[0] + dx, point[1] + dy])
                payload.append({**track.model_dump(), "points": shifted})
            await websocket.send_json({"type": "tracks", "items": payload, "ts": datetime.utcnow().isoformat() + "Z"})
            step += 1
            await asyncio.sleep(0.8)
    except Exception:
        await websocket.close()
