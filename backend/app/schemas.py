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
    level: Literal["INFO", "DEBUG", "WARN"]
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
    token: str
    password: str


class AnalysisPayload(BaseModel):
    filename: str | None = None
