import {create} from 'zustand';

interface SettingsState {
  aiLabUrl: string;
  setAiLabUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  aiLabUrl: 'http://localhost:8000',
  setAiLabUrl: (url: string) => set({aiLabUrl: url}),
}));
