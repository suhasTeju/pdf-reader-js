import React, { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { PDFPage } from '../PDFPage';
import { PDFLoadingScreen } from '../PDFLoadingScreen';
import { usePDFViewer, usePDFViewerStores, useViewerStore } from '../../hooks';
import { cn } from '../../utils';

export interface BookModeContainerProps {
  className?: string;
  /** Flip animation duration in ms (default: 800) */
  flippingTime?: number;
  /** Draw page shadows during flip (default: true) */
  drawShadow?: boolean;
  /** Max shadow opacity 0-1 (default: 0.7) */
  maxShadowOpacity?: number;
}

/** A single page inside the flipbook — must use forwardRef for react-pageflip */
const BookPage = React.forwardRef<HTMLDivElement, {
  pageNumber: number;
  page: PDFPageProxy | null;
  scale: number;
  rotation: number;
  width: number;
  height: number;
}>(function BookPage({ pageNumber, page, scale, rotation, width, height }, ref) {
  return (
    <div ref={ref} className="book-page" data-page-number={pageNumber}>
      <div style={{ width, height, overflow: 'hidden' }}>
        <PDFPage
          pageNumber={pageNumber}
          page={page}
          scale={scale}
          rotation={rotation}
          showTextLayer={false}
          showAnnotationLayer={false}
          showHighlightLayer={false}
        />
      </div>
    </div>
  );
});

export const BookModeContainer = memo(function BookModeContainer({
  className,
  flippingTime = 800,
  drawShadow = true,
  maxShadowOpacity = 0.7,
}: BookModeContainerProps) {
  const {
    document,
    currentPage,
    numPages,
    scale,
    rotation,
    theme,
    isLoading,
    goToPage,
  } = usePDFViewer();

  const scrollToPageRequest = useViewerStore((s) => s.scrollToPageRequest);
  const { viewerStore } = usePDFViewerStores();

  // All page proxy objects
  const [pages, setPages] = useState<(PDFPageProxy | null)[]>([]);
  // Raw PDF page dimensions (at scale=1, rotation=0)
  const [rawPageDims, setRawPageDims] = useState({ width: 612, height: 792 });
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Container measurement for responsive sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Flipbook ref for programmatic control
  const flipBookRef = useRef<any>(null);

  // Track whether we're syncing from flipbook → store (to avoid loops)
  const isSyncingRef = useRef(false);

  // ─── Measure container ──────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Load all pages from the PDF ──────────────────────────────────

  useEffect(() => {
    if (!document) {
      setPages([]);
      return;
    }

    let cancelled = false;

    const loadAllPages = async () => {
      setIsLoadingPages(true);
      try {
        const pagePromises: Promise<PDFPageProxy>[] = [];
        for (let i = 1; i <= numPages; i++) {
          pagePromises.push(document.getPage(i));
        }
        const results = await Promise.allSettled(pagePromises);

        if (!cancelled) {
          const loaded = results.map(r => r.status === 'fulfilled' ? r.value : null);
          setPages(loaded);

          // Get raw dimensions from first page (scale=1)
          const firstPage = loaded[0];
          if (firstPage) {
            const vp = firstPage.getViewport({ scale: 1, rotation });
            setRawPageDims({ width: vp.width, height: vp.height });
          }
        }
      } catch {
        // silently handle
      } finally {
        if (!cancelled) setIsLoadingPages(false);
      }
    };

    loadAllPages();
    return () => { cancelled = true; };
  }, [document, numPages, rotation]);

  // ─── Update raw page dimensions when rotation changes ──────────────

  useEffect(() => {
    if (pages[0]) {
      const vp = pages[0].getViewport({ scale: 1, rotation });
      setRawPageDims({ width: vp.width, height: vp.height });
    }
  }, [pages, rotation]);

  // ─── Compute fitted dimensions ─────────────────────────────────────

  const padding = 8; // px padding around the flipbook
  const fitWidth = Math.max(containerSize.width - padding * 2, 200);
  const fitHeight = Math.max(containerSize.height - padding * 2, 300);

  const pageAspect = rawPageDims.width / rawPageDims.height;
  let displayWidth: number;
  let displayHeight: number;

  // Fit within container maintaining aspect ratio
  if (fitWidth / fitHeight > pageAspect) {
    // Container is wider — height is the constraint
    displayHeight = fitHeight;
    displayWidth = Math.floor(fitHeight * pageAspect);
  } else {
    // Container is taller — width is the constraint
    displayWidth = fitWidth;
    displayHeight = Math.floor(fitWidth / pageAspect);
  }

  // Compute the scale needed to render the PDF page at the display size
  const renderScale = displayWidth / rawPageDims.width;

  // ─── Sync viewer store → flipbook (e.g. toolbar page input) ──────

  useEffect(() => {
    const pageFlip = flipBookRef.current?.pageFlip();
    if (!pageFlip) return;

    const flipBookPage = pageFlip.getCurrentPageIndex();
    const targetIndex = currentPage - 1; // flipbook is 0-indexed

    if (flipBookPage !== targetIndex) {
      isSyncingRef.current = true;
      pageFlip.turnToPage(targetIndex);
      // Reset sync flag after a short delay
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    }
  }, [currentPage]);

  // Handle scroll-to-page requests
  useEffect(() => {
    if (scrollToPageRequest) {
      requestAnimationFrame(() => {
        viewerStore.getState().completeScrollRequest(scrollToPageRequest.requestId);
      });
    }
  }, [scrollToPageRequest, viewerStore]);

  // ─── Flipbook → viewer store sync (on page flip) ─────────────────

  const handleFlip = useCallback((e: { data: number }) => {
    if (isSyncingRef.current) return;
    const newPage = e.data + 1; // flipbook is 0-indexed, viewer is 1-indexed
    if (newPage !== currentPage && newPage >= 1 && newPage <= numPages) {
      goToPage(newPage);
    }
  }, [currentPage, numPages, goToPage]);

  // ─── Theme ────────────────────────────────────────────────────────

  const themeStyles = {
    light: 'bg-gray-100',
    dark: 'bg-gray-900',
    sepia: 'bg-amber-50',
  };

  const themeClass = theme === 'dark' ? 'dark' : theme === 'sepia' ? 'sepia' : '';

  const ready = !!document && !isLoadingPages && pages.length > 0;
  const hasContainer = containerSize.width > 0 && containerSize.height > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'book-mode-container',
        'flex-1 h-full w-full overflow-hidden',
        'flex items-center justify-center',
        themeStyles[theme],
        themeClass,
        className
      )}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {!ready && (
        <PDFLoadingScreen
          phase={!document ? (isLoading ? 'fetching' : 'initializing') : 'rendering'}
        />
      )}

      {ready && hasContainer && (
        <HTMLFlipBook
          ref={flipBookRef}
          width={displayWidth}
          height={displayHeight}
          size="fixed"
          minWidth={displayWidth}
          maxWidth={displayWidth}
          minHeight={displayHeight}
          maxHeight={displayHeight}
          drawShadow={drawShadow}
          maxShadowOpacity={maxShadowOpacity}
          flippingTime={flippingTime}
          usePortrait={true}
          startPage={currentPage - 1}
          showCover={false}
          mobileScrollSupport={true}
          swipeDistance={30}
          showPageCorners={true}
          useMouseEvents={true}
          clickEventForward={false}
          onFlip={handleFlip}
          className="book-flipbook"
          style={{}}
          startZIndex={0}
          autoSize={false}
          renderOnlyPageLengthChange={false}
          disableFlipByClick={false}
        >
          {pages.map((page, index) => (
            <BookPage
              key={index}
              pageNumber={index + 1}
              page={page}
              scale={renderScale}
              rotation={rotation}
              width={displayWidth}
              height={displayHeight}
            />
          ))}
        </HTMLFlipBook>
      )}

    </div>
  );
});
