import React from 'react';
import { motion } from 'framer-motion';
import type { ActionCallout } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface CalloutArrowProps {
  fromBbox: BBoxCoords;
  toBbox: BBoxCoords;
  action: ActionCallout;
}

function centerOf(b: BBoxCoords) {
  return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
}

function arrowPath(
  fromBbox: BBoxCoords,
  toBbox: BBoxCoords,
  curve: ActionCallout['curve'],
): string {
  const a = centerOf(fromBbox);
  const b = centerOf(toBbox);
  if (curve === 'straight') return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (curve === 'zigzag') {
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
  }
  // curved
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = (a.x + b.x) / 2 - dy * 0.25;
  const cy = (a.y + b.y) / 2 + dx * 0.25;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export function CalloutArrow({ fromBbox, toBbox, action }: CalloutArrowProps) {
  const d = arrowPath(fromBbox, toBbox, action.curve);
  const label = action.label;
  const target = centerOf(toBbox);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      data-role="callout"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
        </marker>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke="#3B82F6"
        strokeWidth={3}
        strokeLinecap="round"
        markerEnd="url(#arrowhead)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {label ? (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <rect
            x={target.x - 4}
            y={target.y - 28}
            width={label.length * 9 + 12}
            height={22}
            rx={4}
            fill="#1F2937"
          />
          <text
            x={target.x + 2}
            y={target.y - 12}
            fill="white"
            fontSize={14}
            fontFamily="system-ui, sans-serif"
          >
            {label}
          </text>
        </motion.g>
      ) : null}
    </svg>
  );
}
