'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { GhostReference } from './GhostReference';
import type {
  ActiveOverlay,
  ActionGhostReference,
} from '../../types/storyboard';
import type { BBoxIndex } from '../../types/bbox';

export interface GhostReferenceOverlayProps {
  overlays: ActiveOverlay[];
  index: BBoxIndex;
}

/**
 * Hosts ghost_reference cards at viewport space — OUTSIDE the CameraView
 * scale transform. Rendered as a sibling of CameraView inside
 * TutorModeContainer so the cards stay at natural size even when the
 * camera is zoomed to fit-page (which otherwise shrinks everything
 * inside the transform tree).
 */
export function GhostReferenceOverlay({
  overlays,
  index,
}: GhostReferenceOverlayProps): React.ReactElement {
  const ghosts = overlays.filter((o) => o.kind === 'ghost_reference');

  return (
    <div
      data-role="ghost-reference-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        // Sits above the Reset view button (z-60) so a ghost card doesn't
        // disappear behind it if the host also renders the Reset button.
        zIndex: 70,
      }}
    >
      <AnimatePresence>
        {ghosts.map((overlay) => {
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
        })}
      </AnimatePresence>
    </div>
  );
}
