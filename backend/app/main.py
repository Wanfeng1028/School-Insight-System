import asyncio
import hashlib
import json
import math
import re
import secrets
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from .analytics import analyze_video_tracks
from .mock_data import OVERVIEW_DATA, TRACKS
from .schemas import AnalysisPayload, ForgotPasswordPayload, LoginPayload, RegisterPayload, ResetPasswordPayload, TrackFrame

app = FastAPI(title="School Insight System API", version="0.3.0")
ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / "uploads"
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"
LOG_FILE = DATA_DIR / "events.jsonl"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SUFFIXES = {".mp4", ".avi", ".mov"}
MAX_UPLOAD_SIZE = 300 * 1024 * 1024
RESET_CODE_MINUTES = 15
SESSION_EXPIRE_HOURS = 24
MAX_LOG_ENTRIES = 1000
EMAIL_PATTERN = re.compile(r"\b([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
EXCLUDED_REQUEST_LOG_PATHS = {"/api/logs"}
SESSION_TOKENS: dict[str, dict] = {}
RESET_CODES: dict[str, dict] = {}
UPLOADED_VIDEOS: list[dict] = []
LOGS: deque[dict] = deque(maxlen=MAX_LOG_ENTRIES)
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE = {
    "api": True,
    "redis": False,
    "ws": True,
    "stream_active": False,
    "camera_id": "camera_id: 1",
    "current_file": None,
    "current_file_path": None,
    "current_stored_as": None,
    "bind_count": 0,
    "last_batch_size": 0,
    "analysis_active": False,
    "analysis_model": "待命",
    "tracked_targets": 0,
    "frames_processed": 0,
    "avg_confidence": 0.0,
    "alert_count": 3,
    "last_analysis_file": None,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_log_text(text: str) -> str:
    return EMAIL_PATTERN.sub(lambda match: f"{match.group(1)}***{match.group(3)}", text)


def normalize_log_level(level: str) -> str:
    value = (level or "INFO").upper()
    return value if value in {"DEBUG", "INFO", "WARN", "ERROR"} else "INFO"


def sanitize_log_value(value):
    if isinstance(value, str):
        return sanitize_log_text(value)
    if isinstance(value, dict):
        return {str(key): sanitize_log_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_log_value(item) for item in value]
    return value


def normalize_log_context(context: dict | None) -> dict:
    if not context:
        return {}
    normalized = {}
    for key, value in context.items():
        if value is None:
            continue
        normalized[str(key)] = sanitize_log_value(value)
    return normalized


def load_logs_from_disk():
    if not LOG_FILE.exists():
        return
    try:
        with LOG_FILE.open("r", encoding="utf-8") as handle:
            for line in deque(handle, maxlen=MAX_LOG_ENTRIES):
                raw = line.strip()
                if not raw:
                    continue
                try:
                    item = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(item, dict):
                    continue
                ts = item.get("ts")
                level = item.get("level")
                text = item.get("text")
                if not isinstance(ts, str) or not isinstance(level, str) or not isinstance(text, str):
                    continue
                entry = {
                    "ts": ts,
                    "level": normalize_log_level(level),
                    "text": text,
                    "source": item.get("source") or "app",
                    "context": item.get("context") if isinstance(item.get("context"), dict) else {},
                }
                LOGS.append(entry)
    except OSError:
        return


def append_log(level: str, text: str, source: str = "app", context: dict | None = None) -> dict:
    entry = {
        "ts": now_iso(),
        "level": normalize_log_level(level),
        "text": sanitize_log_text(text),
        "source": source,
        "context": normalize_log_context(context),
    }
    LOGS.append(entry)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass
    return entry


def parse_entry_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def query_logs(
    level: str | None = None,
    search: str | None = None,
    source: str | None = None,
    since_hours: int | None = None,
    limit: int = 120,
) -> list[dict]:
    entries = list(LOGS)
    if level and level != "ALL":
        normalized_level = normalize_log_level(level)
        entries = [entry for entry in entries if entry["level"] == normalized_level]
    if source and source != "ALL":
        target_source = source.strip().lower()
        entries = [entry for entry in entries if entry.get("source", "").lower() == target_source]
    if search:
        keyword = search.strip().lower()
        if keyword:
            entries = [
                entry
                for entry in entries
                if keyword in entry["text"].lower()
                or keyword in json.dumps(entry.get("context", {}), ensure_ascii=False).lower()
            ]
    if since_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, since_hours))
        entries = [entry for entry in entries if (parse_entry_time(entry["ts"]) or cutoff) >= cutoff]
    capped_limit = max(1, min(limit, 500))
    return entries[-capped_limit:]


def paginate_logs(
    level: str | None = None,
    search: str | None = None,
    source: str | None = None,
    since_hours: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    entries = query_logs(level=level, search=search, source=source, since_hours=since_hours, limit=500)
    total = len(entries)
    safe_limit = max(1, min(limit, 100))
    safe_offset = max(0, offset)
    items = entries[safe_offset:safe_offset + safe_limit]
    return {
        "items": items,
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
        "has_more": safe_offset + safe_limit < total,
    }

def current_video_url(stored_as: str | None) -> str | None:
    if not stored_as:
        return None
    return f"/uploads/{stored_as}"


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
    append_log("INFO", "Seed admin account created: admin@school.local", source="auth", context={"email": "admin@school.local", "role": "admin"})


def create_session(user: dict) -> dict:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRE_HOURS)
    SESSION_TOKENS[token] = {
        "user_id": user["id"],
        "email": user["email"],
        "created_at": now_iso(),
        "expires_at": expires_at.isoformat(),
    }
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

    # 检查 Session 是否过期
    expires_at_str = session.get("expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            if datetime.now(timezone.utc) > expires_at:
                SESSION_TOKENS.pop(token, None)
                raise HTTPException(status_code=401, detail="token_expired")
        except (ValueError, TypeError):
            pass  # 如果解析失败，忽略过期检查

    user = get_user_by_email(session["email"])
    if not user:
        SESSION_TOKENS.pop(token, None)
        raise HTTPException(status_code=401, detail="invalid_token")
    return user


def require_auth(authorization: str | None) -> dict:
    return get_current_user(authorization)


def active_track_count() -> int:
    return max(STATE["tracked_targets"], len(TRACKS))


def total_track_points() -> int:
    return sum(len(track.points) for track in TRACKS)


def unique_camera_count() -> int:
    return len({item["camera_id"] for item in UPLOADED_VIDEOS}) or 1


def route_distance() -> float:
    total = 0.0
    for track in TRACKS:
        for start, end in zip(track.points, track.points[1:]):
            total += math.dist(start, end)
    return total


def build_metric_cards() -> list[dict]:
    bind_total = len(UPLOADED_VIDEOS)
    targets = active_track_count()
    confidence = STATE["avg_confidence"] * 100 if STATE["avg_confidence"] <= 1 else STATE["avg_confidence"]
    model_name = "YOLOv8 跟踪" if STATE["analysis_model"] == "yolo" else "模拟回放" if STATE["analysis_model"] == "simulation" else "待命"
    hotspot_count = 6 + min(bind_total, 4) + (1 if targets >= 5 else 0)
    cards = [
        {"label": "今日采集点数", "value": f"{12580 + STATE['bind_count'] * 120 + total_track_points() * 6:,}", "delta": "+12.4%", "accent": "positive"},
        {"label": "活跃目标数", "value": str(targets or 18), "delta": "轨迹已同步", "accent": "info"},
        {"label": "高频区域", "value": str(hotspot_count), "delta": "+2 热区", "accent": "warning"},
        {"label": "已绑定视频", "value": str(bind_total), "delta": f"最近批量 {STATE['last_batch_size']} 个", "accent": "muted"},
        {"label": "在线摄像头", "value": str(unique_camera_count()), "delta": "接入主通道", "accent": "positive"},
        {"label": "平均跟踪置信度", "value": f"{confidence:.1f}%", "delta": "人物检测稳定", "accent": "positive"},
        {"label": "轨迹点位总数", "value": f"{total_track_points():,}", "delta": f"处理帧 {STATE['frames_processed']}", "accent": "info"},
        {"label": "异常预警数", "value": str(STATE['alert_count']), "delta": "待人工复核", "accent": "warning"},
        {"label": "分析模型", "value": model_name, "delta": STATE['last_analysis_file'] or "未执行分析", "accent": "muted"},
    ]
    return cards


def build_zone_durations() -> list[dict]:
    offset = max(active_track_count(), 1)
    base = [42, 68, 96, 77, 54]
    names = ["跑道", "教学楼", "沙池区", "游乐区", "校车点"]
    return [{"name": name, "value": value + offset * (index + 1)} for index, (name, value) in enumerate(zip(names, base))]


def build_overview_payload():
    seed_values = OVERVIEW_DATA.trend_values
    dynamic_bump = STATE["bind_count"] * 15 + total_track_points() * 2
    return {
        "metric_cards": build_metric_cards(),
        "trend_hours": OVERVIEW_DATA.trend_hours,
        "trend_values": [value + dynamic_bump + index * active_track_count() * 3 for index, value in enumerate(seed_values)],
        "zone_durations": build_zone_durations(),
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
            "current_video_url": current_video_url(STATE["current_stored_as"]),
            "analysis_model": STATE["analysis_model"],
            "tracked_targets": STATE["tracked_targets"],
        },
        "overview": build_overview_payload(),
        "recent_logs": query_logs(limit=30),
    }
    return json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8")


def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="password_too_short")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="password_need_uppercase")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="password_need_lowercase")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="password_need_digit")


def validate_upload(filename: str, size: int):
    suffix = Path(filename or "upload.bin").suffix.lower() or ".bin"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="unsupported_file_type")
    if size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="file_too_large")
    return suffix


def find_upload_record(filename: str | None = None) -> dict:
    if not UPLOADED_VIDEOS:
        raise HTTPException(status_code=400, detail="no_uploaded_videos")
    if not filename:
        return UPLOADED_VIDEOS[-1]
    for item in reversed(UPLOADED_VIDEOS):
        if item["filename"] == filename or item["stored_as"] == filename:
            return item
    raise HTTPException(status_code=404, detail="video_not_found")


async def store_upload(file: UploadFile, camera_id: str) -> dict:
    content = await file.read()
    suffix = validate_upload(file.filename or "upload.bin", len(content))
    safe_name = f"{uuid4().hex}{suffix}"
    target = UPLOAD_DIR / safe_name
    target.write_bytes(content)

    STATE["stream_active"] = True
    STATE["current_file"] = file.filename or safe_name
    STATE["current_file_path"] = str(target)
    STATE["current_stored_as"] = safe_name
    STATE["camera_id"] = camera_id
    STATE["bind_count"] += 1

    record = {
        "filename": file.filename or safe_name,
        "stored_as": safe_name,
        "path": str(target),
        "size": len(content),
        "camera_id": camera_id,
        "created_at": now_iso(),
    }
    UPLOADED_VIDEOS.append(record)

    append_log("INFO", f"Upload successfully: {STATE['current_file']} ({round(len(content) / 1024 / 1024, 2)}MB)", source="upload", context={"filename": record["filename"], "camera_id": camera_id, "size_mb": round(len(content) / 1024 / 1024, 2)})
    append_log("INFO", f"API Binding {camera_id} matched metadata", source="upload", context={"filename": record["filename"], "camera_id": camera_id})
    append_log("INFO", "Stream running. Analysis queue prepared.", source="upload", context={"filename": record["filename"], "camera_id": camera_id})

    return {"ok": True, **record}


def apply_analysis_result(result: dict, source_record: dict):
    TRACKS.clear()
    for item in result["tracks"]:
        TRACKS.append(TrackFrame(**item))
    STATE["analysis_active"] = True
    STATE["analysis_model"] = result["mode"]
    STATE["tracked_targets"] = result["tracked_targets"]
    STATE["frames_processed"] = result["frames_processed"]
    STATE["avg_confidence"] = float(result["avg_confidence"])
    STATE["last_analysis_file"] = source_record["filename"]
    STATE["current_file"] = source_record["filename"]
    STATE["current_file_path"] = source_record["path"]
    STATE["current_stored_as"] = source_record["stored_as"]
    STATE["camera_id"] = source_record["camera_id"]
    STATE["stream_active"] = True
    STATE["alert_count"] = max(2, min(9, result["tracked_targets"] + (1 if result["mode"] == "simulation" else 0)))


load_logs_from_disk()
ensure_seed_user()
append_log("INFO", "Application startup complete", source="system")


@app.middleware("http")
async def capture_request_logs(request: Request, call_next):
    started = perf_counter()
    request_id = uuid4().hex[:12]
    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed = round((perf_counter() - started) * 1000, 1)
        append_log(
            "ERROR",
            f'{request.method} {request.url.path} -> 500 in {elapsed}ms | {exc.__class__.__name__}: {exc}',
            source="http",
            context={"request_id": request_id, "method": request.method, "path": request.url.path, "status_code": 500, "duration_ms": elapsed},
        )
        raise

    elapsed = round((perf_counter() - started) * 1000, 1)
    should_log = request.url.path not in EXCLUDED_REQUEST_LOG_PATHS and (
        response.status_code >= 400 or request.method in {"POST", "PUT", "PATCH", "DELETE"}
    )
    if should_log:
        level = "ERROR" if response.status_code >= 500 else "WARN" if response.status_code >= 400 else "INFO"
        append_log(
            level,
            f"{request.method} {request.url.path} -> {response.status_code} in {elapsed}ms",
            source="http",
            context={"request_id": request_id, "method": request.method, "path": request.url.path, "status_code": response.status_code, "duration_ms": elapsed},
        )
    return response


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
    append_log("INFO", f"Account registered: {email}", source="auth", context={"email": email, "role": "viewer"})
    return create_session(user)


@app.post("/api/auth/login")
def login(payload: LoginPayload):
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        append_log("WARN", f"Login failed for {normalize_email(payload.email)}", source="auth", context={"email": normalize_email(payload.email)})
        raise HTTPException(status_code=401, detail="invalid_credentials")
    append_log("INFO", f"Login success: {user['email']}", source="auth", context={"email": user["email"], "user_id": user["id"]})
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
            append_log("INFO", f"Logout success: {session['email']}", source="auth", context={"email": session["email"], "user_id": session["user_id"]})
    return {"ok": True}


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload):
    email = normalize_email(payload.email)
    user = get_user_by_email(email)
    response = {"ok": True, "message": "如果账号存在，重置指令已生成。"}
    if not user:
        append_log("WARN", f"Forgot password requested for unknown account: {email}", source="auth", context={"email": email})
        return response
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_MINUTES)
    RESET_CODES[email] = {"code": code, "expires_at": expires_at}
    append_log("INFO", f"Password reset verification code issued for {email}", source="auth", context={"email": email, "expires_in_minutes": RESET_CODE_MINUTES})
    return {**response, "verification_code": code, "expires_in_minutes": RESET_CODE_MINUTES}


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordPayload):
    validate_password(payload.password)
    email = normalize_email(payload.email)
    user = get_user_by_email(email)
    code_data = RESET_CODES.get(email)
    verification_code = (payload.code or payload.token or "").strip()
    if not user or not code_data:
        raise HTTPException(status_code=400, detail="invalid_reset_request")
    if code_data["code"] != verification_code:
        raise HTTPException(status_code=400, detail="invalid_reset_code")
    if code_data["expires_at"] < datetime.now(timezone.utc):
        RESET_CODES.pop(email, None)
        raise HTTPException(status_code=400, detail="reset_code_expired")

    users = load_users()
    for item in users:
        if item["email"] == email:
            item["password_hash"] = hash_password(payload.password)
            break
    save_users(users)
    RESET_CODES.pop(email, None)
    append_log("INFO", f"Password reset success: {email}", source="auth", context={"email": email})
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
        "current_video_url": current_video_url(STATE["current_stored_as"]),
        "analysis_model": STATE["analysis_model"],
        "tracked_targets": STATE["tracked_targets"],
        "analysis_active": STATE["analysis_active"],
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
def logs(
    level: str | None = None,
    search: str | None = None,
    source: str | None = None,
    since_hours: int | None = None,
    limit: int = 20,
    offset: int = 0,
    authorization: str | None = Header(default=None),
):
    require_auth(authorization)
    return paginate_logs(level=level, search=search, source=source, since_hours=since_hours, limit=limit, offset=offset)


@app.get("/api/tracks")
def tracks(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    return [entry.model_dump() for entry in TRACKS]


@app.post("/api/analysis/run")
def run_analysis(payload: AnalysisPayload, authorization: str | None = Header(default=None)):
    user = require_auth(authorization)
    record = find_upload_record(payload.filename)
    append_log("INFO", f"Tracking analysis requested by {user['email']} for {record['filename']}", source="analysis", context={"email": user["email"], "filename": record["filename"], "camera_id": record["camera_id"]})
    try:
        result = analyze_video_tracks(record["path"])
    except Exception as exc:
        append_log("ERROR", f"Tracking analysis crashed for {record['filename']}: {exc}", source="analysis", context={"filename": record["filename"], "camera_id": record["camera_id"], "error": str(exc)})
        raise HTTPException(status_code=500, detail=f"yolo_unavailable:{exc}") from None
    if result["mode"] == "simulation":
        append_log("WARN", f"Tracking analysis fallback to simulation for {record['filename']}", source="analysis", context={"filename": record["filename"], "camera_id": record["camera_id"], "mode": result["mode"]})
    apply_analysis_result(result, record)
    append_log("INFO", f"Tracking analysis completed: {record['filename']} | model={result['mode']} | targets={result['tracked_targets']}", source="analysis", context={"filename": record["filename"], "camera_id": record["camera_id"], "mode": result["mode"], "tracked_targets": result["tracked_targets"], "frames_processed": result["frames_processed"]})
    return {
        "ok": True,
        "message": "人物追踪分析已完成，轨迹已同步到画布。",
        "mode": result["mode"],
        "tracked_targets": result["tracked_targets"],
        "frames_processed": result["frames_processed"],
        "avg_confidence": result["avg_confidence"],
        "file": record["filename"],
        "video_url": current_video_url(record["stored_as"]),
        "camera_id": record["camera_id"],
        "tracks": result["tracks"],
        "detections": result.get("detections", []),
    }


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
    append_log("INFO", f"Batch upload completed by {user['email']} with {len(results)} files", source="upload", context={"email": user["email"], "count": len(results), "camera_ids": parsed_camera_ids})
    return {"ok": True, "count": len(results), "items": results}


@app.websocket("/ws/tracks")
async def tracks_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token or token not in SESSION_TOKENS:
        append_log("WARN", "WebSocket rejected due to invalid session token", source="ws", context={"path": "/ws/tracks"})
        await websocket.close(code=4401)
        return

    await websocket.accept()
    append_log("INFO", "WebSocket stream connected", source="ws", context={"path": "/ws/tracks"})
    try:
        step = 0
        while True:
            payload = []
            for track in TRACKS:
                if STATE["analysis_active"]:
                    payload.append(track.model_dump())
                    continue
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
        append_log("INFO", "WebSocket stream disconnected", source="ws", context={"path": "/ws/tracks"})
        return
    except Exception as exc:
        append_log("ERROR", f"WebSocket stream failed: {exc}", source="ws", context={"path": "/ws/tracks", "error": str(exc)})
        await websocket.close()

app.mount('/uploads', StaticFiles(directory=str(UPLOAD_DIR)), name='uploads')
