export {
  PDFViewerProvider,
  PDFViewerContext,
  useViewerStore,
  useAnnotationStore,
  useSearchStore,
  usePDFViewerStores,
  type PDFViewerProviderProps,
  type PDFViewerContextValue,
} from './PDFViewerContext';

export { usePDFViewer } from './usePDFViewer';
export { usePageNavigation, type UsePageNavigationOptions } from './usePageNavigation';
export { useZoom, type UseZoomOptions } from './useZoom';
export { useTextSelection, type UseTextSelectionOptions } from './useTextSelection';
export { useHighlights, type UseHighlightsOptions, type UseHighlightsReturn } from './useHighlights';
export { useAnnotations, type UseAnnotationsOptions, type UseAnnotationsReturn } from './useAnnotations';
export { useTouchGestures, useIsTouchDevice, useIsMobile, type UseTouchGesturesOptions } from './useTouchGestures';
export { usePlugins, type UsePluginsOptions, type UsePluginsReturn } from './usePlugins';
