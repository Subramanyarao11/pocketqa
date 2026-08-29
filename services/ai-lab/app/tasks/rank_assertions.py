"""rank_assertions — Technical Spec section 19.2, verbatim shapes.

Backlog: P0 Intent compiler. Track A tasks AI-A-05 (model path) and AI-A-06
(deterministic twin).

Deterministic candidates come from the compiler (spec 17.2). This task only
reorders them by intent relevance. It cannot create a candidate, and the merge
rule enforces that.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import AssertionKind
from app.envelope import Envelope
from app.redaction import redact
from app.relevance import Intent, score_text
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "rank_assertions"
PROMPT_VERSION = "v1"


class AssertionCandidate(Contract):
    id: str
    kind: AssertionKind
    fact: str = Field(description="One redacted sentence stating the observed fact.")
    source_state_id: str
    is_end_state: bool = Field(
        default=False,
        description="True when this fact was observed in the final state after the "
        "last relevant action. Drives the spec 17.3 end-state boost.",
    )


class Request(Contract):
    intent: str
    candidates: list[AssertionCandidate] = Field(min_length=1, max_length=40)
    allowed_candidate_ids: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _candidates_are_declared(self) -> Request:
        allowed = set(self.allowed_candidate_ids)
        supplied = {candidate.id for candidate in self.candidates}
        if undeclared := supplied - allowed:
            raise ValueError(
                f"candidates not present in allowedCandidateIds: {sorted(undeclared)}"
            )
        if len(supplied) != len(self.candidates):
            raise ValueError("duplicate candidate ids")
        return self


class RankedCandidate(Contract):
    candidate_id: str
    score: float = Field(ge=0.0, le=1.0)
    reason: str = Field(max_length=400)


class Response(BaseResponse):
    ranked: list[RankedCandidate] = Field(default_factory=list)


def deterministic(request: Request) -> Response:
    intent = Intent.parse(request.intent)
    scored: list[tuple[float, int, RankedCandidate]] = []

    for position, candidate in enumerate(request.candidates):
        result = score_text(intent, candidate.fact, is_end_state=candidate.is_end_state)
        scored.append(
            (
                result.score,
                position,
                RankedCandidate(
                    candidate_id=candidate.id,
                    score=result.score,
                    reason=result.top_reason(),
                ),
            )
        )

    # Descending score, then original order. Ties must break the same way on every
    # run and on both platforms, so never sort on the candidate id.
    scored.sort(key=lambda row: (-row[0], row[1]))
    return Response(ranked=[row[2] for row in scored], insufficient_evidence=False)


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={"candidateId": list(request.allowed_candidate_ids)},
        evidence=redact(
            {
                "intent": request.intent,
                "candidates": [
                    {
                        "id": candidate.id,
                        "kind": str(candidate.kind),
                        "fact": candidate.fact,
                        "sourceStateId": candidate.source_state_id,
                        "isEndState": candidate.is_end_state,
                    }
                    for candidate in request.candidates
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return set(request.allowed_candidate_ids)


def referenced_ids(response: Response) -> set[str]:
    return {row.candidate_id for row in response.ranked}


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Rank compiler-generated assertion candidates by intent relevance.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
