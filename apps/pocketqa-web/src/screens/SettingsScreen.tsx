import { useStore } from "../store";

export function SettingsScreen() {
  const { state, actions } = useStore();
  const r = state.readiness;
  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">Settings</span>
      </div>

      <div className="eyebrow">Capture</div>
      <div className="card tight">
        <SettingRow
          label="Airplane mode"
          hint="Core loop remains available: capture, compile, review, replay, export."
          value={r.offlineMode}
          onChange={() => actions.setReadiness({ offlineMode: !r.offlineMode })}
        />
        <SettingRow
          label="Microphone (voice intent)"
          hint="Used only on the intent screen. Never triggers an action."
          value={r.microphoneReady}
          onChange={() => actions.setReadiness({ microphoneReady: !r.microphoneReady })}
        />
      </div>

      <div className="eyebrow">Local AI</div>
      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600 }}>On-device Prompt (Gemini Nano)</div>
            <div className="p-dim" style={{ marginTop: 4 }}>Simulated availability toggle — routes compilation to on-device AI when ready.</div>
          </div>
          <div
            className={`toggle ${r.onDeviceModel === "ready" ? "on" : ""}`}
            role="button"
            onClick={() => actions.setReadiness({ onDeviceModel: r.onDeviceModel === "ready" ? "unavailable" : "ready" })}
          />
        </div>
        <div className="p-dim" style={{ marginTop: 8, fontSize: 12 }}>
          Current status:
          <span className={`pill ${r.onDeviceModel === "ready" ? "lime" : "amber"}`} style={{ marginLeft: 6 }}>
            {r.onDeviceModel === "ready" ? "Ready" : "Unavailable — deterministic fallback"}
          </span>
        </div>
      </div>

      <div className="eyebrow">Connected providers · off by default</div>
      <div className="card tight">
        <SettingRow
          label="Sarvam voice transcription"
          hint="Only microphone audio from the intent screen. No screenshots, trees, or evidence are sent."
          value={r.connectedSarvam}
          disabled={r.offlineMode}
          onChange={() => actions.setReadiness({ connectedSarvam: !r.connectedSarvam })}
        />
        <SettingRow
          label="OpenAI review adapter"
          hint="Optional connected review of one difficult state. Requires redacted preview + explicit consent."
          value={r.connectedOpenAI}
          disabled={r.offlineMode}
          onChange={() => actions.setReadiness({ connectedOpenAI: !r.connectedOpenAI })}
        />
      </div>

      <div className="eyebrow">Danger zone</div>
      <div className="card danger">
        <div style={{ fontWeight: 600 }}>Delete all local data</div>
        <div className="p-dim" style={{ marginTop: 4 }}>
          Removes sessions, tests, evidence, and consent record from this device.
        </div>
        <button
          className="btn block danger"
          style={{ marginTop: 10 }}
          onClick={() => {
            if (confirm("Delete every session, test, and evidence from this device?")) {
              actions.deleteAll();
            }
          }}
        >Delete all data</button>
      </div>

      <div className="p-dim" style={{ marginTop: 12, fontSize: 11 }}>
        PocketQA · Build-ready v1.0 · Tech Phantoms · iQOO Hackathon 2026
      </div>
    </div>
  );
}

function SettingRow({ label, hint, value, onChange, disabled }: {
  label: string;
  hint: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="row-between" style={{ padding: "8px 0", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="p-dim" style={{ marginTop: 2, fontSize: 12 }}>{hint}</div>
      </div>
      <div
        className={`toggle ${value ? "on" : ""}`}
        role="button"
        onClick={() => !disabled && onChange()}
      />
    </div>
  );
}
