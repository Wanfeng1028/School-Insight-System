from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel


class MetricCard(BaseModel):
    label: str
    value: str
    delta: str
    accent: Literal["positive", "muted", "warning"]


class ZoneDuration(BaseModel):
    name: str
    value: int


class OverviewPayload(BaseModel):
    metric_cards: List[MetricCard]
    trend_hours: List[str]
    trend_values: List[int]
    zone_durations: List[ZoneDuration]


class LogEntry(BaseModel):
    ts: datetime
    level: Literal["INFO", "DEBUG", "WARN"]
    text: str


class TrackFrame(BaseModel):
    id: str
    color: str
    label: str
    points: List[List[float]]
