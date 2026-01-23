import { createStore } from 'zustand/vanilla';
import type { AgentState, AgentActions, AgentContext, FocusedRegion } from '../types/agent-context';

export type AgentStore = AgentState & AgentActions;

const initialState: AgentState = {
  currentContext: null,
  focusedRegions: [],
};

let focusRegionIdCounter = 0;

function generateFocusRegionId(): string {
  return `focus-region-${++focusRegionIdCounter}-${Date.now()}`;
}

export function createAgentStore(initialOverrides: Partial<AgentState> = {}) {
  return createStore<AgentStore>()((set, get) => ({
    ...initialState,
    ...initialOverrides,

    setAgentContext: (context: Partial<AgentContext>) => {
      const { currentContext } = get();
      set({
        currentContext: {
          ...currentContext,
          ...context,
          timestamp: context.timestamp ?? new Date(),
        } as AgentContext,
      });
    },

    clearAgentContext: () => {
      set({ currentContext: null });
    },

    addFocusedRegion: (region: Omit<FocusedRegion, 'id'>) => {
      const id = generateFocusRegionId();
      const focusedRegion: FocusedRegion = {
        ...region,
        id,
        style: region.style ?? 'pulse',
      };

      set((state) => ({
        focusedRegions: [...state.focusedRegions, focusedRegion],
      }));

      // Set up auto-clear if timeout is specified
      if (region.autoClearTimeout && region.autoClearTimeout > 0) {
        setTimeout(() => {
          const { removeFocusedRegion } = get();
          removeFocusedRegion(id);
        }, region.autoClearTimeout);
      }

      return id;
    },

    removeFocusedRegion: (id: string) => {
      set((state) => ({
        focusedRegions: state.focusedRegions.filter((r) => r.id !== id),
      }));
    },

    clearAllFocusedRegions: () => {
      set({ focusedRegions: [] });
    },

    reset: () => {
      set(initialState);
    },
  }));
}

export type AgentStoreApi = ReturnType<typeof createAgentStore>;
