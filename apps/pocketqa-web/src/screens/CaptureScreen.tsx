import { useStore } from "../store";
import { DemoShop } from "../demo-shop/DemoShop";
import type { ShopAction } from "../demo-shop/model";
import type { CaptureEvent, UIState } from "../lib/schemas";

export function CaptureScreen({ shopDispatch }: { shopDispatch: (a: ShopAction) => void }) {
  const { state, actions } = useStore();
  const session = state.session;

  if (!session) {
    return (
      <div>
        <div className="screen-header">
          <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
          <span className="screen-title">Capture</span>
        </div>
        <div className="p-dim">No active session. Start a new test.</div>
      </div>
    );
  }

  const stateCount = Object.keys(session.states).length;
  const eventCount = session.events.length;
  const canFinish = eventCount >= 1 && stateCount >= 2;

  const onCapture = (evt: CaptureEvent, before: UIState, after: UIState) => {
    actions.addCaptureEvent(evt, before, after);
  };

  return (
    <div style={{ position: "relative" }}>
      <div className="capture-overlay">
        <span className="rec-dot" />
        <span style={{ fontWeight: 600 }}>
          {session.paused ? "Paused" : "Recording"}
        </span>
        <span className="spacer" />
        <span className="pill dim">Steps {eventCount}</span>
      </div>

      <div style={{ height: 34 }} />

      <div className="row-between" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Target</div>
          <code>{session.packageName}</code>
        </div>
        <div className="col" style={{ alignItems: "flex-end" }}>
          <span className="pill cyan">{stateCount} states</span>
          <span className="pill dim">≥ 4 needed for full demo</span>
        </div>
      </div>

      <div className="card tight" style={{ padding: 8, marginBottom: 10 }}>
        <div className="p-dim" style={{ fontSize: 12 }}>Intent</div>
        <div style={{ fontSize: 13 }}>{session.intent}</div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 10 }}>
        <DemoShop
          state={state.shop}
          dispatch={shopDispatch}
          onCaptureEvent={session.paused ? undefined : onCapture}
          interactive={!session.paused}
        />
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {!session.paused ? (
          <button className="btn ghost" onClick={() => actions.pauseSession()}>Pause</button>
        ) : (
          <button className="btn ghost" onClick={() => actions.resumeSession()}>Resume</button>
        )}
        <button className="btn danger" onClick={() => {
          if (confirm("Cancel this capture session? Recorded data will be discarded.")) actions.cancelSession();
        }}>Cancel</button>
        <span className="spacer" />
        <button
          className="btn primary"
          disabled={!canFinish}
          onClick={() => actions.finishSessionAndCompile()}
        >
          Finish →
        </button>
      </div>

      <div className="p-dim" style={{ marginTop: 10, fontSize: 12 }}>
        Tip — for the canonical scenario: open a product, add to cart, open cart, type <code>SAVE20</code>,
        tap {state.shop.driftEnabled ? "Use" : "Apply"}, continue to checkout, then retry.
      </div>
    </div>
  );
}
