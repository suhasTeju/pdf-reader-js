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
  // Popovers
  SelectionToolbar,
  HighlightPopover,
  // Annotations
  AnnotationToolbar,
  StickyNote,
  DrawingCanvas,
  ShapeRenderer,
  ShapePreview,
  // Error Boundary
  PDFErrorBoundary,
  withErrorBoundary,
} from './components';

// Hooks
export {
  PDFViewerProvider,
  PDFViewerContext,
  useViewerStore,
  useAnnotationStore,
  useSearchStore,
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
} from './hooks';

// Stores
export {
  createViewerStore,
  createAnnotationStore,
  createSearchStore,
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
} from './utils';

// Types
export type {
  // Core types
  PDFViewerProps,
  PDFDocumentLoadedEvent,
  TextSelection,
  PDFPageState,
  PageDimensions,

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
} from './types';

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
} from './hooks';

// Component types
export type {
  PDFPageProps,
  CanvasLayerProps,
  TextLayerProps,
  HighlightLayerProps,
  AnnotationLayerProps,
  ToolbarProps,
  MobileToolbarProps,
  SidebarProps,
  MobileSidebarProps,
  ThumbnailPanelProps,
  SearchPanelProps,
  OutlinePanelProps,
  HighlightsPanelProps,
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
  PDFErrorBoundaryProps,
  WithErrorBoundaryProps,
} from './components';

// Plugin types
export type { PluginManagerOptions } from './plugins';

// Utils types
export type {
  LoadDocumentOptions,
  LoadDocumentResult,
  PDFViewerController,
  PDFViewerControllerOptions,
} from './utils';
