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
  const [pageDims, setPageDims] = useState({ width: 612, height: 792 });
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Flipbook ref for programmatic control
  const flipBookRef = useRef<any>(null);

  // Track whether we're syncing from flipbook → store (to avoid loops)
  const isSyncingRef = useRef(false);

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

          // Get dimensions from first page
          const firstPage = loaded[0];
          if (firstPage) {
            const vp = firstPage.getViewport({ scale, rotation });
            setPageDims({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
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
  }, [document, numPages, scale, rotation]);

  // ─── Update page dimensions when scale/rotation changes ───────────

  useEffect(() => {
    if (pages[0]) {
      const vp = pages[0].getViewport({ scale, rotation });
      setPageDims({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
    }
  }, [pages, scale, rotation]);

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

  if (!document) {
    return (
      <div className={cn('document-container', 'flex-1', themeStyles[theme], className)}>
        <PDFLoadingScreen phase={isLoading ? 'fetching' : 'initializing'} />
      </div>
    );
  }

  if (isLoadingPages || pages.length === 0) {
    return (
      <div className={cn('document-container', 'flex-1', themeStyles[theme], className)}>
        <PDFLoadingScreen phase="rendering" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'book-mode-container',
        'flex-1 overflow-hidden',
        'flex items-center justify-center',
        themeStyles[theme],
        themeClass,
        className
      )}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <HTMLFlipBook
        ref={flipBookRef}
        width={pageDims.width}
        height={pageDims.height}
        size="stretch"
        minWidth={300}
        maxWidth={pageDims.width}
        minHeight={400}
        maxHeight={pageDims.height}
        drawShadow={drawShadow}
        maxShadowOpacity={maxShadowOpacity}
        flippingTime={flippingTime}
        usePortrait={true}
        startPage={currentPage - 1}
        showCover={false}
        mobileScrollSupport={false}
        swipeDistance={30}
        showPageCorners={true}
        useMouseEvents={true}
        clickEventForward={false}
        onFlip={handleFlip}
        className="book-flipbook"
        style={{}}
        startZIndex={0}
        autoSize={true}
        renderOnlyPageLengthChange={false}
        disableFlipByClick={false}
      >
        {pages.map((page, index) => (
          <BookPage
            key={index}
            pageNumber={index + 1}
            page={page}
            scale={scale}
            rotation={rotation}
            width={pageDims.width}
            height={pageDims.height}
          />
        ))}
      </HTMLFlipBook>

      {/* Page number indicator */}
      <div className="book-page-indicator">
        {currentPage} / {numPages}
      </div>
    </div>
  );
});
