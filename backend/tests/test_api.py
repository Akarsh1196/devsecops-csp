import os

os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 - register models with Base.metadata
from app.db import Base, get_db
from app.main import app


TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


def override_get_db():
    from sqlalchemy.orm import Session

    with Session(TEST_ENGINE) as db:
        yield db


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=TEST_ENGINE)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=TEST_ENGINE)


def test_health_and_root_identify_opsdesk(client):
    assert client.get("/health").json() == {"status": "UP"}

    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "OpsDesk API"


def test_readiness_and_metrics_endpoints(client):
    readiness = client.get("/ready")
    assert readiness.status_code == 200
    assert readiness.json() == {"status": "READY"}

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "http_requests_total" in metrics.text


def test_create_list_and_get_incident(client):
    created = client.post(
        "/api/incidents",
        json={
            "title": "Database connection saturation",
            "description": "Connection pool is exhausted in production.",
            "priority": "HIGH",
            "assignee": "on-call",
        },
    )
    assert created.status_code == 201
    incident = created.json()
    assert incident["status"] == "OPEN"
    assert incident["priority"] == "HIGH"

    listed = client.get("/api/work-items")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [incident["id"]]

    fetched = client.get(f"/api/incidents/{incident['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Database connection saturation"


def test_update_stats_and_delete_incident(client):
    first = client.post("/api/incidents", json={"title": "API latency alert"}).json()
    second = client.post(
        "/api/incidents",
        json={"title": "Cache outage", "status": "RESOLVED"},
    ).json()

    updated = client.put(
        f"/api/incidents/{first['id']}",
        json={"status": "IN_PROGRESS", "priority": "HIGH"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "IN_PROGRESS"

    stats = client.get("/api/incidents/stats")
    assert stats.status_code == 200
    assert stats.json() == {"total": 2, "open": 0, "inProgress": 1, "resolved": 1}

    deleted = client.delete(f"/api/work-items/{second['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/incidents/{second['id']}").status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "Invalid status", "status": "DONE"},
    ],
)
def test_create_incident_rejects_invalid_boundaries(client, payload):
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422


def test_missing_incident_returns_not_found(client):
    response = client.get("/api/incidents/9999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Incident not found"}


def test_update_rejects_explicit_null_and_missing_incident(client):
    empty = client.put("/api/incidents/9999", json={})
    assert empty.status_code == 422

    invalid = client.put("/api/incidents/9999", json={"title": None})
    assert invalid.status_code == 422

    missing = client.put("/api/incidents/9999", json={"status": "RESOLVED"})
    assert missing.status_code == 404
