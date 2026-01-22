import { useCallback, useEffect, useRef } from 'react';
import { useViewerStore, usePDFViewerStores } from './PDFViewerContext';

export interface UseZoomOptions {
  enableWheelZoom?: boolean;
  minScale?: number;
  maxScale?: number;
}

/**
 * Hook for zoom functionality.
 */
export function useZoom(options: UseZoomOptions = {}) {
  const { enableWheelZoom = true, minScale = 0.1, maxScale = 10 } = options;
  const { viewerStore } = usePDFViewerStores();
  const containerRef = useRef<HTMLElement | null>(null);

  const scale = useViewerStore((s) => s.scale);

  const setScale = useCallback(
    (newScale: number) => {
      const clamped = Math.max(minScale, Math.min(maxScale, newScale));
      viewerStore.getState().setScale(clamped);
    },
    [viewerStore, minScale, maxScale]
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

  const resetZoom = useCallback(
    () => viewerStore.getState().setScale(1),
    [viewerStore]
  );

  // Wheel zoom handler
  useEffect(() => {
    if (!enableWheelZoom) return;

    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      // Only zoom when Ctrl/Cmd is pressed
      if (!wheelEvent.ctrlKey && !wheelEvent.metaKey) return;

      e.preventDefault();

      const delta = wheelEvent.deltaY > 0 ? -0.1 : 0.1;
      const newScale = scale + delta;
      setScale(newScale);
    };

    const container = containerRef.current || document;
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enableWheelZoom, scale, setScale]);

  // Keyboard zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            e.preventDefault();
            resetZoom();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  return {
    scale,
    setScale,
    zoomIn,
    zoomOut,
    fitToWidth,
    fitToPage,
    resetZoom,
    setContainerRef: (el: HTMLElement | null) => {
      containerRef.current = el;
    },
    scalePercentage: Math.round(scale * 100),
  };
}
