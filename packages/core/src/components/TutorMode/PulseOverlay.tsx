import React from 'react';
import { motion } from 'framer-motion';
import type { ActionPulse } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface PulseOverlayProps {
  bbox: BBoxCoords;
  action: ActionPulse;
}

const INTENSITY = {
  subtle: { scale: 1.02, border: '2px solid rgba(59,130,246,0.6)' },
  normal: { scale: 1.05, border: '3px solid rgba(59,130,246,0.8)' },
  strong: { scale: 1.1, border: '4px solid rgba(59,130,246,1.0)' },
} as const;

export function PulseOverlay({ bbox, action }: PulseOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  const { scale, border } = INTENSITY[action.intensity];
  const repeat = action.count === 1 ? 0 : action.count - 1;

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: x2 - x1,
        height: y2 - y1,
        border,
        borderRadius: 8,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
      animate={{ scale: [1, scale, 1] }}
      transition={{
        duration: 1.2,
        times: [0, 0.5, 1],
        ease: 'easeInOut',
        repeat,
        repeatType: 'loop',
      }}
      exit={{ opacity: 0 }}
      data-role="pulse"
    />
  );
}
