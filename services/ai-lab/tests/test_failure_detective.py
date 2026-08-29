from __future__ import annotations

from app.domain import FailureClass
from app.tasks.classify_flake import FailedRun, RunFeatures, classify, minimize_steps


def run(**overrides) -> FailedRun:
    return FailedRun(run_id="r1", step_index=3, features=RunFeatures(**overrides))


def test_crash_wins_over_every_other_signal():
    """A crashed process also looks like a navigation divergence and a capture
    limitation. Ordering the rules by evidence strength is what keeps the class
    stable across runs."""
    result = classify(run(
        crash_signal=True, process_alive=False,
        window_changed=True, tree_available=False, expected_fact_present=False,
    ))
    assert result.failure_class is FailureClass.APP_CRASH


def test_selector_drift_needs_a_lookalike_on_the_same_screen():
    drift = classify(run(selector_resolution_count=0, similar_node_present=True))
    assert drift.failure_class is FailureClass.SELECTOR_DRIFT

    # Same missing selector, but the screen changed too: that is navigation,
    # not drift, and proposing a selector repair would be actively misleading.
    elsewhere = classify(run(
        selector_resolution_count=0, similar_node_present=True, window_changed=True,
    ))
    assert elsewhere.failure_class is FailureClass.NAVIGATION_DIVERGENCE


def test_assertion_regression_requires_successful_navigation():
    result = classify(run(navigation_actions_succeeded=True, expected_fact_present=False))
    assert result.failure_class is FailureClass.ASSERTION_REGRESSION


def test_unknown_is_returned_rather_than_a_guess():
    result = classify(run(navigation_actions_succeeded=True, expected_fact_present=True))
    assert result.failure_class is FailureClass.UNKNOWN
    assert result.confidence < 0.5


def test_minimisation_never_proposes_removing_the_failing_step():
    order = minimize_steps(["a", "b", "c", "d", "e"], failing_step_index=4)
    assert 4 not in order
    assert sorted(order) == [0, 1, 2, 3]


def test_minimisation_defers_steps_that_touch_the_broken_target():
    order = minimize_steps(
        ["open", "type coupon", "apply", "checkout", "assert"],
        failing_step_index=4,
        steps_touching_target={1, 2},
    )
    assert order.index(0) < order.index(2), "unrelated setup should be dropped first"
    assert order.index(3) < order.index(1)


def test_minimisation_is_deterministic():
    args = (["a", "b", "c", "d"],)
    kwargs = {"failing_step_index": 3, "steps_touching_target": {1}}
    assert minimize_steps(*args, **kwargs) == minimize_steps(*args, **kwargs)
