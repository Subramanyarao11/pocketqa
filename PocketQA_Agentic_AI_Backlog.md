# PocketQA — agentic and on-device AI backlog

## Product rule

The model may observe, propose, rank and plan. Only a constrained executor performs actions. Assertions, guarded actions and saved tests remain human-reviewable.

## Priority ladder

| Priority | Capability | What the local AI does | Practical implementation | Demo value |
|---|---|---|---|---|
| P0 | Intent compiler | Converts voice/text and a walkthrough into strict assertion JSON | ML Kit Prompt or Gemma/LiteRT + constrained schema | Core product |
| P0 | Multimodal UI state | Fuses screenshot, accessibility tree, OCR and timing | AccessibilityService screenshots/nodes + ML Kit OCR | Core product |
| P0 | Evidence writer | Explains a failure using intent, state and device context | Local prompt over captured evidence | Core product |
| P1 | Explorer Agent | Builds a state graph and proposes bounded branches | Local planner + approved click/type/back tools | Best agentic demo |
| P1 | Selector Self-Heal | Replaces broken selectors using label, role, layout and visual meaning | Candidate ranking over UI tree + screenshot | Immediate developer value |
| P1 | Failure Detective | Replays and removes unnecessary steps until the shortest reproduction remains | Deterministic replay + local ranking loop | Strong wow moment |
| P1 | Accessibility Auditor | Detects unlabeled controls, focus traps, invisible state and large-text failures | Accessibility nodes + screenshots + rules + local prompt | Credible and useful |
| P2 | Edge-Case Generator | Proposes locale, network, input, permission and saved-state variants | Prompt → bounded experiment matrix | Expands coverage |
| P2 | Local Test Memory | Learns app vocabulary, approved assertions and selector aliases on the phone | SQLite + local embeddings + retrieval | Improves every run |
| P2 | Visual Regression Agent | Compares semantic regions instead of raw pixels | Image embeddings + region matching | Reduces false positives |
| P2 | Flaky-Test Triage | Groups timing, animation, selector and environment failures | Local classifier over run history | CI productivity |
| P2 | Localization Agent | Finds clipping, untranslated strings, wrong currency and RTL/layout problems | OCR + locale switching + screenshot comparison | India-first differentiation |
| P2 | Privacy Auditor | Flags tokens, emails, phone numbers or sensitive fields appearing in evidence | On-device entity detection + redaction | Trust and enterprise value |
| P3 | Performance Anomaly Agent | Correlates slow states with UI transitions, CPU/memory and network timing | Local telemetry features + anomaly scoring | Advanced QA story |
| P3 | Cross-app Tool Agent | Uses structured app capabilities when available | Android AppFunctions; experimental Android 16+ path | Platform bet |
| P3 | Computer-Control Agent | Runs isolated multi-step UI sessions on supported OEM integrations | Android Computer Control; OEM-preloaded assistant constraint | Platform bet |
| P3 | Cooperative Device Agents | Splits the same mission across locale/device configurations | Local coordinator + multiple physical devices | Venue stretch |

## Recommended build order

1. Complete capture → strict JSON → approval → YAML/evidence.
2. Add the **Explorer Agent** with only four tools: `observe`, `tap(nodeId)`, `type(nodeId,text)` and `back`.
3. Enforce a mission budget: approved packages, maximum steps, timeout and hard-stop action classes.
4. Show one novel state and ask the developer to approve the generated assertion.
5. If stable, add Failure Detective or Accessibility Auditor; both reuse the same captured state graph.

## Connected boosts

- **Sarvam AI:** realtime Indic and code-mixed speech for the intent layer. Keep text entry and on-device speech as offline fallbacks.
- **OpenAI Responses API:** optional complex-screen review, edge-case brainstorming, image input, tool calling and structured JSON. Never make it a dependency for the airplane-mode demo.

## Guarded actions

Always stop before payments, purchases, account changes, permission changes, destructive actions, external communication, sensitive-data submission or navigation outside the approved app set.

## Official implementation references

- https://developer.android.com/ai/overview
- https://developers.google.com/ml-kit/genai
- https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- https://developer.android.com/ai/appfunctions
- https://developer.android.com/ai/computer-control
- https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api
- https://developers.openai.com/api/reference/cli/resources/beta/subresources/responses

