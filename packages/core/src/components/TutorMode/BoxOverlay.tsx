import React from 'react';
import { motion } from 'framer-motion';
import type { ActionBox } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { ACCENT, ACCENT_SOFT, EASE_OUT_EXPO } from './tokens';

export interface BoxOverlayProps {
  bbox: BBoxCoords;
  action: ActionBox;
}

/**
 * Design: **Framed region.** A structural region marker — thinner and
 * more refined than the previous generic 3px coloured border. A subtle
 * accent-tinted wash fills the interior so the framed region reads as
 * "selected" even without a thick border. Dashed style uses a custom
 * dash pattern that matches the editorial vocabulary.
 *
 * Honours `action.color` when the LLM specifies something non-default,
 * otherwise falls through to the terracotta accent so boxes fit the
 * system.
 */
export function BoxOverlay({ bbox, action }: BoxOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  const useSystem =
    !action.color ||
    action.color === '#3B82F6' ||
    action.color === '#3b82f6';
  const borderColor = useSystem ? ACCENT : action.color;
  const washColor = useSystem ? ACCENT_SOFT : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
      style={{
        position: 'absolute',
        left: x1 - 3,
        top: y1 - 3,
        width: x2 - x1 + 6,
        height: y2 - y1 + 6,
        border: `${
          action.style === 'dashed' ? '2px dashed' : '2px solid'
        } ${borderColor}`,
        borderRadius: 4,
        background: washColor,
        pointerEvents: 'none',
        boxSizing: 'border-box',
        // Subtle outer glow for the accent version, tinted to match.
        boxShadow: useSystem
          ? `0 0 0 1px rgba(176, 74, 26, 0.10), 0 8px 24px -10px rgba(176, 74, 26, 0.35)`
          : undefined,
      }}
      data-role="box"
    />
  );
}
