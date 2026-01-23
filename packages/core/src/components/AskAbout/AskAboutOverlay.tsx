import { memo } from 'react';
import { cn } from '../../utils';

export interface AskAboutOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Progress of the long press (0-1) */
  progress: number;
  /** Position of the overlay */
  position: { x: number; y: number } | null;
  /** Size of the progress indicator */
  size?: number;
  /** Custom className */
  className?: string;
}

/**
 * Visual feedback overlay shown during long-press for "Ask About This" feature.
 * Displays a circular progress indicator.
 */
export const AskAboutOverlay = memo(function AskAboutOverlay({
  visible,
  progress,
  position,
  size = 60,
  className,
}: AskAboutOverlayProps) {
  if (!visible || !position) {
    return null;
  }

  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={cn(
        'ask-about-overlay',
        'fixed pointer-events-none z-[9999]',
        className
      )}
      style={{
        left: position.x - size / 2,
        top: position.y - size / 2,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(0, 0, 0, 0.3)"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-75 ease-linear"
        />
      </svg>
      {/* Center icon */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: progress >= 1 ? '#22c55e' : 'white' }}
      >
        {progress >= 1 ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </div>
    </div>
  );
});
