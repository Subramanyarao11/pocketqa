"""Route tests — AI-B-08.

Uses the same httpx AsyncClient + ASGITransport pattern as test_health.py.
All tests use the deterministic engine so they run without an API key.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.tasks import all_tasks

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "ai-fixtures"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    # Reset singleton engines between tests so module-level state does not leak.
    import app.routes.tasks as rt

    rt._deterministic_engine = None
    rt._openrouter_engine = None
    rt.call_stats.clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---- GET /tasks -----------------------------------------------------------

async def test_list_tasks_returns_all_9(client: AsyncClient):
    resp = await client.get("/tasks")
    assert resp.status_code == 200
    data = resp.json()
    task_ids = {entry["taskId"] for entry in data}
    assert len(task_ids) == 9
    expected = set(all_tasks().keys())
    assert task_ids == expected


async def test_list_tasks_includes_summaries(client: AsyncClient):
    resp = await client.get("/tasks")
    for entry in resp.json():
        assert "summary" in entry
        assert "promptVersion" in entry
        assert len(entry["summary"]) > 0


# ---- POST /tasks/{task_id} with deterministic engine ----------------------

async def test_rank_assertions_deterministic(client: AsyncClient):
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions?engine=deterministic", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    assert "provenance" in data
    assert data["provenance"]["engineId"] == "deterministic-v1"
    assert "ranked" in data["result"]
    assert len(data["result"]["ranked"]) > 0


async def test_compile_intent_deterministic(client: AsyncClient):
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "compile_intent.request.json").read_text()
    )
    resp = await client.post("/tasks/compile_intent?engine=deterministic", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    assert "provenance" in data
    assert data["provenance"]["engineId"] == "deterministic-v1"


# ---- Error cases -----------------------------------------------------------

async def test_unknown_task_returns_404(client: AsyncClient):
    resp = await client.post("/tasks/nonexistent_task", json={})
    assert resp.status_code == 404


async def test_invalid_request_body_returns_422(client: AsyncClient):
    resp = await client.post(
        "/tasks/rank_assertions?engine=deterministic",
        json={"bad": "data"},
    )
    assert resp.status_code == 422


# ---- Engine fallback -------------------------------------------------------

async def test_openrouter_unconfigured_falls_back(client: AsyncClient):
    """When openrouter is requested but no API key is set, the route should
    fall back to the deterministic engine and return a valid result."""
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions?engine=openrouter", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    # Should have fallen back to deterministic
    assert data["provenance"]["engineId"] == "deterministic-v1"


async def test_auto_engine_uses_deterministic_when_no_key(client: AsyncClient):
    """Auto engine should fall back to deterministic when no API key is set."""
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["provenance"]["engineId"] == "deterministic-v1"


# ---- Telemetry -------------------------------------------------------------

async def test_health_includes_prompt_versions(client: AsyncClient):
    resp = await client.get("/health")
    data = resp.json()
    assert "promptVersions" in data
    assert len(data["promptVersions"]) == 9


async def test_health_includes_telemetry(client: AsyncClient):
    # Make a call first so there's something in call_stats
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    await client.post("/tasks/rank_assertions?engine=deterministic", json=payload)

    resp = await client.get("/health")
    data = resp.json()
    assert "telemetry" in data
    assert "callStats" in data["telemetry"]
    assert "rank_assertions" in data["telemetry"]["callStats"]
    stats = data["telemetry"]["callStats"]["rank_assertions"]
    assert stats["calls"] == 1


# ---- Redaction provenance --------------------------------------------------

async def test_connected_engine_provenance_shows_redaction(client: AsyncClient):
    """When an openrouter engine is used (even falling back to deterministic),
    the provenance should be correctly annotated."""
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions?engine=deterministic", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    # Deterministic engine does not apply redaction (nothing leaves the process)
    assert data["provenance"]["redactionApplied"] is False
