from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import ALERT_CONTACTS
from app.data.villages import VILLAGES, VILLAGES_BY_ID
from app.models import AlertResponse, VillageRisk
from app.services import fast2sms_service, mock_iot, open_meteo, risk_engine

router = APIRouter(prefix="/api/villages", tags=["villages"])


class SimulateRequest(BaseModel):
    intensity: str = "severe"  # moderate | severe | extreme
    duration_minutes: int = 10


@router.get("", response_model=list[VillageRisk])
def list_villages():
    # Each village needs 2 live HTTP calls to Open-Meteo; done
    # sequentially across 8 villages that measured ~19s (too slow for
    # a live demo). requests releases the GIL during network I/O, so a
    # small thread pool gets this down to roughly the slowest single
    # call instead of the sum of all of them.
    with ThreadPoolExecutor(max_workers=len(VILLAGES)) as pool:
        return list(pool.map(risk_engine.evaluate_village, [v["id"] for v in VILLAGES]))


@router.get("/{village_id}", response_model=VillageRisk)
def get_village(village_id: str):
    if village_id not in VILLAGES_BY_ID:
        raise HTTPException(status_code=404, detail="Unknown village id")
    return risk_engine.evaluate_village(village_id)


@router.get("/{village_id}/trend")
def get_trend(village_id: str):
    village = VILLAGES_BY_ID.get(village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Unknown village id")
    live = open_meteo.fetch_live_conditions(village["lat"], village["lon"])
    points = [
        {
            "time": t,
            "precipitation_mm": p or 0.0,
            "soil_moisture_m3m3": s or 0.0,
        }
        for t, p, s in zip(live["all_times"], live["all_precip"], live["all_soil"])
    ]
    return {
        "village_id": village_id,
        "now_index": live["now_index"],
        "points": points,
        "available": live["available"],
    }


@router.post("/{village_id}/simulate")
def simulate_storm(village_id: str, body: SimulateRequest):
    if village_id not in VILLAGES_BY_ID:
        raise HTTPException(status_code=404, detail="Unknown village id")
    if body.intensity not in ("moderate", "severe", "extreme"):
        raise HTTPException(status_code=400, detail="intensity must be moderate, severe, or extreme")
    return mock_iot.trigger_storm_simulation(village_id, body.intensity, body.duration_minutes)


@router.delete("/{village_id}/simulate")
def clear_simulation(village_id: str):
    mock_iot.clear_storm_simulation(village_id)
    return {"village_id": village_id, "cleared": True}


@router.get("/{village_id}/sensor")
def get_sensor_reading(village_id: str):
    village = VILLAGES_BY_ID.get(village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Unknown village id")
    live = open_meteo.fetch_live_conditions(village["lat"], village["lon"])
    return mock_iot.simulated_sensor_reading(village_id, live["soil_moisture_m3m3"])


@router.post("/{village_id}/alert", response_model=AlertResponse)
def trigger_alert(village_id: str):
    if village_id not in VILLAGES_BY_ID:
        raise HTTPException(status_code=404, detail="Unknown village id")

    contacts = ALERT_CONTACTS.get(village_id, [])
    if not contacts:
        raise HTTPException(
            status_code=400,
            detail=f"No emergency alert contacts configured for village '{village_id}'.",
        )

    # Evaluate current risk state to verify Severe status (>90)
    village_data = risk_engine.evaluate_village(village_id)
    if village_data["risk_score"] <= 90:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Emergency alert cannot be sent. Village risk score is {village_data['risk_score']}, "
                "which has not crossed the Severe (>90) threshold."
            ),
        )

    result = fast2sms_service.send_sms_alert(
        village_name=village_data["name"],
        risk_score=village_data["risk_score"],
        risk_level=village_data["risk_level"],
        phone_numbers=contacts,
    )

    return AlertResponse(
        success=result["success"],
        village_id=village_id,
        village_name=village_data["name"],
        risk_score=village_data["risk_score"],
        risk_level=village_data["risk_level"],
        recipients=result["recipients"],
        message=result["message"],
        fast2sms_request_id=result.get("fast2sms_request_id"),
        mock=result.get("mock", False),
    )

