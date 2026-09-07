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
