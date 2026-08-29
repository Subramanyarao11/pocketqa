import { useStore } from "../store";

/**
 * The right-hand stage explains what's happening in the phone to whoever is
 * watching the demo.  It intentionally repeats vocabulary from the PRD so that
 * a reviewer with the doc open can trace the requirement being demonstrated.
 */
export function StageAside() {
  const { state } = useStore();
  const map: Record<string, { title: string; subtitle: string; body: React.ReactNode }> = {
    home: {
      title: "PocketQA — trusted authoring loop",
      subtitle: "Show a mobile flow once. Ship the regression test.",
      body: <HomeStage />,
    },
    onboarding: {
      title: "Consent and readiness (§11.1)",
      subtitle: "Disclosure, capture service, and device capabilities.",
      body: <OnboardingStage />,
    },
    intent: {
      title: "Say what must be true (§11.2)",
      subtitle: "Typed intent. Voice is optional and never triggers an action.",
      body: <IntentStage />,
    },
    capture: {
      title: "Demonstrate the flow once (§11.3)",
      subtitle: "Every stable UI state is snapshotted with an accessibility tree.",
      body: <CaptureStage />,
    },
    review: {
      title: "Review before action (§11.5)",
      subtitle: "A schema-valid draft — you edit, then approve.",
      body: <ReviewStage />,
    },
    replay: {
      title: "Deterministic replay (§11.6)",
      subtitle: "The executor may only run an approved script. AI cannot decide the next action.",
      body: <ReplayStage />,
    },
    evidence: {
      title: "Evidence over confidence theatre (§11.7)",
      subtitle: "Everything you need to trust or diagnose the run.",
      body: <EvidenceStage />,
    },
    "agent-lab": {
      title: "One bounded agentic moment (§11.8)",
      subtitle: "Explorer proposes. The deterministic executor is still the only thing that acts.",
      body: <AgentLabStage />,
    },
    settings: {
      title: "Settings — privacy and providers",
      subtitle: "Local by default. Connected assist is single-operation opt-in.",
      body: <SettingsStage />,
    },
  };
  const current = map[state.screen] ?? map.home;

  return (
    <aside className="stage">
      <h1>{current.title}</h1>
      <p className="subtitle">{current.subtitle}</p>
      {current.body}
    </aside>
  );
}

function HomeStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>P1 — Human intent in; deterministic evidence out</h3>
        <p>Models may interpret intent, rank assertions, and explain failures. Only validated schemas and deterministic code may drive execution.</p>
      </div>
      <div className="stage-card">
        <h3>P2 — Local by default</h3>
        <p>The core loop works with airplane mode on. Sarvam and OpenAI are opt-in, single-operation providers.</p>
      </div>
      <div className="stage-card">
        <h3>P3 — Review before action</h3>
        <p>Every generated test is reviewed and approved. Every mission is inspected before it runs.</p>
      </div>
      <div className="stage-card">
        <h3>P4 — Semantic selectors before coordinates</h3>
        <p>Test IDs, resource IDs, accessibility labels, and text+role before geometric fallbacks. Coordinates are marked brittle.</p>
      </div>
    </div>
  );
}

function OnboardingStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Disclosure</h3>
        <p>The user consents in-app, not just in system settings. Consent version and timestamp are stored locally.</p>
      </div>
      <div className="stage-card">
        <h3>Capability router</h3>
        <p>If ML Kit Prompt / Gemini Nano is unavailable, the deterministic local compiler is the primary compilation path.</p>
      </div>
    </div>
  );
}
function IntentStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Allowlist</h3>
        <p>Only the team-owned Demo Shop appears. A package change during capture is a hard stop.</p>
      </div>
      <div className="stage-card">
        <h3>Intent contract</h3>
        <p>10–500 characters. Empty or vague intent is rejected with a specific prompt.</p>
      </div>
    </div>
  );
}
function CaptureStage() {
  const { state } = useStore();
  const stateCount = state.session ? Object.keys(state.session.states).length : 0;
  const eventCount = state.session ? state.session.events.length : 0;
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Semantic boundaries</h3>
        <p>PocketQA snapshots after each meaningful action once the event stream settles. Currently captured: <strong>{stateCount} states / {eventCount} events</strong>.</p>
      </div>
      <div className="stage-card">
        <h3>Redaction</h3>
        <p>Passwords, OTPs, and card fields are redacted from stored nodes, logs, and screenshots — never sent to a model.</p>
      </div>
    </div>
  );
}
function ReviewStage() {
  const { state } = useStore();
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Compiled by</h3>
        <p><span className="pill lime">{state.draft?.compiledBy ?? "—"}</span></p>
      </div>
      <div className="stage-card">
        <h3>Steps</h3>
        <p>{state.draft?.steps.length ?? 0} normalized actions, each linked to a before/after state.</p>
      </div>
      <div className="stage-card">
        <h3>Final assertions</h3>
        <p>{state.draft?.finalAssertions.length ?? 0} end-state assertions grounded in observed evidence.</p>
      </div>
    </div>
  );
}
function ReplayStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Resolve before action</h3>
        <p>Before every tap: check active package, resolve selector to exactly one node, classify target, verify budget.</p>
      </div>
      <div className="stage-card">
        <h3>Ambiguity fails closed</h3>
        <p>Two matches without a deterministic disambiguator → <span className="pill red">TARGET_AMBIGUOUS</span>. No guess.</p>
      </div>
    </div>
  );
}
function EvidenceStage() {
  const { state } = useStore();
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Bundle contents</h3>
        <p>Test definition, intent, device/app versions, execution policy, screenshots, results, failure code, Maestro YAML, integrity checksums.</p>
      </div>
      <div className="stage-card">
        <h3>Last run</h3>
        <p>{state.lastResult ? (state.lastResult.passed ? "PASS" : `FAIL — ${state.lastResult.failure?.category ?? "unknown"}`) : "—"}</p>
      </div>
    </div>
  );
}
function AgentLabStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Mission fields</h3>
        <p>Goal, package allowlist, action budget, time budget, allowed tools, hard stops. Approved as a whole before any execution.</p>
      </div>
      <div className="stage-card">
        <h3>Tools</h3>
        <p><code>observe</code>, <code>tapNode</code>, <code>back</code>, <code>waitForIdle</code>, <code>stop</code>. Typing, gestures, and cross-app navigation are excluded from the first Explorer demo.</p>
      </div>
    </div>
  );
}
function SettingsStage() {
  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3>Data classes</h3>
        <p>Intent, screenshots, UI hierarchy, tests, logs, credentials. Retention and default export scope are defined by PRD §13.1.</p>
      </div>
      <div className="stage-card">
        <h3>Deletion</h3>
        <p>The user can delete a single session or all local data at any time.</p>
      </div>
    </div>
  );
}
