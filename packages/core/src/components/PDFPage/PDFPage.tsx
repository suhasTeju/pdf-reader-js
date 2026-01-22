import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { CanvasLayer } from './CanvasLayer';
import { TextLayer } from './TextLayer';
import { HighlightLayer } from './HighlightLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { useAnnotationStore } from '../../hooks';
import type { Highlight, Annotation } from '../../types';
import { cn } from '../../utils';

export interface PDFPageProps {
  pageNumber: number;
  page: PDFPageProxy | null;
  scale: number;
  rotation: number;
  className?: string;
  showTextLayer?: boolean;
  showHighlightLayer?: boolean;
  showAnnotationLayer?: boolean;
  onPageLoad?: (page: PDFPageProxy) => void;
  onRenderComplete?: () => void;
  onRenderError?: (error: Error) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onPageClick?: (pageNumber: number, point: { x: number; y: number }) => void;
}

export const PDFPage = memo(function PDFPage({
  pageNumber,
  page,
  scale,
  rotation,
  className,
  showTextLayer = true,
  showHighlightLayer = true,
  showAnnotationLayer = true,
  onRenderComplete,
  onRenderError,
  onAnnotationClick,
  onPageClick,
}: PDFPageProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to highlights and annotations arrays directly to trigger re-renders
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const allAnnotations = useAnnotationStore((s) => s.annotations);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);

  // Get annotations state
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const activeAnnotationTool = useAnnotationStore((s) => s.activeAnnotationTool);
  const drawingColor = useAnnotationStore((s) => s.drawingColor);
  const drawingStrokeWidth = useAnnotationStore((s) => s.drawingStrokeWidth);
  const currentDrawingPath = useAnnotationStore((s) => s.currentDrawingPath);
  const currentDrawingPage = useAnnotationStore((s) => s.currentDrawingPage);
  const startDrawing = useAnnotationStore((s) => s.startDrawing);
  const addDrawingPoint = useAnnotationStore((s) => s.addDrawingPoint);
  const finishDrawing = useAnnotationStore((s) => s.finishDrawing);

  // Filter highlights and annotations for this page
  const highlights = useMemo(
    () => allHighlights.filter((h) => h.pageNumber === pageNumber),
    [allHighlights, pageNumber]
  );
  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.pageNumber === pageNumber),
    [allAnnotations, pageNumber]
  );

  // Calculate dimensions when page or scale changes
  useEffect(() => {
    if (page) {
      const viewport = page.getViewport({ scale, rotation });
      setDimensions({
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      });
    }
  }, [page, scale, rotation]);

  const handleRenderStart = useCallback(() => {
    setIsRendering(true);
    setError(null);
  }, []);

  const handleRenderComplete = useCallback(() => {
    setIsRendering(false);
    onRenderComplete?.();
  }, [onRenderComplete]);

  const handleRenderError = useCallback(
    (err: Error) => {
      setIsRendering(false);
      setError(err);
      onRenderError?.(err);
    },
    [onRenderError]
  );

  const handleHighlightClick = useCallback(
    (highlight: Highlight) => {
      selectHighlight(highlight.id);
    },
    [selectHighlight]
  );

  const handleAnnotationClick = useCallback(
    (annotation: Annotation) => {
      selectAnnotation(annotation.id);
      onAnnotationClick?.(annotation);
    },
    [selectAnnotation, onAnnotationClick]
  );

  const handleDrawStart = useCallback(
    (point: { x: number; y: number }) => {
      startDrawing(pageNumber, point);
    },
    [startDrawing, pageNumber]
  );

  const handleDrawMove = useCallback(
    (point: { x: number; y: number }) => {
      addDrawingPoint(point);
    },
    [addDrawingPoint]
  );

  const handleDrawEnd = useCallback(() => {
    finishDrawing();
  }, [finishDrawing]);

  const handlePageClick = useCallback(
    (point: { x: number; y: number }) => {
      onPageClick?.(pageNumber, point);
    },
    [onPageClick, pageNumber]
  );

  if (!page) {
    return (
      <div
        className={cn(
          'pdf-page pdf-page-loading',
          'relative bg-white shadow-lg',
          'flex items-center justify-center',
          className
        )}
        style={{ width: 612 * scale, height: 792 * scale }}
        data-page-number={pageNumber}
      >
        <div className="text-gray-400">Loading page {pageNumber}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'pdf-page pdf-page-error',
          'relative bg-white shadow-lg',
          'flex items-center justify-center',
          className
        )}
        style={{ width: dimensions.width, height: dimensions.height }}
        data-page-number={pageNumber}
      >
        <div className="text-red-500">Failed to render page {pageNumber}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pdf-page',
        'relative bg-white shadow-lg',
        isRendering && 'pdf-page-rendering',
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
      }}
      data-page-number={pageNumber}
    >
      <CanvasLayer
        page={page}
        scale={scale}
        rotation={rotation}
        onRenderStart={handleRenderStart}
        onRenderComplete={handleRenderComplete}
        onRenderError={handleRenderError}
      />

      {showTextLayer && (
        <TextLayer page={page} scale={scale} rotation={rotation} />
      )}

      {showHighlightLayer && highlights.length > 0 && (
        <HighlightLayer
          highlights={highlights}
          scale={scale}
          selectedId={selectedHighlightId}
          onHighlightClick={handleHighlightClick}
        />
      )}

      {showAnnotationLayer && (
        <AnnotationLayer
          pageNumber={pageNumber}
          annotations={annotations}
          scale={scale}
          selectedId={selectedAnnotationId}
          isDrawing={currentDrawingPage === pageNumber}
          currentDrawingPath={currentDrawingPage === pageNumber ? currentDrawingPath : null}
          drawingColor={drawingColor}
          drawingStrokeWidth={drawingStrokeWidth}
          activeAnnotationTool={activeAnnotationTool}
          onAnnotationClick={handleAnnotationClick}
          onDrawStart={handleDrawStart}
          onDrawMove={handleDrawMove}
          onDrawEnd={handleDrawEnd}
          onPageClick={handlePageClick}
        />
      )}
    </div>
  );
});
