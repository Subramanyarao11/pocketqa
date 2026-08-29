"""Closed enums from Technical Spec section 10.1, plus the compact evidence
summaries the reasoning tasks actually consume.

The tasks never see a full `UiState`. They see summaries: fewer tokens, no
coordinates, no platform node references, and nothing the model could turn into
an action. That narrowing is a safety control (spec 22.3, invariant 1) as much
as a cost control.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field

from app.tasks.base import Contract


class UiRole(StrEnum):
    BUTTON = "BUTTON"
    TEXT = "TEXT"
    INPUT = "INPUT"
    CHECKBOX = "CHECKBOX"
    RADIO = "RADIO"
    SWITCH = "SWITCH"
    IMAGE = "IMAGE"
    LIST = "LIST"
    LIST_ITEM = "LIST_ITEM"
    TAB = "TAB"
    DIALOG = "DIALOG"
    LINK = "LINK"
    UNKNOWN = "UNKNOWN"


class AssertionKind(StrEnum):
    VISIBLE = "VISIBLE"
    NOT_VISIBLE = "NOT_VISIBLE"
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"
    CHECKED = "CHECKED"
    TEXT_EQUALS = "TEXT_EQUALS"
    TEXT_CONTAINS = "TEXT_CONTAINS"
    STATE_FINGERPRINT = "STATE_FINGERPRINT"
    IMAGE_REGION_SIMILAR = "IMAGE_REGION_SIMILAR"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


class Severity(StrEnum):
    INFO = "INFO"
    MINOR = "MINOR"
    MAJOR = "MAJOR"
    CRITICAL = "CRITICAL"


class FailureClass(StrEnum):
    """Spec section 23.2. `UNKNOWN` exists so the classifier can decline rather
    than force a run into the nearest-looking bucket."""

    SELECTOR_DRIFT = "SELECTOR_DRIFT"
    ASSERTION_REGRESSION = "ASSERTION_REGRESSION"
    NAVIGATION_DIVERGENCE = "NAVIGATION_DIVERGENCE"
    TIMEOUT_PERFORMANCE = "TIMEOUT_PERFORMANCE"
    APP_CRASH = "APP_CRASH"
    FIXTURE_ENVIRONMENT = "FIXTURE_ENVIRONMENT"
    CAPTURE_LIMITATION = "CAPTURE_LIMITATION"
    UNKNOWN = "UNKNOWN"


class EdgeCaseDimension(StrEnum):
    LOCALE = "LOCALE"
    NETWORK = "NETWORK"
    INPUT = "INPUT"
    PERMISSION = "PERMISSION"
    SAVED_STATE = "SAVED_STATE"


class BoundsRatio(Contract):
    """Relative bounds only. Absolute pixels never reach a prompt, because a
    coordinate is one careless integration away from being an action."""

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(ge=0.0, le=1.0)
    height: float = Field(ge=0.0, le=1.0)


class NodeSummary(Contract):
    node_id: str
    role: UiRole = UiRole.UNKNOWN
    resource_id: str | None = None
    text: str | None = None
    content_description: str | None = None
    hint_text: str | None = None
    bounds: BoundsRatio | None = None
    enabled: bool = True
    visible: bool = True
    clickable: bool = False
    editable: bool = False
    checkable: bool = False
    checked: bool | None = None
    selected: bool | None = None
    focusable: bool = False
    ancestor_labels: list[str] = Field(default_factory=list)

    def label(self) -> str:
        """The human-meaningful name of this node, in the order a person would
        read it."""
        for candidate in (self.text, self.content_description, self.hint_text):
            if candidate:
                return candidate
        return self.resource_id.split("/")[-1] if self.resource_id else ""


class StateSummary(Contract):
    state_id: str
    sequence: int = 0
    package_name: str | None = None
    window_title: str | None = None
    visible_text: list[str] = Field(default_factory=list)
    semantic_fingerprint: str | None = None
