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
    result = wrapped.generate(None, None)
    assert isinstance(result, Success)
    assert result.provenance.redaction_applied is True


def test_redacted_engine_forces_redaction_flag():
    """If an engine somehow returns success without redaction_applied, the
    wrapper forces it to True."""
    inner = _FakeEngine(redaction_applied=False)
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(None, None)
    assert isinstance(result, Success)
    assert result.provenance.redaction_applied is True


def test_redacted_engine_passes_through_unavailable():
    inner = _FakeEngine(result=Unavailable(reason="no key"))
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(None, None)
    assert isinstance(result, Unavailable)
    assert result.reason == "no key"


def test_redacted_engine_passes_through_failed():
    inner = _FakeEngine(result=Failed(safe_code="TEST_ERROR"))
    wrapped = RedactedEngine(inner)
    result = wrapped.generate(None, None)
    assert isinstance(result, Failed)
    assert result.safe_code == "TEST_ERROR"


def test_bypass_impossible():
    """Verifying the structural guarantee: to call a connected engine via the
    route, you must go through RedactedEngine. The engine stored in the route
    module is always a RedactedEngine instance."""
    from app.routes.tasks import _get_openrouter

    engine = _get_openrouter()
    assert isinstance(engine, RedactedEngine)
