import { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPage } from '../PDFPage';
import { usePDFViewer, useTextSelection, useTouchGestures, useIsTouchDevice } from '../../hooks';
import { useHighlights } from '../../hooks/useHighlights';
import { SelectionToolbar } from '../SelectionToolbar';
import { HighlightPopover } from '../HighlightPopover';
import { cn } from '../../utils';
import type { HighlightColor } from '../../types';

export interface VirtualizedDocumentContainerProps {
  /** Number of pages to render above/below viewport */
  overscan?: number;
  /** Gap between pages in pixels */
  pageGap?: number;
  /** Enable touch gestures */
  enableTouchGestures?: boolean;
  className?: string;
}

interface PageInfo {
  pageNumber: number;
  top: number;
  height: number;
}

// Default page dimensions for placeholder (US Letter)
const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;

/**
 * VirtualizedDocumentContainer efficiently renders only visible pages.
 *
 * Mobile optimizations:
 * - Only pages in/near viewport are rendered (virtualization)
 * - Smooth scrolling with -webkit-overflow-scrolling
 * - Touch gestures for pinch-zoom and swipe navigation
 * - Passive event listeners for scroll performance
 * - Smart page caching to avoid re-fetching
 */
export const VirtualizedDocumentContainer = memo(function VirtualizedDocumentContainer({
  overscan = 2,
  pageGap = 16,
  enableTouchGestures = true,
  className,
}: VirtualizedDocumentContainerProps) {
  const {
    document,
    numPages,
    currentPage,
    scale,
    rotation,
    theme,
    setScale,
    goToPage,
    nextPage,
    previousPage,
  } = usePDFViewer();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const pageCache = useRef<Map<number, PDFPageProxy>>(new Map());
  const pageDimensionsCache = useRef<Map<number, { width: number; height: number }>>(new Map());
  const baseScaleRef = useRef(scale);
  const isTouchDevice = useIsTouchDevice();

  const [visiblePages, setVisiblePages] = useState<number[]>([1]);
  const [pageObjects, setPageObjects] = useState<Map<number, PDFPageProxy>>(new Map());
  const [totalHeight, setTotalHeight] = useState(0);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);

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

  // Clear cache when document changes
  useEffect(() => {
    if (document !== documentRef.current) {
      documentRef.current = document;
      pageCache.current.clear();
      pageDimensionsCache.current.clear();
      setPageObjects(new Map());
    }
  }, [document]);

  // Calculate page positions
  useEffect(() => {
    if (!document || numPages === 0) return;

    const calculatePageInfos = async () => {
      const infos: PageInfo[] = [];
      let currentTop = 0;

      for (let i = 1; i <= numPages; i++) {
        // Try to get cached dimensions or use default
        let dimensions = pageDimensionsCache.current.get(i);

        if (!dimensions) {
          try {
            const page = pageCache.current.get(i) || await document.getPage(i);
            if (!pageCache.current.has(i)) {
              pageCache.current.set(i, page);
            }
            const viewport = page.getViewport({ scale: 1, rotation });
            dimensions = { width: viewport.width, height: viewport.height };
            pageDimensionsCache.current.set(i, dimensions);
          } catch {
            dimensions = { width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT };
          }
        }

        const scaledHeight = Math.floor(dimensions.height * scale);

        infos.push({
          pageNumber: i,
          top: currentTop,
          height: scaledHeight,
        });

        currentTop += scaledHeight + pageGap;
      }

      setPageInfos(infos);
      setTotalHeight(currentTop - pageGap); // Remove last gap
    };

    calculatePageInfos();
  }, [document, numPages, scale, rotation, pageGap]);

  // Update visible pages based on scroll
  const updateVisiblePages = useCallback(() => {
    if (!scrollContainerRef.current || pageInfos.length === 0) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const scrollBottom = scrollTop + viewportHeight;

    const visible: number[] = [];
    let firstVisiblePage = 1;
    let maxVisibleArea = 0;

    for (const info of pageInfos) {
      const pageTop = info.top;
      const pageBottom = info.top + info.height;

      // Check if page is in viewport (with overscan)
      const overscanTop = scrollTop - overscan * viewportHeight;
      const overscanBottom = scrollBottom + overscan * viewportHeight;

      if (pageBottom > overscanTop && pageTop < overscanBottom) {
        visible.push(info.pageNumber);
      }

      // Calculate which page has most visible area (for current page tracking)
      if (pageBottom > scrollTop && pageTop < scrollBottom) {
        const visibleTop = Math.max(pageTop, scrollTop);
        const visibleBottom = Math.min(pageBottom, scrollBottom);
        const visibleArea = visibleBottom - visibleTop;

        if (visibleArea > maxVisibleArea) {
          maxVisibleArea = visibleArea;
          firstVisiblePage = info.pageNumber;
        }
      }
    }

    setVisiblePages(visible);

    // Update current page if it changed
    if (firstVisiblePage !== currentPage) {
      goToPage(firstVisiblePage);
    }
  }, [pageInfos, overscan, currentPage, goToPage]);

  // Set up scroll listener with passive option for better performance
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      requestAnimationFrame(updateVisiblePages);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    updateVisiblePages(); // Initial update

    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateVisiblePages]);

  // Load page objects for visible pages
  useEffect(() => {
    if (!document) return;

    const loadPages = async () => {
      const newPageObjects = new Map(pageObjects);
      let hasChanges = false;

      for (const pageNum of visiblePages) {
        if (!newPageObjects.has(pageNum)) {
          try {
            let page = pageCache.current.get(pageNum);
            if (!page) {
              page = await document.getPage(pageNum);
              pageCache.current.set(pageNum, page);
            }
            newPageObjects.set(pageNum, page);
            hasChanges = true;
          } catch (error) {
            console.error(`Error loading page ${pageNum}:`, error);
          }
        }
      }

      // Unload pages that are far from viewport to save memory
      const visibleSet = new Set(visiblePages);
      for (const [pageNum] of newPageObjects) {
        if (!visibleSet.has(pageNum)) {
          newPageObjects.delete(pageNum);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        setPageObjects(newPageObjects);
      }
    };

    loadPages();
  }, [document, visiblePages, pageObjects]);

  // Scroll to page when currentPage changes externally
  useEffect(() => {
    if (!scrollContainerRef.current || pageInfos.length === 0) return;

    const pageInfo = pageInfos.find((p) => p.pageNumber === currentPage);
    if (pageInfo) {
      const container = scrollContainerRef.current;
      const targetScroll = pageInfo.top - pageGap;

      // Only scroll if not already visible
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      if (targetScroll < scrollTop || pageInfo.top + pageInfo.height > scrollTop + viewportHeight) {
        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });
      }
    }
  }, [currentPage, pageInfos, pageGap]);

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
    onSwipeLeft: nextPage,
    onSwipeRight: previousPage,
    enabled: enableTouchGestures && isTouchDevice,
  });

  // Combine refs
  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollContainerRef.current = element;
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

  if (!document) {
    return (
      <div
        className={cn(
          'virtualized-document-container',
          'flex-1 flex items-center justify-center',
          themeStyles[theme],
          className
        )}
      >
        <div className="text-gray-500 dark:text-gray-400">No document loaded</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'virtualized-document-container',
        'flex-1 relative',
        themeStyles[theme],
        className
      )}
    >
      <div
        ref={setContainerRef}
        className="absolute inset-0 overflow-auto"
        style={{
          // Smooth scrolling on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Scroll container with total height */}
        <div
          className="relative mx-auto"
          style={{
            height: totalHeight,
            minHeight: '100%',
          }}
        >
          {/* Render visible pages */}
          {pageInfos
            .filter((info) => visiblePages.includes(info.pageNumber))
            .map((info) => {
              const page = pageObjects.get(info.pageNumber);
              const dimensions = pageDimensionsCache.current.get(info.pageNumber);
              const scaledWidth = dimensions
                ? Math.floor(dimensions.width * scale)
                : Math.floor(DEFAULT_PAGE_WIDTH * scale);

              return (
                <div
                  key={info.pageNumber}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: info.top,
                    width: scaledWidth,
                  }}
                >
                  <PDFPage
                    pageNumber={info.pageNumber}
                    page={page || null}
                    scale={scale}
                    rotation={rotation}
                  />
                </div>
              );
            })}
        </div>
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
    </div>
  );
});
