# PocketQA — capture findings and the interaction-inference design

**Written after a full on-device run** on the iQOO I2501 (Android 16, SDK 36) against
`internalLabDebug` and the Demo Shop, on 2026-08-29.

This document has two halves. Part 1 records what was found and fixed getting the
app to run end to end, so none of it has to be rediscovered. Part 2 is the design
for the one problem that cannot be fixed by patching: **PocketQA cannot currently
capture a tap in a Jetpack Compose app**, and the fix for that is what turns
PocketQA from a demo into a product.

---

## Part 1 — What the on-device run established

### 1.1 The flow, as far as it goes

Verified working on a clean install:

```
Welcome → Capture Disclosure (consent) → Device Readiness → Home / Test Library
  → New test → Intent → Capture Ready → Start demonstration
  → Demo Shop foregrounded → live capture → Finish → Compile → Review draft
```

Readiness correctly reports Accessibility **Ready**, Screenshot **Ready**, Storage
**Ready**, Demo Shop **installed**, and — on this device — *"On-device Prompt API:
Unsupported — deterministic local compiler is the guaranteed path."* That is the
fallback architecture confirming itself on real hardware, which is worth saying
out loud: the deterministic path is not a theory here, it is what runs.

The review gate is the strongest part of the product. It refuses to proceed
without an end-state assertion, in the spec's own words, and it offers a typed
assertion builder rather than free text.

### 1.2 Defects found and fixed

Every one of these was pre-existing. The app had **never launched** before this
session — the first five fire in `Application.onCreate` or during the first
render, so nothing downstream had ever executed on a device.

| # | Defect | Consequence |
|---|---|---|
| 1 | `com.google.mlkit:genai-common:1.0.0-alpha1` does not exist (404 from Maven Central, Google, JitPack) | The app did not compile at all. Tech Spec §7 names `1.0.0-beta2` and says to recheck before locking. |
| 2 | KSP2 crashed on `react-native-async-storage` — `unexpected jvm signature V` | Every app build failed. KSP1 processes it; Room is unaffected. |
| 3 | `PocketQaApplication` passed `this` to `DefaultReactNativeHost` inside an object expression | `this` is the anonymous object, not the Application. Compile error. |
| 4 | `JsonBridge` passed nullable `getMap`/`getArray` where non-null was expected | Compile error. A null entry is JSON null, not a crash. |
| 5 | `SoLoader.init(this, false)` — the pre-0.76 form | RN 0.76+ merges the JNI libraries into `libreactnative.so`. Without `OpenSourceMergedSoMapping`, SoLoader hunts the old split libs and dies on `libreact_featureflagsjni.so`. |
| 6 | No `android:theme` in the manifest | `AppTheme` existed and was never applied — *"You need to use a Theme.AppCompat theme"*. |
| 7 | Hardcoded `../../../../node_modules` paths in `settings.gradle` and `app/build.gradle` | npm does not guarantee where it hoists a workspace dependency. These resolved to the repo root on one install and to `apps/pocketqa-mobile/node_modules` on the next, and the build broke the moment hoisting shifted. Now resolved via `node --print require.resolve(...)`, which is what the RN template itself does. |
| 8 | `metro.config.js` did not watch the workspace root | Hoisted `@babel/runtime` was invisible to Metro; the bundle would not build. |
| 9 | `@babel/plugin-transform-export-namespace-from` missing from `babel.config.js` | Declared in `jest.config.js` but not the app config, so `src/domain/index.ts` would not compile. |
| 10 | React Navigation theme built by hand with no `fonts` key | v7 requires it; `useHeaderConfigProps` → *"Cannot read property 'regular' of undefined"* on the first screen. |
| 11 | **`emitCaptureProgress` hardcoded `stepCount = 0` and `elapsedMs = 0`** | The capture screen read *"0 steps captured · 0 ms"* no matter what had been recorded. Steps were landing in Room the whole time. After the fix one tap jumped the counter to `7 steps captured` — those seven were already in the database, never displayed. |
| 12 | **`simulate()` persisted a step and emitted nothing** | The canonical-scenario buttons appeared inert. |
| 13 | **`COMPILE_PROGRESS` / `COMPILE_FINISHED` were emitted nowhere in the codebase** | `CompileProgressScreen` navigates to review only on `COMPILE_FINISHED`. `compileFromSession` is synchronous, so the work finished instantly and the screen span forever. |
| 14 | **`upsertActiveOp` existed in the DAO and was never called** | Room never knew an operation was in flight. `startupState()` could not offer resume-or-cancel, and the in-memory `OperationLock` had nothing to reconcile against — so an abandoned capture held the process-wide lock and **every later `startCapture` failed with a conflict until the process was killed**. Now written on start, cleared on finish/cancel, reconciled against Room in `startupState()`. |
| 15 | **`launchDemoShop` failed silently** | It started the activity from the *application* context — Android 10+ restricts background activity starts — and every failure path was a bare `?: return`. The session went to "Recording" with the target app never in front; the service, correctly scoped to the target package, saw nothing; capture recorded zero steps with no clue why. Now uses `currentActivity` when available, and a failure unwinds the session and rejects with `TARGET_LAUNCH_FAILED` instead of recording nothing. |

### 1.3 Two more that are worth fixing but were not in the way

- **`npm ci` fails on `main`.** `react-test-renderer@18.3.1` and `@types/react@18`
  were never bumped when the app moved to React 19, so the committed lockfile
  cannot be installed cleanly. The working tree was never reproducible from git.
- **The RN jest suite cannot run.** RN 0.87.1 ships no jest preset, so
  `preset: "react-native"` resolves to nothing. Eight test files, zero
  executable.

### 1.4 Operational notes — put these on a sticky note

1. **Never `adb shell am force-stop` PocketQA.** Android disables a force-stopped
   app's accessibility service. Readiness then correctly reports "Needs action"
   and you will chase a ghost for twenty minutes.
2. **Reinstalling also disables it.** Re-enable after every `adb install -r`.
3. **Build the bundle with `--dev false`.** The LogBox warning badge sits over the
   bottom of the screen and swallows taps on primary buttons, which looks exactly
   like a frozen app.
4. **Build arm64 only** — `-PreactNativeArchitectures=arm64-v8a`. Reanimated's C++
   fails to compile for x86, and the device is arm64 anyway.
5. **`usesCleartextTraffic="false"`** blocks Metro over localhost, so there is no
   hot reload in `internalLabDebug`. Bundle into assets instead.
6. On the Intent screen, `Continue` is gated on `intent.length ≥ 10 && pkg && ack`
   — the **target app must be tapped**, it is not selected by default.

---

## Part 2 — Interaction inference from state diffs

### 2.1 The problem, with evidence

Jetpack Compose dispatches `TYPE_VIEW_CLICKED` **only when a click arrives through
the accessibility API** (`performAction(ACTION_CLICK)`). A real finger tap runs the
`onClick` lambda and emits no accessibility event for the click at all.

`CaptureCoordinator.classify()` handles exactly three event types:

```kotlin
TYPE_VIEW_CLICKED       -> tap
TYPE_VIEW_LONG_CLICKED  -> longPress
TYPE_VIEW_TEXT_CHANGED  -> typeText
else                    -> null      // dropped
```

Instrumented trace from a clean run — `Add` tapped, `Cart` tapped, `SAVE20` typed:

```
stable before=null            after=state_1017…  sink=true pending=0
stable before=state_1017…     after=state_5e6e…  sink=true pending=0   ← two taps, nothing pending
classified action=typeText label=SAVE20 nodeId=n_0_0_1                 ← typing works
stable before=state_5e6e…     after=state_5999…  sink=true pending=1
```

Raw event types received across the whole run:

| event type | count |
|---|---|
| `TYPE_WINDOW_CONTENT_CHANGED` | 6 |
| `TYPE_WINDOW_STATE_CHANGED` | 2 |
| `TYPE_VIEW_TEXT_CHANGED` | 1 |
| **`TYPE_VIEW_CLICKED`** | **0** |

So taps are structurally invisible. Every compiled step gets `targetNode == null`,
which sets `needsHumanCorrection = true` (`PocketQaRepository` ~line 542), and
**Approve can never be reached**. This is not a bug in the review screen; there is
genuinely nothing for it to review.

Text entry works because `TYPE_VIEW_TEXT_CHANGED` carries a source node. That is
the one interaction Compose does report.

### 2.2 Why inference rather than instrumentation

Three ways out. Only one of them is a product.

| Option | Verdict |
|---|---|
| Instrument Demo Shop to announce clicks | Works, and it is legitimate under ADR-008 for a team-owned target. But it narrows the claim to *"PocketQA records apps we have instrumented"*, which is not the pitch. |
| Rewrite Demo Shop as View-based | Fastest to a green demo, and it hides the problem rather than solving it. The next app anyone points at will be Compose. |
| **Infer the interaction from the state transition** | Works on any app, instrumented or not. This is the one that makes the claim true. |

Compose is not an edge case — it is the default for new Android UI. A capture tool
that cannot record Compose taps cannot record most modern apps.

### 2.3 The core idea

The tapped node is not directly observable, but it is **inferable**. Between two
stable states we hold the full accessibility tree before and after. A tap is the
hypothesis that best explains the difference.

```
   B (before tree)            A (after tree)
        │                          │
        └────────► diff ◄──────────┘
                    │
        candidate targets from B
                    │
             score each candidate
                    │
        best score → attribution + confidence
                    │
     ≥ 0.75 accept · 0.40–0.75 accept + flag · < 0.40 unattributed
```

The output is not a certainty. It is a **ranked attribution with a confidence**,
handed to the review gate that already exists. Spec §16.3 already says a newly
inferred selector is a repair proposal rather than something to act on, and
`SelectorCandidatesScreen` already exists to present alternatives. Inference feeds
that machinery instead of leaving it empty.

### 2.4 Prerequisite: the tree does not yet carry affordances

`UiTreeCapture.traverse` currently emits per node:

```
nodeId, role, text, contentDescription, resourceId, testId,
enabled, visible, sensitive, bounds{x,y,w,h}
```

It does **not** emit `clickable`, `focusable`, `checkable`, `checked`, `selected`,
or `scrollable`. Without `clickable` there is no affordance signal at all, and
affordance is the strongest prior we have — a tap lands on something tappable.

This is also why `services/ai-lab/app/capture_adapter.py` defaults those fields to
false and under-reports accessibility findings rather than inventing them.

**Task CAP-01 is therefore a prerequisite for everything else in this design.**

Also missing and needed: **display metrics** (`widthPx`, `heightPx`, `density`) on
the state, so bounds can be normalised to ratios and dp-based rules evaluated.

### 2.5 The signals

Each candidate node from the before-tree is scored on how well it explains the
observed transition. Weights below are a starting point to be calibrated against
the labelled corpus (§2.9), not final numbers.

| # | Signal | Weight | Rationale |
|---|---|---:|---|
| 1 | **Affordance** — `clickable`, or role in {button, link, listItem, tab, switch, checkbox}, and `enabled && visible` | gate | Not a score but a **filter**. A non-interactive node scores zero and is dropped. This is the single highest-value signal and it needs CAP-01. |
| 2 | **Toggle flip** — candidate is `checkable` and its `checked` value differs between B and A | +0.45 | Near-certain. A switch that changed state was almost certainly the thing touched. |
| 3 | **Self-mutation** — the candidate's own `text`, `enabled` or `selected` changed | +0.30 | "Add" → "Added", "Apply" → disabled. Strong and common. |
| 4 | **Label-to-destination match** — the window/screen title in A matches the candidate's label in B | +0.35 | Tapping **Cart** lands on a screen titled **Cart**. This is the signal that would have caught both missed taps in the trace above. |
| 5 | **Disappearance** — candidate present in B, absent in A, and interactive | +0.25 | Dialog dismiss buttons, list items that navigate away. |
| 6 | **Subtree causality** — the added/removed/changed nodes in the diff are descendants of the candidate's nearest stable container | +0.15 | Weak alone, useful as a tiebreak. A tap on "Add" changes a cart badge elsewhere, so this must stay weak. |
| 7 | **Focus hint** — a `TYPE_VIEW_FOCUSED` event arrived for this node in the window | +0.20 | Not always present, decisive when it is. |
| 8 | **Recency of last text entry** — for `typeText` we already have a source node | n/a | Text entry keeps using the direct event path. Inference is only for taps. |
| 9 | **Ambiguity penalty** — number of candidates within 0.1 of the top score | −0.10 each | Explicitly pushes genuinely ambiguous transitions below the accept threshold, where they belong. |

### 2.6 Confidence bands and what each does

```
confidence ≥ 0.75   attribute the step, build the selector normally,
                    needsHumanCorrection = false

0.40 – 0.75         attribute the step, attach the ranked alternatives,
                    needsHumanCorrection = true
                    → review opens SelectorCandidatesScreen pre-populated

confidence < 0.40   record an "unattributed interaction" step carrying the
                    diff summary, needsHumanCorrection = true
                    → review shows "PocketQA saw the screen change here but
                      could not tell what you tapped" and offers the diff
```

The third band matters as much as the first. Today an unattributable transition is
recorded as a step with no target and no explanation. Saying *what was observed
and why it was not attributable* is the difference between a tool a QA engineer
trusts and one they stop using.

**Never silently guess.** A confident wrong selector is worse than an honest gap,
because it produces a green test that asserts nothing.

### 2.7 Where the code changes

| File | Change |
|---|---|
| `capture/UiTreeCapture.kt` | **CAP-01.** Emit `clickable`, `focusable`, `checkable`, `checked`, `selected`, `scrollable`. Emit `display{widthPx,heightPx,density}` on the state. Emit a per-node `fingerprint` (role + normalised label + resourceId tail + bounds bucket) so nodes can be matched across trees when `nodeId` paths shift. |
| `capture/StateDiff.kt` *(new)* | Pure function `diff(before, after): StateDiff` producing `added`, `removed`, `changed[{nodeFingerprint, field, from, to}]`, `windowTitleChanged`, `fingerprintDistance`. No Android dependencies, so it is unit-testable on the JVM. |
| `capture/InteractionInference.kt` *(new)* | `infer(before, after, hints): Attribution?` implementing §2.5. Returns `nodeId`, `confidence`, `alternatives: List<nodeId>`, `signals: List<String>` (which signals fired, for the review UI and for debugging). |
| `capture/CaptureCoordinator.kt` | In `onStableState`, when `pendingEvents` is empty **and** the diff is material, call `InteractionInference.infer` and synthesise a `PendingEvent(action="tap", inferred=true, …)`. Do not infer when a real event already explains the transition. |
| `capture/CaptureCoordinator.PendingEvent` | Add `inferred: Boolean`, `confidence: Double`, `alternatives: List<String>`, `signals: List<String>`. |
| `storage/PocketQaRepository.appendClassifiedEvent` | Persist the attribution block into the event payload. |
| `storage/PocketQaRepository.compileFromSession` | Set `needsHumanCorrection` from **confidence band**, not from `targetNode == null`. Carry `attribution` onto the step so review can explain itself. |
| `src/components/ReviewStepCard.tsx` | Show the attribution: "inferred from screen change · 0.62 · label matched destination", and wire `Needs correction` to `SelectorCandidatesScreen` with the alternatives. **That control is currently dead** — it renders but navigates nowhere. |
| `packages/schemas/src/UiState.ts` | Add the affordance and display fields (already stubbed as optional there). |

### 2.8 Edge cases that must be handled explicitly

- **Scroll versus tap.** A scroll changes the tree wholesale without an
  interaction target. Detect via bounds translation of a stable node set and
  classify as `scroll`, not as an unattributed tap.
- **Animation mid-flight.** The 180 ms debounce in the service is not always
  enough. Require two consecutive identical trees before treating a state as
  stable, or the diff attributes to an animation frame.
- **Self-updating screens.** Clocks, countdowns and polling badges change the tree
  with no interaction at all. Suppress attribution when the only changes are in
  nodes whose text matches the dynamic patterns already implemented in
  `services/ai-lab/app/relevance.py::is_dynamic`.
- **Multi-window / dialogs.** A dialog opening is a window-state change, not a
  content change; the candidate set must come from the *originating* window.
- **`nodeId` instability.** Path ids (`n_0_0_1`) shift when siblings are inserted.
  Cross-tree matching must use the node fingerprint from CAP-01, not the path.
- **Rapid taps.** Two taps inside one debounce window collapse into one
  transition. Detect via multiple independent change clusters and record as
  unattributed rather than inventing one target.

### 2.9 How to build and prove it — reuse Track A's pattern

This is a ranking problem with a ground truth, which is exactly the shape the AI
lab already handles well. `DeterministicRanker.kt` was built this way and reached
four-decimal parity with its Python reference, so the pattern is proven in this
codebase.

1. **Capture a labelled corpus.** Drive Demo Shop and real third-party Compose
   apps, recording `(before, after, actual_target_nodeId)` triples. The actual
   target is known because the operator tapped it. Store under
   `packages/ai-fixtures/interactions/`.
2. **Write the reference implementation in Python** in `services/ai-lab` as a new
   task, `infer_interaction`, with a deterministic twin and golden cases. Iterate
   on weights there — seconds per run, not a two-minute Gradle cycle.
3. **Score it properly.** Top-1 accuracy, top-3 accuracy, and — most importantly —
   **calibration**: when the model says 0.8, is it right 80% of the time? A
   confidence that does not mean anything is worse than no confidence, because
   the whole design leans on the bands in §2.6.
4. **Port to Kotlin** with a parity test against the same corpus, the way
   `DeterministicRankerTest` pins the ranker.
5. **Gate on the corpus in CI.** A weight change that improves top-1 while
   degrading calibration is a regression.

Target for MVP: **top-1 ≥ 0.85 on Demo Shop**, and **no confident-wrong
attributions above 0.75** on the whole corpus. The second number matters more
than the first.

### 2.10 Task breakdown

| ID | Task | Depends on | Notes |
|---|---|---|---|
| `CAP-01` | Emit affordances + display metrics + per-node fingerprint from `UiTreeCapture` | — | Prerequisite for everything. Also unblocks `AI-A-14` fixture conversion and the accessibility auditor's touch-target rule. |
| `CAP-02` | `StateDiff.kt` — pure, JVM-testable tree diff | CAP-01 | |
| `CAP-03` | Labelled interaction corpus in `packages/ai-fixtures/interactions/` | CAP-01 | Needs a device and an operator; the slowest item, start it first. |
| `CAP-04` | Python reference `infer_interaction` + evals in `services/ai-lab` | CAP-02, CAP-03 | Iterate weights here. |
| `CAP-05` | `InteractionInference.kt` + parity test against CAP-04 | CAP-04 | Same pattern as `DeterministicRankerTest`. |
| `CAP-06` | Wire inference into `onStableState`; extend `PendingEvent` | CAP-05 | |
| `CAP-07` | Confidence bands drive `needsHumanCorrection`; persist attribution | CAP-06 | |
| `CAP-08` | Review UI: show attribution, wire `Needs correction` → `SelectorCandidatesScreen` | CAP-07 | The control is dead today. |
| `CAP-09` | Scroll / animation / dynamic-content suppression (§2.8) | CAP-06 | |
| `CAP-10` | CI gate on top-1 and calibration | CAP-04 | |

`CAP-01` and `CAP-03` can start immediately and in parallel. Nothing else can
start until `CAP-01` lands, because the tree does not currently carry the fields
the algorithm needs.

---

## Part 3 — What is still open

- **Approve is unreachable** until inference lands, so replay, evidence and
  Maestro export remain unverified on device. They are implemented; they have
  never run.
- **The `Needs correction` control navigates nowhere.** Even with a good selector
  candidate list there is no way for a human to apply it. `CAP-08`.
- **The mock harness cannot produce approvable steps.** `appendSimulatedEvent`
  writes no `nodeId` and no `beforeStateId`, so simulated steps always resolve to
  `targetNode == null`. It is useful for exercising the pipeline, not for a demo.
- **`ui-state.schema.json` does not exist** (E0-02), so the AI fixture corpus is
  validated only against the AI task schemas.
- **`@pocketqa/schemas` is imported by nothing** — see the note in
  `packages/schemas/src/UiState.ts`. The contract has been aligned to what capture
  actually emits, but nothing consumes it yet.
