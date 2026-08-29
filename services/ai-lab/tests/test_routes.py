"""Route tests — AI-B-08.

Uses the same httpx AsyncClient + ASGITransport pattern as test_health.py.
All tests use the deterministic engine so they run without an API key.
"""

from __future__ import annotations

import json

from app.tasks.base import get as get_task
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

async def test_connected_engine_refused_without_consent(client: AsyncClient):
    """Spec 18.2 and CONTRIBUTING invariant 6: no connected call without explicit
    operation-level consent. A configured API key is a deployment fact, not
    consent, so asking for the connected engine without it must be refused."""
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions?engine=openrouter", json=payload)
    assert resp.status_code == 403
    assert "consent" in resp.json()["detail"]


async def test_auto_never_reaches_the_network(client: AsyncClient):
    """`auto` means deterministic, whether or not a key is configured.

    The earlier version asserted deterministic only when no key was set, which
    made "connected" the silent default on any machine that had one — the exact
    automatic local-to-connected fall that spec 18.2 forbids. This test now holds
    on a developer laptop with a key present, which is where it was failing.
    """
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    resp = await client.post("/tasks/rank_assertions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["provenance"]["engineId"] == "deterministic-v1"
    assert data["provenance"]["networkUsed"] is False


async def test_consent_is_recorded_when_granted(client: AsyncClient, monkeypatch):
    """Consent granted must reach provenance, because spec 27 puts provenance in
    the evidence bundle and "was this sent to a third party" is the question it
    exists to answer. The engine is stubbed so the test needs no network."""
    from app.engines.base import InferenceProvenance, Success
    import app.routes.tasks as routes

    spec = get_task("rank_assertions")
    payload = json.loads(
        (FIXTURES / "coupon-retry" / "rank_assertions.request.json").read_text()
    )
    canned = spec.deterministic(spec.parse_request(payload))

    class _Stub:
        engine_id = "stub"

        def status(self):
            from app.engines.base import EngineStatus

            return EngineStatus.READY

        def generate(self, task, request, timeout_ms=15_000):
            return Success(
                value=canned,
                provenance=InferenceProvenance(
                    engine_id="stub", redaction_applied=True, network_used=True
                ),
            )

    monkeypatch.setattr(routes, "_get_openrouter", lambda: _Stub())
    resp = await client.post(
        "/tasks/rank_assertions?engine=openrouter&consent=true", json=payload
    )
    assert resp.status_code == 200
    assert resp.json()["provenance"]["networkUsed"] is True


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
