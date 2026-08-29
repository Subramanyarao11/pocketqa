"""Redaction engine — AI-B-05.

Track A calls ``redact()`` from every task so that the call sites exist and are
tested before the real engine lands. Track B (this file) extends the stub with
additional patterns for Indian PII, field-type classification, and UI state
redaction.

The API surface stays identical: ``redact()`` and ``redact_text()`` are the two
public entry points for general payloads. ``redact_ui_state()`` handles the
UiState-specific shape (node text, content descriptions).
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

# Sensitive field names (case-insensitive match on dict keys).
_SENSITIVE_FIELDS: frozenset[str] = frozenset({
    "password", "passwd", "pass", "pwd",
    "otp", "one_time_password", "oneTimePassword",
    "secret", "token", "accessToken", "access_token",
    "refreshToken", "refresh_token",
    "pin", "mpin", "cvv", "cvc",
    "ssn", "social_security",
})

# Order matters: longer / more specific patterns first so they match before
# a shorter one grabs part of the string.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Indian PII
    ("AADHAAR", re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")),
    ("PAN", re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")),
    ("IFSC", re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")),
    ("UPI", re.compile(r"\b[\w.+-]+@[a-z]{2,}(?:\.[a-z]+)?\b")),
    # General PII
    ("EMAIL", re.compile(r"\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")),
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("PHONE", re.compile(r"\b(?:\+?\d{1,3}[ -]?)?\d{10}\b")),
    ("OTP", re.compile(r"\b(?:OTP|otp)[\s:]*\d{4,8}\b")),
    ("TOKEN", re.compile(r"\b(?:eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|[A-Za-z0-9_-]{32,})\b")),
]


def redact_text(value: str) -> tuple[str, list[str]]:
    """Redact known PII patterns from a string.

    Returns ``(redacted_text, list_of_pattern_names_found)``.
    """
    reasons: list[str] = []
    out = value
    for reason, pattern in _PATTERNS:
        out, count = pattern.subn(REDACTED, out)
        if count:
            reasons.append(reason)
    return out, reasons


def _is_sensitive_key(key: str) -> bool:
    """Check if a dict key indicates a sensitive field."""
    normalised = key.replace("-", "_").lower()
    # Direct match
    if normalised in _SENSITIVE_FIELDS:
        return True
    # Suffix match: e.g. "userPassword", "currentOtp"
    for field in _SENSITIVE_FIELDS:
        if normalised.endswith(field.lower()):
            return True
    return False


def find_sensitive(payload: Any, _path: str = "") -> list[str]:
    """Report where sensitive-looking values remain in a payload.

    Used as a pre-flight check before anything crosses the network. Returns the
    JSON-ish paths that still match, so a refusal can say *what* it found without
    quoting the value itself — error strings are an exfiltration path (spec 34).
    """
    found: list[str] = []
    if isinstance(payload, str):
        _, reasons = redact_text(payload)
        found.extend(f"{_path or '<root>'}:{reason}" for reason in reasons)
    elif isinstance(payload, dict):
        for key, value in payload.items():
            found.extend(find_sensitive(value, f"{_path}.{key}" if _path else str(key)))
    elif isinstance(payload, (list, tuple)):
        for index, item in enumerate(payload):
            found.extend(find_sensitive(item, f"{_path}[{index}]"))
    return found


def redact(payload: Any) -> Any:
    """Recursively redact a JSON-shaped payload. Called before anything leaves a
    task, local or connected (spec section 14.2)."""

    if isinstance(payload, str):
        return redact_text(payload)[0]
    if isinstance(payload, dict):
        result = {}
        for key, value in payload.items():
            if _is_sensitive_key(key):
                result[key] = REDACTED
            else:
                result[key] = redact(value)
        return result
    if isinstance(payload, (list, tuple)):
        return [redact(item) for item in payload]
    return payload


def redact_ui_state(state: dict[str, Any]) -> dict[str, Any]:
    """Redact a UiState dict, handling node text, content descriptions, and
    input field values.

    UiState nodes typically have ``text``, ``contentDescription``, and
    ``inputValue`` fields that may contain user-visible PII. This function
    handles the UiState shape specifically so the caller does not need to
    know which fields carry sensitive content.
    """
    if not isinstance(state, dict):
        return state

    result: dict[str, Any] = {}
    for key, value in state.items():
        if key == "nodes" and isinstance(value, list):
            result[key] = [_redact_node(node) for node in value]
        elif _is_sensitive_key(key):
            result[key] = REDACTED
        else:
            result[key] = redact(value)
    return result


def _redact_node(node: Any) -> Any:
    """Redact a single UI node dict."""
    if not isinstance(node, dict):
        return redact(node)

    result: dict[str, Any] = {}
    for key, value in node.items():
        if key in ("text", "contentDescription", "hintText"):
            result[key] = redact_text(str(value))[0] if value is not None else value
        elif key == "inputValue" or _is_sensitive_key(key):
            result[key] = REDACTED if value else value
        elif key == "children" and isinstance(value, list):
            result[key] = [_redact_node(child) for child in value]
        else:
            result[key] = redact(value)
    return result
