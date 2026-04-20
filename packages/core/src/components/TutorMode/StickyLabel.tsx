import React from 'react';
import { motion } from 'framer-motion';
import type { ActionLabel } from '../../types/storyboard';
import {
  ACCENT,
  INK,
  PAPER,
  PILL_FONT_BODY,
  PILL_MAX_W_BODY,
  SERIF,
} from './tokens';

export interface StickyLabelProps {
  /**
   * Pre-computed anchor point in viewport pixels — the label will be
   * placed at this point and positioned relative to it via
   * `action.position`. See `LabelOverlay` for the coordinate math that
   * maps a block's bbox + camera state to this value.
   */
  screenAnchor: { x: number; y: number };
  action: ActionLabel;
}

/**
 * Gap between the label body and its anchor block edge, in viewport
 * pixels. Large enough that the connecting stem is readable as
 * connective tissue between tag and target.
 */
const STEM = 18;

/**
 * Editorial annotation pin. The label body sits a short distance from
 * the target block, connected by a hairline stem and a small marker
 * disc at the anchor point. Body uses a classical serif at small-caps
 * sizing — feels like a scholar's tag, not a browser toast.
 *
 * Positioning math: caller pre-computes the `screenAnchor` (usually the
 * midpoint of the block edge the label is attached to), and this
 * component lays out the pin on the appropriate side via CSS translate
 * offsets.
 */
export function StickyLabel({ screenAnchor, action }: StickyLabelProps) {
  const { x, y } = screenAnchor;
  const layout = LAYOUTS[action.position] ?? LAYOUTS.top;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        // Wrapper positions at the anchor; the body's transform places
        // it on the correct side via `layout.containerTransform`.
        transform: layout.containerTransform,
        pointerEvents: 'none',
        // Compose transform-origin toward the anchor so scale-in feels
        // tethered to the block rather than free-floating.
        transformOrigin: layout.origin,
      }}
      data-role="label"
    >
      {/* Hairline stem — the visible link between label body and anchor. */}
      <motion.span
        aria-hidden
        initial={{ scaleX: 0, scaleY: 0, opacity: 0 }}
        animate={{ scaleX: 1, scaleY: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          background: ACCENT,
          transformOrigin: layout.stemOrigin,
          ...layout.stem,
        }}
      />
      {/* Anchor dot — a small marker disc planted on the block edge. */}
      <motion.span
        aria-hidden
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: ACCENT,
          boxShadow: `0 0 0 2px ${PAPER}, 0 0 0 3px rgba(176, 74, 26, 0.25)`,
          ...layout.dot,
        }}
      />
      {/* Label body — paper pill with a left accent rule and eyebrow text. */}
      <motion.div
        initial={{ y: layout.bodyIn.y, x: layout.bodyIn.x, opacity: 0 }}
        animate={{ y: 0, x: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          ...layout.bodyAnchor,
          background: PAPER,
          color: INK,
          border: '1px solid rgba(42, 36, 32, 0.10)',
          borderRadius: 3,
          padding: '6px 12px 6px 14px',
          fontFamily: SERIF,
          fontSize: PILL_FONT_BODY,
          lineHeight: 1.25,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          fontWeight: 500,
          // Wrap instead of truncating with an ellipsis. Short labels stay
          // single-line; longer ones grow in height rather than losing
          // their tail. `overflowWrap: 'break-word'` respects min-content
          // sizing so a single overflowing word mid-breaks at a safe
          // boundary — unlike `anywhere`, which would collapse the pill
          // to 1-char min width and stack every letter on its own line.
          maxWidth: PILL_MAX_W_BODY,
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          // Warm two-layer shadow (matches GhostReference's palette).
          boxShadow:
            '0 1px 2px rgba(42, 36, 32, 0.12), 0 8px 18px -6px rgba(42, 36, 32, 0.22)',
          // Internal left accent rule — a 2px terracotta stripe.
          backgroundImage: `linear-gradient(to right, ${ACCENT} 0, ${ACCENT} 2px, transparent 2px)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '2px 100%',
          backgroundPosition: 'left top',
        }}
      >
        {action.text}
      </motion.div>
    </motion.div>
  );
}

/**
 * Per-side geometry for the pin. Each entry encodes:
 * - `containerTransform`   — how to offset the wrapper from the anchor point
 * - `origin`               — transform-origin for the scale-in (points at anchor)
 * - `stem`                 — absolute-positioned rule connecting body ↔ dot
 * - `stemOrigin`           — scale-in origin for the stem (grows from the anchor)
 * - `dot`                  — offset for the anchor dot
 * - `bodyAnchor`           — absolute offsets for the body pill
 * - `bodyIn`               — initial translate for the body's entrance animation
 */
type LayoutSpec = {
  containerTransform: string;
  origin: string;
  stem: React.CSSProperties;
  stemOrigin: string;
  dot: React.CSSProperties;
  bodyAnchor: React.CSSProperties;
  bodyIn: { x: number; y: number };
};

const LAYOUTS: Record<ActionLabel['position'], LayoutSpec> = {
  top: {
    containerTransform: 'translate(-50%, -100%)',
    origin: '50% 100%',
    stem: {
      left: '50%',
      bottom: -STEM,
      width: 1,
      height: STEM - 4,
      transform: 'translateX(-50%)',
    },
    stemOrigin: 'bottom',
    dot: {
      left: '50%',
      bottom: -STEM + 1,
      transform: 'translate(-50%, 100%)',
    },
    bodyAnchor: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
    bodyIn: { x: 0, y: -4 },
  },
  bottom: {
    containerTransform: 'translate(-50%, 0%)',
    origin: '50% 0%',
    stem: {
      left: '50%',
      top: STEM - (STEM - 4),
      width: 1,
      height: STEM - 4,
      transform: 'translateX(-50%)',
    },
    stemOrigin: 'top',
    dot: {
      left: '50%',
      top: -1,
      transform: 'translate(-50%, -100%)',
    },
    bodyAnchor: { top: STEM, left: '50%', transform: 'translateX(-50%)' },
    bodyIn: { x: 0, y: 4 },
  },
  left: {
    containerTransform: 'translate(-100%, -50%)',
    origin: '100% 50%',
    stem: {
      top: '50%',
      right: -STEM,
      width: STEM - 4,
      height: 1,
      transform: 'translateY(-50%)',
    },
    stemOrigin: 'right',
    dot: {
      right: -STEM + 1,
      top: '50%',
      transform: 'translate(100%, -50%)',
    },
    bodyAnchor: { right: 0, top: '50%', transform: 'translateY(-50%)' },
    bodyIn: { x: -4, y: 0 },
  },
  right: {
    containerTransform: 'translate(0%, -50%)',
    origin: '0% 50%',
    stem: {
      top: '50%',
      left: STEM - (STEM - 4),
      width: STEM - 4,
      height: 1,
      transform: 'translateY(-50%)',
    },
    stemOrigin: 'left',
    dot: {
      left: -1,
      top: '50%',
      transform: 'translate(-100%, -50%)',
    },
    bodyAnchor: { left: STEM, top: '50%', transform: 'translateY(-50%)' },
    bodyIn: { x: 4, y: 0 },
  },
};
