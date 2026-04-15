import React from 'react';
import { motion } from 'framer-motion';
import type { ActionUnderline } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface AnimatedUnderlineProps {
  bbox: BBoxCoords;
  action: ActionUnderline;
}

function pathForStyle(
  x1: number,
  x2: number,
  y: number,
  style: ActionUnderline['style'],
): string {
  if (style === 'straight') return `M ${x1} ${y} L ${x2} ${y}`;
  if (style === 'double')
    return `M ${x1} ${y - 3} L ${x2} ${y - 3} M ${x1} ${y + 3} L ${x2} ${y + 3}`;
  if (style === 'wavy') {
    const steps = Math.max(8, Math.floor((x2 - x1) / 18));
    let d = `M ${x1} ${y}`;
    for (let i = 1; i <= steps; i++) {
      const px = x1 + ((x2 - x1) * i) / steps;
      const dy = i % 2 === 0 ? 4 : -4;
      d += ` Q ${px - (x2 - x1) / (2 * steps)} ${y + dy} ${px} ${y}`;
    }
    return d;
  }
  // sketch: slight jitter
  const segs = 6;
  let d = `M ${x1} ${y}`;
  for (let i = 1; i <= segs; i++) {
    const px = x1 + ((x2 - x1) * i) / segs;
    const jitter = (Math.random() - 0.5) * 4;
    d += ` L ${px} ${y + jitter}`;
  }
  return d;
}

export function AnimatedUnderline({ bbox, action }: AnimatedUnderlineProps) {
  const [x1, , x2, y2] = bbox;
  const y = y2 + 6;
  const d = pathForStyle(x1, x2, y, action.style);
  const duration = action.draw_duration_ms / 1000;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      data-role="underline"
    >
      <motion.path
        d={d}
        fill="none"
        stroke={action.color}
        strokeWidth={4}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, ease: 'easeOut' }}
      />
    </svg>
  );
}
