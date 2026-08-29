import { useMemo, useState } from "react";
import { useStore } from "../store";
import { toMaestroYaml } from "../lib/maestro";
import { buildEvidenceZip, downloadBlob } from "../lib/evidence";

export function EvidenceScreen() {
  const { state, actions } = useStore();
  const latest = state.tests[0];
  const result = state.lastResult ?? latest?.lastRun;
  const [tab, setTab] = useState<"timeline" | "yaml" | "manifest">("timeline");

  const yaml = useMemo(() => (latest ? toMaestroYaml(latest.approved) : ""), [latest]);

  if (!latest) {
    return (
      <div>
        <div className="screen-header">
          <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
          <span className="screen-title">Evidence</span>
        </div>
        <div className="p-dim">No approved test yet.</div>
      </div>
    );
  }

  const onExportYaml = () => {
    const blob = new Blob([yaml], { type: "text/yaml" });
    downloadBlob(blob, `${latest.approved.name.replace(/\s+/g, "_")}.maestro.yaml`);
  };
  const onExportBundle = async () => {
    if (!result) return;
    // include all captured states from the corresponding session if available
    const bundle = await buildEvidenceZip({
      test: latest.approved,
      result,
      states: {}, // states already retained in-memory; for MVP we omit binary screenshots
      intent: latest.approved.intent,
      device: { model: "iQOO Neo (web preview)", os: "web", app: latest.approved.packageName, pocketqa: "0.1.0" },
      offline: state.readiness.offlineMode,
    });
    downloadBlob(bundle, `${latest.approved.name.replace(/\s+/g, "_")}.evidence.zip`);
  };

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">Evidence</span>
      </div>

      <div className={`card ${result?.passed ? "callout" : result ? "danger" : ""}`}>
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600 }}>{latest.approved.name}</div>
            <div className="p-dim" style={{ marginTop: 4 }}>
              v{latest.approved.version} · schema <code>{latest.approved.schemaHash}</code>
            </div>
          </div>
          <span className={`pill ${result?.passed ? "lime" : result ? "red" : "dim"}`}>
            {result ? (result.passed ? "PASS" : "FAIL") : "Not run"}
          </span>
        </div>
        {result?.failure && (
          <div className="p-dim" style={{ marginTop: 8 }}>
            <span className="pill red">{result.failure.category}</span> {result.failure.summary}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        {(["timeline", "yaml", "manifest"] as const).map((t) => (
          <button
            key={t}
            className={`btn small ${tab === t ? "primary" : "ghost"}`}
            onClick={() => setTab(t)}
          >{t === "yaml" ? "Maestro YAML" : t === "manifest" ? "Manifest" : "Timeline"}</button>
        ))}
      </div>

      {tab === "timeline" && (
        <div>
          {latest.approved.steps.map((step, i) => {
            const r = result?.stepResults.find((sr) => sr.stepId === step.id);
            return (
              <div key={step.id} className={`step ${r?.status === "fail" ? "warn" : ""}`}>
                <div className="step-num">{i + 1}</div>
                <div className="row-between">
                  <div>
                    <div className="title">{step.label}</div>
                    <div className="p-dim" style={{ marginTop: 4, fontSize: 12 }}>
                      {step.selector && (
                        <>
                          <code>{step.selector.primary.strategy}</code> · {step.selector.primary.value}
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`pill ${r?.status === "pass" ? "lime" : r?.status === "fail" ? "red" : "dim"}`}>
                    {r ? r.status.toUpperCase() : "—"} {r?.elapsedMs ? `${r.elapsedMs}ms` : ""}
                  </span>
                </div>
                {r?.reason && (
                  <div className="p-dim" style={{ marginTop: 6, fontSize: 12 }}>{r.errorCode ? `[${r.errorCode}] ` : ""}{r.reason}</div>
                )}
              </div>
            );
          })}
          {result && (
            <div className="card info">
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>Final assertions</div>
                  <div className="p-dim" style={{ marginTop: 4 }}>{result.assertionResults.length} evaluated</div>
                </div>
                <span className="pill cyan">{result.finishedAt - result.startedAt}ms total</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "yaml" && (
        <div>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <span className="eyebrow">Maestro flow · FR-EVD-004</span>
            <button className="btn small primary" onClick={onExportYaml}>Download .yaml</button>
          </div>
          <pre className="yaml-preview">{yaml}</pre>
        </div>
      )}

      {tab === "manifest" && (
        <div>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <span className="eyebrow">Evidence bundle</span>
            <button className="btn small primary" onClick={onExportBundle} disabled={!result}>Download .zip</button>
          </div>
          <ManifestPreview
            intent={latest.approved.intent}
            offline={state.readiness.offlineMode}
            passed={!!result?.passed}
          />
        </div>
      )}
    </div>
  );
}

function ManifestPreview({ intent, offline, passed }: { intent: string; offline: boolean; passed: boolean }) {
  return (
    <div className="card">
      <div className="p-dim">
        Bundle contains: <br />
        • test.json (schema-valid definition) <br />
        • result.json (step + assertion results) <br />
        • maestro.yaml (portable export) <br />
        • states/*.json (redacted UI trees) <br />
        • manifest.json (device, policy, integrity hashes)
      </div>
      <hr className="sep" />
      <div className="p-dim">Intent: <em>{intent}</em></div>
      <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <span className="pill lime">local-only</span>
        <span className={`pill ${offline ? "lime" : "cyan"}`}>{offline ? "airplane mode" : "online"}</span>
        <span className={`pill ${passed ? "lime" : "red"}`}>{passed ? "run passed" : "run failed"}</span>
        <span className="pill dim">no provider used</span>
      </div>
    </div>
  );
}
