import {create} from 'zustand';

type OperationPhase = 'idle' | 'capturing' | 'processing' | 'reviewing';

interface ActiveOperationState {
  phase: OperationPhase;
  sessionId: string | null;
  setPhase: (phase: OperationPhase) => void;
  setSessionId: (id: string | null) => void;
  reset: () => void;
}

export const useActiveOperationStore = create<ActiveOperationState>(set => ({
  phase: 'idle',
  sessionId: null,
  setPhase: (phase: OperationPhase) => set({phase}),
  setSessionId: (id: string | null) => set({sessionId: id}),
  reset: () => set({phase: 'idle', sessionId: null}),
}));
