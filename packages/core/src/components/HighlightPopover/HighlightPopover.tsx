import { memo, useCallback, useState, useRef, useEffect } from 'react';
import type { Highlight, HighlightColor } from '../../types';
import { cn } from '../../utils';

export interface HighlightPopoverProps {
  /** The highlight to show the popover for */
  highlight: Highlight | null;
  /** The scale of the PDF page */
  scale: number;
  /** The page element containing the highlight */
  pageElement: HTMLElement | null;
  /** Callback when color is changed */
  onColorChange: (id: string, color: HighlightColor) => void;
  /** Callback when comment is updated */
  onCommentChange: (id: string, comment: string) => void;
  /** Callback when delete is clicked */
  onDelete: (id: string) => void;
  /** Callback when copy is clicked */
  onCopy?: (text: string) => void;
  /** Callback when popover is closed */
  onClose: () => void;
  /** Additional class name */
  className?: string;
}

interface PopoverPosition {
  top: number;
  left: number;
  visible: boolean;
}

const HIGHLIGHT_COLOR_OPTIONS: Array<{
  color: HighlightColor;
  bg: string;
  hoverBg: string;
  borderColor: string;
}> = [
  { color: 'yellow', bg: 'bg-yellow-300', hoverBg: 'hover:bg-yellow-400', borderColor: 'border-yellow-400' },
  { color: 'green', bg: 'bg-green-300', hoverBg: 'hover:bg-green-400', borderColor: 'border-green-400' },
  { color: 'blue', bg: 'bg-blue-300', hoverBg: 'hover:bg-blue-400', borderColor: 'border-blue-400' },
  { color: 'pink', bg: 'bg-pink-300', hoverBg: 'hover:bg-pink-400', borderColor: 'border-pink-400' },
  { color: 'orange', bg: 'bg-orange-300', hoverBg: 'hover:bg-orange-400', borderColor: 'border-orange-400' },
];

function calculatePopoverPosition(
  highlight: Highlight,
  scale: number,
  pageElement: HTMLElement | null
): PopoverPosition {
  if (!pageElement || !highlight.rects.length) {
    return { top: 0, left: 0, visible: false };
  }

  const pageRect = pageElement.getBoundingClientRect();

  // Find the first rect of the highlight
  const firstRect = highlight.rects[0];
  const scaledTop = firstRect.y * scale + pageRect.top;
  const scaledLeft = firstRect.x * scale + pageRect.left;
  const scaledWidth = firstRect.width * scale;

  // Position popover above the highlight
  const top = scaledTop - 8;
  const left = scaledLeft + scaledWidth / 2;

  return { top, left, visible: true };
}

export const HighlightPopover = memo(function HighlightPopover({
  highlight,
  scale,
  pageElement,
  onColorChange,
  onCommentChange,
  onDelete,
  onCopy,
  onClose,
  className,
}: HighlightPopoverProps) {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [comment, setComment] = useState(highlight?.comment ?? '');
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0, visible: false });
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update comment state when highlight changes
  useEffect(() => {
    setComment(highlight?.comment ?? '');
    setIsEditingComment(false);
  }, [highlight?.id, highlight?.comment]);

  // Calculate position when highlight or page element changes
  useEffect(() => {
    if (highlight && pageElement) {
      const newPosition = calculatePopoverPosition(highlight, scale, pageElement);

      if (newPosition.visible && popoverRef.current) {
        const popoverWidth = 280;
        const viewportWidth = window.innerWidth;

        let adjustedLeft = newPosition.left;
        if (adjustedLeft - popoverWidth / 2 < 8) {
          adjustedLeft = popoverWidth / 2 + 8;
        } else if (adjustedLeft + popoverWidth / 2 > viewportWidth - 8) {
          adjustedLeft = viewportWidth - popoverWidth / 2 - 8;
        }

        let adjustedTop = newPosition.top;
        const popoverHeight = isEditingComment ? 200 : 120;
        if (adjustedTop - popoverHeight < 8) {
          // Position below the highlight instead
          const lastRect = highlight.rects[highlight.rects.length - 1];
          adjustedTop = (lastRect.y + lastRect.height) * scale + pageElement.getBoundingClientRect().top + 8;
        }

        setPosition({
          top: adjustedTop,
          left: adjustedLeft,
          visible: true,
        });
      } else {
        setPosition(newPosition);
      }
    } else {
      setPosition({ top: 0, left: 0, visible: false });
    }
  }, [highlight, pageElement, scale, isEditingComment]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingComment && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditingComment]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (position.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [position.visible, onClose]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isEditingComment) {
          setIsEditingComment(false);
          setComment(highlight?.comment ?? '');
        } else {
          onClose();
        }
      }
    }

    if (position.visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [position.visible, isEditingComment, highlight?.comment, onClose]);

  const handleColorClick = useCallback(
    (color: HighlightColor) => {
      if (highlight) {
        onColorChange(highlight.id, color);
      }
    },
    [highlight, onColorChange]
  );

  const handleSaveComment = useCallback(() => {
    if (highlight) {
      onCommentChange(highlight.id, comment.trim());
      setIsEditingComment(false);
    }
  }, [highlight, comment, onCommentChange]);

  const handleDeleteClick = useCallback(() => {
    if (highlight) {
      onDelete(highlight.id);
      onClose();
    }
  }, [highlight, onDelete, onClose]);

  const handleCopyClick = useCallback(() => {
    if (highlight?.text) {
      navigator.clipboard.writeText(highlight.text);
      onCopy?.(highlight.text);
    }
  }, [highlight, onCopy]);

  if (!highlight || !position.visible) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className={cn(
        'highlight-popover',
        'fixed z-50',
        'bg-white dark:bg-gray-800',
        'rounded-lg shadow-xl',
        'border border-gray-200 dark:border-gray-700',
        'animate-in fade-in zoom-in-95 duration-150',
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%)',
        width: 280,
      }}
    >
      {/* Color picker row */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          {HIGHLIGHT_COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.color}
              onClick={() => handleColorClick(opt.color)}
              className={cn(
                'w-6 h-6 rounded-full',
                'transition-transform duration-100',
                'hover:scale-110',
                'focus:outline-none',
                opt.bg,
                opt.hoverBg,
                highlight.color === opt.color && `ring-2 ring-offset-1 ${opt.borderColor}`
              )}
              title={`Change to ${opt.color}`}
              aria-label={`Change highlight color to ${opt.color}`}
            />
          ))}
        </div>

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          className={cn(
            'p-1.5 rounded-md',
            'text-red-500 hover:text-red-600',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'focus:outline-none focus:ring-2 focus:ring-red-500'
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

      {/* Comment section */}
      <div className="p-2">
        {isEditingComment ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note..."
              className={cn(
                'w-full p-2 text-sm',
                'rounded-md border border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-gray-100',
                'placeholder-gray-500 dark:placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'resize-none'
              )}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditingComment(false);
                  setComment(highlight.comment ?? '');
                }}
                className={cn(
                  'px-3 py-1 text-sm rounded-md',
                  'text-gray-600 dark:text-gray-300',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'focus:outline-none focus:ring-2 focus:ring-gray-500'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                className={cn(
                  'px-3 py-1 text-sm rounded-md',
                  'bg-blue-500 text-white',
                  'hover:bg-blue-600',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Text preview */}
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              &ldquo;{highlight.text.slice(0, 100)}{highlight.text.length > 100 ? '...' : ''}&rdquo;
            </p>

            {/* Comment display or add button */}
            {highlight.comment ? (
              <button
                onClick={() => setIsEditingComment(true)}
                className={cn(
                  'w-full text-left p-2 rounded-md',
                  'bg-gray-50 dark:bg-gray-700/50',
                  'text-sm text-gray-700 dark:text-gray-200',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              >
                {highlight.comment}
              </button>
            ) : (
              <button
                onClick={() => setIsEditingComment(true)}
                className={cn(
                  'w-full text-left p-2 rounded-md',
                  'text-sm text-gray-500 dark:text-gray-400',
                  'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              >
                + Add a note...
              </button>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopyClick}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md',
                'text-sm text-gray-600 dark:text-gray-300',
                'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy text
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default HighlightPopover;
