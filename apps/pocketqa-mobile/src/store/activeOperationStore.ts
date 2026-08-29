import { create } from "zustand";
import type {
  CaptureProgress,
  CompileProgress,
  MissionProgress,
  PocketQaEvent,
  ReplayProgress,
} from "@native";
import { PocketQaNative } from "@native";

export type ActiveOperation =
  | { kind: "CAPTURE"; id: string; progress?: CaptureProgress }
  | { kind: "COMPILE"; id: string; progress?: CompileProgress }
  | { kind: "REPLAY"; id: string; progress?: ReplayProgress }
  | { kind: "MISSION"; id: string; progress?: MissionProgress };

interface ActiveOperationState {
  active?: ActiveOperation;
  hydrate(): Promise<void>;
  applyEvent(event: PocketQaEvent): void;
  setActive(op: ActiveOperation | undefined): void;
  clearIfTerminal(): void;
}

export const useActiveOperationStore = create<ActiveOperationState>((set, get) => ({
  async hydrate() {
    const state = await PocketQaNative.getStartupState();
    if (state.activeOperation) {
      set({ active: { ...state.activeOperation } as ActiveOperation });
    }
  },
  applyEvent(event) {
    const active = get().active;
    switch (event.type) {
      case "CAPTURE_PROGRESS":
        set({ active: { kind: "CAPTURE", id: event.payload.sessionId, progress: event.payload } });
        break;
      case "CAPTURE_HARD_STOP":
        set({ active: undefined });
        break;
      case "COMPILE_PROGRESS":
        set({ active: { kind: "COMPILE", id: event.payload.jobId, progress: event.payload } });
        break;
      case "COMPILE_FINISHED":
        if (active?.kind === "COMPILE" && active.id === event.payload.jobId) set({ active: undefined });
        break;
      case "REPLAY_PROGRESS":
        set({ active: { kind: "REPLAY", id: event.payload.runId, progress: event.payload } });
        break;
      case "REPLAY_FINISHED":
        set({ active: undefined });
        break;
      case "MISSION_PROGRESS":
        set({ active: { kind: "MISSION", id: event.payload.missionId, progress: event.payload } });
        break;
      case "MISSION_FINISHED":
        set({ active: undefined });
        break;
      default: break;
    }
  },
  setActive(op) { set({ active: op }); },
  clearIfTerminal() { set({ active: undefined }); },
}));
