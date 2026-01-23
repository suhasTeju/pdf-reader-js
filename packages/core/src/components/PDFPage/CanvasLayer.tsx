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
  /** Priority for rendering (lower = higher priority) - used for render ordering */
  priority?: number;
}

/**
 * CanvasLayer renders a PDF page at full quality.
 *
 * Optimizations for mobile:
 * - Uses requestAnimationFrame for render timing
 * - Cancels pending renders on unmount/update
 * - Uses 'display' intent for faster rendering
 * - Disables alpha channel for better performance
 */
export const CanvasLayer = memo(function CanvasLayer({
  page,
  scale,
  rotation,
  className,
  onRenderStart,
  onRenderComplete,
  onRenderError,
  priority: _priority,
}: CanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const mountedRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);

  const cancelRender = useCallback(() => {
    // Cancel any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Cancel any ongoing render task
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

    // Use 2d context without alpha for better performance
    const context = canvas.getContext('2d', {
      alpha: false,
      // Hint for better performance on mobile
      desynchronized: true,
    });

    if (!context) {
      onRenderError?.(new Error('Failed to get canvas context'));
      return;
    }

    // Use full device pixel ratio for crisp rendering
    const outputScale = window.devicePixelRatio || 1;

    // Set canvas dimensions at full quality
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Scale for high DPI displays
    context.scale(outputScale, outputScale);

    if (mountedRef.current) {
      setIsRendering(true);
    }
    onRenderStart?.();

    try {
      renderTaskRef.current = page.render({
        canvasContext: context,
        viewport,
        // 'display' intent is faster than 'print' and sufficient for screen viewing
        intent: 'display',
      });

      await renderTaskRef.current.promise;

      if (mountedRef.current) {
        setIsRendering(false);
      }
      onRenderComplete?.();
    } catch (error) {
      if ((error as Error).name !== 'RenderingCancelledException') {
        if (mountedRef.current) {
          setIsRendering(false);
        }
        onRenderError?.(error as Error);
      }
    }
  }, [page, scale, rotation, cancelRender, onRenderStart, onRenderComplete, onRenderError]);

  // Render when page, scale, or rotation changes
  // Use requestAnimationFrame to avoid blocking the main thread
  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(() => {
      render();
    });

    return () => {
      cancelRender();
    };
  }, [render, cancelRender]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRender();
    };
  }, [cancelRender]);

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
