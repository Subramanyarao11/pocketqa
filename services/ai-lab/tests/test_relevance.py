from __future__ import annotations

import pytest

from app.relevance import Intent, codes, is_dynamic, is_transient, score_text


def test_codes_are_case_sensitive_on_input_and_normalised_on_output():
    assert codes("Coupon SAVE20 applied") == {"save20"}
    assert codes("all lowercase save20") == set()  # not a code, just a word


@pytest.mark.parametrize(
    "text",
    ["Loading…", "Please wait while we retry", "Refreshing your cart"],
)
def test_transient_text_is_detected(text):
    assert is_transient(text)


@pytest.mark.parametrize(
    "text",
    ["Order ID 8f3a91c2e4b7d6a5", "Updated 12:45", "Placed on 2026-08-29", "3 minutes ago"],
)
def test_dynamic_text_is_detected(text):
    assert is_dynamic(text)


def test_stable_product_text_is_not_flagged():
    assert not is_dynamic("Total Rs 399")
    assert not is_transient("SAVE20 applied")


def test_code_match_outranks_generic_overlap():
    intent = Intent.parse("Coupon SAVE20 remains applied after retry")
    direct = score_text(intent, "Text 'SAVE20 applied' visible in the final cart", is_end_state=True)
    generic = score_text(intent, "Text 'Continue shopping' visible in the final cart", is_end_state=True)
    assert direct.score > generic.score


def test_top_reason_explains_the_penalty_not_a_weak_positive():
    intent = Intent.parse("Coupon SAVE20 remains applied after checkout fails and I retry")
    result = score_text(intent, "Text 'Order ID 8f3a91c2e4b7d6a5' visible in the cart",
                        is_end_state=True)
    assert "identifier" in result.top_reason()


def test_hinglish_function_words_do_not_dilute_overlap():
    """Without the romanised-Hindi stopword list, every Hinglish intent carries a
    long tail of meaningless tokens that shrinks real overlap."""
    hinglish = Intent.parse(
        "Checkout fail hone ke baad bhi SAVE20 coupon apply rehna chahiye retry ke baad"
    )
    assert "ke" not in hinglish.tokens
    assert "chahiye" not in hinglish.tokens
    assert {"checkout", "error", "coupon", "apply", "retry", "remain"} <= hinglish.tokens


def test_scaffolding_words_are_not_evidence():
    intent = Intent.parse("Verify the text is visible on the final screen")
    assert intent.tokens == set(), "an intent made only of scaffolding carries no signal"
