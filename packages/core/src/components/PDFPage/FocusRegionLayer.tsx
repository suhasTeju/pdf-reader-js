import { memo, useMemo } from 'react';
import type { FocusedRegion } from '../../types/agent-context';
import { cn } from '../../utils';

export interface FocusRegionLayerProps {
  focusedRegions: FocusedRegion[];
  scale: number;
  pageNumber: number;
  className?: string;
}

const FOCUS_STYLES = {
  pulse: {
    animation: 'focus-pulse 2s ease-in-out infinite',
    border: '3px solid',
    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)',
  },
  glow: {
    animation: 'focus-glow 1.5s ease-in-out infinite alternate',
    border: '2px solid',
    boxShadow: '0 0 20px 5px',
  },
  border: {
    animation: 'none',
    border: '3px dashed',
    boxShadow: 'none',
  },
};

const DEFAULT_COLORS = {
  pulse: '#3b82f6', // blue-500
  glow: '#f59e0b', // amber-500
  border: '#10b981', // emerald-500
};

export const FocusRegionLayer = memo(function FocusRegionLayer({
  focusedRegions,
  scale,
  pageNumber,
  className,
}: FocusRegionLayerProps) {
  // Filter regions for this page
  const pageRegions = useMemo(
    () => focusedRegions.filter((r) => r.pageNumber === pageNumber),
    [focusedRegions, pageNumber]
  );

  const renderedRegions = useMemo(() => {
    return pageRegions.map((region) => {
      const style = region.style ?? 'pulse';
      const color = region.color ?? DEFAULT_COLORS[style];
      const styleConfig = FOCUS_STYLES[style];

      return (
        <div
          key={region.id}
          className={cn(
            'focus-region',
            'absolute rounded-sm pointer-events-none',
            `focus-region-${style}`
          )}
          style={{
            left: region.x * scale,
            top: region.y * scale,
            width: region.width * scale,
            height: region.height * scale,
            borderColor: color,
            borderStyle: style === 'border' ? 'dashed' : 'solid',
            borderWidth: style === 'border' ? '3px' : '2px',
            boxShadow: style === 'glow' ? `0 0 20px 5px ${color}40` : undefined,
            animation: styleConfig.animation,
          }}
          data-focus-id={region.id}
          data-focus-style={style}
        />
      );
    });
  }, [pageRegions, scale]);

  if (pageRegions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'pdf-focus-region-layer',
        'absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
      style={{ zIndex: 45 }}
    >
      {renderedRegions}
      <style>{`
        @keyframes focus-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }

        @keyframes focus-glow {
          0% {
            opacity: 0.8;
            filter: brightness(1);
          }
          100% {
            opacity: 1;
            filter: brightness(1.2);
          }
        }

        .focus-region-pulse {
          animation: focus-pulse 2s ease-in-out infinite;
        }

        .focus-region-glow {
          animation: focus-glow 1.5s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
});
