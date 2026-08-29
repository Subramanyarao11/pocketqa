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

from app.contracts import BaseResponse, Contract
from app.envelope import Envelope


from app.contracts import BaseResponse, Contract  # re-exported


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
