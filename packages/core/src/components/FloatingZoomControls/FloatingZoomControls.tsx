import { memo, useCallback } from 'react';
import { useViewerStore, usePDFViewerStores } from '../../hooks';
import { cn } from '../../utils';

export interface FloatingZoomControlsProps {
  /** Position of the controls */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Additional class name */
  className?: string;
  /** Show fit to width button */
  showFitToWidth?: boolean;
  /** Show fit to page button */
  showFitToPage?: boolean;
  /** Show zoom percentage */
  showZoomLevel?: boolean;
}

/**
 * Floating zoom controls for easy zoom adjustment.
 * Shows +/- buttons and optionally fit-to-width/fit-to-page buttons.
 */
export const FloatingZoomControls = memo(function FloatingZoomControls({
  position = 'bottom-right',
  className,
  showFitToWidth = true,
  showFitToPage = false,
  showZoomLevel = true,
}: FloatingZoomControlsProps) {
  const { viewerStore } = usePDFViewerStores();
  const scale = useViewerStore((s) => s.scale);
  const document = useViewerStore((s) => s.document);

  const handleZoomIn = useCallback(() => {
    const currentScale = viewerStore.getState().scale;
    const newScale = Math.min(4, currentScale + 0.05);
    viewerStore.getState().setScale(newScale);
  }, [viewerStore]);

  const handleZoomOut = useCallback(() => {
    const currentScale = viewerStore.getState().scale;
    const newScale = Math.max(0.1, currentScale - 0.05);
    viewerStore.getState().setScale(newScale);
  }, [viewerStore]);

  const handleFitToWidth = useCallback(() => {
    // This will be calculated based on container width
    // For now, set a reasonable default that typically fits width
    viewerStore.getState().setScale(1.0);
  }, [viewerStore]);

  const handleFitToPage = useCallback(() => {
    viewerStore.getState().setScale(0.75);
  }, [viewerStore]);

  // Don't render if no document
  if (!document) return null;

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  const zoomPercentage = Math.round(scale * 100);

  return (
    <div
      className={cn(
        'fixed z-50 flex items-center gap-1',
        'bg-white dark:bg-gray-800 rounded-lg shadow-lg',
        'border border-gray-200 dark:border-gray-700',
        'p-1',
        positionClasses[position],
        className
      )}
    >
      {/* Zoom Out */}
      <button
        onClick={handleZoomOut}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded',
          'text-gray-700 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        disabled={scale <= 0.25}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Zoom Level */}
      {showZoomLevel && (
        <span className="min-w-[48px] text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          {zoomPercentage}%
        </span>
      )}

      {/* Zoom In */}
      <button
        onClick={handleZoomIn}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded',
          'text-gray-700 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        disabled={scale >= 4}
        title="Zoom In"
        aria-label="Zoom In"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Divider */}
      {(showFitToWidth || showFitToPage) && (
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
      )}

      {/* Fit to Width */}
      {showFitToWidth && (
        <button
          onClick={handleFitToWidth}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded',
            'text-gray-700 dark:text-gray-300',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors'
          )}
          title="Fit to Width"
          aria-label="Fit to Width"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      )}

      {/* Fit to Page */}
      {showFitToPage && (
        <button
          onClick={handleFitToPage}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded',
            'text-gray-700 dark:text-gray-300',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors'
          )}
          title="Fit to Page"
          aria-label="Fit to Page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
});
