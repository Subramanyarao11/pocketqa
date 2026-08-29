"""Capture adapter — Track A task AI-A-14.

The seam between what the phone records and what the reasoning tasks consume.
These tests exist because the corpus stops being hand-authored the moment this
conversion is trusted, so a silent misconversion would poison every eval at once.
"""

from __future__ import annotations

import pytest

from app.capture_adapter import (
    DisplayMetrics,
    normalize_role,
    to_audit_state,
    to_bounds_ratio,
    to_node_summary,
    to_state_summary,
)
from app.domain import UiRole

DISPLAY = DisplayMetrics(1080, 2400, 2.625)


def capture(**overrides) -> dict:
    payload = {
        "id": "s5",
        "packageName": "com.techphantoms.pocketqa.demoshop",
        "screenName": "Cart",
        "capturedAt": 1_700_000_000,
        "ocrText": ["Total Rs 399"],
        "nodes": [
            {
                "nodeId": "n1", "role": "Button", "text": "Apply",
                "resourceId": "com.x:id/applyCoupon", "enabled": True, "visible": True,
                "bounds": {"x": 820, "y": 900, "w": 200, "h": 160}, "sensitive": False,
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_bounds_become_ratios_not_pixels():
    """Absolute coordinates must never reach a prompt — a coordinate is one
    careless integration away from being an action (spec §22.3)."""
    ratio = to_bounds_ratio({"x": 540, "y": 1200, "w": 108, "h": 240}, DISPLAY)
    assert ratio is not None
    assert ratio.x == pytest.approx(0.5)
    assert ratio.y == pytest.approx(0.5)
    assert ratio.width == pytest.approx(0.1)
    assert ratio.height == pytest.approx(0.1)


def test_bounds_are_clamped_when_capture_overflows_the_display():
    """A node partly off-screen must not produce a ratio above 1, which would
    fail BoundsRatio validation and drop an otherwise usable state."""
    ratio = to_bounds_ratio({"x": 1000, "y": 2300, "w": 500, "h": 500}, DISPLAY)
    assert ratio is not None
    assert 0.0 <= ratio.x <= 1.0 and 0.0 <= ratio.width <= 1.0
    assert 0.0 <= ratio.y <= 1.0 and 0.0 <= ratio.height <= 1.0


@pytest.mark.parametrize(
    "raw,expected",
    [("Button", UiRole.BUTTON), ("EditText", UiRole.INPUT), ("recyclerview", UiRole.LIST),
     ("list_item", UiRole.LIST_ITEM), ("Switch", UiRole.SWITCH)],
)
def test_known_roles_map_to_the_closed_set(raw, expected):
    assert normalize_role(raw) is expected


def test_unknown_role_becomes_unknown_not_a_guess():
    """Coercing an unrecognised role to a plausible neighbour would silently
    change selector scoring and accessibility rules."""
    assert normalize_role("CoordinatorLayout") is UiRole.UNKNOWN
    assert normalize_role(None) is UiRole.UNKNOWN


def test_missing_bounds_is_none_not_zero():
    node = to_node_summary({"nodeId": "n1", "role": "Text"}, DISPLAY)
    assert node.bounds is None, "a zeroed bounds would read as a real 0x0 target"


def test_affordances_default_false_rather_than_being_inferred():
    """Capture does not report clickable/focusable yet. Inferring them from the
    role would manufacture accessibility findings the tree does not support."""
    node = to_node_summary({"nodeId": "n1", "role": "Button"}, DISPLAY)
    assert node.clickable is False
    assert node.focusable is False


def test_state_summary_merges_tree_text_and_ocr_without_duplicates():
    payload = capture()
    payload["ocrText"] = ["Total Rs 399", "Apply"]
    summary = to_state_summary(payload)
    assert summary.visible_text == ["Apply", "Total Rs 399"]
    assert summary.window_title == "Cart"


def test_audit_state_carries_dp_so_touch_targets_are_checkable():
    state = to_audit_state(capture(), DISPLAY)
    assert state.display_width_dp == pytest.approx(1080 / 2.625)
    assert state.display_height_dp == pytest.approx(2400 / 2.625)


def test_converted_state_feeds_the_accessibility_rules_end_to_end():
    """The point of the adapter: a real capture becomes task input."""
    from app.tasks.audit_accessibility import detect

    payload = capture()
    payload["nodes"].append({
        "nodeId": "n2", "role": "Button", "enabled": True, "visible": True,
        "clickable": True, "focusable": True,
        "bounds": {"x": 20, "y": 20, "w": 40, "h": 40},
    })
    findings = detect(to_audit_state(payload, DISPLAY))
    rules = {f.rule_id for f in findings}
    # n2 is unlabelled and roughly 15x15dp: both rules must fire.
    assert "A11Y-001" in rules
    assert "A11Y-002" in rules


def test_display_metrics_rejects_a_zero_display():
    with pytest.raises(ValueError):
        DisplayMetrics(0, 100)
