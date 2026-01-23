import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '../../utils';

export interface AskAboutTriggerProps {
  /** Position to display the trigger */
  position: { x: number; y: number };
  /** Callback when ask about is confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Whether to show the trigger */
  visible: boolean;
  /** Auto-hide delay in ms (0 = no auto-hide) */
  autoHideDelay?: number;
  /** Custom className */
  className?: string;
}

/**
 * Confirmation UI shown after long-press completes.
 * Provides buttons to confirm or cancel the "Ask About This" action.
 */
export const AskAboutTrigger = memo(function AskAboutTrigger({
  position,
  onConfirm,
  onCancel,
  visible,
  autoHideDelay = 5000,
  className,
}: AskAboutTriggerProps) {
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!visible || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const padding = 10;
    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width / 2 > window.innerWidth - padding) {
      x = window.innerWidth - rect.width / 2 - padding;
    }
    if (x - rect.width / 2 < padding) {
      x = rect.width / 2 + padding;
    }

    // Adjust vertical position (show above if too close to bottom)
    if (y + rect.height > window.innerHeight - padding) {
      y = position.y - rect.height - 20;
    }

    setAdjustedPosition({ x, y });
  }, [position, visible]);

  // Auto-hide after delay
  useEffect(() => {
    if (!visible || autoHideDelay === 0) return;

    const timer = setTimeout(onCancel, autoHideDelay);
    return () => clearTimeout(timer);
  }, [visible, autoHideDelay, onCancel]);

  const handleConfirm = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onConfirm();
    },
    [onConfirm]
  );

  const handleCancel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCancel();
    },
    [onCancel]
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={triggerRef}
      className={cn(
        'ask-about-trigger',
        'fixed z-[9999]',
        'bg-white dark:bg-gray-800 rounded-lg shadow-lg',
        'border border-gray-200 dark:border-gray-700',
        'p-2 flex items-center gap-2',
        'animate-in fade-in zoom-in-95 duration-150',
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        transform: 'translate(-50%, 0)',
      }}
    >
      <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
        Ask about this?
      </span>
      <button
        onClick={handleConfirm}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm font-medium',
          'bg-blue-500 text-white hover:bg-blue-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'transition-colors'
        )}
      >
        Ask
      </button>
      <button
        onClick={handleCancel}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm font-medium',
          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          'hover:bg-gray-200 dark:hover:bg-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
          'transition-colors'
        )}
      >
        Cancel
      </button>
    </div>
  );
});
