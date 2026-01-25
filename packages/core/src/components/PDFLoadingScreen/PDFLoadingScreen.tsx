import { memo } from 'react';
import { cn } from '../../utils';

export interface PDFLoadingScreenProps {
  /** 0-100 progress percentage, undefined for indeterminate */
  progress?: number;
  /** Bytes loaded */
  bytesLoaded?: number;
  /** Total bytes */
  totalBytes?: number;
  /** Current loading phase */
  phase?: 'initializing' | 'fetching' | 'parsing' | 'rendering';
  /** Optional: document title for context */
  documentName?: string;
  /** Additional class name */
  className?: string;
}

const phaseMessages: Record<string, string> = {
  initializing: 'Preparing viewer',
  fetching: 'Loading document',
  parsing: 'Processing pages',
  rendering: 'Almost ready',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Beautiful loading screen for PDF documents.
 * Shows animated document icon, progress bar, and phase-specific messages.
 */
export const PDFLoadingScreen = memo(function PDFLoadingScreen({
  progress,
  bytesLoaded,
  totalBytes,
  phase = 'fetching',
  documentName,
  className,
}: PDFLoadingScreenProps) {
  const hasProgress = progress !== undefined && progress >= 0;
  const hasBytes = bytesLoaded !== undefined && totalBytes !== undefined && totalBytes > 0;

  return (
    <div
      className={cn(
        'pdf-loading-screen',
        className
      )}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '400px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      role="status"
      aria-live="polite"
      aria-label={phaseMessages[phase]}
    >
      {/* Main loading card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 40px',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Animated document icon */}
        <div
          className="pdf-loading-icon-container"
          style={{
            position: 'relative',
            marginBottom: '32px',
          }}
        >
          {/* Glow effect */}
          <div
            className="pdf-loading-glow"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '120px',
              height: '120px',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />

          {/* Document icon */}
          <svg
            width="72"
            height="88"
            viewBox="0 0 72 88"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="pdf-document-icon"
            style={{
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.1))',
            }}
          >
            {/* Page background */}
            <path
              d="M4 8C4 3.58172 7.58172 0 12 0H44L68 24V80C68 84.4183 64.4183 88 60 88H12C7.58172 88 4 84.4183 4 80V8Z"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="2"
            />
            {/* Folded corner */}
            <path
              d="M44 0L68 24H52C47.5817 24 44 20.4183 44 16V0Z"
              fill="#dbeafe"
            />
            {/* PDF badge */}
            <rect
              x="14"
              y="36"
              width="44"
              height="20"
              rx="4"
              fill="#3b82f6"
            />
            <text
              x="36"
              y="50"
              textAnchor="middle"
              fill="white"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              PDF
            </text>
            {/* Animated lines */}
            <rect className="pdf-line-1" x="14" y="64" width="44" height="4" rx="2" fill="#e2e8f0" />
            <rect className="pdf-line-2" x="14" y="72" width="32" height="4" rx="2" fill="#e2e8f0" />
          </svg>
        </div>

        {/* Document name if available */}
        {documentName && (
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#64748b',
              marginBottom: '8px',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            {documentName}
          </p>
        )}

        {/* Phase message */}
        <p
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#1e293b',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {phaseMessages[phase]}
          <span className="pdf-loading-dots" style={{ display: 'inline-block', width: '24px', textAlign: 'left' }}>
            <span className="pdf-dot-1">.</span>
            <span className="pdf-dot-2">.</span>
            <span className="pdf-dot-3">.</span>
          </span>
        </p>

        {/* Progress bar */}
        <div style={{ width: '240px' }}>
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              background: '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              className={cn(
                'pdf-loading-progress-fill',
                !hasProgress && 'pdf-loading-progress-indeterminate'
              )}
              style={{
                height: '100%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                backgroundSize: '200% 100%',
                transition: 'width 300ms ease-out',
                ...(hasProgress ? { width: `${Math.min(100, progress)}%` } : {}),
              }}
            />
          </div>

          {/* Progress details */}
          {(hasProgress || hasBytes) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '12px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {hasProgress && (
                <span style={{ color: '#3b82f6' }}>
                  {Math.round(progress)}%
                </span>
              )}
              {hasBytes && (
                <span style={{ color: '#94a3b8', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>
                  {formatBytes(bytesLoaded)} / {formatBytes(totalBytes)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
