from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_health_returns_200(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200


async def test_health_shape(client: AsyncClient):
    data = (await client.get("/health")).json()
    assert "engines" in data
    assert "openai" in data["engines"]
    assert "deterministic" in data["engines"]
    assert "model" in data
    assert "promptVersions" in data


async def test_deterministic_always_ready(client: AsyncClient):
    data = (await client.get("/health")).json()
    assert data["engines"]["deterministic"] == "READY"


async def test_openai_unavailable_without_key(client: AsyncClient):
    """`settings` is a factory, not a module-level object, so patch what it
    returns. Building a real Settings with no key keeps this test honest: a
    MagicMock would report READY simply because every attribute is truthy."""
    from dataclasses import replace

    from app.config import settings as real_settings

    without_key = replace(real_settings(), api_key=None)
    with patch("app.main.settings", return_value=without_key):
        data = (await client.get("/health")).json()
        assert data["engines"]["openai"] == "UNAVAILABLE"
        assert data["model"] is None
        # The deterministic engine never depends on a key. That is the point.
        assert data["engines"]["deterministic"] == "READY"
