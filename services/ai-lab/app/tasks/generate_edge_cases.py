"""generate_edge_cases — bounded experiment matrix.

Backlog: P2 Edge-Case Generator. Track A task AI-A-17.

Every variant is a proposal for a human to approve; none of them runs
automatically. The matrix is capped in the schema rather than in a prompt
instruction, because "return at most N" is a request to a model and a guarantee
in a schema.

Dimension values come from an allow-list supplied by the caller. A model cannot
propose a locale we do not support or a permission we do not know how to revoke,
because those strings are not in its vocabulary.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import EdgeCaseDimension, RiskLevel
from app.envelope import Envelope
from app.redaction import redact
from app.relevance import Intent, content_tokens
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "generate_edge_cases"
PROMPT_VERSION = "v1"

# Signals that make a dimension worth probing for a given flow. Deliberately
# small and readable: this table is the deterministic twin's entire judgement.
DIMENSION_TRIGGERS: dict[EdgeCaseDimension, tuple[str, ...]] = {
    EdgeCaseDimension.NETWORK: ("retry", "error", "checkout", "loading", "apply"),
    EdgeCaseDimension.LOCALE: ("total", "coupon", "checkout", "cart"),
    EdgeCaseDimension.INPUT: ("coupon", "login", "apply"),
    EdgeCaseDimension.PERMISSION: ("checkout", "login"),
    EdgeCaseDimension.SAVED_STATE: ("remain", "cart", "coupon"),
}

DIMENSION_RATIONALE: dict[EdgeCaseDimension, str] = {
    EdgeCaseDimension.NETWORK: (
        "This flow depends on a request that can fail; changing when it fails "
        "changes which state the assertion runs against."
    ),
    EdgeCaseDimension.LOCALE: (
        "Translated labels are longer and can clip or move the control this test taps."
    ),
    EdgeCaseDimension.INPUT: (
        "The flow accepts typed input, so boundary values reach validation the "
        "recorded run never exercised."
    ),
    EdgeCaseDimension.PERMISSION: (
        "A denied permission changes the screen the flow lands on."
    ),
    EdgeCaseDimension.SAVED_STATE: (
        "The intent is about something persisting, so restoring from saved state "
        "is the direct way to break it."
    ),
}


class Request(Contract):
    intent: str
    test_name: str | None = None
    step_labels: list[str] = Field(default_factory=list, max_length=40)
    dimensions: list[EdgeCaseDimension] = Field(min_length=1)
    allowed_dimension_values: dict[EdgeCaseDimension, list[str]]
    max_variants: int = Field(default=6, ge=1, le=20)

    @model_validator(mode="after")
    def _dimensions_have_values(self) -> Request:
        missing = [d for d in self.dimensions if not self.allowed_dimension_values.get(d)]
        if missing:
            raise ValueError(f"dimensions with no allowed values: {sorted(missing)}")
        return self


class Variant(Contract):
    variant_id: str = Field(pattern=r"^v\d{1,3}$")
    dimension: EdgeCaseDimension
    value: str
    rationale: str = Field(max_length=400)
    expected_risk: RiskLevel = RiskLevel.MEDIUM


class Response(BaseResponse):
    variants: list[Variant] = Field(default_factory=list)


def deterministic(request: Request) -> Response:
    intent = Intent.parse(request.intent)
    flow_tokens = set(intent.tokens)
    for label in request.step_labels:
        flow_tokens |= content_tokens(label)

    # Rank dimensions by how many of their trigger terms this flow actually
    # contains, then take values in the order the caller supplied them.
    ranked: list[tuple[int, int, EdgeCaseDimension]] = []
    for position, dimension in enumerate(request.dimensions):
        triggers = set(DIMENSION_TRIGGERS.get(dimension, ()))
        ranked.append((len(triggers & flow_tokens), -position, dimension))
    ranked.sort(reverse=True)

    variants: list[Variant] = []
    counter = 0
    # Round-robin across dimensions so a single dimension cannot fill the matrix.
    depth = 0
    while len(variants) < request.max_variants:
        progressed = False
        for hits, _, dimension in ranked:
            values = request.allowed_dimension_values[dimension]
            if depth >= len(values):
                continue
            progressed = True
            counter += 1
            variants.append(
                Variant(
                    variant_id=f"v{counter}",
                    dimension=dimension,
                    value=values[depth],
                    rationale=DIMENSION_RATIONALE[dimension],
                    expected_risk=RiskLevel.HIGH if hits >= 2 else RiskLevel.MEDIUM,
                )
            )
            if len(variants) >= request.max_variants:
                break
        if not progressed:
            break
        depth += 1

    if not variants:
        return Response(variants=[], insufficient_evidence=True)
    return Response(variants=variants, insufficient_evidence=False)


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={
            "dimensionValue": [
                f"{dimension}:{value}"
                for dimension in request.dimensions
                for value in request.allowed_dimension_values[dimension]
            ]
        },
        evidence=redact(
            {
                "intent": request.intent,
                "testName": request.test_name,
                "stepLabels": request.step_labels,
                "maxVariants": request.max_variants,
                "allowedDimensionValues": {
                    str(dimension): request.allowed_dimension_values[dimension]
                    for dimension in request.dimensions
                },
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return {
        f"{dimension}:{value}"
        for dimension in request.dimensions
        for value in request.allowed_dimension_values[dimension]
    }


def referenced_ids(response: Response) -> set[str]:
    return {f"{variant.dimension}:{variant.value}" for variant in response.variants}


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Propose bounded locale, network, input, permission and saved-state variants.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
