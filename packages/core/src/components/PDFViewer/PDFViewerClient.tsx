import { useEffect, useCallback, memo, useRef } from 'react';
import { PDFViewerProvider, usePDFViewerStores, useViewerStore } from '../../hooks';
import { loadDocument } from '../../utils';
import { Toolbar } from '../Toolbar';
import { Sidebar } from '../Sidebar';
import { AnnotationToolbar } from '../AnnotationToolbar';
import { DocumentContainer } from './DocumentContainer';
import { ContinuousScrollContainer } from './ContinuousScrollContainer';
import { DualPageContainer } from './DualPageContainer';
import { cn } from '../../utils';
import type { PDFViewerProps } from '../../types';

interface PDFViewerInnerProps extends PDFViewerProps {}

const PDFViewerInner = memo(function PDFViewerInner({
  src,
  initialPage = 1,
  initialScale = 1,
  showToolbar = true,
  showSidebar = true,
  showAnnotationToolbar = false,
  viewMode = 'single',
  onDocumentLoad,
  onPageChange,
  onScaleChange,
  onError,
  workerSrc,
  className,
}: PDFViewerInnerProps) {
  const { viewerStore } = usePDFViewerStores();
  const loadingRef = useRef(false);
  const srcRef = useRef(src);

  const currentPage = useViewerStore((s) => s.currentPage);
  const scale = useViewerStore((s) => s.scale);
  const theme = useViewerStore((s) => s.theme);
  const isLoading = useViewerStore((s) => s.isLoading);
  const error = useViewerStore((s) => s.error);
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);

  // Load document
  const loadDoc = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      viewerStore.getState().setLoading(true);
      viewerStore.getState().setError(null);

      const { document, numPages } = await loadDocument({
        src,
        workerSrc,
      });

      // Only update if this is still the current src
      if (srcRef.current === src) {
        viewerStore.getState().setDocument(document);

        // Set initial page and scale
        if (initialPage !== 1) {
          viewerStore.getState().goToPage(initialPage);
        }

        if (typeof initialScale === 'number' && initialScale !== 1) {
          viewerStore.getState().setScale(initialScale);
        }

        onDocumentLoad?.({ document, numPages });
      } else {
        // Document changed while loading, destroy this one
        document.destroy();
      }
    } catch (err) {
      if (srcRef.current === src) {
        const error = err instanceof Error ? err : new Error('Failed to load document');
        viewerStore.getState().setError(error);
        onError?.(error);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [src, workerSrc, initialPage, initialScale, onDocumentLoad, onError, viewerStore]);

  // Load document on mount or when src changes
  useEffect(() => {
    srcRef.current = src;

    // Reset the current document before loading new one
    const currentDoc = viewerStore.getState().document;
    if (currentDoc) {
      viewerStore.getState().reset();
    }

    loadDoc();

    return () => {
      // Cleanup when unmounting or src changes
      srcRef.current = null as unknown as typeof src;
    };
  }, [src, loadDoc, viewerStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      viewerStore.getState().reset();
    };
  }, [viewerStore]);

  // Notify parent of page changes
  useEffect(() => {
    onPageChange?.(currentPage);
  }, [currentPage, onPageChange]);

  // Notify parent of scale changes
  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  // Theme class
  const themeClass = theme === 'dark' ? 'dark' : '';

  if (error) {
    return (
      <div
        className={cn(
          'pdf-viewer pdf-viewer-error',
          'flex flex-col h-full',
          'bg-white dark:bg-gray-900',
          themeClass,
          className
        )}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-red-500 text-lg font-semibold mb-2">
              Failed to load PDF
            </div>
            <div className="text-gray-500 text-sm">{error.message}</div>
            <button
              onClick={loadDoc}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render the appropriate container based on view mode
  const renderContainer = () => {
    switch (viewMode) {
      case 'continuous':
        return <ContinuousScrollContainer />;
      case 'dual':
        return <DualPageContainer />;
      case 'single':
      default:
        return <DocumentContainer />;
    }
  };

  return (
    <div
      className={cn(
        'pdf-viewer',
        'flex flex-col h-full',
        'bg-white dark:bg-gray-900',
        'text-gray-900 dark:text-gray-100',
        themeClass,
        className
      )}
    >
      {showToolbar && <Toolbar />}
      {showAnnotationToolbar && <AnnotationToolbar />}

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && sidebarOpen && <Sidebar />}
        {renderContainer()}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="mt-2 text-sm text-gray-500">Loading PDF...</div>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * SSR-safe PDF Viewer component.
 * Wraps the inner viewer with the context provider.
 */
export const PDFViewerClient = memo(function PDFViewerClient(props: PDFViewerProps) {
  return (
    <PDFViewerProvider
      theme={props.theme}
      defaultSidebarPanel={props.defaultSidebarPanel}
    >
      <PDFViewerInner {...props} />
    </PDFViewerProvider>
  );
});
