/**
 * Shared design tokens for the tutor overlay primitives. Ensures the
 * spotlight / underline / highlight / callout / pulse / label / ghost
 * card all read as a single editorial system — cream paper, terracotta
 * accent, warm ink shadows, classical serif type.
 *
 * Changing a value here updates every overlay at once. Aria (or any
 * consumer) can swap the palette by shadowing this module via bundler
 * aliases if they need to rebrand.
 */

export const INK = '#2a2420';
export const INK_SOFT = 'rgba(42, 36, 32, 0.72)';
export const INK_DIM = 'rgba(42, 36, 32, 0.38)';

export const PAPER = '#faf6ec';
export const PAPER_DEEP = '#f3ece0';

/** Terracotta / book-red — the primary annotation colour. */
export const ACCENT = '#b04a1a';
export const ACCENT_SOFT = 'rgba(176, 74, 26, 0.18)';
export const ACCENT_GLOW = 'rgba(176, 74, 26, 0.35)';

/** Highlighter amber — warmed-down, less neon than default yellow. */
export const MARKER = '#e6b422';
export const MARKER_SOFT = 'rgba(230, 180, 34, 0.38)';

/** Classical serif stack — no web fonts required, bookish on every OS. */
export const SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', 'EB Garamond', 'Hoefler Text', Georgia, serif";

/** Custom out-expo cubic-bezier — unhurried settle, not a bouncy easeOut. */
export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

/*
 * Viewport-responsive typography for tutor-overlay pills. The pill system
 * (callout labels, sticky labels, ghost references) lives in VIEWPORT space
 * — outside the CameraView transform — so it can't inherit `camera.scale`.
 * Without a clamp, a font size tuned for a ~375 px phone reads as too small
 * on a 1440 px desktop AND the fixed maxWidth truncates labels that have
 * ample room. These tokens express "same annotation character, proportional
 * to the viewport" in one place.
 *
 * Curves were tuned against: iPhone 12 (375), iPad (768), standard desktop
 * (1440), wide desktop (1920). The min/max clamps guarantee readable
 * typography on extreme viewports.
 */

/** All-caps callout annotation — tight, editorial marginalia vocabulary.
 *  Clamp curve shifted down 1.5px across the board in v0.5.x follow-up so
 *  wrapped labels fit more comfortably in narrow pill widths on mobile. */
export const PILL_FONT_CAPS = 'clamp(9px, 0.55vw + 7px, 13px)';
/** Sentence-case pin body — slightly larger, the standard overlay label.
 *  Also shifted down 1.5px to match PILL_FONT_CAPS. */
export const PILL_FONT_BODY = 'clamp(10.5px, 0.6vw + 8.5px, 15px)';
/** Display/marginalia card body — the ghost-reference text block. */
export const PILL_FONT_DISPLAY = 'clamp(14px, 0.75vw + 12px, 19px)';

/** Max pill width for all-caps callout labels. Expands with viewport so
 *  longer phrases ("PRIMARY CARTILAGINOUS JOINTS") don't truncate on
 *  desktop where there's clearly room. */
export const PILL_MAX_W_CAPS = 'clamp(180px, 26vw, 380px)';
export const PILL_MAX_W_BODY = 'clamp(200px, 28vw, 440px)';

/**
 * Runtime resolvers mirroring the CSS clamps above. Callout geometry
 * (auto-flip side selection, viewport bound clamping) runs in JS and
 * needs the SAME numeric value that the clamp CSS will evaluate to —
 * otherwise the pill's position calculation disagrees with its rendered
 * size. Kept in sync with the strings by construction: if you edit a
 * clamp curve above, update its resolver pair.
 */
export function resolvePillOffset(viewportWidthPx: number): number {
  return clamp(0.022 * viewportWidthPx + 12, 20, 44);
}
export function resolveMaxPillW(viewportWidthPx: number): number {
  return clamp(0.26 * viewportWidthPx, 180, 380);
}
export function resolveMaxPillH(viewportWidthPx: number): number {
  // Pill height is mostly font-driven; ~2.6× the font size accounts for
  // line-height + padding. Tracks PILL_FONT_CAPS (shifted down 1.5px).
  const font = clamp(0.0055 * viewportWidthPx + 7, 9, 13);
  return clamp(font * 2.6, 24, 36);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
