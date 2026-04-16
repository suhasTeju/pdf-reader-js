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

export interface DebugEvent {
  id: string;
  timestamp: number;
  kind:
    | 'chunk'
    | 'llm-request'
    | 'llm-response'
    | 'llm-error'
    | 'storyboard-execute'
    | 'fallback-fired'
    | 'note';
  /** Short headline shown in the log */
  summary: string;
  /** Full payload (chunk text, raw LLM response, parsed storyboard, error, etc.) */
  payload?: unknown;
}

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
  debugEvents: DebugEvent[];
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
  appendDebugEvent: (event: Omit<DebugEvent, 'id' | 'timestamp'>) => void;
  clearDebugEvents: () => void;
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
  debugEvents: [],
};

const MAX_DEBUG_EVENTS = 50;
let debugEventCounter = 0;

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

    appendDebugEvent: (event) =>
      set((state) => {
        debugEventCounter += 1;
        const next: DebugEvent = {
          ...event,
          id: `dbg-${debugEventCounter}`,
          timestamp: Date.now(),
        };
        return {
          debugEvents: [
            ...state.debugEvents.slice(-(MAX_DEBUG_EVENTS - 1)),
            next,
          ],
        };
      }),

    clearDebugEvents: () => set({ debugEvents: [] }),

    reset: () => set(initialState),
  }));
}

export type NarrationStoreApi = ReturnType<typeof createNarrationStore>;

let overlayIdCounter = 0;
export function makeOverlayId(action: StoryboardAction): string {
  overlayIdCounter += 1;
  return `ov-${action.type}-${overlayIdCounter}-${Date.now()}`;
}
