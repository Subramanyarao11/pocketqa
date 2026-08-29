import { createContext, useContext } from "react";
import type {
  ApprovedTest,
  CaptureEvent,
  ReplayResult,
  TestDraft,
  UIState,
} from "./lib/schemas";
import type { ShopState } from "./demo-shop/model";

/**
 * Navigation is one flat stack — simpler than react-router for a
 * phone-shaped prototype.  Each screen owns its own state via the store.
 */
export type Screen =
  | "home"
  | "onboarding"
  | "intent"
  | "capture"
  | "review"
  | "replay"
  | "evidence"
  | "agent-lab"
  | "settings";

export interface ReadinessState {
  consentedAt: number | null;
  accessibilityEnabled: boolean;
  microphoneReady: boolean;
  onDeviceModel: "unavailable" | "ready";
  connectedSarvam: boolean;
  connectedOpenAI: boolean;
  offlineMode: boolean;
}

export interface SessionDraft {
  id: string;
  intent: string;
  packageName: string;
  events: CaptureEvent[];
  states: Record<string, UIState>;
  startedAt: number;
  paused: boolean;
  finishedAt?: number;
}

export interface StoredTest {
  approved: ApprovedTest;
  createdFromSessionId: string;
  lastRun?: ReplayResult;
}

export interface AppState {
  screen: Screen;
  readiness: ReadinessState;
  session: SessionDraft | null;
  draft: TestDraft | null;
  tests: StoredTest[];
  shop: ShopState;
  lastResult: ReplayResult | null;
  compileEngine: "deterministic-local" | "on-device-ai";
}

export interface AppActions {
  navigate(screen: Screen): void;
  setReadiness(patch: Partial<ReadinessState>): void;
  startSession(intent: string, packageName: string): void;
  addCaptureEvent(evt: CaptureEvent, before: UIState, after: UIState): void;
  pauseSession(): void;
  resumeSession(): void;
  cancelSession(): void;
  finishSessionAndCompile(): void;
  updateDraft(patch: Partial<TestDraft>): void;
  approveDraft(): void;
  discardDraft(): void;
  setShop(update: (s: ShopState) => ShopState): void;
  recordRun(run: ReplayResult): void;
  deleteAll(): void;
}

export const StoreContext = createContext<{
  state: AppState;
  actions: AppActions;
} | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store not mounted");
  return ctx;
}
