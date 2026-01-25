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

export interface DualPageContainerProps {
  /** Show the first page alone (like a book cover) */
  showCover?: boolean;
  /** Book spread mode: odd pages on right side */
  bookSpread?: boolean;
  /** Gap between the two pages */
  pageGap?: number;
  /** Enable touch gestures */
  enableTouchGestures?: boolean;
  className?: string;
}

export const DualPageContainer = memo(function DualPageContainer({
  showCover = true,
  bookSpread = true,
  pageGap = 4,
  enableTouchGestures = true,
  className,
}: DualPageContainerProps) {
  const {
    document,
    numPages,
    currentPage,
    scale,
    rotation,
    theme,
    isLoading: isDocumentLoading,
    setScale,
    goToPage,
  } = usePDFViewer();

  // Get scroll request from store
  const scrollToPageRequest = useViewerStore((s) => s.scrollToPageRequest);
  const { viewerStore } = usePDFViewerStores();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const baseScaleRef = useRef(scale);
  const isTouchDevice = useIsTouchDevice();

  const [leftPage, setLeftPage] = useState<PDFPageProxy | null>(null);
  const [rightPage, setRightPage] = useState<PDFPageProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Text selection and highlights
  const { selection, clearSelection, copySelection } = useTextSelection();
  const {
    createHighlightFromSelection,
    updateHighlight,
    deleteHighlight,
    selectedHighlight,
    selectHighlight,
    activeColor,
  } = useHighlights();

  // Calculate which pages to show in dual view
  const getSpreadPages = useCallback(
    (page: number): { left: number | null; right: number | null } => {
      // Cover page mode: first page is shown alone on right
      if (showCover && page === 1) {
        return { left: null, right: 1 };
      }

      if (bookSpread) {
        // Book spread: even pages on left, odd pages on right
        // After cover: page 2 is alone on left, then 3-4, 5-6, etc.
        if (showCover) {
          if (page === 2) {
            return { left: 2, right: null };
          }
          // For pages 3 and above, pair odd with the next even
          const effectivePage = page > 2 ? page : 3;
          if (effectivePage % 2 === 1) {
            // Odd page: this is on right, previous even on left
            return {
              left: effectivePage - 1 > 1 ? effectivePage - 1 : null,
              right: effectivePage <= numPages ? effectivePage : null,
            };
          } else {
            // Even page: this is on left, next odd on right
            return {
              left: effectivePage,
              right: effectivePage + 1 <= numPages ? effectivePage + 1 : null,
            };
          }
        } else {
          // No cover: pages 1-2, 3-4, etc.
          if (page % 2 === 1) {
            return {
              left: page,
              right: page + 1 <= numPages ? page + 1 : null,
            };
          } else {
            return {
              left: page - 1,
              right: page,
            };
          }
        }
      } else {
        // Simple dual view: show current page and next
        return {
          left: page,
          right: page + 1 <= numPages ? page + 1 : null,
        };
      }
    },
    [showCover, bookSpread, numPages]
  );

  // Clear pages when document changes
  useEffect(() => {
    if (document !== documentRef.current) {
      documentRef.current = document;
      setLeftPage(null);
      setRightPage(null);
    }
  }, [document]);

  // Load pages when currentPage changes
  useEffect(() => {
    if (!document) {
      setLeftPage(null);
      setRightPage(null);
      return;
    }

    const spread = getSpreadPages(currentPage);
    let cancelled = false;

    const loadPages = async () => {
      setIsLoading(true);

      try {
        const [left, right] = await Promise.all([
          spread.left ? document.getPage(spread.left) : Promise.resolve(null),
          spread.right ? document.getPage(spread.right) : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setLeftPage(left);
          setRightPage(right);

          // Complete scroll request if the requested page is now visible
          if (scrollToPageRequest) {
            const requestedPage = scrollToPageRequest.page;
            if (requestedPage === spread.left || requestedPage === spread.right) {
              requestAnimationFrame(() => {
                viewerStore.getState().completeScrollRequest(scrollToPageRequest.requestId);
              });
            }
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
            console.error('Error loading pages:', error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [document, currentPage, getSpreadPages, scrollToPageRequest, viewerStore]);

  // Navigate by spread
  const goToPreviousSpread = useCallback(() => {
    const spread = getSpreadPages(currentPage);
    const leftmostPage = spread.left || spread.right || currentPage;

    if (showCover && leftmostPage === 2) {
      goToPage(1);
    } else if (showCover && leftmostPage <= 3) {
      goToPage(2);
    } else {
      const newPage = Math.max(1, leftmostPage - 2);
      goToPage(newPage);
    }
  }, [currentPage, showCover, getSpreadPages, goToPage]);

  const goToNextSpread = useCallback(() => {
    const spread = getSpreadPages(currentPage);
    const rightmostPage = spread.right || spread.left || currentPage;

    if (rightmostPage < numPages) {
      goToPage(Math.min(numPages, rightmostPage + 1));
    }
  }, [currentPage, numPages, getSpreadPages, goToPage]);

  // Touch gesture handlers
  const handlePinchZoom = useCallback(
    (pinchScale: number) => {
      const newScale = Math.max(0.25, Math.min(4, baseScaleRef.current * pinchScale));
      setScale(newScale);
    },
    [setScale]
  );

  useEffect(() => {
    baseScaleRef.current = scale;
  }, [scale]);

  const { ref: touchRef } = useTouchGestures<HTMLDivElement>({
    onPinchZoom: handlePinchZoom,
    onSwipeLeft: goToNextSpread,
    onSwipeRight: goToPreviousSpread,
    enabled: enableTouchGestures && isTouchDevice,
  });

  // Combine refs
  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element;
      touchRef(element);
    },
    [touchRef]
  );

  // Highlight handlers
  const getPageElement = useCallback(
    (pageNumber: number): HTMLElement | null => {
      return containerRef.current?.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLElement | null;
    },
    []
  );

  const handleCreateHighlight = useCallback(
    (color: HighlightColor) => {
      if (!selection) return;
      const pageElement = getPageElement(selection.pageNumber);
      if (!pageElement) return;
      createHighlightFromSelection(selection, pageElement, scale, color);
      clearSelection();
    },
    [selection, getPageElement, createHighlightFromSelection, scale, clearSelection]
  );

  const handleColorChange = useCallback(
    (id: string, color: HighlightColor) => {
      updateHighlight(id, { color });
    },
    [updateHighlight]
  );

  const handleCommentChange = useCallback(
    (id: string, comment: string) => {
      updateHighlight(id, { comment: comment || undefined });
    },
    [updateHighlight]
  );

  // Theme styles
  const themeStyles = {
    light: 'bg-gray-100',
    dark: 'bg-gray-900',
    sepia: 'bg-amber-50',
  };

  const spread = getSpreadPages(currentPage);

  if (!document) {
    return (
      <div
        className={cn(
          'dual-page-container',
          'flex-1',
          themeStyles[theme],
          className
        )}
      >
        <PDFLoadingScreen phase={isDocumentLoading ? 'fetching' : 'initializing'} />
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className={cn(
        'dual-page-container',
        'flex-1 overflow-auto',
        'flex items-center justify-center',
        'p-4',
        themeStyles[theme],
        className
      )}
    >
      {/* Page spread */}
      <div
        className="flex items-center"
        style={{ gap: pageGap }}
      >
        {/* Left page */}
        {spread.left && (
          <PDFPage
            pageNumber={spread.left}
            page={leftPage}
            scale={scale}
            rotation={rotation}
          />
        )}

        {/* Center divider for book spread effect */}
        {spread.left && spread.right && (
          <div
            className="w-px h-full bg-gray-300 dark:bg-gray-600 opacity-50"
            style={{ minHeight: '100%' }}
          />
        )}

        {/* Right page */}
        {spread.right && (
          <PDFPage
            pageNumber={spread.right}
            page={rightPage}
            scale={scale}
            rotation={rotation}
          />
        )}

        {/* Placeholder for single page spread */}
        {(!spread.left || !spread.right) && (
          <div
            className="flex items-center justify-center"
            style={{
              width: spread.left ? 0 : 612 * scale,
              height: spread.right ? 792 * scale : 0,
            }}
          />
        )}
      </div>

      {/* Selection toolbar */}
      <SelectionToolbar
        selection={selection}
        onCreateHighlight={handleCreateHighlight}
        onCopy={copySelection}
        activeColor={activeColor}
      />

      {/* Highlight popover */}
      <HighlightPopover
        highlight={selectedHighlight}
        scale={scale}
        pageElement={selectedHighlight ? getPageElement(selectedHighlight.pageNumber) : null}
        onColorChange={handleColorChange}
        onCommentChange={handleCommentChange}
        onDelete={deleteHighlight}
        onClose={() => selectHighlight(null)}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 px-3 py-2 bg-black/75 text-white text-sm rounded-lg">
          Loading...
        </div>
      )}
    </div>
  );
});
