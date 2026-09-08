from typing import Optional
from pydantic import BaseModel


class FactorBreakdown(BaseModel):
    rainfall_score: float
    soil_moisture_score: float
    slope_score: float
    historical_score: float
    river_discharge_score: float


class VillageRisk(BaseModel):
    id: str
    name: str
    district: str
    state: str
    lat: float
    lon: float
    slope_category: str
    notes: str
    risk_score: float
    risk_level: str
    factors: FactorBreakdown
    rain_24h_mm: float
    rain_72h_mm: float
    soil_moisture_m3m3: float
    river_discharge_m3s: Optional[float] = None
    lead_time_hours: Optional[float] = None
    data_source: str = "open-meteo"
    has_alert_contacts: bool = False
    alert_contacts_count: int = 0


class TrendPoint(BaseModel):
    time: str
    precipitation_mm: float
    soil_moisture_m3m3: float
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None


class ReplayResult(BaseModel):
    village_id: str
    village_name: str
    event_id: str
    event_title: str
    event_date: str
    points: list[TrendPoint]


class AlertResponse(BaseModel):
    success: bool
    village_id: str
    village_name: str
    risk_score: float
    risk_level: str
    recipients: list[str]
    message: str
    fast2sms_request_id: Optional[str] = None
    mock: bool = False


class RescueRequest(BaseModel):
    id: str
    village_id: str
    village_name: str
    lat: float
    lon: float
    severity: str          # "critical" | "urgent" | "moderate"
    people_count: int
    notes: str
    contact: Optional[str] = None
    status: str            # "pending" | "dispatched" | "resolved"
    timestamp: str         # ISO-8601 string


class RescueRequestCreate(BaseModel):
    village_id: str
    village_name: str
    lat: float
    lon: float
    severity: str
    people_count: int = 1
    notes: str = ""
    contact: Optional[str] = None


class RescueStatusUpdate(BaseModel):
    status: str            # "pending" | "dispatched" | "resolved"

