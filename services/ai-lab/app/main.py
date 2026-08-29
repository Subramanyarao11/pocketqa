import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings as load_settings

# Trigger task registration before routes are imported.
import app.tasks as _tasks  # noqa: F401
from app.routes import tasks_router

logger = logging.getLogger("pocketqa")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    cfg = load_settings()
    log_level = os.environ.get("POCKETQA_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    logger.info(
        "ai-lab starting env=%s model=%s",
        os.environ.get("POCKETQA_ENV", "dev"),
        cfg.ceiling_model,
    )
    yield


app = FastAPI(title="PocketQA AI Lab", lifespan=lifespan)
app.include_router(tasks_router)


@app.get("/health")
async def health() -> dict:
    from app.routes.tasks import call_stats
    from app.tasks import all_tasks

    cfg = load_settings()
    openai_status = "READY" if cfg.configured else "UNAVAILABLE"

    prompt_versions = {
        spec.task_id: spec.prompt_version for spec in all_tasks().values()
    }

    return {
        "engines": {
            "openai": openai_status,
            "deterministic": "READY",
        },
        "model": cfg.ceiling_model,
        "promptVersions": prompt_versions,
        "telemetry": {
            "callStats": dict(call_stats),
        },
    }
