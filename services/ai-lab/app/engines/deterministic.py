"""DeterministicInferenceEngine — Technical Spec section 18.4.

"It is not a mock; it is the guaranteed baseline and must have unit fixtures."

This engine is why PocketQA can run in airplane mode with no GenAI support on the
device and still produce a useful draft, a useful explanation and a useful audit.
Every reasoning task implements its rules in its own module; this class only
dispatches to them and records provenance.

It is also the reference implementation for the Kotlin port (task AI-A-15): the
Kotlin engine must produce identical output on the shared fixture set.
"""

from __future__ import annotations

import time
from typing import Any

from app.engines.base import (
    EngineStatus,
    Failed,
    InferenceProvenance,
    InferenceResult,
    Success,
)
from app.tasks.base import TaskSpec

ENGINE_ID = "deterministic-v1"


class DeterministicInferenceEngine:
    engine_id = ENGINE_ID

    def status(self) -> EngineStatus:
        # Always available. That is the entire point of this engine.
        return EngineStatus.READY

    def generate(
        self,
        task: TaskSpec,
        request: Any,
        timeout_ms: int = 15_000,
    ) -> InferenceResult[Any]:
        started = time.monotonic()
        try:
            value = task.deterministic(request)
        except Exception:  # noqa: BLE001 - the safe code must not carry captured content
            return Failed(safe_code="DETERMINISTIC_ENGINE_ERROR")

        return Success(
            value=value,
            provenance=InferenceProvenance(
                engine_id=self.engine_id,
                model=None,
                prompt_version=None,
                latency_ms=int((time.monotonic() - started) * 1000),
                redaction_applied=False,  # nothing leaves the process
                network_used=False,
            ),
        )
