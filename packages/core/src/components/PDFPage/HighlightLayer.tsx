import { memo, useMemo } from 'react';
import type { Highlight, HighlightColor } from '../../types';
import { cn } from '../../utils';

export interface HighlightLayerProps {
  highlights: Highlight[];
  scale: number;
  selectedId?: string | null;
  onHighlightClick?: (highlight: Highlight) => void;
  className?: string;
  /** Filter by source type */
  sourceFilter?: 'all' | 'user' | 'agent';
}

// User highlight colors (warmer tones)
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

// Agent highlight colors (cooler tones with slight transparency difference)
const AGENT_HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.4)', // amber-400
  green: 'rgba(74, 222, 128, 0.4)', // green-400
  blue: 'rgba(96, 165, 250, 0.45)', // blue-400
  pink: 'rgba(244, 114, 182, 0.4)', // pink-400
  orange: 'rgba(251, 146, 60, 0.4)', // orange-400
};

const AGENT_HIGHLIGHT_COLORS_SELECTED: Record<HighlightColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.7)',
  green: 'rgba(74, 222, 128, 0.7)',
  blue: 'rgba(96, 165, 250, 0.75)',
  pink: 'rgba(244, 114, 182, 0.7)',
  orange: 'rgba(251, 146, 60, 0.7)',
};

export const HighlightLayer = memo(function HighlightLayer({
  highlights,
  scale,
  selectedId,
  onHighlightClick,
  className,
  sourceFilter = 'all',
}: HighlightLayerProps) {
  const filteredHighlights = useMemo(() => {
    if (sourceFilter === 'all') return highlights;
    return highlights.filter((h) => {
      const source = h.source ?? 'user';
      return source === sourceFilter;
    });
  }, [highlights, sourceFilter]);

  const renderedHighlights = useMemo(() => {
    return filteredHighlights.map((highlight) => {
      const isSelected = highlight.id === selectedId;
      const isAgentHighlight = highlight.source === 'agent';

      // Choose color palette based on source
      const colorPalette = isAgentHighlight
        ? (isSelected ? AGENT_HIGHLIGHT_COLORS_SELECTED : AGENT_HIGHLIGHT_COLORS)
        : (isSelected ? HIGHLIGHT_COLORS_SELECTED : HIGHLIGHT_COLORS);

      return (
        <div
          key={highlight.id}
          className={cn(
            'highlight-group',
            'cursor-pointer',
            isSelected && 'ring-2 ring-blue-500',
            isAgentHighlight && 'highlight-agent'
          )}
          onClick={() => onHighlightClick?.(highlight)}
          data-source={highlight.source ?? 'user'}
        >
          {highlight.rects.map((rect, index) => (
            <div
              key={`${highlight.id}-${index}`}
              className={cn(
                'absolute transition-colors duration-150',
                isAgentHighlight && 'border-b-2 border-dashed border-blue-400/50'
              )}
              style={{
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
                backgroundColor: colorPalette[highlight.color],
                mixBlendMode: 'multiply',
              }}
            />
          ))}
          {/* Agent highlight indicator */}
          {isAgentHighlight && highlight.rects[0] && (
            <div
              className="absolute -left-1 flex items-center justify-center w-3 h-3 bg-blue-500 rounded-full text-white"
              style={{
                top: highlight.rects[0].y * scale,
              }}
              title="AI highlighted"
            >
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
              </svg>
            </div>
          )}
        </div>
      );
    });
  }, [filteredHighlights, scale, selectedId, onHighlightClick]);

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
