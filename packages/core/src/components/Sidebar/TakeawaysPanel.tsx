import { memo, useMemo, useCallback, useState } from 'react';
import { useStudentStore, useViewerStore } from '../../hooks';
import type { Takeaway } from '../../types/agent-context';
import { cn } from '../../utils';

export interface TakeawaysPanelProps {
  className?: string;
  /** Callback when a takeaway item is clicked */
  onTakeawayClick?: (takeaway: Takeaway) => void;
  /** Filter by source */
  sourceFilter?: 'all' | 'agent' | 'user';
}

interface TakeawayItemProps {
  takeaway: Takeaway;
  onClick: () => void;
  onDelete: () => void;
}

const TakeawayItem = memo(function TakeawayItem({
  takeaway,
  onClick,
  onDelete,
}: TakeawayItemProps) {
  const isAgent = takeaway.source === 'agent';

  return (
    <div
      className={cn(
        'group p-3 rounded-lg cursor-pointer',
        'border border-transparent',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Source icon */}
        <div
          className={cn(
            'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
            isAgent ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-green-100 dark:bg-green-900/50'
          )}
        >
          {isAgent ? (
            <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Summary text */}
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {takeaway.summary}
          </p>

          {/* Metadata */}
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>Page {takeaway.pageNumber}</span>
            <span>&middot;</span>
            <span>{isAgent ? 'AI Summary' : 'Your Note'}</span>
          </div>
        </div>

        {/* Delete button (only for user takeaways) */}
        {!isAgent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              'p-1 rounded opacity-0 group-hover:opacity-100',
              'text-gray-400 hover:text-red-500',
              'hover:bg-red-50 dark:hover:bg-red-900/20',
              'transition-opacity duration-150',
              'focus:outline-none focus:opacity-100'
            )}
            title="Delete takeaway"
            aria-label="Delete takeaway"
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
        )}
      </div>
    </div>
  );
});

interface PageGroupProps {
  pageNumber: number;
  takeaways: Takeaway[];
  onTakeawayClick: (takeaway: Takeaway) => void;
  onDeleteTakeaway: (id: string) => void;
}

const PageGroup = memo(function PageGroup({
  pageNumber,
  takeaways,
  onTakeawayClick,
  onDeleteTakeaway,
}: PageGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
        Page {pageNumber}
      </h3>
      <div className="space-y-1">
        {takeaways.map((takeaway) => (
          <TakeawayItem
            key={takeaway.id}
            takeaway={takeaway}
            onClick={() => onTakeawayClick(takeaway)}
            onDelete={() => onDeleteTakeaway(takeaway.id)}
          />
        ))}
      </div>
    </div>
  );
});

export const TakeawaysPanel = memo(function TakeawaysPanel({
  className,
  onTakeawayClick,
  sourceFilter = 'all',
}: TakeawaysPanelProps) {
  const takeaways = useStudentStore((s) => s.takeaways);
  const removeTakeaway = useStudentStore((s) => s.removeTakeaway);
  const goToPage = useViewerStore((s) => s.goToPage);
  const [activeFilter, setActiveFilter] = useState<'all' | 'agent' | 'user'>(sourceFilter);

  // Filter takeaways by source
  const filteredTakeaways = useMemo(() => {
    if (activeFilter === 'all') return takeaways;
    return takeaways.filter((t) => t.source === activeFilter);
  }, [takeaways, activeFilter]);

  // Group takeaways by page
  const groupedTakeaways = useMemo(() => {
    const groups = new Map<number, Takeaway[]>();

    const sorted = [...filteredTakeaways].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    sorted.forEach((takeaway) => {
      const page = takeaway.pageNumber;
      if (!groups.has(page)) {
        groups.set(page, []);
      }
      groups.get(page)!.push(takeaway);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [filteredTakeaways]);

  const handleTakeawayClick = useCallback(
    (takeaway: Takeaway) => {
      goToPage(takeaway.pageNumber);
      onTakeawayClick?.(takeaway);
    },
    [goToPage, onTakeawayClick]
  );

  const handleDeleteTakeaway = useCallback(
    (id: string) => {
      removeTakeaway(id);
    },
    [removeTakeaway]
  );

  const agentCount = takeaways.filter((t) => t.source === 'agent').length;
  const userCount = takeaways.filter((t) => t.source === 'user').length;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Key Takeaways ({filteredTakeaways.length})
        </h2>

        {/* Filter tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              activeFilter === 'all'
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            All ({takeaways.length})
          </button>
          <button
            onClick={() => setActiveFilter('agent')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              activeFilter === 'agent'
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            AI ({agentCount})
          </button>
          <button
            onClick={() => setActiveFilter('user')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              activeFilter === 'user'
                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            Mine ({userCount})
          </button>
        </div>
      </div>

      {/* Takeaway list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTakeaways.length === 0 ? (
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No takeaways yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {activeFilter === 'agent'
                ? 'AI summaries will appear here as you read'
                : activeFilter === 'user'
                  ? 'Add your own key points while studying'
                  : 'Key points and summaries will appear here'}
            </p>
          </div>
        ) : (
          groupedTakeaways.map(([pageNumber, pageTakeaways]) => (
            <PageGroup
              key={pageNumber}
              pageNumber={pageNumber}
              takeaways={pageTakeaways}
              onTakeawayClick={handleTakeawayClick}
              onDeleteTakeaway={handleDeleteTakeaway}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default TakeawaysPanel;
