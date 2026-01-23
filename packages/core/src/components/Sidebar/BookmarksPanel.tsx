import { memo, useMemo, useCallback, useState } from 'react';
import { useStudentStore, useViewerStore } from '../../hooks';
import type { Bookmark } from '../../types/agent-context';
import { cn } from '../../utils';

export interface BookmarksPanelProps {
  className?: string;
  /** Callback when a bookmark item is clicked */
  onBookmarkClick?: (bookmark: Bookmark) => void;
}

interface BookmarkItemProps {
  bookmark: Bookmark;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  isSelected,
  onClick,
  onDelete,
  onEdit,
}: BookmarkItemProps) {
  return (
    <div
      className={cn(
        'group p-3 rounded-lg cursor-pointer',
        'border border-transparent',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Bookmark icon */}
        <div className="mt-0.5 flex-shrink-0">
          <svg
            className="w-4 h-4 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {/* Label or page number */}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {bookmark.label || `Page ${bookmark.pageNumber}`}
          </p>

          {/* User note if exists */}
          {bookmark.userNote && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
              {bookmark.userNote}
            </p>
          )}

          {/* Agent context if exists */}
          {bookmark.agentContext && (
            <p className="mt-1 text-xs text-blue-500 dark:text-blue-400 line-clamp-1 italic">
              AI: &ldquo;{bookmark.agentContext}&rdquo;
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {bookmark.timestamp.toLocaleDateString()} at{' '}
            {bookmark.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={cn(
              'p-1 rounded',
              'text-gray-400 hover:text-blue-500',
              'hover:bg-blue-50 dark:hover:bg-blue-900/20',
              'focus:outline-none focus:opacity-100'
            )}
            title="Edit bookmark"
            aria-label="Edit bookmark"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              'p-1 rounded',
              'text-gray-400 hover:text-red-500',
              'hover:bg-red-50 dark:hover:bg-red-900/20',
              'focus:outline-none focus:opacity-100'
            )}
            title="Delete bookmark"
            aria-label="Delete bookmark"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

interface PageGroupProps {
  pageNumber: number;
  bookmarks: Bookmark[];
  currentPage: number;
  onBookmarkClick: (bookmark: Bookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
}

const PageGroup = memo(function PageGroup({
  pageNumber,
  bookmarks,
  currentPage,
  onBookmarkClick,
  onDeleteBookmark,
  onEditBookmark,
}: PageGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
        Page {pageNumber}
      </h3>
      <div className="space-y-1">
        {bookmarks.map((bookmark) => (
          <BookmarkItem
            key={bookmark.id}
            bookmark={bookmark}
            isSelected={bookmark.pageNumber === currentPage}
            onClick={() => onBookmarkClick(bookmark)}
            onDelete={() => onDeleteBookmark(bookmark.id)}
            onEdit={() => onEditBookmark(bookmark)}
          />
        ))}
      </div>
    </div>
  );
});

interface EditModalProps {
  bookmark: Bookmark;
  onSave: (updates: { label?: string; userNote?: string }) => void;
  onClose: () => void;
}

const EditModal = memo(function EditModal({ bookmark, onSave, onClose }: EditModalProps) {
  const [label, setLabel] = useState(bookmark.label || '');
  const [userNote, setUserNote] = useState(bookmark.userNote || '');

  const handleSave = useCallback(() => {
    onSave({ label: label || undefined, userNote: userNote || undefined });
  }, [label, userNote, onSave]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit Bookmark
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Page ${bookmark.pageNumber}`}
              className={cn(
                'w-full px-3 py-2 rounded-md',
                'border border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note
            </label>
            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className={cn(
                'w-full px-3 py-2 rounded-md',
                'border border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'resize-none'
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium',
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'hover:bg-gray-200 dark:hover:bg-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-gray-500'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium',
              'bg-blue-500 text-white',
              'hover:bg-blue-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
});

export const BookmarksPanel = memo(function BookmarksPanel({
  className,
  onBookmarkClick,
}: BookmarksPanelProps) {
  const bookmarks = useStudentStore((s) => s.bookmarks);
  const removeBookmark = useStudentStore((s) => s.removeBookmark);
  const updateBookmark = useStudentStore((s) => s.updateBookmark);
  const currentPage = useViewerStore((s) => s.currentPage);
  const goToPage = useViewerStore((s) => s.goToPage);

  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  // Group bookmarks by page
  const groupedBookmarks = useMemo(() => {
    const groups = new Map<number, Bookmark[]>();

    // Sort bookmarks by page number, then by timestamp
    const sorted = [...bookmarks].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    sorted.forEach((bookmark) => {
      const page = bookmark.pageNumber;
      if (!groups.has(page)) {
        groups.set(page, []);
      }
      groups.get(page)!.push(bookmark);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [bookmarks]);

  const handleBookmarkClick = useCallback(
    (bookmark: Bookmark) => {
      goToPage(bookmark.pageNumber);
      onBookmarkClick?.(bookmark);
    },
    [goToPage, onBookmarkClick]
  );

  const handleDeleteBookmark = useCallback(
    (id: string) => {
      removeBookmark(id);
    },
    [removeBookmark]
  );

  const handleEditBookmark = useCallback((bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
  }, []);

  const handleSaveEdit = useCallback(
    (updates: { label?: string; userNote?: string }) => {
      if (editingBookmark) {
        updateBookmark(editingBookmark.id, updates);
        setEditingBookmark(null);
      }
    },
    [editingBookmark, updateBookmark]
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Bookmarks ({bookmarks.length})
        </h2>
      </div>

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto p-2">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <svg
              className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No bookmarks yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Click the bookmark button in the toolbar to save your place
            </p>
          </div>
        ) : (
          groupedBookmarks.map(([pageNumber, pageBookmarks]) => (
            <PageGroup
              key={pageNumber}
              pageNumber={pageNumber}
              bookmarks={pageBookmarks}
              currentPage={currentPage}
              onBookmarkClick={handleBookmarkClick}
              onDeleteBookmark={handleDeleteBookmark}
              onEditBookmark={handleEditBookmark}
            />
          ))
        )}
      </div>

      {/* Edit modal */}
      {editingBookmark && (
        <EditModal
          bookmark={editingBookmark}
          onSave={handleSaveEdit}
          onClose={() => setEditingBookmark(null)}
        />
      )}
    </div>
  );
});

export default BookmarksPanel;
