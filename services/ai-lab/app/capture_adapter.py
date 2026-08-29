"""Convert a real device capture into the AI layer's evidence shapes.

Track A task AI-A-14. This is the seam between what the phone records and what
the reasoning tasks consume, and it is the piece that lets the eval corpus stop
being hand-authored.

The two shapes are closer than they look. The Kotlin capture
(`capture/UiTreeCapture.kt`) and the React Native domain contract
(`src/domain/schemas.ts` `CapturedNode`) already agree on
`nodeId`, `role`, `text`, `contentDescription`, `resourceId`, `enabled` and
`visible`. Three things actually differ:

  * bounds are absolute pixels as `{x, y, w, h}`; the tasks use `{x, y, width,
    height}` as 0..1 ratios, because absolute coordinates must never reach a
    prompt — a coordinate is one careless integration away from being an action
    (spec 22.3).
  * capture does not record interaction affordances (`clickable`, `focusable`,
    `checkable`), which the accessibility rules need. They default to false, so
    a converted state under-reports rather than inventing findings.
  * capture does not record display size, which ratios and the 48dp touch-target
    rule both require. It has to be supplied.

That last one is a real gap in capture, not in this adapter: without display
metrics a captured state cannot be normalised on its own. Passing it explicitly
keeps the conversion honest instead of guessing a device.
"""

from __future__ import annotations

from typing import Any

from app.domain import BoundsRatio, NodeSummary, StateSummary, UiRole
from app.tasks.audit_accessibility import AuditState

# Capture emits free-form role strings; the tasks use a closed set (spec 10.3).
# Anything unrecognised becomes UNKNOWN rather than being coerced to a plausible
# neighbour — a wrong role silently changes selector scoring and a11y rules.
_ROLE_ALIASES: dict[str, UiRole] = {
    "button": UiRole.BUTTON,
    "text": UiRole.TEXT,
    "textview": UiRole.TEXT,
    "input": UiRole.INPUT,
    "edittext": UiRole.INPUT,
    "checkbox": UiRole.CHECKBOX,
    "radio": UiRole.RADIO,
    "radiobutton": UiRole.RADIO,
    "switch": UiRole.SWITCH,
    "toggle": UiRole.SWITCH,
    "image": UiRole.IMAGE,
    "imageview": UiRole.IMAGE,
    "list": UiRole.LIST,
    "recyclerview": UiRole.LIST,
    "listitem": UiRole.LIST_ITEM,
    "list_item": UiRole.LIST_ITEM,
    "tab": UiRole.TAB,
    "dialog": UiRole.DIALOG,
    "link": UiRole.LINK,
}


class DisplayMetrics:
    """Device display, in pixels and density-independent pixels."""

    def __init__(self, width_px: int, height_px: int, density: float = 1.0) -> None:
        if width_px <= 0 or height_px <= 0:
            raise ValueError("display size must be positive")
        self.width_px = width_px
        self.height_px = height_px
        self.density = density

    @property
    def width_dp(self) -> float:
        return self.width_px / self.density

    @property
    def height_dp(self) -> float:
        return self.height_px / self.density


def normalize_role(raw: str | None) -> UiRole:
    if not raw:
        return UiRole.UNKNOWN
    key = raw.strip().lower().replace(" ", "").replace("-", "")
    return _ROLE_ALIASES.get(key, UiRole.UNKNOWN)


def to_bounds_ratio(bounds: dict[str, Any] | None, display: DisplayMetrics) -> BoundsRatio | None:
    """Absolute `{x, y, w, h}` pixels to clamped 0..1 ratios."""
    if not bounds:
        return None
    try:
        x, y = float(bounds["x"]), float(bounds["y"])
        w, h = float(bounds["w"]), float(bounds["h"])
    except (KeyError, TypeError, ValueError):
        return None

    def clamp(v: float) -> float:
        return max(0.0, min(1.0, v))

    return BoundsRatio(
        x=clamp(x / display.width_px),
        y=clamp(y / display.height_px),
        width=clamp(w / display.width_px),
        height=clamp(h / display.height_px),
    )


def to_node_summary(node: dict[str, Any], display: DisplayMetrics) -> NodeSummary:
    role = normalize_role(node.get("role"))
    return NodeSummary(
        node_id=node["nodeId"],
        role=role,
        resource_id=node.get("resourceId"),
        text=node.get("text"),
        content_description=node.get("contentDescription"),
        hint_text=node.get("hintText"),
        bounds=to_bounds_ratio(node.get("bounds"), display),
        enabled=bool(node.get("enabled", True)),
        visible=bool(node.get("visible", True)),
        # Capture does not record affordances yet. Inferring "clickable" from the
        # role would manufacture accessibility findings that the tree does not
        # support, so these stay false until capture reports them.
        clickable=bool(node.get("clickable", False)),
        editable=bool(node.get("editable", role is UiRole.INPUT)),
        checkable=bool(node.get("checkable", False)),
        checked=node.get("checked"),
        selected=node.get("selected"),
        focusable=bool(node.get("focusable", False)),
        ancestor_labels=list(node.get("ancestorLabels", [])),
    )


def to_state_summary(capture: dict[str, Any]) -> StateSummary:
    """The compact form the ranking and explanation tasks consume."""
    visible_text: list[str] = []
    for node in capture.get("nodes", []):
        for key in ("text", "contentDescription"):
            value = node.get(key)
            if value and value not in visible_text:
                visible_text.append(value)
    for line in capture.get("ocrText", []) or []:
        if line and line not in visible_text:
            visible_text.append(line)

    return StateSummary(
        state_id=capture["id"],
        sequence=int(capture.get("sequence", 0)),
        package_name=capture.get("packageName"),
        window_title=capture.get("screenName"),
        visible_text=visible_text,
        semantic_fingerprint=capture.get("semanticFingerprint"),
    )


def to_audit_state(capture: dict[str, Any], display: DisplayMetrics) -> AuditState:
    """The accessibility auditor's input.

    Touch-target checks are in dp, so this is where display density stops being
    optional: a 48dp minimum cannot be evaluated from pixels alone.
    """
    return AuditState(
        state_id=capture["id"],
        window_title=capture.get("screenName"),
        display_width_dp=display.width_dp,
        display_height_dp=display.height_dp,
        nodes=[to_node_summary(node, display) for node in capture.get("nodes", [])],
    )
