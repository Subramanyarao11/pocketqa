import { useCallback, useMemo, useState } from "react";
import { StoreContext, type AppActions, type AppState, type Screen } from "./store";
import { HomeScreen } from "./screens/HomeScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { IntentScreen } from "./screens/IntentScreen";
import { CaptureScreen } from "./screens/CaptureScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { ReplayScreen } from "./screens/ReplayScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { AgentLabScreen } from "./screens/AgentLabScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PhoneFrame } from "./components/PhoneFrame";
import { StageAside } from "./components/StageAside";
import { INITIAL_SHOP_STATE, reduceShop } from "./demo-shop/model";
import type { CaptureEvent, TestDraft, UIState, ApprovedTest, ReplayResult } from "./lib/schemas";
import { compileDraft } from "./lib/compiler";
import { djb2, nextId } from "./lib/ids";

const INITIAL_STATE: AppState = {
  screen: "home",
  readiness: {
    consentedAt: null,
    accessibilityEnabled: false,
    microphoneReady: false,
    onDeviceModel: "unavailable",
    connectedSarvam: false,
    connectedOpenAI: false,
    offlineMode: true,
  },
  session: null,
  draft: null,
  tests: [],
  shop: INITIAL_SHOP_STATE,
  lastResult: null,
  compileEngine: "deterministic-local",
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const actions: AppActions = useMemo(() => ({
    navigate(screen: Screen) {
      setState((s) => ({ ...s, screen }));
    },
    setReadiness(patch) {
      setState((s) => ({ ...s, readiness: { ...s.readiness, ...patch } }));
    },
    startSession(intent, packageName) {
      setState((s) => ({
        ...s,
        session: {
          id: nextId("sess"),
          intent,
          packageName,
          events: [],
          states: {},
          startedAt: Date.now(),
          paused: false,
        },
        shop: { ...INITIAL_SHOP_STATE, packageName },
      }));
    },
    addCaptureEvent(evt: CaptureEvent, before: UIState, after: UIState) {
      setState((s) => {
        if (!s.session || s.session.paused) return s;
        return {
          ...s,
          session: {
            ...s.session,
            events: [...s.session.events, evt],
            states: { ...s.session.states, [before.id]: before, [after.id]: after },
          },
        };
      });
    },
    pauseSession() { setState((s) => (s.session ? { ...s, session: { ...s.session, paused: true } } : s)); },
    resumeSession() { setState((s) => (s.session ? { ...s, session: { ...s.session, paused: false } } : s)); },
    cancelSession() { setState((s) => ({ ...s, session: null, screen: "home" })); },
    finishSessionAndCompile() {
      setState((s) => {
        if (!s.session) return s;
        const compiled = compileDraft({
          intent: s.session.intent,
          packageName: s.session.packageName,
          states: s.session.states,
          events: s.session.events,
          engine: s.compileEngine,
        });
        if (!compiled.ok) {
          return { ...s, screen: "review", draft: null };
        }
        return {
          ...s,
          screen: "review",
          draft: compiled.draft,
          session: { ...s.session, finishedAt: Date.now() },
        };
      });
    },
    updateDraft(patch: Partial<TestDraft>) {
      setState((s) => (s.draft ? { ...s, draft: { ...s.draft, ...patch } } : s));
    },
    approveDraft() {
      setState((s) => {
        if (!s.draft || !s.session) return s;
        const approved: ApprovedTest = {
          ...s.draft,
          schemaVersion: "pocketqa/approved-test@1",
          version: 1,
          approvedAt: Date.now(),
          schemaHash: djb2(JSON.stringify(s.draft)),
        };
        return {
          ...s,
          screen: "replay",
          tests: [
            { approved, createdFromSessionId: s.session.id },
            ...s.tests,
          ],
          draft: null,
        };
      });
    },
    discardDraft() { setState((s) => ({ ...s, draft: null, session: null, screen: "home" })); },
    setShop(update) { setState((s) => ({ ...s, shop: update(s.shop) })); },
    recordRun(run: ReplayResult) {
      setState((s) => {
        const idx = s.tests.findIndex((t) => t.approved.id === run.testId);
        if (idx === -1) return { ...s, lastResult: run };
        const tests = [...s.tests];
        tests[idx] = { ...tests[idx], lastRun: run };
        return { ...s, tests, lastResult: run };
      });
    },
    deleteAll() { setState(INITIAL_STATE); },
  }), []);

  const store = useMemo(() => ({ state, actions }), [state, actions]);

  // Deterministic shop reducer wiring for capture screen.
  const shopDispatch = useCallback(
    (a: import("./demo-shop/model").ShopAction) => actions.setShop((s) => reduceShop(s, a)),
    [actions]
  );

  return (
    <StoreContext.Provider value={store}>
      <div className="app-shell">
        <div className="phone-column">
          <PhoneFrame readiness={state.readiness}>
            {state.screen === "home" && <HomeScreen />}
            {state.screen === "onboarding" && <OnboardingScreen />}
            {state.screen === "intent" && <IntentScreen />}
            {state.screen === "capture" && <CaptureScreen shopDispatch={shopDispatch} />}
            {state.screen === "review" && <ReviewScreen />}
            {state.screen === "replay" && <ReplayScreen />}
            {state.screen === "evidence" && <EvidenceScreen />}
            {state.screen === "agent-lab" && <AgentLabScreen />}
            {state.screen === "settings" && <SettingsScreen />}
          </PhoneFrame>
        </div>
        <StageAside />
      </div>
    </StoreContext.Provider>
  );
}
