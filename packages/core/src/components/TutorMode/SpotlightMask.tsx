import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { ActionSpotlight } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';
import { getDeviceCapabilities } from '../../utils';
import { ACCENT, ACCENT_GLOW, EASE_OUT_EXPO, INK } from './tokens';

export interface SpotlightMaskProps {
  page: PageDimensionsDpi;
  bbox: BBoxCoords;
  action: ActionSpotlight;
  durationMs?: number;
}

/**
 * Design: **Theatrical spotlight.** A warm-ink dim (not pure black)
 * closes over the whole page, then a feathered cutout reveals the
 * target block. A thin terracotta accent ring follows the cutout shape
 * — the same colour used by every other overlay so the spotlit region
 * is clearly part of the same annotation system.
 *
 * The dim colour is warm INK (`#2a2420`) rather than `#000` so the
 * dimmed area looks like the PDF pushed into shadow rather than
 * blacked out. On light textbook pages this reads as "atmosphere"
 * instead of "censorship".
 *
 * The accent ring animates with a slight stagger after the dim, so the
 * reveal has a subtle two-beat cadence: darken → point.
 */
export function SpotlightMask({
  page,
  bbox,
  action,
  durationMs = 500,
}: SpotlightMaskProps) {
  const maskId = useId();
  const filterId = `${maskId}-blur`;
  const [rawX1, rawY1, rawX2, rawY2] = bbox;
  const rawW = Math.max(0, rawX2 - rawX1);
  const rawH = Math.max(0, rawY2 - rawY1);
  // Breathing room: expand the cutout past the block edges so text isn't
  // clipped flush against the accent ring. 6% of the shorter side, clamped
  // to a readable range — scales with block size without becoming absurd
  // on huge figures or invisible on tiny captions.
  const pad = Math.min(28, Math.max(10, Math.min(rawW, rawH) * 0.06));
  const x1 = rawX1 - pad;
  const y1 = rawY1 - pad;
  const x2 = rawX2 + pad;
  const y2 = rawY2 + pad;
  const w = x2 - x1;
  const h = y2 - y1;
  const rx =
    action.shape === 'rounded' ? 14 : action.shape === 'ellipse' ? w / 2 : 0;
  const ry =
    action.shape === 'rounded' ? 14 : action.shape === 'ellipse' ? h / 2 : 0;
  // SVG feGaussianBlur with a large stdDeviation over a full-page mask is
  // a known iOS Safari memory hog; the filter allocates a rasterized
  // intermediate buffer sized by the filter region. Clamp the blur hard
  // on mobile so the spotlight still reads as soft-edged without burning
  // through the tab's compositor budget.
  const isMobile = getDeviceCapabilities().isMobile;
  const requestedFeather = Math.max(16, action.feather_px);
  const feather = isMobile ? Math.min(12, requestedFeather) : requestedFeather;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  return (
    <svg
      viewBox={`0 0 ${page.width} ${page.height}`}
      width={page.width}
      height={page.height}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        width: page.width,
        height: page.height,
        overflow: 'visible',
      }}
      data-role="spotlight-mask"
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={feather / 4} />
        </filter>
        <mask id={maskId}>
          <rect x={0} y={0} width={page.width} height={page.height} fill="white" />
          {action.shape === 'ellipse' ? (
            <ellipse
              cx={cx}
              cy={cy}
              rx={w / 2}
              ry={h / 2}
              fill="black"
              filter={`url(#${filterId})`}
            />
          ) : (
            <rect
              x={x1}
              y={y1}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              fill="black"
              filter={`url(#${filterId})`}
            />
          )}
        </mask>
      </defs>

      {/* Warm ink dim — slides in first. */}
      <motion.rect
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        fill={INK}
        mask={`url(#${maskId})`}
        initial={{ fillOpacity: 0 }}
        animate={{ fillOpacity: action.dim_opacity }}
        exit={{ fillOpacity: 0 }}
        transition={{ duration: durationMs / 1000, ease: EASE_OUT_EXPO }}
      />

      {/* Terracotta accent ring — points to the spotlit region. */}
      {action.shape === 'ellipse' ? (
        <motion.ellipse
          cx={cx}
          cy={cy}
          rx={w / 2}
          ry={h / 2}
          fill="none"
          stroke={ACCENT}
          strokeWidth={3}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 0.9, scale: 1 }}
          exit={{ opacity: 0 }}
          style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' }}
          transition={{
            duration: durationMs / 1000,
            delay: 0.15,
            ease: EASE_OUT_EXPO,
          }}
        />
      ) : (
        <motion.rect
          x={x1}
          y={y1}
          width={w}
          height={h}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={ACCENT}
          strokeWidth={3}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.9, scale: 1 }}
          exit={{ opacity: 0 }}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transformBox: 'fill-box',
          }}
          transition={{
            duration: durationMs / 1000,
            delay: 0.15,
            ease: EASE_OUT_EXPO,
          }}
        />
      )}

      {/* Outer glow — very soft accent halo bleeding outward. */}
      {action.shape !== 'ellipse' ? (
        <motion.rect
          x={x1 - 2}
          y={y1 - 2}
          width={w + 4}
          height={h + 4}
          rx={rx + 2}
          ry={ry + 2}
          fill="none"
          stroke={ACCENT_GLOW}
          strokeWidth={8}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: durationMs / 1000,
            delay: 0.2,
            ease: EASE_OUT_EXPO,
          }}
        />
      ) : null}
    </svg>
  );
}
