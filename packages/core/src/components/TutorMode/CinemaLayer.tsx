'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  ActiveOverlay,
  ActionSpotlight,
} from '../../types/storyboard';
import type { PageBBoxData, BBoxIndex, BBoxCoords } from '../../types/bbox';
import { SpotlightMask } from './SpotlightMask';

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
          if (overlay.kind === 'spotlight') {
            const action = overlay.action as ActionSpotlight;
            const bbox = blockBbox(index, action.target_block);
            if (!bbox) return null;
            return (
              <SpotlightMask
                key={overlay.id}
                page={page.page_dimensions}
                bbox={bbox}
                action={action}
              />
            );
          }
          // Other overlay kinds added in later tasks.
          return null;
        })}
      </AnimatePresence>
    </div>
  );
}
