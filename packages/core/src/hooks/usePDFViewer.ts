import { useCallback, useMemo } from 'react';
import { useViewerStore, useAnnotationStore, useSearchStore, usePDFViewerStores } from './PDFViewerContext';
import type { Theme, ViewMode, SidebarPanel, HighlightColor, Highlight } from '../types';

type AddHighlightParams = Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Main unified hook for accessing PDF viewer state and actions.
 * This is the primary API for controlling the viewer.
 */
export function usePDFViewer() {
  const { viewerStore, annotationStore, searchStore } = usePDFViewerStores();

  // ============================================================================
  // Viewer State
  // ============================================================================

  const document = useViewerStore((s) => s.document);
  const numPages = useViewerStore((s) => s.numPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const scale = useViewerStore((s) => s.scale);
  const rotation = useViewerStore((s) => s.rotation);
  const isLoading = useViewerStore((s) => s.isLoading);
  const error = useViewerStore((s) => s.error);
  const theme = useViewerStore((s) => s.theme);
  const viewMode = useViewerStore((s) => s.viewMode);
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const sidebarPanel = useViewerStore((s) => s.sidebarPanel);
  const isFullscreen = useViewerStore((s) => s.isFullscreen);

  // ============================================================================
  // Annotation State
  // ============================================================================

  const highlights = useAnnotationStore((s) => s.highlights);
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const activeHighlightColor = useAnnotationStore((s) => s.activeHighlightColor);
  const isHighlightMode = useAnnotationStore((s) => s.isHighlightMode);

  // ============================================================================
  // Search State
  // ============================================================================

  const searchQuery = useSearchStore((s) => s.query);
  const searchResults = useSearchStore((s) => s.results);
  const currentSearchResult = useSearchStore((s) => s.currentResultIndex);
  const isSearching = useSearchStore((s) => s.isSearching);

  // ============================================================================
  // Navigation Actions
  // ============================================================================

  const goToPage = useCallback(
    (page: number) => viewerStore.getState().goToPage(page),
    [viewerStore]
  );

  const nextPage = useCallback(
    () => viewerStore.getState().nextPage(),
    [viewerStore]
  );

  const previousPage = useCallback(
    () => viewerStore.getState().previousPage(),
    [viewerStore]
  );

  // ============================================================================
  // Zoom Actions
  // ============================================================================

  const setScale = useCallback(
    (newScale: number) => viewerStore.getState().setScale(newScale),
    [viewerStore]
  );

  const zoomIn = useCallback(
    () => viewerStore.getState().zoomIn(),
    [viewerStore]
  );

  const zoomOut = useCallback(
    () => viewerStore.getState().zoomOut(),
    [viewerStore]
  );

  const fitToWidth = useCallback(
    () => viewerStore.getState().fitToWidth(),
    [viewerStore]
  );

  const fitToPage = useCallback(
    () => viewerStore.getState().fitToPage(),
    [viewerStore]
  );

  // ============================================================================
  // Rotation Actions
  // ============================================================================

  const rotateClockwise = useCallback(
    () => viewerStore.getState().rotateClockwise(),
    [viewerStore]
  );

  const rotateCounterClockwise = useCallback(
    () => viewerStore.getState().rotateCounterClockwise(),
    [viewerStore]
  );

  // ============================================================================
  // UI Actions
  // ============================================================================

  const setTheme = useCallback(
    (newTheme: Theme) => viewerStore.getState().setTheme(newTheme),
    [viewerStore]
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => viewerStore.getState().setViewMode(mode),
    [viewerStore]
  );

  const toggleSidebar = useCallback(
    () => viewerStore.getState().toggleSidebar(),
    [viewerStore]
  );

  const setSidebarPanel = useCallback(
    (panel: SidebarPanel) => viewerStore.getState().setSidebarPanel(panel),
    [viewerStore]
  );

  const setFullscreen = useCallback(
    (fullscreen: boolean) => viewerStore.getState().setFullscreen(fullscreen),
    [viewerStore]
  );

  // ============================================================================
  // Highlight Actions
  // ============================================================================

  const addHighlight = useCallback(
    (highlight: AddHighlightParams) =>
      annotationStore.getState().addHighlight(highlight),
    [annotationStore]
  );

  const removeHighlight = useCallback(
    (id: string) => annotationStore.getState().removeHighlight(id),
    [annotationStore]
  );

  const setActiveHighlightColor = useCallback(
    (color: HighlightColor) => annotationStore.getState().setActiveHighlightColor(color),
    [annotationStore]
  );

  const setHighlightMode = useCallback(
    (enabled: boolean) => annotationStore.getState().setHighlightMode(enabled),
    [annotationStore]
  );

  // ============================================================================
  // Search Actions
  // ============================================================================

  const search = useCallback(
    async (query: string) => {
      const doc = viewerStore.getState().document;
      if (!doc) return;
      searchStore.getState().setQuery(query);
      await searchStore.getState().search(doc);
    },
    [viewerStore, searchStore]
  );

  const clearSearch = useCallback(
    () => searchStore.getState().clearSearch(),
    [searchStore]
  );

  const nextSearchResult = useCallback(
    () => searchStore.getState().nextResult(),
    [searchStore]
  );

  const previousSearchResult = useCallback(
    () => searchStore.getState().previousResult(),
    [searchStore]
  );

  // ============================================================================
  // Return API
  // ============================================================================

  return useMemo(
    () => ({
      // Document state
      document,
      numPages,
      isLoading,
      error,

      // Navigation
      currentPage,
      goToPage,
      nextPage,
      previousPage,

      // Zoom
      scale,
      setScale,
      zoomIn,
      zoomOut,
      fitToWidth,
      fitToPage,

      // Rotation
      rotation,
      rotateClockwise,
      rotateCounterClockwise,

      // Theme & UI
      theme,
      setTheme,
      viewMode,
      setViewMode,
      sidebarOpen,
      toggleSidebar,
      sidebarPanel,
      setSidebarPanel,
      isFullscreen,
      setFullscreen,

      // Highlights
      highlights,
      selectedHighlightId,
      activeHighlightColor,
      isHighlightMode,
      addHighlight,
      removeHighlight,
      setActiveHighlightColor,
      setHighlightMode,

      // Annotations
      annotations,

      // Search
      searchQuery,
      searchResults,
      currentSearchResult,
      isSearching,
      search,
      clearSearch,
      nextSearchResult,
      previousSearchResult,
    }),
    [
      document,
      numPages,
      isLoading,
      error,
      currentPage,
      goToPage,
      nextPage,
      previousPage,
      scale,
      setScale,
      zoomIn,
      zoomOut,
      fitToWidth,
      fitToPage,
      rotation,
      rotateClockwise,
      rotateCounterClockwise,
      theme,
      setTheme,
      viewMode,
      setViewMode,
      sidebarOpen,
      toggleSidebar,
      sidebarPanel,
      setSidebarPanel,
      isFullscreen,
      setFullscreen,
      highlights,
      selectedHighlightId,
      activeHighlightColor,
      isHighlightMode,
      addHighlight,
      removeHighlight,
      setActiveHighlightColor,
      setHighlightMode,
      annotations,
      searchQuery,
      searchResults,
      currentSearchResult,
      isSearching,
      search,
      clearSearch,
      nextSearchResult,
      previousSearchResult,
    ]
  );
}
