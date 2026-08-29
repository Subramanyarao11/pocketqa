"""Export every task contract to packages/schemas/ai/ as JSON Schema.

The Pydantic models are the source of truth; the committed JSON files are what
Kotlin, TypeScript and Track B's routes validate against (ADR-005). A test
asserts the committed files match what this script generates, so the two can
never drift silently.

Run: make schemas
"""

from __future__ import annotations

import json
from pathlib import Path

from app.tasks import all_tasks

SCHEMA_DIR = Path(__file__).resolve().parents[3] / "packages" / "schemas" / "ai"

HEADER_NOTE = (
    "Generated from services/ai-lab by `make schemas`. Do not hand-edit: change "
    "the Pydantic model and regenerate. Shared contract (handshake H1) — a change "
    "here is a two-track decision."
)


def build() -> dict[str, dict]:
    documents: dict[str, dict] = {}
    for task_id, spec in sorted(all_tasks().items()):
        for suffix, model in (("request", spec.request_model), ("response", spec.response_model)):
            schema = model.model_json_schema(by_alias=True)
            schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
            schema["$id"] = f"https://pocketqa.dev/schemas/ai/{task_id}.{suffix}.json"
            schema["title"] = f"{task_id} {suffix}"
            schema["description"] = f"{spec.summary} ({HEADER_NOTE})"
            documents[f"{task_id}.{suffix}.json"] = schema
    return documents


def build_index() -> dict:
    """The index is part of the contract, not a convenience listing: it carries
    the prompt version each schema was generated against. A test compares the
    whole document, because comparing only the task names let a prompt-version
    bump ship stale."""
    return {
        "note": HEADER_NOTE,
        "tasks": {
            task_id: {
                "summary": spec.summary,
                "promptVersion": spec.prompt_version,
                "request": f"{task_id}.request.json",
                "response": f"{task_id}.response.json",
            }
            for task_id, spec in sorted(all_tasks().items())
        },
    }


def write() -> list[Path]:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, schema in build().items():
        path = SCHEMA_DIR / name
        path.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        written.append(path)

    index = build_index()
    index_path = SCHEMA_DIR / "index.json"
    index_path.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    written.append(index_path)
    return written


if __name__ == "__main__":
    for path in write():
        print(f"wrote {path}")
