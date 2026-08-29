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
from starlette.concurrency import run_in_threadpool

from app.config import settings as load_settings
from app.engines.base import (
    ConsentState,
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
    consent: bool = Query(
        default=False,
        description="Explicit operation-level consent to send this request to a "
        "connected provider. Required for engine=openrouter. Consent is per "
        "operation, not a deployment setting.",
    ),
) -> dict[str, Any]:
    try:
        spec = get_task(task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown task: {task_id}")

    body = await request.json()
    try:
        parsed = spec.parse_request(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Engine selection.
    #
    # Spec 18.2: "The gateway never falls from local to connected automatically."
    # So `auto` resolves to deterministic, full stop. It does NOT mean "connected
    # if a key happens to be configured" — a key is a deployment fact, and using
    # it as consent would send every caller's evidence to a third party because
    # an environment variable was set.
    #
    # The lab has no on-device engine; when one lands (AI-B-20) it slots in
    # between deterministic and connected, and `auto` may prefer it, because it
    # is still local.
    started = time.monotonic()
    consent_state = ConsentState.NOT_REQUIRED

    if engine == EngineChoice.OPENROUTER:
        if not consent:
            raise HTTPException(
                status_code=403,
                detail=(
                    "connected inference requires explicit operation-level consent; "
                    "retry with consent=true. See Technical Spec 18.2 and "
                    "CONTRIBUTING safety invariant 6."
                ),
            )
        selected = _get_openrouter()
        consent_state = ConsentState.OPENROUTER_GRANTED
    else:
        selected = _get_deterministic()

    # The engines are synchronous and network-bound. Calling one directly inside
    # an async route blocks the event loop for the whole request, so the service
    # would serialise under any concurrency.
    result = await run_in_threadpool(selected.generate, spec, parsed)

    if isinstance(result, Success):
        outcome = merge(spec, parsed, result.value)
        provenance = outcome.annotate(result.provenance)
    else:
        # Unavailable / Timeout / InvalidOutput / Failed all fall back to the
        # deterministic twin. merge() already computes it, so do not run the
        # deterministic engine a second time just to build provenance.
        outcome = merge(spec, parsed, None)
        provenance = InferenceProvenance(
            engine_id=_get_deterministic().engine_id,
            latency_ms=int((time.monotonic() - started) * 1000),
            consent=consent_state,
            rejection_reason=_fallback_reason(result),
        )

    elapsed_ms = int((time.monotonic() - started) * 1000)
    _record_call(task_id, elapsed_ms, provenance.engine_id)

    return {
        "result": outcome.value.model_dump(by_alias=True),
        "provenance": provenance.to_dict(),
    }


def _fallback_reason(result: Any) -> str:
    if isinstance(result, Unavailable):
        return f"fallback: {result.reason}"
    if isinstance(result, Timeout):
        return f"fallback: timeout after {result.elapsed_ms}ms"
    if isinstance(result, InvalidOutput):
        return f"fallback: invalid output ({len(result.issues)} issue(s))"
    if isinstance(result, Failed):
        return f"fallback: {result.safe_code}"
    return "fallback: unknown engine result"
