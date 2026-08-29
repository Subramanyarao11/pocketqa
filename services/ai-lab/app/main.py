import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings

logger = logging.getLogger("pocketqa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=settings.pocketqa_log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    logger.info(
        "ai-lab starting env=%s model=%s",
        settings.pocketqa_env,
        settings.pocketqa_llm_model or "(not set)",
    )
    yield


app = FastAPI(title="PocketQA AI Lab", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    openai_key = settings.openai_api_key.get_secret_value()
    openai_status = "READY" if openai_key else "UNAVAILABLE"

    return {
        "engines": {
            "openai": openai_status,
            "deterministic": "READY",
        },
        "model": settings.pocketqa_llm_model or None,
        "promptVersions": {},
    }
