import { memo, useMemo, useCallback, useState } from 'react';
import { useAnnotationStore } from '../../hooks';
import { usePDFViewer } from '../../hooks';
import type { Highlight, HighlightColor } from '../../types';
import { cn } from '../../utils';
import { exportHighlightsAsJSON, exportHighlightsAsMarkdown } from '../../utils/highlight-storage';

export interface HighlightsPanelProps {
  className?: string;
  /** Callback when a highlight item is clicked */
  onHighlightClick?: (highlight: Highlight) => void;
}

const HIGHLIGHT_COLOR_DOT: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
};

interface HighlightItemProps {
  highlight: Highlight;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const HighlightItem = memo(function HighlightItem({
  highlight,
  isSelected,
  onClick,
  onDelete,
}: HighlightItemProps) {
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
        {/* Color dot */}
        <div
          className={cn(
            'w-3 h-3 rounded-full mt-1 flex-shrink-0',
            HIGHLIGHT_COLOR_DOT[highlight.color]
          )}
        />

        <div className="flex-1 min-w-0">
          {/* Text preview */}
          <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">
            &ldquo;{highlight.text}&rdquo;
          </p>

          {/* Comment if exists */}
          {highlight.comment && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
              {highlight.comment}
            </p>
          )}

          {/* Page number and date */}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Page {highlight.pageNumber}
          </p>
        </div>

        {/* Delete button */}
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
          title="Delete highlight"
          aria-label="Delete highlight"
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
  );
});

interface PageGroupProps {
  pageNumber: number;
  highlights: Highlight[];
  selectedId: string | null;
  onHighlightClick: (highlight: Highlight) => void;
  onDeleteHighlight: (id: string) => void;
}

const PageGroup = memo(function PageGroup({
  pageNumber,
  highlights,
  selectedId,
  onHighlightClick,
  onDeleteHighlight,
}: PageGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
        Page {pageNumber}
      </h3>
      <div className="space-y-1">
        {highlights.map((highlight) => (
          <HighlightItem
            key={highlight.id}
            highlight={highlight}
            isSelected={highlight.id === selectedId}
            onClick={() => onHighlightClick(highlight)}
            onDelete={() => onDeleteHighlight(highlight.id)}
          />
        ))}
      </div>
    </div>
  );
});

type ExportFormat = 'json' | 'markdown';

export const HighlightsPanel = memo(function HighlightsPanel({
  className,
  onHighlightClick,
}: HighlightsPanelProps) {
  const highlights = useAnnotationStore((s) => s.highlights);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const removeHighlight = useAnnotationStore((s) => s.removeHighlight);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const { goToPage } = usePDFViewer();
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Group highlights by page
  const groupedHighlights = useMemo(() => {
    const groups = new Map<number, Highlight[]>();

    // Sort highlights by page number, then by position (y coordinate)
    const sorted = [...highlights].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      const aY = a.rects[0]?.y ?? 0;
      const bY = b.rects[0]?.y ?? 0;
      return aY - bY;
    });

    sorted.forEach((highlight) => {
      const page = highlight.pageNumber;
      if (!groups.has(page)) {
        groups.set(page, []);
      }
      groups.get(page)!.push(highlight);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [highlights]);

  const handleHighlightClick = useCallback(
    (highlight: Highlight) => {
      selectHighlight(highlight.id);
      goToPage(highlight.pageNumber);
      onHighlightClick?.(highlight);
    },
    [selectHighlight, goToPage, onHighlightClick]
  );

  const handleDeleteHighlight = useCallback(
    (id: string) => {
      removeHighlight(id);
    },
    [removeHighlight]
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = exportHighlightsAsJSON(highlights);
        filename = 'highlights.json';
        mimeType = 'application/json';
      } else {
        content = exportHighlightsAsMarkdown(highlights);
        filename = 'highlights.md';
        mimeType = 'text/markdown';
      }

      // Create download link
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowExportMenu(false);
    },
    [highlights]
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Highlights ({highlights.length})
        </h2>

        {/* Export button */}
        {highlights.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={cn(
                'p-1.5 rounded-md',
                'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              title="Export highlights"
              aria-label="Export highlights"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>

            {/* Export dropdown menu */}
            {showExportMenu && (
              <div
                className={cn(
                  'absolute right-0 mt-1 py-1 w-40',
                  'bg-white dark:bg-gray-800',
                  'rounded-lg shadow-lg',
                  'border border-gray-200 dark:border-gray-700',
                  'z-10'
                )}
              >
                <button
                  onClick={() => handleExport('json')}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm',
                    'text-gray-700 dark:text-gray-200',
                    'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm',
                    'text-gray-700 dark:text-gray-200',
                    'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  Export as Markdown
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Highlight list */}
      <div className="flex-1 overflow-y-auto p-2">
        {highlights.length === 0 ? (
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
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No highlights yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Select text in the PDF and click a color to create a highlight
            </p>
          </div>
        ) : (
          groupedHighlights.map(([pageNumber, pageHighlights]) => (
            <PageGroup
              key={pageNumber}
              pageNumber={pageNumber}
              highlights={pageHighlights}
              selectedId={selectedHighlightId}
              onHighlightClick={handleHighlightClick}
              onDeleteHighlight={handleDeleteHighlight}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default HighlightsPanel;
