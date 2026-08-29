"""repair_selector — selector self-heal.

Backlog: P1 Selector Self-Heal. Track A task AI-A-11.

Output is always a *proposal*. Safety invariant 4 (CONTRIBUTING) forbids acting
on a newly inferred selector before approval, and spec 16.3 says a repair stops
the run. Nothing in this module may ever be wired straight into the executor;
the response type carries `review_required` as a constant true so that a caller
which ignores it is visibly wrong rather than quietly wrong.
"""

from __future__ import annotations

from typing import ClassVar, Literal

from pydantic import Field, model_validator

from app import prompts
from app.domain import NodeSummary, UiRole
from app.envelope import Envelope
from app.redaction import redact
from app.similarity import label_similarity
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "repair_selector"
PROMPT_VERSION = "v1"

# Below this, "we found nothing" is the honest answer. Proposing the least
# implausible node on a screen that simply does not contain the control is how a
# self-heal feature starts silently retargeting tests at the wrong button.
MIN_PLAUSIBLE_SCORE = 0.30


class BrokenSelector(Contract):
    id: str
    kind: str
    resource_id: str | None = None
    text: str | None = None
    content_description: str | None = None
    role: UiRole | None = None

    def label(self) -> str:
        return self.text or self.content_description or ""


class Request(Contract):
    broken_selector: BrokenSelector
    original_node: NodeSummary | None = Field(
        default=None, description="The node as captured when the test was approved."
    )
    current_nodes: list[NodeSummary] = Field(min_length=1, max_length=120)
    allowed_node_ids: list[str] = Field(min_length=1)
    intent_hint: str | None = None

    @model_validator(mode="after")
    def _nodes_are_declared(self) -> Request:
        allowed = set(self.allowed_node_ids)
        supplied = {node.node_id for node in self.current_nodes}
        if undeclared := supplied - allowed:
            raise ValueError(f"nodes not present in allowedNodeIds: {sorted(undeclared)}")
        return self


class RankedNode(Contract):
    node_id: str
    score: float = Field(ge=0.0, le=1.0)
    reason: str = Field(max_length=400)


class Response(BaseResponse):
    ranked: list[RankedNode] = Field(default_factory=list)

    #: Constant. A repair proposal always needs human approval (safety invariant
    #: 4), so this is asserted by us and never asked of the model.
    review_required: Literal[True] = True

    SERVER_ASSERTED = ("reviewRequired",)


def _resource_tail(resource_id: str | None) -> str:
    return resource_id.split("/")[-1].lower() if resource_id else ""


def _centre(node: NodeSummary) -> tuple[float, float] | None:
    if node.bounds is None:
        return None
    return (
        node.bounds.x + node.bounds.width / 2,
        node.bounds.y + node.bounds.height / 2,
    )


def _score_node(request: Request, node: NodeSummary) -> tuple[float, str]:
    broken = request.broken_selector
    original = request.original_node
    target_label = broken.label() or (original.label() if original else "")

    score = 0.0
    reasons: list[str] = []

    tail_before = _resource_tail(broken.resource_id or (original.resource_id if original else None))
    tail_after = _resource_tail(node.resource_id)
    if tail_before and tail_before == tail_after:
        score += 0.50
        reasons.append(f"Resource id still ends in {tail_after!r}")

    node_label = node.label()
    if target_label and node_label:
        if target_label.strip().lower() == node_label.strip().lower():
            score += 0.35
            reasons.append("Label is unchanged")
        else:
            similarity = label_similarity(target_label, node_label)
            if similarity > 0.25:
                score += 0.30 * similarity
                reasons.append(f"Label {node_label!r} is close to {target_label!r}")

    expected_role = broken.role or (original.role if original else None)
    if expected_role is not None:
        if node.role == expected_role:
            score += 0.12
            reasons.append(f"Same {expected_role} role")
        else:
            # A matching label on a different role is usually a heading, not the
            # control. This penalty is what stops the obvious wrong answer.
            score -= 0.18
            reasons.append(f"Role changed from {expected_role} to {node.role}")

    if original is not None:
        here, there = _centre(node), _centre(original)
        if here and there:
            distance = ((here[0] - there[0]) ** 2 + (here[1] - there[1]) ** 2) ** 0.5
            if distance < 0.30:
                proximity = 0.15 * (1 - distance / 0.30)
                score += proximity
                reasons.append("Occupies roughly the same position on screen")
        if original.clickable and node.clickable:
            score += 0.05
        shared_ancestors = set(original.ancestor_labels) & set(node.ancestor_labels)
        if shared_ancestors:
            score += 0.10
            reasons.append(f"Still inside {sorted(shared_ancestors)[0]!r}")

    if request.intent_hint and node_label:
        if label_similarity(request.intent_hint, node_label) > 0.4:
            score += 0.05
            reasons.append("Matches the intent this step serves")

    if not node.visible:
        score -= 0.40
        reasons.append("Not visible to the user")
    if not node.enabled:
        score -= 0.20
        reasons.append("Disabled")

    clamped = max(0.0, min(1.0, round(score, 4)))
    return clamped, (reasons[0] if reasons else "No corresponding signal on this screen")


def deterministic(request: Request) -> Response:
    scored: list[tuple[float, int, RankedNode]] = []
    for position, node in enumerate(request.current_nodes):
        score, reason = _score_node(request, node)
        scored.append((score, position, RankedNode(node_id=node.node_id, score=score, reason=reason)))

    scored.sort(key=lambda row: (-row[0], row[1]))
    best = scored[0][0] if scored else 0.0

    if best < MIN_PLAUSIBLE_SCORE:
        return Response(ranked=[], insufficient_evidence=True)

    # Only surface candidates worth a human's attention.
    ranked = [row[2] for row in scored if row[0] >= MIN_PLAUSIBLE_SCORE][:5]
    return Response(ranked=ranked, insufficient_evidence=False)


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={"nodeId": list(request.allowed_node_ids)},
        evidence=redact(
            {
                "brokenSelector": request.broken_selector.model_dump(
                    by_alias=True, exclude_none=True
                ),
                "originalNode": request.original_node.model_dump(
                    by_alias=True, exclude_none=True
                )
                if request.original_node
                else None,
                "intentHint": request.intent_hint,
                "currentNodes": [
                    node.model_dump(by_alias=True, exclude_none=True)
                    for node in request.current_nodes
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return set(request.allowed_node_ids)


def referenced_ids(response: Response) -> set[str]:
    return {row.node_id for row in response.ranked}


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Propose replacement nodes for a selector that no longer resolves.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
