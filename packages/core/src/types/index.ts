import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// ============================================================================
// Core Types
// ============================================================================

export interface PDFViewerProps {
  /** URL or ArrayBuffer of the PDF file */
  src: string | ArrayBuffer | Uint8Array;
  /** Initial page number (1-indexed) */
  initialPage?: number;
  /** Initial scale/zoom level */
  initialScale?: number | 'page-fit' | 'page-width' | 'auto';
  /** Theme mode */
  theme?: 'light' | 'dark' | 'sepia';
  /** Custom class name */
  className?: string;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to show the sidebar */
  showSidebar?: boolean;
  /** Whether to show the annotation toolbar */
  showAnnotationToolbar?: boolean;
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

export type ViewMode = 'single' | 'dual' | 'continuous';
export type ScrollMode = 'single' | 'continuous';
export type SidebarPanel = 'thumbnails' | 'outline' | 'search' | 'annotations' | null;
export type Theme = 'light' | 'dark' | 'sepia';

export interface ViewerState {
  // Document state
  document: PDFDocumentProxy | null;
  numPages: number;
  isLoading: boolean;
  error: Error | null;

  // Navigation state
  currentPage: number;
  scale: number;
  rotation: number;

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
  setDocument: (doc: PDFDocumentProxy) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  // Navigation actions
  setCurrentPage: (page: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

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
  /** Source of the highlight: user-created or agent-created */
  source?: 'user' | 'agent';
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
