# PocketQA

> Show a mobile flow once. Ship the regression test.

PocketQA is a private, local-first Android QA copilot that turns a developer’s intent and one demonstrated app flow into a reviewable test, deterministic replay, evidence bundle, and Maestro-compatible YAML.

This repository is the shared source of truth for the Tech Phantoms iQOO hackathon build.

## Current status

**Selected for the hackathon — implementation starting.**

The repository currently contains the submitted deck, product requirements, technical architecture, AI backlog, demo script, and a macOS onboarding guide. Application source code will be added following the architecture and implementation epics in the technical specification.

## Start here

New contributors should read these in order:

1. [Mac Setup and New Developer Guide](PocketQA_Mac_Setup_and_New_Developer_Guide.md)
2. [Product Requirements Document](PocketQA_PRD.md)
3. [Technical Specification](PocketQA_Technical_Spec.md)
4. [Agentic AI Backlog](PocketQA_Agentic_AI_Backlog.md)
5. [AI Track A — Reasoning, Prompts and Evaluation](PocketQA_AI_Track_A_Reasoning.md)
6. [AI Track B — Platform, Data and Integration](PocketQA_AI_Track_B_Platform.md)

Hackathon and pitch material:

- [Submission deck — PowerPoint](PocketQA_iQOO_Hackathon_2026.pptx)
- [Submission deck — PDF](PocketQA_iQOO_Hackathon_2026.pdf)
- [Video script](PocketQA_Video_Script.md)

## Product in one flow

```text
Say what must be true
        ↓
Demonstrate the app flow once
        ↓
Capture screenshots + accessibility tree + actions locally
        ↓
Compile a strict, editable test draft
        ↓
Human review and approval
        ↓
Deterministic replay
        ↓
Evidence bundle + Maestro YAML
```

The optional Explorer Agent operates only inside a small, approved mission. AI may observe, rank, explain, and propose. It cannot bypass schema validation, policy, approval, or the deterministic executor.

## Hackathon MVP

The first complete vertical slice must:

- accept a typed intent;
- record a human demonstration in the team-owned Demo Shop app;
- capture a screenshot and normalized accessibility tree at meaningful states;
- compile a reviewable test without requiring the network;
- allow editing and explicit approval;
- replay the approved test deterministically;
- produce pass/fail evidence;
- export valid Maestro YAML; and
- demonstrate one bounded, allowlisted Explorer mission only after the core loop is stable.

The canonical demo verifies that the `SAVE20` coupon remains applied after a simulated checkout failure and retry.

## Planned architecture

| Area | Technology |
|---|---|
| Product UI | React Native + TypeScript |
| Android capture/execution | Native Kotlin |
| Storage | Room + app-private evidence files |
| Offline OCR | Bundled ML Kit Text Recognition |
| On-device AI | ML Kit Prompt/Gemini Nano when supported |
| Guaranteed fallback | Deterministic local compiler |
| Optional voice | Sarvam speech-to-text |
| Optional complex review | OpenAI through a safe adapter/proxy |
| Portable test output | Maestro YAML |
| Demo target | Separate PocketQA Demo Shop Android app |

See [PocketQA_Technical_Spec.md](PocketQA_Technical_Spec.md) for module contracts, schemas, algorithms, policy rules, testing, and the issue-sized implementation plan.

## Non-negotiable safety rules

- Only explicitly allowlisted test applications are in scope.
- Payments, purchases, accounts, permissions, sensitive input, destructive actions, communications, system UI, and other apps are blocked.
- A model never calls the Android executor directly.
- Approved replay follows an immutable, schema-valid script.
- Explorer receives only prefiltered candidate actions and has strict action/time/state budgets.
- Ambiguous selectors fail closed.
- Raw private data and provider keys must not enter Git, logs, screenshots, issues, or exports.
- The core capture, compile, replay, and export path must work without Sarvam, OpenAI, or network access.

## Repository structure after implementation begins

The intended structure is:

```text
pocketqa/
├── apps/
│   ├── pocketqa-mobile/       # React Native app + native Kotlin modules
│   └── demo-shop/             # Deterministic target app and fixtures
├── packages/
│   ├── schemas/               # Canonical cross-layer JSON schemas
│   ├── maestro-exporter/
│   ├── policy-fixtures/
│   └── shared-types/
├── docs/                      # Additional engineering documentation
├── scripts/                   # Setup, validation, build, and demo helpers
└── .github/                   # Collaboration and CI configuration
```

The existing submission and planning documents remain at the repository root until the team deliberately reorganizes them in one reviewed change.

## Contributor setup

Both current new contributors use macOS. Follow the complete [Mac Setup and New Developer Guide](PocketQA_Mac_Setup_and_New_Developer_Guide.md).

The expected baseline is:

- macOS 12 or newer;
- Node.js 22.11 or newer, then the version pinned by the repository;
- Watchman;
- JDK 17;
- Android Studio stable;
- Android SDK Platform 35 plus the versions pinned by the project;
- Android Platform Tools/ADB;
- emulator or physical Android device; and
- Maestro CLI.

No contributor needs an OpenAI or Sarvam key for normal development.

## Suggested newcomer lanes

### Demo Shop and fixtures

- cart/coupon/retry UI;
- deterministic local fixture states;
- stable resource/test IDs;
- accessibility labels;
- fixture unit tests; and
- canonical Maestro flow.

### React Native product UI

- intent form;
- readiness cards;
- capture status;
- test review cards;
- evidence timeline;
- loading/error/offline states; and
- component tests.

Changes to capture, execution, policy, redaction, schemas, inference, or credentials require review from the repository owner and the relevant module owner.

## Git workflow

1. Take or create one issue.
2. Branch from an up-to-date `main`.
3. Use a focused branch such as `feat/evidence-step-card`.
4. Make small, reviewable commits.
5. Run the relevant lint/tests.
6. Open a pull request using the template.
7. Do not merge your own safety-critical change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow.

## Secrets and private data

Do not commit:

- `.env.local` or any real provider key;
- Android keystores/signing credentials;
- `local.properties`;
- raw PocketQA captures or personal screenshots;
- private device logs;
- APK/AAB outputs; or
- credentials copied into source, Gradle properties, or the JavaScript bundle.

If a secret is exposed, revoke/rotate it immediately and notify the repository owner. Removing it in a later commit does not remove it from Git history.

## Owners and access

Repository owner: `@Subramanyarao11`

This is a private hackathon repository. Teammates should be invited as collaborators using their GitHub usernames. Do not make the repository public without a deliberate review of submission rules, third-party assets, secrets, captured data, and licensing.

## Product documents

- [PocketQA PRD](PocketQA_PRD.md)
- [PocketQA Technical Specification](PocketQA_Technical_Spec.md)
- [PocketQA Mac Setup and New Developer Guide](PocketQA_Mac_Setup_and_New_Developer_Guide.md)
- [PocketQA Agentic AI Backlog](PocketQA_Agentic_AI_Backlog.md)
- [PocketQA Video Script](PocketQA_Video_Script.md)

## License

No open-source license is granted at this stage. This private repository and its contents are for the Tech Phantoms PocketQA hackathon project unless the owner explicitly decides otherwise.
