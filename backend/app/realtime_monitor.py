from __future__ import annotations

import asyncio
import base64
import math
from collections import deque
from time import perf_counter

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - optional runtime dependency
    cv2 = None
    np = None


DEFAULT_JPEG_BYTES = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8PEA8PDw8QDw8QEA8QEA8PFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDQ0NDg0NDisZFRkrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFhABAQEAAAAAAAAAAAAAAAAAAAEC/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAVEQEBAAAAAAAAAAAAAAAAAAABAP/aAAwDAQACEQMRAD8A8wD/AP/Z"
)

PALETTE = ["#2f6df6", "#16c25f", "#ffb11a", "#8b5cf6", "#ec4899", "#06b6d4"]


def default_runtime(camera_id: str) -> dict:
    return {
        "camera_id": camera_id,
        "status": "idle",
        "online": False,
        "fps": 0.0,
        "model": "mock",
        "last_error": "",
        "last_frame_at": None,
        "active_targets": 0,
        "frame_id": 0,
        "boxes": [],
        "tracks": [],
        "preview_jpeg": DEFAULT_JPEG_BYTES,
        "_history": {},
    }


class RealtimeMonitorService:
    def __init__(self):
        self._runtimes: dict[str, dict] = {}
        self._tasks: dict[str, asyncio.Task] = {}

    def ensure_runtime(self, camera_id: str) -> dict:
        runtime = self._runtimes.get(camera_id)
        if runtime is None:
            runtime = default_runtime(camera_id)
            self._runtimes[camera_id] = runtime
        return runtime

    def serialize_runtime(self, camera_id: str) -> dict:
        runtime = self.ensure_runtime(camera_id)
        return {
            "status": runtime["status"],
            "online": runtime["online"],
            "fps": runtime["fps"],
            "model": runtime["model"],
            "last_error": runtime["last_error"],
            "last_frame_at": runtime["last_frame_at"],
            "active_targets": runtime["active_targets"],
            "frame_id": runtime["frame_id"],
        }

    def camera_view(self, camera: dict) -> dict:
        return {**camera, "runtime": self.serialize_runtime(camera["id"])}

    def list_views(self, cameras: list[dict]) -> list[dict]:
        return [self.camera_view(camera) for camera in cameras]

    def preview_bytes(self, camera_id: str) -> bytes:
        runtime = self.ensure_runtime(camera_id)
        preview = runtime.get("preview_jpeg")
        return preview if isinstance(preview, (bytes, bytearray)) and preview else DEFAULT_JPEG_BYTES

    def build_inference_payload(self, camera_id: str) -> dict:
        runtime = self.ensure_runtime(camera_id)
        return {
            "type": "inference",
            "camera_id": camera_id,
            "ts": runtime["last_frame_at"],
            "stats": {
                "fps": runtime["fps"],
                "model": runtime["model"],
                "frame_id": runtime["frame_id"],
                "online": runtime["online"],
                "last_error": runtime["last_error"],
            },
            "boxes": runtime["boxes"],
            "tracks": runtime["tracks"],
        }

    async def start_camera(self, camera: dict, logger):
        camera_id = camera["id"]
        task = self._tasks.get(camera_id)
        if task and not task.done():
            return self.serialize_runtime(camera_id)

        runtime = self.ensure_runtime(camera_id)
        runtime.update({"status": "starting", "online": False, "last_error": "", "model": camera.get("source_type") or "mock"})
        self._tasks[camera_id] = asyncio.create_task(self._run_camera(camera, logger))
        logger("INFO", f"Camera worker scheduled: {camera['name']}", source="camera", context={"camera_id": camera_id, "action": "start"})
        return self.serialize_runtime(camera_id)

    async def stop_camera(self, camera_id: str, logger):
        task = self._tasks.pop(camera_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        runtime = self.ensure_runtime(camera_id)
        runtime.update({
            "status": "stopped",
            "online": False,
            "fps": 0.0,
            "active_targets": 0,
            "boxes": [],
            "tracks": [],
            "frame_id": 0,
        })
        logger("INFO", "Camera worker stopped", source="camera", context={"camera_id": camera_id, "action": "stop"})
        return self.serialize_runtime(camera_id)

    async def stop_all(self, logger):
        for camera_id in list(self._tasks.keys()):
            await self.stop_camera(camera_id, logger)

    async def mjpeg_stream(self, camera_id: str):
        while True:
            jpeg = self.preview_bytes(camera_id)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg)}\r\n\r\n".encode("utf-8")
                + jpeg
                + b"\r\n"
            )
            await asyncio.sleep(0.2)

    async def _run_camera(self, camera: dict, logger):
        source_type = camera.get("source_type") or "mock"
        if source_type == "mock":
            await self._run_mock_camera(camera, logger)
            return

        if cv2 is None:
            runtime = self.ensure_runtime(camera["id"])
            runtime.update({"status": "error", "online": False, "last_error": "当前环境缺少 OpenCV，无法读取真实视频源。"})
            logger("ERROR", "Camera source requires OpenCV runtime", source="camera", context={"camera_id": camera["id"], "source_type": source_type})
            return

        source_url = (camera.get("source_url") or "").strip()
        if not source_url:
            runtime = self.ensure_runtime(camera["id"])
            runtime.update({"status": "error", "online": False, "last_error": "视频源地址为空。"})
            logger("ERROR", "Camera source url missing", source="camera", context={"camera_id": camera["id"], "source_type": source_type})
            return

        capture = cv2.VideoCapture(source_url)
        runtime = self.ensure_runtime(camera["id"])
        if not capture.isOpened():
            runtime.update({"status": "error", "online": False, "last_error": "视频源无法打开，请检查 source_url。"})
            logger("ERROR", "Camera source open failed", source="camera", context={"camera_id": camera["id"], "source_type": source_type, "source_url": source_url})
            return

        logger("INFO", "Camera source streaming started", source="camera", context={"camera_id": camera["id"], "source_type": source_type})
        frame_id = 0
        try:
            while True:
                started = perf_counter()
                ok, frame = capture.read()
                if not ok or frame is None:
                    runtime.update({"status": "error", "online": False, "last_error": "读取视频帧失败，连接已中断。"})
                    logger("WARN", "Camera frame read failed", source="camera", context={"camera_id": camera["id"], "source_type": source_type})
                    return
                frame_id += 1
                boxes, tracks = self._synthetic_targets(camera["id"], frame_id, runtime)
                jpeg = self._encode_frame(frame, camera, boxes)
                elapsed = max(perf_counter() - started, 0.001)
                runtime.update({
                    "status": "running",
                    "online": True,
                    "fps": round(1 / elapsed, 1),
                    "model": "mock",
                    "last_error": "",
                    "last_frame_at": self._now_iso(),
                    "active_targets": len(boxes),
                    "frame_id": frame_id,
                    "boxes": boxes,
                    "tracks": tracks,
                    "preview_jpeg": jpeg,
                })
                await asyncio.sleep(max(0.02, (1 / max(1, int(camera.get("fps_limit") or 6))) - elapsed))
        finally:
            capture.release()

    async def _run_mock_camera(self, camera: dict, logger):
        camera_id = camera["id"]
        runtime = self.ensure_runtime(camera_id)
        logger("INFO", f"Mock camera started: {camera['name']}", source="camera", context={"camera_id": camera_id, "source_type": "mock"})
        frame_id = runtime.get("frame_id", 0)

        while True:
            started = perf_counter()
            frame_id += 1
            boxes, tracks = self._synthetic_targets(camera_id, frame_id, runtime)
            runtime.update({
                "status": "running",
                "online": True,
                "fps": round(1 / max(perf_counter() - started, 0.001), 1),
                "model": "mock",
                "last_error": "",
                "last_frame_at": self._now_iso(),
                "active_targets": len(boxes),
                "frame_id": frame_id,
                "boxes": boxes,
                "tracks": tracks,
                "preview_jpeg": self._render_mock_jpeg(camera, boxes, frame_id),
            })
            await asyncio.sleep(1 / max(1, int(camera.get("fps_limit") or 6)))

    def _synthetic_targets(self, camera_id: str, frame_id: int, runtime: dict) -> tuple[list[dict], list[dict]]:
        camera_seed = sum(ord(char) for char in camera_id) % 11
        target_count = 2 + (camera_seed % 3)
        history = runtime.setdefault("_history", {})
        boxes = []
        tracks = []

        for index in range(target_count):
            phase = frame_id / 12 + index * 0.8 + camera_seed * 0.11
            cx = 0.18 + index * 0.2 + 0.06 * math.sin(phase)
            cy = 0.28 + 0.18 * math.cos(phase * 0.72 + index)
            width = 0.12
            height = 0.22
            x1 = max(0.02, min(0.92, cx - width / 2))
            y1 = max(0.02, min(0.9, cy - height / 2))
            x2 = max(0.08, min(0.98, cx + width / 2))
            y2 = max(0.12, min(0.98, cy + height / 2))
            label = f"child_{index + 1:02d}"
            track_id = camera_seed * 10 + index + 1
            color = PALETTE[index % len(PALETTE)]

            trail = history.setdefault(label, deque(maxlen=18))
            trail.append([round((x1 + x2) / 2, 4), round((y1 + y2) / 2, 4)])

            boxes.append(
                {
                    "track_id": track_id,
                    "label": label,
                    "bbox": [round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4)],
                    "conf": round(0.82 + 0.04 * math.sin(phase), 3),
                    "color": color,
                }
            )
            tracks.append(
                {
                    "track_id": track_id,
                    "label": label,
                    "color": color,
                    "points": list(trail),
                }
            )
        return boxes, tracks

    def _render_mock_jpeg(self, camera: dict, boxes: list[dict], frame_id: int) -> bytes:
        if cv2 is None or np is None:
            return DEFAULT_JPEG_BYTES

        canvas = np.zeros((360, 640, 3), dtype=np.uint8)
        canvas[:, :] = (24, 32, 48)
        cv2.rectangle(canvas, (0, 0), (639, 55), (31, 53, 92), thickness=-1)
        cv2.putText(canvas, camera["name"], (22, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (241, 246, 255), 2, cv2.LINE_AA)
        cv2.putText(canvas, f"MVP MOCK #{frame_id}", (468, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (144, 179, 255), 1, cv2.LINE_AA)
        self._draw_boxes(canvas, boxes)
        ok, encoded = cv2.imencode(".jpg", canvas)
        return encoded.tobytes() if ok else DEFAULT_JPEG_BYTES

    def _encode_frame(self, frame, camera: dict, boxes: list[dict]) -> bytes:
        if cv2 is None:
            return DEFAULT_JPEG_BYTES
        rendered = frame.copy()
        self._draw_boxes(rendered, boxes)
        cv2.putText(rendered, camera["name"], (18, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (255, 255, 255), 2, cv2.LINE_AA)
        ok, encoded = cv2.imencode(".jpg", rendered)
        return encoded.tobytes() if ok else DEFAULT_JPEG_BYTES

    def _draw_boxes(self, frame, boxes: list[dict]):
        if cv2 is None:
            return
        height, width = frame.shape[:2]
        for box in boxes:
            x1, y1, x2, y2 = box["bbox"]
            p1 = (int(x1 * width), int(y1 * height))
            p2 = (int(x2 * width), int(y2 * height))
            color = self._hex_to_bgr(box.get("color") or PALETTE[0])
            cv2.rectangle(frame, p1, p2, color, 2)
            label = f"{box['label']}  {int(box['conf'] * 100)}%"
            cv2.putText(frame, label, (p1[0], max(18, p1[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)

    def _hex_to_bgr(self, value: str) -> tuple[int, int, int]:
        cleaned = value.replace("#", "")
        if len(cleaned) != 6:
            return 255, 255, 255
        red = int(cleaned[0:2], 16)
        green = int(cleaned[2:4], 16)
        blue = int(cleaned[4:6], 16)
        return blue, green, red

    def _now_iso(self) -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()
