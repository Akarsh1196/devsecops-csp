from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from prometheus_fastapi_instrumentator import Instrumentator

from .config import settings
from .db import Base, engine, get_db
from .models import Incident
from .schemas import IncidentCreate, IncidentOut, IncidentStatsOut, IncidentUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Production containers run Alembic before Uvicorn; create_all keeps tests self-contained.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.get("/")
def root():
    return {"service": settings.app_name, "version": "1.0.0", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "UP"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(select(func.count(Incident.id)))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database is not ready")
    return {"status": "READY"}

@app.get("/api/incidents", response_model=list[IncidentOut])
@app.get("/api/work-items", response_model=list[IncidentOut], include_in_schema=False)
def list_incidents(db: Session = Depends(get_db)):
    return list(db.scalars(select(Incident).order_by(Incident.id.desc())))

@app.get("/api/incidents/stats", response_model=IncidentStatsOut)
@app.get("/api/work-items/stats", response_model=IncidentStatsOut, include_in_schema=False)
def incident_stats(db: Session = Depends(get_db)):
    rows = db.execute(select(Incident.status, func.count(Incident.id)).group_by(Incident.status)).all()
    counts = {status: count for status, count in rows}
    return IncidentStatsOut(
        total=sum(counts.values()),
        open=counts.get("OPEN", 0),
        inProgress=counts.get("IN_PROGRESS", 0),
        resolved=counts.get("RESOLVED", 0),
    )

@app.get("/api/incidents/{incident_id}", response_model=IncidentOut)
@app.get("/api/work-items/{incident_id}", response_model=IncidentOut, include_in_schema=False)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.post("/api/incidents", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/work-items", response_model=IncidentOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    incident = Incident(**payload.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident

@app.put("/api/incidents/{incident_id}", response_model=IncidentOut)
@app.put("/api/work-items/{incident_id}", response_model=IncidentOut, include_in_schema=False)
def update_incident(incident_id: int, payload: IncidentUpdate, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, key, value)
    db.commit()
    db.refresh(incident)
    return incident

@app.delete("/api/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
@app.delete("/api/work-items/{incident_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
