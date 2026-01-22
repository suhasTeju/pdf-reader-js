import { lazy, Suspense, memo } from 'react';
import type { PDFViewerProps } from '../../types';
import { cn } from '../../utils';

// Lazy load the client component to ensure it's only loaded on the client
const PDFViewerClient = lazy(() =>
  import('./PDFViewerClient').then((mod) => ({ default: mod.PDFViewerClient }))
);

interface PDFViewerLoadingProps {
  className?: string;
}

const PDFViewerLoading = memo(function PDFViewerLoading({
  className,
}: PDFViewerLoadingProps) {
  return (
    <div
      className={cn(
        'pdf-viewer pdf-viewer-loading',
        'flex flex-col h-full',
        'bg-white dark:bg-gray-900',
        className
      )}
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-sm text-gray-500">Loading PDF viewer...</div>
        </div>
      </div>
    </div>
  );
});

/**
 * Main PDF Viewer component.
 *
 * This component is SSR-safe and will only render on the client side.
 * It uses React.lazy and Suspense to defer loading of the PDF viewer
 * which depends on browser APIs.
 *
 * @example
 * ```tsx
 * import { PDFViewer } from '@pdf-reader/core';
 *
 * function App() {
 *   return (
 *     <PDFViewer
 *       src="/document.pdf"
 *       showToolbar
 *       showSidebar
 *       onDocumentLoad={(doc) => console.log('Loaded', doc.numPages, 'pages')}
 *     />
 *   );
 * }
 * ```
 */
export const PDFViewer = memo(function PDFViewer(props: PDFViewerProps) {
  // Check if we're on the server
  if (typeof window === 'undefined') {
    return <PDFViewerLoading className={props.className} />;
  }

  return (
    <Suspense fallback={<PDFViewerLoading className={props.className} />}>
      <PDFViewerClient {...props} />
    </Suspense>
  );
});
