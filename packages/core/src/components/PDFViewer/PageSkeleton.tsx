import { memo } from 'react';
import { cn } from '../../utils';

export interface PageSkeletonProps {
  /** Page number to display */
  pageNumber: number;
  /** Width of the skeleton (in pixels) */
  width: number;
  /** Height of the skeleton (in pixels) */
  height: number;
  /** Additional class name */
  className?: string;
  /** Whether this is the first page (show different message) */
  isFirstPage?: boolean;
}

/**
 * Page skeleton component shown while a PDF page is loading.
 * Displays an animated placeholder with the page number.
 */
export const PageSkeleton = memo(function PageSkeleton({
  pageNumber,
  width,
  height,
  className,
  isFirstPage = false,
}: PageSkeletonProps) {
  return (
    <div
      className={cn(
        'pdf-page-skeleton',
        'relative bg-white shadow-lg overflow-hidden',
        'flex items-center justify-center',
        className
      )}
      style={{
        width,
        height,
        minWidth: width,
        minHeight: height,
      }}
      data-page-number={pageNumber}
      role="img"
      aria-label={`Loading page ${pageNumber}`}
    >
      {/* Animated shimmer effect */}
      <div
        className="absolute inset-0 pdf-skeleton-shimmer"
        style={{
          background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite linear',
        }}
      />

      {/* Content placeholder lines */}
      <div className="absolute inset-0 p-6 flex flex-col" style={{ opacity: 0.4 }}>
        {/* Header area */}
        <div
          className="rounded"
          style={{
            width: '60%',
            height: 12,
            background: '#e0e0e0',
            marginBottom: 16,
          }}
        />

        {/* Content lines */}
        {[...Array(Math.min(12, Math.floor(height / 40)))].map((_, i) => (
          <div
            key={i}
            className="rounded"
            style={{
              width: `${75 + Math.sin(i * 0.7) * 20}%`,
              height: 8,
              background: '#e0e0e0',
              marginBottom: 12,
            }}
          />
        ))}
      </div>

      {/* Loading indicator overlay */}
      <div className="relative z-10 flex flex-col items-center gap-3 p-6 rounded-lg bg-white/90 shadow-sm">
        {/* Spinner */}
        <div
          className="pdf-skeleton-spinner"
          style={{
            width: 32,
            height: 32,
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />

        {/* Loading text */}
        <div className="text-sm text-gray-500 font-medium">
          {isFirstPage ? 'Loading document...' : `Loading page ${pageNumber}`}
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

// Default dimensions based on US Letter size
export const DEFAULT_PAGE_WIDTH = 612;
export const DEFAULT_PAGE_HEIGHT = 792;
