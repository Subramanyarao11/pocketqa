"""Task contract — every module in app/tasks/ builds exactly one TaskSpec.

Uniform shape is what lets Track B's routes, the eval harness and the merge rule
treat eight very different reasoning problems identically, and it is what makes
the on-device port mechanical.

A task never knows which engine ran it. That indirection is the whole reason the
ML Kit / LiteRT port is a configuration change rather than a rewrite.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.envelope import Envelope


class Contract(BaseModel):
    """Base for every request and response model.

    `extra="forbid"` is a safety control, not tidiness: an unexpected key in a
    model response is an attempt to smuggle a field past the schema, and the
    correct handling is rejection.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=False,
        str_strip_whitespace=True,
    )


class BaseResponse(Contract):
    """Every task can decline. `insufficientEvidence` is the escape hatch that
    keeps a model from inventing an answer to look useful (spec 19.1)."""

    insufficient_evidence: bool = False

    ESCAPE_FIELD: ClassVar[str] = "insufficient_evidence"

    #: Fields the *system* asserts, which the model must never be asked to emit.
    #: Named by their serialisation alias. They are stripped from the schema sent
    #: to the provider and filled from the model default after parsing.
    #:
    #: This exists because of a real failure: `repair_selector` declared
    #: `reviewRequired: Literal[True]`, strict structured outputs force every
    #: property into `required`, and so every model was asked whether human
    #: review was required, answered `false`, and had its entire response
    #: discarded. Whether a repair needs review is not the model's call, and it
    #: should never have been in its schema.
    SERVER_ASSERTED: ClassVar[tuple[str, ...]] = ()


@dataclass(frozen=True, slots=True)
class TaskSpec:
    task_id: str
    prompt_version: str
    summary: str
    request_model: type[Contract]
    response_model: type[BaseResponse]
    deterministic: Callable[[Any], BaseResponse]
    prompt: Callable[[Any], Envelope]
    allowed_ids: Callable[[Any], set[str]]
    referenced_ids: Callable[[Any], set[str]]

    def parse_request(self, payload: dict[str, Any]) -> Contract:
        return self.request_model.model_validate(payload)

    def parse_response(self, payload: dict[str, Any]) -> BaseResponse:
        return self.response_model.model_validate(payload)


_REGISTRY: dict[str, TaskSpec] = {}


def register(spec: TaskSpec) -> TaskSpec:
    if spec.task_id in _REGISTRY:
        raise ValueError(f"duplicate task id: {spec.task_id}")
    _REGISTRY[spec.task_id] = spec
    return spec


def get(task_id: str) -> TaskSpec:
    if task_id not in _REGISTRY:
        raise KeyError(f"unknown task: {task_id}. Known: {sorted(_REGISTRY)}")
    return _REGISTRY[task_id]


def all_tasks() -> dict[str, TaskSpec]:
    return dict(_REGISTRY)
