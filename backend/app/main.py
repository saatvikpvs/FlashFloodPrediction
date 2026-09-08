from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import replay, rescue, villages

app = FastAPI(title="Flash Flood & Landslide Early Warning API")

# Wide-open CORS: a hackathon dashboard hitting this from
# localhost / a teammate's laptop / a deployed preview should never be
# blocked by an origin mismatch during a demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(villages.router)
app.include_router(replay.router)
app.include_router(rescue.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Flash Flood & Landslide Early Warning API",
        "endpoints": ["/api/villages", "/api/villages/{id}", "/api/replay/wayanad_2024"],
    }
