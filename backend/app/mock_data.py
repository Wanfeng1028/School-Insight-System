from datetime import datetime

from .schemas import LogEntry, MetricCard, OverviewPayload, TrackFrame, ZoneDuration


OVERVIEW_DATA = OverviewPayload(
    metric_cards=[
        MetricCard(label="\u4eca\u65e5\u91c7\u96c6\u70b9\u6570", value="12,580", delta="+12%", accent="positive"),
        MetricCard(label="\u6d3b\u8dc3\u513f\u7ae5 (Children)", value="18", delta="\u76ee\u6807\u8bc6\u522b\u7a33\u5b9a", accent="muted"),
        MetricCard(label="\u6d3b\u8dc3\u533a\u57df\u8ba1\u6570 (Active Zones)", value="6", delta="+2 \u9ad8\u9891\u533a", accent="warning"),
    ],
    trend_hours=["08H", "10H", "12H", "14H", "16H", "18H"],
    trend_values=[820, 1080, 1490, 1210, 1810, 1320],
    zone_durations=[
        ZoneDuration(name="\u8dd1\u9053", value=42),
        ZoneDuration(name="\u6559\u5b66\u697c", value=68),
        ZoneDuration(name="\u6c99\u6c60\u533a", value=96),
        ZoneDuration(name="\u6e38\u4e50\u533a", value=77),
    ],
)

LOGS = [
    LogEntry(ts=datetime.fromisoformat("2026-03-17T10:20:01"), level="INFO", text="System boot initiated | version 2.4.0-stable"),
    LogEntry(ts=datetime.fromisoformat("2026-03-17T10:20:05"), level="INFO", text="WebSocket server started on port 8080"),
    LogEntry(ts=datetime.fromisoformat("2026-03-17T10:21:12"), level="DEBUG", text="Redis connection established: redis://127.0.0.1:6379"),
    LogEntry(ts=datetime.fromisoformat("2026-03-17T10:22:30"), level="INFO", text="Upload successfully: classroom01.mp4 (128MB)"),
    LogEntry(ts=datetime.fromisoformat("2026-03-17T10:24:15"), level="WARN", text="FPS dropped below 15 for 2.4s (IO bottleneck)"),
]

TRACKS = [
    TrackFrame(id="child_01", color="#ff4d4f", label="child_01", points=[[140, 116], [162, 138], [188, 144], [214, 133], [238, 118]]),
    TrackFrame(id="child_02", color="#16c25f", label="child_02", points=[[410, 300], [424, 342], [487, 328], [550, 316]]),
    TrackFrame(id="child_04", color="#ffb11a", label="child_04", points=[[262, 372], [302, 388], [348, 392], [394, 378], [438, 350]]),
    TrackFrame(id="debug_1", color="#2f6df6", label="debug_1", points=[[620, 116], [643, 132], [682, 136], [714, 135], [733, 151], [742, 189]]),
]
