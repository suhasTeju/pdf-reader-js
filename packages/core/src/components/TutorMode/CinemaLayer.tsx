'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  ActiveOverlay,
  ActionSpotlight,
  ActionUnderline,
  ActionHighlight,
  ActionPulse,
  ActionCallout,
  ActionBox,
} from '../../types/storyboard';
import type { PageBBoxData, BBoxIndex, BBoxCoords } from '../../types/bbox';
import { SpotlightMask } from './SpotlightMask';
import { AnimatedUnderline } from './AnimatedUnderline';
import { AnimatedHighlight } from './AnimatedHighlight';
import { PulseOverlay } from './PulseOverlay';
import { CalloutArrow } from './CalloutArrow';
import { BoxOverlay } from './BoxOverlay';

export interface CinemaLayerProps {
  page: PageBBoxData;
  index: BBoxIndex;
  overlays: ActiveOverlay[];
  scale: number;
}

function blockBbox(index: BBoxIndex, block_id: string): BBoxCoords | undefined {
  return index.blockById.get(block_id)?.block.bbox;
}

export function CinemaLayer({
  page,
  index,
  overlays,
  scale,
}: CinemaLayerProps) {
  return (
    <div
      data-role="cinema-layer"
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
        width: page.page_dimensions.width,
        height: page.page_dimensions.height,
        pointerEvents: 'none',
        // PDFPage renders internal layers at z-index 10/20/40/45/50
        // (canvas / text / highlight / focus / annotation). Without an
        // explicit z-index here, every tutor overlay stacks UNDER the
        // AnnotationLayer and becomes invisible. 100 puts us above all of
        // them while still letting the Exit button (z-index 60) remain
        // reachable because it sits OUTSIDE this stacking context.
        zIndex: 100,
      }}
    >
      <AnimatePresence>
        {overlays.map((overlay) => {
          switch (overlay.kind) {
            case 'spotlight': {
              const a = overlay.action as ActionSpotlight;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return (
                <SpotlightMask
                  key={overlay.id}
                  page={page.page_dimensions}
                  bbox={b}
                  action={a}
                />
              );
            }
            case 'underline': {
              const a = overlay.action as ActionUnderline;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <AnimatedUnderline key={overlay.id} bbox={b} action={a} />;
            }
            case 'highlight': {
              const a = overlay.action as ActionHighlight;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <AnimatedHighlight key={overlay.id} bbox={b} action={a} />;
            }
            case 'pulse': {
              const a = overlay.action as ActionPulse;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <PulseOverlay key={overlay.id} bbox={b} action={a} />;
            }
            case 'callout': {
              const a = overlay.action as ActionCallout;
              const from = blockBbox(index, a.from_block);
              const to = blockBbox(index, a.to_block);
              if (!from || !to) return null;
              return (
                <CalloutArrow
                  key={overlay.id}
                  fromBbox={from}
                  toBbox={to}
                  action={a}
                />
              );
            }
            case 'ghost_reference':
              // Ghost references are viewport-space UI chrome, not page-space
              // overlays — they must render OUTSIDE the camera scale
              // transform or they shrink with the PDF. Handled by
              // GhostReferenceOverlay at the TutorModeContainer root.
              return null;
            case 'box': {
              const a = overlay.action as ActionBox;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <BoxOverlay key={overlay.id} bbox={b} action={a} />;
            }
            case 'label':
              // Labels are viewport-space UI with block-derived anchors —
              // handled by LabelOverlay at the TutorModeContainer root so
              // typography doesn't shrink with the camera scale.
              return null;
            case 'clear':
            case 'camera':
              return null; // handled by engine, not rendered as overlays
          }
        })}
      </AnimatePresence>
    </div>
  );
}
