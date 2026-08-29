import { useState } from "react";
import { useStore } from "../store";
import { ALLOWLISTED_PACKAGES } from "../lib/policy";

const CANONICAL_INTENT =
  "Verify SAVE20 remains applied after the checkout fails and I tap retry.";

export function IntentScreen() {
  const { state, actions } = useStore();
  const [intent, setIntent] = useState<string>(CANONICAL_INTENT);
  const [pkg, setPkg] = useState(ALLOWLISTED_PACKAGES[0]);
  const [fixture, setFixture] = useState<"reset" | "coupon-retry" | "selector-drift">("coupon-retry");
  const [inputMode, setInputMode] = useState<"typed" | "voice">("typed");

  const isTooShort = intent.trim().length < 10;
  const isTooLong = intent.length > 500;
  const ready =
    !!state.readiness.consentedAt && state.readiness.accessibilityEnabled;

  if (!ready) {
    return (
      <div>
        <div className="screen-header">
          <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
          <span className="screen-title">New test</span>
        </div>
        <div className="card warn">
          <div style={{ fontWeight: 600 }}>Set up capture first</div>
          <div className="p-dim" style={{ marginTop: 4 }}>Consent and the accessibility service are required before recording.</div>
          <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => actions.navigate("onboarding")}>Open setup</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">New test</span>
      </div>

      <div className="eyebrow">Intent · FR-INT-001</div>
      <div className="row" style={{ marginBottom: 8, gap: 6 }}>
        <button
          className={`btn small ${inputMode === "typed" ? "primary" : "ghost"}`}
          onClick={() => setInputMode("typed")}
        >Typed</button>
        <button
          className={`btn small ${inputMode === "voice" ? "primary" : "ghost"}`}
          onClick={() => {
            setInputMode("voice");
            // Simulate voice → transcript for the demo.
            setTimeout(() => setIntent(CANONICAL_INTENT), 350);
          }}
          disabled={!state.readiness.microphoneReady}
          title={!state.readiness.microphoneReady ? "Enable microphone in setup" : ""}
        >Voice</button>
        {inputMode === "voice" && (
          <span className="pill cyan">
            {state.readiness.connectedSarvam ? "Sarvam" : "Local speech"}
          </span>
        )}
      </div>

      <textarea
        className="textarea"
        placeholder="What behavior must remain true?"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
      />
      <div className="row-between" style={{ marginTop: 4, marginBottom: 8 }}>
        <span className={`pill ${isTooShort || isTooLong ? "amber" : "dim"}`}>
          {intent.length} / 500
        </span>
        {isTooShort && <span className="pill amber">Add a little more detail (min 10 chars)</span>}
      </div>

      <div className="eyebrow">Target app · FR-INT-003 (allowlist only)</div>
      <div className="card tight">
        {ALLOWLISTED_PACKAGES.map((p) => (
          <label key={p} className="row" style={{ padding: "6px 0", cursor: "pointer" }}>
            <input type="radio" checked={pkg === p} onChange={() => setPkg(p)} />
            <div>
              <div style={{ fontWeight: 600 }}>PocketQA Demo Shop</div>
              <code style={{ color: "var(--text-mid)" }}>{p}</code>
            </div>
          </label>
        ))}
      </div>

      <div className="eyebrow">Fixture</div>
      <div className="card tight">
        {[
          { id: "reset" as const, label: "Reset (empty cart)" },
          { id: "coupon-retry" as const, label: "Coupon retry (canonical scenario)" },
          { id: "selector-drift" as const, label: "Selector-drift build (label change)" },
        ].map((f) => (
          <label key={f.id} className="row" style={{ padding: "6px 0", cursor: "pointer" }}>
            <input type="radio" checked={fixture === f.id} onChange={() => setFixture(f.id)} />
            <span>{f.label}</span>
          </label>
        ))}
      </div>

      <div className="card info" style={{ marginTop: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="dot cyan" />
          <div className="p-dim">
            Only the selected app is captured. Package changes during capture are a hard stop.
          </div>
        </div>
      </div>

      <button
        className="btn primary block"
        disabled={isTooShort || isTooLong}
        onClick={() => {
          actions.startSession(intent.trim(), pkg);
          // pre-set the fixture on the demo shop
          actions.setShop((s) => ({ ...s, fixture, driftEnabled: fixture === "selector-drift" }));
          actions.navigate("capture");
        }}
      >
        Start demonstration →
      </button>
    </div>
  );
}
