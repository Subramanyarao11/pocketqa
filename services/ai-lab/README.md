# PocketQA AI lab

Reasoning tasks, deterministic twins, prompts and evals for the PocketQA AI
layer. Built against JSON fixtures, not against the app — see
[AI Track A](../../PocketQA_AI_Track_A_Reasoning.md) for why, and
[AI Track B](../../PocketQA_AI_Track_B_Platform.md) for the service and
integration work that lands on top of this.

**This is not a runtime dependency of the offline demo.** It is a development
harness that later doubles as the optional connected proxy (epic E5-03).

## Run it

```bash
make install     # uv venv + editable install
make test        # unit tests
make eval        # eval suite, deterministic engine
make schemas     # regenerate packages/schemas/ai from the Pydantic models
make fixtures    # regenerate packages/ai-fixtures
make check       # all of the above, in the order CI runs them

# Costs money. Compares rules vs an on-device-sized model vs a ceiling model.
python evals/run_evals.py --engine all --concurrency 8
```

## What is here

| Path | Owner | What it is |
|---|---|---|
| `app/engines/base.py` | shared (H3) | Engine protocol, Python mirror of Tech Spec 18.1 |
| `app/engines/deterministic.py` | A | The guaranteed baseline (18.4); reference for the Kotlin port |
| `app/tasks/` | A | One module per reasoning task; each builds one `TaskSpec` |
| `app/prompts/` | A | Versioned prompt templates, one file per task version |
| `app/merge.py` | A | The response merge rule — the closed-vocabulary boundary |
| `app/relevance.py` | A | Deterministic intent relevance (17.3), ported to Kotlin later |
| `app/envelope.py` | A | The seven-part prompt envelope (19.1) |
| `app/redaction/` | **B (stub)** | Placeholder so call sites exist and are tested |
| `app/schema_strict.py` | A | Pydantic schema → strict structured-output schema |
| `app/engines/openrouter_engine.py` | **B (interim)** | Working stand-in for AI-B-02 — see [handoff](../../PocketQA_AI_Engine_Handoff.md) |
| `app/config.py` | A/B | `.env` loading; `describe()` is safe to log and serve |
| `evals/` | A | Golden cases and the three-axis scorer |
| `app/main.py`, `app/routes/` | B | Not written yet — tasks AI-B-01/08 |

## The nine tasks

| Task | Backlog capability | Deterministic twin does |
|---|---|---|
| `compile_intent` | P0 Intent compiler | Intent-relevance selection with grounded expected values |
| `rank_assertions` | P0 Intent compiler | Spec 17.3 relevance ranking |
| `explain_failure` | P0 Evidence writer | Assembles a real explanation from structured facts |
| `rank_explorer_candidate` | P1 Explorer Agent | Spec 22.3 novelty/relevance/reversibility score |
| `repair_selector` | P1 Selector Self-Heal | Label, role, id-tail, position and ancestor scoring |
| `classify_flake` | P1 Failure Detective, P2 Flaky triage | Spec 23.2 rules; grouping by class + evidence signature |
| `audit_accessibility` | P1 Accessibility Auditor | Six rules over the tree; the model only rates and explains |
| `generate_edge_cases` | P2 Edge-Case Generator | Dimension ranking against the flow's own vocabulary |
| `name_test` | quality-of-life | Names by trimming the intent; vocabulary is words, not ids |

## Adding a task

1. Write the module in `app/tasks/`, building one `TaskSpec` with all six
   exports (`request_model`, `response_model`, `deterministic`, `prompt`,
   `allowed_ids`, `referenced_ids`).
2. Add its prompt file as `app/prompts/<task_id>.v1.md`.
3. Register it in `app/tasks/__init__.py`.
4. Add its hostile-response case to `tests/test_vocabulary_is_closed.py` — the
   registry test fails until you do.
5. `make schemas`, then add eval cases in `evals/cases/`.

## Rules that are not negotiable

- Every task has a deterministic twin. Disabling the model must leave every
  feature working.
- No task may emit an identifier that was not supplied to it. `app/merge.py`
  enforces this and `tests/test_vocabulary_is_closed.py` proves it per task.
- Evidence passes through `redact()` before it reaches a prompt.
- `insufficientEvidence` beats a guess.
- Screen text is data, never instruction. `evals/cases/90_*` and `95_*` are the
  regression suite for that, and a safety-axis failure fails the build.
- A field the *system* asserts never appears in the schema the model is asked to
  fill. Declare it in `BaseResponse.SERVER_ASSERTED`.
- Any constraint `app/schema_strict.py` strips must be restated in the prompt.
  A constraint the model cannot see is a constraint it cannot meet.
- Never show a model an internal encoding. `allowed_ids` may use compound tokens
  like `kind:<candidateId>:<KIND>` so the merge rule can enforce them generically;
  the prompt shows readable statements instead. Two different models copied the
  token prefix straight into an output field before this rule existed.
