"""classify_flake — failure classification and cross-run triage.

Backlog: P1 Failure Detective, P2 Flaky-Test Triage. Track A tasks AI-A-12 and
AI-A-18.

Two separable jobs live here on purpose:

  classify()        deterministic, spec 23.2 rules. Never model-driven.
  minimize_steps()  deterministic, reproducible step ranking for the shortest
                    reproduction. Never model-driven.
  the LLM task      groups already-classified runs by shared cause and names the
                    group. Grouping is judgement; classification is evidence.

The class is placed in the closed vocabulary as `class:<runId>:<CLASS>`, so a
model that tries to reclassify a run is emitting an unsupplied identifier and
app.merge rejects the whole response. Spec 23.2 forbids the override; this is how
it is enforced rather than merely documented.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import FailureClass
from app.envelope import Envelope
from app.redaction import redact
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "classify_flake"
PROMPT_VERSION = "v2"


class RunFeatures(Contract):
    """Spec 23.1 deterministic features. Every field is observable by the
    executor without a model and without the network."""

    selector_resolution_count: int = Field(default=1, ge=0)
    similar_node_present: bool = False
    expected_fact_present: bool = False
    navigation_actions_succeeded: bool = True
    fingerprint_changed: bool = False
    window_changed: bool = False
    wait_elapsed_ms: int = Field(default=0, ge=0)
    wait_budget_ms: int = Field(default=5000, ge=0)
    appeared_after_budget: bool = False
    process_alive: bool = True
    crash_signal: bool = False
    fixture_reset_ok: bool = True
    started_in_expected_state: bool = True
    tree_available: bool = True
    screenshot_available: bool = True
    service_connected: bool = True
    screenshot_similarity: float | None = Field(default=None, ge=0.0, le=1.0)


class FailedRun(Contract):
    run_id: str
    step_index: int = Field(ge=0)
    step_label: str | None = None
    features: RunFeatures


class Request(Contract):
    runs: list[FailedRun] = Field(min_length=1, max_length=100)
    allowed_run_ids: list[str] = Field(min_length=1)
    max_groups: int = Field(default=6, ge=1, le=20)

    @model_validator(mode="after")
    def _runs_are_declared(self) -> Request:
        allowed = set(self.allowed_run_ids)
        supplied = {run.run_id for run in self.runs}
        if undeclared := supplied - allowed:
            raise ValueError(f"runs not present in allowedRunIds: {sorted(undeclared)}")
        return self


class ClassifiedRun(Contract):
    run_id: str
    failure_class: FailureClass
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_keys: list[str] = Field(default_factory=list)


class FailureGroup(Contract):
    group_id: str = Field(pattern=r"^g\d{1,3}$")
    title: str = Field(max_length=80)
    run_ids: list[str] = Field(min_length=1)
    shared_cause: str = Field(max_length=400)


class Response(BaseResponse):
    classified: list[ClassifiedRun] = Field(default_factory=list)
    groups: list[FailureGroup] = Field(default_factory=list)


def classify(run: FailedRun) -> ClassifiedRun:
    """Spec 23.2, evaluated in evidence-strength order.

    Order matters. A crashed process also looks like a navigation divergence and
    a capture limitation; checking the strongest signal first is what keeps the
    class stable across runs.
    """

    f = run.features
    keys: list[str] = []

    if f.crash_signal or not f.process_alive:
        keys = ["crashSignal", "processAlive"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.APP_CRASH,
            confidence=0.95, evidence_keys=keys,
        )

    if not f.service_connected or not f.tree_available:
        keys = ["serviceConnected", "treeAvailable"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.CAPTURE_LIMITATION,
            confidence=0.9, evidence_keys=keys,
        )

    if not f.fixture_reset_ok or not f.started_in_expected_state:
        keys = ["fixtureResetOk", "startedInExpectedState"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.FIXTURE_ENVIRONMENT,
            confidence=0.9, evidence_keys=keys,
        )

    # Selector drift: the approved target is gone but something very like it is
    # present, and the screen is otherwise the one we expected.
    if f.selector_resolution_count == 0 and f.similar_node_present and not f.window_changed:
        keys = ["selectorResolutionCount", "similarNodePresent", "windowChanged"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.SELECTOR_DRIFT,
            confidence=0.85, evidence_keys=keys,
        )

    if f.appeared_after_budget or (
        f.wait_budget_ms and f.wait_elapsed_ms >= f.wait_budget_ms and not f.expected_fact_present
    ):
        keys = ["appearedAfterBudget", "waitElapsedMs", "waitBudgetMs"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.TIMEOUT_PERFORMANCE,
            confidence=0.8, evidence_keys=keys,
        )

    if f.window_changed or (
        f.fingerprint_changed and not f.navigation_actions_succeeded
    ):
        keys = ["windowChanged", "fingerprintChanged", "navigationActionsSucceeded"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.NAVIGATION_DIVERGENCE,
            confidence=0.75, evidence_keys=keys,
        )

    if f.navigation_actions_succeeded and not f.expected_fact_present:
        keys = ["navigationActionsSucceeded", "expectedFactPresent"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.ASSERTION_REGRESSION,
            confidence=0.85, evidence_keys=keys,
        )

    if f.selector_resolution_count > 1:
        keys = ["selectorResolutionCount"]
        return ClassifiedRun(
            run_id=run.run_id, failure_class=FailureClass.SELECTOR_DRIFT,
            confidence=0.6, evidence_keys=keys,
        )

    return ClassifiedRun(
        run_id=run.run_id, failure_class=FailureClass.UNKNOWN,
        confidence=0.3, evidence_keys=[],
    )


def minimize_steps(
    step_labels: list[str],
    *,
    failing_step_index: int,
    steps_touching_target: set[int] | None = None,
) -> list[int]:
    """Rank steps by how safe they are to drop while hunting the shortest
    reproduction (task AI-A-12).

    Returns step indices in removal-attempt order, most-removable first. This is
    a *ranking*, not a decision: the executor still replays after each removal
    and keeps the reduction only if the failure survives.

    Deterministic and reproducible by construction — no model, no randomness, and
    ties broken by distance from the failing step.
    """

    touching = steps_touching_target or set()
    scored: list[tuple[float, int]] = []
    for index, _label in enumerate(step_labels):
        if index == failing_step_index:
            continue  # the failing step is never a removal candidate
        score = 1.0
        if index in touching:
            score -= 0.6  # interacts with the thing that broke; drop it last
        # Steps far in front of the failure are likelier to be incidental setup.
        score += 0.3 * (failing_step_index - index) / max(failing_step_index, 1)
        scored.append((score, index))

    scored.sort(key=lambda row: (-row[0], abs(failing_step_index - row[1])))
    return [index for _, index in scored]


def _group_deterministically(
    classified: list[ClassifiedRun], max_groups: int
) -> list[FailureGroup]:
    """Bucket by class plus evidence signature. Same input, same groups, always."""
    buckets: dict[tuple[str, tuple[str, ...]], list[str]] = {}
    for row in classified:
        key = (str(row.failure_class), tuple(row.evidence_keys))
        buckets.setdefault(key, []).append(row.run_id)

    groups: list[FailureGroup] = []
    for index, ((failure_class, keys), run_ids) in enumerate(
        sorted(buckets.items(), key=lambda item: (-len(item[1]), item[0][0])), start=1
    ):
        if index > max_groups:
            break
        pretty = failure_class.replace("_", " ").lower()
        groups.append(
            FailureGroup(
                group_id=f"g{index}",
                title=f"{pretty} ({len(run_ids)} run{'s' if len(run_ids) != 1 else ''})",
                run_ids=run_ids,
                shared_cause=(
                    f"Classified {pretty} from " + ", ".join(keys)
                    if keys
                    else f"Classified {pretty} with no distinguishing evidence."
                ),
            )
        )
    return groups


def deterministic(request: Request) -> Response:
    classified = [classify(run) for run in request.runs]
    return Response(
        classified=classified,
        groups=_group_deterministically(classified, request.max_groups),
        insufficient_evidence=False,
    )


def prompt(request: Request) -> Envelope:
    """Send pre-formed groups, not raw runs.

    The first version of this prompt sent every run with its full feature vector:
    5,379 tokens for twenty runs, four times the next largest task and growing
    linearly with run count. On device that is the first prompt that will not fit
    (spec 18.3 keeps envelopes compact for exactly this reason).

    It was also the wrong shape. Classification is deterministic and the model is
    forbidden from changing it, so the feature vectors were being sent to a model
    that must not act on them. Grouping them first means the prompt scales with
    the number of *causes* — capped at `max_groups` — instead of the number of
    runs, and the model does the job it is actually for: judging which groups are
    really one problem, and naming them.

    `audit_accessibility` uses the same division: rules find, model explains.
    """

    classified = [classify(run) for run in request.runs]
    by_id = {row.run_id: row for row in classified}
    groups = _group_deterministically(classified, request.max_groups)
    labels = {run.run_id: run.step_label for run in request.runs}

    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={
            "runId": list(request.allowed_run_ids),
            "fixedClassification": [
                f"{row.run_id} is classified {row.failure_class}; you may not change it"
                for row in classified
            ],
        },
        evidence=redact(
            {
                "maxGroups": request.max_groups,
                "candidateGroups": [
                    {
                        "groupId": group.group_id,
                        "failureClass": str(by_id[group.run_ids[0]].failure_class),
                        "runIds": group.run_ids,
                        "evidence": by_id[group.run_ids[0]].evidence_keys,
                        "steps": sorted({labels[r] for r in group.run_ids if labels.get(r)}),
                    }
                    for group in groups
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    tokens: set[str] = set(request.allowed_run_ids)
    for run in request.runs:
        tokens.add(f"class:{run.run_id}:{classify(run).failure_class}")
    return tokens


def referenced_ids(response: Response) -> set[str]:
    tokens: set[str] = set()
    for row in response.classified:
        tokens.add(row.run_id)
        tokens.add(f"class:{row.run_id}:{row.failure_class}")
    for group in response.groups:
        tokens |= set(group.run_ids)
    return tokens


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Classify failed runs by spec 23.2 rules and group them by shared cause.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
