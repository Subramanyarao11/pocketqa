# Wiring the AI layer into the product

**Status:** design, ready to implement · **Date:** 2026-08-30
**Companions:** `PocketQA_AI_Engine_Handoff.md` (engine contract),
`PocketQA_Capture_Findings_and_Inference_Design.md` (what the device produces)

---

## 0. The one-paragraph summary

Nine reasoning tasks exist, are tested (175 tests), and are reachable over HTTP.
None of them run in the product. The device has an `InferenceRouter` with
`rankAssertions`, `rankCandidates`, `explainSelector` and `connectedComplete` —
and **nothing calls any of them**. The gap is not the AI; it is six call sites,
one transport, and a consent surface. This document specifies those.

The ordering principle throughout: **the deterministic result is the product.**
AI is a proposal layer on top of a loop that already passes without it. Every
integration below must degrade to exactly today's behaviour when the model is
absent, slow, wrong, or refused — and today's behaviour is a green end-to-end
run, not a stub.

---

## 1. What actually exists

### 1.1 Backend — `services/ai-lab` (Python)

Nine tasks, each a `TaskSpec` in `app/tasks/`:

| Task | What it decides | Product surface it belongs to |
|---|---|---|
| `compile_intent` | which candidate assertions express the stated intent | review screen, final assertions |
| `rank_assertions` | which assertions are worth keeping, in order | review screen |
| `repair_selector` | a replacement selector when one drifts | evidence screen, Failure Detective |
| `explain_failure` | why a run failed, in one sentence a human can act on | evidence screen |
| `classify_flake` | flake vs real regression | evidence screen, re-run decision |
| `name_test` | a human name for the compiled test | review screen |
| `generate_edge_cases` | neighbouring cases worth testing | post-approval suggestions |
| `rank_explorer_candidate` | which control the Explorer should touch next | Explorer mission |
| `audit_accessibility` | touch-target and labelling findings | evidence screen |

Every one has the same shape, and that uniformity is what makes this work
mechanical rather than nine separate integrations:

```python
TaskSpec(
    task_id, prompt_version, summary,
    request_model, response_model,   # pydantic, extra="forbid"
    deterministic,                   # the answer with no model at all
    prompt, allowed_ids, referenced_ids,
)
```

Three properties matter more than the task list:

1. **Every task has a deterministic twin.** `spec.deterministic(request)` returns
   a valid response with no model in the loop. This is not a fallback bolted on;
   it is the reference the model is measured against.
2. **Every response can decline.** `insufficientEvidence: true` is a first-class
   answer (`BaseResponse.ESCAPE_FIELD`). A task that cannot be answered from the
   evidence says so instead of inventing.
3. **The merge rule is unconditional.** `app/merge.py` runs on every response
   from every engine. An identifier the request did not supply means the model
   hallucinated; the deterministic result is used and the rejection is recorded
   in provenance. **Rejection is a normal logged outcome, not an error path.**

### 1.2 Transport — `POST /tasks/{task_id}`

`app/routes/tasks.py` already validates the request against the task's model,
runs the engine, applies the merge rule, and returns the response plus
provenance. `GET /tasks` lists them. `GET /health` reports configuration
without ever including the key.

### 1.3 Device — `InferenceRouter.kt`

```kotlin
enum class Engine { ON_DEVICE_AI, DETERMINISTIC_LOCAL, CONNECTED_ASSIST }
```

`currentEngine()` returns `DETERMINISTIC_LOCAL` on the test device because no ML
Kit GenAI class is present. `connectedComplete()` exists, refuses without
`consentGranted`, and redacts before the request leaves the device — but its
response is **not schema-validated**, and its docstring says so plainly. It also
speaks OpenAI and Sarvam directly rather than talking to our task service.

### 1.4 The honest state of the seam

`grep -rn "InferenceRouter\." app/src/main/java` returns four hits, and three of
them are the enum-to-string mapping in `CompileCoordinator`. **The AI layer is
wired to nothing.** Everything below is about closing that.

---

## 2. Where AI belongs, and where it must not go

The invariant from the build spec, restated because every integration decision
follows from it:

> A model **proposes**. A deterministic executor **acts**. A model never
> dispatches an action to the device.

| Surface | AI allowed? | Why |
|---|---|---|
| Choosing final assertions | ✅ proposes | A human approves before anything runs |
| Naming the test | ✅ proposes | Cosmetic; wrong name costs nothing |
| Explaining a failure | ✅ proposes | Read-only, post-hoc |
| Suggesting a repaired selector | ✅ proposes | Applied only by explicit human tap |
| Ranking Explorer candidates | ✅ proposes | Inside a bounded action budget |
| Accessibility findings | ✅ proposes | Advisory output |
| **Deciding which control was tapped** | ❌ never | That is `InteractionInference`, and it must stay deterministic and explainable — a wrong attribution silently produces a green test asserting nothing |
| **Resolving a selector at replay time** | ❌ never | Ambiguity must hard-stop, not be guessed |
| **Dispatching any action** | ❌ never | Spec invariant |

The line is: **AI may shape what a human is asked to approve. It may never
shape what the executor does.**

---

## 3. Transport: one client, not nine

### 3.1 Decision — call the task service, not the providers

`connectedComplete()` currently builds OpenAI and Sarvam request bodies inline.
Keep it for raw completion, but **new work must not use it**, because it
reimplements on the device everything the task service already guarantees:
schema-strict output, the merge rule, provenance, allowed-id validation.

Add `TaskClient.kt`:

```kotlin
class TaskClient(private val baseUrl: String, private val http: OkHttpClient) {

    data class Result<T>(
        val value: T?,            // null when unavailable or rejected
        val provenance: Provenance,
    )

    data class Provenance(
        val engine: String,       // "deterministic" | model id
        val usedModel: Boolean,
        val outputRejected: Boolean,
        val rejectionReason: String?,
        val latencyMs: Long,
        val promptVersion: String,
    )

    suspend fun <T> run(
        taskId: String,
        request: JsonObject,
        parse: (JsonObject) -> T,
        consent: ConsentToken,
        timeoutMs: Long,
    ): Result<T>
}
```

Four rules, each answering a failure we have already seen:

1. **Redact before send, always.** Reuse `InferenceRouter.redactSensitive`; it
   already covers Aadhaar, PAN, IFSC, email, UPI, card, phone and bearer tokens.
   Do not add a second copy — the fact that device and server patterns can drift
   is tracked as `AI-B-22`.
2. **Consent is a parameter, not a checkbox someone remembered.** `ConsentToken`
   is constructible only from an explicit user grant for **this operation**.
   Same reasoning that made `connectedComplete` refuse without it.
3. **Timeout is the caller's, and short.** See §6.
4. **A failure is a `Result` with `value == null`, never an exception.** The
   caller's next line is already the deterministic path.

### 3.2 Where the service runs

For the hackathon: on the dev machine, `POST http://<host>:8000/tasks/...`,
configured in Settings alongside the existing provider keys. Two consequences to
state rather than hide:

- **Offline is the default and stays the default.** The core loop runs with
  airplane mode on; that claim on the welcome screen must remain true, so every
  AI surface is additive and skippable.
- **A reachable service is not a guaranteed one.** Treat unreachable as the
  common case, because on a demo network it is.

Post-hackathon the same `TaskSpec` shape is what makes the ML Kit / LiteRT port
a configuration change: the tasks do not know which engine ran them.

---

## 4. The six integrations, in the order worth doing them

Ordered by (value to the demo) ÷ (risk to the passing loop). The first two are
worth doing even if nothing else lands.

### AI-1 — `explain_failure` on the evidence screen

**Why first:** highest visible value, zero risk. The run is already over; the
screen is read-only. A wrong explanation costs one sentence and misleads nobody
into acting, because the Failure Detective's deterministic suggestion sits
directly beside it.

**Where:** `EvidenceScreen`, under `FAILURE DETECTIVE`, only when
`result.passed == false`.

**Request:** failure category, step label, selector, before/after state
summaries via `capture_adapter.to_state_summary`.

**Rendering:**

```
FAILURE DETECTIVE
selector-drift
Promote fallback selector resourceId=add_to_cart_1.     ← deterministic, unchanged
[ Apply suggestion ]

WHY THIS FAILED                              Explained by google/gemini-2.5-flash
The cart button moved into an overflow menu after the
banner appeared, so the recorded position no longer
resolves.
                                             [ Explanation only — not applied ]
```

**Rules:** never replaces the deterministic suggestion; always attributed;
absent entirely when unavailable, with no empty state and no spinner left
behind.

### AI-2 — `compile_intent` + `rank_assertions` on the review screen

**Why second:** this is the product's actual thesis — *say what must be true*,
then have the tool find it. Today the operator types "Discount" by hand.

**Where:** review screen, `FINAL ASSERTIONS`, as **pre-checked proposals inside
the existing approval gate**. Not auto-added.

**Flow:** the deterministic candidate set is built exactly as now, then
`compile_intent` selects from it (never invents — `allowed_ids` is enforced by
the merge rule), then `rank_assertions` orders what survives.

```
FINAL ASSERTIONS
Proposed from your intent "Coupon SAVE20 stays applied in the cart"
 ☑ textVisible "Discount (20%): -$16.00"     proposed · 0.91
 ☑ textVisible "Total: $63.99"               proposed · 0.84
 ☐ textVisible "Wireless Headphones"         proposed · 0.31
[ Add your own ]
```

**Rules:** every proposal is a candidate the deterministic layer already
produced — the model chooses, it does not author. `insufficientEvidence` renders
as "Couldn't propose assertions — add one below", which is today's screen.
**Approve stays blocked until at least one assertion exists**, proposed or not.
The eval note applies here: on `compile-intent-english` the ceiling model chose
`['a1','a7']` where the deterministic twin expects `['a1','a2']` — the twin is
the reference, and a disagreement is a review prompt, never an override.

### AI-3 — `name_test` on the review screen

**Why third:** trivial, and it makes the library legible. Today drafts are
called `draft_6fcba85f`.

**Where:** review screen title, editable, pre-filled. Falls back to the intent's
first sixty characters — which is what it does now.

**Rule:** never renames an approved test. Names are part of the immutable
artefact.

### AI-4 — `repair_selector` behind the existing Apply button

**Why fourth:** the highest-value repair in the product, and the first one that
touches something replayable — so it carries the most rules.

**Where:** the `Apply suggestion` control that already exists on the evidence
screen. The deterministic repair is the default; the model's alternative appears
only when the deterministic one is absent or the model proposes a different
strategy.

**Rules — all four are load-bearing:**
1. Applying **bumps the test version**. An approved test is immutable; a repair
   creates v2 and the run history shows both.
2. The proposal must resolve to **exactly one node** in the failing state before
   it is offered. Verify on device, deterministically, before showing it.
3. `reviewRequired` is **server-asserted, never asked of the model** — this is
   the documented `SERVER_ASSERTED` bug: `repair_selector` once declared
   `reviewRequired: Literal[True]`, strict structured outputs forced it into
   `required`, every model answered `false`, and every response was discarded.
4. Never auto-apply. Not on a rerun, not with a preference toggle.

### AI-5 — `classify_flake` on repeated runs

**Where:** evidence screen, only when the same test has failed and then passed,
or failed twice differently.

**Value:** turns "it failed" into "this failed the same way twice — it is a
regression" or "this passed on retry — likely a timing flake". The deterministic
twin already handles the clear cases via `wait_budget_ms` and
`appeared_after_budget`; the model is for the ambiguous middle.

**Rule:** a flake verdict never suppresses a failure. It annotates it. A test
that fails is red.

### AI-6 — `rank_explorer_candidate` in the Explorer mission

**Why last:** the Explorer is the least-exercised surface (never run on device),
and this is the only integration where AI output leads to an action.

**Rules:** the action budget is deterministic and pre-committed; the model
chooses *within* it and can only ever choose `STOP` early (the deterministic twin
already returns `STOP` when the budget is exhausted). Every candidate is an
allowlisted, non-destructive control classified by `PolicyEngine` **before**
ranking. The model narrows a safe set; it never widens one.

**Not integrating now:** `generate_edge_cases` and `audit_accessibility` — both
are good, neither is on the critical path, and both need UI that does not exist.

---

## 5. Provenance: the part that must not be cut

Every AI-touched surface carries its origin, in the UI and in the evidence
record. The evidence screen already renders `deterministic-local`, `No network
used`, `schema 61111b64` — extend that, do not replace it.

```json
{
  "provenance": {
    "engine": "google/gemini-2.5-flash",
    "promptVersion": "compile_intent@v3",
    "usedModel": true,
    "outputRejected": false,
    "rejectionReason": null,
    "latencyMs": 1180,
    "redacted": true,
    "consent": "granted-for-operation"
  }
}
```

Three requirements:

- **A rejected output is recorded, not hidden.** `outputRejected: true` with the
  reason is the system working. It belongs in `Copy diagnostics`.
- **`No network used` must stay accurate.** It becomes a computed fact about the
  run, not a constant. A run that called the task service says so.
- **Every proposal is attributed in the UI**, not only in the log. "Explained by
  gemini-2.5-flash" next to the text. A user must never be unable to tell which
  sentences a model wrote.

---

## 6. Budgets, and what happens when they are missed

From the eval run, which is the only evidence we have about real latency:

| Engine | Correct | Slowest | Cost |
|---|---|---|---|
| `rules` (deterministic) | 3/3 | 0 ms | free |
| `device-proxy` (gemma-3-4b-it) | 0/3 | 366,524 ms | — |
| `ceiling` (gemini-2.5-flash) | 2/3 | 3,231 ms | $0.0024 |

Read this honestly: **the small model failed every case and took six minutes.**
Its output was truncated mid-JSON (`Expecting ',' delimiter`). It is not a
device proxy today. Plan for `gemini-2.5-flash` at roughly 1–3s and about
$0.0024 per eval run; the $10 budget is not the constraint, latency is.

| Surface | Budget | On timeout |
|---|---|---|
| `explain_failure` | 4,000 ms | Section is absent. No spinner, no error. |
| `compile_intent` + `rank_assertions` | 6,000 ms total | Deterministic candidates, unproposed — today's screen. |
| `name_test` | 2,000 ms | Intent prefix. |
| `repair_selector` | 4,000 ms | Deterministic suggestion only. |
| `classify_flake` | 3,000 ms | No verdict shown. |
| `rank_explorer_candidate` | 2,000 ms per step | Deterministic ranker. |

**One in-flight AI call at a time**, enforced by the existing `OperationLock`.
Concurrent calls during a replay are what turn a 16-second run into a
minute-long one.

Every timeout path must land on a screen a user would accept as normal —
because it *is* the screen they get today.

---

## 7. Consent

Reuse the model that already works: a capture session requires an explicit
acknowledgement per session, and `connectedComplete` refuses without
`consentGranted`.

- **Per operation, not per app, not per session.** Approving an explanation does
  not approve sending capture data next time.
- **The dialog names what leaves the device**: the task, the destination, and
  that text is redacted first. Not "Enable AI features?".
- **A visible, immediate off switch** in Settings that returns the product to
  fully local — and that must be a real return, verifiable by the fact that
  every surface above already works without the model.
- **Redaction is not consent.** Redacted data is still data leaving the device.

---

## 8. Order of work

| # | Task | Depends on | Effort | Risk |
|---|---|---|---|---|
| 1 | `TaskClient.kt` + Settings endpoint field | — | M | low |
| 2 | Provenance plumbed end to end (§5) | 1 | S | low |
| 3 | AI-1 `explain_failure` | 1, 2 | S | very low |
| 4 | AI-3 `name_test` | 1, 2 | S | very low |
| 5 | AI-2 `compile_intent` + `rank_assertions` | 1, 2 | L | medium |
| 6 | AI-4 `repair_selector` (+ version bump) | 5 | L | medium |
| 7 | AI-5 `classify_flake` | 2 | M | low |
| 8 | AI-6 `rank_explorer_candidate` | Explorer working on device | L | high |

Items 1–4 are a day's work and give the demo a visible AI story with no risk to
the passing loop. Item 5 is the thesis. Items 6–8 are follow-ons.

---

## 9. How we will know it works

Not "the model returned something".

1. **The loop still passes with the service unreachable.** Run the device E2E
   with the endpoint pointed at a dead port. Expected: `PASS`, 5 steps, ~16s,
   identical to today. This is the regression that matters, and it should run
   before every AI merge.
2. **A rejected output is invisible to the user and visible in diagnostics.**
   Force a hallucinated id; the screen shows the deterministic answer, and
   `Copy diagnostics` contains `outputRejected: true`.
3. **Every AI sentence on screen is attributed.** Screenshot audit of each
   surface.
4. **Redaction is verified on the wire, not asserted.** Capture the request body
   for a state containing an email, a card number and a bearer token; assert all
   three are masked. A unit test on the regex is not this test.
5. **Timeouts land on today's screen.** Force a 1 ms budget on each surface and
   confirm each degrades to the deterministic UI with no spinner and no error.
6. **`No network used` is accurate in both directions** — true offline, false
   after a task call.

---

## 10. Open questions worth deciding before starting

- **Where does the task service live for the demo?** A laptop on the same
  network is fine and honest. Say so on the readiness screen rather than
  implying on-device inference.
- **Do we ship the OpenRouter key in the app?** No. Settings-entered, vault
  stored — which is what `CredentialVault` already does for provider keys.
- **Is `gemma-3-4b-it` worth another attempt as a device proxy?** Not on this
  evidence. Revisit only with a smaller prompt and a constrained decoder; the
  failure was truncated JSON, which is a decoding problem, not a reasoning one.
- **On-device ML Kit GenAI** reports `unavailable` on the test device. The
  readiness screen already says so and calls the deterministic compiler the
  guaranteed path. Keep that wording — it is accurate, and it will stay accurate.
