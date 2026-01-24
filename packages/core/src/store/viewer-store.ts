import { createStore } from 'zustand/vanilla';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ViewerState, ViewerActions, ViewMode, Theme, SidebarPanel, ScrollMode } from '../types';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const SCROLL_TIMEOUT_MS = 3000;

export type ViewerStore = ViewerState & ViewerActions;

// Map to hold Promise resolvers for scroll requests
const scrollCallbacks = new Map<string, { resolve: () => void; timeoutId: ReturnType<typeof setTimeout> }>();

// Generate unique request ID
let requestCounter = 0;
function generateRequestId(): string {
  return `scroll-${Date.now()}-${++requestCounter}`;
}

const initialState: ViewerState = {
  // Document state
  document: null,
  numPages: 0,
  isLoading: false,
  error: null,

  // Navigation state
  currentPage: 1,
  scale: 1.0,
  rotation: 0,

  // Scroll coordination
  scrollToPageRequest: null,

  // UI state
  viewMode: 'single',
  scrollMode: 'single',
  theme: 'light',
  sidebarOpen: false,
  sidebarPanel: 'thumbnails',

  // Feature states
  isFullscreen: false,
  isPresentationMode: false,
};

export function createViewerStore(initialOverrides: Partial<ViewerState> = {}) {
  return createStore<ViewerStore>()((set, get) => ({
    ...initialState,
    ...initialOverrides,

    // Document actions
    setDocument: (document: PDFDocumentProxy | null) => {
      if (document) {
        set({
          document,
          numPages: document.numPages,
          isLoading: false,
          error: null,
          currentPage: 1,
        });
      } else {
        set({
          document: null,
          numPages: 0,
          isLoading: false,
        });
      }
    },

    setLoading: (isLoading: boolean) => {
      set({ isLoading });
    },

    setError: (error: Error | null) => {
      set({ error, isLoading: false });
    },

    // Navigation actions
    setCurrentPage: (page: number) => {
      const { numPages } = get();
      if (page >= 1 && page <= numPages) {
        set({ currentPage: page });
      }
    },

    goToPage: (page: number) => {
      const { numPages } = get();
      const validPage = Math.max(1, Math.min(page, numPages));
      set({ currentPage: validPage });
    },

    nextPage: () => {
      const { currentPage, numPages } = get();
      if (currentPage < numPages) {
        set({ currentPage: currentPage + 1 });
      }
    },

    previousPage: () => {
      const { currentPage } = get();
      if (currentPage > 1) {
        set({ currentPage: currentPage - 1 });
      }
    },

    // Scroll coordination actions
    requestScrollToPage: (page: number, behavior: 'smooth' | 'instant' = 'smooth') => {
      const { numPages } = get();
      const validPage = Math.max(1, Math.min(page, numPages));

      return new Promise<void>((resolve) => {
        const requestId = generateRequestId();

        // Set up timeout fallback
        const timeoutId = setTimeout(() => {
          const callback = scrollCallbacks.get(requestId);
          if (callback) {
            scrollCallbacks.delete(requestId);
            callback.resolve();
          }
          // Clear the request if it's still pending
          const currentRequest = get().scrollToPageRequest;
          if (currentRequest?.requestId === requestId) {
            set({ scrollToPageRequest: null });
          }
        }, SCROLL_TIMEOUT_MS);

        // Store the callback
        scrollCallbacks.set(requestId, { resolve, timeoutId });

        // Set the scroll request and update current page
        set({
          currentPage: validPage,
          scrollToPageRequest: {
            page: validPage,
            requestId,
            behavior,
          },
        });
      });
    },

    completeScrollRequest: (requestId: string) => {
      const callback = scrollCallbacks.get(requestId);
      if (callback) {
        clearTimeout(callback.timeoutId);
        scrollCallbacks.delete(requestId);
        callback.resolve();
      }

      // Clear the request if it matches
      const currentRequest = get().scrollToPageRequest;
      if (currentRequest?.requestId === requestId) {
        set({ scrollToPageRequest: null });
      }
    },

    // Zoom actions
    setScale: (scale: number) => {
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      set({ scale: clampedScale });
    },

    zoomIn: () => {
      const { scale } = get();
      const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
      const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
      set({ scale: ZOOM_LEVELS[nextIndex] ?? MAX_SCALE });
    },

    zoomOut: () => {
      const { scale } = get();
      const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
      const prevIndex = Math.max(currentIndex - 1, 0);
      set({ scale: ZOOM_LEVELS[prevIndex] ?? MIN_SCALE });
    },

    fitToWidth: () => {
      // This will be calculated by the component based on container width
      // For now, just set a reasonable default
      set({ scale: 1.0 });
    },

    fitToPage: () => {
      // This will be calculated by the component based on container size
      // For now, just set a reasonable default
      set({ scale: 1.0 });
    },

    // Rotation actions
    setRotation: (rotation: number) => {
      // Normalize rotation to 0, 90, 180, or 270
      const normalizedRotation = ((rotation % 360) + 360) % 360;
      set({ rotation: normalizedRotation });
    },

    rotateClockwise: () => {
      const { rotation } = get();
      set({ rotation: (rotation + 90) % 360 });
    },

    rotateCounterClockwise: () => {
      const { rotation } = get();
      set({ rotation: (rotation - 90 + 360) % 360 });
    },

    // UI actions
    setViewMode: (viewMode: ViewMode) => {
      set({ viewMode });
    },

    setScrollMode: (scrollMode: ScrollMode) => {
      set({ scrollMode });
    },

    setTheme: (theme: Theme) => {
      set({ theme });
    },

    toggleSidebar: () => {
      const { sidebarOpen } = get();
      set({ sidebarOpen: !sidebarOpen });
    },

    setSidebarPanel: (sidebarPanel: SidebarPanel) => {
      set({ sidebarPanel, sidebarOpen: sidebarPanel !== null });
    },

    setFullscreen: (isFullscreen: boolean) => {
      set({ isFullscreen });
    },

    // Reset
    reset: () => {
      const { document } = get();
      if (document) {
        document.destroy();
      }
      set(initialState);
    },
  }));
}

// Type for the store
export type ViewerStoreApi = ReturnType<typeof createViewerStore>;
