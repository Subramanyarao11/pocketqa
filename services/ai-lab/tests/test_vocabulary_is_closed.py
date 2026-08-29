"""Definition of done, Track A item 5: "No task can emit an identifier we did not
supply - proven by test, not by inspection."

One hostile response per registered task. Adding a task without adding its
hostile case fails `test_every_task_has_a_hostile_case`, so this file cannot
quietly fall behind the registry.
"""

from __future__ import annotations

import pytest

from app.merge import merge
from app.tasks import all_tasks, get

# Each entry: fixture path, and a response payload that references exactly one
# identifier the request never supplied.
HOSTILE: dict[str, tuple[str, dict]] = {
    "rank_assertions": (
        "coupon-retry/rank_assertions.request.json",
        {"ranked": [{"candidateId": "a404", "score": 1.0, "reason": "invented"}]},
    ),
    "compile_intent": (
        "coupon-retry/compile_intent.request.json",
        {"selected": [{"candidateId": "a404", "kind": "VISIBLE", "confidence": 1.0,
                       "rationale": "invented"}]},
    ),
    "explain_failure": (
        "coupon-retry/explain_failure.request.json",
        {"summary": "Something broke.", "citedFactIds": ["f404"],
         "suggestedNextStep": "look"},
    ),
    "repair_selector": (
        "mutations/m1_resource_id_renamed.json",
        {"ranked": [{"nodeId": "n_ghost", "score": 1.0, "reason": "invented"}]},
    ),
    "rank_explorer_candidate": (
        "explorer/e1_novel_branch.json",
        {"choice": "p_place_order", "reason": "invented"},
    ),
    "audit_accessibility": (
        None,
        {"annotated": [{"findingId": "f404", "severity": "CRITICAL", "explanation": "x"}]},
    ),
    "generate_edge_cases": (
        "coupon-retry/generate_edge_cases.request.json",
        {"variants": [{"variantId": "v1", "dimension": "LOCALE", "value": "fr-FR",
                       "rationale": "not in the allow-list", "expectedRisk": "HIGH"}]},
    ),
    "name_test": (
        "coupon-retry/name_test.request.json",
        {"name": "Wallet balance regression", "runSummary": "x", "changelogLine": "y"},
    ),
    "classify_flake": (
        "runs/classify_flake.request.json",
        {"classified": [{"runId": "r01", "failureClass": "APP_CRASH", "confidence": 0.9,
                         "evidenceKeys": []}],
         "groups": []},
    ),
}


def _audit_request(fixture):
    """Built through the real detect() path, like the eval harness does."""
    from app.tasks.audit_accessibility import AuditState, detect

    state = AuditState.model_validate(fixture("a11y/violations.json"))
    findings = detect(state)
    return {
        "stateSummary": "violations fixture",
        "findings": [f.model_dump(by_alias=True) for f in findings],
        "allowedFindingIds": [f.finding_id for f in findings],
    }


def test_every_task_has_a_hostile_case():
    assert set(HOSTILE) == set(all_tasks()), "a registered task has no hostile-response test"


@pytest.mark.parametrize("task_id", sorted(HOSTILE))
def test_out_of_vocabulary_response_is_rejected(task_id, fixture):
    spec = get(task_id)
    fixture_path, hostile_payload = HOSTILE[task_id]

    payload = _audit_request(fixture) if fixture_path is None else fixture(fixture_path)
    request = spec.parse_request(payload)
    response = spec.parse_response(hostile_payload)

    outcome = merge(spec, request, response)

    assert outcome.rejected, f"{task_id} accepted an unsupplied identifier"
    assert not outcome.used_model
    assert spec.referenced_ids(outcome.value) <= spec.allowed_ids(request)


@pytest.mark.parametrize("task_id", sorted(HOSTILE))
def test_deterministic_output_is_always_in_vocabulary(task_id, fixture):
    """The fallback must satisfy the same rule it enforces."""
    spec = get(task_id)
    fixture_path, _ = HOSTILE[task_id]
    payload = _audit_request(fixture) if fixture_path is None else fixture(fixture_path)
    request = spec.parse_request(payload)

    result = spec.deterministic(request)
    assert spec.referenced_ids(result) <= spec.allowed_ids(request)


@pytest.mark.parametrize("task_id", sorted(HOSTILE))
def test_deterministic_output_is_reproducible(task_id, fixture):
    """Same input, same bytes. The Kotlin port (AI-A-15) has to match this, and a
    ranker with an unstable tie-break can never be matched."""
    spec = get(task_id)
    fixture_path, _ = HOSTILE[task_id]
    payload = _audit_request(fixture) if fixture_path is None else fixture(fixture_path)
    request = spec.parse_request(payload)

    first = spec.deterministic(request).model_dump_json(by_alias=True)
    second = spec.deterministic(request).model_dump_json(by_alias=True)
    assert first == second
