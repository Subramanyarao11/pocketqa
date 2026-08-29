"""compile_intent — natural-language intent to strict assertion JSON.

Backlog: P0 Intent compiler. Track A task AI-A-04.

The interesting design problem here is not selecting candidates; it is stopping
the model from inventing an *expected value*. "The total should be Rs 399" is a
perfectly fluent sentence and a completely fabricated assertion if 399 never
appeared on screen.

The fix reuses the generic merge rule instead of adding a special case. The
closed vocabulary carries three kinds of token:

    <candidateId>                     the candidate may be selected
    kind:<candidateId>:<KIND>         that candidate may carry that kind
    value:<candidateId>:<value>       that candidate may assert that exact value

so a fabricated kind or a fabricated expected value is an unsupplied identifier,
and app.merge rejects it exactly like a fabricated candidate id. No new
enforcement path, no second thing to keep correct.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import AssertionKind
from app.envelope import Envelope
from app.redaction import redact
from app.relevance import Intent, codes, score_text
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "compile_intent"
PROMPT_VERSION = "v3"

# Kinds whose assertion is meaningless without a value to compare against.
VALUE_KINDS: frozenset[AssertionKind] = frozenset(
    {AssertionKind.TEXT_EQUALS, AssertionKind.TEXT_CONTAINS}
)

# Deterministic preference when several kinds are available for one candidate.
# Presence first: it is the most robust thing to assert about a screen.
KIND_PREFERENCE: tuple[AssertionKind, ...] = (
    AssertionKind.VISIBLE,
    AssertionKind.CHECKED,
    AssertionKind.ENABLED,
    AssertionKind.TEXT_CONTAINS,
    AssertionKind.TEXT_EQUALS,
    AssertionKind.NOT_VISIBLE,
    AssertionKind.DISABLED,
    AssertionKind.STATE_FINGERPRINT,
    AssertionKind.IMAGE_REGION_SIMILAR,
)

SELECTION_THRESHOLD = 0.30


class IntentCandidate(Contract):
    id: str
    fact: str
    source_state_id: str
    allowed_kinds: list[AssertionKind] = Field(min_length=1)
    observed_value: str | None = Field(
        default=None,
        description="The exact on-screen value, verbatim. The only value this "
        "candidate is permitted to assert.",
    )
    selector_label: str | None = None
    is_end_state: bool = False


class Request(Contract):
    intent_text: str = Field(min_length=1)
    target_package: str
    candidates: list[IntentCandidate] = Field(min_length=1, max_length=40)
    allowed_candidate_ids: list[str] = Field(min_length=1)
    language_code: str | None = Field(
        default=None, description="BCP-47. Hinglish intents arrive as en-IN or hi-IN."
    )
    max_assertions: int = Field(default=4, ge=1, le=10)

    @model_validator(mode="after")
    def _candidates_are_declared(self) -> Request:
        allowed = set(self.allowed_candidate_ids)
        supplied = {candidate.id for candidate in self.candidates}
        if undeclared := supplied - allowed:
            raise ValueError(
                f"candidates not present in allowedCandidateIds: {sorted(undeclared)}"
            )
        return self


class CompiledAssertion(Contract):
    candidate_id: str
    kind: AssertionKind
    expected: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(max_length=400)


class Response(BaseResponse):
    selected: list[CompiledAssertion] = Field(default_factory=list)


def _pick_kind(candidate: IntentCandidate, intent: Intent) -> AssertionKind:
    allowed = set(candidate.allowed_kinds)
    # Assert an exact value only when the intent actually names that value.
    if candidate.observed_value and AssertionKind.TEXT_EQUALS in allowed:
        if intent.codes & codes(candidate.observed_value):
            return AssertionKind.TEXT_EQUALS
    for kind in KIND_PREFERENCE:
        if kind in allowed:
            return kind
    return candidate.allowed_kinds[0]


def deterministic(request: Request) -> Response:
    intent = Intent.parse(request.intent_text)

    scored: list[tuple[float, int, IntentCandidate, str]] = []
    for position, candidate in enumerate(request.candidates):
        result = score_text(intent, candidate.fact, is_end_state=candidate.is_end_state)
        scored.append((result.score, position, candidate, result.top_reason()))
    scored.sort(key=lambda row: (-row[0], row[1]))

    picked = [row for row in scored if row[0] >= SELECTION_THRESHOLD][: request.max_assertions]

    if not picked:
        # The intent does not describe anything we observed. Declining is the
        # correct product behaviour; inventing an assertion here is how a test
        # suite silently starts asserting nothing.
        return Response(selected=[], insufficient_evidence=True)

    # Spec 17.2: a draft must carry at least one end-state assertion.
    if not any(row[2].is_end_state for row in picked):
        end_state = next((row for row in scored if row[2].is_end_state), None)
        if end_state is not None:
            picked = (picked + [end_state])[: max(request.max_assertions, len(picked) + 1)]

    selected: list[CompiledAssertion] = []
    for score, _, candidate, reason in picked:
        kind = _pick_kind(candidate, intent)
        selected.append(
            CompiledAssertion(
                candidate_id=candidate.id,
                kind=kind,
                expected=candidate.observed_value if kind in VALUE_KINDS else None,
                confidence=score,
                rationale=reason,
            )
        )
    return Response(selected=selected, insufficient_evidence=False)


def prompt(request: Request) -> Envelope:
    # Presented as readable statements, not as the internal `kind:a1:VISIBLE`
    # tokens `allowed_ids` uses for enforcement. Two separate models copied the
    # token prefix straight into the output field — first `expected`, then
    # `kind`. Twice is the format being wrong rather than the wording.
    vocabulary: dict[str, list[str]] = {
        "candidateId": list(request.allowed_candidate_ids),
        "kindPerCandidate": [
            f"{candidate.id} may use kind: "
            + ", ".join(str(kind) for kind in candidate.allowed_kinds)
            for candidate in request.candidates
        ],
        "expectedValuePerCandidate": [
            f'{candidate.id} may assert exactly: "{candidate.observed_value}"'
            for candidate in request.candidates
            if candidate.observed_value is not None
        ],
    }
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary=vocabulary,
        evidence=redact(
            {
                "intent": request.intent_text,
                "languageCode": request.language_code,
                "targetPackage": request.target_package,
                "maxAssertions": request.max_assertions,
                "candidates": [
                    {
                        "id": candidate.id,
                        "fact": candidate.fact,
                        "sourceStateId": candidate.source_state_id,
                        "allowedKinds": [str(k) for k in candidate.allowed_kinds],
                        "observedValue": candidate.observed_value,
                        "selectorLabel": candidate.selector_label,
                        "isEndState": candidate.is_end_state,
                    }
                    for candidate in request.candidates
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    tokens: set[str] = set(request.allowed_candidate_ids)
    for candidate in request.candidates:
        tokens |= {f"kind:{candidate.id}:{kind}" for kind in candidate.allowed_kinds}
        if candidate.observed_value is not None:
            tokens.add(f"value:{candidate.id}:{candidate.observed_value}")
    return tokens


def referenced_ids(response: Response) -> set[str]:
    tokens: set[str] = set()
    for assertion in response.selected:
        tokens.add(assertion.candidate_id)
        tokens.add(f"kind:{assertion.candidate_id}:{assertion.kind}")
        if assertion.expected is not None:
            tokens.add(f"value:{assertion.candidate_id}:{assertion.expected}")
    return tokens


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Compile a stated intent into grounded assertions over observed candidates.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
