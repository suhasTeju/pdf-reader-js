import React from 'react';
import { motion } from 'framer-motion';
import type { ActionGhostReference } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';

export interface GhostReferenceProps {
  page: PageDimensionsDpi;
  sourceBbox: BBoxCoords;
  sourceBlockText: string | null;
  sourcePageNumber: number;
  action: ActionGhostReference;
}

const POSITIONS: Record<
  ActionGhostReference['position'],
  React.CSSProperties
> = {
  'top-right': { top: 40, right: 40 },
  'top-left': { top: 40, left: 40 },
  'bottom-right': { bottom: 40, right: 40 },
  'bottom-left': { bottom: 40, left: 40 },
};

/**
 * Renders a floating "ghost" card referencing a block from another page.
 * Shows a minimap of the source page with the target bbox highlighted,
 * plus the block's text description as a caption.
 */
export function GhostReference({
  page,
  sourceBbox,
  sourceBlockText,
  sourcePageNumber,
  action,
}: GhostReferenceProps) {
  const width = 360;
  const [x1, y1, x2, y2] = sourceBbox;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width,
        background: '#111',
        color: 'white',
        borderRadius: 12,
        padding: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        ...POSITIONS[action.position],
      }}
      data-role="ghost-reference"
    >
      <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 6 }}>
        Page {sourcePageNumber} — {action.target_block}
      </div>
      <svg
        width={width - 24}
        height={160}
        viewBox={`0 0 ${page.width} ${page.height}`}
        style={{ background: '#1F2937', borderRadius: 6, display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={0}
          y={0}
          width={page.width}
          height={page.height}
          fill="#1F2937"
        />
        <rect
          x={x1}
          y={y1}
          width={x2 - x1}
          height={y2 - y1}
          fill="rgba(250,204,21,0.45)"
          stroke="#FBBF24"
          strokeWidth={8}
        />
      </svg>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.4,
          opacity: 0.9,
        }}
      >
        {sourceBlockText ?? '(figure)'}
      </div>
    </motion.div>
  );
}
