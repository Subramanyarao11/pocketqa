"""FastAPI entrypoint — Track B task AI-B-01.

Originally written against a pydantic-settings `settings` object. Adapted to the
`app.config.settings()` factory that Track A's engines already use, so the two
tracks share one configuration source rather than two that drift.

`Settings.describe()` exists precisely for this route: it reports configuration
without ever including the key.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.engines.deterministic import DeterministicInferenceEngine
from app.prompts import versions as prompt_versions
from app.tasks import all_tasks

# Trigger task registration before routes are imported.
import app.tasks as _tasks  # noqa: F401
from app.routes import tasks_router

logger = logging.getLogger("pocketqa")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config = settings()
    logging.basicConfig(
        level=config.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    # Never log the key itself; describe() is safe by construction.
    logger.info("ai-lab starting env=%s config=%s", config.env, config.describe())
    yield


app = FastAPI(title="PocketQA AI Lab", lifespan=lifespan)
app.include_router(tasks_router)


@app.get("/health")
async def health() -> dict:
    from app.routes.tasks import call_stats

    config = settings()
    return {
        "engines": {
            # Named "openai" for the connected tier regardless of which
            # OpenAI-compatible provider is configured.
            "openai": "READY" if config.configured else "UNAVAILABLE",
            "deterministic": str(DeterministicInferenceEngine().status()),
        },
        "model": config.ceiling_model if config.configured else None,
        "promptVersions": {
            task_id: spec.prompt_version for task_id, spec in sorted(all_tasks().items())
        },
        "availablePromptVersions": prompt_versions(),
        "tasks": sorted(all_tasks()),
        "config": config.describe(),
        "telemetry": {
            "callStats": dict(call_stats),
        },
    }
