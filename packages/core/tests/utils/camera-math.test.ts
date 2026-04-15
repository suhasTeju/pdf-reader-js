import { describe, it, expect } from 'vitest';
import {
  fitPageScale,
  fitPageTarget,
  computeCameraForBlock,
  clampCamera,
} from '../../src/utils/camera-math';

const PAGE = { width: 1756, height: 2269, dpi: 200 };
const VIEW = { width: 800, height: 1000 };

describe('camera-math', () => {
  it('fitPageScale picks the smaller axis ratio', () => {
    const s = fitPageScale(PAGE, VIEW);
    expect(s).toBeCloseTo(Math.min(800 / 1756, 1000 / 2269));
  });

  it('fitPageTarget has zero pan', () => {
    const t = fitPageTarget(PAGE, VIEW);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it('computeCameraForBlock zooms closer than fit when targetScale > 1', () => {
    const fit = fitPageScale(PAGE, VIEW);
    const target = computeCameraForBlock(
      [939.3, 522, 1137.4, 599.7],
      PAGE,
      VIEW,
      { targetScale: 1.5, paddingPdf: 60 },
    );
    expect(target.scale).toBeGreaterThan(fit);
  });

  it('computeCameraForBlock centers an off-center block (pan depends on position)', () => {
    // Block at [939.3, 522, 1137.4, 599.7]: right of page center horizontally,
    // above page center vertically. To center it, page must shift left (x<0)
    // and shift down (y>0).
    const target = computeCameraForBlock(
      [939.3, 522, 1137.4, 599.7],
      PAGE,
      VIEW,
    );
    expect(target.x).toBeLessThan(0);
    expect(target.y).toBeGreaterThan(0);
  });

  it('clampCamera bounds extreme offsets', () => {
    const s = 2;
    const extreme = { scale: s, x: 10_000, y: 10_000 };
    const clamped = clampCamera(extreme, PAGE, VIEW);
    expect(clamped.x).toBeLessThanOrEqual((PAGE.width * s - VIEW.width) / 2);
    expect(clamped.y).toBeLessThanOrEqual((PAGE.height * s - VIEW.height) / 2);
  });

  it('clampCamera allows (0,0) at fit scale', () => {
    const fit = fitPageScale(PAGE, VIEW);
    const clamped = clampCamera({ scale: fit, x: 0, y: 0 }, PAGE, VIEW);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });
});
