export {
  PDFViewer,
  PDFViewerClient,
  DocumentContainer,
  VirtualizedDocumentContainer,
  ContinuousScrollContainer,
  DualPageContainer,
} from './PDFViewer';
export { PDFPage, CanvasLayer, TextLayer, HighlightLayer, AnnotationLayer } from './PDFPage';
export { Toolbar, MobileToolbar } from './Toolbar';
export { Sidebar, MobileSidebar, ThumbnailPanel, SearchPanel, OutlinePanel, HighlightsPanel } from './Sidebar';
export { SelectionToolbar } from './SelectionToolbar';
export { HighlightPopover } from './HighlightPopover';
export { AnnotationToolbar } from './AnnotationToolbar';
export { StickyNote, DrawingCanvas, ShapeRenderer, ShapePreview } from './Annotations';
export { PDFErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Re-export types
export type { PDFPageProps, CanvasLayerProps, TextLayerProps, HighlightLayerProps, AnnotationLayerProps } from './PDFPage';
export type { ToolbarProps, MobileToolbarProps } from './Toolbar';
export type { SidebarProps, MobileSidebarProps, ThumbnailPanelProps, SearchPanelProps, OutlinePanelProps, HighlightsPanelProps } from './Sidebar';
export type {
  DocumentContainerProps,
  VirtualizedDocumentContainerProps,
  ContinuousScrollContainerProps,
  DualPageContainerProps,
} from './PDFViewer';
export type { SelectionToolbarProps } from './SelectionToolbar';
export type { HighlightPopoverProps } from './HighlightPopover';
export type { AnnotationToolbarProps } from './AnnotationToolbar';
export type { StickyNoteProps, DrawingCanvasProps, ShapeRendererProps, ShapePreviewProps } from './Annotations';
export type { PDFErrorBoundaryProps, WithErrorBoundaryProps } from './ErrorBoundary';
