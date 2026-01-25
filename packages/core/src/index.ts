// Components
export {
  // PDF Viewer
  PDFViewer,
  PDFViewerClient,
  DocumentContainer,
  VirtualizedDocumentContainer,
  ContinuousScrollContainer,
  DualPageContainer,
  // PDF Page
  PDFPage,
  CanvasLayer,
  TextLayer,
  HighlightLayer,
  AnnotationLayer,
  FocusRegionLayer,
  // Toolbar
  Toolbar,
  MobileToolbar,
  // Sidebar
  Sidebar,
  MobileSidebar,
  ThumbnailPanel,
  SearchPanel,
  OutlinePanel,
  HighlightsPanel,
  BookmarksPanel,
  TakeawaysPanel,
  // Popovers
  SelectionToolbar,
  HighlightPopover,
  // Annotations
  AnnotationToolbar,
  StickyNote,
  DrawingCanvas,
  ShapeRenderer,
  ShapePreview,
  QuickNoteButton,
  QuickNotePopover,
  // Ask About
  AskAboutOverlay,
  AskAboutTrigger,
  // Minimap
  Minimap,
  // Floating Controls
  FloatingZoomControls,
  // Thumbnail Navigation
  PDFThumbnailNav,
  // Error Boundary
  PDFErrorBoundary,
  // Loading Screen
  PDFLoadingScreen,
  withErrorBoundary,
} from './components';

// Hooks
export {
  PDFViewerProvider,
  PDFViewerContext,
  useViewerStore,
  useAnnotationStore,
  useSearchStore,
  useAgentStore,
  useStudentStore,
  usePDFViewerStores,
  usePDFViewer,
  usePageNavigation,
  useZoom,
  useTextSelection,
  useHighlights,
  useAnnotations,
  useTouchGestures,
  useIsTouchDevice,
  useIsMobile,
  usePlugins,
  // Student Learning Hooks
  useAgentContext,
  useAskAbout,
  useBookmarks,
  useQuickNotes,
  useStudentProgress,
} from './hooks';

// Stores
export {
  createViewerStore,
  createAnnotationStore,
  createSearchStore,
  createAgentStore,
  createStudentStore,
} from './store';

// Plugins
export {
  PluginManager,
  getPluginManager,
  createPluginManager,
} from './plugins';

// Utils
export {
  cn,
  initializePDFJS,
  isPDFJSInitialized,
  loadDocument,
  loadDocumentWithCallbacks,
  getPage,
  getPageTextContent,
  getOutline,
  getMetadata,
  pdfjsLib,
  // Highlight storage
  saveHighlights,
  loadHighlights,
  clearHighlights,
  getAllDocumentIds,
  exportHighlightsAsJSON,
  importHighlightsFromJSON,
  exportHighlightsAsMarkdown,
  generateDocumentId,
  // Convenience API
  createPDFViewer,
  quickViewer,
  // Student Learning Utils
  exportAnnotationsAsMarkdown,
  exportAnnotationsAsJSON,
  downloadAnnotationsAsMarkdown,
  downloadAnnotationsAsJSON,
  downloadFile,
  // Student Storage
  saveStudentData,
  loadStudentData,
  clearStudentData,
  getAllStudentDataDocumentIds,
  getStorageStats,
  // Agent API
  createAgentAPI,
  // Text Search Utilities
  extractPageText,
  findTextOnPage,
  findTextInDocument,
  mergeAdjacentRects,
  getPageText,
  countTextOnPage,
  // Coordinate Utilities
  pdfToViewport,
  viewportToPDF,
  percentToPDF,
  pdfToPercent,
  percentToViewport,
  viewportToPercent,
  applyRotation,
  removeRotation,
  getRotatedDimensions,
  scaleRect,
  isPointInRect,
  doRectsIntersect,
  getRectIntersection,
} from './utils';

// Types
export type {
  // Core types
  PDFViewerProps,
  PDFDocumentLoadedEvent,
  TextSelection,
  PDFPageState,
  PageDimensions,

  // Imperative API types
  PDFViewerHandle,
  HighlightTextOptions,
  DrawRectOptions,
  DrawCircleOptions,
  AddNoteOptions,
  SearchOptions,

  // Viewer types
  ViewerState,
  ViewerActions,
  ViewMode,
  ScrollMode,
  Theme,
  SidebarPanel,

  // Highlight types
  Highlight,
  HighlightRect,
  HighlightColor,

  // Annotation types
  Annotation,
  AnnotationType,
  NoteAnnotation,
  DrawingAnnotation,
  DrawingPath,
  ShapeAnnotation,

  // Search types
  SearchResult,
  SearchState,

  // Outline types
  OutlineItem,

  // Plugin types
  Plugin,
  PluginAPI,
  ToolbarItem,
  SidebarPanelConfig,
  ContextMenuItem,
  PDFViewerEventMap,

  // Agent & Student Learning types
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

  // New types
  ScrollToPageRequest,
  GoToPageOptions,
  SearchAndHighlightOptions,
  SearchAndHighlightResult,
  AgentToolResult,
  AgentTools,
  PageCoordinates,
  PageDimensionsInfo,
  CoordinateHelpers,
  LoadingPhase,
  LoadingProgress,
  DocumentLoadingState,
  StreamingProgress,
} from './types';

// Component types
export type { PDFLoadingScreenProps } from './components';

// Store types
export type {
  ViewerStore,
  ViewerStoreApi,
  AnnotationStore,
  AnnotationStoreApi,
  AnnotationState,
  AnnotationActions,
  AnnotationTool,
  ShapeType,
  SearchStore,
  SearchStoreApi,
  SearchActions,
  AgentStore,
  AgentStoreApi,
  StudentStore,
  StudentStoreApi,
} from './store';

// Hook types
export type {
  PDFViewerProviderProps,
  PDFViewerContextValue,
  UsePageNavigationOptions,
  UseZoomOptions,
  UseTextSelectionOptions,
  UseHighlightsOptions,
  UseHighlightsReturn,
  UseAnnotationsOptions,
  UseAnnotationsReturn,
  UseTouchGesturesOptions,
  UsePluginsOptions,
  UsePluginsReturn,
  UseAgentContextOptions,
  UseAgentContextReturn,
  UseAskAboutOptions,
  UseAskAboutReturn,
  UseBookmarksOptions,
  UseBookmarksReturn,
  UseQuickNotesOptions,
  UseQuickNotesReturn,
  UseStudentProgressOptions,
  UseStudentProgressReturn,
} from './hooks';

// Component types
export type {
  PDFPageProps,
  CanvasLayerProps,
  TextLayerProps,
  HighlightLayerProps,
  AnnotationLayerProps,
  FocusRegionLayerProps,
  ToolbarProps,
  MobileToolbarProps,
  SidebarProps,
  MobileSidebarProps,
  ThumbnailPanelProps,
  SearchPanelProps,
  OutlinePanelProps,
  HighlightsPanelProps,
  BookmarksPanelProps,
  TakeawaysPanelProps,
  DocumentContainerProps,
  VirtualizedDocumentContainerProps,
  ContinuousScrollContainerProps,
  DualPageContainerProps,
  SelectionToolbarProps,
  HighlightPopoverProps,
  AnnotationToolbarProps,
  StickyNoteProps,
  DrawingCanvasProps,
  ShapeRendererProps,
  ShapePreviewProps,
  QuickNoteButtonProps,
  QuickNotePopoverProps,
  AskAboutOverlayProps,
  AskAboutTriggerProps,
  MinimapProps,
  FloatingZoomControlsProps,
  PDFThumbnailNavProps,
  PDFErrorBoundaryProps,
  WithErrorBoundaryProps,
} from './components';

// Plugin types
export type { PluginManagerOptions } from './plugins';

// Utils types
export type {
  LoadDocumentOptions,
  LoadDocumentResult,
  LoadDocumentWithCallbacksOptions,
  LoadDocumentWithCallbacksResult,
  PDFViewerController,
  PDFViewerControllerOptions,
  ExportData,
  StoredStudentData,
  StudentData,
  AgentAPIStores,
  AgentAPIInstance,
  TextMatch,
  FindTextOptions,
  CharPosition,
} from './utils';
