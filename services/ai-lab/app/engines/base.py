"""Engine protocol — the Python mirror of Technical Spec section 18.1.

SHARED CONTRACT (handshake H3). Track A writes deterministic twins against this;
Track B writes the OpenAI engine and the Kotlin port against it. Changing the
shape here is a two-track decision, not a one-track refactor.

The result union is deliberately identical to the Kotlin `InferenceResult`
sealed interface so that the on-device port is a transliteration, not a redesign.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Generic, Protocol, TypeVar, runtime_checkable

T = TypeVar("T")


class EngineStatus(StrEnum):
    """Mirrors the ML Kit Prompt readiness states (spec 18.3) so that the lab and
    the device report availability in the same vocabulary."""

    READY = "READY"
    DOWNLOADABLE = "DOWNLOADABLE"
    DOWNLOADING = "DOWNLOADING"
    UNAVAILABLE = "UNAVAILABLE"


class ConsentState(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    OPERATION_LEVEL_GRANTED = "OPERATION_LEVEL_GRANTED"
    OPENROUTER_GRANTED = "OPENROUTER_GRANTED"
    DENIED = "DENIED"


@dataclass(frozen=True, slots=True)
class InferenceProvenance:
    """Recorded on every call. Spec section 27 requires provenance in the evidence
    bundle; `output_rejected` is what tells a reviewer the model tried to leave
    the supplied vocabulary and was overruled."""

    engine_id: str
    model: str | None = None
    prompt_version: str | None = None
    latency_ms: int = 0
    input_tokens: int | None = None
    output_tokens: int | None = None
    redaction_applied: bool = False
    output_rejected: bool = False
    rejection_reason: str | None = None
    consent: ConsentState = ConsentState.NOT_REQUIRED
    network_used: bool = False
    #: "json_schema" (provider-enforced grammar) or "json_object" (schema stated
    #: in the prompt). Small models frequently need the second — see the engine.
    response_mode: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "engineId": self.engine_id,
            "model": self.model,
            "promptVersion": self.prompt_version,
            "latencyMs": self.latency_ms,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "redactionApplied": self.redaction_applied,
            "outputRejected": self.output_rejected,
            "rejectionReason": self.rejection_reason,
            "consent": str(self.consent),
            "networkUsed": self.network_used,
            "responseMode": self.response_mode,
        }


@dataclass(frozen=True, slots=True)
class Success(Generic[T]):
    value: T
    provenance: InferenceProvenance


@dataclass(frozen=True, slots=True)
class Unavailable:
    reason: str


@dataclass(frozen=True, slots=True)
class InvalidOutput:
    issues: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class Timeout:
    elapsed_ms: int


@dataclass(frozen=True, slots=True)
class Failed:
    """`safe_code` is a stable enum-like string. It must never carry captured
    content — error strings are an exfiltration path (spec section 34)."""

    safe_code: str


InferenceResult = Success[T] | Unavailable | InvalidOutput | Timeout | Failed


@runtime_checkable
class StructuredInferenceEngine(Protocol):
    """Every engine — deterministic, OpenAI, ML Kit Prompt, LiteRT — implements
    exactly this. A task never learns which one ran it."""

    engine_id: str

    def status(self) -> EngineStatus: ...

    def generate(
        self,
        task: Any,
        request: Any,
        timeout_ms: int = 15_000,
    ) -> InferenceResult[Any]: ...
