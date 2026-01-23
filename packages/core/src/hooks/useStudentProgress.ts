import { useCallback, useMemo, useEffect } from 'react';
import { useStudentStore, useViewerStore } from './PDFViewerContext';

export interface UseStudentProgressOptions {
  /** Automatically track page visits */
  autoTrack?: boolean;
  /** Debounce time for page tracking (ms) */
  trackDebounce?: number;
}

export interface UseStudentProgressReturn {
  /** Set of visited page numbers */
  visitedPages: Set<number>;
  /** Array of visited page numbers (for easier iteration) */
  visitedPagesArray: number[];
  /** Current reading progress (0-1) */
  progress: number;
  /** Percentage of pages visited */
  visitedPercentage: number;
  /** Number of pages visited */
  visitedCount: number;
  /** Total number of pages */
  totalPages: number;
  /** Current page number */
  currentPage: number;
  /** Mark a page as visited */
  markPageVisited: (pageNumber: number) => void;
  /** Check if a page has been visited */
  isPageVisited: (pageNumber: number) => boolean;
  /** Get page visit status for minimap rendering */
  getPageStatus: (pageNumber: number) => 'current' | 'visited' | 'unvisited';
}

/**
 * Hook for tracking student reading progress.
 */
export function useStudentProgress(options: UseStudentProgressOptions = {}): UseStudentProgressReturn {
  const { autoTrack = true, trackDebounce = 1000 } = options;

  // Student store state and actions
  const visitedPages = useStudentStore((s) => s.visitedPages);
  const progress = useStudentStore((s) => s.progress);
  const markPageVisitedAction = useStudentStore((s) => s.markPageVisited);
  const setProgressAction = useStudentStore((s) => s.setProgress);

  // Viewer store for page info
  const currentPage = useViewerStore((s) => s.currentPage);
  const numPages = useViewerStore((s) => s.numPages);

  const visitedPagesArray = useMemo(
    () => Array.from(visitedPages).sort((a, b) => a - b),
    [visitedPages]
  );

  const visitedCount = visitedPages.size;
  const totalPages = numPages;

  const visitedPercentage = useMemo(() => {
    if (totalPages === 0) return 0;
    return (visitedCount / totalPages) * 100;
  }, [visitedCount, totalPages]);

  const markPageVisited = useCallback(
    (pageNumber: number) => {
      markPageVisitedAction(pageNumber);
      // Update progress based on visited pages
      if (totalPages > 0) {
        const newProgress = (visitedPages.size + 1) / totalPages;
        setProgressAction(Math.min(newProgress, 1));
      }
    },
    [markPageVisitedAction, setProgressAction, totalPages, visitedPages.size]
  );

  const isPageVisited = useCallback(
    (pageNumber: number) => {
      return visitedPages.has(pageNumber);
    },
    [visitedPages]
  );

  const getPageStatus = useCallback(
    (pageNumber: number): 'current' | 'visited' | 'unvisited' => {
      if (pageNumber === currentPage) return 'current';
      if (visitedPages.has(pageNumber)) return 'visited';
      return 'unvisited';
    },
    [currentPage, visitedPages]
  );

  // Auto-track current page visits
  useEffect(() => {
    if (!autoTrack || currentPage <= 0) return;

    const timer = setTimeout(() => {
      if (!visitedPages.has(currentPage)) {
        markPageVisited(currentPage);
      }
    }, trackDebounce);

    return () => clearTimeout(timer);
  }, [autoTrack, currentPage, trackDebounce, visitedPages, markPageVisited]);

  return useMemo(
    () => ({
      visitedPages,
      visitedPagesArray,
      progress,
      visitedPercentage,
      visitedCount,
      totalPages,
      currentPage,
      markPageVisited,
      isPageVisited,
      getPageStatus,
    }),
    [
      visitedPages,
      visitedPagesArray,
      progress,
      visitedPercentage,
      visitedCount,
      totalPages,
      currentPage,
      markPageVisited,
      isPageVisited,
      getPageStatus,
    ]
  );
}
