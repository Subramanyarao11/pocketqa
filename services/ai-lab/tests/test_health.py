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
    from pydantic import SecretStr

    with patch("app.main.settings") as mock_settings:
        mock_settings.openai_api_key = SecretStr("")
        mock_settings.pocketqa_llm_model = ""
        resp = await client.get("/health")
        data = resp.json()
        assert data["engines"]["openai"] == "UNAVAILABLE"
