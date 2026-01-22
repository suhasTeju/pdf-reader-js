import { createContext, useContext, useRef, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createViewerStore,
  createAnnotationStore,
  createSearchStore,
  type ViewerStoreApi,
  type AnnotationStoreApi,
  type SearchStoreApi,
  type ViewerStore,
  type AnnotationStore,
  type SearchStore,
  type AnnotationState,
} from '../store';
import type { ViewerState, SearchState, Theme, SidebarPanel } from '../types';

// ============================================================================
// Context Types
// ============================================================================

export interface PDFViewerContextValue {
  viewerStore: ViewerStoreApi;
  annotationStore: AnnotationStoreApi;
  searchStore: SearchStoreApi;
}

export interface PDFViewerProviderProps {
  children: ReactNode;
  initialState?: {
    viewer?: Partial<ViewerState>;
    annotation?: Partial<AnnotationState>;
    search?: Partial<SearchState>;
  };
  theme?: Theme;
  defaultSidebarPanel?: SidebarPanel;
}

// ============================================================================
// Context
// ============================================================================

const PDFViewerContext = createContext<PDFViewerContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function PDFViewerProvider({
  children,
  initialState,
  theme = 'light',
  defaultSidebarPanel = 'thumbnails',
}: PDFViewerProviderProps) {
  const viewerStoreRef = useRef<ViewerStoreApi | null>(null);
  const annotationStoreRef = useRef<AnnotationStoreApi | null>(null);
  const searchStoreRef = useRef<SearchStoreApi | null>(null);

  // Create stores only once
  if (!viewerStoreRef.current) {
    viewerStoreRef.current = createViewerStore({
      ...initialState?.viewer,
      theme,
      sidebarPanel: defaultSidebarPanel,
    });
  }

  if (!annotationStoreRef.current) {
    annotationStoreRef.current = createAnnotationStore(initialState?.annotation);
  }

  if (!searchStoreRef.current) {
    searchStoreRef.current = createSearchStore(initialState?.search);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      viewerStoreRef.current?.getState().reset();
    };
  }, []);

  return (
    <PDFViewerContext.Provider
      value={{
        viewerStore: viewerStoreRef.current,
        annotationStore: annotationStoreRef.current,
        searchStore: searchStoreRef.current,
      }}
    >
      {children}
    </PDFViewerContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

function usePDFViewerContext() {
  const context = useContext(PDFViewerContext);
  if (!context) {
    throw new Error('usePDFViewerContext must be used within a PDFViewerProvider');
  }
  return context;
}

/**
 * Hook to access the viewer store.
 * Optionally pass a selector to subscribe to specific state.
 */
export function useViewerStore<T>(selector: (state: ViewerStore) => T): T {
  const { viewerStore } = usePDFViewerContext();
  return useStore(viewerStore, selector);
}

/**
 * Hook to access the annotation store.
 * Optionally pass a selector to subscribe to specific state.
 */
export function useAnnotationStore<T>(selector: (state: AnnotationStore) => T): T {
  const { annotationStore } = usePDFViewerContext();
  return useStore(annotationStore, selector);
}

/**
 * Hook to access the search store.
 * Optionally pass a selector to subscribe to specific state.
 */
export function useSearchStore<T>(selector: (state: SearchStore) => T): T {
  const { searchStore } = usePDFViewerContext();
  return useStore(searchStore, selector);
}

/**
 * Hook to access all stores directly (for actions).
 */
export function usePDFViewerStores() {
  return usePDFViewerContext();
}

export { PDFViewerContext };
