import {create} from 'zustand';

interface ReadinessState {
  isAccessibilityEnabled: boolean;
  isAiLabReachable: boolean;
  setAccessibilityEnabled: (enabled: boolean) => void;
  setAiLabReachable: (reachable: boolean) => void;
}

export const useReadinessStore = create<ReadinessState>(set => ({
  isAccessibilityEnabled: false,
  isAiLabReachable: false,
  setAccessibilityEnabled: (enabled: boolean) =>
    set({isAccessibilityEnabled: enabled}),
  setAiLabReachable: (reachable: boolean) =>
    set({isAiLabReachable: reachable}),
}));
