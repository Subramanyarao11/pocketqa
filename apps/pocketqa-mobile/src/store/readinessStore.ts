import { create } from "zustand";
import { PocketQaNative, type DeviceReadiness } from "@native";

interface ReadinessState {
  readiness?: DeviceReadiness;
  loading: boolean;
  checkedAt?: string;
  refresh(): Promise<void>;
  clear(): void;
}

export const useReadinessStore = create<ReadinessState>((set) => ({
  loading: false,
  async refresh() {
    set({ loading: true });
    try {
      const readiness = await PocketQaNative.getReadiness();
      set({ readiness, loading: false, checkedAt: new Date().toISOString() });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("readiness refresh failed", err);
      set({ loading: false });
    }
  },
  clear() { set({ readiness: undefined, checkedAt: undefined }); },
}));
