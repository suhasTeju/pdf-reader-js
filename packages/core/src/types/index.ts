import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// ============================================================================
// Core Types
// ============================================================================

export interface PDFViewerProps {
  /** URL or ArrayBuffer of the PDF file */
  src: string | ArrayBuffer | Uint8Array;
  /** Initial page number (1-indexed) - used in uncontrolled mode */
  initialPage?: number;
  /** Controlled page - viewer syncs to this value when provided */
  page?: number;
  /** Initial scale/zoom level. Use 'auto' or 'page-width' to fit to container width. */
  initialScale?: number | 'page-fit' | 'page-width' | 'auto';
  /** Theme mode */
  theme?: 'light' | 'dark' | 'sepia';
  /** Custom class name */
  className?: string;
  /** Whether to show the toolbar (default: true) */
  showToolbar?: boolean;
  /** Whether to show the sidebar (default: true) */
  showSidebar?: boolean;
  /** Whether to show the annotation toolbar (default: false) */
  showAnnotationToolbar?: boolean;
  /** Whether to show floating zoom controls (default: true) */
  showFloatingZoom?: boolean;
  /** Default sidebar panel */
  defaultSidebarPanel?: SidebarPanel;
  /** View mode for the document */
  viewMode?: ViewMode;
  /** Callback when document is loaded */
  onDocumentLoad?: (document: PDFDocumentLoadedEvent) => void;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when scale/zoom changes */
  onScaleChange?: (scale: number) => void;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Worker source URL for pdf.js */
  workerSrc?: string;
  /** Callback when a page starts rendering */
  onPageRenderStart?: (pageNumber: number) => void;
  /** Callback when a page finishes rendering */
  onPageRenderComplete?: (pageNumber: number) => void;
  /** Callback when a highlight is added */
  onHighlightAdded?: (highlight: Highlight) => void;
  /** Callback when a highlight is removed */
  onHighlightRemoved?: (highlightId: string) => void;
  /** Callback when an annotation is added */
  onAnnotationAdded?: (annotation: Annotation) => void;
  /** Callback when zoom/scale changes (alias for onScaleChange) */
  onZoomChange?: (scale: number) => void;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component - can be a node or a function receiving error and retry callback */
  errorComponent?: React.ReactNode | ((error: Error, retry: () => void) => React.ReactNode);
}

export interface PDFDocumentLoadedEvent {
  numPages: number;
  document: PDFDocumentProxy;
}

export interface TextSelection {
  text: string;
  pageNumber: number;
  rects: DOMRect[];
}

// ============================================================================
// Page Types
// ============================================================================

export interface PDFPageState {
  pageNumber: number;
  page: PDFPageProxy | null;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  isRendering: boolean;
  isRendered: boolean;
  error: Error | null;
}

export interface PageDimensions {
  width: number;
  height: number;
  scale: number;
}

// ============================================================================
// Viewer State Types
// ============================================================================

export type ViewMode = 'single' | 'dual' | 'continuous' | 'book' | 'tutor';
export type ScrollMode = 'single' | 'continuous';
export type SidebarPanel = 'thumbnails' | 'outline' | 'search' | 'annotations' | null;
export type Theme = 'light' | 'dark' | 'sepia';

/** Loading phase for the PDF document */
export type LoadingPhase = 'initializing' | 'fetching' | 'parsing' | 'rendering';

/** Document loading state for progressive loading */
export type DocumentLoadingState = 'idle' | 'initializing' | 'loading' | 'ready' | 'error';

/** Loading progress information */
export interface LoadingProgress {
  /** Current loading phase */
  phase: LoadingPhase;
  /** Progress percentage (0-100), undefined for indeterminate */
  percent?: number;
  /** Bytes loaded */
  bytesLoaded?: number;
  /** Total bytes */
  totalBytes?: number;
}

/** Streaming progress for progressive document loading */
export interface StreamingProgress {
  /** Bytes loaded so far */
  loaded: number;
  /** Total bytes (0 if unknown) */
  total: number;
}

/** Request to scroll to a specific page */
export interface ScrollToPageRequest {
  page: number;
  requestId: string;
  behavior: 'smooth' | 'instant';
}

export interface ViewerState {
  // Document state
  document: PDFDocumentProxy | null;
  numPages: number;
  isLoading: boolean;
  loadingProgress: LoadingProgress | null;
  error: Error | null;

  // Progressive loading state
  documentLoadingState: DocumentLoadingState;
  firstPageReady: boolean;
  streamingProgress: StreamingProgress | null;

  // Navigation state
  currentPage: number;
  scale: number;
  rotation: number;

  // Scroll coordination
  scrollToPageRequest: ScrollToPageRequest | null;

  // UI state
  viewMode: ViewMode;
  scrollMode: ScrollMode;
  theme: Theme;
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;

  // Feature states
  isFullscreen: boolean;
  isPresentationMode: boolean;
}

export interface ViewerActions {
  // Document actions
  setDocument: (doc: PDFDocumentProxy | null) => void;
  setLoading: (loading: boolean, progress?: LoadingProgress) => void;
  setLoadingProgress: (progress: LoadingProgress | null) => void;
  setError: (error: Error | null) => void;

  // Progressive loading actions
  setDocumentLoadingState: (state: DocumentLoadingState) => void;
  setFirstPageReady: (ready: boolean) => void;
  setStreamingProgress: (progress: StreamingProgress | null) => void;

  // Navigation actions
  setCurrentPage: (page: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  // Scroll coordination actions
  requestScrollToPage: (page: number, behavior?: 'smooth' | 'instant') => Promise<void>;
  completeScrollRequest: (requestId: string) => void;

  // Zoom actions
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: () => void;
  fitToPage: () => void;

  // Rotation actions
  setRotation: (rotation: number) => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;

  // UI actions
  setViewMode: (mode: ViewMode) => void;
  setScrollMode: (mode: ScrollMode) => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  setFullscreen: (fullscreen: boolean) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Highlight Types
// ============================================================================

export interface Highlight {
  id: string;
  pageNumber: number;
  rects: HighlightRect[];
  color: HighlightColor;
  text: string;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Source of the highlight: user-created, agent-created, or search result */
  source?: 'user' | 'agent' | 'search';
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

// ============================================================================
// Annotation Types
// ============================================================================

export type AnnotationType = 'note' | 'drawing' | 'shape' | 'stamp';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteAnnotation extends BaseAnnotation {
  type: 'note';
  x: number;
  y: number;
  content: string;
  color: string;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: 'drawing';
  paths: DrawingPath[];
  color: string;
  strokeWidth: number;
}

export interface DrawingPath {
  points: { x: number; y: number }[];
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'arrow' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export type Annotation = NoteAnnotation | DrawingAnnotation | ShapeAnnotation;

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  pageNumber: number;
  matchIndex: number;
  text: string;
  rects: HighlightRect[];
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  currentResultIndex: number;
  isSearching: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

// ============================================================================
// Outline Types
// ============================================================================

export interface OutlineItem {
  title: string;
  pageNumber: number;
  children: OutlineItem[];
  expanded?: boolean;
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface Plugin {
  name: string;
  version: string;
  initialize?: (api: PluginAPI) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

export interface PluginAPI {
  viewer: ViewerState & ViewerActions;
  registerToolbarItem: (item: ToolbarItem) => void;
  registerSidebarPanel: (panel: SidebarPanelConfig) => void;
  registerContextMenuItem: (item: ContextMenuItem) => void;
}

export interface ToolbarItem {
  id: string;
  position: 'left' | 'center' | 'right';
  render: () => React.ReactNode;
  order?: number;
}

export interface SidebarPanelConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  condition?: () => boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export interface PDFViewerEventMap {
  pagechange: { pageNumber: number };
  scalechange: { scale: number };
  documentload: PDFDocumentLoadedEvent;
  textselect: TextSelection;
  error: Error;
}

// ============================================================================
// PDFViewerHandle - Imperative API for developers
// ============================================================================

export interface HighlightTextOptions {
  /** Highlight color (default: 'yellow') */
  color?: HighlightColor;
  /** Only highlight on specific page (default: all pages) */
  page?: number;
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Scroll to first match (default: true) */
  scrollTo?: boolean;
}

export interface DrawRectOptions {
  /** Page number (1-indexed) */
  page: number;
  /** X coordinate (percentage of page width, 0-100) */
  x: number;
  /** Y coordinate (percentage of page height, 0-100) */
  y: number;
  /** Width (percentage of page width) */
  width: number;
  /** Height (percentage of page height) */
  height: number;
  /** Border color (default: 'blue') */
  color?: string;
  /** Border width in pixels (default: 2) */
  strokeWidth?: number;
  /** Fill color (optional, transparent if not set) */
  fillColor?: string;
}

export interface DrawCircleOptions {
  /** Page number (1-indexed) */
  page: number;
  /** Center X coordinate (percentage of page width, 0-100) */
  x: number;
  /** Center Y coordinate (percentage of page height, 0-100) */
  y: number;
  /** Radius (percentage of page width) */
  radius: number;
  /** Border color (default: 'blue') */
  color?: string;
  /** Border width in pixels (default: 2) */
  strokeWidth?: number;
  /** Fill color (optional, transparent if not set) */
  fillColor?: string;
}

export interface AddNoteOptions {
  /** Page number (1-indexed) */
  page: number;
  /** X coordinate (percentage of page width, 0-100) */
  x: number;
  /** Y coordinate (percentage of page height, 0-100) */
  y: number;
  /** Note content */
  content: string;
  /** Note color (default: 'yellow') */
  color?: string;
}

export interface SearchOptions {
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
  /** Highlight all matches (default: true) */
  highlightAll?: boolean;
}

// ============================================================================
// GoToPage Options
// ============================================================================

export interface GoToPageOptions {
  /** Scroll behavior (default: 'smooth') */
  behavior?: 'smooth' | 'instant';
}

// ============================================================================
// SearchAndHighlight Types
// ============================================================================

export interface SearchAndHighlightOptions {
  /** Highlight color (default: 'yellow') */
  color?: HighlightColor;
  /** Page range to search - either { start, end } or array of page numbers */
  pageRange?: { start: number; end: number } | number[];
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
  /** Scroll to first match (default: true) */
  scrollToFirst?: boolean;
  /** Clear previous search highlights (default: true) */
  clearPrevious?: boolean;
}

export interface SearchAndHighlightResult {
  /** Total number of matches found */
  matchCount: number;
  /** IDs of created highlights */
  highlightIds: string[];
  /** Detailed match information */
  matches: Array<{
    pageNumber: number;
    text: string;
    highlightId: string;
    rects: HighlightRect[];
  }>;
}

// ============================================================================
// Agent Tool Types
// ============================================================================

export interface AgentToolResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface AgentTools {
  /** Navigate to a specific page */
  navigateToPage: (page: number) => Promise<AgentToolResult<{ previousPage: number; currentPage: number }>>;
  /** Highlight text with structured response */
  highlightText: (text: string, options?: HighlightTextOptions) => Promise<AgentToolResult<{ matchCount: number; highlightIds: string[] }>>;
  /** Get text content of a specific page */
  getPageContent: (page: number) => Promise<AgentToolResult<{ text: string }>>;
  /** Clear all visual elements (highlights and annotations) */
  clearAllVisuals: () => Promise<AgentToolResult<void>>;
}

// ============================================================================
// Coordinate Types
// ============================================================================

export interface PageCoordinates {
  x: number;
  y: number;
}

export interface PageDimensionsInfo {
  width: number;
  height: number;
  rotation: number;
}

export interface CoordinateHelpers {
  /** Get dimensions of a specific page */
  getPageDimensions: (page: number) => PageDimensionsInfo | null;
  /** Convert percent coordinates (0-100) to pixels */
  percentToPixels: (xPercent: number, yPercent: number, page: number) => PageCoordinates | null;
  /** Convert pixel coordinates to percent (0-100) */
  pixelsToPercent: (x: number, y: number, page: number) => PageCoordinates | null;
}

/**
 * Imperative handle for PDFViewerClient.
 * Use this to programmatically control the PDF viewer.
 *
 * @example
 * ```tsx
 * const viewerRef = useRef<PDFViewerHandle>(null);
 *
 * // Highlight text
 * viewerRef.current?.highlightText("important keyword");
 *
 * // Draw a rectangle
 * viewerRef.current?.drawRect({ page: 1, x: 10, y: 20, width: 30, height: 10 });
 *
 * // Navigate
 * viewerRef.current?.goToPage(5);
 * ```
 */
export interface PDFViewerHandle {
  // ==================== Text Highlighting ====================

  /**
   * Find and highlight text in the PDF.
   * @param text - Text to find and highlight
   * @param options - Highlight options
   * @returns Array of highlight IDs created
   */
  highlightText: (text: string, options?: HighlightTextOptions) => Promise<string[]>;

  /**
   * Remove a specific highlight by ID.
   */
  removeHighlight: (id: string) => void;

  /**
   * Clear all highlights.
   */
  clearHighlights: () => void;

  // ==================== Annotations ====================

  /**
   * Draw a rectangle on the PDF.
   * @param options - Rectangle options (coordinates are percentages 0-100)
   * @returns Annotation ID
   */
  drawRect: (options: DrawRectOptions) => string;

  /**
   * Draw a circle on the PDF.
   * @param options - Circle options (coordinates are percentages 0-100)
   * @returns Annotation ID
   */
  drawCircle: (options: DrawCircleOptions) => string;

  /**
   * Add a note annotation.
   * @param options - Note options
   * @returns Annotation ID
   */
  addNote: (options: AddNoteOptions) => string;

  /**
   * Remove a specific annotation by ID.
   */
  removeAnnotation: (id: string) => void;

  /**
   * Clear all annotations.
   */
  clearAnnotations: () => void;

  // ==================== Navigation ====================

  /**
   * Go to a specific page. Returns a Promise that resolves when scroll completes.
   * @param page - Page number (1-indexed)
   * @param options - Navigation options
   * @returns Promise that resolves when the page is visible
   */
  goToPage: (page: number, options?: GoToPageOptions) => Promise<void>;

  /**
   * Go to the next page.
   */
  nextPage: () => void;

  /**
   * Go to the previous page.
   */
  previousPage: () => void;

  /**
   * Get the current page number.
   */
  getCurrentPage: () => number;

  /**
   * Get total number of pages.
   */
  getNumPages: () => number;

  // ==================== Zoom ====================

  /**
   * Set the zoom level.
   * @param scale - Zoom scale (1.0 = 100%)
   */
  setZoom: (scale: number) => void;

  /**
   * Get the current zoom level.
   */
  getZoom: () => number;

  /**
   * Zoom in.
   */
  zoomIn: () => void;

  /**
   * Zoom out.
   */
  zoomOut: () => void;

  // ==================== Search ====================

  /**
   * Search for text in the PDF.
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;

  /**
   * Go to the next search result.
   */
  nextSearchResult: () => void;

  /**
   * Go to the previous search result.
   */
  previousSearchResult: () => void;

  /**
   * Clear search results.
   */
  clearSearch: () => void;

  // ==================== Combined Search & Highlight ====================

  /**
   * Search for text and highlight all matches in one operation.
   * @param query - Text to search for
   * @param options - Search and highlight options
   * @returns Structured result with match count and highlight IDs
   */
  searchAndHighlight: (query: string, options?: SearchAndHighlightOptions) => Promise<SearchAndHighlightResult>;

  // ==================== Agent Tools ====================

  /**
   * Agent-friendly tools with structured responses.
   * Each method returns { success, data?, error? } for easy agent integration.
   */
  agentTools: AgentTools;

  // ==================== Coordinate Helpers ====================

  /**
   * Coordinate conversion utilities for working with PDF page coordinates.
   */
  coordinates: CoordinateHelpers;

  // ==================== Document ====================

  /**
   * Get the underlying PDF document (pdfjs-dist PDFDocumentProxy).
   */
  getDocument: () => PDFDocumentProxy | null;

  /**
   * Check if the document is loaded.
   */
  isLoaded: () => boolean;
}

// ============================================================================
// Agent & Student Learning Types (re-exported from agent-context)
// ============================================================================

export type {
  AgentContext,
  AskAboutContext,
  PDFRegion,
  FocusedRegion,
  Bookmark,
  QuickNote,
  Takeaway,
  AgentHighlightParams,
  AgentAPI,
  StudentState,
  StudentActions,
  AgentState,
  AgentActions,
  StudentModeCallbacks,
  StudentModeProps,
} from './agent-context';

// ============================================================================
// Tutor Mode Types (bbox)
// ============================================================================

export type {
  BlockType,
  DefaultAction,
  BBoxCoords,
  Block,
  PageDimensionsDpi,
  PageBBoxData,
  BBoxIndex,
} from './bbox';
