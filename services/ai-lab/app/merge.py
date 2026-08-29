"""The response merge rule.

This is the single most important piece of code in Track A. It runs on every
task response, from every engine, without exception.

An identifier we did not supply means the model hallucinated. The correct
product behaviour is not to repair the response or to surface an error to the
user: it is to silently use the deterministic result and record the rejection in
provenance. Rejection is a normal, expected, logged outcome — not an error path
to be softened.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.engines.base import InferenceProvenance
from app.tasks.base import BaseResponse, TaskSpec


@dataclass(frozen=True, slots=True)
class MergeOutcome:
    value: BaseResponse
    used_model: bool
    rejected: bool
    rejection_reason: str | None
    unknown_ids: frozenset[str]

    def annotate(self, provenance: InferenceProvenance) -> InferenceProvenance:
        from dataclasses import replace

        return replace(
            provenance,
            output_rejected=self.rejected,
            rejection_reason=self.rejection_reason,
        )


def merge(
    task: TaskSpec,
    request: Any,
    response: BaseResponse | None,
    *,
    deterministic: BaseResponse | None = None,
) -> MergeOutcome:
    """Accept a model response only if it stayed inside the supplied vocabulary.

    `response=None` covers Unavailable/Timeout/Failed from the engine: the task
    still returns a usable answer, which is invariant 3 (every task has a
    deterministic twin) doing its job.
    """

    fallback = deterministic if deterministic is not None else task.deterministic(request)

    if response is None:
        return MergeOutcome(fallback, False, False, None, frozenset())

    if getattr(response, "insufficient_evidence", False):
        # Not a failure. The model correctly declined; the rules still answer.
        return MergeOutcome(fallback, False, False, "insufficient_evidence", frozenset())

    allowed = task.allowed_ids(request)
    referenced = task.referenced_ids(response)
    unknown = referenced - allowed

    if unknown:
        reason = f"model referenced unsupplied ids: {sorted(unknown)}"
        return MergeOutcome(fallback, False, True, reason, frozenset(unknown))

    return MergeOutcome(response, True, False, None, frozenset())
