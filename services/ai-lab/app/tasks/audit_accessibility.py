"""audit_accessibility — accessibility auditor.

Backlog: P1 Accessibility Auditor. Track A task AI-A-13.

Division of labour, and the reason this task is worth building early: the
*findings* are deterministic rules over the accessibility tree, and the model
only adds severity and a human explanation. That means the feature works offline,
works on a device with no GenAI support, and cannot hallucinate a violation —
the closed vocabulary is the set of finding ids the rules produced.

`detect()` is the whole audit. The LLM is the presentation layer.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from app import prompts
from app.domain import NodeSummary, Severity, UiRole
from app.envelope import Envelope
from app.redaction import redact
from app.tasks.base import BaseResponse, Contract, TaskSpec, register

TASK_ID = "audit_accessibility"
PROMPT_VERSION = "v1"

# Android's documented minimum touch target.
MIN_TOUCH_TARGET_DP = 48.0

RULES: dict[str, str] = {
    "A11Y-001": "Interactive control has no accessible name",
    "A11Y-002": "Touch target is smaller than the 48dp minimum",
    "A11Y-003": "Dialog offers no reachable way out",
    "A11Y-004": "Toggle state is not exposed to assistive technology",
    "A11Y-005": "Visible text is clipped",
    "A11Y-006": "Several controls share one accessible name",
}

DEFAULT_SEVERITY: dict[str, Severity] = {
    "A11Y-001": Severity.CRITICAL,
    "A11Y-002": Severity.MINOR,
    "A11Y-003": Severity.CRITICAL,
    "A11Y-004": Severity.MAJOR,
    "A11Y-005": Severity.MAJOR,
    "A11Y-006": Severity.MAJOR,
}

INTERACTIVE_ROLES = frozenset(
    {UiRole.BUTTON, UiRole.LINK, UiRole.CHECKBOX, UiRole.RADIO, UiRole.SWITCH, UiRole.TAB}
)
CLIP_MARKERS = ("…", "...")


class AuditState(Contract):
    state_id: str
    window_title: str | None = None
    display_width_dp: float = Field(default=411.0, gt=0)
    display_height_dp: float = Field(default=891.0, gt=0)
    nodes: list[NodeSummary] = Field(min_length=1, max_length=200)


class Finding(Contract):
    finding_id: str
    rule_id: str
    node_id: str
    node_label: str = ""
    node_role: UiRole = UiRole.UNKNOWN
    evidence: str = Field(max_length=300)


def detect(state: AuditState) -> list[Finding]:
    """Deterministic accessibility rules. No model, no network, no ambiguity.

    Rules only fire on evidence the tree actually carries. Anything requiring a
    judgement call (is this contrast sufficient? is this label meaningful?) is
    deliberately absent — a false positive here costs more trust than a missed
    finding.
    """

    findings: list[Finding] = []
    counter = 0

    def add(rule_id: str, node: NodeSummary, evidence: str) -> None:
        nonlocal counter
        counter += 1
        findings.append(
            Finding(
                finding_id=f"f{counter}",
                rule_id=rule_id,
                node_id=node.node_id,
                node_label=node.label(),
                node_role=node.role,
                evidence=evidence,
            )
        )

    interactive = [
        node
        for node in state.nodes
        if node.visible and (node.clickable or node.role in INTERACTIVE_ROLES)
    ]

    for node in interactive:
        if not node.label():
            add("A11Y-001", node, f"{node.role} is interactive with no text, content description or hint.")

        if node.bounds is not None:
            width_dp = node.bounds.width * state.display_width_dp
            height_dp = node.bounds.height * state.display_height_dp
            if width_dp < MIN_TOUCH_TARGET_DP or height_dp < MIN_TOUCH_TARGET_DP:
                add(
                    "A11Y-002",
                    node,
                    f"Measures {width_dp:.0f}x{height_dp:.0f}dp against a "
                    f"{MIN_TOUCH_TARGET_DP:.0f}dp minimum.",
                )

    for node in state.nodes:
        if node.checkable and node.checked is None:
            add("A11Y-004", node, "Control is checkable but exposes no checked state.")

        if node.visible and node.text and node.text.endswith(CLIP_MARKERS):
            add("A11Y-005", node, f"Text ends in an ellipsis: {node.text!r}.")

    # Focus trap: a dialog is on screen but nothing inside it is both focusable
    # and actionable, so keyboard and switch-access users cannot leave.
    dialogs = [node for node in state.nodes if node.role is UiRole.DIALOG and node.visible]
    for dialog in dialogs:
        dialog_label = dialog.label()
        inside = [
            node
            for node in state.nodes
            if dialog_label and dialog_label in node.ancestor_labels
        ]
        if inside and not any(node.focusable and node.clickable and node.enabled for node in inside):
            add(
                "A11Y-003",
                dialog,
                "Dialog contains no focusable, enabled, clickable control.",
            )

    # Duplicate accessible names among interactive controls.
    by_label: dict[str, list[NodeSummary]] = {}
    for node in interactive:
        label = node.label().strip().lower()
        if label:
            by_label.setdefault(label, []).append(node)
    for label, nodes in sorted(by_label.items()):
        if len(nodes) > 1:
            ids = ", ".join(node.node_id for node in nodes)
            for node in nodes:
                add("A11Y-006", node, f"{len(nodes)} controls are all named {label!r} ({ids}).")

    return findings


class Request(Contract):
    state_summary: str
    findings: list[Finding] = Field(min_length=1, max_length=60)
    allowed_finding_ids: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _findings_are_declared(self) -> Request:
        allowed = set(self.allowed_finding_ids)
        supplied = {finding.finding_id for finding in self.findings}
        if undeclared := supplied - allowed:
            raise ValueError(
                f"findings not present in allowedFindingIds: {sorted(undeclared)}"
            )
        return self


class AnnotatedFinding(Contract):
    finding_id: str
    severity: Severity
    explanation: str = Field(max_length=400)


class Response(BaseResponse):
    annotated: list[AnnotatedFinding] = Field(default_factory=list)


def deterministic(request: Request) -> Response:
    return Response(
        annotated=[
            AnnotatedFinding(
                finding_id=finding.finding_id,
                severity=DEFAULT_SEVERITY.get(finding.rule_id, Severity.MINOR),
                explanation=f"{RULES.get(finding.rule_id, finding.rule_id)}. {finding.evidence}",
            )
            for finding in request.findings
        ],
        insufficient_evidence=False,
    )


def prompt(request: Request) -> Envelope:
    return Envelope(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        instructions=prompts.load(TASK_ID, PROMPT_VERSION),
        vocabulary={"findingId": list(request.allowed_finding_ids)},
        evidence=redact(
            {
                "stateSummary": request.state_summary,
                "rules": RULES,
                "findings": [
                    {
                        "findingId": finding.finding_id,
                        "ruleId": finding.rule_id,
                        "rule": RULES.get(finding.rule_id, finding.rule_id),
                        "nodeLabel": finding.node_label,
                        "nodeRole": str(finding.node_role),
                        "evidence": finding.evidence,
                    }
                    for finding in request.findings
                ],
            }
        ),
        response_schema=Response.model_json_schema(by_alias=True),
    )


def allowed_ids(request: Request) -> set[str]:
    return set(request.allowed_finding_ids)


def referenced_ids(response: Response) -> set[str]:
    return {row.finding_id for row in response.annotated}


SPEC = register(
    TaskSpec(
        task_id=TASK_ID,
        prompt_version=PROMPT_VERSION,
        summary="Rate and explain accessibility findings produced by deterministic rules.",
        request_model=Request,
        response_model=Response,
        deterministic=deterministic,
        prompt=prompt,
        allowed_ids=allowed_ids,
        referenced_ids=referenced_ids,
    )
)
