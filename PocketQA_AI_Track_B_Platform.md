# PocketQA AI — Track B: Platform, Data and Integration

**Owner:** Track B Daksh
**Partner track:** [Track A — Reasoning, Prompts and Evaluation](PocketQA_AI_Track_A_Reasoning.md)
**Reads from:** [Agentic AI Backlog](PocketQA_Agentic_AI_Backlog.md), [Technical Spec §13–§18, §28–§29](PocketQA_Technical_Spec.md), [PRD](PocketQA_PRD.md)

You own **everything that carries a decision in and out** — the service, the data, the redaction gate, the memory, the voice path, and the eventual landing of all of it inside the Android app. Track A owns **what the AI decides and how we prove it is right**.

Your work is what makes Track A's work real. It is also the track that de-risks the moment the MVP lands, because you will have built the adapter against the same schemas the app team is coding to.

---
## Part 1 — Shared ground rules

> This section is mirrored verbatim in Track A. If you change it here, change it there in the same pull request.

### 1.1 The problem this plan solves

The MVP capture pipeline (Epic E1) and compiler (Epic E2) are being built in parallel and do not exist yet. Waiting for them would cost us the entire AI ladder in the backlog.

**We do not wait, because the AI layer never touches the app.** It touches JSON.

The technical spec already froze the seam for us. `StructuredInferenceEngine.generate(task, input)` (§18.1) takes typed input and returns typed output; §19.2 and §19.3 already show the exact request/response shapes. That interface is a wall we can build against from both sides at once:

```text
   Android / RN side                    AI side (this plan)
   ─────────────────                    ────────────────────
   E1 capture ──┐                  ┌── fixture corpus (hand-authored
   E2 compiler ─┤                  │    + uiautomator-derived)
   E3 replay ───┤                  │
                │                  │
                └──►  packages/schemas/ai/*.json  ◄──┘
                      (the frozen contract)
                              │
                              ▼
                    services/ai-lab (FastAPI)
                    tasks · prompts · evals · deterministic twins
```

Everything on the right-hand side is buildable today, with zero lines of app code. When E1/E2 land, integration is one adapter, not a rewrite, because both sides were coded against the same schema files the whole time.

Three consequences to internalise:

1. **The contract is the product.** A task is not "done" when the prompt works; it is done when the schema, the fixtures, the deterministic twin and the eval all exist.
2. **Fixtures are first-class engineering, not scaffolding.** They become the Android team's golden test data too.
3. **We will look further ahead than the app.** By the time capture works, P0 and P1 of the backlog should already be answered on fixtures.

### 1.2 The AI stack

Adapted from the *Zero to One — PocketFM GenAI* breakdown: a FastAPI orchestration service, a structured-JSON LLM as the reasoning core, embeddings plus a vector store for memory, and streaming STT for voice. That shape maps cleanly onto PocketQA. The parts that do not map (ElevenLabs TTS, WhisperX forced alignment — both audio-generation concerns) are dropped; we are not generating audio.

| Layer | Selection | Notes |
|---|---|---|
| Orchestration service | Python 3.11+ · FastAPI · Pydantic v2 | Lives at `services/ai-lab/`. Dev harness first; the same service graduates into the E5-03 connected-review proxy. |
| Reasoning LLM | OpenAI Responses API, multimodal, structured outputs | Model id comes from `POCKETQA_LLM_MODEL`; never hard-code a marketing name (Tech Spec §29.5). A GPT-4o-class multimodal model is the reference point. |
| Output contract | Pydantic model → JSON Schema, `strict: true` | We never parse free-form text. Ever. |
| Deterministic twin | Pure-Python rules, one per task | Not a mock. It is the guaranteed baseline (§18.4) and the source we port to Kotlin `DeterministicInferenceEngine`. |
| Memory / retrieval | `text-embedding-3-small` + Chroma in the lab → SQLite + `sqlite-vec` on device | Backlog P2 "Local Test Memory". |
| Vision | Same multimodal model; one scaled, redacted PNG per call, max | Visual regression uses image embeddings + region matching, not the chat model. |
| OCR | ML Kit Text Recognition v2 on device; RapidOCR/pytesseract in the lab | Lab OCR exists only to manufacture fixtures. |
| Voice (Indic / code-mixed) | Sarvam streaming STT over WebSocket | Local Whisper as an offline lab fallback; Android `SpeechRecognizer` as the on-device fallback. |
| On-device port | ML Kit Prompt / Gemini Nano; LiteRT + Gemma as a stretch | Same task contracts, different engine behind the same interface. |
| Evaluation | pytest + golden cases + scored rubric | Every prompt change must pass `make eval` before merge. |
| Secrets | `.env` local only; Android Keystore-backed runtime vault on device | Never committed. See CONTRIBUTING "Data and secrets". |

### 1.3 Non-negotiable invariants

These come straight from the PRD, the spec and CONTRIBUTING. They constrain both tracks and every merge:

1. **The model proposes; it never acts.** No AI output is ever dispatched as a device action. Policy and the deterministic executor decide, independently.
2. **Closed vocabulary output.** A response may only reference opaque IDs we supplied (`a1`, `p2`, `selector_5`). Any invented node, selector, action, state or value is rejected at merge time, not "cleaned up".
3. **Every task has a deterministic twin.** If the model is unavailable, offline, slow or wrong, the feature still returns something useful. The airplane-mode demo depends on this.
4. **Redaction happens before inference, always.** No unredacted payload leaves the process — locally or over the network (§14.2).
5. **`INSUFFICIENT_EVIDENCE` beats a guess.** Every schema carries that escape hatch and prompts must prefer it.
6. **Connected calls require explicit, per-operation consent.** The gateway never silently falls back from local to cloud (§18.2).
7. **Screen text is data, never instruction.** Prompt-injection defence is structural: opaque IDs, schema-constrained output, policy re-evaluation after the fact.

### 1.4 Repository layout for AI work

```text
services/ai-lab/
├── app/
│   ├── main.py                    # B — FastAPI entrypoint
│   ├── routes/                    # B — one route per task, thin
│   ├── engines/
│   │   ├── base.py                # A+B — shared engine protocol (mirrors §18.1)
│   │   ├── openai_engine.py       # B — client, retries, structured outputs, provenance
│   │   └── deterministic.py       # A — rule baselines for every task
│   ├── tasks/                     # A — one module per reasoning task
│   ├── prompts/                   # A — versioned templates
│   ├── redaction/                 # B
│   ├── memory/                    # B — embeddings + vector store
│   ├── voice/                     # B — Sarvam WS client
│   └── provenance.py              # B
├── evals/                         # A — golden cases + scoring harness
│   ├── cases/
│   └── run_evals.py
├── tools/
│   └── uiauto_to_uistate.py       # B — device dump → canonical UiState
└── tests/
packages/
├── schemas/ai/                    # SHARED AND FROZEN — both tracks must agree
└── ai-fixtures/                   # B owns the pipeline, A authors the cases
```

`services/ai-lab` must never become a runtime dependency of the offline demo. It is a development harness that later doubles as the optional connected proxy.

### 1.5 How the two tracks stay unblocked

| Handshake | What passes across | Who blocks on whom |
|---|---|---|
| H1 — Contract freeze | `packages/schemas/ai/*.json` v0 | Both. Do this first, together, in one sitting. |
| H2 — Fixture corpus v1 | `packages/ai-fixtures/coupon-retry/` | A consumes what B's pipeline produces; A can hand-author v0 meanwhile. |
| H3 — Engine protocol | `app/engines/base.py` | A writes deterministic twins against it; B writes the OpenAI engine against it. |
| H4 — Redaction gate | `redact(payload) -> payload` | A's tasks call it; A can stub it until B lands it. |
| H5 — Integration day | Kotlin `InferenceGateway` adapter | Neither. B drives it; A supplies passing evals as the acceptance bar. |

Outside those five points, the tracks own disjoint directories and should almost never conflict in a pull request.

### 1.6 Conventions

Branches, commits and pull requests follow [CONTRIBUTING.md](CONTRIBUTING.md) unchanged. Two additions for AI work:

- Prompt changes are **review-required** (CONTRIBUTING lists "AI prompt-to-action boundaries"). Attach the eval delta to the pull request.
- Every AI pull request states which invariant from §1.3 it could have broken and why it does not.

---
---

## Part 2 — Your task board

Task IDs are `AI-B-nn`. The **MVP dependency** column matters most:

- **None** — buildable right now, today, with nothing from the app team.
- **Device** — needs an Android device with `adb`, but *not* PocketQA itself.
- **App** — genuinely needs E1/E2/E3 running.

The `Device` rows are the trick that unlocks this whole plan: `uiautomator` and `adb screencap` give us real accessibility trees and real screenshots from *any* app on the phone today. We do not need PocketQA's capture service to have real data.

### Phase 0 — Foundations

| ID | Task | Depends on | MVP dep. | Done when |
|---|---|---|---|---|
| AI-B-01 | Stand up `services/ai-lab`: FastAPI, Pydantic v2, `uv`/Poetry, `.env` handling, `make dev` / `make test` / `make eval` | — | None | `GET /health` returns engine readiness; `.env.example` committed, `.env` git-ignored; no key ever reaches a log line. |
| AI-B-02 | Engine protocol + OpenAI engine: structured outputs (`strict: true`), retries with jitter, per-task timeout, cancellation, and a provenance record on every call | AI-B-01, AI-A-01 | None | A task call returns `Success` / `Unavailable` / `InvalidOutput` / `Timeout` / `Failed` exactly as Tech Spec §18.1 defines, and provenance records model id, prompt version, latency, token cost and whether output was rejected. |
| AI-B-03 | Fixture pipeline: `tools/uiauto_to_uistate.py` converting `uiautomator dump` XML + `adb exec-out screencap` into canonical `UiState` JSON | AI-A-01 | Device | One command produces a schema-valid `UiState` with normalized nodes, stable node IDs, bounds and a paired screenshot. Run it against a real app to prove it. |
| AI-B-04 | Fixture corpus v1 in `packages/ai-fixtures/`: the coupon-retry flow, plus a mutated-tree set and a clean/violating accessibility pair | AI-B-03, AI-A-03 | Device | Corpus validates in CI; Track A's evals run against it unmodified. |

AI-B-03 is the highest-leverage thing on this board. It also hands the Android team their golden test data for the E1-03 tree normalizer, so it pays for itself twice.

### Phase 1 — The safety and data spine

| ID | Task | Backlog row | Depends on | MVP dep. | Done when |
|---|---|---|---|---|---|
| AI-B-05 | **Redaction engine** (Python): tokens, emails, phone numbers, OTPs, card-shaped digits, sensitive field types — text, tree and image regions | P2 Privacy Auditor | AI-B-01 | None | Every safety fixture in `packages/policy-fixtures` is redacted before any payload leaves the process. A test asserts the outbound HTTP body against the fixture set. This mirrors Kotlin E1-07 — write it so it ports. |
| AI-B-06 | Wire redaction as a mandatory middleware, not a call site | invariant 4 | AI-B-05 | None | It is structurally impossible to reach the OpenAI engine without passing through redaction. Prove it with a test that tries. |
| AI-B-07 | **Multimodal UI-state fusion**: merge screenshot, accessibility tree, OCR text and timing into one `UiState` | P0 Multimodal UI state | AI-B-03 | Device | OCR recovers text the tree misses (canvas/custom views) and is merged with provenance on each node saying where the text came from. |
| AI-B-08 | Task routes: one thin FastAPI route per Track A task module, engine selection by config | AI-B-02 | None | `POST /tasks/{task_id}` works for every task; `?engine=deterministic` forces the twin; the route contains no reasoning logic. |
| AI-B-09 | Synthetic state-graph generator for the explorer | P1 Explorer Agent | AI-B-04 | None | Produces a branching graph of `UiState`s with known novel states and known dead ends, so Track A's ranker (AI-A-09) can be scored without a device. |
| AI-B-10 | Run-history store + labelled failure corpus (timing / animation / selector / environment / genuine) | P1 Failure Detective, P2 Flaky triage | AI-B-04 | None | At least 20 labelled runs; Track A's classifier scores against them. |

### Phase 2 — Memory, voice and vision

| ID | Task | Backlog row | Depends on | MVP dep. | Done when |
|---|---|---|---|---|---|
| AI-B-11 | **Local Test Memory**: `text-embedding-3-small` + Chroma; store app vocabulary, approved assertion phrasings and selector aliases; hybrid keyword + vector retrieval | P2 Local Test Memory | AI-B-04 | None | Retrieval returns the right alias for a renamed control on the mutated-tree fixtures. Hybrid search, not pure vector — a single subtle mention several runs back is exactly what pure vector search misses. |
| AI-B-12 | Memory port plan: SQLite + `sqlite-vec` schema and an on-device embedding path | P2 Local Test Memory | AI-B-11 | None | Written decision on the on-device embedding model, its size, and its readiness/download story. No download without an explicit user action (§18.3). |
| AI-B-13 | **Sarvam voice adapter**: streaming STT over `wss://api.sarvam.ai/speech-to-text/ws`, `Api-Subscription-Key` header, partial + final transcripts | Connected boost | AI-B-01 | None | A browser mic page produces a confirmable code-mixed transcript. Audio only — never a screenshot, tree, test or evidence payload (§28). Local Whisper works as an offline lab fallback. |
| AI-B-14 | **Visual regression**: image embeddings + semantic region matching instead of pixel diffing | P2 Visual Regression | AI-B-07 | Device | Tolerates a 1px shift and a font-rendering change; catches a genuinely missing element. Report false-positive rate against a shifted-but-equivalent fixture pair. |
| AI-B-15 | **Localization pipeline**: locale switching, OCR, and screenshot comparison to surface clipping, untranslated strings, wrong currency and RTL breakage | P2 Localization | AI-B-07, AI-B-14 | Device | Produces regions and evidence for Track A's judgment layer (AI-A-19). India-first differentiation — worth real effort. |
| AI-B-16 | Cost, latency and token telemetry per task, surfaced in `/health` and in eval output | operational | AI-B-02 | None | You can answer "what does one explorer mission cost and how long does it take" with a number, before the venue. |

### Phase 3 — Landing it in the app

This is the phase everyone fears and it should be small, because of everything above.

| ID | Task | Depends on | MVP dep. | Done when |
|---|---|---|---|---|
| AI-B-17 | Kotlin `StructuredInferenceEngine` interface + `InferenceGateway` skeleton (§18.1) | E0-02 | App | Compiles and returns `Unavailable` for every task. Land this early — it is a stub, and it unblocks the app team's wiring. |
| AI-B-18 | `HttpLabEngine` — a debug-only Kotlin engine pointing at `services/ai-lab` | AI-B-17, AI-B-08 | App | `internalLabDebug` builds can call every task on a laptop-hosted service over the local network. This is the integration, and it is one class. |
| AI-B-19 | Capability router (§18.2): deterministic first, then on-device, then connected-with-consent; never an automatic local→cloud fallback | AI-B-17 | App | Routing table test covers all four branches, including "no consent → deterministic or unavailable". |
| AI-B-20 | **ML Kit Prompt engine** (E2-07): status API, `AVAILABLE` / `DOWNLOADABLE` / `DOWNLOADING` / `UNAVAILABLE` handled distinctly, structured output where supported, 15s timeout, session release on background | AI-B-19 | App | Both the available and unavailable paths are demonstrable on the iQOO device. |
| AI-B-21 | **OpenAI review proxy** (E5-03): promote `services/ai-lab` to the authenticated proxy shape, runtime credential vault on device (E5-01) | AI-B-05, E5-01 | App | Redacted structured review round-trips; keys are Keystore-encrypted with one-tap removal; no key in the APK. |
| AI-B-22 | Kotlin redaction parity: Kotlin `RedactionEngine` passes the same `packages/policy-fixtures` set as the Python one | AI-B-05 | App | Identical redaction output across both languages on the shared fixtures. |

### Phase 4 — Stretch and platform bets

Only after the offline demo is frozen and stable.

| ID | Task | Backlog row | MVP dep. | Notes |
|---|---|---|---|---|
| AI-B-23 | **Performance anomaly scoring**: correlate slow states with UI transitions, CPU/memory and network timing | P3 | App | You produce the features and the anomaly score; Track A narrates it (AI-A-21). |
| AI-B-24 | LiteRT / Gemma engine spike behind the same interface | Custom local model | App | Report only: model size, delegate constraints, latency on the iQOO, download story. Do not integrate unless the report is clearly positive. |
| AI-B-25 | AppFunctions feasibility spike | P3 Cross-app Tool Agent | App | Timeboxed. Written answer on whether Android 16+ structured app capabilities are reachable on our device. |
| AI-B-26 | Computer Control feasibility spike | P3 Computer-Control Agent | App | Timeboxed. Note the OEM-preloaded-assistant constraint up front; expect this to be a "no" and document why. |
| AI-B-27 | Cooperative device agents: split one mission across two physical devices by locale | P3 | App | Venue stretch only. Do not start before the single-device demo is frozen. |

---

## Part 3 — Working specifications

### 3.1 Service contract

```text
GET  /health
     → { engines: {openai: READY|UNAVAILABLE, deterministic: READY},
         model: "<from POCKETQA_LLM_MODEL>", promptVersions: {...} }

POST /tasks/{task_id}?engine=auto|deterministic|openai
     body:  the task's request schema
     → 200  { result, provenance }
       422  { insufficientEvidence: true, deterministicResult }
       503  { reason }            # never a silent cloud fallback
```

Routes stay thin. If a route contains an `if` about *what the answer should be*, it belongs in Track A's task module.

### 3.2 Provenance record — required on every call

```json
{
  "engineId": "openai-responses",
  "model": "redacted-or-recorded",
  "promptVersion": "rank_assertions@v3",
  "latencyMs": 1840,
  "inputTokens": 912,
  "outputTokens": 88,
  "redactionApplied": true,
  "outputRejected": false,
  "rejectionReason": null,
  "consent": "OPERATION_LEVEL_GRANTED"
}
```

This is not telemetry nice-to-have. Tech Spec §27 requires provenance in the evidence bundle, and "which engine produced this and was its output rejected" is exactly what a judge or a reviewer will ask.

### 3.3 The fixture pipeline

```bash
# on any Android device, against any app — no PocketQA needed
adb shell uiautomator dump /sdcard/window_dump.xml
adb pull /sdcard/window_dump.xml
adb exec-out screencap -p > screen.png

python tools/uiauto_to_uistate.py \
  --xml window_dump.xml \
  --screenshot screen.png \
  --out packages/ai-fixtures/<flow>/s01.json
```

The converter must do the same normalization the Kotlin `StateNormalizer` will do (§13.5): stable node IDs, normalized roles, bounds, text and content-description, no retained platform node references. Where you and the Android team disagree on normalization, the fixture file is the forcing function to resolve it — early and cheaply.

### 3.4 Redaction ordering

Redaction runs **before** OCR results are stored, **before** any payload is embedded, and **before** any network call, without exception (§14.2). The middleware in AI-B-06 exists so that this ordering cannot be violated by a future call site that forgets.

Re-run the text regexes on the OCR and model payloads too — OCR can surface a token that was never in the accessibility tree.

---

## Part 4 — Boundaries

Things that are explicitly **not** yours, so you do not duplicate Track A's work:

- Prompt content, prompt versioning and the prompt envelope.
- Task reasoning logic and the deterministic twins' *rules* (you own where they run, not what they decide).
- Golden cases, scoring rubrics and eval thresholds.
- The response merge rule and the closed-vocabulary rejection logic.

And things nobody may do without a policy conversation first: let a task response reach the executor without a policy decision, add an automatic local→cloud fallback, or ship a connected call without operation-level consent.

---

## Part 5 — Definition of done for Track B

The track is complete when:

1. Every Track A task is reachable through the service, on either engine, selectable by config.
2. Redaction is structurally unavoidable and has Kotlin/Python parity on the shared fixture set.
3. The fixture corpus is real device data, schema-valid in CI, and reused by the Android team's tests.
4. The capability router demonstrably refuses to fall from local to connected without consent.
5. `internalLabDebug` on the iQOO can call every AI task; `internalRelease` runs the full demo with the network off.
6. You can state the cost and latency of every task with a measured number.
