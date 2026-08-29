"""Versioned prompt templates.

Prompts are files, not string literals, so that a prompt change is a reviewable
diff with an eval delta attached (CONTRIBUTING lists AI prompt-to-action
boundaries as review-required).

Every file carries a front-matter header with its task id, version and the eval
pass rate recorded when it was merged. Bump the version rather than editing a
merged prompt in place: the eval history has to stay attributable.
"""

from __future__ import annotations

import functools
from pathlib import Path

_DIR = Path(__file__).parent


@functools.lru_cache(maxsize=None)
def load(task_id: str, version: str) -> str:
    path = _DIR / f"{task_id}.{version}.md"
    if not path.exists():
        raise FileNotFoundError(f"missing prompt: {path.name}")
    text = path.read_text(encoding="utf-8")
    if text.startswith("---"):
        _, _, body = text.split("---", 2)
        return body.strip()
    return text.strip()


def versions() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in sorted(_DIR.glob("*.v*.md")):
        task_id, version = path.stem.rsplit(".", 1)
        found.setdefault(task_id, []).append(version)
    return found
