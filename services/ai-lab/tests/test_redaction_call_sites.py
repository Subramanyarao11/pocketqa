"""Track B owns the redaction engine (AI-B-05). Track A owns the guarantee that
every task actually calls it, so the call sites are tested before the engine
exists and AI-B-06 has something to land against.
"""

from __future__ import annotations

import json

import pytest

from app.redaction import redact, redact_text
from app.tasks import get

SENSITIVE = {
    "email": "qa.tester@example.com",
    "otp": "OTP 483920",
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r",
}


@pytest.mark.parametrize("value", list(SENSITIVE.values()))
def test_stub_redacts_the_obvious_patterns(value):
    cleaned, reasons = redact_text(value)
    assert "[REDACTED]" in cleaned
    assert reasons


def test_redaction_walks_nested_payloads():
    payload = {"a": ["qa.tester@example.com"], "b": {"c": "OTP 483920"}}
    cleaned = redact(payload)
    assert "example.com" not in json.dumps(cleaned)
    assert "483920" not in json.dumps(cleaned)


def test_task_prompt_evidence_passes_through_redaction(fixture):
    """A sensitive string planted in captured evidence must not survive into the
    prompt payload."""
    spec = get("rank_assertions")
    payload = fixture("coupon-retry/rank_assertions.request.json")
    payload["candidates"][0]["fact"] = "Text 'qa.tester@example.com' visible in the cart"

    envelope = spec.prompt(spec.parse_request(payload))
    serialised = json.dumps(envelope.evidence)

    assert "qa.tester@example.com" not in serialised
    assert "[REDACTED]" in serialised
