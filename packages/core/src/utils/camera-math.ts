import type { BBoxCoords, PageDimensionsDpi } from '../types/bbox';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraTarget {
  /** scale multiplier relative to fit-page scale */
  scale: number;
  /** translate in pixels (screen-space), to center the target block in the viewport */
  x: number;
  /** translate in pixels */
  y: number;
}

/** Returns the scale that makes a page fit the viewport (contain, not cover). */
export function fitPageScale(
  page: PageDimensionsDpi,
  viewport: ViewportSize,
): number {
  const sx = viewport.width / page.width;
  const sy = viewport.height / page.height;
  return Math.min(sx, sy);
}

/**
 * Compute a camera target that frames a block's bbox with the requested
 * scale multiplier (1 = fit the block tightly with padding; 1.5 = a little
 * smaller frame = more zoom; <1 = more context).
 *
 * Coordinates are in PDF units — padding is also in PDF units.
 */
export function computeCameraForBlock(
  bbox: BBoxCoords,
  page: PageDimensionsDpi,
  viewport: ViewportSize,
  opts: { targetScale?: number; paddingPdf?: number } = {},
): CameraTarget {
  const targetScale = opts.targetScale ?? 1.5;
  const paddingPdf = opts.paddingPdf ?? 80;

  const [x1, y1, x2, y2] = bbox;
  const blockW = Math.max(1, x2 - x1 + paddingPdf * 2);
  const blockH = Math.max(1, y2 - y1 + paddingPdf * 2);
  const blockCX = (x1 + x2) / 2;
  const blockCY = (y1 + y2) / 2;

  const fitBlock = Math.min(viewport.width / blockW, viewport.height / blockH);
  const scale = fitBlock * targetScale;

  const pageCX = page.width / 2;
  const pageCY = page.height / 2;

  const x = (pageCX - blockCX) * scale;
  const y = (pageCY - blockCY) * scale;

  return { scale, x, y };
}

/** Fit-page camera target (no pan). */
export function fitPageTarget(
  page: PageDimensionsDpi,
  viewport: ViewportSize,
): CameraTarget {
  return { scale: fitPageScale(page, viewport), x: 0, y: 0 };
}

/**
 * Clamp a camera target so the page doesn't drift fully off-screen at high scale.
 * Ensures the visible area of the viewport still intersects the page.
 */
export function clampCamera(
  target: CameraTarget,
  page: PageDimensionsDpi,
  viewport: ViewportSize,
): CameraTarget {
  const pageWScreen = page.width * target.scale;
  const pageHScreen = page.height * target.scale;
  const maxOffsetX = Math.max(0, (pageWScreen - viewport.width) / 2);
  const maxOffsetY = Math.max(0, (pageHScreen - viewport.height) / 2);
  return {
    scale: target.scale,
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, target.x)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, target.y)),
  };
}
