import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { DemoShop } from "../demo-shop/DemoShop";
import { createWebHarness } from "../lib/harness";
import { replayApprovedTest } from "../lib/executor";
import { reduceShop } from "../demo-shop/model";
import type { ShopAction, ShopState } from "../demo-shop/model";

export function ReplayScreen() {
  const { state, actions } = useStore();
  const latest = state.tests[0];
  const [logs, setLogs] = useState<{ msg: string; level: "info" | "pass" | "fail" }[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const stopSignal = useRef<{ stopped: boolean }>({ stopped: false });
  const shopRef = useRef<ShopState>(state.shop);
  shopRef.current = state.shop;

  useEffect(() => { stopSignal.current.stopped = false; }, []);

  const dispatch = (a: ShopAction) => actions.setShop((s) => reduceShop(s, a));

  const runReplay = async () => {
    if (!latest) return;
    setLogs([]);
    setProgress(0);
    setRunning(true);
    stopSignal.current = { stopped: false };
    const harness = createWebHarness({
      getState: () => shopRef.current,
      setState: (s) => actions.setShop(() => s),
      delayMs: 300,
      onEvent: (label) => setLogs((l) => [...l, { msg: label, level: "info" }]),
    });
    const result = await replayApprovedTest(latest.approved, harness, {
      stopSignal: stopSignal.current,
      offline: state.readiness.offlineMode,
      onStep: (idx, msg, level) => {
        setLogs((l) => [...l, { msg: `${idx >= 0 ? `[${idx + 1}] ` : ""}${msg}`, level }]);
        setProgress(((idx + 1) / latest.approved.steps.length) * 100);
        const targetNodeId = latest.approved.steps[idx]?.selector?.primary?.strategy === "testId"
          ? latest.approved.steps[idx]?.selector?.primary?.value ?? null
          : null;
        if (targetNodeId) setHighlightNodeId(matchNodeIdFromTestId(targetNodeId));
      },
    });
    actions.recordRun(result);
    setRunning(false);
    setHighlightNodeId(null);
    setTimeout(() => actions.navigate("evidence"), 400);
  };

  if (!latest) {
    return (
      <div>
        <div className="screen-header">
          <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
          <span className="screen-title">Replay</span>
        </div>
        <div className="p-dim">Approve a draft to replay it.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">Replay</span>
      </div>
      <div className="card">
        <div style={{ fontWeight: 600 }}>{latest.approved.name}</div>
        <div className="p-dim" style={{ marginTop: 4 }}>v{latest.approved.version} · {latest.approved.steps.length} steps</div>
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <button
            className="btn primary"
            disabled={running}
            onClick={runReplay}
          >{running ? "Running…" : "▶ Replay locally"}</button>
          <button
            className="btn danger"
            disabled={!running}
            onClick={() => { stopSignal.current.stopped = true; }}
          >■ Stop</button>
          <span className="spacer" />
          <span className="pill lime">{state.readiness.offlineMode ? "Airplane mode" : "Online"}</span>
        </div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 10 }}>
        <div className="eyebrow">Live target — {state.shop.packageName}</div>
        <DemoShop
          state={state.shop}
          dispatch={dispatch}
          interactive={false}
          highlightNodeId={highlightNodeId}
        />
      </div>

      <div className="eyebrow" style={{ marginTop: 12 }}>Executor log</div>
      <div className="card" style={{ maxHeight: 220, overflow: "auto" }}>
        {logs.length === 0 && <div className="p-dim">No output yet. Tap ▶ Replay locally.</div>}
        {logs.map((l, i) => (
          <div key={i} className={`log-line ${l.level}`}>{l.msg}</div>
        ))}
      </div>
    </div>
  );
}

// Map testId back to internal nodeId — small pragmatic helper so highlighting works.
function matchNodeIdFromTestId(testId: string): string | null {
  const mapping: Record<string, string> = {
    "product-sneakers": "product-card-sneakers",
    "product-tee": "product-card-tee",
    "product-cap": "product-card-cap",
    "add-to-cart": "add-to-cart-btn",
    "open-cart": "cart-badge",
    "coupon-input": "coupon-input",
    "apply-coupon": "coupon-apply-btn",
    "continue-checkout": "continue-checkout-btn",
    "retry": "retry-btn",
    "back-to-list": "back-to-list",
  };
  return mapping[testId] ?? null;
}
