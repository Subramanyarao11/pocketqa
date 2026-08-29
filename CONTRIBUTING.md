# Contributing to PocketQA

PocketQA is being built under hackathon time constraints, but safety and review boundaries still apply. Keep changes small, testable, and easy for another teammate to understand.

## Before starting

1. Complete the [Mac setup guide](PocketQA_Mac_Setup_and_New_Developer_Guide.md).
2. Read the PRD sections relevant to your issue.
3. Read the corresponding technical-spec module.
4. Confirm the issue owner and acceptance criteria.
5. Ask before changing a shared schema or architectural decision.

## Branches

Create a branch from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c feat/short-description
```

Prefixes:

- `feat/` — product capability.
- `fix/` — bug fix.
- `test/` — tests or fixtures.
- `docs/` — documentation only.
- `chore/` — tooling or maintenance.

One branch should address one issue.

## Commits

Use a short action-oriented subject:

```text
feat: add coupon retry fixture
fix: reject ambiguous selector matches
test: cover payment-screen hard stop
docs: clarify physical device setup
```

Review `git status` and `git diff` before staging. Stage only files related to the issue.

## Pull requests

Every pull request must include:

- linked issue or task;
- concise description;
- acceptance criteria addressed;
- tests run and their results;
- emulator/device and Android version for UI/native changes;
- redacted screenshots for visible changes, when useful;
- known limitations; and
- confirmation that no secret or private capture is included.

Keep pull requests small enough to review in one sitting whenever possible.

## Required checks

Run the repository-provided equivalents of:

```bash
npm run lint
npm test
npm run test:contracts
npm run test:safety
```

For changed generated/exported flows:

```bash
maestro test path/to/flow.yaml
```

If a planned command does not exist yet, document the manual or module-specific test performed.

## Review-required areas

Changes in these areas require the repository owner and relevant experienced module owner:

- Android AccessibilityService or screenshot capture;
- deterministic executor or action dispatch;
- package allowlist or safety policy;
- redaction/privacy;
- approved-test hashing/versioning;
- canonical JSON schemas/native bridge contracts;
- AI prompt-to-action boundaries;
- provider credentials or connected payloads;
- build signing or release configuration; and
- Explorer budgets or blocked categories.

## Safety invariants

Do not merge a change that breaks any of these:

1. No action without a persisted policy allow decision.
2. No action outside the allowlisted target package.
3. No ambiguous target action.
4. No new selector repair acted upon before approval.
5. No sensitive plaintext in storage, logs, model payloads, bridge events, or exports.
6. No connected call without explicit operation-level consent.
7. No model/network failure that prevents deterministic local capture, review, replay, and export.
8. No action after the user presses Stop.

## Data and secrets

- Use only Demo Shop fixture data.
- Do not test against personal or third-party apps.
- Do not commit real `.env` files, provider keys, keystores, signing files, raw captures, personal screenshots, APKs, or logs.
- Use redacted fixture files in tests.
- If a secret is exposed, revoke it immediately and alert the owner.

## Git safety

- Do not force-push shared branches.
- Do not use destructive reset/checkout commands to resolve a conflict.
- Do not rewrite someone else’s work.
- Ask for pairing when a merge conflict overlaps another teammate’s changes.
- Do not merge your own safety-critical pull request.

## Definition of complete

A contribution is complete when:

- acceptance criteria pass;
- relevant tests pass;
- error/loading/offline states are handled where applicable;
- accessibility labels and touch targets are included for UI changes;
- documentation/contracts are updated when behavior changes;
- no secret/private artifact is present; and
- required review is complete.
