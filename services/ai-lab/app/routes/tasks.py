"""Task routes — AI-B-08.

One generic endpoint handles all 9 tasks. The task registry provides the schema,
the deterministic twin, the prompt builder, and the vocabulary constraint. The
route only does dispatch, engine selection, and merge.

Engine singletons are created lazily at module level — one per engine type.
Creating a new engine per request leaks sockets and defeats connection reuse.
"""

from __future__ import annotations

import time
from enum import StrEnum
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import settings as load_settings
from app.engines.base import (
    Failed,
    InferenceProvenance,
    InvalidOutput,
    Success,
    Timeout,
    Unavailable,
)
from app.engines.deterministic import DeterministicInferenceEngine
from app.engines.openrouter_engine import OpenRouterEngine
from app.merge import merge
from app.middleware.redaction import RedactedEngine
from app.tasks.base import TaskSpec, all_tasks, get as get_task

router = APIRouter(prefix="/tasks", tags=["tasks"])

# ---------------------------------------------------------------------------
# Telemetry: simple in-memory stats updated on each call.
# ---------------------------------------------------------------------------
call_stats: dict[str, dict[str, Any]] = {}


def _record_call(task_id: str, latency_ms: int, engine_id: str) -> None:
    stats = call_stats.setdefault(task_id, {"calls": 0, "totalLatencyMs": 0})
    stats["calls"] += 1
    stats["totalLatencyMs"] += latency_ms
    stats["lastLatencyMs"] = latency_ms
    stats["lastEngine"] = engine_id


# ---------------------------------------------------------------------------
# Engine selection — lazy singletons.
# ---------------------------------------------------------------------------

class EngineChoice(StrEnum):
    AUTO = "auto"
    DETERMINISTIC = "deterministic"
    OPENROUTER = "openrouter"


_deterministic_engine: DeterministicInferenceEngine | None = None
_openrouter_engine: RedactedEngine | None = None


def _get_deterministic() -> DeterministicInferenceEngine:
    global _deterministic_engine
    if _deterministic_engine is None:
        _deterministic_engine = DeterministicInferenceEngine()
    return _deterministic_engine


def _get_openrouter() -> RedactedEngine:
    global _openrouter_engine
    if _openrouter_engine is None:
        cfg = load_settings()
        _openrouter_engine = RedactedEngine(OpenRouterEngine(config=cfg))
    return _openrouter_engine


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
async def list_tasks() -> list[dict[str, str]]:
    """List all registered task IDs and summaries."""
    return [
        {"taskId": spec.task_id, "summary": spec.summary, "promptVersion": spec.prompt_version}
        for spec in all_tasks().values()
    ]


@router.post("/{task_id}")
async def run_task(
    task_id: str,
    request: Request,
    engine: EngineChoice = Query(default=EngineChoice.AUTO),
) -> dict[str, Any]:
    # 1. Look up task
    try:
        spec = get_task(task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown task: {task_id}")

    # 2. Parse request body
    body = await request.json()
    try:
        parsed = spec.parse_request(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # 3. Select engine
    started = time.monotonic()
    if engine == EngineChoice.DETERMINISTIC:
        selected = _get_deterministic()
    elif engine == EngineChoice.OPENROUTER:
        selected = _get_openrouter()
    else:
        # auto: try openrouter if configured, else deterministic
        or_engine = _get_openrouter()
        if or_engine.status().value == "READY":
            selected = or_engine
        else:
            selected = _get_deterministic()

    # 4. Generate
    result = selected.generate(spec, parsed)

    # 5. Match result type and merge
    if isinstance(result, Success):
        outcome = merge(spec, parsed, result.value)
        provenance = outcome.annotate(result.provenance)
    else:
        # Unavailable, Timeout, InvalidOutput, Failed — all fall back to deterministic
        outcome = merge(spec, parsed, None)
        # Build a fallback provenance
        fallback_engine = _get_deterministic()
        det_result = fallback_engine.generate(spec, parsed)
        if isinstance(det_result, Success):
            provenance = det_result.provenance
        else:
            provenance = InferenceProvenance(engine_id="deterministic-v1")

        # Annotate provenance with what happened
        if isinstance(result, Unavailable):
            from dataclasses import replace
            provenance = replace(provenance, rejection_reason=f"fallback: {result.reason}")
        elif isinstance(result, Timeout):
            from dataclasses import replace
            provenance = replace(provenance, rejection_reason=f"fallback: timeout after {result.elapsed_ms}ms")
        elif isinstance(result, InvalidOutput):
            from dataclasses import replace
            provenance = replace(provenance, rejection_reason=f"fallback: invalid output")
        elif isinstance(result, Failed):
            from dataclasses import replace
            provenance = replace(provenance, rejection_reason=f"fallback: {result.safe_code}")

    elapsed_ms = int((time.monotonic() - started) * 1000)
    _record_call(task_id, elapsed_ms, provenance.engine_id)

    # 6. Serialize response
    return {
        "result": outcome.value.model_dump(by_alias=True),
        "provenance": provenance.to_dict(),
    }
