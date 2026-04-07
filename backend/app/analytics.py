from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path

CANVAS_WIDTH = 1180
CANVAS_HEIGHT = 786
MODEL_PATH = Path(__file__).resolve().parents[1] / "yolov8n.pt"
PALETTE = [
    "#ff4d4f",
    "#16c25f",
    "#ffb11a",
    "#2f6df6",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#ec4899",
]


def _build_track(track_id: str, points: list[list[float]], color: str) -> dict:
    clean_points = [[round(point[0], 2), round(point[1], 2)] for point in points[-20:]]
    return {
        "id": track_id,
        "color": color,
        "label": track_id,
        "points": clean_points,
    }


def simulate_tracks(video_path: str) -> dict:
    name = Path(video_path).name or "video"
    seed = int(hashlib.sha256(name.encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed)
    track_total = 3 + seed % 4
    tracks = []

    for index in range(track_total):
        color = PALETTE[index % len(PALETTE)]
        label = f"child_{index + 1:02d}"
        steps = 7 + rng.randint(2, 6)
        start_x = rng.randint(120, CANVAS_WIDTH - 280)
        start_y = rng.randint(90, CANVAS_HEIGHT - 260)
        angle = rng.uniform(0.2, math.pi * 1.7)
        radius = rng.uniform(80, 180)
        wobble = rng.uniform(12, 36)
        points = []
        for step in range(steps):
            t = step / max(steps - 1, 1)
            x = start_x + math.cos(angle + t * 1.8) * radius * t + step * rng.uniform(8, 18)
            y = start_y + math.sin(angle + t * 1.35) * wobble + step * rng.uniform(5, 14)
            x = max(40, min(CANVAS_WIDTH - 40, x))
            y = max(40, min(CANVAS_HEIGHT - 40, y))
            points.append([x, y])
        tracks.append(_build_track(label, points, color))

    return {
        "tracks": tracks,
        "detections": [],
        "mode": "simulation",
        "tracked_targets": len(tracks),
        "frames_processed": 0,
        "avg_confidence": 0.82,
    }


def try_yolo_tracks(video_path: str) -> dict | None:
    try:
        import cv2  # type: ignore
        from ultralytics import YOLO  # type: ignore
    except Exception:
        return None

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return None

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 25.0)
    if fps <= 0:
        fps = 25.0

    if not MODEL_PATH.exists():
        return None
    model = YOLO(str(MODEL_PATH))
    track_points: dict[str, list[list[float]]] = {}
    conf_values: list[float] = []
    detections: list[dict] = []
    frame_count = 0

    try:
        while frame_count < 720:
            ok, frame = capture.read()
            if not ok:
                break
            frame_count += 1
            height, width = frame.shape[:2]
            if not width or not height:
                continue

            result = model.track(frame, persist=True, classes=[0], verbose=False)[0]
            boxes = getattr(result, "boxes", None)
            if boxes is None or boxes.id is None or boxes.xyxy is None:
                continue

            ids = boxes.id.int().tolist()
            xyxy = boxes.xyxy.tolist()
            confs = boxes.conf.tolist() if boxes.conf is not None else [0.0] * len(ids)

            frame_boxes = []
            for track_id, box, confidence in zip(ids, xyxy, confs):
                x1, y1, x2, y2 = box
                center_x = ((x1 + x2) / 2.0) / width * CANVAS_WIDTH
                center_y = ((y1 + y2) / 2.0) / height * CANVAS_HEIGHT
                label = f"child_{int(track_id):02d}"
                track_points.setdefault(label, []).append([
                    max(20, min(CANVAS_WIDTH - 20, center_x)),
                    max(20, min(CANVAS_HEIGHT - 20, center_y)),
                ])
                conf_values.append(float(confidence))

                nx1 = max(0.0, min(1.0, x1 / width))
                ny1 = max(0.0, min(1.0, y1 / height))
                nx2 = max(0.0, min(1.0, x2 / width))
                ny2 = max(0.0, min(1.0, y2 / height))
                frame_boxes.append(
                    {
                        "id": f"id_{int(track_id)}",
                        "label": label,
                        "bbox": [round(nx1, 6), round(ny1, 6), round(nx2, 6), round(ny2, 6)],
                        "conf": round(float(confidence), 4),
                    }
                )

            if frame_boxes and frame_count % 2 == 0:
                detections.append(
                    {
                        "frame": frame_count,
                        "t": round(frame_count / fps, 3),
                        "boxes": frame_boxes,
                    }
                )
    finally:
        capture.release()

    if not track_points:
        return None

    tracks = []
    for index, (label, points) in enumerate(sorted(track_points.items())):
        if len(points) < 2:
            continue
        tracks.append(_build_track(label, points, PALETTE[index % len(PALETTE)]))

    if not tracks:
        return None

    avg_confidence = sum(conf_values) / len(conf_values) if conf_values else 0.0
    return {
        "tracks": tracks,
        "detections": detections,
        "mode": "yolo",
        "tracked_targets": len(tracks),
        "frames_processed": frame_count,
        "avg_confidence": round(avg_confidence, 3),
    }


def analyze_video_tracks(video_path: str) -> dict:
    result = try_yolo_tracks(video_path)
    if result:
        return result
    return simulate_tracks(video_path)
