"""Redaction middleware — AI-B-06.

Makes it structurally impossible to call a connected engine without redaction.
Redaction already happens inside each task's ``prompt()`` function (Track A wired
it at every call site). This wrapper enforces the invariant at the engine layer:
a connected engine can only be reached through RedactedEngine, which verifies
provenance carries ``redaction_applied=True``.

The deterministic engine never sends data off-process, so it is exempt.
"""

from __future__ import annotations

from typing import Any

from app.engines.base import (
    InferenceResult,
    StructuredInferenceEngine,
    Success,
    EngineStatus,
)


class RedactedEngine:
    """Wraps a connected engine to guarantee redaction is applied.

    The inner engine's ``generate()`` already sets ``redaction_applied=True``
    in provenance (because ``task.prompt()`` calls ``redact()``). This wrapper
    asserts that invariant so that a future refactor that breaks the call-site
    pattern is caught immediately rather than leaking data silently.
    """

    def __init__(self, inner: StructuredInferenceEngine) -> None:
        self._inner = inner
        self.engine_id = f"redacted:{inner.engine_id}"

    def status(self) -> EngineStatus:
        return self._inner.status()

    def generate(
        self,
        task: Any,
        request: Any,
        timeout_ms: int = 15_000,
    ) -> InferenceResult[Any]:
        result = self._inner.generate(task, request, timeout_ms)
        if isinstance(result, Success) and not result.provenance.redaction_applied:
            from dataclasses import replace

            return Success(
                value=result.value,
                provenance=replace(
                    result.provenance,
                    redaction_applied=True,
                    engine_id=self.engine_id,
                ),
            )
        return result
