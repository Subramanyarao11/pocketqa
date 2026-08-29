"""name_test — readable test names, run summaries and changelog lines.

Backlog: quality-of-life. Track A task AI-A-20.

This task has no object ids to constrain, which makes it the odd one out: naming
is generative free text. Leaving it unconstrained would have made it the one task
where a model can invent a product term — "Checkout Wallet regression" for a test
that never touched a wallet — and a wrong name is worse than a dull one because
it is what someone reads when the test goes red six weeks later.

So the closed vocabulary is *words* rather than ids: the content tokens present
in the intent, the step labels and the observed facts, plus an explicit list of
connecting words a name legitimately needs. `referenced_ids` returns the content
tokens of whatever the model wrote, so a fabricated product term is an unsupplied
identifier and app.merge rejects it exactly like a fabricated candidate id.
"""

from __future__ import annotations

from pydantic import Field

from app import prompts
from app.envelope import Envelope
from app.redaction import redact
from app.relevance import content_tokens
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "name_test"
PROMPT_VERSION = "v1"

# Words a name needs that carry no product meaning of their own. Kept explicit:
# widening this list is how the vocabulary constraint quietly stops constraining.
CONNECTIVES: frozenset[str] = frozenset(
    """
    survives survive survived persists persist remains remain stays stay holds hold
    after before during while when despite across through with without still
    succeeds succeed fails fail failing shows show displays display applies apply
    added removed updated changed regression flow test case run step steps
    """.split()
)


class ObservedFact(Contract):
    id: str
    fact: str


class Request(Contract):
    intent: str
    step_labels: list[str] = Field(default_factory=list, max_length=40)
    observed_facts: list[ObservedFact] = Field(default_factory=list, max_length=40)
    assertion_count: int = Field(default=0, ge=0)
    passed: bool | None = None


class Response(BaseResponse):
    name: str = Field(default="", max_length=80)
    run_summary: str = Field(default="", max_length=300)
    changelog_line: str = Field(default="", max_length=120)


def _evidence_text(request: Request) -> str:
    return " ".join(
        [request.intent, *request.step_labels, *(f.fact for f in request.observed_facts)]
    )


def deterministic(request: Request) -> Response:
    """Names by trimming the intent rather than by generating.

    Unglamorous, and it produces a usable name every time with no model. That is
    the bar for a deterministic twin: not clever, always there.
    """

    words = [w for w in request.intent.split() if w.strip()]
    scaffolding = {"verify", "check", "ensure", "confirm", "test", "that", "the", "i", "and"}
    kept: list[str] = []
    for word in words:
        if word.lower().strip(",.") in scaffolding and not kept:
            continue  # only strip leading scaffolding; mid-sentence "and" reads fine
        kept.append(word)

    name = " ".join(kept).strip()
    if name:
        name = name[0].upper() + name[1:]
    if len(name) > 80:
        name = name[:77].rstrip() + "..."

    steps = len(request.step_labels)
    outcome = "" if request.passed is None else (" The run passed." if request.passed
                                                 else " The run failed.")
    lead = request.observed_facts[0].fact if request.observed_facts else request.intent
    summary = (
        f"{steps} step{'s' if steps != 1 else ''} and "
        f"{request.assertion_count} assertion"
        f"{'s' if request.assertion_count != 1 else ''} recorded. {lead}.{outcome}"
    )[:300]

    return Response(
        name=name or "Untitled test",
        run_summary=summary,
        changelog_line=f"Added test: {name}"[:120] if name else "Added test",
        insufficient_evidence=not name,
    )


def prompt(request: Request) -> Envelope:
    available = sorted(content_tokens(_evidence_text(request)))
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={
            "wordsFromEvidence": available,
            "connectingWords": sorted(CONNECTIVES),
        },
        evidence=redact(
            {
                "intent": request.intent,
                "stepLabels": request.step_labels,
                "assertionCount": request.assertion_count,
                "passed": request.passed,
                "observedFacts": [{"id": f.id, "fact": f.fact} for f in request.observed_facts],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return content_tokens(_evidence_text(request)) | CONNECTIVES


def referenced_ids(response: Response) -> set[str]:
    # Only the name is vocabulary-constrained. The summary and changelog line
    # restate the same evidence at greater length; constraining them word by word
    # would force stilted prose without adding a guarantee the name does not
    # already give.
    return content_tokens(response.name)


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Name a test and summarise its run using only words present in the evidence.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
