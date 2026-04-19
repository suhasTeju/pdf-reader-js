import React from 'react';
import { motion } from 'framer-motion';
import type { ActionHighlight } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';
import { EASE_OUT_EXPO } from './tokens';

export interface AnimatedHighlightProps {
  bbox: BBoxCoords;
  action: ActionHighlight;
}

/**
 * Design: **Light highlighter wash.** A real highlighter on textbook
 * paper is surprisingly transparent — the text must remain legible
 * through the wash.
 *
 * The previous implementation relied on `mixBlendMode: multiply` to
 * darken text through a semi-opaque fill. That works in isolation but
 * breaks when the SVG sits inside a transformed ancestor (CinemaLayer
 * applies `transform: scale(...)` which creates its own stacking
 * context). `mixBlendMode: multiply` then multiplies against the
 * stacking-context background (transparent), not the PDF canvas, so
 * the fill silently degrades to ordinary alpha painting — and if the
 * LLM emitted an opaque `action.color` (e.g. `#FBBF24`), the highlight
 * appeared as a solid yellow bar obscuring the text.
 *
 * Fix:
 * - No `mixBlendMode`. We always paint with partial opacity.
 * - `fillOpacity` is controlled by us, not by the colour string. We
 *   strip any alpha the consumer/LLM supplied and apply a fixed
 *   `fill-opacity` so the wash is guaranteed translucent regardless
 *   of what colour comes in.
 * - No SVG filter stack. `feTurbulence` + `feDisplacementMap` added
 *   a subtle fibre texture that's invisible at reading distance and
 *   was one of the most expensive paint primitives in mobile WebKit.
 */

/** Default hue, used when the LLM emits the schema default amber. */
const DEFAULT_HUE = 'rgb(230, 180, 34)';

/** Fraction of the amber that shows through on top of the PDF. 0.28
 *  matches the apparent darkness of the old `rgba(230,180,34,0.22)`
 *  painted through `mixBlendMode: multiply` on a white page, so
 *  regression is minimal where multiply was actually working. */
const WASH_OPACITY = 0.28;

/** Strip alpha from an rgba(...) string, leaving rgb(...). Leaves hex
 *  and named colours untouched — we treat those as solid hues to be
 *  washed by our own `fillOpacity`. */
function stripAlpha(color: string): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : color;
}

export function AnimatedHighlight({ bbox, action }: AnimatedHighlightProps) {
  const [x1, y1, x2, y2] = bbox;
  const h = Math.max(1, y2 - y1);
  const bleed = Math.min(4, h * 0.12);
  const yTop = y1 - bleed;
  const yBot = y2 + bleed;
  const duration = action.draw_duration_ms / 1000;

  // Honour an explicit `action.color` override only when it deviates from
  // the schema default the LLM emits for "amber highlight" variants.
  const isDefaultColour =
    !action.color ||
    action.color === 'rgba(250, 204, 21, 0.35)' ||
    action.color === 'rgba(250,204,21,0.35)';
  const fill = stripAlpha(isDefaultColour ? DEFAULT_HUE : action.color);

  // Tapered path: moves up slightly at the start/end so the highlight has
  // the uneven pen-hit look instead of a clean edge.
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

  // Tight CSS box around the path so iOS Safari's compositor doesn't
  // allocate a full-page-sized backing layer for every concurrent overlay.
  // Path coordinates stay in source-DPI space (the coord space CinemaLayer's
  // transform operates in); `viewBox` preserves them.
  const svgPad = 8;
  const svgX = x1 - svgPad;
  const svgY = yTop - svgPad;
  const svgW = x2 - x1 + 2 * svgPad;
  const svgH = yBot - yTop + 2 * svgPad;

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
      data-role="highlight"
    >
      <motion.path
        d={pathD}
        fill={fill}
        fillOpacity={WASH_OPACITY}
        initial={{ clipPath: `inset(0 100% 0 0)` }}
        animate={{ clipPath: `inset(0 0% 0 0)` }}
        exit={{ opacity: 0 }}
        transition={{ duration, ease: EASE_OUT_EXPO }}
      />
    </svg>
  );
}
