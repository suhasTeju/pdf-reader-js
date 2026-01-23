import { useCallback, useMemo } from 'react';
import {
  useViewerStore,
  useAnnotationStore,
  useSearchStore,
  useAgentStore,
  useStudentStore,
  usePDFViewerStores,
} from './PDFViewerContext';
import type { Theme, ViewMode, SidebarPanel, HighlightColor, Highlight } from '../types';
import type {
  AgentContext,
  FocusedRegion,
  Bookmark,
  QuickNote,
  Takeaway,
  AgentAPI,
  AgentHighlightParams,
} from '../types/agent-context';

type AddHighlightParams = Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Main unified hook for accessing PDF viewer state and actions.
 * This is the primary API for controlling the viewer.
 */
export function usePDFViewer() {
  const { viewerStore, annotationStore, searchStore, agentStore, studentStore } = usePDFViewerStores();

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
  // Agent Context State & Actions
  // ============================================================================

  const agentContext = useAgentStore((s) => s.currentContext);
  const focusedRegions = useAgentStore((s) => s.focusedRegions);

  const setAgentContext = useCallback(
    (context: Partial<AgentContext>) => agentStore.getState().setAgentContext(context),
    [agentStore]
  );

  const clearAgentContext = useCallback(
    () => agentStore.getState().clearAgentContext(),
    [agentStore]
  );

  const focusRegion = useCallback(
    (region: Omit<FocusedRegion, 'id'>) => agentStore.getState().addFocusedRegion(region),
    [agentStore]
  );

  const clearFocusedRegion = useCallback(
    (id: string) => agentStore.getState().removeFocusedRegion(id),
    [agentStore]
  );

  const clearAllFocusedRegions = useCallback(
    () => agentStore.getState().clearAllFocusedRegions(),
    [agentStore]
  );

  // ============================================================================
  // Student State & Actions
  // ============================================================================

  const bookmarks = useStudentStore((s) => s.bookmarks);
  const quickNotes = useStudentStore((s) => s.quickNotes);
  const takeaways = useStudentStore((s) => s.takeaways);
  const visitedPages = useStudentStore((s) => s.visitedPages);
  const progress = useStudentStore((s) => s.progress);

  const addBookmark = useCallback(
    (data: Omit<Bookmark, 'id' | 'timestamp'>) => {
      // Capture agent context when bookmarking
      const context = agentStore.getState().currentContext;
      return studentStore.getState().addBookmark({
        ...data,
        agentContext: data.agentContext ?? context?.lastStatement,
      });
    },
    [studentStore, agentStore]
  );

  const updateBookmark = useCallback(
    (id: string, updates: Partial<Omit<Bookmark, 'id'>>) =>
      studentStore.getState().updateBookmark(id, updates),
    [studentStore]
  );

  const removeBookmark = useCallback(
    (id: string) => studentStore.getState().removeBookmark(id),
    [studentStore]
  );

  const addQuickNote = useCallback(
    (data: Omit<QuickNote, 'id' | 'timestamp'>) => {
      // Capture agent context when adding note
      const context = agentStore.getState().currentContext;
      return studentStore.getState().addQuickNote({
        ...data,
        agentLastStatement: data.agentLastStatement ?? context?.lastStatement,
      });
    },
    [studentStore, agentStore]
  );

  const updateQuickNote = useCallback(
    (id: string, updates: Partial<Omit<QuickNote, 'id'>>) =>
      studentStore.getState().updateQuickNote(id, updates),
    [studentStore]
  );

  const removeQuickNote = useCallback(
    (id: string) => studentStore.getState().removeQuickNote(id),
    [studentStore]
  );

  const addTakeaway = useCallback(
    (data: Omit<Takeaway, 'id' | 'timestamp'>) => studentStore.getState().addTakeaway(data),
    [studentStore]
  );

  const removeTakeaway = useCallback(
    (id: string) => studentStore.getState().removeTakeaway(id),
    [studentStore]
  );

  const markPageVisited = useCallback(
    (pageNumber: number) => studentStore.getState().markPageVisited(pageNumber),
    [studentStore]
  );

  // ============================================================================
  // Agent API Factory
  // ============================================================================

  const getAgentAPI = useCallback((): AgentAPI => {
    return {
      focusRegion: (region: Omit<FocusedRegion, 'id'>) => {
        return agentStore.getState().addFocusedRegion(region);
      },
      clearFocusedRegion: (id?: string) => {
        if (id) {
          agentStore.getState().removeFocusedRegion(id);
        } else {
          agentStore.getState().clearAllFocusedRegions();
        }
      },
      addTakeaway: (pageNumber: number, summary: string, metadata?: Record<string, unknown>) => {
        return studentStore.getState().addTakeaway({
          pageNumber,
          summary,
          source: 'agent',
          metadata,
        });
      },
      setAgentContext: (context: Partial<AgentContext>) => {
        agentStore.getState().setAgentContext(context);
      },
      addAgentHighlight: (params: AgentHighlightParams) => {
        const highlight = annotationStore.getState().addHighlight({
          pageNumber: params.pageNumber,
          rects: params.rects,
          text: params.text,
          color: params.color ?? 'blue',
          comment: params.comment,
          source: 'agent',
        });
        return highlight.id;
      },
      goToPage: (pageNumber: number) => {
        viewerStore.getState().goToPage(pageNumber);
      },
      getCurrentPage: () => viewerStore.getState().currentPage,
      getAgentContext: () => agentStore.getState().currentContext,
    };
  }, [agentStore, studentStore, annotationStore, viewerStore]);

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

      // Agent Context (Student Mode)
      agentContext,
      setAgentContext,
      clearAgentContext,
      focusedRegions,
      focusRegion,
      clearFocusedRegion,
      clearAllFocusedRegions,
      getAgentAPI,

      // Bookmarks (Student Mode)
      bookmarks,
      addBookmark,
      updateBookmark,
      removeBookmark,

      // Quick Notes (Student Mode)
      quickNotes,
      addQuickNote,
      updateQuickNote,
      removeQuickNote,

      // Takeaways (Student Mode)
      takeaways,
      addTakeaway,
      removeTakeaway,

      // Progress (Student Mode)
      visitedPages,
      progress,
      markPageVisited,
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
      agentContext,
      setAgentContext,
      clearAgentContext,
      focusedRegions,
      focusRegion,
      clearFocusedRegion,
      clearAllFocusedRegions,
      getAgentAPI,
      bookmarks,
      addBookmark,
      updateBookmark,
      removeBookmark,
      quickNotes,
      addQuickNote,
      updateQuickNote,
      removeQuickNote,
      takeaways,
      addTakeaway,
      removeTakeaway,
      visitedPages,
      progress,
      markPageVisited,
    ]
  );
}
