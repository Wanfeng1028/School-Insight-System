from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel


class MetricCard(BaseModel):
    label: str
    value: str
    delta: str
    accent: Literal["positive", "muted", "warning", "info"]


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
    level: Literal["INFO", "DEBUG", "WARN", "ERROR"]
    text: str


class TrackFrame(BaseModel):
    id: str
    color: str
    label: str
    points: List[List[float]]


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: Literal["admin", "viewer"]
    created_at: str


class LoginPayload(BaseModel):
    email: str
    password: str


class RegisterPayload(BaseModel):
    name: str
    email: str
    password: str


class ForgotPasswordPayload(BaseModel):
    email: str


class ResetPasswordPayload(BaseModel):
    email: str
    code: str | None = None
    token: str | None = None
    password: str


class AnalysisPayload(BaseModel):
    filename: str | None = None


CameraSourceType = Literal["mock", "file", "rtsp"]


class CameraPayloadBase(BaseModel):
    name: str
    source_type: CameraSourceType = "mock"
    source_url: str = ""
    enabled: bool = False
    fps_limit: int = 6


class CameraCreatePayload(CameraPayloadBase):
    pass


class CameraUpdatePayload(BaseModel):
    name: str | None = None
    source_type: CameraSourceType | None = None
    source_url: str | None = None
    enabled: bool | None = None
    fps_limit: int | None = None
