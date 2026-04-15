import React from 'react';
import { motion } from 'framer-motion';
import type { ActionLabel } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface StickyLabelProps {
  bbox: BBoxCoords;
  action: ActionLabel;
}

function position(
  bbox: BBoxCoords,
  where: ActionLabel['position'],
): React.CSSProperties {
  const [x1, y1, x2, y2] = bbox;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const PAD = 16;
  switch (where) {
    case 'top':
      return { left: cx, top: y1 - PAD, transform: 'translate(-50%, -100%)' };
    case 'bottom':
      return { left: cx, top: y2 + PAD, transform: 'translate(-50%, 0)' };
    case 'left':
      return { left: x1 - PAD, top: cy, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { left: x2 + PAD, top: cy, transform: 'translate(0, -50%)' };
    default:
      return { left: cx, top: y1, transform: 'translate(-50%, -100%)' };
  }
}

export function StickyLabel({ bbox, action }: StickyLabelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        padding: '6px 10px',
        background: '#FEF3C7',
        color: '#78350F',
        borderRadius: 6,
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 280,
        pointerEvents: 'none',
        ...position(bbox, action.position),
      }}
      data-role="label"
    >
      {action.text}
    </motion.div>
  );
}
