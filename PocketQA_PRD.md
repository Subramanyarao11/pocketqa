# PocketQA Product Requirements Document

**Document status:** Build-ready v1.0  
**Product:** PocketQA  
**Category:** Developer Tools / On-device AI  
**Team:** Tech Phantoms  
**Primary platform:** Android, demonstrated on an iQOO device  
**Primary audience:** Mobile developers, QA engineers, and small product teams  
**Last updated:** 29 August 2026  
**Companion documents:** `PocketQA_Technical_Spec.md` and `PocketQA_Mac_Setup_and_New_Developer_Guide.md`

---

## 1. Executive summary

PocketQA is a private, on-device mobile QA copilot that turns human intent and a demonstrated app flow into a reviewable, replayable regression test.

A developer says what they want to verify, performs the flow once, reviews the test PocketQA proposes, and exports a portable test plus evidence. After that trusted authoring loop is complete, a bounded Explorer Agent can inspect nearby, explicitly permitted states to suggest missing checks. The agent can observe and propose; a deterministic executor is the only component allowed to act.

PocketQA is designed around a problem the team experiences while building mobile products: human intent is easy to express but hard to turn into reliable automation. Existing tools can execute tests once they have been authored, but authoring, selector maintenance, failure diagnosis, and evidence collection still consume specialist time. PocketQA closes that gap without making raw screenshots or app data cloud-dependent.

The hackathon build will prove one complete promise:

> Show a mobile flow once and receive an editable, deterministic test, a replay result, and a useful evidence bundle—even with the network turned off.

The build will also demonstrate one carefully bounded agentic extension:

> Ask PocketQA to explore a narrow goal inside an allowlisted demo app, inspect the plan before it runs, and review any new test it proposes.

## 2. Product thesis

### 2.1 The problem

Mobile teams regularly face the following sequence:

1. A product manager or developer describes a behavior in natural language.
2. A developer manually reproduces it on a device.
3. A QA or automation specialist translates the behavior into a framework-specific test.
4. The test becomes brittle when text, layout, timing, or selectors change.
5. When it fails, the team receives a red result without enough context to understand why.

This creates four concrete gaps:

- **Intent gap:** “Verify the discount remains after retry” is understandable to a person but is not executable.
- **Authoring gap:** Test frameworks require selectors, waits, assertions, fixtures, and syntax that many contributors do not know.
- **Maintenance gap:** Small UI changes break selectors even when the user journey is still valid.
- **Evidence gap:** A failed test often lacks the screen, UI hierarchy, state transition, and reasoning needed to diagnose it.

### 2.2 The opportunity

Modern Android devices expose structured UI state, screenshots, offline OCR, and—in compatible environments—on-device generative models. Used carefully, these capabilities can translate a demonstration into a structured draft and explain failures without giving an unconstrained model control of the device.

PocketQA is not another test runner. It is an authoring, inspection, and evidence layer that complements runners such as Maestro.

### 2.3 The product promise

PocketQA accepts:

- a text or voice intent;
- a human demonstration of the target flow;
- screenshots, accessibility nodes, OCR, and timing captured on the device; and
- optional app context such as package name and a short description.

PocketQA produces:

- a strict, editable test draft;
- stable selectors with confidence and fallbacks;
- deterministic replay;
- assertions grounded in observed evidence;
- a Maestro-compatible YAML export; and
- an evidence bundle containing screenshots, state snapshots, logs, and a concise failure explanation.

## 3. Product principles

All product and engineering decisions must follow these principles, in priority order.

### P1. Human intent in; deterministic evidence out

AI may interpret intent, rank candidate assertions, propose selectors, summarize failures, and plan bounded exploration. Only validated schemas and deterministic code may drive execution or produce the final test artifact.

### P2. Local by default

Screen content, accessibility data, test history, and evidence remain on the device unless the user explicitly enables a connected provider for the current operation. The core authoring and replay demo must work in airplane mode.

### P3. Review before action

The user must see and approve a generated test before replay. An Explorer mission must show its goal, allowlisted app, action budget, proposed steps, and hard stops before it acts.

### P4. Semantic selectors before coordinates

PocketQA prefers resource IDs, test IDs, accessibility labels, visible text, roles, and relative hierarchy. Coordinate taps are a last-resort fallback, visibly marked as brittle, and are not used by the Explorer Agent in the hackathon MVP.

### P5. Fail closed

If the package changes, the UI target is ambiguous, a sensitive field is detected, a safety rule is triggered, a state cannot be verified, or model output fails validation, PocketQA stops. It never guesses and continues.

### P6. Evidence over confidence theater

Every proposed assertion and selector should point to the captured state that supports it. Confidence values must have an operational meaning, not merely look intelligent.

### P7. Reliable demo before broad autonomy

One high-quality authoring loop and one narrow, safe exploration mission are more valuable than many partially working agents.

## 4. Goals and non-goals

### 4.1 Hackathon MVP goals

The MVP must:

1. Run as an Android application on the selected iQOO demo device.
2. Accept a typed test intent. Voice input is a P1 enhancement but should be included if stable.
3. Let a user select an allowlisted target application.
4. Record a human demonstration of a flow across at least four meaningful UI states.
5. Capture an accessibility tree and screenshot at each stable state.
6. Convert the intent and demonstration into a schema-valid test draft.
7. Let the user review, edit, delete, reorder, and approve steps and assertions.
8. Replay the approved test deterministically.
9. Display pass or fail with useful evidence.
10. Export a valid Maestro YAML flow and a machine-readable evidence bundle.
11. Complete the entire primary path without network access.
12. Demonstrate a bounded Explorer mission in an allowlisted demo app, with a visible budget and hard stops.

### 4.2 Post-MVP goals

- Selector self-healing with explicit approval and a saved selector history.
- Failure Detective with visual, hierarchy, timing, and network-context diagnosis.
- Accessibility Auditor that suggests and exports actionable findings.
- Edge-case generation for locale, text size, network state, empty state, retry, and rotation.
- Shared team test library and CI integration.
- Private model customization using approved local test history.
- Instrumentation/ADB execution backend for internal developer workflows.
- Multi-device cooperative exploration.

### 4.3 Non-goals for the hackathon

- General-purpose control of arbitrary installed applications.
- Executing payments, purchases, account mutations, permission decisions, messages, calls, or destructive operations.
- Fully autonomous test generation without human review.
- Publishing an AccessibilityService-based autonomous agent to Google Play.
- Replacing Maestro, Appium, Espresso, XCUITest, or other runners.
- iOS support.
- A production-grade cloud collaboration backend.
- Full CI fleet orchestration.
- Training or fine-tuning a large model during the event.
- Guaranteeing on-device generative AI support on every Android device.

## 5. Distribution and policy boundary

PocketQA has two explicitly separate execution modes.

### 5.1 Author and Replay mode

This is the core product mode. The user demonstrates a flow, reviews the generated script, approves it, and starts deterministic replay. The replay engine follows the approved static script and cannot add actions at runtime. This is the foundation for a policy-safe production path.

### 5.2 Explorer Lab mode

This is an opt-in internal, sideloaded hackathon capability. It lets an AI planner propose actions within a small budget and an allowlisted demo application. It is never enabled silently, never presented as a general device assistant, and must not be distributed through Google Play using an AccessibilityService execution backend.

Google Play policy currently prohibits non-accessibility tools from using the Accessibility API to autonomously initiate, plan, and execute actions. Therefore:

- the hackathon APK is treated as an internal/sideloaded developer build;
- autonomous exploration is compile-time gated behind `EXPLORER_LAB_ENABLED`;
- any Play-distributed build must remove Explorer Lab actions or use a separate policy-safe developer/instrumentation backend; and
- production positioning must include prominent disclosure and consent for any permitted AccessibilityService use.

This is a product constraint, not a footnote. The UI, telemetry, architecture, and roadmap must preserve the separation.

## 6. Target users and jobs to be done

### 6.1 Primary persona: mobile developer in a small team

**Context:** Ships React Native or native Android features, manually checks important paths, and does not have a dedicated automation engineer for every release.

**Job:** “When I finish or change a mobile flow, help me convert the behavior I just checked into a repeatable regression test before I lose context.”

**Success looks like:** A test is created in minutes, the developer understands every step, and the output can be committed to the repository.

### 6.2 Secondary persona: QA engineer

**Context:** Reproduces bugs, builds regression packs, and spends time gathering evidence and maintaining selectors.

**Job:** “When I reproduce a bug or validate a fix, capture enough structured evidence to turn that work into a reliable regression asset.”

**Success looks like:** The exact path, assertions, device context, screenshots, and failure reason are preserved in one artifact.

### 6.3 Secondary persona: product engineer or founder

**Context:** Understands desired behavior but may not know test syntax.

**Job:** “Let me express what must stay true and demonstrate it without learning a testing DSL.”

**Success looks like:** They can create a useful draft while an engineer retains final approval.

### 6.4 Future persona: accessibility-minded developer

**Job:** “While I test my app, flag missing labels, tiny targets, truncation, and large-text problems with direct evidence.”

## 7. Core terminology

| Term | Definition |
|---|---|
| Intent | A human statement of the behavior to verify. |
| Demonstration | A manually performed flow recorded by PocketQA. |
| UI state | A normalized snapshot of package, window, screenshot, accessibility tree, OCR, and timing. |
| Action | A normalized user interaction such as tap, type, back, or wait. |
| Assertion | A condition PocketQA expects to be true in a state. |
| Test draft | A schema-valid but not yet approved sequence of actions and assertions. |
| Approved test | A versioned, immutable test definition authorized for replay. |
| Replay | Deterministic execution of an approved test. |
| Evidence bundle | The local/exported record of states, actions, screenshots, logs, and results. |
| Mission | A bounded Explorer request containing a goal, package allowlist, budget, and policy. |
| Proposal | An AI-generated plan, selector, assertion, diagnosis, or test that has not been approved. |
| Hard stop | A policy condition that immediately blocks execution. |

## 8. Product scope and priority

### 8.1 Must ship: P0 trusted authoring loop

- Onboarding, consent, and readiness checks.
- Typed intent.
- Target app allowlist and demo app.
- Demonstration capture.
- Screenshot, accessibility tree, and event timeline.
- Deterministic action normalization.
- Local-first intent compiler with strict output schema.
- Test review and editing.
- Deterministic replay.
- Pass/fail evidence.
- Maestro YAML and ZIP export.
- Airplane-mode path.

### 8.2 Should ship: P1 agentic differentiators

- Sarvam-powered Indic/code-mixed voice intent when online.
- Device capability screen for Gemini Nano/ML Kit Prompt API.
- Explorer Lab with a three-action budget.
- Evidence-grounded Failure Detective summary.
- One selector repair proposal after an intentional label change.

### 8.3 Could ship: P2 polish

- Accessibility findings.
- Test history and local vocabulary memory.
- Visual diff heatmap.
- Theme/large-text/locale edge-case suggestions.
- OpenAI-assisted connected review of one difficult state.

### 8.4 Won’t ship during the event

- Multi-device orchestration.
- AppFunctions integration.
- OEM computer-control integration.
- Cloud workspace and team accounts.
- Model fine-tuning.
- Play Store release.

## 9. Information architecture

The mobile app contains seven primary surfaces.

1. **Home / Test Library** — recent tests, status, create action, device readiness.
2. **Intent** — goal, target app, input method, constraints, and capture start.
3. **Capture** — persistent session indicator, step count, pause, finish, and privacy state.
4. **Review** — proposed steps, assertions, selectors, confidence, evidence, and edit controls.
5. **Replay** — live deterministic progress, current action, budget, stop, and logs.
6. **Evidence** — result, timeline, screenshots, diff, failure reason, and export.
7. **Agent Lab / Mission Control** — opt-in Explorer goal, plan, hard stops, budget, and proposals.

Settings contains:

- capture and retention settings;
- local AI readiness;
- connected providers;
- redaction controls;
- developer mode;
- data deletion; and
- about, limitations, and policy disclosures.

## 10. End-to-end user journeys

### 10.1 Journey A: create a regression test from a demonstration

**Scenario:** Verify that a coupon remains applied after a retry in the PocketQA Demo Shop app.

1. The user opens PocketQA and taps **New test**.
2. PocketQA confirms that the accessibility capture service is enabled and the target app is allowlisted.
3. The user types: “Verify SAVE20 remains applied after the payment screen fails and I tap retry.”
4. The user selects **PocketQA Demo Shop**.
5. PocketQA displays what will be captured and confirms that data remains local.
6. The user taps **Start demonstration**.
7. PocketQA opens the demo app and shows a small recording indicator.
8. The user adds a product, opens the cart, enters `SAVE20`, continues, triggers a safe simulated failure, and taps retry.
9. The user returns to PocketQA or taps the finish control.
10. PocketQA compiles captured evidence into a test draft.
11. The review screen shows actions and proposed assertions, each linked to a state.
12. The user edits the test name, removes a weak assertion, and approves the draft.
13. The user taps **Replay locally**.
14. PocketQA resets the demo fixture, follows the approved script, and verifies assertions.
15. The evidence screen shows a pass, elapsed time, screenshots, and exported artifacts.
16. The user shares the Maestro YAML or evidence ZIP.

### 10.2 Journey B: diagnose a failed replay

1. A previously approved test is replayed after the demo app label changes from “Apply coupon” to “Use coupon.”
2. The selector resolver fails to find one exact label but identifies a single candidate with matching resource ID or semantics.
3. PocketQA stops the replay before acting.
4. The evidence screen shows the last passing state, current state, selector candidates, and a visual/text diff.
5. Failure Detective labels the failure as **probable selector drift**, not an app assertion failure.
6. PocketQA proposes a selector repair with supporting evidence.
7. The user accepts or rejects the repair.
8. Acceptance creates a new version of the test; the original remains unchanged.

### 10.3 Journey C: bounded exploration

1. The user opens Agent Lab and chooses the sample commerce fixture.
2. They enter: “Find a checkout state we forgot to test after applying a coupon.”
3. PocketQA shows a proposed plan: build the local state graph, vary one safe state, and compile a candidate assertion.
4. Mission Control shows:
   - package allowlist: demo app only;
   - action budget: 3;
   - time budget: 60 seconds;
   - allowed tools: observe, tap safe node, back, wait;
   - blocked categories: typing sensitive data, payment, account, permission, destructive action, external navigation.
5. The user approves the mission.
6. The Explorer observes the current state, chooses only from policy-approved candidate nodes, and acts through the deterministic executor.
7. A new empty-cart or retry state is found.
8. PocketQA stops and proposes a candidate test. It does not add it to the library automatically.
9. The user inspects and approves or discards the proposal.

### 10.4 Journey D: airplane mode

1. The user enables airplane mode.
2. PocketQA displays **Local mode** and marks Sarvam/OpenAI unavailable.
3. Typed intent, capture, deterministic compilation fallback, review, replay, and export remain available.
4. The evidence bundle records that no network was used.

## 11. Detailed functional requirements

Requirement levels:

- **MUST:** required for a credible hackathon MVP.
- **SHOULD:** implement after all MUST requirements pass end to end.
- **COULD:** stretch only.

### 11.1 Onboarding, disclosure, and readiness

#### FR-ONB-001 — Explain the product boundary — MUST

Before enabling capture, PocketQA must explain that it can inspect screen content in explicitly selected apps, record actions and screenshots during a session, and replay only an approved script.

**Acceptance criteria**

- Disclosure is shown inside the app, not only in system settings.
- User must actively consent.
- Disclosure links to local data controls.
- Consent version and timestamp are stored locally.

#### FR-ONB-002 — Accessibility service setup — MUST

PocketQA must detect whether its capture service is enabled and guide the user to the appropriate Android settings page.

**Acceptance criteria**

- Status changes are reflected when the user returns from Settings.
- Capture cannot start while the service is disabled.
- The screen explains why each requested capability is needed.

#### FR-ONB-003 — Device readiness — MUST

PocketQA must display readiness for screenshot capture, UI hierarchy access, local storage, microphone, on-device model, and optional providers.

**Acceptance criteria**

- Unsupported Gemini Nano/ML Kit Prompt capability does not block the MVP.
- Each failed check has a fallback or remediation message.

### 11.2 Test intent

#### FR-INT-001 — Typed intent — MUST

The user can enter a natural-language goal between 10 and 500 characters.

**Acceptance criteria**

- Empty or vague input is rejected with a specific prompt.
- Intent is editable until the test is approved.
- Intent is stored locally with the session.

#### FR-INT-002 — Voice intent — SHOULD

The user can dictate the goal. Online Sarvam transcription should support Indian English, Kannada, Hindi, and code-mixed speech. A platform speech-recognition fallback may be used for the demo if available.

**Acceptance criteria**

- The transcript is always shown for confirmation before capture.
- Voice never directly triggers an action.
- Provider, language, and connected/local status are visible.
- Failure falls back to typed input.

#### FR-INT-003 — Target and constraints — MUST

The user selects exactly one target package for the MVP and may add notes such as required fixture or network condition.

**Acceptance criteria**

- Only explicitly allowlisted packages appear.
- The selected package is included in the capture policy and exported test.
- Package changes during capture produce a hard stop, except returning to PocketQA.

### 11.3 Demonstration capture

#### FR-CAP-001 — Start, pause, finish, cancel — MUST

The user can control a capture session and always see whether recording is active.

**Acceptance criteria**

- Start creates a unique session ID and immutable start timestamp.
- Pause stops recording new steps without deleting captured data.
- Finish flushes pending events and opens compilation.
- Cancel requires confirmation and offers deletion.

#### FR-CAP-002 — Capture semantic boundaries — MUST

PocketQA captures a UI state after a meaningful action and once the UI event stream is stable.

**Required inputs**

- package and activity/window identity;
- screenshot;
- normalized accessibility tree;
- OCR text when hierarchy text is insufficient;
- action event and target node;
- monotonic timing; and
- screen dimensions, orientation, density, app version, and OS version.

**Acceptance criteria**

- At least one before-state and one after-state are associated with every normalized action.
- Duplicate event bursts are debounced.
- Missing screenshots or trees are recorded as explicit partial evidence, not silently ignored.

#### FR-CAP-003 — Normalize actions — MUST

Raw events must be normalized into one of: `tap`, `longPress`, `typeText`, `clearText`, `back`, `scroll`, `wait`, or `unknown`.

**Acceptance criteria**

- `unknown` actions are shown for human correction and cannot be approved unchanged.
- Password field values are never captured.
- Repeated text-change events collapse into one redacted input step.

#### FR-CAP-004 — Redaction — MUST

PocketQA must redact sensitive values from stored nodes, logs, model prompts, and exports.

**Minimum rules**

- password nodes become `<redacted:password>`;
- likely OTP, card, CVV, phone, email, token, and long numeric identifiers are masked;
- screenshots blur bounds belonging to sensitive nodes;
- user may mark any additional region or step sensitive before export.

#### FR-CAP-005 — Package isolation — MUST

Capture and replay only operate in the selected package and PocketQA itself.

**Acceptance criteria**

- System permission dialogs, notification shade, launcher, and external app transitions stop the session.
- No cross-app screenshot is persisted after a hard stop.

### 11.4 Test compilation

#### FR-COM-001 — Strict test draft — MUST

PocketQA transforms intent, actions, and state evidence into a `TestDraft` that passes the canonical JSON schema.

**Acceptance criteria**

- Invalid model output is rejected and retried once with validation feedback.
- A second failure uses deterministic compilation.
- No unvalidated content reaches replay.
- Every action references a captured state and selector evidence.

#### FR-COM-002 — Candidate assertions — MUST

PocketQA derives candidate assertions from observed state changes and the stated intent.

**Candidate sources**

- newly visible or removed text;
- enabled, checked, selected, or focused changes;
- stable totals or labels relevant to intent;
- successful navigation state;
- explicit user confirmation during review.

**Acceptance criteria**

- Each assertion shows its source state.
- At least one end-state assertion is required.
- Assertions based only on a model guess are labeled unsupported and cannot be approved.

#### FR-COM-003 — Selector ranking — MUST

PocketQA assigns the most stable available selector and up to two fallbacks.

**Ranking order**

1. explicit test ID or resource ID;
2. content description/accessibility label;
3. visible text plus role;
4. role plus stable ancestor/descendant relation;
5. normalized relative position within a stable container;
6. coordinates, review-only and brittle.

**Acceptance criteria**

- Ambiguous selectors show the candidate count.
- Coordinates cannot be approved for Explorer actions.
- A selector confidence reason is human-readable.

#### FR-COM-004 — Deterministic fallback compiler — MUST

When no supported local generative model is available, PocketQA must still build a draft from the recorded actions, best-ranked selectors, state diffs, and simple intent keyword matching.

**Acceptance criteria**

- The primary demo can complete on an unsupported on-device AI device.
- The UI names the active compiler: On-device AI, Deterministic Local, or Connected Assist.

### 11.5 Review and approval

#### FR-REV-001 — Step review — MUST

The review screen shows each action, selector, evidence thumbnail, wait condition, and confidence.

**User controls**

- edit label or value;
- choose a selector candidate;
- insert or remove a wait;
- reorder or delete a step;
- add, edit, or remove an assertion;
- inspect before and after evidence; and
- rename the test.

#### FR-REV-002 — Validation before approval — MUST

PocketQA validates that the draft has an allowlisted package, supported actions, resolvable selectors, bounded waits, no sensitive plaintext, and at least one assertion.

**Acceptance criteria**

- Approval is blocked with actionable errors.
- Warnings require an explicit acknowledgement.
- Approval creates version 1 and stores the exact schema hash.

#### FR-REV-003 — Versioning — SHOULD

Edits to an approved test create a new version. Previous versions remain available and read-only.

### 11.6 Deterministic replay

#### FR-RUN-001 — Replay approved script only — MUST

The executor may run only a schema-valid approved test version. It may not ask an AI model what to do next.

#### FR-RUN-002 — Resolve and verify before action — MUST

Before each action, the executor observes the current state, resolves the selector, checks the package, checks policy, and records the chosen node.

**Acceptance criteria**

- Zero matches fails with `TARGET_NOT_FOUND`.
- Multiple matches fail with `TARGET_AMBIGUOUS` unless a deterministic disambiguator is present.
- Disabled or obscured targets fail without a coordinate fallback.
- The executor waits for the event stream to settle after acting.

#### FR-RUN-003 — Stop control — MUST

A persistent stop control must terminate replay or exploration immediately.

#### FR-RUN-004 — Fixture reset — MUST for demo app

PocketQA can launch or deep-link the demo app into a known fixture before replay.

#### FR-RUN-005 — Assertion evaluation — MUST

Assertions are evaluated deterministically against the normalized accessibility tree and, when needed, OCR or image fingerprint.

### 11.7 Evidence and failure diagnosis

#### FR-EVD-001 — Evidence timeline — MUST

For each step, show action, target, elapsed time, before/after state, assertion result, and relevant logs.

#### FR-EVD-002 — Evidence bundle — MUST

PocketQA stores and exports:

- test definition and version;
- original intent;
- device, OS, app, and PocketQA versions;
- execution policy and offline/connected status;
- screenshots and redacted UI states;
- action and assertion results;
- structured failure code;
- optional AI diagnosis clearly marked as a proposal;
- generated Maestro YAML; and
- checksums for artifact integrity.

#### FR-EVD-003 — Failure Detective — SHOULD

PocketQA classifies a failure into one primary category:

- selector drift;
- assertion regression;
- navigation divergence;
- timeout/performance;
- target app crash;
- environment/fixture problem;
- permission or capture limitation; or
- unknown.

The diagnosis must cite evidence and must not change the test automatically.

#### FR-EVD-004 — Export — MUST

The user can export a `.yaml` test or a `.zip` evidence bundle through the Android Sharesheet or Storage Access Framework.

### 11.8 Explorer Lab

#### FR-EXP-001 — Explicit opt-in — MUST for Explorer demo

Explorer Lab is disabled by default and visibly labeled experimental/internal.

#### FR-EXP-002 — Mission definition — MUST

A mission contains goal, starting test/fixture, package allowlist, maximum actions, maximum duration, allowed tools, and hard stops.

#### FR-EXP-003 — Plan preview — MUST

The user sees the planner’s proposed objective and constraints before execution. The user approves the mission as a whole; the policy engine still checks every action.

#### FR-EXP-004 — Bounded tools — MUST

The hackathon Explorer may use only:

- `observe()`;
- `tapNode(nodeId)` on a policy-approved node;
- `back()` within the allowlisted app;
- `waitForIdle()`; and
- `stop(reason)`.

Typing, scrolling, gestures, external navigation, and permissions are excluded from the first Explorer demo unless added after all safety tests pass.

#### FR-EXP-005 — State graph — MUST

Explorer records states and transitions, avoids revisiting equivalent states, and stops on new state, exhausted budget, no safe action, hard stop, or user stop.

#### FR-EXP-006 — Proposal only — MUST

Explorer output is a candidate state, assertion, or test. It does not modify the approved test library without review.

### 11.9 Local AI and connected AI

#### FR-AI-001 — Capability router — MUST

PocketQA selects an inference path based on device capability and user preference:

1. supported on-device prompt engine;
2. deterministic local compiler;
3. optional connected provider when explicitly enabled.

#### FR-AI-002 — On-device structured generation — SHOULD

On supported devices, PocketQA uses Gemini Nano through ML Kit Prompt API for bounded structured tasks such as ranking assertions or explaining a state diff.

#### FR-AI-003 — Sarvam voice adapter — SHOULD

When online and enabled, PocketQA may send only microphone audio from the intent screen to Sarvam for transcription. No screenshots, UI trees, or evidence are included.

#### FR-AI-004 — OpenAI review adapter — COULD

When online and explicitly enabled, PocketQA may send a redacted, user-previewed screen image and compact state summary for difficult screen interpretation or failure explanation. The OpenAI model may return structured analysis or tool proposals but never directly invoke the device executor.

#### FR-AI-005 — Provenance — MUST

Every generated artifact records the engine and mode used: deterministic local, model name/version when available, Sarvam, or OpenAI. Connected inputs require a preview and consent.

## 12. Safety policy

### 12.1 Always-blocked categories

PocketQA must hard-stop before an action that could:

- initiate or confirm a payment, purchase, subscription, transfer, or order;
- create, delete, or materially change an account;
- accept permissions, terms, consent, or security prompts;
- send a message, email, post, call, or external communication;
- submit sensitive personal, financial, health, authentication, or identity data;
- delete data or perform an irreversible action;
- leave the allowlisted package;
- open system settings, notifications, another app, or a browser;
- interact with a password, OTP, PIN, card, CVV, biometric, or authentication field;
- install, uninstall, download executable content, or change device configuration; or
- use a node whose identity is ambiguous.

### 12.2 Safety decision order

Before every action:

1. Verify active package.
2. Verify execution mode and approved artifact.
3. Resolve exactly one target.
4. Classify target and surrounding screen for blocked categories.
5. Verify action is in the mode’s allowed tool set.
6. Verify action/time/state budget.
7. Record the policy decision.
8. Execute deterministically or stop.

### 12.3 Human control requirements

- Persistent visible stop control.
- No background mission start.
- No schedule or remote trigger.
- No action while the screen is locked.
- No automatic acceptance of selector repairs or new tests.
- User can delete all local data from Settings.

## 13. Privacy and data requirements

### 13.1 Data classes

| Data | Default location | Retention | Exported by default |
|---|---|---:|---|
| Intent text | App-private storage | Until test/session deletion | Yes |
| Voice audio | Memory/temporary file | Delete after transcription or cancel | No |
| Screenshot | App-private storage | 7 days for raw session; retained if attached to approved evidence | Redacted only |
| UI hierarchy | App-private database/files | Same as session | Redacted only |
| Test definition | App-private database | Until deletion | Yes |
| Execution logs | App-private database | 30 days or user setting | Yes, redacted |
| Provider credentials | Android Keystore-backed storage | Until removed | Never |
| Connected request preview | Not persisted by default | Operation only | No |

### 13.2 Privacy requirements

- Network access is off for core operations.
- A connected provider toggle applies to one operation or session and is never silently persistent.
- Raw screenshots and trees are never sent to Sarvam.
- Cloud image review requires a redacted preview and user confirmation.
- API keys are never logged, exported, or embedded in source control.
- Exports must contain a manifest that states whether any cloud provider was used.
- The user can inspect and delete individual sessions and all data.

## 14. Offline requirements

The following must work with airplane mode enabled after installation and readiness setup:

- typed intent;
- target selection;
- capture;
- screenshot and tree processing;
- bundled OCR for the demo scripts;
- deterministic compilation;
- review and approval;
- deterministic replay;
- evidence display; and
- local export.

On-device Prompt API availability may depend on device support and a model download completed before airplane mode. PocketQA must therefore never make it a prerequisite for the primary demo.

## 15. UX requirements

### 15.1 Visual language

- Dark, high-contrast interface consistent with the submitted prototype.
- Lime accent indicates approved/ready/local execution.
- Cyan indicates information or captured evidence.
- Amber indicates review required or degraded fallback.
- Red indicates a hard stop or failed assertion.
- Agent-generated content is always labeled **Proposed by AI**.

### 15.2 Capture UX

- An unobtrusive overlay or notification shows `Recording`, step count, pause, and finish.
- The overlay must not cover common bottom navigation or the target control.
- On Android API 34+, prefer capturing the target window without the overlay when available.
- If the overlay is present in a screenshot, crop or mask it before inference/export.

### 15.3 Review UX

- Default view is a concise ordered list.
- Tapping a step expands selectors and evidence.
- Weak or ambiguous steps are expanded automatically.
- The user should understand why a selector or assertion was chosen without reading raw JSON.

### 15.4 Accessibility

- PocketQA itself must work with TalkBack.
- Minimum touch target is 48 dp.
- Status is communicated with text/icons, not color alone.
- Dynamic type/large text must not hide the stop control.
- All evidence images have generated descriptive labels.

## 16. Demo application and canonical scenario

The hackathon repository must include a separate deterministic target app: **PocketQA Demo Shop**.

### 16.1 Required demo states

- Product list.
- Product detail.
- Cart with one item.
- Coupon input.
- Coupon applied with discount summary.
- Simulated checkout/payment step containing no real payment capability.
- Simulated network failure.
- Retry success with coupon preserved.
- Optional intentional selector-drift build variant.

### 16.2 Fixture controls

The demo app must support debug-only deep links or broadcast commands to reset fixtures:

- `demo-shop://fixture/reset`
- `demo-shop://fixture/coupon-retry`
- `demo-shop://fixture/selector-drift`

The app must not access real commerce, payment, account, or personal data.

### 16.3 Canonical test

**Intent:** “Verify SAVE20 remains applied after checkout fails and I retry.”

**Expected steps:**

1. Launch/reset demo app.
2. Open first product.
3. Add to cart.
4. Open cart.
5. Enter `SAVE20`.
6. Tap `Apply coupon`.
7. Assert discount and code are visible.
8. Continue to simulated checkout.
9. Trigger/observe simulated failure.
10. Tap `Retry`.
11. Assert coupon remains visible and total remains discounted.

### 16.4 Agentic demo

From the coupon-applied cart, ask Explorer to find one nearby untested state. A safe example is opening `Coupon details` or removing focus/returning to cart, not deleting the cart or initiating checkout. The mission must stop after discovering and recording the new state.

## 17. Success metrics

### 17.1 Hackathon demo gates

| Metric | Target |
|---|---:|
| Primary flow completion | 3 consecutive end-to-end runs |
| Time from intent to reviewable draft | Under 3 minutes including demonstration |
| Compile time after capture | Under 8 seconds on the demo device in deterministic mode; under 20 seconds with on-device model |
| Deterministic replay success on unchanged demo fixture | At least 19 of 20 runs |
| Unsupported/unsafe actions executed | 0 |
| Ambiguous selector actions executed | 0 |
| Airplane-mode core flow | 1 complete recorded run |
| Export validity | Generated YAML parses and runs in Maestro against the demo fixture |
| Explorer action budget | Never exceeded |

### 17.2 Product metrics for a pilot

- Median time to create first approved test.
- Draft approval rate.
- Percentage of proposed steps edited before approval.
- Replay pass rate on unchanged builds.
- Failure diagnosis agreement with engineer label.
- Selector repair acceptance rate.
- Percentage of sessions completed fully offline.
- Hard-stop count by category.
- Evidence export rate.
- Weekly retained test authors.

No analytics leave the device in the hackathon build. Metrics are visible in local developer diagnostics or exported with explicit consent.

## 18. Acceptance test matrix

### AT-01 — Offline authoring happy path

**Given** airplane mode is on, the capture service is enabled, and the demo app is reset  
**When** the user types an intent and demonstrates the canonical flow  
**Then** PocketQA produces a schema-valid editable draft without a network call.

### AT-02 — Approved replay

**Given** an approved canonical test  
**When** the user starts replay  
**Then** each action resolves exactly one node, all assertions pass, and an evidence bundle is stored.

### AT-03 — Ambiguous selector

**Given** two matching visible nodes and no deterministic disambiguator  
**When** replay resolves the step  
**Then** it stops with `TARGET_AMBIGUOUS` before tapping either node.

### AT-04 — Cross-package navigation

**Given** replay or Explorer is active  
**When** the active package becomes a browser, system UI, or other app  
**Then** PocketQA stops immediately and records `PACKAGE_BOUNDARY_VIOLATION`.

### AT-05 — Sensitive field

**Given** the current state contains a password/OTP/payment field  
**When** a proposed action targets it  
**Then** policy rejects the action, its value is never stored, and the screenshot is redacted.

### AT-06 — Invalid model output

**Given** the inference engine returns malformed or schema-invalid output twice  
**When** compilation continues  
**Then** PocketQA activates deterministic compilation and informs the user.

### AT-07 — Selector drift

**Given** the label changes but a stable resource ID remains  
**When** replay runs  
**Then** deterministic selector fallback may resolve it and records which fallback was used.

### AT-08 — Unapproved self-heal

**Given** no approved selector resolves and a probable replacement exists  
**When** replay reaches the step  
**Then** PocketQA stops and proposes a repair; it does not tap the replacement.

### AT-09 — Explorer budget

**Given** an Explorer mission allows three actions or 60 seconds  
**When** either limit is reached  
**Then** the mission stops before a fourth action or after the time limit.

### AT-10 — User stop

**Given** any replay or mission is running  
**When** the user taps Stop  
**Then** no further action is dispatched and the partial trace is saved.

### AT-11 — Valid export

**Given** an approved test  
**When** the user exports Maestro YAML  
**Then** the YAML has the correct app ID, supported commands, escaped input, and assertions and passes a local syntax check.

### AT-12 — Data deletion

**Given** saved sessions and evidence exist  
**When** the user deletes one session or all data  
**Then** database rows, screenshots, audio, and derived artifacts are removed from app-private storage.

## 19. Build plan and venue cutline

The build is organized into gates. A gate is complete only when its acceptance test runs on the physical demo device.

### Gate 0 — Freeze the demo contract

- Confirm iQOO device, Android version, and Gemini Nano/ML Kit support.
- Freeze canonical flow and package IDs.
- Build/reset Demo Shop fixture.
- Record a manual fallback video.

### Gate 1 — Trusted capture

- Onboarding and service enablement.
- Package allowlist.
- Screenshot and normalized UI tree.
- Action/event recording.
- Local session persistence.
- Redaction.

**Exit:** A manual flow yields a readable, ordered capture trace.

### Gate 2 — Compile and review

- Deterministic compiler.
- Optional on-device AI ranking.
- Test schema validation.
- Review UI.
- Approval/versioning.

**Exit:** The canonical demonstration produces a correct approved test.

### Gate 3 — Replay and evidence

- Deterministic node resolver and executor.
- Assertions and waits.
- Stop control.
- Evidence timeline and ZIP.
- Maestro YAML export and syntax/run validation.

**Exit:** Three consecutive successful replays, including one in airplane mode.

### Gate 4 — One agentic moment

- Mission definition and policy.
- Small state graph.
- Three-action Explorer.
- Candidate test/assertion proposal.

**Exit:** One repeatable bounded mission that stops correctly.

### Gate 5 — Optional polish

- Voice intent.
- Failure Detective.
- Selector repair demo.
- Accessibility insight.

### Recommended team lanes

| Lane | Primary responsibility |
|---|---|
| Mobile UI | React Native screens, state, review/evidence UX, demo choreography |
| Android systems | Accessibility capture, screenshots, node actions, native bridge |
| AI/domain | schemas, compiler, inference routing, prompts, policy, Explorer |
| Demo/quality | Demo Shop, fixtures, Maestro validation, test matrix, pitch/video |

If the team is smaller, merge Mobile UI with Demo/quality and Android systems with AI/domain.

## 20. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Demo device does not support ML Kit Prompt API | Medium | Medium | Deterministic local compiler is the required path; show capability routing honestly. |
| Accessibility tree is sparse in some RN/custom views | Medium | High | Use bundled OCR and screenshot evidence; make Demo Shop accessibility-first with test IDs. |
| Event stream produces noisy duplicate actions | High | High | Debounce by time/node/event and capture only after semantic stability. |
| Overlay contaminates screenshots | Medium | Medium | Use window screenshot on API 34+ or hide/mask overlay during capture. |
| AI emits invalid JSON | Medium | Medium | Validate, retry once, then deterministic fallback. |
| Selector matches wrong node | Medium | High | Require exactly one match, verify role/bounds/state, fail closed. |
| Explorer violates a boundary | Low if tested | Critical | Static policy prefilter, action allowlist, package checks, tiny budget, persistent stop. |
| AccessibilityService policy blocks production distribution | High | High | Separate Lab from Author/Replay; use internal/sideload build or instrumentation backend. |
| API key exposure in mobile APK | High if embedded | High | Runtime developer credentials for event only; production proxy and short-lived tokens. |
| Venue network is poor | High | Medium | Primary flow is offline; preload models and dependencies; carry APK and fixtures. |
| Demo fixture state is inconsistent | Medium | High | Debug reset deep link and pre-demo readiness checklist. |
| Scope expands into many agents | High | High | Gates enforce one stable loop before extras. |

## 21. Demo readiness checklist

- Physical iQOO device fully charged and USB debugging available.
- PocketQA and Demo Shop APKs installed.
- Capture service enabled and permissions verified.
- Demo Shop fixture reset succeeds three times.
- Local model capability known; any required model downloaded.
- Deterministic fallback tested.
- Airplane-mode authoring and replay tested.
- Sarvam/OpenAI optional credentials tested and removable.
- Canonical test exported and run once with Maestro.
- Explorer mission tested with every hard-stop case.
- All screenshots free of private notifications and real data.
- Backup APKs, exported test, evidence ZIP, deck, PDF, and video stored offline.

## 22. Definition of done

The PocketQA hackathon MVP is done when:

1. The canonical intent can be typed and demonstrated on the physical device.
2. At least four meaningful UI states and all relevant user actions are captured locally.
3. Compilation produces a schema-valid draft through both the preferred and fallback paths.
4. A user can understand, edit, and approve the draft.
5. Approved replay passes three consecutive times on the unchanged fixture.
6. A deliberately broken fixture creates an evidence-grounded failure, not an unsafe recovery.
7. Maestro YAML runs successfully against the demo app.
8. Airplane mode does not break the core loop.
9. Explorer completes one bounded mission and cannot exceed package, action, time, or safety limits.
10. No sensitive values appear in logs or exports.
11. A teammate who did not implement the feature can execute the demo from the checklist.

## 23. Assumptions and decisions to confirm on build day

These do not block implementation; they should be verified during Gate 0.

- The primary device runs Android API 30 or later, which allows AccessibilityService screenshot capture.
- The hackathon permits sideloaded APKs and does not require Google Play distribution.
- The canonical target is a team-owned demo application, not a third-party production app.
- React Native remains the preferred UI shell and native Kotlin is acceptable for Android system capabilities.
- Voice is an enhancement; typed intent is the guaranteed fallback.
- Explorer is demonstrated only in the internal Lab build.
- No real account, payment, or private user data is used in the demo.

## 24. Product source-of-truth references

The technical implementation should be rechecked against current official documentation before dependency upgrades or distribution:

- [Android AI/ML solution guide](https://developer.android.com/ai/overview)
- [ML Kit Prompt API for Android](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [Android AccessibilityService API](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [Create an Android accessibility service](https://developer.android.com/guide/topics/ui/accessibility/service)
- [Google Play AccessibilityService policy](https://support.google.com/googleplay/android-developer/answer/10964491)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [Sarvam streaming speech-to-text API](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/ws)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Maestro flow overview](https://docs.maestro.dev/maestro-flows)
- [Maestro selectors](https://docs.maestro.dev/api-reference/selectors)

---

## Appendix A — Requirement traceability summary

| Product promise | Requirements | Acceptance tests |
|---|---|---|
| Say what must be true | FR-INT-001–003 | AT-01 |
| Show the flow once | FR-CAP-001–005 | AT-01, AT-05 |
| Compile locally | FR-COM-001–004, FR-AI-001 | AT-01, AT-06 |
| Review before action | FR-REV-001–003 | AT-02, AT-08 |
| Replay deterministically | FR-RUN-001–005 | AT-02–05, AT-10 |
| Produce useful evidence | FR-EVD-001–004 | AT-07, AT-11 |
| Explore safely | FR-EXP-001–006 | AT-04, AT-05, AT-09, AT-10 |
| Work offline | Section 14 | AT-01, AT-02 |

## Appendix B — Product copy for critical states

### Capture disclosure

“During a session, PocketQA can inspect and record screen content, interface labels, and your actions inside the app you select. Captures stay on this device unless you explicitly export them or enable a connected analysis provider. Passwords and likely sensitive fields are redacted. You can stop at any time.”

### Explorer Lab disclosure

“Explorer Lab is an experimental developer feature for allowlisted test apps. It may propose and execute a small number of safe UI actions within the mission you approve. Payments, accounts, permissions, destructive actions, sensitive fields, system UI, and other apps are always blocked. Keep the Stop control visible.”

### Connected analysis confirmation

“This operation will send the redacted preview shown below to the selected provider. The provider will analyze it but cannot control your device. Continue once, or cancel and use local analysis.”

### Hard stop

“PocketQA stopped before acting because this screen or control is outside the approved safety boundary. No blocked action was executed.”
