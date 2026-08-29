"""name_test is the one task with no object ids to constrain, so its vocabulary
is words. These tests pin that guarantee, because it is the task where a
plausible-sounding wrong answer does the most quiet damage: a bad name is what
someone reads when the test goes red six weeks later.
"""

from __future__ import annotations

from app.merge import merge
from app.tasks import get
from app.tasks.name_test import Request, Response, deterministic

INTENT = "Verify SAVE20 remains applied after checkout fails and I retry"
STEPS = ["Apply coupon", "Checkout", "Place order", "Retry"]


def _request(**overrides) -> Request:
    payload = {
        "intent": INTENT,
        "stepLabels": STEPS,
        "observedFacts": [{"id": "a1", "fact": "Text 'SAVE20 applied' visible in the final cart"}],
        "assertionCount": 2,
        "passed": True,
    }
    payload.update(overrides)
    return Request.model_validate(payload)


def test_deterministic_name_strips_leading_scaffolding():
    result = deterministic(_request())
    assert result.name.startswith("SAVE20")
    assert "Verify" not in result.name


def test_deterministic_summary_reports_shape_of_the_run():
    result = deterministic(_request())
    assert "4 steps" in result.run_summary
    assert "2 assertions" in result.run_summary
    assert "passed" in result.run_summary


def test_name_is_capped_at_eighty_characters():
    long_intent = "Verify " + " ".join(["coupon"] * 40)
    result = deterministic(_request(intent=long_intent))
    assert len(result.name) <= 80


def test_a_fabricated_product_term_is_rejected():
    """"Wallet" and "balance" appear nowhere in the coupon-retry evidence."""
    spec = get("name_test")
    request = _request()
    response = Response(
        name="Wallet balance regression", run_summary="x", changelog_line="y"
    )

    outcome = merge(spec, request, response)

    assert outcome.rejected
    assert {"wallet", "balance"} <= outcome.unknown_ids
    assert outcome.value.name.startswith("SAVE20"), "must fall back to the grounded name"


def test_a_grounded_name_is_accepted():
    spec = get("name_test")
    request = _request()
    response = Response(
        name="Coupon SAVE20 survives checkout retry", run_summary="x", changelog_line="y"
    )

    outcome = merge(spec, request, response)

    assert outcome.used_model
    assert not outcome.rejected


def test_connectives_are_allowed_without_appearing_in_evidence():
    """"survives" is not in the intent or the step labels, but a name needs it."""
    spec = get("name_test")
    assert "survives" in spec.allowed_ids(_request())
