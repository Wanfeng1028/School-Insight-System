from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4


DEFAULT_CAMERAS = [
    {"id": "camera_id: 1", "name": "北门通道", "source_type": "mock", "source_url": "", "enabled": True, "fps_limit": 6},
    {"id": "camera_id: 2", "name": "操场跑道", "source_type": "mock", "source_url": "", "enabled": True, "fps_limit": 6},
    {"id": "camera_id: 3", "name": "教学楼一层", "source_type": "mock", "source_url": "", "enabled": True, "fps_limit": 5},
    {"id": "camera_id: 4", "name": "沙池活动区", "source_type": "mock", "source_url": "", "enabled": True, "fps_limit": 5},
    {"id": "camera_id: 5", "name": "游乐区东侧", "source_type": "mock", "source_url": "", "enabled": False, "fps_limit": 4},
    {"id": "camera_id: 6", "name": "校车候车点", "source_type": "mock", "source_url": "", "enabled": False, "fps_limit": 4},
]


def normalize_camera_record(payload: dict, fallback_id: str | None = None) -> dict:
    source_type = str(payload.get("source_type") or "mock").strip().lower()
    if source_type not in {"mock", "file", "rtsp"}:
        source_type = "mock"

    name = str(payload.get("name") or "").strip() or "未命名摄像头"
    camera_id = str(payload.get("id") or fallback_id or f"camera_{uuid4().hex[:8]}")
    source_url = str(payload.get("source_url") or "").strip()
    enabled = bool(payload.get("enabled", False))

    try:
        fps_limit = int(payload.get("fps_limit") or 6)
    except (TypeError, ValueError):
        fps_limit = 6
    fps_limit = max(1, min(fps_limit, 12))

    return {
        "id": camera_id,
        "name": name,
        "source_type": source_type,
        "source_url": source_url,
        "enabled": enabled,
        "fps_limit": fps_limit,
    }


class CameraStore:
    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._items: list[dict] = []
        self.load()

    def load(self) -> list[dict]:
        if not self.file_path.exists():
            self._items = [normalize_camera_record(item) for item in DEFAULT_CAMERAS]
            self.save()
            return self.list()

        try:
            raw = json.loads(self.file_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = DEFAULT_CAMERAS

        if not isinstance(raw, list) or not raw:
            raw = DEFAULT_CAMERAS

        self._items = [normalize_camera_record(item) for item in raw if isinstance(item, dict)]
        if not self._items:
            self._items = [normalize_camera_record(item) for item in DEFAULT_CAMERAS]
        self.save()
        return self.list()

    def save(self):
        self.file_path.write_text(json.dumps(self._items, ensure_ascii=False, indent=2), encoding="utf-8")

    def list(self) -> list[dict]:
        return [dict(item) for item in self._items]

    def get(self, camera_id: str) -> dict | None:
        for item in self._items:
            if item["id"] == camera_id:
                return dict(item)
        return None

    def create(self, payload: dict) -> dict:
        item = normalize_camera_record(payload)
        self._items.append(item)
        self.save()
        return dict(item)

    def update(self, camera_id: str, changes: dict) -> dict | None:
        for index, item in enumerate(self._items):
            if item["id"] != camera_id:
                continue
            next_item = normalize_camera_record({**item, **changes}, fallback_id=camera_id)
            self._items[index] = next_item
            self.save()
            return dict(next_item)
        return None

    def delete(self, camera_id: str) -> dict | None:
        for index, item in enumerate(self._items):
            if item["id"] != camera_id:
                continue
            removed = self._items.pop(index)
            self.save()
            return dict(removed)
        return None
