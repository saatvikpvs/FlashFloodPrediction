"""
Rescue request tracker router.

Stores requests in-memory — survives server lifetime which is enough
for a live demo / hackathon. A production version would swap the list
for a SQLite / Postgres table.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.models import RescueRequest, RescueRequestCreate, RescueStatusUpdate

router = APIRouter(prefix="/api/rescue", tags=["rescue"])

# In-memory store — list keeps insertion order, newest appended last.
_REQUESTS: list[RescueRequest] = []

VALID_SEVERITIES = {"critical", "urgent", "moderate"}
VALID_STATUSES = {"pending", "dispatched", "resolved"}


@router.get("", response_model=list[RescueRequest])
def list_rescue_requests(status: Optional[str] = None):
    """Return all rescue requests, newest first. Optionally filter by status."""
    items = list(reversed(_REQUESTS))
    if status:
        items = [r for r in items if r.status == status]
    return items


@router.post("", response_model=RescueRequest, status_code=201)
def create_rescue_request(body: RescueRequestCreate):
    """Submit a new rescue request for a village."""
    if body.severity not in VALID_SEVERITIES:
        raise HTTPException(
            status_code=400,
            detail=f"severity must be one of: {', '.join(VALID_SEVERITIES)}",
        )
    if body.people_count < 1:
        raise HTTPException(status_code=400, detail="people_count must be at least 1")

    req = RescueRequest(
        id=str(uuid.uuid4()),
        village_id=body.village_id,
        village_name=body.village_name,
        lat=body.lat,
        lon=body.lon,
        severity=body.severity,
        people_count=body.people_count,
        notes=body.notes,
        contact=body.contact,
        status="pending",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    _REQUESTS.append(req)
    return req


@router.patch("/{request_id}/status", response_model=RescueRequest)
def update_rescue_status(request_id: str, body: RescueStatusUpdate):
    """Advance or change the status of a rescue request."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(VALID_STATUSES)}",
        )
    for req in _REQUESTS:
        if req.id == request_id:
            req.status = body.status
            return req
    raise HTTPException(status_code=404, detail="Rescue request not found")


@router.delete("/{request_id}", status_code=204)
def delete_rescue_request(request_id: str):
    """Remove a rescue request (resolved / cancelled)."""
    global _REQUESTS
    before = len(_REQUESTS)
    _REQUESTS = [r for r in _REQUESTS if r.id != request_id]
    if len(_REQUESTS) == before:
        raise HTTPException(status_code=404, detail="Rescue request not found")
