import { memo, useCallback, useState } from 'react';
import { cn } from '../../utils';

export interface QuickNoteButtonProps {
  /** Page number this button is for */
  pageNumber: number;
  /** Scale of the page */
  scale: number;
  /** Position of the button (relative to page) */
  position?: 'top-right' | 'bottom-right';
  /** Callback when button is clicked */
  onClick: (pageNumber: number, x: number, y: number) => void;
  /** Custom className */
  className?: string;
  /** Whether the button is visible */
  visible?: boolean;
}

/**
 * Floating button on each page to quickly add a note.
 */
export const QuickNoteButton = memo(function QuickNoteButton({
  pageNumber,
  scale,
  position = 'top-right',
  onClick,
  className,
  visible = true,
}: QuickNoteButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Default position near button (based on button position)
      const x = position === 'top-right' ? 80 : 80;
      const y = position === 'top-right' ? 20 : 80;
      onClick(pageNumber, x / scale, y / scale);
    },
    [pageNumber, onClick, position, scale]
  );

  if (!visible) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'quick-note-button',
        'absolute z-50',
        'w-8 h-8 rounded-full',
        'bg-yellow-400 hover:bg-yellow-500',
        'shadow-md hover:shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2',
        isHovered && 'scale-110',
        position === 'top-right' && 'top-3 right-3',
        position === 'bottom-right' && 'bottom-3 right-3',
        className
      )}
      title="Add quick note"
      aria-label="Add quick note"
    >
      <svg
        className="w-4 h-4 text-yellow-900"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
});
