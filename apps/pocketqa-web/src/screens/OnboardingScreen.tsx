import { useStore } from "../store";

export function OnboardingScreen() {
  const { state, actions } = useStore();
  const r = state.readiness;

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">Set up capture</span>
      </div>

      <div className="card">
        <div className="eyebrow">Disclosure — FR-ONB-001</div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>What PocketQA will do</div>
        <div className="p-dim" style={{ marginTop: 6 }}>
          During a session, PocketQA can inspect and record screen content, interface labels,
          and your actions inside the app you select. Captures stay on this device unless you
          explicitly export them or enable a connected analysis provider. Passwords and likely
          sensitive fields are redacted. You can stop at any time.
        </div>
        <button
          className={r.consentedAt ? "btn block" : "btn primary block"}
          style={{ marginTop: 12 }}
          onClick={() => actions.setReadiness({ consentedAt: Date.now() })}
        >
          {r.consentedAt ? "✓ Consent recorded" : "I understand — record consent"}
        </button>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600 }}>Accessibility capture service</div>
            <div className="p-dim" style={{ marginTop: 4 }}>
              PocketQA uses AccessibilityService to read the UI tree during a session.
            </div>
          </div>
          <div
            className={`toggle ${r.accessibilityEnabled ? "on" : ""}`}
            role="button"
            onClick={() => actions.setReadiness({ accessibilityEnabled: !r.accessibilityEnabled })}
          />
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Device readiness — FR-ONB-003</div>
        <ReadinessRow label="Screenshot capture" ok status="Enabled" />
        <ReadinessRow label="UI hierarchy access" ok={r.accessibilityEnabled} status={r.accessibilityEnabled ? "OK" : "Requires setup"} />
        <ReadinessRow label="App-private storage" ok status="OK" />
        <ReadinessRow label="Microphone (voice intent)" ok={r.microphoneReady} status={r.microphoneReady ? "OK" : "Optional"} action={{
          label: r.microphoneReady ? "Disable" : "Enable",
          onClick: () => actions.setReadiness({ microphoneReady: !r.microphoneReady }),
        }} />
        <ReadinessRow
          label="On-device Prompt API (Gemini Nano)"
          ok={r.onDeviceModel === "ready"}
          status={r.onDeviceModel === "ready" ? "Ready" : "Unavailable — using deterministic fallback"}
          amber={r.onDeviceModel !== "ready"}
        />
      </div>

      <div className="card info">
        <div style={{ fontWeight: 600 }}>Capability routing</div>
        <div className="p-dim" style={{ marginTop: 4 }}>
          Unsupported on-device AI does not block the MVP. The deterministic local compiler is the guaranteed path.
        </div>
      </div>

      <button
        className="btn primary block"
        style={{ marginTop: 8 }}
        disabled={!r.consentedAt || !r.accessibilityEnabled}
        onClick={() => actions.navigate("intent")}
      >
        Start a test →
      </button>
    </div>
  );
}

function ReadinessRow({ label, ok, status, amber, action }: {
  label: string;
  ok: boolean;
  status: string;
  amber?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="row-between" style={{ padding: "8px 0" }}>
      <div className="row" style={{ gap: 8 }}>
        <span className={`dot ${ok ? "lime" : amber ? "amber" : "dim"}`} />
        <span>{label}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className={`pill ${ok ? "lime" : amber ? "amber" : "dim"}`}>{status}</span>
        {action && <button className="btn small ghost" onClick={action.onClick}>{action.label}</button>}
      </div>
    </div>
  );
}
