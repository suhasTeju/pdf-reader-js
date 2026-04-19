import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { ActionCallout } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { ACCENT, EASE_OUT_EXPO } from './tokens';

export interface CalloutArrowProps {
  fromBbox: BBoxCoords;
  toBbox: BBoxCoords;
  action: ActionCallout;
}

function centerOf(b: BBoxCoords) {
  return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
}

/**
 * Offset the start/end points slightly away from each block's centre so
 * the arrow emerges from the edge rather than plunging into the block.
 */
function edgePoints(
  fromBbox: BBoxCoords,
  toBbox: BBoxCoords,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const a = centerOf(fromBbox);
  const b = centerOf(toBbox);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Move start/end toward the edge of each block along the line between them.
  const aHalfW = (fromBbox[2] - fromBbox[0]) / 2;
  const aHalfH = (fromBbox[3] - fromBbox[1]) / 2;
  const bHalfW = (toBbox[2] - toBbox[0]) / 2;
  const bHalfH = (toBbox[3] - toBbox[1]) / 2;

  // Clamp edge distance so tiny blocks don't produce zero-length offsets.
  const aOff = Math.min(Math.max(aHalfW, aHalfH), 60);
  const bOff = Math.min(Math.max(bHalfW, bHalfH), 60);

  return {
    from: { x: a.x + ux * aOff, y: a.y + uy * aOff },
    to: { x: b.x - ux * bOff, y: b.y - uy * bOff },
  };
}

function arrowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curve: ActionCallout['curve'],
): string {
  if (curve === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (curve === 'zigzag') {
    const mx = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} L ${mx} ${from.y} L ${mx} ${to.y} L ${to.x} ${to.y}`;
  }
  // Curved: arc perpendicular-offset from the midpoint for a gentle sweep.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx = (from.x + to.x) / 2 - dy * 0.22;
  const cy = (from.y + to.y) / 2 + dx * 0.22;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

/**
 * Design: **Editorial connector.** Hand-drawn feel via a refined stroke
 * + a small origin dot at the "from" end (like a teacher's pen planted
 * on the page before they draw the arrow). The arrowhead is a slender
 * open caret rather than a heavy filled triangle — reads as annotation,
 * not direction-signage.
 *
 * An optional label pill rides the arrow's trailing end using the same
 * editorial pin language as StickyLabel (cream paper, terracotta rule,
 * serif small-caps). Everything uses ACCENT for colour consistency.
 */
export function CalloutArrow({ fromBbox, toBbox, action }: CalloutArrowProps) {
  const markerId = useId();
  const glowId = `${markerId}-glow`;
  const { from, to } = edgePoints(fromBbox, toBbox);
  const d = arrowPath(from, to, action.curve);

  // Tight CSS box around both endpoints + arc deviation for curved
  // arrows. A curved arrow perpendicular-offsets its midpoint by
  // ~0.22 × distance, so the arc can bulge that far from the straight
  // line; zigzag stays within the endpoint box. Includes origin circle
  // (r=7 + stroke), arrow stroke (2.4), and glow stroke with
  // feGaussianBlur spread (~8 px).
  const rawMinX = Math.min(from.x, to.x);
  const rawMinY = Math.min(from.y, to.y);
  const rawMaxX = Math.max(from.x, to.x);
  const rawMaxY = Math.max(from.y, to.y);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const arcDev = action.curve === 'curved' ? dist * 0.12 : 0;
  const basePad = 16;
  const svgX = rawMinX - basePad - arcDev;
  const svgY = rawMinY - basePad - arcDev;
  const svgW = rawMaxX - rawMinX + 2 * (basePad + arcDev);
  const svgH = rawMaxY - rawMinY + 2 * (basePad + arcDev);

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`${svgX} ${svgY} ${svgW} ${svgH}`}
      style={{
        position: 'absolute',
        left: svgX,
        top: svgY,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      data-role="callout"
    >
      <defs>
        {/* Slender open-caret arrowhead — editorial, not directional signage. */}
        <marker
          id={markerId}
          viewBox="0 0 12 10"
          refX={10}
          refY={5}
          markerWidth={10}
          markerHeight={10}
          orient="auto"
        >
          <path
            d="M 1 1 L 10 5 L 1 9"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        {/* Soft glow behind the stroke for depth on light pages. */}
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Origin dot — pen planted on the "from" side. */}
      <motion.circle
        cx={from.x}
        cy={from.y}
        r={4}
        fill={ACCENT}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          transformOrigin: `${from.x}px ${from.y}px`,
          transformBox: 'fill-box',
        }}
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
      />
      <motion.circle
        cx={from.x}
        cy={from.y}
        r={7}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.2}
        strokeOpacity={0.4}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        exit={{ opacity: 0 }}
        style={{
          transformOrigin: `${from.x}px ${from.y}px`,
          transformBox: 'fill-box',
        }}
        transition={{ duration: 0.4, delay: 0.08, ease: EASE_OUT_EXPO }}
      />

      {/* Soft glow trail behind the arrow for depth. */}
      <motion.path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={6}
        strokeOpacity={0.18}
        strokeLinecap="round"
        filter={`url(#${glowId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT_EXPO }}
      />

      {/* Primary stroke — the inked arrow. */}
      <motion.path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_EXPO }}
      />

      {/* Label is rendered by CalloutLabelOverlay at viewport space —
         the SVG here sits inside the CameraView scale transform, which
         would crush label typography at fit-scale. */}
    </svg>
  );
}
