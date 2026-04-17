'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { StickyLabel } from './StickyLabel';
import type { ActiveOverlay, ActionLabel, CameraState } from '../../types/storyboard';
import type { BBoxIndex, PageBBoxData, BBoxCoords } from '../../types/bbox';

export interface LabelOverlayProps {
  overlays: ActiveOverlay[];
  index: BBoxIndex;
  currentPage: number;
  camera: CameraState;
  viewport: { width: number; height: number };
}

/**
 * Hosts `label` overlays at viewport space, OUTSIDE the CameraView scale
 * transform — so the pin body always renders at natural size (readable
 * at fit-page zoom) and its typography is never crushed.
 *
 * To keep the pin tethered to its block we compute the screen-space
 * anchor ourselves using the current camera state. The outer container
 * centres the page and applies `transform: scale(camera.scale)
 * translate(camera.x, camera.y)` — the exact math of CameraView. We
 * then project the block's bbox centre (in PDF units) onto the
 * viewport and place the pin there.
 *
 * When the camera animates (CameraView uses framer-motion), the store's
 * `camera.scale` / `x` / `y` update only at the boundary of each step.
 * Storyboards typically fire the label AFTER the camera move (100–300 ms
 * later), so by the time the label mounts the camera has settled at its
 * new values. Any mid-animation drift is imperceptible.
 */
export function LabelOverlay({
  overlays,
  index,
  currentPage,
  camera,
  viewport,
}: LabelOverlayProps): React.ReactElement {
  const labels = overlays.filter((o) => o.kind === 'label');
  const page = index.byPage.get(currentPage);

  return (
    <div
      data-role="label-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        // Above CameraView and the Reset button but not above
        // GhostReferenceOverlay (z:70) — labels are block-attached and
        // should not cover a cross-page reference card.
        zIndex: 65,
      }}
    >
      <AnimatePresence>
        {page
          ? labels.map((overlay) => {
              const a = overlay.action as ActionLabel;
              const hit = index.blockById.get(a.target_block);
              if (!hit) return null;
              const anchor = computeScreenAnchor(
                hit.block.bbox,
                a.position,
                page,
                camera,
                viewport,
              );
              return (
                <StickyLabel
                  key={overlay.id}
                  screenAnchor={anchor}
                  action={a}
                />
              );
            })
          : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Map a block's bbox edge midpoint (the logical anchor for the chosen
 * side) to viewport pixels, using the same geometry the PDF + CameraView
 * apply to the rendered page:
 *
 *   screenX = viewportCX + cameraX + (bboxPt.x − pageCX) × cameraScale
 *   screenY = viewportCY + cameraY + (bboxPt.y − pageCY) × cameraScale
 *
 * `viewportCX/Y` are the viewport's centre, matched to the
 * `top: 50%; left: 50%; translate(-50%,-50%)` wrapper in
 * TutorModeContainer. `cameraX/Y` are the CameraView translate; they
 * are already in viewport pixels (applied post-scale by CameraView, so
 * we add them directly).
 */
function computeScreenAnchor(
  bbox: BBoxCoords,
  where: ActionLabel['position'],
  page: PageBBoxData,
  camera: CameraState,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const [x1, y1, x2, y2] = bbox;
  const pageCX = page.page_dimensions.width / 2;
  const pageCY = page.page_dimensions.height / 2;

  // Block anchor point in PDF units — midpoint of the chosen edge.
  let px: number, py: number;
  switch (where) {
    case 'top':
      px = (x1 + x2) / 2;
      py = y1;
      break;
    case 'bottom':
      px = (x1 + x2) / 2;
      py = y2;
      break;
    case 'left':
      px = x1;
      py = (y1 + y2) / 2;
      break;
    case 'right':
      px = x2;
      py = (y1 + y2) / 2;
      break;
    default:
      px = (x1 + x2) / 2;
      py = y1;
  }

  const screenX =
    viewport.width / 2 + camera.x + (px - pageCX) * camera.scale;
  const screenY =
    viewport.height / 2 + camera.y + (py - pageCY) * camera.scale;

  return { x: screenX, y: screenY };
}
