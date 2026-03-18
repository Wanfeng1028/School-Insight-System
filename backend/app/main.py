import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .mock_data import LOGS, OVERVIEW_DATA, TRACKS
from .schemas import ForgotPasswordPayload, LoginPayload, RegisterPayload, ResetPasswordPayload

app = FastAPI(title="School Insight System API", version="0.2.0")
ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / "uploads"
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SUFFIXES = {".mp4", ".avi", ".mov"}
MAX_UPLOAD_SIZE = 300 * 1024 * 1024
RESET_TOKEN_MINUTES = 15
SESSION_TOKENS: dict[str, dict] = {}
RESET_TOKENS: dict[str, dict] = {}
CAMERAS = [
    {"id": "camera_id: 1", "name": "北门通道"},
    {"id": "camera_id: 2", "name": "操场跑道"},
    {"id": "camera_id: 3", "name": "教学楼一层"},
    {"id": "camera_id: 4", "name": "沙池活动区"},
    {"id": "camera_id: 5", "name": "游乐区东侧"},
    {"id": "camera_id: 6", "name": "校车候车点"},
]

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
    "last_batch_size": 0,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_log(level: str, text: str):
    LOGS.append({"ts": now_iso(), "level": level, "text": text})


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, salt: str | None = None) -> str:
    local_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), local_salt.encode("utf-8"), 120000)
    return f"{local_salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split("$", 1)
    except ValueError:
        return False
    return hash_password(password, salt).split("$", 1)[1] == hashed


def load_users() -> list[dict]:
    if not USERS_FILE.exists():
        return []
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_users(users: list[dict]):
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


def ensure_seed_user():
    users = load_users()
    if users:
        return
    users.append(
        {
            "id": uuid4().hex,
            "name": "admin",
            "email": "admin@school.local",
            "role": "admin",
            "created_at": now_iso(),
            "password_hash": hash_password("Admin12345"),
        }
    )
    save_users(users)
    append_log("INFO", "Seed admin account created: admin@school.local")


def create_session(user: dict) -> dict:
    token = secrets.token_urlsafe(32)
    SESSION_TOKENS[token] = {"user_id": user["id"], "email": user["email"], "created_at": now_iso()}
    return {"token": token, "user": public_user(user)}


def get_user_by_email(email: str) -> dict | None:
    target = normalize_email(email)
    for user in load_users():
        if user["email"] == target:
            return user
    return None


def get_current_user(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    token = authorization.replace("Bearer ", "", 1).strip()
    session = SESSION_TOKENS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="invalid_token")
    user = get_user_by_email(session["email"])
    if not user:
        SESSION_TOKENS.pop(token, None)
        raise HTTPException(status_code=401, detail="invalid_token")
    return user


def require_auth(authorization: str | None) -> dict:
    return get_current_user(authorization)


def build_overview_payload():
    metric_cards = [card.model_dump() for card in OVERVIEW_DATA.metric_cards]
    metric_cards[0]["value"] = f"{12580 + STATE['bind_count'] * 120:,}"
    metric_cards[1]["value"] = str(18 + min(STATE["bind_count"], 7))
    metric_cards[1]["delta"] = "已绑定视频" if STATE["current_file"] else metric_cards[1]["delta"]
    metric_cards[2]["delta"] = f"+{2 + STATE['bind_count']} 高频区"
    return {
        "metric_cards": metric_cards,
        "trend_hours": OVERVIEW_DATA.trend_hours,
        "trend_values": [value + STATE["bind_count"] * 15 for value in OVERVIEW_DATA.trend_values],
        "zone_durations": [zone.model_dump() for zone in OVERVIEW_DATA.zone_durations],
    }


def json_report_bytes() -> bytes:
    report = {
        "generated_at": now_iso(),
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


def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="password_too_short")


def validate_upload(filename: str, size: int):
    suffix = Path(filename or "upload.bin").suffix.lower() or ".bin"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="unsupported_file_type")
    if size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="file_too_large")
    return suffix


async def store_upload(file: UploadFile, camera_id: str) -> dict:
    content = await file.read()
    suffix = validate_upload(file.filename or "upload.bin", len(content))
    safe_name = f"{uuid4().hex}{suffix}"
    target = UPLOAD_DIR / safe_name
    target.write_bytes(content)

    STATE["stream_active"] = True
    STATE["current_file"] = file.filename or safe_name
    STATE["camera_id"] = camera_id
    STATE["bind_count"] += 1

    append_log("INFO", f"Upload successfully: {STATE['current_file']} ({round(len(content) / 1024 / 1024, 2)}MB)")
    append_log("INFO", f"API Binding {camera_id} matched metadata")
    append_log("INFO", "Stream running. Analytics thread started.")

    return {
        "ok": True,
        "filename": file.filename or safe_name,
        "stored_as": safe_name,
        "size": len(content),
        "camera_id": camera_id,
    }


ensure_seed_user()


@app.post("/api/auth/register")
def register(payload: RegisterPayload):
    validate_password(payload.password)
    name = payload.name.strip()
    email = normalize_email(payload.email)
    if not name:
        raise HTTPException(status_code=400, detail="missing_name")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="invalid_email")
    users = load_users()
    if any(user["email"] == email for user in users):
        raise HTTPException(status_code=409, detail="email_exists")

    user = {
        "id": uuid4().hex,
        "name": name,
        "email": email,
        "role": "viewer",
        "created_at": now_iso(),
        "password_hash": hash_password(payload.password),
    }
    users.append(user)
    save_users(users)
    append_log("INFO", f"Account registered: {email}")
    return create_session(user)


@app.post("/api/auth/login")
def login(payload: LoginPayload):
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        append_log("WARN", f"Login failed for {normalize_email(payload.email)}")
        raise HTTPException(status_code=401, detail="invalid_credentials")
    append_log("INFO", f"Login success: {user['email']}")
    return create_session(user)


@app.get("/api/auth/me")
def me(authorization: str | None = Header(default=None)):
    user = require_auth(authorization)
    return {"user": public_user(user)}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1).strip()
        session = SESSION_TOKENS.pop(token, None)
        if session:
            append_log("INFO", f"Logout success: {session['email']}")
    return {"ok": True}


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload):
    email = normalize_email(payload.email)
    user = get_user_by_email(email)
    response = {"ok": True, "message": "如果账号存在，重置指令已生成。"}
    if not user:
        append_log("WARN", f"Forgot password requested for unknown account: {email}")
        return response
    token = secrets.token_urlsafe(8)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES)
    RESET_TOKENS[email] = {"token": token, "expires_at": expires_at}
    append_log("INFO", f"Password reset token issued for {email}")
    return {**response, "reset_token": token, "expires_in_minutes": RESET_TOKEN_MINUTES}


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordPayload):
    validate_password(payload.password)
    email = normalize_email(payload.email)
    user = get_user_by_email(email)
    token_data = RESET_TOKENS.get(email)
    if not user or not token_data:
        raise HTTPException(status_code=400, detail="invalid_reset_request")
    if token_data["token"] != payload.token:
        raise HTTPException(status_code=400, detail="invalid_reset_token")
    if token_data["expires_at"] < datetime.now(timezone.utc):
        RESET_TOKENS.pop(email, None)
        raise HTTPException(status_code=400, detail="reset_token_expired")

    users = load_users()
    for item in users:
        if item["email"] == email:
            item["password_hash"] = hash_password(payload.password)
            break
    save_users(users)
    RESET_TOKENS.pop(email, None)
    append_log("INFO", f"Password reset success: {email}")
    return {"ok": True, "message": "密码已更新，请重新登录。"}


@app.get("/health")
def health(authorization: str | None = Header(default=None)):
    user = require_auth(authorization)
    return {
        "status": "ok",
        "time": now_iso(),
        "api": STATE["api"],
        "redis": STATE["redis"],
        "ws": STATE["ws"],
        "stream_active": STATE["stream_active"],
        "camera_id": STATE["camera_id"],
        "current_file": STATE["current_file"],
        "user": public_user(user),
    }


@app.get("/api/cameras")
def cameras(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    return CAMERAS


@app.get("/api/overview")
def overview(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    return build_overview_payload()


@app.get("/api/logs")
def logs(level: str | None = None, authorization: str | None = Header(default=None)):
    require_auth(authorization)
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
def tracks(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    return [entry.model_dump() for entry in TRACKS]


@app.get("/api/report")
def export_report(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    filename = f"school-insight-report-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=json_report_bytes(), media_type="application/json; charset=utf-8", headers=headers)


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...), camera_id: str = Form("camera_id: 1"), authorization: str | None = Header(default=None)):
    require_auth(authorization)
    return await store_upload(file, camera_id)


@app.post("/api/upload-batch")
async def upload_batch(
    files: list[UploadFile] = File(...),
    camera_ids: str = Form("[]"),
    authorization: str | None = Header(default=None),
):
    user = require_auth(authorization)
    try:
        parsed_camera_ids = json.loads(camera_ids)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="invalid_camera_ids") from error
    if len(parsed_camera_ids) != len(files):
        raise HTTPException(status_code=400, detail="camera_ids_length_mismatch")

    results = []
    for file, camera_id in zip(files, parsed_camera_ids):
        results.append(await store_upload(file, camera_id))
    STATE["last_batch_size"] = len(results)
    append_log("INFO", f"Batch upload completed by {user['email']} with {len(results)} files")
    return {"ok": True, "count": len(results), "items": results}


@app.websocket("/ws/tracks")
async def tracks_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token or token not in SESSION_TOKENS:
        await websocket.close(code=4401)
        return

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
            await websocket.send_json({"type": "tracks", "items": payload, "ts": now_iso()})
            step += 1
            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()
