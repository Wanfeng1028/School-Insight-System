import asyncio
import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .mock_data import LOGS, OVERVIEW_DATA, TRACKS

app = FastAPI(title="School Insight System API", version="0.1.0")
ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SUFFIXES = {".mp4", ".avi", ".mov"}
MAX_UPLOAD_SIZE = 300 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE = {
    "api": True,
    "redis": True,
    "ws": True,
    "stream_active": False,
    "camera_id": "camera_id: 1",
    "current_file": None,
    "bind_count": 0,
}


def append_log(level: str, text: str):
    LOGS.append({"ts": datetime.utcnow().isoformat() + "Z", "level": level, "text": text})


def build_overview_payload():
    metric_cards = [card.model_dump() for card in OVERVIEW_DATA.metric_cards]
    metric_cards[0]["value"] = f"{12580 + STATE['bind_count'] * 120:,}"
    metric_cards[1]["delta"] = "\u5df2\u7ed1\u5b9a\u89c6\u9891" if STATE["current_file"] else metric_cards[1]["delta"]
    metric_cards[2]["delta"] = f"+{2 + STATE['bind_count']} \u9ad8\u9891\u533a"
    return {
        "metric_cards": metric_cards,
        "trend_hours": OVERVIEW_DATA.trend_hours,
        "trend_values": OVERVIEW_DATA.trend_values,
        "zone_durations": [zone.model_dump() for zone in OVERVIEW_DATA.zone_durations],
    }


def json_report_bytes() -> bytes:
    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "health": {
            "api": STATE["api"],
            "redis": STATE["redis"],
            "ws": STATE["ws"],
            "stream_active": STATE["stream_active"],
            "camera_id": STATE["camera_id"],
            "current_file": STATE["current_file"],
        },
        "overview": build_overview_payload(),
        "recent_logs": [entry if isinstance(entry, dict) else entry.model_dump(mode="json") for entry in LOGS[-30:]],
    }
    return json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat() + "Z",
        "api": STATE["api"],
        "redis": STATE["redis"],
        "ws": STATE["ws"],
        "stream_active": STATE["stream_active"],
        "camera_id": STATE["camera_id"],
        "current_file": STATE["current_file"],
    }


@app.get("/api/overview")
def overview():
    return build_overview_payload()


@app.get("/api/logs")
def logs(level: str | None = None):
    entries = LOGS
    if level and level != "ALL":
        entries = [entry for entry in entries if (entry["level"] if isinstance(entry, dict) else entry.level) == level]
    result = []
    for entry in entries:
        if isinstance(entry, dict):
            result.append(entry)
        else:
            result.append(entry.model_dump(mode="json"))
    return result[-120:]


@app.get("/api/tracks")
def tracks():
    return [entry.model_dump() for entry in TRACKS]


@app.get("/api/report")
def export_report():
    filename = f"school-insight-report-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=json_report_bytes(), media_type="application/json; charset=utf-8", headers=headers)


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    suffix = Path(file.filename or "upload.bin").suffix.lower() or ".bin"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="unsupported_file_type")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="file_too_large")

    safe_name = f"{uuid4().hex}{suffix}"
    target = UPLOAD_DIR / safe_name
    target.write_bytes(content)

    STATE["stream_active"] = True
    STATE["current_file"] = file.filename or safe_name
    STATE["bind_count"] += 1

    append_log("INFO", f"Upload successfully: {STATE['current_file']} ({round(len(content) / 1024 / 1024, 2)}MB)")
    append_log("INFO", f"API Binding {STATE['camera_id']} matched metadata")
    append_log("INFO", "Stream running. Analytics thread started.")

    return {
        "ok": True,
        "filename": STATE["current_file"],
        "stored_as": safe_name,
        "size": len(content),
        "camera_id": STATE["camera_id"],
    }


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
