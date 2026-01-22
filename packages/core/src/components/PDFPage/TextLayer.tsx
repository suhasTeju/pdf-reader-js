import { useEffect, useRef, memo } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { cn } from '../../utils';

export interface TextLayerProps {
  page: PDFPageProxy;
  scale: number;
  rotation: number;
  className?: string;
}

// Local type for text content to avoid pdfjs-dist version issues
interface TextContentItem {
  str?: string;
  dir?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
}

interface LocalTextContent {
  items: TextContentItem[];
}

function isTextItem(item: TextContentItem): item is Required<TextContentItem> {
  return typeof item.str === 'string' && Array.isArray(item.transform);
}

export const TextLayer = memo(function TextLayer({
  page,
  scale,
  rotation,
  className,
}: TextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageNumberRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !page) return;

    let cancelled = false;

    const renderTextLayer = async () => {
      // Clear existing text
      container.innerHTML = '';

      // Check if page number changed - if so, we need fresh text content
      const currentPageNumber = page.pageNumber;

      try {
        // Get text content - don't cache as the page object may change
        const textContent = (await page.getTextContent()) as unknown as LocalTextContent;

        // Check if cancelled or page changed during async operation
        if (cancelled || pageNumberRef.current !== currentPageNumber) {
          return;
        }

        const viewport = page.getViewport({ scale, rotation });

        // Set container dimensions
        container.style.width = `${viewport.width}px`;
        container.style.height = `${viewport.height}px`;

        // Render each text item
        for (const item of textContent.items) {
          if (cancelled) return;
          if (!isTextItem(item) || !item.str.trim()) continue;

          const [scaleX, rotY, rotX, scaleY, tx, ty] = item.transform;

          // Calculate position and font size
          const fontSize = Math.sqrt(rotX * rotX + scaleY * scaleY) * scale;
          const angle = Math.atan2(rotY, scaleX) * (180 / Math.PI) + rotation;

          // Create text span
          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.cssText = `
            position: absolute;
            left: ${tx * scale}px;
            top: ${viewport.height - ty * scale - fontSize}px;
            font-size: ${fontSize}px;
            font-family: sans-serif;
            transform-origin: 0 0;
            transform: rotate(${angle}deg) scaleX(${(item.width * scale) / (fontSize * item.str.length) || 1});
            white-space: pre;
            color: transparent;
            pointer-events: all;
            user-select: text;
          `;

          container.appendChild(span);
        }
      } catch (error) {
        // Silently ignore errors from destroyed pages
        if (!cancelled) {
          // Only log if not a page destruction error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('sendWithStream') && !errorMessage.includes('destroyed')) {
            console.error('Error rendering text layer:', error);
          }
        }
      }
    };

    pageNumberRef.current = page.pageNumber;
    renderTextLayer();

    return () => {
      cancelled = true;
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [page, scale, rotation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'pdf-text-layer',
        'absolute inset-0 overflow-hidden',
        'select-text',
        className
      )}
      style={{ zIndex: 20 }}
    />
  );
});
