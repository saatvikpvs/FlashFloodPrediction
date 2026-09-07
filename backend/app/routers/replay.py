from fastapi import APIRouter, HTTPException

from app.data.historical_events import HISTORICAL_EVENTS
from app.data.villages import VILLAGES_BY_ID
from app.services import risk_engine

router = APIRouter(prefix="/api/replay", tags=["replay"])

_EVENTS_BY_ID = {e["id"]: e for e in HISTORICAL_EVENTS}


@router.get("")
def list_events():
    return HISTORICAL_EVENTS


@router.get("/{event_id}")
def replay_event(event_id: str, village_id: str | None = None):
    event = _EVENTS_BY_ID.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Unknown event id")

    target_village_id = village_id or event["village_ids"][0]
    if target_village_id not in event["village_ids"]:
        raise HTTPException(status_code=400, detail="village_id is not part of this event")

    window = event["replay_window"]
    points = risk_engine.evaluate_historical_series(
        target_village_id,
        window["start"],
        window["end"],
        event.get("gauge_overrides_mm"),
    )
    village = VILLAGES_BY_ID[target_village_id]

    data_quality_note = None
    if event.get("gauge_overrides_mm"):
        dates = ", ".join(event["gauge_overrides_mm"].keys())
        data_quality_note = (
            f"Free satellite/reanalysis rainfall data (ERA5-Land, ~11km grid) understated this "
            f"event by roughly 5-7x on {dates} compared to documented IMD gauge readings -- a real, "
            f"known limitation for hyper-local cloudbursts over steep terrain. The highlighted points "
            f"below are rescaled to match the documented gauge totals; this is exactly the gap a real "
            f"deployment's local IoT rain gauges would close."
        )

    return {
        "village_id": target_village_id,
        "village_name": village["name"],
        "event_id": event["id"],
        "event_title": event["title"],
        "event_date": event["date"],
        "summary": event["summary"],
        "available_villages": event["village_ids"],
        "data_quality_note": data_quality_note,
        "points": points,
    }
