"""Contract hygiene: the committed schemas, the prompts and the envelope.

The schema drift test is the one that matters most. `packages/schemas/ai/` is what
Kotlin, TypeScript and Track B's routes validate against (ADR-005), and a
Pydantic model edited without regenerating would let the two sides disagree
silently right up until integration day.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app import prompts
from app.envelope import BOUNDARY, ESCAPE
from app.export_schemas import SCHEMA_DIR, build
from app.tasks import all_tasks, get

TASK_IDS = sorted(all_tasks())


def test_committed_schemas_match_the_models():
    generated = build()
    for name, schema in generated.items():
        path = SCHEMA_DIR / name
        assert path.exists(), f"{name} is missing — run `make schemas`"
        committed = json.loads(path.read_text())
        assert committed == schema, f"{name} is stale — run `make schemas`"


def test_schema_index_lists_every_task():
    index = json.loads((SCHEMA_DIR / "index.json").read_text())
    assert sorted(index["tasks"]) == TASK_IDS


@pytest.mark.parametrize("task_id", TASK_IDS)
def test_prompt_file_exists_and_is_substantial(task_id):
    spec = get(task_id)
    text = prompts.load(task_id, spec.prompt_version)
    assert len(text) > 200, "a prompt this short is unlikely to constrain anything"


@pytest.mark.parametrize("task_id", TASK_IDS)
def test_response_model_carries_the_escape_hatch(task_id):
    spec = get(task_id)
    assert "insufficient_evidence" in spec.response_model.model_fields


@pytest.mark.parametrize("task_id", TASK_IDS)
def test_models_reject_unknown_fields(task_id):
    """extra="forbid" is a safety control: an unexpected key in a model response
    is an attempt to smuggle a field past the schema."""
    spec = get(task_id)
    with pytest.raises(Exception):
        spec.response_model.model_validate({"smuggled": True})


HOSTILE_FIXTURES = {
    "rank_assertions": "coupon-retry/rank_assertions.request.json",
    "compile_intent": "coupon-retry/compile_intent.request.json",
    "explain_failure": "coupon-retry/explain_failure.request.json",
    "repair_selector": "mutations/m1_resource_id_renamed.json",
    "rank_explorer_candidate": "explorer/e1_novel_branch.json",
    "generate_edge_cases": "coupon-retry/generate_edge_cases.request.json",
    "classify_flake": "runs/classify_flake.request.json",
}


@pytest.mark.parametrize("task_id", sorted(HOSTILE_FIXTURES))
def test_envelope_carries_boundary_escape_and_vocabulary(task_id, fixture):
    spec = get(task_id)
    request = spec.parse_request(fixture(HOSTILE_FIXTURES[task_id]))
    envelope = spec.prompt(request)

    system = envelope.system_text()
    assert BOUNDARY in system
    assert ESCAPE in system
    assert envelope.vocabulary, "a task with no closed vocabulary cannot be merged safely"

    user = envelope.user_text()
    assert "ALLOWED OUTPUT VOCABULARY" in user
    # Every id the merge rule will accept must be visible to the model, or it is
    # being asked to guess at the vocabulary. Some tasks encode a compound
    # permission as `kind:<candidateId>:<KIND>` purely so the generic merge rule
    # can enforce it; those are presented to the model as readable statements
    # instead, so check that each part is visible rather than the raw token.
    for identifier in list(spec.allowed_ids(request))[:25]:
        if identifier in user:
            continue
        parts = [p for p in identifier.split(":") if p and p not in {"kind", "value", "class"}]
        missing = [p for p in parts if p not in user]
        assert not missing, (
            f"{task_id}: the model cannot see {missing} from allowed id {identifier!r}"
        )


def test_envelope_refuses_more_than_one_image():
    from app.envelope import Envelope

    with pytest.raises(ValueError, match="at most one image"):
        Envelope(
            task_id="t", prompt_version="v1", instructions="i",
            vocabulary={}, evidence={}, response_schema={},
            images=["a", "b"],
        )


@pytest.mark.parametrize("task_id", TASK_IDS)
def test_server_asserted_fields_are_absent_from_the_provider_schema(task_id):
    """A field the system asserts must never appear in the schema the model is
    asked to fill.

    This test exists because of a real failure: `repair_selector` declared
    `reviewRequired: Literal[True]`, strict structured outputs force every
    property into `required`, and so every model was asked whether human review
    was required, answered `false`, and had its whole response discarded.
    """
    from app.schema_strict import response_format

    spec = get(task_id)
    asserted = spec.response_model.SERVER_ASSERTED
    block = response_format(
        "t", spec.response_model.model_json_schema(by_alias=True), asserted
    )
    schema = block["json_schema"]["schema"]

    for name in asserted:
        assert name not in schema["properties"]
        assert name not in schema["required"]

    # And the model default must still fill it in after parsing, or we have
    # simply moved the failure.
    minimal = {
        name: _empty_for(prop)
        for name, prop in schema["properties"].items()
    }
    parsed = spec.parse_response(minimal)
    for name in asserted:
        assert getattr(parsed, _snake(name)) is not None


def _empty_for(prop: dict) -> object:
    kind = prop.get("type")
    if kind == "array":
        return []
    if kind == "boolean":
        return True
    if kind == "number":
        return 0.0
    if kind == "integer":
        return 0
    if kind == "object":
        return {}
    return ""


def _snake(alias: str) -> str:
    out = []
    for char in alias:
        if char.isupper():
            out.append("_")
            out.append(char.lower())
        else:
            out.append(char)
    return "".join(out)


@pytest.mark.parametrize("task_id", sorted(HOSTILE_FIXTURES))
def test_stripped_constraints_are_stated_in_the_prompt(task_id, fixture):
    """Every constraint `schema_strict` removes must reappear as text.

    Both halves of this were observed against real models before the fix: a
    260-character justification against a 240 cap, and `groupId: "group_1"`
    against `^g\\d{1,3}$`. In both the reasoning was correct and the entire
    response was discarded. A constraint the model cannot see is a constraint it
    cannot meet.
    """
    from app.schema_strict import _UNSUPPORTED, to_strict

    spec = get(task_id)
    request = spec.parse_request(fixture(HOSTILE_FIXTURES[task_id]))
    envelope = spec.prompt(request)

    raw = envelope.response_schema
    stripped = to_strict(raw, spec.response_model.SERVER_ASSERTED)
    user_text = envelope.user_text()

    def constrained(node, found=None):
        found = {} if found is None else found
        if isinstance(node, list):
            for item in node:
                constrained(item, found)
        elif isinstance(node, dict):
            for name, prop in (node.get("properties") or {}).items():
                if isinstance(prop, dict):
                    for key in ("maxLength", "pattern"):
                        if key in prop:
                            found[name] = prop[key]
            for key, value in node.items():
                if key != "properties":
                    constrained(value, found)
        return found

    for name, value in constrained(raw).items():
        if name in spec.response_model.SERVER_ASSERTED:
            continue
        assert str(value) in user_text, (
            f"{task_id}.{name} is constrained to {value!r}, that constraint is "
            f"stripped from the provider schema, and the prompt never mentions it"
        )

    assert _UNSUPPORTED, "sanity: the strip list is not empty"
    assert json.dumps(stripped)  # the stripped schema is still serialisable


@pytest.mark.parametrize("task_id", TASK_IDS)
def test_provider_schema_has_no_ref_indirection(task_id):
    """Pydantic factors nested models and enums into `$defs`, so a response
    schema arrives as a tree of pointers. A device-sized model has to hold the
    pointer target in mind while generating, and that is exactly the indirection
    it drops. `to_strict` inlines it all.

    The committed contracts in `packages/schemas/ai/` deliberately keep `$defs` —
    they are read by Kotlin and TypeScript, not by a model.
    """
    from app.schema_strict import to_strict

    spec = get(task_id)
    strict = to_strict(
        spec.response_model.model_json_schema(by_alias=True),
        spec.response_model.SERVER_ASSERTED,
    )
    blob = json.dumps(strict)
    assert "$ref" not in blob
    assert "$defs" not in blob


def test_committed_schemas_keep_defs_for_typed_consumers():
    generated = build()
    blob = json.dumps(generated["compile_intent.response.json"])
    assert "$defs" in blob, "the committed contract is for Kotlin/TS, not for a model"
