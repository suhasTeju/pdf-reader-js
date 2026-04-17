export {
  PDFViewer,
  PDFViewerClient,
  DocumentContainer,
  VirtualizedDocumentContainer,
  ContinuousScrollContainer,
  DualPageContainer,
  BookModeContainer,
} from './PDFViewer';
export { PDFPage, CanvasLayer, TextLayer, HighlightLayer, AnnotationLayer, FocusRegionLayer } from './PDFPage';
export { Toolbar, MobileToolbar } from './Toolbar';
export { Sidebar, MobileSidebar, ThumbnailPanel, SearchPanel, OutlinePanel, HighlightsPanel, BookmarksPanel, TakeawaysPanel } from './Sidebar';
export { SelectionToolbar } from './SelectionToolbar';
export { HighlightPopover } from './HighlightPopover';
export { AnnotationToolbar } from './AnnotationToolbar';
export { StickyNote, DrawingCanvas, ShapeRenderer, ShapePreview, QuickNoteButton, QuickNotePopover } from './Annotations';
export { AskAboutOverlay, AskAboutTrigger } from './AskAbout';
export { Minimap } from './Minimap';
export { FloatingZoomControls } from './FloatingZoomControls';
export { PDFThumbnailNav } from './PDFThumbnailNav';
export { PDFErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export { PDFLoadingScreen } from './PDFLoadingScreen';
export {
  TutorModeContainer,
  CinemaLayer,
  CameraView,
  SpotlightMask,
  AnimatedUnderline,
  AnimatedHighlight,
  PulseOverlay,
  CalloutArrow,
  GhostReference,
  BoxOverlay,
  StickyLabel,
  SubtitleBar,
  buildBBoxIndex,
} from './TutorMode';

// Re-export types
export type { PDFPageProps, CanvasLayerProps, TextLayerProps, HighlightLayerProps, AnnotationLayerProps, FocusRegionLayerProps } from './PDFPage';
export type { ToolbarProps, MobileToolbarProps } from './Toolbar';
export type { SidebarProps, MobileSidebarProps, ThumbnailPanelProps, SearchPanelProps, OutlinePanelProps, HighlightsPanelProps, BookmarksPanelProps, TakeawaysPanelProps } from './Sidebar';
export type {
  DocumentContainerProps,
  VirtualizedDocumentContainerProps,
  ContinuousScrollContainerProps,
  DualPageContainerProps,
  BookModeContainerProps,
} from './PDFViewer';
export type { SelectionToolbarProps } from './SelectionToolbar';
export type { HighlightPopoverProps } from './HighlightPopover';
export type { AnnotationToolbarProps } from './AnnotationToolbar';
export type { StickyNoteProps, DrawingCanvasProps, ShapeRendererProps, ShapePreviewProps, QuickNoteButtonProps, QuickNotePopoverProps } from './Annotations';
export type { AskAboutOverlayProps, AskAboutTriggerProps } from './AskAbout';
export type { MinimapProps } from './Minimap';
export type { FloatingZoomControlsProps } from './FloatingZoomControls';
export type { PDFThumbnailNavProps } from './PDFThumbnailNav';
export type { PDFErrorBoundaryProps, WithErrorBoundaryProps } from './ErrorBoundary';
export type { PDFLoadingScreenProps } from './PDFLoadingScreen';
export type {
  TutorModeContainerProps,
  StoryboardProviderInput,
  CinemaLayerProps,
  CameraViewProps,
  SpotlightMaskProps,
  AnimatedUnderlineProps,
  AnimatedHighlightProps,
  PulseOverlayProps,
  CalloutArrowProps,
  GhostReferenceProps,
  BoxOverlayProps,
  StickyLabelProps,
  SubtitleBarProps,
} from './TutorMode';
