"""Redaction — STUB owned by Track B (task AI-B-05).

Track A calls `redact()` from every task so that the call sites exist and are
tested before the real engine lands. This stub covers the obvious text patterns
only. It is deliberately conservative and deliberately incomplete.

Track B replaces the body of this module with the real engine and wires it as
mandatory middleware (AI-B-06). Do not build features on the specifics of what
this stub catches.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

# Order matters: longer / more specific patterns first.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")),
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("PHONE", re.compile(r"\b(?:\+?\d{1,3}[ -]?)?\d{10}\b")),
    ("OTP", re.compile(r"\b(?:OTP|otp)[\s:]*\d{4,8}\b")),
    ("TOKEN", re.compile(r"\b(?:eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|[A-Za-z0-9_-]{32,})\b")),
]


def redact_text(value: str) -> tuple[str, list[str]]:
    reasons: list[str] = []
    out = value
    for reason, pattern in _PATTERNS:
        out, count = pattern.subn(REDACTED, out)
        if count:
            reasons.append(reason)
    return out, reasons


def redact(payload: Any) -> Any:
    """Recursively redact a JSON-shaped payload. Called before anything leaves a
    task, local or connected (spec section 14.2)."""

    if isinstance(payload, str):
        return redact_text(payload)[0]
    if isinstance(payload, dict):
        return {key: redact(value) for key, value in payload.items()}
    if isinstance(payload, (list, tuple)):
        return [redact(item) for item in payload]
    return payload
