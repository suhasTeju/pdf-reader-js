import { memo, useMemo, useCallback } from 'react';
import { useStudentStore, useViewerStore } from '../../hooks';
import { cn } from '../../utils';

export interface MinimapProps {
  /** Display variant */
  variant?: 'sidebar' | 'floating';
  /** Position for floating variant */
  floatingPosition?: 'left' | 'right';
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Whether to show page numbers */
  showPageNumbers?: boolean;
  /** Callback when a page is clicked */
  onPageClick?: (pageNumber: number) => void;
  /** Custom className */
  className?: string;
}

type PageStatus = 'current' | 'visited' | 'bookmarked' | 'unvisited';

interface PageIndicatorProps {
  pageNumber: number;
  status: PageStatus;
  isBookmarked: boolean;
  onClick: () => void;
  showNumber: boolean;
  compact: boolean;
}

const PageIndicator = memo(function PageIndicator({
  pageNumber,
  status,
  isBookmarked,
  onClick,
  showNumber,
  compact,
}: PageIndicatorProps) {
  const getStatusColor = () => {
    if (status === 'current') return 'bg-blue-500';
    if (isBookmarked) return 'bg-yellow-400';
    if (status === 'visited') return 'bg-green-400';
    return 'bg-gray-200 dark:bg-gray-700';
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'minimap-page-indicator',
        'relative rounded-sm transition-all duration-150',
        'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        compact ? 'w-2 h-3' : 'w-4 h-5',
        getStatusColor(),
        status === 'current' && 'ring-2 ring-blue-600 ring-offset-1'
      )}
      title={`Page ${pageNumber}${isBookmarked ? ' (bookmarked)' : ''}`}
      aria-label={`Go to page ${pageNumber}`}
    >
      {isBookmarked && !compact && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-white" />
      )}
      {showNumber && !compact && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-white">
          {pageNumber}
        </span>
      )}
    </button>
  );
});

/**
 * Visual minimap showing reading progress and navigation.
 */
export const Minimap = memo(function Minimap({
  variant = 'sidebar',
  floatingPosition = 'right',
  maxHeight = 300,
  showPageNumbers = false,
  onPageClick,
  className,
}: MinimapProps) {
  // Store state
  const visitedPages = useStudentStore((s) => s.visitedPages);
  const bookmarks = useStudentStore((s) => s.bookmarks);
  const currentPage = useViewerStore((s) => s.currentPage);
  const numPages = useViewerStore((s) => s.numPages);
  const goToPage = useViewerStore((s) => s.goToPage);

  // Create set of bookmarked pages for quick lookup
  const bookmarkedPages = useMemo(() => {
    return new Set(bookmarks.map((b) => b.pageNumber));
  }, [bookmarks]);

  // Determine if we should use compact mode based on page count
  const compact = numPages > 50;

  const handlePageClick = useCallback(
    (pageNumber: number) => {
      goToPage(pageNumber);
      onPageClick?.(pageNumber);
    },
    [goToPage, onPageClick]
  );

  const getPageStatus = useCallback(
    (pageNumber: number): PageStatus => {
      if (pageNumber === currentPage) return 'current';
      if (bookmarkedPages.has(pageNumber)) return 'bookmarked';
      if (visitedPages.has(pageNumber)) return 'visited';
      return 'unvisited';
    },
    [currentPage, visitedPages, bookmarkedPages]
  );

  // Generate page indicators
  const pageIndicators = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= numPages; i++) {
      pages.push(
        <PageIndicator
          key={i}
          pageNumber={i}
          status={getPageStatus(i)}
          isBookmarked={bookmarkedPages.has(i)}
          onClick={() => handlePageClick(i)}
          showNumber={showPageNumbers}
          compact={compact}
        />
      );
    }
    return pages;
  }, [numPages, getPageStatus, bookmarkedPages, handlePageClick, showPageNumbers, compact]);

  // Progress stats
  const visitedCount = visitedPages.size;
  const progressPercentage = numPages > 0 ? Math.round((visitedCount / numPages) * 100) : 0;

  if (numPages === 0) {
    return null;
  }

  const content = (
    <>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Page indicators */}
      <div
        className={cn(
          'flex flex-wrap gap-1 overflow-y-auto',
          compact ? 'gap-0.5' : 'gap-1'
        )}
        style={{ maxHeight: maxHeight - 60 }}
      >
        {pageIndicators}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-blue-500" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-400" />
            <span>Visited</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-yellow-400" />
            <span>Bookmarked</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {visitedCount} of {numPages} pages visited
      </div>
    </>
  );

  if (variant === 'floating') {
    return (
      <div
        className={cn(
          'minimap minimap-floating',
          'fixed z-40',
          'bg-white dark:bg-gray-800',
          'rounded-lg shadow-lg',
          'border border-gray-200 dark:border-gray-700',
          'p-3 w-48',
          floatingPosition === 'right' ? 'right-4' : 'left-4',
          'top-1/2 -translate-y-1/2',
          className
        )}
        style={{ maxHeight }}
      >
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Reading Progress
        </h3>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'minimap minimap-sidebar',
        'p-3',
        className
      )}
      style={{ maxHeight }}
    >
      {content}
    </div>
  );
});
