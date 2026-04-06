from .schemas import MetricCard, OverviewPayload, TrackFrame, ZoneDuration


OVERVIEW_DATA = OverviewPayload(
    metric_cards=[
        MetricCard(label="今日采集点数", value="12,580", delta="+12%", accent="positive"),
        MetricCard(label="活跃目标数", value="18", delta="轨迹稳定", accent="info"),
        MetricCard(label="高频区域", value="6", delta="+2 热区", accent="warning"),
        MetricCard(label="已绑定视频", value="4", delta="批量接入", accent="muted"),
        MetricCard(label="在线摄像头", value="5", delta="覆盖主通道", accent="positive"),
        MetricCard(label="平均跟踪置信度", value="91.6%", delta="检测稳定", accent="positive"),
        MetricCard(label="轨迹点位总数", value="1,248", delta="实时累计", accent="info"),
        MetricCard(label="异常预警数", value="3", delta="需关注", accent="warning"),
        MetricCard(label="分析模型", value="YOLOv8", delta="人物追踪", accent="muted"),
    ],
    trend_hours=["08H", "10H", "12H", "14H", "16H", "18H"],
    trend_values=[820, 1080, 1490, 1210, 1810, 1320],
    zone_durations=[
        ZoneDuration(name="跑道", value=42),
        ZoneDuration(name="教学楼", value=68),
        ZoneDuration(name="沙池区", value=96),
        ZoneDuration(name="游乐区", value=77),
        ZoneDuration(name="校车点", value=54),
    ],
)

TRACKS = [
    TrackFrame(id="child_01", color="#ff4d4f", label="child_01", points=[[140, 116], [162, 138], [188, 144], [214, 133], [238, 118]]),
    TrackFrame(id="child_02", color="#16c25f", label="child_02", points=[[410, 300], [424, 342], [487, 328], [550, 316]]),
    TrackFrame(id="child_04", color="#ffb11a", label="child_04", points=[[262, 372], [302, 388], [348, 392], [394, 378], [438, 350]]),
    TrackFrame(id="debug_1", color="#2f6df6", label="debug_1", points=[[620, 116], [643, 132], [682, 136], [714, 135], [733, 151], [742, 189]]),
]
