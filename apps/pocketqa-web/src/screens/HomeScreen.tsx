import { useStore } from "../store";
import { BottomNav } from "../components/BottomNav";

export function HomeScreen() {
  const { state, actions } = useStore();
  const ready = state.readiness.consentedAt && state.readiness.accessibilityEnabled;
  return (
    <div>
      <div className="row-between" style={{ padding: "12px 4px 4px" }}>
        <div>
          <div className="eyebrow">PocketQA</div>
          <div className="h1">Tests</div>
        </div>
        <span className="pill dim">Tech Phantoms</span>
      </div>

      {!ready && (
        <div className="card callout" onClick={() => actions.navigate("onboarding")} style={{ cursor: "pointer" }}>
          <div className="row-between">
            <div>
              <div style={{ fontWeight: 600 }}>Set up capture</div>
              <div className="p-dim" style={{ marginTop: 4 }}>
                Enable the accessibility capture service and consent before recording your first flow.
              </div>
            </div>
            <span className="pill amber">Required</span>
          </div>
        </div>
      )}

      {ready && (
        <div className="card">
          <div className="row-between">
            <div>
              <div className="eyebrow">Device</div>
              <div style={{ fontWeight: 600 }}>iQOO Neo · Android 15</div>
              <div className="p-dim">Compiler: <code>{state.compileEngine}</code></div>
            </div>
            <div className="col" style={{ alignItems: "flex-end" }}>
              <span className="pill lime"><span className="dot lime"/> Capture ready</span>
              <span className="pill cyan">{state.readiness.offlineMode ? "Local mode" : "Online"}</span>
            </div>
          </div>
        </div>
      )}

      <button
        className="btn primary block"
        style={{ marginTop: 8 }}
        onClick={() => actions.navigate("intent")}
      >
        + New test from a demonstration
      </button>

      <div className="h2">Recent</div>
      {state.tests.length === 0 && (
        <div className="card tight">
          <div className="p-dim">No tests yet. Record a demonstration to create your first regression test.</div>
        </div>
      )}
      {state.tests.map((t) => (
        <div
          key={t.approved.id}
          className="card"
          onClick={() => actions.navigate("evidence")}
          style={{ cursor: "pointer" }}
        >
          <div className="row-between">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{t.approved.name}</div>
              <div className="p-dim" style={{ marginTop: 4 }}>
                v{t.approved.version} · {t.approved.steps.length} steps · <code>{t.approved.packageName}</code>
              </div>
            </div>
            <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
              {t.lastRun ? (
                <span className={`pill ${t.lastRun.passed ? "lime" : "red"}`}>
                  {t.lastRun.passed ? "PASS" : "FAIL"}
                </span>
              ) : (
                <span className="pill dim">Not run</span>
              )}
              <span className="pill dim">{t.approved.compiledBy}</span>
            </div>
          </div>
        </div>
      ))}

      <div className="h2">Explore</div>
      <div className="card" onClick={() => actions.navigate("agent-lab")} style={{ cursor: "pointer" }}>
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600 }}>Agent Lab</div>
            <div className="p-dim">Ask a bounded Explorer to find one nearby untested state.</div>
          </div>
          <span className="pill violet">Experimental</span>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
