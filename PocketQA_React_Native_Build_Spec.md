# PocketQA React Native App — Technical Build Spec (v1)

Internal engineering specification for the React Native product application. This is the implementation companion to the [PocketQA PRD](PocketQA_PRD.md) and the broader [PocketQA Technical Specification](PocketQA_Technical_Spec.md).

This document narrows those sources into the screens, TypeScript structure, native bridge, client state, UI system, testing strategy, and delivery plan needed to build the Android hackathon application.

**Status:** Build-ready v1.0  
**Product:** PocketQA  
**Team:** Tech Phantoms  
**Primary platform:** Android 11+  
**Last updated:** 29 August 2026

---

## 1. Scope and constraints

- **Primary target:** Android 11+ (`minSdk 30`) on the supplied iQOO device.
- **Distribution:** internal/sideloaded APK for the hackathon; no Play Store submission in v1.
- **Framework:** React Native Community CLI, TypeScript strict mode, Hermes, New Architecture enabled.
- **Native platform:** Kotlin owns AccessibilityService capture, screenshot access, UI-tree normalization, Room persistence, deterministic execution, policy enforcement, redaction, AI capability routing, and artifact generation.
- **React Native:** owns product UI, navigation, user intent, review/editing, approval, progress displays, evidence browsing, settings, consent, and export initiation.
- **Demo target:** a separate Android app, PocketQA Demo Shop, package `com.techphantoms.pocketqa.demoshop`.
- **Data posture:** local-first; no account or backend is required for the core flow.
- **Connectivity:** typed intent, capture, deterministic compilation, review, replay, evidence, and export must work in airplane mode.
- **AI rule:** AI may observe, propose, rank, name, and explain. It never dispatches Android actions or bypasses schema validation, policy, or human approval.
- **Secrets:** Sarvam/OpenAI credentials are optional developer settings stored through a Keystore-backed native vault, never in the JS bundle or repository.
- **Office Kit:** an external hackathon workflow bridge for mirroring, input, clipboard, APK/evidence transfer, and demo presentation. It is not an app SDK or runtime dependency.

### 1.1 Hackathon cutline

The build order is strict:

1. Typed intent.
2. One complete demonstration capture.
3. Deterministic test compilation.
4. Review and explicit approval.
5. Deterministic replay.
6. Evidence timeline and Maestro export.
7. One bounded Explorer mission.
8. Voice and connected AI only after the above is repeatable.

Do not spend hackathon time on authentication, cloud sync, iOS, generalized third-party app support, CI dashboards, collaborative editing, or a production AccessibilityService distribution strategy.

---

## 2. Product flow

```text
Home / Test Library
        ↓ New test
Intent + target app + constraints
        ↓ readiness preflight
Demonstrate once in Demo Shop
        ↓ native capture
Compile locally into strict TestDraft
        ↓
Review steps, selectors, assertions, and evidence
        ↓ explicit approval
Deterministic replay on Demo Shop
        ↓
Pass/fail evidence timeline
        ↓
Share Maestro YAML or evidence ZIP through Android Sharesheet / Office Kit
```

Optional agentic path:

```text
Agent Lab goal
    ↓ plan and mission limits
Human approval
    ↓
Observe → safe candidate filter → AI/rules rank → policy check → deterministic action
    ↓
Stop on new state, budget, hard stop, no safe action, or user stop
    ↓
Reviewable proposal only
```

The canonical demo intent is:

> Verify SAVE20 remains applied after checkout fails and I retry.

---

## 3. Technology stack

Versions are pinned in `package.json`, Gradle version catalogs, and lockfiles during Gate 0. This document deliberately does not override those files with floating version numbers.

| Layer | Choice | Purpose |
|---|---|---|
| Framework | React Native Community CLI, New Architecture, Hermes | Required native Android control without Expo constraints |
| Language | TypeScript with `strict: true` | Typed screens, navigation, bridge façades, stores, and domain editing |
| Native language | Kotlin + coroutines/Flow | Privileged capture/execution and durable background work |
| Navigation | React Navigation native stack | Typed, platform-native screen transitions |
| Client state | Zustand | Small operation, readiness, editor, and settings stores |
| Forms | React Hook Form + Zod | Intent/settings forms and immediate validation |
| Native persistence | Room + app-private files | Authoritative sessions, drafts, runs, evidence, and artifacts |
| JS preferences | AsyncStorage | Non-sensitive UI preferences only |
| Animations | React Native Reanimated | Progress, state transitions, and reduced-motion-aware feedback |
| Gestures | React Native Gesture Handler | Review cards and controlled sheets; no gesture-only critical action |
| Icons | Lucide React Native | Consistent semantic icon set |
| SVG | `react-native-svg` | State graph, compact diagrams, and empty-state illustration |
| Schema validation | Zod/Ajv in TypeScript; `kotlinx.serialization` + validators in Kotlin | Same canonical contract on both sides |
| Unit/component tests | Jest + React Native Testing Library | Stores, formatters, components, and screen behavior |
| Native tests | JUnit/Robolectric/instrumentation | Bridge, persistence, policy, capture, and execution |
| End-to-end | Maestro | Demo Shop and exported flow verification |

### 3.1 Dependency rule

- Prefer a small dependency surface during the event.
- Every native dependency must build under the selected React Native New Architecture before feature work depends on it.
- Do not add a general-purpose UI kit. PocketQA uses a small local component system so the prototype visual language remains consistent.
- Do not store domain records in AsyncStorage. Room is the source of truth.
- Do not make optional providers a transitive requirement of app startup.

---

## 4. Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│ React Native                                                     │
│                                                                  │
│ Screens → feature hooks → domain services → PocketQaNative facade│
│    │             │                │                  │            │
│ Components     Zustand       Zod validation      TurboModule     │
└───────────────────────────────────┬──────────────────────────────┘
                                    │ commands + coarse events
┌───────────────────────────────────▼──────────────────────────────┐
│ Kotlin Android core                                              │
│                                                                  │
│ AccessibilityService → CaptureCoordinator → Room/evidence files  │
│         │                    │                    │                │
│         ├→ Redaction/OCR     ├→ Compiler/AI       ├→ Export       │
│         └→ Executor ← PolicyEngine ← ExplorerAgent                │
└───────────────────────────────────┬──────────────────────────────┘
                                    │ allowlisted interaction
                         PocketQA Demo Shop
```

### 4.1 Ownership boundary

React Native may:

- collect and validate user input;
- issue high-level commands such as `startCapture`, `approveDraft`, and `startReplay`;
- display serialized, already-redacted records;
- edit a draft through an explicit save API;
- show operation events and recover from missed events by reloading authoritative state; and
- initiate Android settings, sharesheet, or document-picker flows through native commands.

React Native must not:

- retain or operate on `AccessibilityNodeInfo` instances;
- synthesize taps, gestures, key events, or coordinates;
- decide whether an Explorer action is safe;
- persist unredacted screenshots or UI text;
- directly call a model and then execute its answer;
- treat an event stream as authoritative persistence; or
- contain provider secrets in JS memory longer than the settings submission call.

### 4.2 Source-of-truth rule

- Room/native repositories own sessions, drafts, approved tests, missions, runs, evidence, and artifact URIs.
- Zustand owns only view state, unsaved editor state, current IDs, progress summaries, and non-sensitive preferences.
- Every screen that can be reopened accepts an entity ID and reloads authoritative native data.
- Coarse bridge events make the UI responsive but never replace a repository read.

---

## 5. Repository layout

```text
pocketqa/
├── apps/
│   ├── pocketqa-mobile/
│   │   ├── android/
│   │   │   └── app/src/main/java/com/techphantoms/pocketqa/
│   │   │       ├── bridge/
│   │   │       ├── capture/
│   │   │       ├── compiler/
│   │   │       ├── execution/
│   │   │       ├── explorer/
│   │   │       ├── inference/
│   │   │       ├── policy/
│   │   │       ├── storage/
│   │   │       └── export/
│   │   ├── src/
│   │   │   ├── app/                 # App root and providers
│   │   │   ├── navigation/          # Navigators, route types, links
│   │   │   ├── components/          # Shared design-system components
│   │   │   ├── features/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── home/
│   │   │   │   ├── intent/
│   │   │   │   ├── capture/
│   │   │   │   ├── review/
│   │   │   │   ├── replay/
│   │   │   │   ├── evidence/
│   │   │   │   ├── explorer/
│   │   │   │   └── settings/
│   │   │   ├── native/              # Typed bridge spec/facade/events
│   │   │   ├── domain/              # Shared TS domain types and schemas
│   │   │   ├── services/            # App-level orchestration facades
│   │   │   ├── store/               # Zustand stores
│   │   │   ├── theme/               # Tokens, typography, shadows
│   │   │   ├── utils/               # Pure formatters/helpers
│   │   │   └── test/                # Fixtures and test render helpers
│   │   └── package.json
│   └── demo-shop/                    # Separate deterministic Android app
├── packages/
│   ├── schemas/                      # Canonical JSON schemas
│   ├── shared-types/
│   ├── maestro-exporter/
│   ├── ai-fixtures/
│   └── policy-fixtures/
├── services/ai-lab/                  # Prompt/eval lab; not mobile runtime
├── scripts/
└── .github/workflows/
```

### 5.1 Feature-folder convention

Each React Native feature owns its screen, hook, local components, mapping functions, and tests:

```text
features/review/
├── ReviewTestScreen.tsx
├── components/
│   ├── ReviewStepCard.tsx
│   ├── AssertionEditor.tsx
│   └── SelectorCandidateSheet.tsx
├── hooks/
│   ├── useDraft.ts
│   └── useDraftValidation.ts
├── mappers.ts
├── review.types.ts
└── __tests__/
```

Features may import from `components`, `domain`, `native`, `services`, `store`, `theme`, and `utils`. A feature must not import another feature's internal components or store files.

---

## 6. Navigation

Use one native stack at the root. Bottom tabs are unnecessary for the MVP because capture/review/replay form a directed workflow and a persistent tab bar competes with the Stop control.

```text
RootNavigator
├── StartupGate
├── OnboardingStack
│   ├── Welcome
│   ├── Disclosure
│   └── Readiness
└── MainStack
    ├── Home
    ├── Intent
    ├── CaptureReady
    ├── CaptureStatus
    ├── CompileProgress
    ├── ReviewTest
    ├── SelectorCandidates        # sheet/modal
    ├── EvidenceDetail            # sheet/modal
    ├── ReplayMissionControl
    ├── Evidence
    ├── AgentLab
    ├── MissionReview
    ├── ExplorerMissionControl
    ├── Settings
    ├── ProviderSettings
    ├── DataAndPrivacy
    └── AboutAndLimits
```

### 6.1 Route contract

```ts
export type RootStackParamList = {
  StartupGate: undefined;
  Welcome: undefined;
  Disclosure: undefined;
  Readiness: { returnTo?: 'Intent' | 'Settings' } | undefined;
  Home: undefined;
  Intent: { duplicateFromTestId?: string } | undefined;
  CaptureReady: { intentId: string };
  CaptureStatus: { sessionId: string };
  CompileProgress: { compileJobId: string };
  ReviewTest: { draftId: string };
  SelectorCandidates: { draftId: string; stepId: string };
  EvidenceDetail: { stateId: string };
  ReplayMissionControl: { testId: string; version: number };
  Evidence: { runId: string };
  AgentLab: undefined;
  MissionReview: { missionId: string };
  ExplorerMissionControl: { missionId: string };
  Settings: undefined;
  ProviderSettings: undefined;
  DataAndPrivacy: undefined;
  AboutAndLimits: undefined;
};
```

### 6.2 Navigation rules

- Startup checks onboarding completion and any persisted active operation.
- If an active capture/replay/mission exists, offer **Resume** or **Stop**, not a fresh operation.
- Android back is intercepted during capture/replay/mission and requires explicit confirmation or remains within the target app flow.
- Review may return to Home only after warning about unsaved edits.
- A completed replay replaces Mission Control with Evidence to prevent accidental double execution.
- Deep links are accepted only for internal debug fixture reset and never bypass approval.

---

## 7. Screen and feature specifications

### 7.1 Startup Gate

Purpose: restore the correct UI after app launch, React Native reload, or process recreation.

- Reads consent state, service readiness, and active-operation summary in parallel.
- Shows branded launch surface for no more than necessary.
- Routes to onboarding, Home, or operation recovery.
- If native state cannot be loaded, show a retry action and safe diagnostic code.

### 7.2 Welcome and Disclosure

Purpose: clearly describe what PocketQA can inspect and where it can act.

- Explain intent → demonstration → review → deterministic replay.
- State that selected-app screen content, actions, UI hierarchy, and screenshots are captured locally during a session.
- Display package isolation and hard-stop boundaries.
- Link to data deletion and limitations.
- Require an unchecked consent control plus **Continue**.
- Persist consent version and UTC timestamp natively.

### 7.3 Device Readiness

Show independent cards for:

- Accessibility service;
- screenshot capability;
- UI hierarchy access;
- local storage;
- microphone permission;
- on-device prompt engine;
- Demo Shop installed/allowlisted;
- optional Sarvam/OpenAI configuration; and
- network/offline status.

Each card contains `Ready`, `Needs action`, `Optional unavailable`, or `Unsupported`, an explanation, and one remediation action. Unsupported on-device generative AI must not block the core flow.

Primary actions:

- **Open Accessibility Settings**
- **Recheck**
- **Continue in deterministic local mode**

### 7.4 Home / Test Library

Purpose: give the developer an immediate path to create, replay, inspect, or export a test.

Content:

- prominent **New test** button;
- Local/Connected mode indicator;
- compact readiness warning if capture is unavailable;
- recent approved tests with last run status and version;
- unfinished draft/capture recovery card;
- entry to Agent Lab, visibly experimental;
- Settings action.

Empty state copy: “Show PocketQA one flow and turn it into a regression test.”

Test row actions:

- Replay locally;
- Review details;
- View latest evidence;
- Export YAML;
- Duplicate as new draft; and
- Delete with confirmation.

### 7.5 Intent

Fields:

- test goal, 10–500 characters;
- text/voice input toggle;
- target application, exactly one allowlisted package;
- optional fixture/environment note;
- optional preconditions;
- explicit capture disclosure acknowledgement.

Behavior:

- Validate locally before the native preflight call.
- Voice returns a transcript to the text field and never starts capture automatically.
- Show transcription provider, language, and local/connected status.
- A connected provider failure preserves audio/transcript state where safe and falls back to typing.
- **Continue** invokes preflight; it does not start capture directly.

### 7.6 Capture Ready

Purpose: eliminate surprises before switching to the target app.

Display:

- target app and package;
- selected goal;
- what will be captured;
- privacy/redaction status;
- service and Demo Shop readiness;
- fixture reset option; and
- hard-stop rules.

Primary action: **Start demonstration**.

On success, native code creates the session and launches Demo Shop. React Native backgrounds naturally. A native overlay or persistent notification provides recording state, step count, Pause, Finish, and Stop.

### 7.7 Capture Status

This screen appears when the user returns to PocketQA during an active or paused capture.

- Show `Recording`, `Paused`, `Finalizing`, or `Hard stopped` with icon and text.
- Show semantic step count, elapsed time, target app, last captured action, and partial-evidence warnings.
- Actions: Pause/Resume, return to target app, Finish, Cancel and delete.
- Finish disables repeated taps and routes to compilation only after native persistence is flushed.
- Hard stop shows the safe reason, confirms that out-of-scope content was not retained, and offers evidence review or deletion.

### 7.8 Compile Progress

Stages:

1. Finalizing evidence.
2. Redacting sensitive content.
3. Building selectors.
4. Deriving assertions.
5. Enhancing locally when supported.
6. Validating draft.

Requirements:

- Display active engine: `Deterministic Local`, `On-device AI`, or `Connected Assist`.
- Never present an indeterminate spinner without a stage label.
- On-device inference has a visible cancel/fallback action after the soft timeout.
- Invalid AI output is not shown as a draft; native code retries once, then falls back deterministically.
- The screen is resumable by session ID.

### 7.9 Review Test

Header:

- editable test name;
- target app;
- draft/version status;
- validation summary;
- engine/provenance label.

Default body is an ordered list of `ReviewStepCard`s. Each card shows:

- step number and plain-English action;
- target label/role;
- primary selector kind and confidence reason;
- before/after evidence thumbnail;
- wait condition;
- assertions associated with the resulting state;
- warning or error state; and
- **Proposed by AI** label when applicable.

Expanded controls:

- edit non-sensitive input value;
- choose from grounded selector candidates;
- insert/change bounded wait;
- remove or reorder a step;
- add/edit/remove grounded assertions;
- inspect redaction/evidence; and
- mark additional evidence sensitive.

Approval behavior:

- Client validation is advisory and immediate.
- Native validation is authoritative.
- Errors block approval and focus the first invalid card.
- Warnings require explicit acknowledgement.
- Approval reloads the persisted draft, validates again, freezes an immutable version, records schema hash, and routes to replay readiness.

### 7.10 Replay Mission Control

Always visible:

- approved test name/version;
- target package;
- current step/total;
- current action and selector;
- elapsed time;
- active engine label (`Deterministic execution`);
- latest assertion result;
- compact event log; and
- a persistent red **Stop** control.

Replay sequence:

- native preflight;
- reset/launch fixture;
- observe fresh state;
- resolve exactly one target;
- policy check;
- deterministic action;
- wait for idle;
- deterministic assertion evaluation;
- evidence persistence;
- next step or terminal result.

The UI never displays “AI is controlling your phone” during approved replay because no AI chooses actions in this mode.

### 7.11 Evidence

Summary card:

- `Passed`, `Failed`, `Stopped`, or `Hard stopped`;
- elapsed time and steps completed;
- device, OS, app and PocketQA versions;
- local/connected status and `networkUsed`;
- compiler/inference provenance; and
- structured failure category when present.

Timeline row:

- action and target;
- before/after thumbnails;
- duration;
- assertion result;
- selector resolution;
- warning/error code; and
- expandable redacted logs.

Actions:

- Share Maestro YAML;
- Share evidence ZIP;
- Copy redacted diagnostics;
- replay again;
- inspect failure proposal; and
- delete run.

Failure Detective is clearly labeled as analysis, cites specific evidence IDs, and never edits the approved test automatically.

### 7.12 Agent Lab

Agent Lab is disabled by default and labeled `Experimental · internal build`.

Mission form:

- goal;
- starting fixture/test;
- allowlisted package;
- maximum actions, default 3;
- maximum duration, default 60 seconds;
- permitted tools;
- hard-stop categories; and
- selected ranking engine.

The first build permits only `observe`, `tapNode` on a prefiltered safe node, `back`, `waitForIdle`, and `stop`.

### 7.13 Mission Review

- Present objective, start state, budget, tools, package boundary, blocked categories, and planner provenance.
- State explicitly that the model ranks only policy-filtered candidates.
- Require explicit whole-mission approval.
- Hash and persist the approved mission policy before execution.

### 7.14 Explorer Mission Control

Always visible:

- approved goal;
- package;
- action budget used/maximum;
- time remaining;
- state count;
- latest observation;
- ranked proposal and reason;
- policy decision;
- engine/provenance;
- hard-stop categories; and
- persistent Stop button.

On completion, show one newly discovered state or candidate assertion/test for review. Never auto-save it into the Test Library.

### 7.15 Settings

Sections:

- Capture and evidence retention;
- Device and AI readiness;
- Connected providers;
- Redaction and privacy;
- Developer mode;
- Data deletion;
- About, policy boundaries, and limitations.

Provider credentials are submitted directly to a native encrypted vault. After saving, JavaScript receives only provider status and a masked identifier such as `••••7F2A`.

---

## 8. Shared component system

Build these primitives before feature screens:

| Component | Responsibility |
|---|---|
| `AppScreen` | Safe area, background, scroll/keyboard behavior |
| `TopBar` | Back/title/context action with predictable height |
| `PrimaryButton` | One high-emphasis action, loading/disabled states |
| `SecondaryButton` | Reversible or lower-priority action |
| `DangerButton` | Stop/delete/cancel with confirmation rules |
| `Card` | Surface grouping with standard padding and border |
| `StatusPill` | Text + icon + semantic color |
| `ReadinessRow` | Capability, result, reason, remediation |
| `InlineNotice` | Info/warning/error/local-mode messaging |
| `ReviewStepCard` | Collapsed and expanded test step review |
| `EvidenceThumbnail` | Redacted image, state label, accessibility description |
| `TimelineRow` | Replay step and assertion result |
| `ProgressStageList` | Determinate compilation stages |
| `BottomActionBar` | Sticky primary/secondary actions respecting insets |
| `PersistentStopButton` | Always reachable during replay/exploration |
| `ConfirmSheet` | Destructive and warning acknowledgement |
| `EmptyState` | One explanation and one primary action |

No feature may create a one-off button, status badge, modal, or spacing scale when the shared primitive covers it.

---

## 9. Visual design system

The submitted prototype is the source of visual direction: dark, precise, developer-oriented, high contrast, with lime and cyan accents.

### 9.1 Color tokens

```ts
export const colors = {
  background: '#080B10',
  surface: '#111822',
  surfaceRaised: '#17212D',
  border: '#2A3645',
  text: '#F7FAFC',
  textMuted: '#A7B2C2',
  lime: '#C7FF4A',       // ready, approved, local execution
  cyan: '#59D9FF',       // information and evidence
  amber: '#F2B84B',      // review required or degraded fallback
  red: '#FF667A',        // failed assertion or hard stop
  scrim: 'rgba(0,0,0,0.64)',
} as const;
```

Exact colors may be contrast-adjusted before freeze, but their semantics must not change.

### 9.2 Spacing, radius, and typography

- Base spacing unit: 4 dp; normal screen/card rhythm: 8, 12, 16, 24, 32.
- Horizontal screen padding: 20 dp phone, 24 dp wide phone.
- Card radius: 16 dp; input/button radius: 12 dp; pill radius: full.
- Minimum touch target: 48 × 48 dp.
- Body text: minimum 15 sp; supporting text: minimum 13 sp.
- Use at most four visible text levels per screen: eyebrow, title, body, metadata.
- Use system font for performance and predictable rendering.
- Use tabular numerals for timers, budgets, and step counts.

### 9.3 Motion

- Motion communicates progress, expansion, selection, or state change; it is not decorative.
- Frequent transitions: 150–220 ms.
- Screen/large-sheet transitions: 220–320 ms.
- No bouncing animations in Mission Control or failure states.
- Respect Android Remove Animations/reduced-motion settings.
- Stop controls and error messages appear immediately without waiting for animation completion.

### 9.4 Accessibility

- Every status uses icon + text, never color alone.
- All controls have roles, labels, states, and hints where useful.
- Evidence thumbnails have generated descriptions and an **Open evidence** action.
- Large font must not hide the Stop button or primary approval action.
- Focus moves to the first validation error after failed submit.
- Reading order follows visual order.
- TalkBack test all P0 screens on the physical device.

---

## 10. Client state model

### 10.1 `readinessStore`

```ts
interface ReadinessState {
  readiness?: DeviceReadiness;
  loading: boolean;
  checkedAt?: string;
  refresh(): Promise<void>;
  clear(): void;
}
```

Refresh on app foreground, return from Android Settings, and immediately before capture/replay/mission preflight.

### 10.2 `activeOperationStore`

```ts
type ActiveOperation =
  | { kind: 'CAPTURE'; id: string; progress?: CaptureProgress }
  | { kind: 'COMPILE'; id: string; progress?: CompileProgress }
  | { kind: 'REPLAY'; id: string; progress?: ReplayProgress }
  | { kind: 'MISSION'; id: string; progress?: MissionProgress };

interface ActiveOperationState {
  active?: ActiveOperation;
  hydrate(): Promise<void>;
  applyEvent(event: PocketQaEvent): void;
  clearIfTerminal(): void;
}
```

Only one capture, replay, or mission may be active. Native code enforces mutual exclusion even if the JS store is stale.

### 10.3 `draftEditorStore`

Holds a cloned editable `TestDraft`, base revision, dirty paths, local validation results, save state, and warning acknowledgements.

- Debounce client validation after material edits.
- Save with optimistic concurrency using base revision.
- On conflict, reload and show a safe conflict message; do not silently overwrite.
- Approval clears local editor state after the native immutable version is returned.

### 10.4 `settingsStore`

Stores non-sensitive UI settings such as reduced evidence thumbnails, default retention period, preferred intent mode, and whether Agent Lab is visible. Provider keys and raw captured data never enter this store or AsyncStorage.

### 10.5 Store rules

- Stores expose semantic actions, not generic setters.
- Components select the smallest state slice needed.
- Domain transformations are pure functions outside stores.
- No navigation object is stored globally.
- Native event subscriptions are registered once at app-root level and cleaned up on teardown.

---

## 11. Native bridge contract

Expose one TypeScript façade, `PocketQaNative`, even if implementation is initially a standard Native Module and later becomes a Codegen TurboModule.

### 11.1 Commands

```ts
export interface PocketQaNativeApi {
  getStartupState(): Promise<StartupState>;
  getReadiness(): Promise<DeviceReadiness>;
  openAccessibilitySettings(): Promise<void>;
  listAllowlistedApps(): Promise<TargetApp[]>;

  createIntent(input: IntentInput): Promise<{ intentId: string }>;
  startCapture(input: StartCaptureRequest): Promise<{ sessionId: string }>;
  pauseCapture(sessionId: string): Promise<void>;
  resumeCapture(sessionId: string): Promise<void>;
  finishCapture(sessionId: string): Promise<{ compileJobId: string }>;
  cancelCapture(sessionId: string, deleteArtifacts: boolean): Promise<void>;

  getCompileJob(jobId: string): Promise<CompileJob>;
  cancelAiEnhancement(jobId: string): Promise<void>;
  getDraft(draftId: string): Promise<TestDraft>;
  saveDraft(input: SaveDraftRequest): Promise<TestDraft>;
  validateDraft(draftId: string): Promise<ValidationResult>;
  approveDraft(draftId: string): Promise<ApprovedTest>;

  listTests(): Promise<TestListItem[]>;
  getTest(testId: string, version?: number): Promise<ApprovedTest>;
  startReplay(testId: string, version: number): Promise<{ runId: string }>;
  stopReplay(runId: string): Promise<void>;
  getRun(runId: string): Promise<ReplayRunSummary>;
  getEvidenceTimeline(runId: string): Promise<EvidenceStep[]>;

  createMission(input: MissionDraft): Promise<Mission>;
  approveAndStartMission(missionId: string): Promise<void>;
  stopMission(missionId: string): Promise<void>;
  getMission(missionId: string): Promise<MissionSummary>;

  exportTest(testId: string, version: number): Promise<ShareableArtifact>;
  exportEvidence(runId: string): Promise<ShareableArtifact>;
  shareArtifact(uri: string, mimeType: string): Promise<void>;
  copyRedactedDiagnostics(runId: string): Promise<void>;

  saveProviderCredential(input: ProviderCredentialInput): Promise<ProviderStatus>;
  deleteProviderCredential(provider: ConnectedProvider): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  deleteTest(testId: string): Promise<void>;
  deleteAllData(): Promise<void>;
}
```

### 11.2 Events

```ts
export type PocketQaEvent =
  | { type: 'SERVICE_STATUS_CHANGED'; payload: ServiceStatus }
  | { type: 'CAPTURE_PROGRESS'; payload: CaptureProgress }
  | { type: 'CAPTURE_HARD_STOP'; payload: HardStop }
  | { type: 'COMPILE_PROGRESS'; payload: CompileProgress }
  | { type: 'COMPILE_FINISHED'; payload: { jobId: string; draftId: string } }
  | { type: 'REPLAY_PROGRESS'; payload: ReplayProgress }
  | { type: 'REPLAY_FINISHED'; payload: ReplayRunSummary }
  | { type: 'MISSION_PROGRESS'; payload: MissionProgress }
  | { type: 'MISSION_FINISHED'; payload: MissionSummary };
```

### 11.3 Wire validation

- Every payload contains `schemaVersion` and a correlation/operation ID.
- Complex records may cross Codegen as schema-versioned JSON strings if the selected RN Codegen cannot express the canonical union cleanly.
- The façade parses and validates payloads before returning typed values to features.
- Unknown event types are ignored and logged by safe code only.
- Unknown critical enum values fail parsing and show an upgrade-safe error.
- Native error messages must use the safe envelope below; raw stack traces and captured text never cross the production bridge.

```ts
interface PocketQaError {
  code: string;
  message: string;
  recoverable: boolean;
  remediation?: string;
  correlationId: string;
}
```

---

## 12. Domain models used by the UI

Canonical fields remain defined by `packages/schemas`. UI-specific view models must be derived, not persisted as alternate domain records.

Required models:

- `DeviceReadiness`
- `IntentSpec`
- `CaptureSessionSummary`
- `UiStateSummary`
- `Selector` and `SelectorCandidate`
- `ActionStep`
- `Assertion`
- `TestDraft`
- `ApprovedTest`
- `ValidationResult`
- `ReplayProgress` and `ReplayRunSummary`
- `EvidenceStep`
- `InferenceProvenance`
- `Mission`, `MissionProgress`, and `MissionSummary`
- `PolicyDecision`
- `ShareableArtifact`

### 12.1 View-model mapping

Example:

```ts
interface ReviewStepViewModel {
  id: string;
  ordinal: number;
  title: string;
  targetLabel: string;
  selectorSummary: string;
  confidence: 'STRONG' | 'REVIEW' | 'BRITTLE';
  provenance?: 'DETERMINISTIC' | 'ON_DEVICE_AI' | 'CONNECTED_AI';
  evidenceStateIds: string[];
  assertions: AssertionViewModel[];
  warnings: UiIssue[];
  errors: UiIssue[];
}
```

Mapping functions are pure and exhaustively tested. Never infer safety from display labels such as `STRONG`; authoritative approval uses native validators and policy.

---

## 13. AI and voice UX

### 13.1 Capability order

1. Supported on-device structured inference.
2. Deterministic local fallback.
3. Optional connected provider after operation-level consent.

The screen must always identify the active path. “Local mode” must mean that the current operation used no network, not merely that local storage is enabled.

### 13.2 Allowed app-facing AI tasks

- transcribe intent;
- normalize/name a test;
- rank grounded assertions;
- explain selector strength;
- rank already policy-filtered Explorer candidates;
- classify a replay failure;
- suggest a selector repair for human review; and
- generate an evidence explanation grounded in captured IDs.

### 13.3 Prohibited behavior

- No free-form model output is executable.
- No AI-created selector/action/assertion is accepted unless it references known candidate IDs and passes schema validation.
- No connected call receives unredacted data.
- No screenshot or UI tree goes to Sarvam; Sarvam receives intent audio only.
- No provider is silently used after an offline/local choice.
- A failed, timed-out, or invalid model response must preserve the deterministic flow.

### 13.4 UI labels

- `Generated locally`
- `Deterministic fallback`
- `Proposed by on-device AI`
- `Connected analysis — consented`
- `Model output rejected — local result used`
- `No network used`

---

## 14. Offline, lifecycle, and recovery

- The app is usable with network disabled from startup.
- App backgrounding or React Native reload does not terminate native capture/replay/mission state.
- Startup hydration checks for active native operations and routes to recovery.
- Native operation IDs are persisted before launching the target app.
- If the process dies during recording, native startup marks the session `FAILED_INTERRUPTED` with partial evidence rather than pretending recording continues.
- Device lock, target uninstall/update, accessibility-service disconnect, cross-package navigation, or system dialog produces a terminal structured result.
- Optional provider timeouts never block navigation indefinitely.
- Every long-running screen has a safe retry, stop, or deterministic fallback.

---

## 15. Errors and empty states

Map structured native codes to stable product copy. Do not surface exception text.

| Error family | UI behavior |
|---|---|
| `SETUP_*` | Readiness card with direct remediation |
| `CAPTURE_*` | Pause/hard-stop summary; preserve valid partial evidence |
| `COMPILE_*` | Show validation issue or deterministic fallback |
| `TARGET_NOT_FOUND` | Stop replay; show last state and selector evidence |
| `TARGET_AMBIGUOUS` | Stop replay; show candidate count; no coordinate fallback |
| `POLICY_DENIED` | Hard-stop screen with rule category |
| `ASSERTION_FAILED` | Evidence result with expected/observed facts |
| `PROVIDER_*` | Non-blocking provider status; offer local path |
| `EXPORT_*` | Preserve generated artifact and allow retry/share again |

Required empty states:

- no tests;
- no run history;
- no evidence image for a tree-only state;
- no on-device model;
- no connected provider;
- no safe Explorer candidate; and
- no failure diagnosis beyond structured facts.

---

## 16. Performance budgets for the React Native layer

| Operation | Target |
|---|---:|
| App shell usable after JS start | <1.5 s on demo device |
| Screen transition response | <100 ms input acknowledgement |
| Readiness refresh UI update | <250 ms after native response |
| Capture progress render | no more than 4 UI updates/second |
| Timeline initial render | <500 ms for first 20 rows |
| Draft edit acknowledgement | immediate local update |
| Debounced client validation | 250–400 ms after edit |
| Persistent Stop tap to native call | <100 ms |
| Large evidence image decode | thumbnail first; full image on demand |

Use `FlatList` for tests, review steps, and evidence. Avoid passing full screenshots through JS as base64; native exposes `content://` or app-safe URIs. Memoize row view models and do not put a per-event stream into React component state.

---

## 17. Privacy and security requirements

- Only redacted domain data is available to the React Native layer.
- Password, OTP, card, CVV, tokens, phone numbers, email, and marked regions are redacted before persistence/inference/export.
- Screenshots are displayed from app-private or `FileProvider` URIs and are never copied into the repository.
- Clipboard support is limited to explicitly redacted diagnostics or user-authored intent.
- Provider keys are written directly to native encrypted storage and cleared from form/store state immediately.
- Logs contain IDs, durations, enums, and safe codes—not screen text, typed input, model prompts, provider bodies, or file paths containing private content.
- Delete operations show scope and are implemented by the native repository so files and metadata are removed together.
- Export runs a final redaction and schema check before returning a shareable URI.

---

## 18. Testing strategy

### 18.1 TypeScript unit tests

- route and bridge payload parsing;
- domain-to-view-model mapping;
- intent validation;
- readiness status derivation;
- review-step warnings and error formatting;
- provenance labels;
- error-code-to-copy mapping;
- time/budget formatting; and
- store transition reducers/actions.

### 18.2 Component tests

- disclosure cannot continue without consent;
- readiness remediation calls the correct native façade method;
- intent cannot continue with invalid goal/target;
- voice transcript requires confirmation;
- Review Step expands and exposes grounded choices;
- approval is blocked on errors and acknowledges warnings;
- Stop is available and calls native once;
- Evidence renders pass/fail/partial states;
- connected AI labels and consent are visible; and
- large text does not remove critical controls from accessibility tree.

Use a mocked `PocketQaNativeApi` injected through the app provider. Do not mock `NativeModules` independently in every test.

### 18.3 Contract tests

- Canonical JSON fixture validates in TypeScript and Kotlin.
- Bridge façade accepts every supported native fixture.
- Unknown enum/schema version fails safely.
- Error envelopes contain no captured content.
- AI result with fabricated candidate IDs is rejected.

### 18.4 Physical-device acceptance tests

- Enable AccessibilityService and observe readiness update after returning.
- Complete canonical capture in Demo Shop.
- Finish while PocketQA is backgrounded and resume compilation.
- Approve and replay three times consecutively.
- Stop replay and Explorer from their persistent controls.
- Trigger ambiguous selector and cross-package hard stop.
- Complete the full P0 flow in airplane mode.
- Share YAML and evidence ZIP through Office Kit.
- Run TalkBack through onboarding, intent, review, Mission Control, and evidence.

### 18.5 Required end-to-end gates

1. **Capture gate:** ordered, redacted trace from the canonical manual flow.
2. **Compile gate:** schema-valid deterministic draft with correct coupon assertion.
3. **Review gate:** edit, save, validate, and approve immutable version.
4. **Replay gate:** three consecutive passes on physical iQOO.
5. **Offline gate:** one full successful run with `networkUsed: false`.
6. **Export gate:** Maestro YAML parses/runs and evidence ZIP checksum verifies.
7. **Safety gate:** no blocked Explorer candidate reaches the execution backend.

---

## 19. Android builds and configuration

### 19.1 Variants

| Variant | Purpose | Explorer | Provider key screen | Diagnostics |
|---|---|---:|---:|---:|
| `internalLabDebug` | Hackathon development/demo | Enabled behind opt-in | Enabled | Verbose but redacted |
| `internalRelease` | Stable sideloaded demo | Configurable | Proxy/runtime policy | Minimal/redacted |
| `playRelease` | Future evaluation only | Disabled with Accessibility backend | Proxy only | Production |

### 19.2 Environment configuration

Non-secret compile-time values may include:

- PocketQA package/application ID;
- Demo Shop package ID;
- build/version name;
- default retention period;
- feature flags for Agent Lab and connected providers; and
- schema bundle hash.

Secrets must not be provided through `.env` files compiled by Metro, Gradle `BuildConfig`, checked-in properties, or string resources.

### 19.3 Build commands to expose

```text
npm run android:lab
npm run typecheck
npm run lint
npm test
npm run test:contracts
npm run build:apk:lab
npm run maestro:demo
```

The exact package manager is frozen in Gate 0 and enforced by the lockfile. Do not mix npm, Yarn, pnpm, or Bun across teammates.

---

## 20. Office Kit workflow

Office Kit receives no code integration. PocketQA should support its workflow through standard Android capabilities:

- install APK transferred from the Mac;
- operate the phone while mirrored;
- accept normal keyboard input in the intent/review fields;
- copy only redacted diagnostics to the shared clipboard;
- share YAML and ZIP through Android Sharesheet/Storage Access Framework; and
- present all demo screens correctly under mirroring.

Green Light loop:

```text
Mac build → Office Kit transfer → iQOO install/test
         ← evidence ZIP/YAML transfer ← PocketQA export
```

Red Light loop:

- run the existing APK;
- capture, compile, review, replay, and explore on the phone;
- use mirrored keyboard/trackpad input;
- tune only safe runtime/debug settings exposed in-app; and
- collect evidence for the next Green Light implementation pass.

Never copy API keys through the Office Kit clipboard.

---

## 21. Delivery plan

### Phase RN-0 — Foundation

| Task | Exit evidence |
|---|---|
| Bootstrap RN CLI Android app with strict TS/New Architecture | Launches on iQOO |
| Add app/theme/navigation providers | Welcome → Home navigation works |
| Define native façade and mock implementation | Screens run without native core |
| Add shared components and tokens | Component gallery/test coverage |
| Add schema package consumption | One canonical fixture parses |

### Phase RN-1 — Onboarding and intent

| Task | Exit evidence |
|---|---|
| Welcome/disclosure/consent | Consent persists and gates Home |
| Readiness screen | Settings round trip updates service state |
| Home/Test Library | Empty, draft, and approved test states |
| Typed intent and target picker | Valid intent creates native intent ID |
| Capture Ready | Preflight blocks unsafe start |

### Phase RN-2 — Capture and compilation

| Task | Exit evidence |
|---|---|
| Capture Status and operation hydration | Step count survives app background |
| Pause/resume/finish/cancel | Each invokes exactly one native command |
| Hard-stop UI | Reason and retained-data status visible |
| Compile Progress | Stage events and deterministic fallback visible |

### Phase RN-3 — Review, replay, and evidence

| Task | Exit evidence |
|---|---|
| Review list and expandable cards | Canonical draft is understandable without JSON |
| Selector/assertion editors | Grounded edit saves and validates |
| Approval workflow | Immutable approved version returned |
| Replay Mission Control | Live step progress and Stop work |
| Evidence timeline | Pass/fail steps and screenshots render |
| Share/export actions | YAML and ZIP reach Office Kit/Mac |

### Phase RN-4 — Agentic demonstration

| Task | Exit evidence |
|---|---|
| Agent Lab mission form | Bounded mission validates |
| Mission Review | Human approval and policy hash displayed |
| Explorer Mission Control | Budget, proposal, decision, and Stop visible |
| Proposal review | New state/assertion is review-only |

### Phase RN-5 — Optional polish

- Sarvam voice intent and transcript confirmation.
- On-device assertion ranking labels.
- Failure Detective explanation.
- Selector repair proposal.
- State graph visualization.
- Accessibility audit insight.

---

## 22. Suggested team split

| Lane | Work |
|---|---|
| React Native owner | app shell, navigation, native façade, stores, Review and Evidence integration |
| UI/new contributor | tokens, shared components, Home, Readiness, Intent, empty/error states, component tests |
| Android systems | AccessibilityService, Room/files, capture coordinator, native bridge, executor |
| AI/domain and quality | schemas, compiler, provider routing, policy, Demo Shop, fixtures, Maestro and acceptance matrix |

New contributors should begin with mocked native data and feature components. They should not modify capture, policy, execution, redaction, credentials, or canonical schemas without review.

---

## 23. Definition of done

The React Native application is hackathon-ready when:

- it installs and launches on the supplied iQOO device;
- onboarding clearly discloses capture and stores explicit consent;
- readiness correctly reflects AccessibilityService state;
- a typed intent can start the allowlisted Demo Shop demonstration;
- active capture state survives app background/foreground;
- deterministic compilation produces a reviewable draft;
- every action, selector, assertion, warning, and evidence source is understandable without raw JSON;
- invalid drafts cannot be approved;
- replay uses only the approved immutable version;
- Mission Control shows live progress and an immediately reachable Stop button;
- evidence clearly shows pass/fail facts, provenance, and network usage;
- YAML and evidence ZIP can be shared to the Mac through Office Kit;
- one full flow succeeds in airplane mode;
- Agent Lab cannot exceed its package/action/time/tool limits;
- model failure or unavailability never breaks the core path;
- TalkBack, large text, and 48 dp targets pass on all P0 screens; and
- the canonical flow passes three times consecutively after a clean fixture reset.

---

## 24. Open decisions to freeze before coding

- Exact React Native version and package manager.
- PocketQA application ID and signing setup.
- Whether the first bridge is TurboModule-only or a standard Native Module behind the same façade.
- Final schema locations/names for the core mobile domain, separate from current AI schemas.
- Whether Demo Shop is native Android or a second React Native app; native Android is simpler and recommended.
- Confirmed ML Kit Prompt/Gemini Nano capability on the supplied iQOO.
- Overlay vs persistent-notification capture controls on the target Android build.
- Exact retention default and maximum evidence bundle size.
- Sarvam/OpenAI demo credentials and whether connected features are enabled at all.
- Office Kit transfer/share route verified on the hackathon device.

None of these decisions may block building the deterministic mocked RN flow first.

---

## 25. Implementation references

- [PocketQA Product Requirements Document](PocketQA_PRD.md)
- [PocketQA Technical Specification](PocketQA_Technical_Spec.md)
- [PocketQA Agentic AI Backlog](PocketQA_Agentic_AI_Backlog.md)
- [PocketQA AI Track A](PocketQA_AI_Track_A_Reasoning.md)
- [PocketQA AI Track B](PocketQA_AI_Track_B_Platform.md)
- [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
- [React Native New Architecture](https://reactnative.dev/architecture/landing-page)
- [React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [React Navigation TypeScript guidance](https://reactnavigation.org/docs/typescript/)
- [Android AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [Android screenshot callback](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService.TakeScreenshotCallback)
