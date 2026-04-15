import { createStore } from 'zustand/vanilla';
import type {
  CameraState,
  ActiveOverlay,
  Storyboard,
  StoryboardAction,
} from '../types/storyboard';

export interface ChunkHistoryEntry {
  text: string;
  pageNumber: number;
  timestamp: number;
}

export type EngineStatus = 'idle' | 'transitioning' | 'executing';
export type LlmStatus = 'idle' | 'in-flight' | 'failed';

export interface NarrationState {
  currentChunk: string | null;
  currentPage: number;
  chunkHistory: ChunkHistoryEntry[];
  camera: CameraState;
  activeOverlays: ActiveOverlay[];
  engineStatus: EngineStatus;
  llmStatus: LlmStatus;
  lastStoryboard: Storyboard | null;
  lastError: string | null;
  isPaused: boolean;
}

export interface NarrationActions {
  setCurrentChunk: (chunk: string | null) => void;
  setCurrentPage: (page: number) => void;
  pushChunkHistory: (entry: ChunkHistoryEntry) => void;
  setCamera: (camera: Partial<CameraState>) => void;
  addOverlay: (overlay: ActiveOverlay) => void;
  removeOverlay: (id: string) => void;
  clearOverlays: (predicate?: (o: ActiveOverlay) => boolean) => void;
  setEngineStatus: (s: EngineStatus) => void;
  setLlmStatus: (s: LlmStatus, error?: string | null) => void;
  setLastStoryboard: (sb: Storyboard | null) => void;
  setPaused: (paused: boolean) => void;
  reset: () => void;
}

export type NarrationStore = NarrationState & NarrationActions;

const MAX_HISTORY = 5;

const initialState: NarrationState = {
  currentChunk: null,
  currentPage: 1,
  chunkHistory: [],
  camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
  activeOverlays: [],
  engineStatus: 'idle',
  llmStatus: 'idle',
  lastStoryboard: null,
  lastError: null,
  isPaused: false,
};

export function createNarrationStore(overrides: Partial<NarrationState> = {}) {
  return createStore<NarrationStore>()((set) => ({
    ...initialState,
    ...overrides,

    setCurrentChunk: (chunk) => set({ currentChunk: chunk }),
    setCurrentPage: (page) => set({ currentPage: page }),

    pushChunkHistory: (entry) =>
      set((state) => ({
        chunkHistory: [
          ...state.chunkHistory.slice(-(MAX_HISTORY - 1)),
          entry,
        ],
      })),

    setCamera: (camera) =>
      set((state) => ({ camera: { ...state.camera, ...camera } })),

    addOverlay: (overlay) =>
      set((state) => ({ activeOverlays: [...state.activeOverlays, overlay] })),

    removeOverlay: (id) =>
      set((state) => ({
        activeOverlays: state.activeOverlays.filter((o) => o.id !== id),
      })),

    clearOverlays: (predicate) =>
      set((state) => ({
        activeOverlays: predicate
          ? state.activeOverlays.filter((o) => !predicate(o))
          : [],
      })),

    setEngineStatus: (s) => set({ engineStatus: s }),

    setLlmStatus: (s, error = null) =>
      set({ llmStatus: s, lastError: error }),

    setLastStoryboard: (sb) => set({ lastStoryboard: sb }),

    setPaused: (paused) => set({ isPaused: paused }),

    reset: () => set(initialState),
  }));
}

export type NarrationStoreApi = ReturnType<typeof createNarrationStore>;

let overlayIdCounter = 0;
export function makeOverlayId(action: StoryboardAction): string {
  overlayIdCounter += 1;
  return `ov-${action.type}-${overlayIdCounter}-${Date.now()}`;
}
