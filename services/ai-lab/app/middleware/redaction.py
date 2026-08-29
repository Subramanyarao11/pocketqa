"""Redaction middleware — AI-B-06.

Goal, from the Track B board: make it *structurally impossible* to reach a
connected engine without redaction.

The original version did not achieve that, in two ways worth recording because
both are easy to reintroduce:

  1. It checked `redaction_applied` **after** `inner.generate()` had already sent
     the payload. By then the data is gone; a post-hoc check cannot prevent
     anything.
  2. When the flag was False it *set it to True* and returned Success. That is
     the opposite of a safety control: an unredacted payload was relabelled as
     redacted, so provenance — which spec section 27 puts in the evidence bundle
     — would have lied to whoever read it.

This version checks the envelope **before** the call and refuses. Redaction still
happens inside each task's `prompt()`; this wrapper verifies that it actually did,
and fails loudly when it did not.
"""

from __future__ import annotations

from typing import Any

from app.engines.base import (
    EngineStatus,
    Failed,
    InferenceResult,
    StructuredInferenceEngine,
    Success,
)
from app.redaction import find_sensitive


class RedactionNotApplied(Exception):
    """Raised only in strict mode; the route turns it into a refusal."""


class RedactedEngine:
    """Wraps a connected engine and refuses to let an unredacted payload leave.

    The deterministic engine never sends data off-process, so it is exempt and
    must not be wrapped — wrapping it would only add cost.
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
        # Pre-flight. Build the envelope the engine is about to send and inspect
        # it. This costs one extra prompt build, which is the correct price for
        # the only check that can actually stop a payload leaving.
        try:
            envelope = task.prompt(request)
        except Exception:  # noqa: BLE001 - safe codes carry no captured content
            return Failed(safe_code="ENVELOPE_BUILD_FAILED")

        leaks = find_sensitive(envelope.evidence)
        if leaks:
            # Never include the offending value, only where it was found.
            return Failed(safe_code=f"REDACTION_NOT_APPLIED:{len(leaks)}_findings")

        result = self._inner.generate(task, request, timeout_ms)

        if isinstance(result, Success) and not result.provenance.redaction_applied:
            # The engine sent something it did not mark as redacted. The payload
            # is already gone, so this cannot prevent the leak — but recording it
            # truthfully is the difference between a bug we can find and a
            # provenance record that lies.
            return Failed(safe_code="REDACTION_FLAG_MISSING")

        return result
