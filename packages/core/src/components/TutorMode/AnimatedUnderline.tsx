import React from 'react';
import { motion } from 'framer-motion';
import type { ActionUnderline } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { ACCENT, EASE_OUT_EXPO } from './tokens';

export interface AnimatedUnderlineProps {
  bbox: BBoxCoords;
  action: ActionUnderline;
}

/**
 * Design: **Scholar's pen stroke.** Four distinct pen styles render as
 * a real reader's ink annotation would — confident stroke, subtle
 * ink-blot pen-lift at the tail, slight over-stroke past the target
 * so the mark feels handmade rather than auto-generated.
 *
 * `sketch` gets a deterministic low-frequency jitter (not `Math.random`,
 * which would re-roll on every render) + a faint ghost stroke offset
 * below for ink-on-paper feel.
 *
 * `wavy` uses a proper sine curve instead of quadratic-bezier humps,
 * which tended to kink at steeper wavelengths.
 */

/** Deterministic hashed-jitter so the sketch path is stable across
 *  re-renders. Same segment index ⇒ same offset. */
function jitterAt(i: number): number {
  const h = Math.sin(i * 12.9898) * 43758.5453;
  return (h - Math.floor(h) - 0.5) * 4; // ±2 px
}

function pathForStyle(
  x1: number,
  x2: number,
  y: number,
  style: ActionUnderline['style'],
): { primary: string; ghost?: string } {
  // Slight over-stroke so the mark feels hand-extended.
  const x1e = x1 - 4;
  const x2e = x2 + 4;

  if (style === 'straight') {
    return { primary: `M ${x1e} ${y} L ${x2e} ${y}` };
  }

  if (style === 'double') {
    return {
      primary: `M ${x1e} ${y - 3} L ${x2e} ${y - 3}`,
      ghost: `M ${x1e} ${y + 3} L ${x2e} ${y + 3}`,
    };
  }

  if (style === 'wavy') {
    const len = x2e - x1e;
    const steps = Math.max(12, Math.floor(len / 10));
    const amp = 3.2;
    let d = `M ${x1e} ${y}`;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x1e + len * t;
      const py = y + Math.sin(t * Math.PI * 4) * amp;
      // Smooth with quadratic control between each sampled point.
      const prevT = (i - 1) / steps;
      const cpx = x1e + len * (prevT + (t - prevT) / 2);
      const cpy = y + Math.sin((prevT + (t - prevT) / 2) * Math.PI * 4) * amp;
      d += ` Q ${cpx} ${cpy} ${px} ${py}`;
    }
    return { primary: d };
  }

  // sketch: deterministic jitter along the stroke + a faint ghost below
  // for an ink-on-textured-paper feel.
  const segs = 8;
  let primary = `M ${x1e} ${y + jitterAt(0)}`;
  let ghost = `M ${x1e} ${y + jitterAt(100) + 1.5}`;
  for (let i = 1; i <= segs; i++) {
    const px = x1e + ((x2e - x1e) * i) / segs;
    primary += ` L ${px} ${y + jitterAt(i)}`;
    ghost += ` L ${px} ${y + jitterAt(i + 100) + 1.5}`;
  }
  return { primary, ghost };
}

export function AnimatedUnderline({ bbox, action }: AnimatedUnderlineProps) {
  const [x1, , x2, y2] = bbox;
  const y = y2 + 6;
  const { primary, ghost } = pathForStyle(x1, x2, y, action.style);
  const duration = action.draw_duration_ms / 1000;
  // Use the action.color if the LLM supplied a non-default value;
  // otherwise fall back to our accent so underlines match the system.
  const stroke =
    action.color && action.color !== '#FBBF24' ? action.color : ACCENT;

  // Pen-lift blot at the trailing end — a small disc that appears once
  // the stroke has fully drawn, suggesting the pen paused there.
  const blotX = x2 + 4;
  const blotY = y;
  const strokeWeight = action.style === 'wavy' ? 3 : 4;

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
      {/* Faint ghost stroke — gives sketch/double a paper-bleed feel. */}
      {ghost ? (
        <motion.path
          d={ghost}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWeight - 1.5}
          strokeLinecap="round"
          strokeOpacity={0.35}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease: EASE_OUT_EXPO }}
        />
      ) : null}

      {/* Primary stroke — the confident mark. */}
      <motion.path
        d={primary}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWeight}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, ease: EASE_OUT_EXPO }}
      />

      {/* Pen-lift ink blot — lands right at the end of the stroke. */}
      <motion.circle
        cx={blotX}
        cy={blotY}
        r={strokeWeight / 2 + 0.5}
        fill={stroke}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        exit={{ opacity: 0 }}
        style={{
          transformOrigin: `${blotX}px ${blotY}px`,
          transformBox: 'fill-box',
        }}
        transition={{
          duration: 0.25,
          delay: duration - 0.1,
          ease: EASE_OUT_EXPO,
        }}
      />
    </svg>
  );
}
