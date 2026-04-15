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
  ActionGhostReference,
  ActionBox,
  ActionLabel,
} from '../../types/storyboard';
import type { PageBBoxData, BBoxIndex, BBoxCoords } from '../../types/bbox';
import { SpotlightMask } from './SpotlightMask';
import { AnimatedUnderline } from './AnimatedUnderline';
import { Highlight } from './Highlight';
import { PulseOverlay } from './PulseOverlay';
import { CalloutArrow } from './CalloutArrow';
import { GhostReference } from './GhostReference';
import { BoxOverlay } from './BoxOverlay';
import { StickyLabel } from './StickyLabel';

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
              return <Highlight key={overlay.id} bbox={b} action={a} />;
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
            case 'ghost_reference': {
              const a = overlay.action as ActionGhostReference;
              const hit = index.blockById.get(a.target_block);
              if (!hit) return null;
              const targetPage = index.byPage.get(a.target_page);
              if (!targetPage) return null;
              return (
                <GhostReference
                  key={overlay.id}
                  page={targetPage.page_dimensions}
                  sourceBbox={hit.block.bbox}
                  sourceBlockText={hit.block.text}
                  sourcePageNumber={hit.pageNumber}
                  action={a}
                />
              );
            }
            case 'box': {
              const a = overlay.action as ActionBox;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <BoxOverlay key={overlay.id} bbox={b} action={a} />;
            }
            case 'label': {
              const a = overlay.action as ActionLabel;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <StickyLabel key={overlay.id} bbox={b} action={a} />;
            }
            case 'clear':
            case 'camera':
              return null; // handled by engine, not rendered as overlays
          }
        })}
      </AnimatePresence>
    </div>
  );
}
