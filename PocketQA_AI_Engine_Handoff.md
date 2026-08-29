# Handoff — connected inference engine (AI-B-02)

**Written by:** Track A, while implementing the reasoning tasks
**For:** whoever picks up Track B task `AI-B-02`
**Status:** working interim implementation, merged and in use by the eval harness
**Code:** `services/ai-lab/app/engines/openrouter_engine.py`, `app/schema_strict.py`, `app/config.py`

---

## 1. Why this exists

Track A's eight reasoning tasks were finished — prompts, envelopes, closed
vocabularies, deterministic twins, 27 eval cases — but **not one of them had ever
run against a real model**, because the engine that calls one is your task, not
mine. Every quality number in
[Track A](PocketQA_AI_Track_A_Reasoning.md) was the deterministic twin's.

Rather than let that sit unverified until you got to `AI-B-02`, I wrote the
smallest engine that implements the frozen protocol. It is ~200 lines and it
touches nothing else, because `app/engines/base.py` was already the wall between
us.

**You are not inheriting a design decision.** Replace this file when you build
the real thing. Two pieces are worth keeping, and section 4 says which. Section 6.6 lists the
three defects the interim engine itself had, all now fixed — read those before
writing the replacement, because a fresh implementation will hit the same three.

---

## 2. What is here

| File | Keep or replace | Why |
|---|---|---|
| `app/engines/openrouter_engine.py` | **Replace** | Interim. OpenRouter-specific transport, retry and header handling. |
| `app/schema_strict.py` | **Keep** | Pydantic JSON Schema → strict structured-output schema: strips unsupported keywords, forces `additionalProperties: false`, and inlines all `$ref`/`$defs`. Every OpenAI-compatible provider needs this and it took longer to get right than the engine did. |
| `app/config.py` | **Keep, extend** | `.env` loading with no dependency, and `describe()` which is safe to log and to serve from `/health`. |
| `.env.example` | Keep | Documents the two-model setup. |
| `evals/run_evals.py` `--engine all` | Keep | Three-way comparison; see section 5. |

The engine implements `StructuredInferenceEngine` from `app/engines/base.py` and
nothing else. It has no knowledge of any task: it takes a `TaskSpec`, calls
`task.prompt(request)` for the envelope and `task.parse_response(...)` for the
result. Adding a ninth task requires no engine change.

---

## 3. Provider note that will bite you

The spec (§29, epic `E5-03`) names the **OpenAI Responses API**. OpenRouter
exposes **Chat Completions**. They are different call shapes.

That does not matter for the lab — the protocol hides it — but when you build the
authenticated proxy (`AI-B-21`) you are choosing between:

- targeting the Responses API directly, as the spec says, and keeping OpenRouter
  as a dev-only convenience; or
- standardising on Chat Completions, which is what almost every provider speaks,
  and updating the spec reference.

I have no strong view. It is a real decision and it is yours. What matters is
that the choice lives behind `StructuredInferenceEngine` either way.

---

## 4. The three-layer validation story

This is the part I would most like to survive the rewrite, because it is easy to
collapse it by accident into something weaker.

Strict structured-output endpoints accept only a subset of JSON Schema. They
reject `pattern`, `minLength`, `minimum`, `minItems`, `format`, `default`, and
they require `additionalProperties: false` plus *every* property listed in
`required`. `app/schema_strict.to_strict()` does that transform.

Stripping our validation keywords sounds alarming until you see the layering:

```
1. strict schema      constrains the SHAPE of the response      (provider)
2. Pydantic           re-applies every constraint we stripped   (app/tasks/*)
                      ge/le, pattern, max_length, extra="forbid"
3. app/merge.py       enforces the CLOSED VOCABULARY            (app/merge.py)
```

A model returning `score: 1.4` is rejected at layer 2. A model returning a
fabricated candidate id is rejected at layer 3. Layer 1 is a hint to the model,
not a security boundary — so weakening it costs nothing, and **strengthening it
must never become a reason to weaken 2 or 3**.

If you swap providers and the new one supports more keywords, the right change is
to strip less in `_UNSUPPORTED`. It is not to move validation out of Pydantic.

---

## 5. Model choice, and why there are two

This is the part with product consequences, so it is worth reading even if you
rewrite everything else.

PocketQA routes **deterministic → on-device → connected-with-consent** (spec
§18.2). Given that, the useful question is not "how well does a frontier model do
this?" It is **"does a model small enough to fit on the phone do this?"** Tuning
prompts against a large cloud model and then shipping them to ML Kit Prompt /
Gemini Nano is how you discover at the venue that nothing transferred.

So the harness runs three engines, not two:

| Tier | Model | $/1M in–out | What it answers |
|---|---|---|---|
| Floor | deterministic twin | free | The airplane-mode guarantee. Always available. |
| **Device proxy** | `google/gemma-3-4b-it` | 0.05 / 0.10 | Gemma 3 4B is the family LiteRT/MediaPipe actually deploys on-device, and it is already in the tech spec's own references. A prompt that fails here will not survive `AI-A-16`. |
| Ceiling | `google/gemini-2.5-flash` | 0.30 / 2.50 | Best achievable, so we know what the on-device path gives up. |

Run it with `python evals/run_evals.py --engine all`.

**The metric that matters is the rejection rate**, not the correctness score. The
merge rule already handles a model that fabricates an identifier — it falls back
to the deterministic twin and records the rejection in provenance. So the
comparison tells you, in a number, how much the on-device path can be trusted
before you have a device to test on.

The exit code is decided by the **deterministic run only**. Models are measured,
not gated: an eval expectation written for the rules engine is not a
specification a model must match.

---

## 6. Measured results

35 eval cases, three engines, `--engine all --concurrency 8`. Total cost of the
run: **$0.039**.

| engine | correct | in vocabulary | rejected | engine failures | slowest call | cost |
|---|---|---|---|---|---|---|
| rules (deterministic) | 35/35 | 35/35 | 0 | 0 | 0 ms | free |
| device proxy — `gemma-3-4b-it` | 19/35 | 33/35 | **2** | 5 | 405 s | $0.0025 |
| ceiling — `gemini-2.5-flash` | 30/35 | 34/35 | 1 | 0 | 13 s | $0.0366 |

**Correctness is not the headline.** Those expectations were written for the
deterministic twin, and several "failures" are the model disagreeing defensibly —
Gemini ranks *"Discount Rs 100"* second on the coupon flow where the rules rank it
fourth, and it is arguably right, because the discount line is direct evidence the
coupon is still applied.

Four things in that table actually matter.

### 6.1 The closed vocabulary caught a real hallucination, on the worst task to hallucinate on

Both device-proxy rejections are `repair_selector`, and both are the *declining*
cases — `m6_control_absent` and `m15_everything_changed`, where the control the
selector points at is genuinely not on screen. Gemma proposed node `n_apply`.
There is no `n_apply` on those screens. It invented the id of the node it had been
told was missing.

Had that reached the product, a self-heal would have silently retargeted an
approved test at a node that does not exist. `app/merge.py` rejected the response,
fell back to the deterministic twin, and recorded the rejection in provenance —
which is the entire design working, once, on a real model, on the task where a
wrong answer does the most damage. Safety invariant 4 and spec §16.3 are why
repair output is a proposal and never an action; this is the measurement behind
that rule.

Gemini did not do this: 15/15 on the same fixtures.

### 6.2 The device-sized model ignored a safety budget

`explorer-respects-budget` gives the ranker a highly novel candidate and
`remainingActions: 0`. The correct answer is `STOP`. Gemma answered `p1`.

The mission budget is a safety control, not a hint. This is measured evidence for
something the architecture already assumes (spec §22.5 has the policy engine
re-evaluate every choice against the live state): **budget enforcement must never
be delegated to the model**, and on a device-sized model it visibly cannot be.

### 6.3 Gemma's latency is unusable without concurrency

Worst single call: **405 seconds**. Median is a few seconds. The first attempt at
this suite ran serially and was killed at 19 minutes without finishing.

Two consequences. The harness now runs model cases through a thread pool
(`--concurrency`, default 8), which brings a full three-engine run to a few
minutes. And on-device inference should be expected to be *variable*, not merely
slow — a fixed 15 s timeout (spec §18.3) will fire often, so the deterministic
fallback is a routine path, not an exceptional one.

### 6.4 The evals found three defects in the contracts, not in the models

Worth recording, because all three were mine and all three were invisible until a
real model ran:

1. **`repair_selector` asked the model whether human review was required.**
   `reviewRequired: Literal[True]` was in the response model; strict structured
   outputs force every property into `required`; so every model was asked, every
   model answered `false`, and every response was discarded. Whether a repair
   needs review is not the model's call. Fixed by `BaseResponse.SERVER_ASSERTED`
   — fields stripped from the provider schema and filled from the default after
   parsing.

2. **Stripped constraints were never communicated.** `app/schema_strict.py`
   removes `maxLength` and `pattern` because strict endpoints reject them, but
   Pydantic still enforces them on the way back. A model wrote a good
   260-character justification against a 240 cap, and another wrote
   `groupId: "group_1"` against `^g\d{1,3}$`. Correct reasoning, discarded
   response. The envelope now states every stripped constraint as text, and a
   test asserts it for each task.

3. **`compile_intent`'s vocabulary format was ambiguous.** Permitted values were
   listed as prefixed tokens (`value:a1:SAVE20 applied`) with no explanation of
   the prefix, so a model copied the whole token into the field and produced
   `value:a1:value:a1:SAVE20 applied`. Fixed in prompt `compile_intent.v2` by
   documenting the token format — and by telling the model that transient text
   makes a poor assertion, which it had also needed to be told.

The reason these are worth reading rather than skipping: each one looks like a
model failure in the raw output and is a contract failure on inspection. Expect
more of that shape when you extend this.

### 6.5 What the `compile_intent` v2 prompt bump changed

Re-measured after the fix in 6.4(3), `--task compile_intent`:

| engine | correct | in vocabulary | rejected | engine failures | slowest |
|---|---|---|---|---|---|
| rules | 3/3 | 3/3 | 0 | 0 | 0 ms |
| device proxy | 0/3 | 3/3 | 0 | **3** | 367 s |
| ceiling | 2/3 | 3/3 | 0 | 0 | 3 s |

On the ceiling model the fix worked: the malformed-value rejection is gone, and
the model stopped selecting *"Loading…"* as an assertion once v2 told it that
transient text makes a poor one. Its one remaining disagreement is selecting
*"Discount Rs 100"* where the rules select the network-error precondition — a
judgement call, not an error.

On the device proxy, `compile_intent` now fails outright: three `InvalidOutput`
results and a worst case of 367 seconds. **Do not read that as a v2 regression** —
there is no clean v1 device-proxy baseline for this task to compare against, so
the cause is unattributed. It is the largest prompt after `classify_flake`, which
makes prompt size the first hypothesis to test.

Either way it is the finding with the most product weight in this document:
`compile_intent` is the **P0 core capability**, and the model that stands in for
the on-device path cannot currently complete it. Task `AI-A-16` (on-device prompt
tuning) should start here rather than at the end of the ladder, and the honest
read today is that the on-device tier is a *ranking and explanation* layer, not a
compilation layer. The deterministic compiler carries that job — which is what
spec §17 and ADR-006 already say, now with a measurement behind it.

### 6.6 Three defects in the engine itself, all fixed

Distinct from 6.4, which were contract defects. These were transport and schema
defects in this engine, and a fresh implementation of `AI-B-02` will meet all
three.

**No real request deadline.** `httpx`'s read timeout is per-read, not
per-request, so a model dripping one token every few seconds keeps the connection
alive and nothing ever fires. Observed: a single `gemma-3-4b` call running past
six minutes against a 30-second read timeout, and a first eval run killed at 19
minutes without finishing. Fixed by streaming the response body and checking the
elapsed budget on every chunk — leaving the `stream()` context closes the
connection, so abandoning a slow response actually abandons it. A 3-second budget
now returns `Timeout` at 3.1 seconds. **On device this is not optional**: spec
§18.3 mandates a 15-second cap and a per-read timeout cannot deliver one.

**A new client per call.** The original `_post` built an `httpx.Client` per
request and never closed it — no connection reuse, leaked sockets. Now one client
per engine instance, with explicit connect/read/write/pool timeouts and
connection limits.

**`$ref` indirection in the model-facing schema.** Pydantic factors every nested
model and every enum into `$defs`, so a response schema reaches the provider as a
tree of pointers. Large models follow them; a device-sized model has to hold the
pointer target in mind while generating, which is exactly the indirection it
drops. `to_strict` now inlines all of it. The committed contracts in
`packages/schemas/ai/` deliberately keep `$defs` — those are read by Kotlin and
TypeScript, not by a model, and a test pins both behaviours.

---

## 7. What `AI-B-02` proper still needs

Everything below is deliberately absent from the interim engine.

| Gap | Notes |
|---|---|
| Streaming | Not needed for structured outputs; will be needed if you surface partial evidence-writer output in the UI. |
| Provenance persistence | The engine builds an `InferenceProvenance` per call and hands it back. Nothing writes it anywhere yet — that is `AI-B-02`'s provenance record and the evidence bundle (spec §27). |
| Cost and latency telemetry | `AI-B-16`. The harness estimates cost from a hard-coded price table; the real service should read usage from the response and record it per call. |
| Consent enforcement | The engine records `OPERATION_LEVEL_GRANTED` because reaching it required someone to name it explicitly. The actual gate is your capability router, `AI-B-19`. **Constructing this class is not consent.** |
| Redaction | The engine trusts that `task.prompt()` redacted the evidence, which it does via the Track A stub. When `AI-B-05`/`AI-B-06` land, redaction becomes middleware and the engine should assert it ran rather than assume it. |
| Concurrency | Fixed in the harness (thread pool), not in the engine. The engine is still one synchronous call at a time. |
| Image input | The envelope caps at one image (spec §18.3) but no task sends one yet. The engine does not build image message parts. |
| Key handling | Reads `.env`. On device this is the Keystore-backed runtime vault, `E5-01`. |

---

## 8. Decisions I made that you may want to reverse

1. **Retry on 408/409/429/5xx only**, 3 attempts, exponential backoff with
   jitter. Jitter matters because the harness fires the suite at once and would
   otherwise retry in lockstep.
2. **Provider error bodies are never logged** — only the status code. Provider
   errors can echo the prompt back, and the prompt contains captured evidence.
   Spec §34 treats error strings as an exfiltration path.
3. **`_unfence()`** strips a ```` ```json ```` fence if a model adds one despite
   structured outputs. Small models do this often enough that failing on it would
   misreport a formatting quirk as a reasoning failure — exactly the confusion
   the device-proxy tier exists to avoid.
4. **`temperature = 0.1`**, per spec §18.3. Ranking and classification are not
   creative tasks.
5. **One model per engine instance.** The harness builds two. An engine that
   switches models per call would make provenance ambiguous.

---

## 9. Taking it over

```bash
cd services/ai-lab
make install
cp .env.example .env          # add OPENROUTER_API_KEY
make test                     # 89 unit tests, no network
make eval                     # deterministic gate, no network
python evals/run_evals.py --engine all      # three-way comparison, costs money
python evals/run_evals.py --engine device --task rank_assertions   # one task
```

Checklist when you replace the engine:

- [ ] New engine implements `StructuredInferenceEngine` and returns all five
      `InferenceResult` cases — `Success`, `Unavailable`, `InvalidOutput`,
      `Timeout`, `Failed`.
- [ ] `Failed.safe_code` carries no captured content.
- [ ] `make eval` still exits 0 (the deterministic gate is untouched by engine work).
- [ ] `--engine all` still produces a comparison, so prompt changes stay measurable.
- [ ] `app/schema_strict.py` still runs on the response schema, or your provider
      genuinely needs no transform and you have tested that claim.
- [ ] Provenance records `outputRejected` — `app/merge.py` sets it via
      `MergeOutcome.annotate()` and it is what tells a reviewer the model was
      overruled.
