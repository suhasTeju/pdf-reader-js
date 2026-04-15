import React from 'react';
import { motion } from 'framer-motion';
import type { ActionBox } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface BoxOverlayProps {
  bbox: BBoxCoords;
  action: ActionBox;
}

export function BoxOverlay({ bbox, action }: BoxOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: x2 - x1,
        height: y2 - y1,
        border: `${action.style === 'dashed' ? '3px dashed' : '3px solid'} ${action.color}`,
        borderRadius: 6,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
      data-role="box"
    />
  );
}
