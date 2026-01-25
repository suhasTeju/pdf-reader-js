import { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePDFViewer, usePDFViewerStores } from '../../hooks';
import { cn } from '../../utils';

export interface PDFThumbnailNavProps {
  /** Scale for thumbnails (default: 0.15) */
  thumbnailScale?: number;
  /** Orientation of the thumbnail strip */
  orientation?: 'horizontal' | 'vertical';
  /** Maximum number of thumbnails visible at once */
  maxVisible?: number;
  /** Custom class name */
  className?: string;
  /** Callback when a thumbnail is clicked */
  onThumbnailClick?: (page: number) => void;
  /** Gap between thumbnails in pixels (default: 8) */
  gap?: number;
  /** Show page numbers below thumbnails (default: true) */
  showPageNumbers?: boolean;
}

interface ThumbnailData {
  pageNumber: number;
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
}

// Default page dimensions (US Letter)
const DEFAULT_WIDTH = 612;
const DEFAULT_HEIGHT = 792;

/**
 * PDFThumbnailNav provides a navigable strip of PDF page thumbnails.
 * Syncs with the current PDF viewer via store subscription.
 *
 * Features:
 * - Virtualized rendering (only visible thumbnails are rendered)
 * - Auto-scrolls to keep current page visible
 * - Click to navigate to page
 * - Horizontal or vertical orientation
 */
export const PDFThumbnailNav = memo(function PDFThumbnailNav({
  thumbnailScale = 0.15,
  orientation = 'vertical',
  maxVisible = 10,
  className,
  onThumbnailClick,
  gap = 8,
  showPageNumbers = true,
}: PDFThumbnailNavProps) {
  const { document, numPages, currentPage } = usePDFViewer();
  const { viewerStore } = usePDFViewerStores();

  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailData>>(new Map());
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: maxVisible });
  const renderQueueRef = useRef<Set<number>>(new Set());
  const pageCache = useRef<Map<number, PDFPageProxy>>(new Map());

  // Calculate thumbnail dimensions
  const thumbnailWidth = Math.floor(DEFAULT_WIDTH * thumbnailScale);
  const thumbnailHeight = Math.floor(DEFAULT_HEIGHT * thumbnailScale);

  // Update visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current || numPages === 0) return;

    const container = containerRef.current;
    const isHorizontal = orientation === 'horizontal';

    const scrollPosition = isHorizontal ? container.scrollLeft : container.scrollTop;
    const viewportSize = isHorizontal ? container.clientWidth : container.clientHeight;
    const itemSize = (isHorizontal ? thumbnailWidth : thumbnailHeight) + gap;

    const firstVisible = Math.max(1, Math.floor(scrollPosition / itemSize) + 1);
    const visibleCount = Math.ceil(viewportSize / itemSize) + 2; // Buffer
    const lastVisible = Math.min(numPages, firstVisible + visibleCount);

    setVisibleRange({ start: firstVisible, end: lastVisible });
  }, [numPages, orientation, thumbnailWidth, thumbnailHeight, gap]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      requestAnimationFrame(updateVisibleRange);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    updateVisibleRange();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateVisibleRange]);

  // Render thumbnails for visible pages
  useEffect(() => {
    if (!document) {
      setThumbnails(new Map());
      pageCache.current.clear();
      return;
    }

    const renderThumbnails = async () => {
      const newThumbnails = new Map(thumbnails);
      const pagesToRender: number[] = [];

      // Queue pages that need rendering
      for (let i = visibleRange.start; i <= visibleRange.end; i++) {
        if (!newThumbnails.has(i) && !renderQueueRef.current.has(i)) {
          pagesToRender.push(i);
          renderQueueRef.current.add(i);
        }
      }

      // Render each page
      for (const pageNum of pagesToRender) {
        try {
          let page = pageCache.current.get(pageNum);
          if (!page) {
            page = await document.getPage(pageNum);
            pageCache.current.set(pageNum, page);
          }

          const viewport = page.getViewport({ scale: thumbnailScale });

          // Create canvas for thumbnail
          const canvas = window.document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport,
            }).promise;

            newThumbnails.set(pageNum, {
              pageNumber: pageNum,
              canvas,
              width: canvas.width,
              height: canvas.height,
            });
          }
        } catch (error) {
          // Silently ignore errors from document switching/destruction
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isDocumentDestroyed =
            errorMessage.includes('destroyed') ||
            errorMessage.includes('sendWithStream') ||
            errorMessage.includes('sendWithPromise') ||
            errorMessage.includes('Cannot read properties of null');
          if (!isDocumentDestroyed) {
            console.error(`Failed to render thumbnail for page ${pageNum}:`, error);
          }
        } finally {
          renderQueueRef.current.delete(pageNum);
        }
      }

      if (pagesToRender.length > 0) {
        setThumbnails(newThumbnails);
      }
    };

    renderThumbnails();
  }, [document, visibleRange, thumbnailScale, thumbnails]);

  // Auto-scroll to keep current page visible
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;

    const container = containerRef.current;
    const isHorizontal = orientation === 'horizontal';
    const itemSize = (isHorizontal ? thumbnailWidth : thumbnailHeight) + gap;
    const targetPosition = (currentPage - 1) * itemSize;

    const scrollPosition = isHorizontal ? container.scrollLeft : container.scrollTop;
    const viewportSize = isHorizontal ? container.clientWidth : container.clientHeight;

    // Check if current page is visible
    if (targetPosition < scrollPosition || targetPosition + itemSize > scrollPosition + viewportSize) {
      // Center the current page in the viewport
      const targetScroll = targetPosition - (viewportSize - itemSize) / 2;

      container.scrollTo({
        [isHorizontal ? 'left' : 'top']: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [currentPage, numPages, orientation, thumbnailWidth, thumbnailHeight, gap]);

  // Handle thumbnail click
  const handleThumbnailClick = useCallback((pageNum: number) => {
    onThumbnailClick?.(pageNum);
    viewerStore.getState().requestScrollToPage(pageNum, 'smooth');
  }, [onThumbnailClick, viewerStore]);

  if (!document || numPages === 0) {
    return (
      <div
        className={cn(
          'pdf-thumbnail-nav',
          'flex items-center justify-center',
          'bg-gray-100 dark:bg-gray-800',
          'text-gray-500 dark:text-gray-400',
          'text-sm',
          className
        )}
        style={{
          width: orientation === 'vertical' ? thumbnailWidth + 24 : '100%',
          height: orientation === 'horizontal' ? thumbnailHeight + 40 : '100%',
        }}
      >
        No document
      </div>
    );
  }

  const isHorizontal = orientation === 'horizontal';
  const totalSize = numPages * ((isHorizontal ? thumbnailWidth : thumbnailHeight) + gap) - gap;

  return (
    <div
      ref={containerRef}
      className={cn(
        'pdf-thumbnail-nav',
        'overflow-auto',
        'bg-gray-100 dark:bg-gray-800',
        isHorizontal ? 'flex-row' : 'flex-col',
        className
      )}
      style={{
        ...(isHorizontal
          ? { overflowX: 'auto', overflowY: 'hidden' }
          : { overflowX: 'hidden', overflowY: 'auto' }),
      }}
    >
      {/* Scroll container */}
      <div
        className={cn(
          'relative',
          isHorizontal ? 'flex flex-row items-center' : 'flex flex-col items-center'
        )}
        style={{
          [isHorizontal ? 'width' : 'height']: totalSize,
          [isHorizontal ? 'minWidth' : 'minHeight']: totalSize,
          padding: gap / 2,
          gap,
        }}
      >
        {/* Render visible thumbnails */}
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const thumbnail = thumbnails.get(pageNum);
          const isActive = pageNum === currentPage;
          const isVisible = pageNum >= visibleRange.start && pageNum <= visibleRange.end;

          return (
            <div
              key={pageNum}
              className={cn(
                'pdf-thumbnail',
                'flex-shrink-0 cursor-pointer transition-all duration-200',
                'border-2 rounded shadow-sm hover:shadow-md',
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              )}
              style={{
                width: thumbnailWidth,
                height: thumbnailHeight + (showPageNumbers ? 24 : 0),
              }}
              onClick={() => handleThumbnailClick(pageNum)}
              role="button"
              tabIndex={0}
              aria-label={`Go to page ${pageNum}`}
              aria-current={isActive ? 'page' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleThumbnailClick(pageNum);
                }
              }}
            >
              {/* Thumbnail image */}
              <div
                className="relative bg-white dark:bg-gray-700"
                style={{
                  width: thumbnailWidth,
                  height: thumbnailHeight,
                }}
              >
                {isVisible && thumbnail?.canvas ? (
                  <img
                    src={thumbnail.canvas.toDataURL()}
                    alt={`Page ${pageNum}`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                    {pageNum}
                  </div>
                )}
              </div>

              {/* Page number label */}
              {showPageNumbers && (
                <div
                  className={cn(
                    'text-center text-xs py-1',
                    'bg-gray-50 dark:bg-gray-700',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  {pageNum}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
