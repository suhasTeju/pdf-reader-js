import { useEffect, useRef, useCallback, useState, memo } from 'react';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { cn } from '../../utils';

export interface CanvasLayerProps {
  page: PDFPageProxy;
  scale: number;
  rotation: number;
  className?: string;
  onRenderStart?: () => void;
  onRenderComplete?: () => void;
  onRenderError?: (error: Error) => void;
}

export const CanvasLayer = memo(function CanvasLayer({
  page,
  scale,
  rotation,
  className,
  onRenderStart,
  onRenderComplete,
  onRenderError,
}: CanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
  }, []);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;

    // Cancel any ongoing render
    cancelRender();

    const viewport = page.getViewport({ scale, rotation });
    const context = canvas.getContext('2d');

    if (!context) {
      onRenderError?.(new Error('Failed to get canvas context'));
      return;
    }

    // Set canvas dimensions
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Scale for high DPI displays
    context.scale(outputScale, outputScale);

    setIsRendering(true);
    onRenderStart?.();

    try {
      renderTaskRef.current = page.render({
        canvasContext: context,
        viewport,
      });

      await renderTaskRef.current.promise;
      setIsRendering(false);
      onRenderComplete?.();
    } catch (error) {
      if ((error as Error).name !== 'RenderingCancelledException') {
        setIsRendering(false);
        onRenderError?.(error as Error);
      }
    }
  }, [page, scale, rotation, cancelRender, onRenderStart, onRenderComplete, onRenderError]);

  // Render when page, scale, or rotation changes
  useEffect(() => {
    render();
    return () => cancelRender();
  }, [render, cancelRender]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pdf-canvas-layer',
        'absolute inset-0',
        isRendering && 'opacity-50',
        className
      )}
      style={{ zIndex: 10 }}
    />
  );
});
