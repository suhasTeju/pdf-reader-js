import { useCallback, useEffect } from 'react';
import { useViewerStore, usePDFViewerStores } from './PDFViewerContext';

export interface UsePageNavigationOptions {
  enableKeyboardNavigation?: boolean;
}

/**
 * Hook for page navigation functionality.
 */
export function usePageNavigation(options: UsePageNavigationOptions = {}) {
  const { enableKeyboardNavigation = true } = options;
  const { viewerStore } = usePDFViewerStores();

  const currentPage = useViewerStore((s) => s.currentPage);
  const numPages = useViewerStore((s) => s.numPages);

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

  const goToFirstPage = useCallback(
    () => viewerStore.getState().goToPage(1),
    [viewerStore]
  );

  const goToLastPage = useCallback(
    () => {
      const { numPages } = viewerStore.getState();
      viewerStore.getState().goToPage(numPages);
    },
    [viewerStore]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          previousPage();
          break;
        case 'Home':
          e.preventDefault();
          goToFirstPage();
          break;
        case 'End':
          e.preventDefault();
          goToLastPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardNavigation, nextPage, previousPage, goToFirstPage, goToLastPage]);

  return {
    currentPage,
    numPages,
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    canGoNext: currentPage < numPages,
    canGoPrevious: currentPage > 1,
  };
}
