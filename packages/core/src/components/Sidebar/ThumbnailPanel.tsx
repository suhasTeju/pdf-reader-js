import { useEffect, useRef, useState, memo, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePDFViewer } from '../../hooks';
import { cn } from '../../utils';

export interface ThumbnailPanelProps {
  className?: string;
  thumbnailScale?: number;
}

interface ThumbnailProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
  scale: number;
}

const Thumbnail = memo(function Thumbnail({
  document,
  pageNumber,
  isActive,
  onClick,
  scale,
}: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderThumbnail = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          setIsRendered(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`Error rendering thumbnail for page ${pageNumber}:`, error);
        }
      }
    };

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [document, pageNumber, scale]);

  return (
    <button
      onClick={onClick}
      className={cn(
        'thumbnail-item',
        'flex flex-col items-center p-2 rounded',
        'hover:bg-gray-100 dark:hover:bg-gray-700',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        isActive && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
      )}
    >
      <div
        className={cn(
          'relative bg-white shadow-md',
          !isRendered && 'animate-pulse bg-gray-200'
        )}
      >
        <canvas ref={canvasRef} className="block" />
      </div>
      <span className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {pageNumber}
      </span>
    </button>
  );
});

export const ThumbnailPanel = memo(function ThumbnailPanel({
  className,
  thumbnailScale = 0.2,
}: ThumbnailPanelProps) {
  const { document, currentPage, numPages, goToPage } = usePDFViewer();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to active thumbnail when page changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeThumb = container.querySelector(`[data-page="${currentPage}"]`);
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  const handleThumbnailClick = useCallback(
    (pageNumber: number) => {
      goToPage(pageNumber);
    },
    [goToPage]
  );

  if (!document) {
    return (
      <div className={cn('thumbnail-panel p-4', className)}>
        <div className="text-sm text-gray-500">No document loaded</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'thumbnail-panel',
        'overflow-y-auto p-2',
        'grid grid-cols-1 gap-2',
        className
      )}
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
        <div key={pageNumber} data-page={pageNumber}>
          <Thumbnail
            document={document}
            pageNumber={pageNumber}
            isActive={pageNumber === currentPage}
            onClick={() => handleThumbnailClick(pageNumber)}
            scale={thumbnailScale}
          />
        </div>
      ))}
    </div>
  );
});
