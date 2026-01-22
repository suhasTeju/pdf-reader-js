import { memo, useEffect, useState, useCallback, useRef } from 'react';
import type { TextSelection, HighlightColor } from '../../types';
import { cn } from '../../utils';

export interface SelectionToolbarProps {
  /** Current text selection */
  selection: TextSelection | null;
  /** Callback when a color is clicked to create highlight */
  onCreateHighlight: (color: HighlightColor) => void;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
  /** Active/default highlight color */
  activeColor?: HighlightColor;
  /** Additional class name */
  className?: string;
}

interface ToolbarPosition {
  top: number;
  left: number;
  visible: boolean;
}

const HIGHLIGHT_COLOR_BUTTONS: Array<{
  color: HighlightColor;
  bg: string;
  hoverBg: string;
  ringColor: string;
}> = [
  { color: 'yellow', bg: 'bg-yellow-300', hoverBg: 'hover:bg-yellow-400', ringColor: 'ring-yellow-400' },
  { color: 'green', bg: 'bg-green-300', hoverBg: 'hover:bg-green-400', ringColor: 'ring-green-400' },
  { color: 'blue', bg: 'bg-blue-300', hoverBg: 'hover:bg-blue-400', ringColor: 'ring-blue-400' },
  { color: 'pink', bg: 'bg-pink-300', hoverBg: 'hover:bg-pink-400', ringColor: 'ring-pink-400' },
  { color: 'orange', bg: 'bg-orange-300', hoverBg: 'hover:bg-orange-400', ringColor: 'ring-orange-400' },
];

function calculatePosition(selection: TextSelection): ToolbarPosition {
  if (!selection || selection.rects.length === 0) {
    return { top: 0, left: 0, visible: false };
  }

  // Find the first rect (topmost, leftmost)
  const firstRect = selection.rects.reduce((min, rect) => {
    if (rect.top < min.top || (rect.top === min.top && rect.left < min.left)) {
      return rect;
    }
    return min;
  }, selection.rects[0]);

  // Position toolbar above the selection
  const top = firstRect.top - 48; // 48px above (40px toolbar height + 8px gap)
  const left = firstRect.left + firstRect.width / 2;

  return { top, left, visible: true };
}

export const SelectionToolbar = memo(function SelectionToolbar({
  selection,
  onCreateHighlight,
  onCopy,
  activeColor = 'yellow',
  className,
}: SelectionToolbarProps) {
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0, visible: false });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Calculate position when selection changes
  useEffect(() => {
    if (selection && selection.text && selection.rects.length > 0) {
      const newPosition = calculatePosition(selection);

      // Adjust position to keep toolbar within viewport
      if (toolbarRef.current && newPosition.visible) {
        const toolbarWidth = 200; // Approximate toolbar width
        const viewportWidth = window.innerWidth;

        // Ensure toolbar doesn't go off left edge
        let adjustedLeft = newPosition.left - toolbarWidth / 2;
        if (adjustedLeft < 8) adjustedLeft = 8;

        // Ensure toolbar doesn't go off right edge
        if (adjustedLeft + toolbarWidth > viewportWidth - 8) {
          adjustedLeft = viewportWidth - toolbarWidth - 8;
        }

        // Ensure toolbar doesn't go above viewport
        let adjustedTop = newPosition.top;
        if (adjustedTop < 8) {
          // Position below selection instead
          const lastRect = selection.rects[selection.rects.length - 1];
          adjustedTop = lastRect.bottom + 8;
        }

        setPosition({
          top: adjustedTop,
          left: adjustedLeft + toolbarWidth / 2,
          visible: true,
        });
      } else {
        setPosition(newPosition);
      }
    } else {
      setPosition({ top: 0, left: 0, visible: false });
    }
  }, [selection]);

  const handleColorClick = useCallback(
    (color: HighlightColor) => {
      onCreateHighlight(color);
    },
    [onCreateHighlight]
  );

  const handleCopy = useCallback(() => {
    onCopy?.();
  }, [onCopy]);

  if (!position.visible || !selection?.text) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'selection-toolbar',
        'fixed z-50',
        'flex items-center gap-1 p-1.5',
        'bg-white dark:bg-gray-800',
        'rounded-lg shadow-lg',
        'border border-gray-200 dark:border-gray-700',
        'animate-in fade-in zoom-in-95 duration-150',
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => {
        // Prevent toolbar clicks from clearing the selection
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Highlight color buttons */}
      {HIGHLIGHT_COLOR_BUTTONS.map((btn) => (
        <button
          key={btn.color}
          onClick={() => handleColorClick(btn.color)}
          className={cn(
            'w-7 h-7 rounded-full',
            'flex items-center justify-center',
            'transition-transform duration-100',
            'hover:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-offset-1',
            btn.bg,
            btn.hoverBg,
            btn.ringColor,
            activeColor === btn.color && 'ring-2 ring-offset-1'
          )}
          title={`Highlight ${btn.color}`}
          aria-label={`Highlight with ${btn.color}`}
        >
          {/* Highlighter icon */}
          <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          'p-1.5 rounded-md',
          'text-gray-600 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500'
        )}
        title="Copy text"
        aria-label="Copy selected text"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );
});

export default SelectionToolbar;
