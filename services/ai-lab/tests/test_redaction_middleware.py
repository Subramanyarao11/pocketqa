"""Redaction middleware tests — AI-B-06.

Verifies that RedactedEngine wraps any engine and that redaction_applied is
always set in provenance when routing through a connected engine.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.engines.base import (
    EngineStatus,
    Failed,
    InferenceProvenance,
    InferenceResult,
    Success,
    Unavailable,
)
from app.middleware.redaction import RedactedEngine


class _StubTask:
    """Minimal task whose envelope is already clean, so the pre-flight check
    passes and the test can exercise the post-call behaviour."""

    task_id = "stub"

    def prompt(self, request):
        from app.envelope import Envelope

        return Envelope(
            task_id="stub", prompt_version="v1", instructions="i",
            vocabulary={"id": ["a1"]}, evidence={"fact": "SAVE20 applied"},
            response_schema={},
        )


class _FakeEngine:
    """A minimal engine that returns a controllable result."""

    engine_id = "fake-v1"

    def __init__(self, result: InferenceResult[Any] | None = None, redaction_applied: bool = True):
        self._result = result
        self._redaction_applied = redaction_applied

    def status(self) -> EngineStatus:
        return EngineStatus.READY

    def generate(self, task: Any, request: Any, timeout_ms: int = 15_000) -> InferenceResult[Any]:
        if self._result is not None:
            return self._result
        return Success(
            value={"test": "value"},
            provenance=InferenceProvenance(
                engine_id=self.engine_id,
                redaction_applied=self._redaction_applied,
                network_used=True,
            ),
        )


def test_redacted_engine_wraps_engine_id():
    inner = _FakeEngine()
    wrapped = RedactedEngine(inner)
    assert wrapped.engine_id == "redacted:fake-v1"


def test_redacted_engine_delegates_status():
    inner = _FakeEngine()
    wrapped = RedactedEngine(inner)
    assert wrapped.status() == EngineStatus.READY


def test_redacted_engine_passes_through_success():
    inner = _FakeEngine(redaction_applied=True)
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(_StubTask(), None)


def test_redacted_engine_forces_redaction_flag():
    """If an engine somehow returns success without redaction_applied, the
    wrapper forces it to True."""
    inner = _FakeEngine(redaction_applied=False)
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(_StubTask(), None)
    # It must REFUSE, not relabel. The earlier version set redaction_applied to
    # True and returned Success, which made provenance claim a payload had been
    # redacted when it had not — spec 27 puts that provenance in the evidence
    # bundle, so the record would have lied to whoever read it.
    assert isinstance(result, Failed)
    assert result.safe_code == "REDACTION_FLAG_MISSING"


def test_redacted_engine_passes_through_unavailable():
    inner = _FakeEngine(result=Unavailable(reason="no key"))
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(_StubTask(), None)
    assert isinstance(result, Unavailable)
    assert result.reason == "no key"


def test_redacted_engine_passes_through_failed():
    inner = _FakeEngine(result=Failed(safe_code="TEST_ERROR"))
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(_StubTask(), None)
    assert isinstance(result, Failed)
    assert result.safe_code == "TEST_ERROR"


def test_bypass_impossible():
    """Verifying the structural guarantee: to call a connected engine via the
    route, you must go through RedactedEngine. The engine stored in the route
    module is always a RedactedEngine instance."""
    from app.routes.tasks import _get_openrouter

    engine = _get_openrouter()
    assert isinstance(engine, RedactedEngine)


class _LeakyTask:
    """A task whose envelope still contains an unredacted value — i.e. a future
    refactor that drops the redact() call inside prompt()."""

    task_id = "leaky"

    def prompt(self, request):
        from app.envelope import Envelope

        return Envelope(
            task_id="leaky", prompt_version="v1", instructions="i",
            vocabulary={"id": ["a1"]},
            evidence={"fact": "Text 'qa.tester@example.com' visible in the cart"},
            response_schema={},
        )


def test_preflight_refuses_before_the_engine_is_called():
    """The check that matters runs BEFORE the payload leaves.

    The earlier version inspected provenance after inner.generate() had already
    sent the data, which cannot prevent anything. This asserts the inner engine
    is never reached at all.
    """
    calls: list[int] = []

    class _CountingEngine(_FakeEngine):
        def generate(self, task, request, timeout_ms=15_000):
            calls.append(1)
            return super().generate(task, request, timeout_ms)

    wrapped = RedactedEngine(_CountingEngine())
    result = wrapped.generate(_LeakyTask(), None)

    assert isinstance(result, Failed)
    assert result.safe_code.startswith("REDACTION_NOT_APPLIED")
    assert calls == [], "the connected engine must not be reached at all"


def test_refusal_never_quotes_the_offending_value():
    """Error strings are an exfiltration path (spec 34): report the count, never
    the value."""
    wrapped = RedactedEngine(_FakeEngine())
    result = wrapped.generate(_LeakyTask(), None)

    assert isinstance(result, Failed)
    assert "qa.tester" not in result.safe_code
    assert "example.com" not in result.safe_code
