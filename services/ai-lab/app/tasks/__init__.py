"""Task registry. Importing this package registers every task exactly once."""

from app.tasks import (  # noqa: F401  (imported for the register() side effect)
    audit_accessibility,
    classify_flake,
    compile_intent,
    explain_failure,
    generate_edge_cases,
    name_test,
    rank_assertions,
    rank_explorer_candidate,
    repair_selector,
)
from app.tasks.base import TaskSpec, all_tasks, get, register

__all__ = ["TaskSpec", "all_tasks", "get", "register"]
