import { create } from "zustand";

interface SettingsState {
  reduceEvidenceThumbnails: boolean;
  defaultRetentionDays: number;
  preferredIntentMode: "typed" | "voice";
  agentLabVisible: boolean;
  set: (patch: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  reduceEvidenceThumbnails: false,
  defaultRetentionDays: 30,
  preferredIntentMode: "typed",
  agentLabVisible: true,
  set: (patch) => set(patch),
}));
