import { memo, useCallback, useEffect, useState } from 'react';
import { usePDFViewer } from '../../hooks';
import { cn } from '../../utils';
import type { OutlineItem } from '../../types';

export interface OutlinePanelProps {
  className?: string;
}

interface OutlineNodeProps {
  item: OutlineItem;
  level: number;
  onNavigate: (pageNumber: number) => void;
}

const OutlineNode = memo(function OutlineNode({
  item,
  level,
  onNavigate,
}: OutlineNodeProps) {
  const [isExpanded, setIsExpanded] = useState(item.expanded ?? level < 2);
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = useCallback(() => {
    if (item.pageNumber > 0) {
      onNavigate(item.pageNumber);
    }
  }, [item.pageNumber, onNavigate]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className="outline-node">
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'text-sm text-gray-700 dark:text-gray-300',
          'transition-colors'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={cn(
                'w-3 h-3 transition-transform',
                isExpanded && 'rotate-90'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <span className="w-4" /> // Spacer for alignment
        )}

        {/* Title */}
        <span className="flex-1 truncate" title={item.title}>
          {item.title}
        </span>

        {/* Page number */}
        {item.pageNumber > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            {item.pageNumber}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="outline-children">
          {item.children.map((child, index) => (
            <OutlineNode
              key={`${child.title}-${index}`}
              item={child}
              level={level + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const OutlinePanel = memo(function OutlinePanel({
  className,
}: OutlinePanelProps) {
  const { document, goToPage } = usePDFViewer();
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load outline when document changes
  useEffect(() => {
    if (!document) {
      setOutline(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const loadOutline = async () => {
      try {
        const rawOutline = await document.getOutline();

        if (cancelled) return;

        if (!rawOutline || rawOutline.length === 0) {
          setOutline([]);
          return;
        }

        // Convert PDF.js outline format to our OutlineItem format
        const convertOutlineItem = async (item: {
          title: string;
          dest: string | unknown[] | null;
          items: unknown[];
        }): Promise<OutlineItem> => {
          let pageNumber = 0;

          // Try to resolve the destination to a page number
          if (item.dest) {
            try {
              let destRef: unknown;
              if (typeof item.dest === 'string') {
                destRef = await document.getDestination(item.dest);
              } else {
                destRef = item.dest;
              }

              if (Array.isArray(destRef) && destRef[0]) {
                const pageIndex = await document.getPageIndex(destRef[0]);
                pageNumber = pageIndex + 1; // Convert to 1-indexed
              }
            } catch {
              // Destination resolution failed, leave pageNumber as 0
            }
          }

          const children: OutlineItem[] = [];
          if (item.items && item.items.length > 0) {
            for (const child of item.items) {
              children.push(await convertOutlineItem(child as typeof item));
            }
          }

          return {
            title: item.title || 'Untitled',
            pageNumber,
            children,
          };
        };

        const convertedOutline: OutlineItem[] = [];
        for (const item of rawOutline) {
          convertedOutline.push(await convertOutlineItem(item));
        }

        if (!cancelled) {
          setOutline(convertedOutline);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load outline:', err);
          setError('Failed to load document outline');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOutline();

    return () => {
      cancelled = true;
    };
  }, [document]);

  const handleNavigate = useCallback(
    (pageNumber: number) => {
      goToPage(pageNumber);
    },
    [goToPage]
  );

  if (!document) {
    return null; // Loading screen in main container handles this
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Loading outline...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!outline || outline.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 gap-2', className)}>
        <svg
          className="w-12 h-12 text-gray-300 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          This document doesn&apos;t have an outline
        </p>
      </div>
    );
  }

  return (
    <div className={cn('outline-panel overflow-auto p-2', className)}>
      {outline.map((item, index) => (
        <OutlineNode
          key={`${item.title}-${index}`}
          item={item}
          level={0}
          onNavigate={handleNavigate}
        />
      ))}
    </div>
  );
});
