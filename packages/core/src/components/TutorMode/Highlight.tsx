import React from 'react';
import { motion } from 'framer-motion';
import type { ActionHighlight } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface HighlightProps {
  bbox: BBoxCoords;
  action: ActionHighlight;
}

export function Highlight({ bbox, action }: HighlightProps) {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        height: h,
        background: action.color,
        borderRadius: 4,
        mixBlendMode: 'multiply',
        transformOrigin: '0% 50%',
        pointerEvents: 'none',
      }}
      initial={{ width: 0, opacity: 0.9 }}
      animate={{ width: w, opacity: 0.9 }}
      exit={{ opacity: 0 }}
      transition={{ duration: action.draw_duration_ms / 1000, ease: 'easeOut' }}
      data-role="highlight"
    />
  );
}
