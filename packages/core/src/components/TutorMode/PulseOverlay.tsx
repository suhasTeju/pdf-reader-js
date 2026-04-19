import React from 'react';
import { motion } from 'framer-motion';
import type { ActionPulse } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { ACCENT, ACCENT_GLOW, EASE_OUT_EXPO } from './tokens';

export interface PulseOverlayProps {
  bbox: BBoxCoords;
  action: ActionPulse;
}

type IntensitySpec = {
  bracketLen: number;
  strokeWeight: number;
  coreOpacity: number;
  ringScale: number;
};

const INTENSITY: Record<ActionPulse['intensity'], IntensitySpec> = {
  subtle: { bracketLen: 14, strokeWeight: 2, coreOpacity: 0.5, ringScale: 1.08 },
  normal: { bracketLen: 20, strokeWeight: 2.5, coreOpacity: 0.75, ringScale: 1.14 },
  strong: { bracketLen: 26, strokeWeight: 3, coreOpacity: 1, ringScale: 1.22 },
};

/**
 * Design: **Camera viewfinder brackets.** Four L-shapes slide in from
 * each corner of the target block, like framing crosshairs on a camera.
 * Behind them, a soft radial glow pulses in sync with the bracket
 * emphasis — a "look here" cue that points without blocking content.
 *
 * Intensity controls bracket length + stroke weight + glow strength.
 * `count` controls how many emphasis pulses happen before the overlay
 * settles.
 *
 * Brackets slide in from OUTSIDE the block then snap to the corners,
 * which reads as "framing" rather than the usual bordered box.
 */
export function PulseOverlay({ bbox, action }: PulseOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const spec = INTENSITY[action.intensity] ?? INTENSITY.normal;
  // Cap bracket length to at most a third of the shorter side so tiny
  // blocks don't get brackets that exceed their own geometry.
  const L = Math.min(spec.bracketLen, Math.min(w, h) / 2.5);
  const PAD = 6;

  // Tight CSS box so the compositor doesn't allocate a full-page layer
  // per pulse. Three drawn extents matter, in roughly descending size:
  //   - Emphasis ring scaled up to ringScale (1.22 at peak)
  //   - Glow ellipse at rx = w/2 + 10, scaled up to ringScale, plus a
  //     CSS `filter: blur(16px)` which spreads outside the ellipse bbox
  //   - Brackets slide in from PAD + L + 8 px outside the block corners
  const ringExtentX = (w / 2 + PAD) * spec.ringScale - w / 2;
  const ringExtentY = (h / 2 + PAD) * spec.ringScale - h / 2;
  const glowExtentX = (w / 2 + 10) * spec.ringScale - w / 2 + 24; // +24 covers blur(16) spread
  const glowExtentY = (h / 2 + 10) * spec.ringScale - h / 2 + 24;
  const bracketExtent = PAD + L + 8;
  const svgPadX = Math.ceil(Math.max(40, ringExtentX, glowExtentX, bracketExtent));
  const svgPadY = Math.ceil(Math.max(40, ringExtentY, glowExtentY, bracketExtent));
  const svgX = x1 - svgPadX;
  const svgY = y1 - svgPadY;
  const svgW = w + 2 * svgPadX;
  const svgH = h + 2 * svgPadY;
  // Both the outer glow and the emphasis ring play ONCE. The schema
  // still accepts an `action.count`, but playing it as a repeated loop
  // reads as "ambient warning" rather than "look here" and becomes
  // distracting over a whole narration session. One well-shaped pulse
  // is enough — intensity is expressed via bracket weight and ring
  // size (see INTENSITY spec), not repetition.

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
      data-role="pulse"
    >
      {/* Soft glow behind the block — pulses in sync with brackets. */}
      <motion.ellipse
        cx={cx}
        cy={cy}
        rx={w / 2 + 10}
        ry={h / 2 + 10}
        fill={ACCENT_GLOW}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transformBox: 'fill-box',
          filter: 'blur(16px)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: [0, spec.coreOpacity * 0.45, 0.15],
          scale: [0.95, spec.ringScale, 1],
        }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 1.3,
          times: [0, 0.5, 1],
          ease: EASE_OUT_EXPO,
        }}
      />

      {/* Four viewfinder brackets — each L-shape is two segments. */}
      {/* Top-left */}
      <Bracket
        originX={x1 - PAD}
        originY={y1 - PAD}
        direction="tl"
        length={L}
        weight={spec.strokeWeight}
        delay={0}
      />
      {/* Top-right */}
      <Bracket
        originX={x2 + PAD}
        originY={y1 - PAD}
        direction="tr"
        length={L}
        weight={spec.strokeWeight}
        delay={0.04}
      />
      {/* Bottom-left */}
      <Bracket
        originX={x1 - PAD}
        originY={y2 + PAD}
        direction="bl"
        length={L}
        weight={spec.strokeWeight}
        delay={0.08}
      />
      {/* Bottom-right */}
      <Bracket
        originX={x2 + PAD}
        originY={y2 + PAD}
        direction="br"
        length={L}
        weight={spec.strokeWeight}
        delay={0.12}
      />

      {/* Emphasis ring — expands and fades for each pulse count. */}
      <motion.rect
        x={x1 - PAD}
        y={y1 - PAD}
        width={w + PAD * 2}
        height={h + PAD * 2}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1}
        rx={4}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transformBox: 'fill-box',
        }}
        initial={{ scale: 1, opacity: 0 }}
        animate={{
          scale: [1, spec.ringScale, 1],
          opacity: [0, spec.coreOpacity * 0.5, 0],
        }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 1.3,
          times: [0, 0.5, 1],
          ease: EASE_OUT_EXPO,
          delay: 0.2,
        }}
      />
    </svg>
  );
}

/**
 * A single L-shaped corner bracket. Rendered as two line segments in
 * one SVG path so the animation applies uniformly.
 */
function Bracket({
  originX,
  originY,
  direction,
  length,
  weight,
  delay,
}: {
  originX: number;
  originY: number;
  direction: 'tl' | 'tr' | 'bl' | 'br';
  length: number;
  weight: number;
  delay: number;
}) {
  // Each corner's two arms extend from the origin inward along x and y.
  const xSign = direction === 'tl' || direction === 'bl' ? 1 : -1;
  const ySign = direction === 'tl' || direction === 'tr' ? 1 : -1;

  const d = `
    M ${originX + xSign * length} ${originY}
    L ${originX} ${originY}
    L ${originX} ${originY + ySign * length}
  `;

  // Slide-in offset — each bracket enters from its outer corner.
  const slideX = -xSign * 8;
  const slideY = -ySign * 8;

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={ACCENT}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ opacity: 0, x: slideX, y: slideY }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: EASE_OUT_EXPO,
      }}
    />
  );
}
