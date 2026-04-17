import { describe, it, expect } from 'vitest';
import {
  calculateOptimalCanvasDimensions,
  getRenderConfig,
  type DeviceCapabilities,
} from '../../src/utils/mobile-config';

/**
 * Regression guard for the v0.5.4 iOS Safari tab-reload fix. The
 * pre-fix code multiplied the PDF viewport by the raw devicePixelRatio,
 * producing a ~134 MB canvas for a US Letter page at 200-DPI bbox on an
 * iPhone 14. iOS Safari's per-tab canvas budget is ~256 MB — one such
 * canvas alone halved that budget and the tab was reaped on first
 * storyboard step.
 *
 * These tests lock the fix in: on any reasonable mobile configuration,
 * the capped canvas stays under an 80 MB per-page budget.
 */

const IPHONE_14: DeviceCapabilities = {
  isMobile: true,
  isTouch: true,
  devicePixelRatio: 3,
  deviceMemory: 6,
  hardwareConcurrency: 6,
  isLowEnd: false,
  connectionType: 'fast',
  screenSize: 'small',
};

const LOW_END_ANDROID: DeviceCapabilities = {
  isMobile: true,
  isTouch: true,
  devicePixelRatio: 2.75,
  deviceMemory: 3,
  hardwareConcurrency: 4,
  isLowEnd: true,
  connectionType: 'slow',
  screenSize: 'small',
};

const DESKTOP_RETINA: DeviceCapabilities = {
  isMobile: false,
  isTouch: false,
  devicePixelRatio: 2,
  deviceMemory: 16,
  hardwareConcurrency: 10,
  isLowEnd: false,
  connectionType: 'fast',
  screenSize: 'large',
};

function canvasMB(width: number, height: number): number {
  return (width * height * 4) / (1024 * 1024);
}

// US Letter at 200 DPI bbox × scale=1 → viewport.width/height at the
// time CanvasLayer sees them. Matches what TutorModeContainer passes.
const VIEWPORT_US_LETTER_200DPI = {
  width: 612 * (200 / 72),  // ≈ 1700
  height: 792 * (200 / 72), // ≈ 2200
};

describe('canvas pixel budget on mobile (v0.5.4 fix)', () => {
  it('iPhone 14 US Letter canvas stays under 80 MB budget', () => {
    const cfg = getRenderConfig('auto', IPHONE_14);
    const optimal = calculateOptimalCanvasDimensions(
      VIEWPORT_US_LETTER_200DPI.width,
      VIEWPORT_US_LETTER_200DPI.height,
      cfg.canvasScaleFactor,
      cfg.maxCanvasDimension,
    );
    const mb = canvasMB(optimal.width, optimal.height);
    expect(mb).toBeLessThan(80);
    // Also assert we're doing meaningfully better than raw DPR would:
    const rawMb = canvasMB(
      VIEWPORT_US_LETTER_200DPI.width * IPHONE_14.devicePixelRatio,
      VIEWPORT_US_LETTER_200DPI.height * IPHONE_14.devicePixelRatio,
    );
    expect(mb).toBeLessThan(rawMb / 2);
  });

  it('low-end Android US Letter canvas stays under 40 MB budget', () => {
    const cfg = getRenderConfig('auto', LOW_END_ANDROID);
    const optimal = calculateOptimalCanvasDimensions(
      VIEWPORT_US_LETTER_200DPI.width,
      VIEWPORT_US_LETTER_200DPI.height,
      cfg.canvasScaleFactor,
      cfg.maxCanvasDimension,
    );
    expect(canvasMB(optimal.width, optimal.height)).toBeLessThan(40);
  });

  it('desktop Retina preserves full quality (no regression)', () => {
    const cfg = getRenderConfig('auto', DESKTOP_RETINA);
    const optimal = calculateOptimalCanvasDimensions(
      VIEWPORT_US_LETTER_200DPI.width,
      VIEWPORT_US_LETTER_200DPI.height,
      cfg.canvasScaleFactor,
      cfg.maxCanvasDimension,
    );
    // Desktop should render at the full devicePixelRatio.
    expect(optimal.actualScale).toBeCloseTo(DESKTOP_RETINA.devicePixelRatio, 2);
  });

  it('maxCanvasDimension clamp kicks in on absurdly large viewports', () => {
    const cfg = getRenderConfig('high'); // desktop profile
    const optimal = calculateOptimalCanvasDimensions(
      10000, // pathological viewport
      12000,
      cfg.canvasScaleFactor,
      cfg.maxCanvasDimension,
    );
    expect(optimal.width).toBeLessThanOrEqual(cfg.maxCanvasDimension);
    expect(optimal.height).toBeLessThanOrEqual(cfg.maxCanvasDimension);
  });
});
