import { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPage } from '../PDFPage';
import { PDFLoadingScreen } from '../PDFLoadingScreen';
import { usePDFViewer, usePDFViewerStores, useTextSelection, useTouchGestures, useIsTouchDevice, useViewerStore } from '../../hooks';
import { useHighlights } from '../../hooks/useHighlights';
import { SelectionToolbar } from '../SelectionToolbar';
import { HighlightPopover } from '../HighlightPopover';
import { cn } from '../../utils';
import type { HighlightColor } from '../../types';

export interface DocumentContainerProps {
  className?: string;
  /** Enable touch gestures for mobile */
  enableTouchGestures?: boolean;
}

export const DocumentContainer = memo(function DocumentContainer({
  className,
  enableTouchGestures = true,
}: DocumentContainerProps) {
  const {
    document,
    currentPage,
    scale,
    rotation,
    theme,
    isLoading,
    setScale,
    nextPage,
    previousPage,
  } = usePDFViewer();

  // Get scroll request from store
  const scrollToPageRequest = useViewerStore((s) => s.scrollToPageRequest);
  const { viewerStore } = usePDFViewerStores();
  const [currentPageObj, setCurrentPageObj] = useState<PDFPageProxy | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const baseScaleRef = useRef(scale);
  const isTouchDevice = useIsTouchDevice();

  // Text selection handling
  const { selection, clearSelection, copySelection } = useTextSelection();

  // Touch gesture handlers
  const handlePinchZoom = useCallback(
    (pinchScale: number) => {
      const newScale = Math.max(0.25, Math.min(4, baseScaleRef.current * pinchScale));
      setScale(newScale);
    },
    [setScale]
  );

  const handleSwipeLeft = useCallback(() => {
    nextPage();
  }, [nextPage]);

  const handleSwipeRight = useCallback(() => {
    previousPage();
  }, [previousPage]);

  const handleDoubleTap = useCallback(
    (_position: { x: number; y: number }) => {
      // Toggle between 1x and 2x zoom on double tap
      const newScale = scale < 1.5 ? 2 : 1;
      setScale(newScale);
    },
    [scale, setScale]
  );

  // Update base scale when scale changes from other sources
  useEffect(() => {
    baseScaleRef.current = scale;
  }, [scale]);

  // Set up touch gestures
  const { ref: touchRef } = useTouchGestures<HTMLDivElement>({
    onPinchZoom: handlePinchZoom,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onDoubleTap: handleDoubleTap,
    enabled: enableTouchGestures && isTouchDevice,
    swipeThreshold: 50,
    doubleTapInterval: 300,
  });

  // Highlight management
  const {
    createHighlightFromSelection,
    updateHighlight,
    deleteHighlight,
    selectedHighlight,
    selectHighlight,
    activeColor,
  } = useHighlights();

  // Clear page when document changes
  useEffect(() => {
    if (document !== documentRef.current) {
      documentRef.current = document;
      setCurrentPageObj(null);
    }
  }, [document]);

  // Load the current page
  useEffect(() => {
    if (!document) {
      setCurrentPageObj(null);
      return;
    }

    let cancelled = false;

    const loadPage = async () => {
      setIsLoadingPage(true);

      try {
        const page = await document.getPage(currentPage);

        if (!cancelled && document === documentRef.current) {
          setCurrentPageObj(page);

          // Complete scroll request if this page load was requested
          if (scrollToPageRequest && scrollToPageRequest.page === currentPage) {
            // Use requestAnimationFrame to ensure page is rendered
            requestAnimationFrame(() => {
              viewerStore.getState().completeScrollRequest(scrollToPageRequest.requestId);
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          // Silently ignore errors from document switching/destruction
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isDocumentDestroyed =
            errorMessage.includes('destroyed') ||
            errorMessage.includes('sendWithStream') ||
            errorMessage.includes('sendWithPromise') ||
            errorMessage.includes('Cannot read properties of null');
          if (!isDocumentDestroyed) {
            console.error('Error loading page:', error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [document, currentPage, scrollToPageRequest, viewerStore]);

  // Get the page element for coordinate calculations
  const getPageElement = useCallback((): HTMLElement | null => {
    return containerRef.current?.querySelector(`[data-page-number="${currentPage}"]`) as HTMLElement | null;
  }, [currentPage]);

  // Handle creating a highlight from selection
  const handleCreateHighlight = useCallback(
    (color: HighlightColor) => {
      if (!selection) return;

      const pageElement = getPageElement();
      if (!pageElement) return;

      createHighlightFromSelection(selection, pageElement, scale, color);
      clearSelection();
    },
    [selection, getPageElement, createHighlightFromSelection, scale, clearSelection]
  );

  // Handle copying selected text
  const handleCopySelection = useCallback(() => {
    copySelection();
  }, [copySelection]);

  // Handle changing highlight color
  const handleColorChange = useCallback(
    (id: string, color: HighlightColor) => {
      updateHighlight(id, { color });
    },
    [updateHighlight]
  );

  // Handle changing highlight comment
  const handleCommentChange = useCallback(
    (id: string, comment: string) => {
      updateHighlight(id, { comment: comment || undefined });
    },
    [updateHighlight]
  );

  // Handle closing the popover
  const handleClosePopover = useCallback(() => {
    selectHighlight(null);
  }, [selectHighlight]);

  // Combine refs for container - must be before any early returns
  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element;
      touchRef(element);
    },
    [touchRef]
  );

  // Theme-based background
  const themeStyles = {
    light: 'bg-gray-100',
    dark: 'bg-gray-900',
    sepia: 'bg-amber-50',
  };

  if (!document) {
    return (
      <div
        className={cn(
          'document-container',
          'flex-1',
          themeStyles[theme],
          className
        )}
      >
        <PDFLoadingScreen phase={isLoading ? 'fetching' : 'initializing'} />
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className={cn(
        'document-container',
        'flex-1 overflow-auto',
        'flex flex-col items-center',
        'p-4 gap-4',
        themeStyles[theme],
        className
      )}
    >
      {/* For single page view, show only current page */}
      <PDFPage
        pageNumber={currentPage}
        page={currentPageObj}
        scale={scale}
        rotation={rotation}
      />

      {/* Selection toolbar - appears when text is selected */}
      <SelectionToolbar
        selection={selection}
        onCreateHighlight={handleCreateHighlight}
        onCopy={handleCopySelection}
        activeColor={activeColor}
      />

      {/* Highlight popover - appears when a highlight is clicked */}
      <HighlightPopover
        highlight={selectedHighlight}
        scale={scale}
        pageElement={getPageElement()}
        onColorChange={handleColorChange}
        onCommentChange={handleCommentChange}
        onDelete={deleteHighlight}
        onClose={handleClosePopover}
      />

      {/* Loading indicator */}
      {isLoadingPage && !currentPageObj && (
        <div className="fixed bottom-4 right-4 px-3 py-2 bg-black/75 text-white text-sm rounded-lg">
          Loading...
        </div>
      )}
    </div>
  );
});
