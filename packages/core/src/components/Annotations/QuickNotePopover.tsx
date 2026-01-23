import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '../../utils';

export interface QuickNotePopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Position of the popover */
  position: { x: number; y: number };
  /** Initial content */
  initialContent?: string;
  /** Agent's last statement to display */
  agentLastStatement?: string;
  /** Callback when note is saved */
  onSave: (content: string) => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Custom className */
  className?: string;
}

/**
 * Popover for entering quick note content.
 */
export const QuickNotePopover = memo(function QuickNotePopover({
  visible,
  position,
  initialContent = '',
  agentLastStatement,
  onSave,
  onCancel,
  className,
}: QuickNotePopoverProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Focus textarea when visible
  useEffect(() => {
    if (visible && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [visible]);

  // Reset content when opening
  useEffect(() => {
    if (visible) {
      setContent(initialContent);
    }
  }, [visible, initialContent]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!visible || !popoverRef.current) return;

    const rect = popoverRef.current.getBoundingClientRect();
    const padding = 10;
    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position
    if (y + rect.height > window.innerHeight - padding) {
      y = window.innerHeight - rect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }

    setAdjustedPosition({ x, y });
  }, [position, visible]);

  const handleSave = useCallback(() => {
    if (content.trim()) {
      onSave(content.trim());
    } else {
      onCancel();
    }
  }, [content, onSave, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className={cn(
        'quick-note-popover',
        'fixed z-[9999]',
        'bg-yellow-50 dark:bg-yellow-900/90',
        'rounded-lg shadow-xl',
        'border border-yellow-200 dark:border-yellow-700',
        'p-3 w-72',
        'animate-in fade-in zoom-in-95 duration-150',
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Agent context hint */}
      {agentLastStatement && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/50 rounded text-xs text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
          <div className="flex items-start gap-1">
            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="line-clamp-2">AI discussed: &ldquo;{agentLastStatement}&rdquo;</span>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your note..."
        className={cn(
          'w-full h-24 px-2 py-1.5 rounded',
          'bg-white dark:bg-gray-800',
          'border border-yellow-200 dark:border-yellow-700',
          'text-gray-900 dark:text-white text-sm',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-yellow-500',
          'resize-none'
        )}
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className={cn(
              'px-3 py-1 rounded text-sm',
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'hover:bg-gray-200 dark:hover:bg-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-gray-500'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className={cn(
              'px-3 py-1 rounded text-sm font-medium',
              'bg-yellow-500 text-yellow-900',
              'hover:bg-yellow-600',
              'focus:outline-none focus:ring-2 focus:ring-yellow-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
});
