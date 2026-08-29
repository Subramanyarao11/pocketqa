# PocketQA web prototype

An interactive web prototype of the PocketQA authoring loop specified in
[`PocketQA_PRD.md`](../../PocketQA_PRD.md).  It runs entirely locally in a
browser and demonstrates:

- Home / Test Library, Intent, Capture, Review, Replay, Evidence, Agent Lab,
  and Settings screens (PRD §9).
- The **PocketQA Demo Shop** as an embedded target app with the canonical
  SAVE20 coupon → simulated payment failure → retry flow (PRD §16).
- A deterministic local compiler (Zod-validated `TestDraft`) that produces
  ranked selectors and evidence-grounded assertions (PRD §11.4, FR-COM-*).
- A deterministic executor that resolves selectors, enforces the safety
  policy, and fails closed on ambiguity or blocked categories (PRD §11.6,
  §12).
- A Maestro-compatible YAML exporter and a zippable evidence bundle
  (PRD FR-EVD-002 / FR-EVD-004).
- A bounded **Explorer Lab** mission with allowlist, action + time budgets,
  and proposal-only output (PRD §11.8).

## Run locally

```bash
cd apps/pocketqa-web
npm install
npm run dev
```

The prototype opens at `http://localhost:5173`.  Everything works offline —
disable the network after the page loads to prove out PRD §14.

## Architecture

```
src/
├── App.tsx                # store + navigation
├── store.ts               # in-memory app store (context)
├── components/            # PhoneFrame, BottomNav, StageAside
├── screens/               # 8 primary screens (§9 IA)
├── demo-shop/             # target app: model + component
└── lib/
    ├── schemas.ts         # Zod contracts (TestDraft, Mission, results)
    ├── policy.ts          # allowlist + blocked categories (§12)
    ├── selectors.ts       # ranked selectors + resolver
    ├── compiler.ts        # deterministic local compiler
    ├── executor.ts        # replay engine
    ├── harness.ts         # web replay driver for the demo shop
    ├── explorer.ts        # bounded Explorer Lab planner
    ├── maestro.ts         # Maestro YAML exporter
    ├── evidence.ts        # evidence bundle zip
    └── ids.ts             # id + djb2 hash helpers
```

The `lib/` modules are pure TypeScript and can be lifted into
`packages/schemas`, `packages/maestro-exporter`, and
`packages/policy-fixtures` in a future monorepo split.
