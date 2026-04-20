'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  ActiveOverlay,
  ActionCallout,
  CameraState,
} from '../../types/storyboard';
import type { BBoxIndex, PageBBoxData, BBoxCoords } from '../../types/bbox';
import {
  ACCENT,
  EASE_OUT_EXPO,
  INK,
  PAPER,
  PILL_FONT_CAPS,
  PILL_MAX_W_CAPS,
  resolveMaxPillH,
  resolveMaxPillW,
  resolvePillOffset,
  SERIF,
} from './tokens';

export interface CalloutLabelOverlayProps {
  overlays: ActiveOverlay[];
  index: BBoxIndex;
  currentPage: number;
  camera: CameraState;
  viewport: { width: number; height: number };
}

/**
 * Hosts callout label pills at viewport space. The arrow stroke and
 * arrowhead still live inside CameraView (drawn by `CalloutArrow`)
 * because strokes scale readably with the camera; the LABEL alone is
 * lifted out because small-caps text at fit-scale (~0.22×) becomes
 * unreadable pixel dust.
 *
 * The pill is anchored near the arrow's endpoint, shifted
 * perpendicular to the arrow direction so it never sits under the
 * caret. Screen position is computed from the two bboxes + camera
 * state using the same projection math as LabelOverlay.
 */
export function CalloutLabelOverlay({
  overlays,
  index,
  currentPage,
  camera,
  viewport,
}: CalloutLabelOverlayProps): React.ReactElement {
  const callouts = overlays.filter(
    (o) => o.kind === 'callout' && (o.action as ActionCallout).label,
  );
  const page = index.byPage.get(currentPage);

  return (
    <div
      data-role="callout-label-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        // Above the arrow stroke (which is inside CameraView) and the
        // reset button, below the ghost card.
        zIndex: 68,
      }}
    >
      <AnimatePresence>
        {page
          ? callouts.map((overlay) => {
              const a = overlay.action as ActionCallout;
              const fromHit = index.blockById.get(a.from_block);
              const toHit = index.blockById.get(a.to_block);
              if (!fromHit || !toHit || !a.label) return null;
              const pos = computePillAnchor(
                fromHit.block.bbox,
                toHit.block.bbox,
                page,
                camera,
                viewport,
              );
              return (
                <CalloutLabelPill
                  key={overlay.id}
                  label={a.label}
                  anchor={pos}
                  side={pos.side}
                />
              );
            })
          : null}
      </AnimatePresence>
    </div>
  );
}

type Side = 'right' | 'left' | 'below' | 'above';

/**
 * Anchor the pill NEAR the arrow's destination tip, offset perpendicular
 * to the arrow's dominant orientation. Two anchors were considered:
 *
 *   - midpoint: centres the pill along the arrow's length, but for long
 *     arrows (e.g., a caption pointing down to a figure across half the
 *     page) the midpoint lands in no-man's-land far from either endpoint,
 *     so the reader can't tell where the arrow is actually pointing.
 *   - tip: keeps the pill near the destination ("this is what the arrow
 *     points to"), and with a perpendicular offset the pill sits
 *     alongside the tip rather than on top of it.
 *
 * Tip wins. Tested on vertical arrows (caption → figure), horizontal
 * arrows (compare A ↔ B), and diagonal callouts.
 *
 * Side selection:
 *   - Vertical-ish arrow (|dy| ≥ |dx|) → pill to the right (flip to left
 *     if no room in the viewport).
 *   - Horizontal-ish arrow            → pill below (flip to above).
 */
function computePillAnchor(
  fromBbox: BBoxCoords,
  toBbox: BBoxCoords,
  page: PageBBoxData,
  camera: CameraState,
  viewport: { width: number; height: number },
): { x: number; y: number; side: Side } {
  const aCX = (fromBbox[0] + fromBbox[2]) / 2;
  const aCY = (fromBbox[1] + fromBbox[3]) / 2;
  const bCX = (toBbox[0] + toBbox[2]) / 2;
  const bCY = (toBbox[1] + toBbox[3]) / 2;
  const dx = bCX - aCX;
  const dy = bCY - aCY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Arrow tip in PDF space (matches CalloutArrow.edgePoints).
  const bHalfW = (toBbox[2] - toBbox[0]) / 2;
  const bHalfH = (toBbox[3] - toBbox[1]) / 2;
  const bOff = Math.min(Math.max(bHalfW, bHalfH), 60);
  const toX = bCX - ux * bOff;
  const toY = bCY - uy * bOff;

  // Project tip to viewport pixels.
  const pageCX = page.page_dimensions.width / 2;
  const pageCY = page.page_dimensions.height / 2;
  const tipScreenX =
    viewport.width / 2 + camera.x + (toX - pageCX) * camera.scale;
  const tipScreenY =
    viewport.height / 2 + camera.y + (toY - pageCY) * camera.scale;

  const isVertical = Math.abs(dy) >= Math.abs(dx);

  // Viewport-aware geometry — tracks the same clamp curves as the pill's
  // CSS font/max-width so the JS auto-flip decision agrees with the
  // rendered size. On a 1440 px desktop OFFSET ~= 44 px; on a 375 px phone
  // OFFSET ~= 20 px.
  const OFFSET = resolvePillOffset(viewport.width);
  const MAX_PILL_W = resolveMaxPillW(viewport.width);
  const MAX_PILL_H = resolveMaxPillH(viewport.width);
  const SAFE = 16;

  if (isVertical) {
    const canFitRight =
      tipScreenX + OFFSET + MAX_PILL_W < viewport.width - SAFE;
    const side: Side = canFitRight ? 'right' : 'left';
    return {
      x: tipScreenX + (side === 'right' ? OFFSET : -OFFSET),
      y: tipScreenY,
      side,
    };
  }

  const canFitBelow =
    tipScreenY + OFFSET + MAX_PILL_H < viewport.height - SAFE;
  const side: Side = canFitBelow ? 'below' : 'above';
  return {
    x: tipScreenX,
    y: tipScreenY + (side === 'below' ? OFFSET : -OFFSET),
    side,
  };
}

/**
 * Editorial label pill — matches StickyLabel's vocabulary: cream paper,
 * terracotta accent rule, classical serif small-caps.
 *
 * The edge of the pill closest to the arrow is anchored at the offset
 * point, and the accent rule sits on that same "inward" edge so the
 * pill visually points back at the arrow regardless of side.
 */
function CalloutLabelPill({
  label,
  anchor,
  side,
}: {
  label: string;
  anchor: { x: number; y: number };
  side: Side;
}) {
  // Per-side geometry: how to position the pill relative to the anchor,
  // where to put the accent rule, and which direction to slide in from.
  const spec = PILL_SIDE_SPECS[side];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, ...spec.slideIn }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.45, delay: 0.5, ease: EASE_OUT_EXPO }}
      style={{
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        transform: spec.transform,
        pointerEvents: 'none',
        background: PAPER,
        color: INK,
        border: '1px solid rgba(42, 36, 32, 0.10)',
        borderRadius: 3,
        padding: spec.padding,
        fontFamily: SERIF,
        fontSize: PILL_FONT_CAPS,
        lineHeight: 1.2,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        fontWeight: 500,
        // Wrap instead of truncating. Short labels stay single-line;
        // longer ones grow taller rather than losing their tail to an
        // ellipsis. `overflowWrap: 'break-word'` respects min-content
        // sizing — `anywhere` here caused the pill to collapse to 1-char
        // width and stack each letter on its own line when the clamped
        // maxWidth was narrow.
        maxWidth: PILL_MAX_W_CAPS,
        whiteSpace: 'normal',
        overflowWrap: 'break-word',
        boxShadow:
          '0 1px 2px rgba(42, 36, 32, 0.12), 0 8px 18px -6px rgba(42, 36, 32, 0.22)',
        // Accent rule on the "inward" edge (the one closest to the arrow).
        backgroundImage: spec.accentGradient,
        backgroundRepeat: 'no-repeat',
        backgroundSize: spec.accentSize,
        backgroundPosition: spec.accentPosition,
      }}
      data-role="callout-label"
    >
      {label}
    </motion.div>
  );
}

type SideSpec = {
  /** Which edge of the pill sits at (anchor.x, anchor.y). */
  transform: string;
  /** Slight slide-in direction that reads as "emerging from the arrow". */
  slideIn: { x?: number; y?: number };
  padding: string;
  /** Linear gradient producing a 2 px accent rule on the inward edge. */
  accentGradient: string;
  accentSize: string;
  accentPosition: string;
};

const PILL_SIDE_SPECS: Record<Side, SideSpec> = {
  // Pill sits to the RIGHT of a vertical arrow → left edge anchors at
  // offset point, accent rule on the left (pointing back toward arrow).
  right: {
    transform: 'translate(0, -50%)',
    slideIn: { x: -6 },
    padding: '5px 12px 5px 14px',
    accentGradient: `linear-gradient(to right, ${ACCENT} 0, ${ACCENT} 2px, transparent 2px)`,
    accentSize: '2px 100%',
    accentPosition: 'left top',
  },
  left: {
    transform: 'translate(-100%, -50%)',
    slideIn: { x: 6 },
    padding: '5px 14px 5px 12px',
    accentGradient: `linear-gradient(to left, ${ACCENT} 0, ${ACCENT} 2px, transparent 2px)`,
    accentSize: '2px 100%',
    accentPosition: 'right top',
  },
  // Pill sits BELOW a horizontal arrow → top edge anchors at offset
  // point, accent rule on the top (pointing back up toward arrow).
  below: {
    transform: 'translate(-50%, 0)',
    slideIn: { y: -6 },
    padding: '7px 12px 5px 12px',
    accentGradient: `linear-gradient(to bottom, ${ACCENT} 0, ${ACCENT} 2px, transparent 2px)`,
    accentSize: '100% 2px',
    accentPosition: 'left top',
  },
  above: {
    transform: 'translate(-50%, -100%)',
    slideIn: { y: 6 },
    padding: '5px 12px 7px 12px',
    accentGradient: `linear-gradient(to top, ${ACCENT} 0, ${ACCENT} 2px, transparent 2px)`,
    accentSize: '100% 2px',
    accentPosition: 'left bottom',
  },
};
