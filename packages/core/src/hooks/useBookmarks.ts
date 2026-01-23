import { useCallback, useMemo } from 'react';
import { useStudentStore, useAgentStore, useViewerStore } from './PDFViewerContext';
import type { Bookmark } from '../types/agent-context';

export interface UseBookmarksOptions {
  /** Callback when bookmark is added */
  onBookmarkAdd?: (bookmark: Bookmark) => void;
  /** Callback when bookmark is removed */
  onBookmarkRemove?: (id: string) => void;
  /** Automatically capture agent context when bookmarking */
  captureAgentContext?: boolean;
}

export interface UseBookmarksReturn {
  /** All bookmarks */
  bookmarks: Bookmark[];
  /** Bookmarks for the current page */
  currentPageBookmarks: Bookmark[];
  /** Check if current page is bookmarked */
  isCurrentPageBookmarked: boolean;
  /** Add a bookmark */
  addBookmark: (data?: Partial<Omit<Bookmark, 'id' | 'timestamp'>>) => Bookmark;
  /** Update a bookmark */
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, 'id'>>) => void;
  /** Remove a bookmark */
  removeBookmark: (id: string) => void;
  /** Toggle bookmark on current page */
  toggleBookmark: () => void;
  /** Navigate to a bookmarked page */
  goToBookmark: (bookmark: Bookmark) => void;
  /** Get bookmarks for a specific page */
  getBookmarksForPage: (pageNumber: number) => Bookmark[];
  /** Get bookmarks grouped by page */
  bookmarksByPage: Map<number, Bookmark[]>;
}

/**
 * Hook for managing bookmarks with agent context capture.
 */
export function useBookmarks(options: UseBookmarksOptions = {}): UseBookmarksReturn {
  const { onBookmarkAdd, onBookmarkRemove, captureAgentContext = true } = options;

  // Student store state and actions
  const bookmarks = useStudentStore((s) => s.bookmarks);
  const addBookmarkAction = useStudentStore((s) => s.addBookmark);
  const updateBookmarkAction = useStudentStore((s) => s.updateBookmark);
  const removeBookmarkAction = useStudentStore((s) => s.removeBookmark);

  // Agent context for capturing
  const agentContext = useAgentStore((s) => s.currentContext);

  // Viewer store for navigation
  const currentPage = useViewerStore((s) => s.currentPage);
  const goToPage = useViewerStore((s) => s.goToPage);

  const currentPageBookmarks = useMemo(
    () => bookmarks.filter((b) => b.pageNumber === currentPage),
    [bookmarks, currentPage]
  );

  const isCurrentPageBookmarked = currentPageBookmarks.length > 0;

  const bookmarksByPage = useMemo(() => {
    const map = new Map<number, Bookmark[]>();
    bookmarks.forEach((bookmark) => {
      const existing = map.get(bookmark.pageNumber) || [];
      map.set(bookmark.pageNumber, [...existing, bookmark]);
    });
    return map;
  }, [bookmarks]);

  const addBookmark = useCallback(
    (data?: Partial<Omit<Bookmark, 'id' | 'timestamp'>>) => {
      const bookmarkData = {
        pageNumber: data?.pageNumber ?? currentPage,
        userNote: data?.userNote,
        label: data?.label,
        agentContext: captureAgentContext && agentContext?.lastStatement
          ? agentContext.lastStatement
          : data?.agentContext,
      };

      const bookmark = addBookmarkAction(bookmarkData);
      onBookmarkAdd?.(bookmark);
      return bookmark;
    },
    [currentPage, captureAgentContext, agentContext, addBookmarkAction, onBookmarkAdd]
  );

  const updateBookmark = useCallback(
    (id: string, updates: Partial<Omit<Bookmark, 'id'>>) => {
      updateBookmarkAction(id, updates);
    },
    [updateBookmarkAction]
  );

  const removeBookmark = useCallback(
    (id: string) => {
      removeBookmarkAction(id);
      onBookmarkRemove?.(id);
    },
    [removeBookmarkAction, onBookmarkRemove]
  );

  const toggleBookmark = useCallback(() => {
    if (isCurrentPageBookmarked) {
      // Remove the first bookmark on the current page
      const bookmarkToRemove = currentPageBookmarks[0];
      if (bookmarkToRemove) {
        removeBookmark(bookmarkToRemove.id);
      }
    } else {
      addBookmark();
    }
  }, [isCurrentPageBookmarked, currentPageBookmarks, removeBookmark, addBookmark]);

  const goToBookmark = useCallback(
    (bookmark: Bookmark) => {
      goToPage(bookmark.pageNumber);
    },
    [goToPage]
  );

  const getBookmarksForPage = useCallback(
    (pageNumber: number) => {
      return bookmarks.filter((b) => b.pageNumber === pageNumber);
    },
    [bookmarks]
  );

  return useMemo(
    () => ({
      bookmarks,
      currentPageBookmarks,
      isCurrentPageBookmarked,
      addBookmark,
      updateBookmark,
      removeBookmark,
      toggleBookmark,
      goToBookmark,
      getBookmarksForPage,
      bookmarksByPage,
    }),
    [
      bookmarks,
      currentPageBookmarks,
      isCurrentPageBookmarked,
      addBookmark,
      updateBookmark,
      removeBookmark,
      toggleBookmark,
      goToBookmark,
      getBookmarksForPage,
      bookmarksByPage,
    ]
  );
}
