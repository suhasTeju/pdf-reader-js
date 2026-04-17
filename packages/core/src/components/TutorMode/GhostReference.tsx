import React from 'react';
import { motion } from 'framer-motion';
import type { ActionGhostReference } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';
import { PILL_FONT_DISPLAY } from './tokens';

export interface GhostReferenceProps {
  page: PageDimensionsDpi;
  sourceBbox: BBoxCoords;
  sourceBlockText: string | null;
  sourcePageNumber: number;
  action: ActionGhostReference;
}

/**
 * Design: **Editorial marginalia.** The card channels the aesthetic of a
 * well-designed textbook footnote — cream paper stock, a terracotta
 * footnote rule, classical serif body, a refined locator thumbnail drawn
 * with simulated text lines. This is an anatomy / medical-education
 * context; the design language should match the object students are
 * already reading (a book) rather than feel like a notification card.
 *
 * Anchor offsets scale with viewport so the card never pins off-screen.
 */
const POSITIONS: Record<
  ActionGhostReference['position'],
  React.CSSProperties
> = {
  'top-right': {
    top: 'clamp(12px, 4vw, 40px)',
    right: 'clamp(12px, 4vw, 40px)',
  },
  'top-left': {
    top: 'clamp(12px, 4vw, 40px)',
    left: 'clamp(12px, 4vw, 40px)',
  },
  'bottom-right': {
    bottom: 'clamp(12px, 4vw, 40px)',
    right: 'clamp(12px, 4vw, 40px)',
  },
  'bottom-left': {
    bottom: 'clamp(12px, 4vw, 40px)',
    left: 'clamp(12px, 4vw, 40px)',
  },
};

// Editorial palette — warm paper + book-red accent.
const INK = '#2a2420';
const PAPER = '#faf6ec';
const PAPER_DEEP = '#f3ece0';
const ACCENT = '#b04a1a'; // terracotta / book-red
const RULE = 'rgba(42, 36, 32, 0.10)';

/**
 * Classical serif stack. No web fonts required — relies on platform
 * classics (Iowan / Palatino / Garamond / Book Antiqua) so the card
 * inherits bookish type on macOS, iOS, and Windows, with a graceful
 * fallback to Georgia, then generic serif.
 */
const SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', 'EB Garamond', 'Hoefler Text', Georgia, serif";

export function GhostReference({
  page,
  sourceBbox,
  sourceBlockText,
  action,
}: GhostReferenceProps) {
  const [x1, y1, x2, y2] = sourceBbox;
  const text = sourceBlockText ?? '(figure)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1], // custom out-expo for an unhurried settle
      }}
      style={{
        position: 'absolute',
        width: 'min(420px, calc(100vw - clamp(24px, 8vw, 80px)))',
        background: PAPER,
        color: INK,
        border: `1px solid ${RULE}`,
        // Barely-there corner radius — square-ish corners feel editorial,
        // 12px+ radius feels SaaS-notification. 3px is the sweet spot.
        borderRadius: 3,
        overflow: 'hidden',
        // Warm, two-layer shadow: a tight contact shadow for definition,
        // a wider diffuse one tinted toward ink rather than pure grey.
        boxShadow:
          '0 1px 2px rgba(42, 36, 32, 0.10), 0 20px 44px -14px rgba(42, 36, 32, 0.22), 0 8px 20px -10px rgba(42, 36, 32, 0.14)',
        pointerEvents: 'none',
        ...POSITIONS[action.position],
      }}
      data-role="ghost-reference"
    >
      {/* Vertical footnote rule — classical book-design accent. Draws
         downward from the top on entry like a typesetter's ruler. */}
      <motion.span
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        exit={{ scaleY: 0 }}
        transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: ACCENT,
          transformOrigin: 'top',
        }}
      />

      {/* Paper texture: a whisper of warm gradient + noise simulated with
         overlapping radial highlights for subtle "laid paper" depth. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(120% 80% at 0% 0%, rgba(255, 244, 220, 0.5) 0%, transparent 55%),
            radial-gradient(100% 80% at 100% 100%, rgba(243, 229, 200, 0.35) 0%, transparent 60%)
          `,
        }}
      />

      <div
        style={{
          position: 'relative',
          // Padding scales with viewport: compact on phones, breathing on
          // desktop. Extra 4px on the left preserves the footnote-rule gap.
          padding:
            'clamp(14px, 1.4vw + 10px, 26px) clamp(14px, 1.4vw + 10px, 26px) clamp(14px, 1.4vw + 10px, 26px) clamp(18px, 1.4vw + 14px, 30px)',
          display: 'flex',
          gap: 'clamp(12px, 1.1vw + 8px, 20px)',
          alignItems: 'flex-start',
        }}
      >
        {/* Locator — a stylised page thumbnail with simulated text lines
           so the miniature feels like a page rather than an abstract
           rectangle. Target region highlighted in the accent colour. */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{
            flexShrink: 0,
            width: 'clamp(40px, 4vw + 20px, 64px)',
            aspectRatio: `${page.width} / ${page.height}`,
            background: PAPER_DEEP,
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow:
              'inset 0 0 0 1px rgba(42, 36, 32, 0.12), 0 1px 3px rgba(42, 36, 32, 0.10)',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${page.width} ${page.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block' }}
          >
            <rect
              x={0}
              y={0}
              width={page.width}
              height={page.height}
              fill={PAPER_DEEP}
            />
            {/* Faux text lines — vary widths for natural typographic
               rhythm. They're all grey; the accent is reserved for the
               target region so the eye tracks to it first. */}
            {TEXT_LINES.map((ln, i) => (
              <rect
                key={i}
                x={page.width * ln.x}
                y={page.height * ln.y}
                width={page.width * ln.w}
                height={page.height * 0.012}
                fill="rgba(42, 36, 32, 0.18)"
              />
            ))}
            {/* Target region — pill of accent colour, stroked. */}
            <rect
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill="rgba(176, 74, 26, 0.28)"
              stroke={ACCENT}
              strokeWidth={18}
            />
          </svg>
        </motion.div>

        {/* Referenced text — classical serif, generous leading, hanging
           glyph. A single terracotta glyph pulls the eye into the quote
           and ties the text back to the rule and target region. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: SERIF,
            fontSize: PILL_FONT_DISPLAY,
            lineHeight: 1.55,
            color: INK,
            fontFeatureSettings: "'liga' 1, 'kern' 1, 'onum' 1",
            textRendering: 'optimizeLegibility',
            letterSpacing: 0.05,
            // Hang an ornamental opening glyph outside the text column
            // so the reader's eye falls into the paragraph as if into a
            // well-set pull quote.
            position: 'relative',
            paddingLeft: 2,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: -14,
              top: -2,
              color: ACCENT,
              fontSize: 'clamp(18px, 1vw + 14px, 28px)',
              lineHeight: 1,
              fontWeight: 500,
              // ornamental flourish anchoring the paragraph
            }}
          >
            ❧
          </span>
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 8,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {text}
          </span>
        </motion.div>
      </div>

      {/* Foot ornament: a short hairline rule at the bottom-right, the
         signature of a well-typeset aside. */}
      <motion.span
        aria-hidden
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.6 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          right: 22,
          bottom: 10,
          height: 1,
          width: 28,
          background: ACCENT,
          transformOrigin: 'right',
        }}
      />
    </motion.div>
  );
}

/**
 * Pre-computed faux text lines for the locator thumbnail. Positions are
 * fractions of page dimensions so the lines scale with any aspect ratio.
 * Mild width variation mimics real paragraph ragging.
 */
const TEXT_LINES: ReadonlyArray<{ x: number; y: number; w: number }> = [
  { x: 0.10, y: 0.12, w: 0.54 },
  { x: 0.10, y: 0.18, w: 0.68 },
  { x: 0.10, y: 0.24, w: 0.48 },
  { x: 0.10, y: 0.34, w: 0.72 },
  { x: 0.10, y: 0.40, w: 0.62 },
  { x: 0.10, y: 0.46, w: 0.66 },
  { x: 0.10, y: 0.56, w: 0.56 },
  { x: 0.10, y: 0.62, w: 0.70 },
  { x: 0.10, y: 0.68, w: 0.44 },
  { x: 0.10, y: 0.78, w: 0.64 },
  { x: 0.10, y: 0.84, w: 0.58 },
];
