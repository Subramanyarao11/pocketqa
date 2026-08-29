"""rank_explorer_candidate — Technical Spec section 19.3, verbatim shapes.

Backlog: P1 Explorer Agent. Track A tasks AI-A-09 (model path) and AI-A-10
(deterministic novelty and goal-progress scoring).

The model receives a prefiltered array and returns one proposal id or STOP. It
never sees the screen, never sees coordinates, and never sees a candidate that
failed the safety prefilter (spec 22.1, 22.2). Choosing between already-safe
options is the entire job; safety is not delegated to it.

The policy engine re-evaluates the chosen proposal against the live state and may
refuse it (spec 22.5). Nothing here is an authorisation to act.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import RiskLevel
from app.envelope import Envelope
from app.redaction import redact
from app.relevance import Intent, score_text
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "rank_explorer_candidate"
PROMPT_VERSION = "v1"

STOP = "STOP"

# Below this, spending an action from the budget is worse than stopping with the
# graph we already have. Spec 22.6 prefers stopping at the first useful state.
MIN_WORTHWHILE_SCORE = 0.25

RISK_PENALTY: dict[RiskLevel, float] = {
    RiskLevel.LOW: 0.0,
    RiskLevel.MEDIUM: 0.25,
    RiskLevel.HIGH: 0.60,
    RiskLevel.BLOCKED: 1.0,
}


class SafeCandidate(Contract):
    proposal_id: str
    label: str
    risk: RiskLevel = RiskLevel.LOW
    novelty: float = Field(ge=0.0, le=1.0)
    reversible_likelihood: float = Field(default=0.8, ge=0.0, le=1.0)
    selector_stability: float = Field(default=0.8, ge=0.0, le=1.0)
    visit_count: int = Field(default=0, ge=0)


class Request(Contract):
    goal: str
    state_summary: str
    safe_candidates: list[SafeCandidate] = Field(min_length=1, max_length=25)
    remaining_actions: int = Field(ge=0, le=5)

    @model_validator(mode="after")
    def _no_blocked_candidate(self) -> Request:
        # A BLOCKED candidate must never have survived the prefilter. Reaching
        # this task means the caller has a bug, and failing loudly here is much
        # better than ranking it and hoping policy catches it later.
        blocked = [c.proposal_id for c in self.safe_candidates if c.risk is RiskLevel.BLOCKED]
        if blocked:
            raise ValueError(f"blocked candidates reached the ranker: {blocked}")
        return self


class Response(BaseResponse):
    choice: str = Field(default=STOP, description="A supplied proposalId, or the literal STOP.")
    reason: str = Field(default="", max_length=400)


def _score(request: Request, intent: Intent, candidate: SafeCandidate) -> float:
    """Spec 22.3 base score, weights unchanged."""
    relevance = score_text(intent, candidate.label).score
    revisit_penalty = min(0.30, 0.15 * candidate.visit_count)
    score = (
        0.40 * candidate.novelty
        + 0.25 * relevance
        + 0.20 * candidate.reversible_likelihood
        + 0.15 * candidate.selector_stability
        - revisit_penalty
        - RISK_PENALTY[candidate.risk]
    )
    return max(0.0, min(1.0, round(score, 4)))


def deterministic(request: Request) -> Response:
    if request.remaining_actions <= 0:
        return Response(choice=STOP, reason="Action budget exhausted.", insufficient_evidence=False)

    intent = Intent.parse(request.goal)
    scored = sorted(
        ((_score(request, intent, c), position, c) for position, c in enumerate(request.safe_candidates)),
        key=lambda row: (-row[0], row[1]),
    )

    best_score, _, best = scored[0]
    if best_score < MIN_WORTHWHILE_SCORE:
        return Response(
            choice=STOP,
            reason="No remaining candidate is likely to reach a new state worth testing.",
            insufficient_evidence=False,
        )

    return Response(
        choice=best.proposal_id,
        reason=f"Highest novelty and goal relevance among safe candidates ({best_score:.2f}).",
        insufficient_evidence=False,
    )


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={
            "choice": [c.proposal_id for c in request.safe_candidates] + [STOP],
        },
        evidence=redact(
            {
                "goal": request.goal,
                "stateSummary": request.state_summary,
                "remainingActions": request.remaining_actions,
                "safeCandidates": [
                    {
                        "proposalId": c.proposal_id,
                        "label": c.label,
                        "risk": str(c.risk),
                        "novelty": c.novelty,
                    }
                    for c in request.safe_candidates
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return {c.proposal_id for c in request.safe_candidates} | {STOP}


def referenced_ids(response: Response) -> set[str]:
    return {response.choice}


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Choose the next explorer action from prefiltered safe candidates, or stop.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
