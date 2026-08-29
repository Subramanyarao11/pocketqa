import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { DemoShop } from "../demo-shop/DemoShop";
import { reduceShop, snapshotShop } from "../demo-shop/model";
import type { ShopAction, ShopState } from "../demo-shop/model";
import { ALLOWLISTED_PACKAGES } from "../lib/policy";
import type { Mission, MissionEvent } from "../lib/schemas";
import { runMission, type ExplorerProposal } from "../lib/explorer";
import { createWebHarness } from "../lib/harness";
import { nextId } from "../lib/ids";

const DEFAULT_MISSION: Mission = {
  id: "mission_default",
  goal: "Find a nearby checkout state we forgot to test after applying a coupon.",
  packageAllowlist: [ALLOWLISTED_PACKAGES[0]],
  maxActions: 3,
  maxDurationSeconds: 60,
  allowedTools: ["observe", "tapNode", "back", "waitForIdle", "stop"],
  hardStops: [
    "Payment or purchase controls",
    "Account or permissions",
    "Cross-package navigation",
    "Sensitive input fields",
  ],
};

export function AgentLabScreen() {
  const { state, actions } = useStore();
  const [mission, setMission] = useState<Mission>(DEFAULT_MISSION);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [proposal, setProposal] = useState<ExplorerProposal | null>(null);
  const [running, setRunning] = useState(false);
  const stopSignal = useRef<{ stopped: boolean }>({ stopped: false });
  const shopRef = useRef<ShopState>(state.shop);
  shopRef.current = state.shop;

  const dispatch = (a: ShopAction) => actions.setShop((s) => reduceShop(s, a));

  useEffect(() => {
    // For the demo, pre-seed the shop to "coupon applied on cart" so Explorer
    // has an interesting starting screen.
    actions.setShop((s: ShopState) => {
      let next: ShopState = { ...s, packageName: ALLOWLISTED_PACKAGES[0] };
      next = reduceShop(next, { type: "reset", fixture: "coupon-retry" });
      next = reduceShop(next, { type: "addToCart", productId: "sneakers" });
      next = reduceShop(next, { type: "openCart" });
      next = reduceShop(next, { type: "typeCoupon", value: "SAVE20" });
      next = reduceShop(next, { type: "applyCoupon" });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setEvents([]);
    setProposal(null);
    setRunning(true);
    stopSignal.current = { stopped: false };
    const harness = createWebHarness({
      getState: () => shopRef.current,
      setState: (s) => actions.setShop(() => s),
      delayMs: 350,
    });
    const { events: evs, proposal: p } = await runMission({ ...mission, id: nextId("mission") }, harness, {
      stopSignal: stopSignal.current,
      onEvent: (ev) => setEvents((list) => [...list, ev]),
    });
    if (evs) setEvents(evs);
    setProposal(p ?? null);
    setRunning(false);
  };

  const snapshot = snapshotShop(state.shop);

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
        <span className="screen-title">Agent Lab</span>
      </div>

      <div className="card danger">
        <div className="row-between">
          <div style={{ fontWeight: 600 }}>Experimental — internal build only</div>
          <span className="pill red">EXPLORER_LAB_ENABLED</span>
        </div>
        <div className="p-dim" style={{ marginTop: 6 }}>
          Explorer proposes actions inside a bounded mission. Payments, accounts,
          permissions, destructive actions, sensitive fields, system UI, and other
          apps are always blocked. Keep the Stop control visible.
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Mission — FR-EXP-002</div>
        <textarea
          className="textarea"
          value={mission.goal}
          onChange={(e) => setMission({ ...mission, goal: e.target.value })}
        />
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span className="pill lime">Allowlist: {mission.packageAllowlist.join(",")}</span>
          <span className="pill cyan">Actions ≤ {mission.maxActions}</span>
          <span className="pill cyan">Time ≤ {mission.maxDurationSeconds}s</span>
          <span className="pill dim">Tools: {mission.allowedTools.join(", ")}</span>
        </div>
        <div className="eyebrow" style={{ marginTop: 10 }}>Hard stops — FR-EXP-002</div>
        <ul className="list-clean p-dim" style={{ fontSize: 12 }}>
          {mission.hardStops.map((h) => (<li key={h}>• {h}</li>))}
        </ul>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button
            className="btn primary"
            disabled={running}
            onClick={start}
          >{running ? "Running…" : "Approve & start"}</button>
          <button
            className="btn danger"
            disabled={!running}
            onClick={() => { stopSignal.current.stopped = true; }}
          >■ Stop</button>
        </div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 10 }}>
        <div className="eyebrow">Live target</div>
        <DemoShop
          state={state.shop}
          dispatch={dispatch}
          interactive={false}
        />
        <div className="p-dim" style={{ marginTop: 8, fontSize: 12 }}>
          Baseline screen: <code>{snapshot.screenName}</code> · {snapshot.nodes.length} nodes visible.
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: 12 }}>Mission trace</div>
      <div className="card" style={{ maxHeight: 220, overflow: "auto" }}>
        {events.length === 0 && <div className="p-dim">Approve the mission to run.</div>}
        {events.map((ev, i) => (
          <div key={i} className={`log-line ${ev.kind === "policy-block" ? "fail" : ev.kind === "propose" ? "info" : ""}`}>
            [{ev.kind}] {ev.message}
          </div>
        ))}
      </div>

      {proposal && (
        <div className="card callout" style={{ marginTop: 10 }}>
          <div className="row-between">
            <div>
              <div style={{ fontWeight: 600 }}>Proposal — FR-EXP-006</div>
              <div className="p-dim" style={{ marginTop: 4 }}>{proposal.summary}</div>
            </div>
            <span className="pill violet">AI proposed</span>
          </div>
          <div className="eyebrow" style={{ marginTop: 10 }}>Candidate assertions</div>
          {proposal.candidateAssertions.map((a) => (
            <div key={a.id} className="p-dim" style={{ fontSize: 12 }}>• text visible: “{a.target}” — {a.reason}</div>
          ))}
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setProposal(null)}>Discard</button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => {
              alert("In the mobile build this would open Review for the candidate test. Nothing was added to your library.");
            }}>Open in review</button>
          </div>
        </div>
      )}
    </div>
  );
}
