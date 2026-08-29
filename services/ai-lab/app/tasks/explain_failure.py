"""explain_failure — the evidence writer.

Backlog: P0 Evidence writer. Track A task AI-A-07.

Ground rule from spec 23.2: the model may write the plain-language summary from
the structured facts, but it cannot override the failure class. So the class
arrives in the request already decided, and the model's closed vocabulary is the
set of fact ids it is allowed to cite. A summary that cites nothing, or cites a
fact we did not supply, is rejected and the deterministic sentence is used.

The model may still disagree — `classificationDisputed` exists so that
disagreement is recorded rather than silently discarded — but disputing is a flag
on the output, not a rewrite of the class.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from app import prompts
from app.domain import FailureClass
from app.envelope import Envelope
from app.redaction import redact
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "explain_failure"
PROMPT_VERSION = "v1"


class FactSource(StrEnum):
    STATE_DIFF = "STATE_DIFF"
    SELECTOR = "SELECTOR"
    TIMING = "TIMING"
    DEVICE = "DEVICE"
    FIXTURE = "FIXTURE"
    CAPTURE = "CAPTURE"
    ASSERTION = "ASSERTION"


NEXT_STEP: dict[FailureClass, str] = {
    FailureClass.SELECTOR_DRIFT: (
        "Review the selector repair proposal for this step before re-running."
    ),
    FailureClass.ASSERTION_REGRESSION: (
        "Compare the failing state against the approved evidence for this assertion; "
        "this looks like a real product change."
    ),
    FailureClass.NAVIGATION_DIVERGENCE: (
        "Check whether the flow reached the expected screen at all, and whether the "
        "fixture started in the right state."
    ),
    FailureClass.TIMEOUT_PERFORMANCE: (
        "Raise the wait budget for this step, or check what made the screen slow on "
        "this device."
    ),
    FailureClass.APP_CRASH: (
        "Pull the crash log for the target process; the test cannot proceed past a "
        "dead window."
    ),
    FailureClass.FIXTURE_ENVIRONMENT: (
        "Reset the fixture and confirm the run starts from the approved precondition."
    ),
    FailureClass.CAPTURE_LIMITATION: (
        "Confirm the accessibility service is connected and re-run; this failure is "
        "about PocketQA's capture, not the app."
    ),
    FailureClass.UNKNOWN: (
        "Re-run with capture enabled; the current evidence does not identify a cause."
    ),
}

CLASS_SENTENCE: dict[FailureClass, str] = {
    FailureClass.SELECTOR_DRIFT: (
        "The control the test targets is no longer identified by the approved selector."
    ),
    FailureClass.ASSERTION_REGRESSION: (
        "Navigation succeeded, so the app reached the right screen and the expected "
        "fact was simply not true there."
    ),
    FailureClass.NAVIGATION_DIVERGENCE: (
        "The run never reached the screen the assertion describes."
    ),
    FailureClass.TIMEOUT_PERFORMANCE: (
        "The expected screen did not settle inside the wait budget for this step."
    ),
    FailureClass.APP_CRASH: "The target app process disappeared during the run.",
    FailureClass.FIXTURE_ENVIRONMENT: (
        "The run did not start from the approved precondition."
    ),
    FailureClass.CAPTURE_LIMITATION: (
        "PocketQA could not observe the screen well enough to judge this step."
    ),
    FailureClass.UNKNOWN: "The evidence does not identify a single cause.",
}


class EvidenceFact(Contract):
    id: str
    source: FactSource
    statement: str = Field(max_length=300)


class FailedAssertionSummary(Contract):
    label: str
    expected: str | None = None
    observed: str | None = None
    evidence_state_id: str | None = None


class DeviceContext(Contract):
    manufacturer: str | None = None
    model: str | None = None
    android_version: str | None = None
    locale: str | None = None
    orientation: str | None = None
    network_state: str | None = None


class Request(Contract):
    intent: str
    failure_class: FailureClass
    step_label: str | None = None
    failed_assertion: FailedAssertionSummary | None = None
    facts: list[EvidenceFact] = Field(min_length=1, max_length=30)
    allowed_fact_ids: list[str] = Field(min_length=1)
    device_context: DeviceContext | None = None

    @model_validator(mode="after")
    def _facts_are_declared(self) -> Request:
        allowed = set(self.allowed_fact_ids)
        supplied = {fact.id for fact in self.facts}
        if undeclared := supplied - allowed:
            raise ValueError(f"facts not present in allowedFactIds: {sorted(undeclared)}")
        return self


class Response(BaseResponse):
    summary: str = Field(default="", max_length=800)
    cited_fact_ids: list[str] = Field(default_factory=list)
    suggested_next_step: str = Field(default="", max_length=400)
    classification_disputed: bool = False


def deterministic(request: Request) -> Response:
    """A real explanation assembled from the structured facts, not a placeholder.

    This is what ships when the device is offline, so it has to read like
    something a person would want to receive.
    """

    sentences: list[str] = []
    cited: list[str] = []

    assertion = request.failed_assertion
    if assertion is not None:
        if assertion.expected and assertion.observed:
            sentences.append(
                f"{assertion.label} expected {assertion.expected!r} "
                f"but observed {assertion.observed!r}."
            )
        elif assertion.expected:
            sentences.append(
                f"{assertion.label} expected {assertion.expected!r}, which was not present."
            )
        else:
            sentences.append(f"{assertion.label} did not hold.")
    elif request.step_label:
        sentences.append(f"The run stopped at {request.step_label!r}.")
    else:
        sentences.append(f"The run failed while checking: {request.intent}")

    sentences.append(CLASS_SENTENCE[request.failure_class])

    # Cite the facts that actually carry this class, in a stable order.
    priority = _priority_sources(request.failure_class)
    ordered = sorted(
        request.facts,
        key=lambda fact: (
            priority.index(fact.source) if fact.source in priority else len(priority),
            request.facts.index(fact),
        ),
    )
    for fact in ordered[:3]:
        sentences.append(fact.statement.rstrip("."). rstrip() + ".")
        cited.append(fact.id)

    return Response(
        summary=" ".join(sentences),
        cited_fact_ids=cited,
        suggested_next_step=NEXT_STEP[request.failure_class],
        classification_disputed=False,
        insufficient_evidence=False,
    )


def _priority_sources(failure_class: FailureClass) -> tuple[FactSource, ...]:
    match failure_class:
        case FailureClass.SELECTOR_DRIFT:
            return (FactSource.SELECTOR, FactSource.STATE_DIFF, FactSource.ASSERTION)
        case FailureClass.ASSERTION_REGRESSION:
            return (FactSource.ASSERTION, FactSource.STATE_DIFF, FactSource.SELECTOR)
        case FailureClass.NAVIGATION_DIVERGENCE:
            return (FactSource.STATE_DIFF, FactSource.SELECTOR, FactSource.FIXTURE)
        case FailureClass.TIMEOUT_PERFORMANCE:
            return (FactSource.TIMING, FactSource.STATE_DIFF, FactSource.DEVICE)
        case FailureClass.APP_CRASH:
            return (FactSource.DEVICE, FactSource.CAPTURE, FactSource.STATE_DIFF)
        case FailureClass.FIXTURE_ENVIRONMENT:
            return (FactSource.FIXTURE, FactSource.STATE_DIFF, FactSource.DEVICE)
        case FailureClass.CAPTURE_LIMITATION:
            return (FactSource.CAPTURE, FactSource.DEVICE, FactSource.TIMING)
        case _:
            return (FactSource.STATE_DIFF, FactSource.ASSERTION, FactSource.TIMING)


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={"factId": list(request.allowed_fact_ids)},
        evidence=redact(
            {
                "intent": request.intent,
                "failureClass": str(request.failure_class),
                "stepLabel": request.step_label,
                "failedAssertion": request.failed_assertion.model_dump(by_alias=True)
                if request.failed_assertion
                else None,
                "facts": [
                    {"id": f.id, "source": str(f.source), "statement": f.statement}
                    for f in request.facts
                ],
                "deviceContext": request.device_context.model_dump(by_alias=True)
                if request.device_context
                else None,
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return set(request.allowed_fact_ids)


def referenced_ids(response: Response) -> set[str]:
    return set(response.cited_fact_ids)


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Explain a failed run from its classification and structured facts.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
