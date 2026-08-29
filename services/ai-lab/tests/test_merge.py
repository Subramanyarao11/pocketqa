"""The merge rule is the safety boundary. These tests are the proof that an
identifier we never supplied cannot reach the product, and they must never be
weakened to accommodate a model that "usually" behaves.
"""

from __future__ import annotations

import pytest

from app.merge import merge
from app.tasks import get
from app.tasks.rank_assertions import RankedCandidate, Response


@pytest.fixture
def spec():
    return get("rank_assertions")


@pytest.fixture
def request_obj(spec, fixture):
    return spec.parse_request(fixture("coupon-retry/rank_assertions.request.json"))


def test_valid_response_is_accepted(spec, request_obj):
    response = Response(
        ranked=[RankedCandidate(candidate_id="a1", score=0.9, reason="direct")],
    )
    outcome = merge(spec, request_obj, response)

    assert outcome.used_model
    assert not outcome.rejected
    assert outcome.value is response


def test_fabricated_id_is_rejected_and_falls_back(spec, request_obj):
    response = Response(
        ranked=[
            RankedCandidate(candidate_id="a1", score=0.9, reason="direct"),
            RankedCandidate(candidate_id="a99", score=0.8, reason="invented"),
        ],
    )
    outcome = merge(spec, request_obj, response)

    assert outcome.rejected
    assert outcome.unknown_ids == frozenset({"a99"})
    assert not outcome.used_model
    # The user still gets a ranking. Rejection is silent to them by design.
    assert outcome.value.ranked
    assert {row.candidate_id for row in outcome.value.ranked} <= spec.allowed_ids(request_obj)


def test_engine_failure_falls_back_without_rejection(spec, request_obj):
    outcome = merge(spec, request_obj, None)

    assert not outcome.used_model
    assert not outcome.rejected
    assert outcome.value.ranked


def test_insufficient_evidence_uses_rules_not_an_error(spec, request_obj):
    outcome = merge(spec, request_obj, Response(ranked=[], insufficient_evidence=True))

    assert not outcome.used_model
    assert not outcome.rejected
    assert outcome.rejection_reason == "insufficient_evidence"
    assert outcome.value.ranked, "declining must still return the deterministic answer"


def test_rejection_is_recorded_in_provenance(spec, request_obj):
    from app.engines.base import InferenceProvenance

    response = Response(ranked=[RankedCandidate(candidate_id="zzz", score=1.0, reason="x")])
    outcome = merge(spec, request_obj, response)
    provenance = outcome.annotate(InferenceProvenance(engine_id="test"))

    assert provenance.output_rejected is True
    assert "zzz" in provenance.rejection_reason
