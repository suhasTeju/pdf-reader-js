import { Component, type ReactNode, type ErrorInfo } from 'react';
import { cn } from '../../utils';

export interface PDFErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show the default error UI */
  showDefaultUI?: boolean;
  className?: string;
}

interface PDFErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PDFErrorBoundary extends Component<PDFErrorBoundaryProps, PDFErrorBoundaryState> {
  constructor(props: PDFErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PDFErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);

    // Log to console for debugging
    console.error('PDFErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, showDefaultUI = true, className } = this.props;

    if (hasError && error) {
      // Custom fallback UI
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.handleReset);
        }
        return fallback;
      }

      // Default error UI
      if (showDefaultUI) {
        return (
          <DefaultErrorUI
            error={error}
            onReset={this.handleReset}
            className={className}
          />
        );
      }

      // No UI - return null
      return null;
    }

    return children;
  }
}

interface DefaultErrorUIProps {
  error: Error;
  onReset: () => void;
  className?: string;
}

function DefaultErrorUI({ error, onReset, className }: DefaultErrorUIProps) {
  const isPDFError = error.message.includes('PDF') || error.message.includes('pdf');
  const isNetworkError =
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('Failed to load');

  let title = 'Something went wrong';
  let description = error.message;
  let icon = (
    <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );

  if (isPDFError) {
    title = 'Unable to load PDF';
    description = 'The PDF file could not be loaded. It may be corrupted or in an unsupported format.';
    icon = (
      <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  } else if (isNetworkError) {
    title = 'Network error';
    description = 'Unable to fetch the PDF file. Please check your internet connection and try again.';
    icon = (
      <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
        />
      </svg>
    );
  }

  return (
    <div
      className={cn(
        'pdf-error-boundary',
        'flex flex-col items-center justify-center',
        'min-h-[300px] p-8',
        'bg-gray-50 dark:bg-gray-900',
        'text-center',
        className
      )}
    >
      {icon}

      <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h2>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md">
        {description}
      </p>

      <details className="mt-4 text-left max-w-md w-full">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Technical details
        </summary>
        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
          {error.stack || error.message}
        </pre>
      </details>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onReset}
          className={cn(
            'px-4 py-2 rounded-lg font-medium',
            'bg-blue-600 text-white',
            'hover:bg-blue-700',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'transition-colors'
          )}
        >
          Try again
        </button>

        <button
          onClick={() => window.location.reload()}
          className={cn(
            'px-4 py-2 rounded-lg font-medium',
            'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
            'hover:bg-gray-300 dark:hover:bg-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
            'transition-colors'
          )}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

// Helper component for wrapping PDF viewers with error boundary
export interface WithErrorBoundaryProps extends Omit<PDFErrorBoundaryProps, 'children'> {
  component: ReactNode;
}

export function withErrorBoundary({ component, ...props }: WithErrorBoundaryProps): ReactNode {
  return <PDFErrorBoundary {...props}>{component}</PDFErrorBoundary>;
}
