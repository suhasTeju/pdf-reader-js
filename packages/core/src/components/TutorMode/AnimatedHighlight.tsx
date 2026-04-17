import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { ActionHighlight } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { EASE_OUT_EXPO } from './tokens';

export interface AnimatedHighlightProps {
  bbox: BBoxCoords;
  action: ActionHighlight;
}

/**
 * Design: **Light highlighter wash.** A real highlighter, once it's
 * been laid down on textbook paper for reading, is surprisingly
 * transparent — the text absolutely must remain legible through it.
 * An earlier "double-stroke with multiply" design compounded opacity
 * where the layers overlapped and obscured text, which is the exact
 * failure mode a highlighter should never have.
 *
 * Revised approach:
 * - SINGLE wash layer at ~22 % effective amber, using `mixBlendMode:
 *   multiply` so the text darkens through the wash rather than being
 *   painted over.
 * - Preserved: slight over-bleed past the baseline (so the mark
 *   doesn't look clipped), tapered ends (so it doesn't look machine-
 *   drawn), subtle fibre texture (so it doesn't look flat), left-to-
 *   right stroke reveal.
 * - Dropped: the inner concentrated rect. The text was becoming
 *   unreadable where it sat.
 */

/** Warm-amber base — tuned to remain comfortably transparent over
 *  typical textbook body text. Do NOT export the raw amber as solid
 *  `MARKER` anywhere user-facing — that's too heavy on text. */
const WASH = 'rgba(230, 180, 34, 0.22)';

export function AnimatedHighlight({ bbox, action }: AnimatedHighlightProps) {
  const [x1, y1, x2, y2] = bbox;
  const h = Math.max(1, y2 - y1);
  const bleed = Math.min(4, h * 0.12);
  const yTop = y1 - bleed;
  const yBot = y2 + bleed;
  const duration = action.draw_duration_ms / 1000;

  const filterId = useId();

  // Honour an explicit `action.color` override only when it deviates
  // from the prompt's default string (the LLM emits the schema default
  // for amber variants — we treat those as "use our house colour").
  const isDefaultColour =
    !action.color ||
    action.color === 'rgba(250, 204, 21, 0.35)' ||
    action.color === 'rgba(250,204,21,0.35)';
  const fill = isDefaultColour ? WASH : action.color;

  // Tapered path: moves up slightly at the start/end so the
  // highlight has the uneven pen-hit look instead of a clean edge.
  const taper = Math.min(6, h * 0.2);
  const pathD = `
    M ${x1 - 2} ${yTop + taper}
    L ${x1 + 2} ${yTop}
    L ${x2 - 2} ${yTop}
    L ${x2 + 2} ${yTop + taper}
    L ${x2 + 2} ${yBot - taper}
    L ${x2 - 2} ${yBot}
    L ${x1 + 2} ${yBot}
    L ${x1 - 2} ${yBot - taper}
    Z
  `;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        mixBlendMode: 'multiply',
      }}
      data-role="highlight"
    >
      <defs>
        <filter id={filterId}>
          {/* Subtle fibrous texture via turbulence + displacement —
             dialled down so it doesn't add to the apparent darkness. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.8"
            numOctaves="1"
            seed={3}
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={1} />
        </filter>
      </defs>

      {/* Single wash layer, drawn left-to-right like a real stroke. */}
      <motion.path
        d={pathD}
        fill={fill}
        initial={{ clipPath: `inset(0 100% 0 0)` }}
        animate={{ clipPath: `inset(0 0% 0 0)` }}
        exit={{ opacity: 0 }}
        filter={`url(#${filterId})`}
        transition={{ duration, ease: EASE_OUT_EXPO }}
      />
    </svg>
  );
}
