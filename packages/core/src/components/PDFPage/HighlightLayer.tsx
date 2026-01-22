import { memo, useMemo } from 'react';
import type { Highlight, HighlightColor } from '../../types';
import { cn } from '../../utils';

export interface HighlightLayerProps {
  highlights: Highlight[];
  scale: number;
  selectedId?: string | null;
  onHighlightClick?: (highlight: Highlight) => void;
  className?: string;
}

const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'rgba(254, 240, 138, 0.5)',
  green: 'rgba(134, 239, 172, 0.5)',
  blue: 'rgba(147, 197, 253, 0.5)',
  pink: 'rgba(249, 168, 212, 0.5)',
  orange: 'rgba(253, 186, 116, 0.5)',
};

const HIGHLIGHT_COLORS_SELECTED: Record<HighlightColor, string> = {
  yellow: 'rgba(254, 240, 138, 0.8)',
  green: 'rgba(134, 239, 172, 0.8)',
  blue: 'rgba(147, 197, 253, 0.8)',
  pink: 'rgba(249, 168, 212, 0.8)',
  orange: 'rgba(253, 186, 116, 0.8)',
};

export const HighlightLayer = memo(function HighlightLayer({
  highlights,
  scale,
  selectedId,
  onHighlightClick,
  className,
}: HighlightLayerProps) {
  const renderedHighlights = useMemo(() => {
    return highlights.map((highlight) => {
      const isSelected = highlight.id === selectedId;

      return (
        <div
          key={highlight.id}
          className={cn(
            'highlight-group',
            'cursor-pointer',
            isSelected && 'ring-2 ring-blue-500'
          )}
          onClick={() => onHighlightClick?.(highlight)}
        >
          {highlight.rects.map((rect, index) => (
            <div
              key={`${highlight.id}-${index}`}
              className="absolute transition-colors duration-150"
              style={{
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
                backgroundColor: isSelected
                  ? HIGHLIGHT_COLORS_SELECTED[highlight.color]
                  : HIGHLIGHT_COLORS[highlight.color],
                mixBlendMode: 'multiply',
              }}
            />
          ))}
        </div>
      );
    });
  }, [highlights, scale, selectedId, onHighlightClick]);

  return (
    <div
      className={cn(
        'pdf-highlight-layer',
        'absolute inset-0 pointer-events-none',
        className
      )}
      style={{ zIndex: 40 }}
    >
      <div className="pointer-events-auto">{renderedHighlights}</div>
    </div>
  );
});
