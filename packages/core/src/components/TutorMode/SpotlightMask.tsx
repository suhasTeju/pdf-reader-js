import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { ActionSpotlight } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';

export interface SpotlightMaskProps {
  page: PageDimensionsDpi;
  bbox: BBoxCoords;
  action: ActionSpotlight;
  durationMs?: number;
}

/**
 * Full-page SVG overlay: dims the entire page with action.dim_opacity,
 * then "cuts out" a rounded/rect/ellipse hole over the target bbox so
 * the underlying page shows through. Uses an SVG mask with a blur filter
 * to feather the edge.
 *
 * Rendered in PAGE coords (viewBox spans the full page). The parent
 * CinemaLayer applies the overall scale transform.
 */
export function SpotlightMask({
  page,
  bbox,
  action,
  durationMs = 400,
}: SpotlightMaskProps) {
  const maskId = useId();
  const filterId = `${maskId}-blur`;
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const rx =
    action.shape === 'rounded' ? 12 : action.shape === 'ellipse' ? w / 2 : 0;
  const ry =
    action.shape === 'rounded' ? 12 : action.shape === 'ellipse' ? h / 2 : 0;
  const feather = action.feather_px;

  return (
    <svg
      viewBox={`0 0 ${page.width} ${page.height}`}
      width={page.width}
      height={page.height}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        width: page.width,
        height: page.height,
      }}
      data-role="spotlight-mask"
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={feather / 4} />
        </filter>
        <mask id={maskId}>
          <rect x={0} y={0} width={page.width} height={page.height} fill="white" />
          {action.shape === 'ellipse' ? (
            <ellipse
              cx={(x1 + x2) / 2}
              cy={(y1 + y2) / 2}
              rx={w / 2}
              ry={h / 2}
              fill="black"
              filter={`url(#${filterId})`}
            />
          ) : (
            <rect
              x={x1}
              y={y1}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              fill="black"
              filter={`url(#${filterId})`}
            />
          )}
        </mask>
      </defs>
      <motion.rect
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        fill="black"
        mask={`url(#${maskId})`}
        initial={{ fillOpacity: 0 }}
        animate={{ fillOpacity: action.dim_opacity }}
        exit={{ fillOpacity: 0 }}
        transition={{ duration: durationMs / 1000, ease: 'easeOut' }}
      />
    </svg>
  );
}
