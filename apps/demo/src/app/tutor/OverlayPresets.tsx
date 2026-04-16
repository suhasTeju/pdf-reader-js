'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  StoryboardEngine,
  buildBBoxIndex,
  type NarrationStoreApi,
  type PageBBoxData,
  type Storyboard,
} from 'pdfjs-reader-core';

export interface OverlayPresetsProps {
  bbox: PageBBoxData[];
  currentPage: number;
  narrationStore: NarrationStoreApi;
  onPageChange: (page: number) => void;
}

interface Preset {
  label: string;
  kinds: string[];
  build: (page: PageBBoxData, crossPage: PageBBoxData | undefined) => Storyboard | null;
  pageOverride?: number;
  color: string;
}

/**
 * Find the first block on the page matching any of the given types, or the
 * first block at all. Guarantees a real block_id so overlays never silently
 * drop due to target lookup failure.
 */
function pickBlock(
  page: PageBBoxData,
  types: string[] = [],
): PageBBoxData['blocks'][number] | null {
  if (!page.blocks.length) return null;
  for (const t of types) {
    const hit = page.blocks.find((b) => b.type === t);
    if (hit) return hit;
  }
  return page.blocks[0];
}

const PRESETS: Preset[] = [
  {
    label: '1. Camera only (safety-net should auto-pulse)',
    kinds: ['camera', 'pulse?'],
    color: '#60A5FA',
    build: (page) => {
      const b = pickBlock(page, ['paragraph', 'heading']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: camera only — safety net should auto-append pulse',
        steps: [
          {
            at_ms: 0,
            duration_ms: 800,
            action: {
              type: 'camera',
              target_block: b.block_id,
              scale: 1.1,
              padding: 80,
              easing: 'ease-out',
            },
          },
        ],
      };
    },
  },
  {
    label: '2. Spotlight (dim everything but one block)',
    kinds: ['spotlight'],
    color: '#FBBF24',
    build: (page) => {
      const b = pickBlock(page, ['paragraph', 'heading']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: spotlight',
        steps: [
          {
            at_ms: 0,
            duration_ms: 3000,
            action: {
              type: 'spotlight',
              target_block: b.block_id,
              dim_opacity: 0.7,
              feather_px: 40,
              shape: 'rounded',
            },
          },
        ],
      };
    },
  },
  {
    label: '3. Underline (sketch-style draw-in)',
    kinds: ['underline'],
    color: '#F59E0B',
    build: (page) => {
      const b = pickBlock(page, ['paragraph', 'list_item', 'heading']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: underline sketch',
        steps: [
          {
            at_ms: 0,
            duration_ms: 2500,
            action: {
              type: 'underline',
              target_block: b.block_id,
              color: '#FBBF24',
              style: 'sketch',
              draw_duration_ms: 900,
            },
          },
        ],
      };
    },
  },
  {
    label: '4. Highlight (amber marker)',
    kinds: ['highlight'],
    color: '#FACC15',
    build: (page) => {
      const b = pickBlock(page, ['list_item', 'paragraph']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: highlight',
        steps: [
          {
            at_ms: 0,
            duration_ms: 2500,
            action: {
              type: 'highlight',
              target_block: b.block_id,
              color: 'rgba(250, 204, 21, 0.45)',
              draw_duration_ms: 600,
            },
          },
        ],
      };
    },
  },
  {
    label: '5. Pulse (scale-in-out, strong)',
    kinds: ['pulse'],
    color: '#F472B6',
    build: (page) => {
      const b = pickBlock(page, ['figure', 'heading', 'paragraph']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: pulse strong',
        steps: [
          {
            at_ms: 0,
            duration_ms: 2500,
            action: {
              type: 'pulse',
              target_block: b.block_id,
              count: 3,
              intensity: 'strong',
            },
          },
        ],
      };
    },
  },
  {
    label: '6. Callout (arrow between two blocks)',
    kinds: ['callout'],
    color: '#34D399',
    build: (page) => {
      // Need two different blocks for from/to.
      const caption = page.blocks.find((b) => b.type === 'caption');
      const figure = page.blocks.find((b) => b.type === 'figure');
      if (caption && figure) {
        return {
          version: 1,
          reasoning: 'preset: callout caption → figure',
          steps: [
            {
              at_ms: 0,
              duration_ms: 3000,
              action: {
                type: 'callout',
                from_block: caption.block_id,
                to_block: figure.block_id,
                label: 'see here',
                curve: 'curved',
              },
            },
          ],
        };
      }
      // Fallback: two different blocks by index.
      if (page.blocks.length < 2) return null;
      return {
        version: 1,
        reasoning: 'preset: callout first → last block',
        steps: [
          {
            at_ms: 0,
            duration_ms: 3000,
            action: {
              type: 'callout',
              from_block: page.blocks[0].block_id,
              to_block: page.blocks[page.blocks.length - 1].block_id,
              label: 'connects',
              curve: 'curved',
            },
          },
        ],
      };
    },
  },
  {
    label: '7. Box (solid blue frame)',
    kinds: ['box'],
    color: '#93C5FD',
    build: (page) => {
      const b = pickBlock(page, ['table', 'figure', 'paragraph']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: box solid',
        steps: [
          {
            at_ms: 0,
            duration_ms: 3000,
            action: {
              type: 'box',
              target_block: b.block_id,
              color: '#3B82F6',
              style: 'solid',
            },
          },
        ],
      };
    },
  },
  {
    label: '8. Label (sticky tag on top of a block)',
    kinds: ['label'],
    color: '#C4B5FD',
    build: (page) => {
      const b = pickBlock(page, ['heading', 'paragraph']);
      if (!b) return null;
      return {
        version: 1,
        reasoning: 'preset: label',
        steps: [
          {
            at_ms: 0,
            duration_ms: 3000,
            action: {
              type: 'label',
              target_block: b.block_id,
              text: 'definition',
              position: 'top',
            },
          },
        ],
      };
    },
  },
  {
    label: '9. Ghost reference (cross-page card)',
    kinds: ['ghost_reference'],
    color: '#A78BFA',
    build: (_page, crossPage) => {
      if (!crossPage) return null;
      const b =
        crossPage.blocks.find((x) => x.type === 'figure') ?? crossPage.blocks[0];
      if (!b) return null;
      return {
        version: 1,
        reasoning: `preset: ghost reference to page ${crossPage.page_number}`,
        steps: [
          {
            at_ms: 0,
            duration_ms: 3000,
            action: {
              type: 'ghost_reference',
              target_page: crossPage.page_number,
              target_block: b.block_id,
              position: 'top-right',
            },
          },
        ],
      };
    },
  },
  {
    label: '10. ALL 8 overlays at once (staggered)',
    kinds: [
      'spotlight',
      'underline',
      'highlight',
      'pulse',
      'callout',
      'box',
      'label',
      'ghost_reference',
    ],
    color: '#EC4899',
    build: (page, crossPage) => {
      const heading = page.blocks.find((b) => b.type === 'heading');
      const para = page.blocks.find((b) => b.type === 'paragraph');
      const list = page.blocks.find((b) => b.type === 'list_item');
      const caption = page.blocks.find((b) => b.type === 'caption');
      const figure = page.blocks.find((b) => b.type === 'figure');
      const crossFig =
        crossPage?.blocks.find((b) => b.type === 'figure') ??
        crossPage?.blocks[0];
      const steps: Storyboard['steps'] = [];
      if (heading) {
        steps.push({
          at_ms: 0,
          duration_ms: 4000,
          action: {
            type: 'spotlight',
            target_block: heading.block_id,
            dim_opacity: 0.65,
            feather_px: 40,
            shape: 'rounded',
          },
        });
      }
      if (para) {
        steps.push({
          at_ms: 500,
          duration_ms: 3500,
          action: {
            type: 'underline',
            target_block: para.block_id,
            color: '#FBBF24',
            style: 'sketch',
            draw_duration_ms: 900,
          },
        });
      }
      if (list) {
        steps.push({
          at_ms: 1000,
          duration_ms: 3500,
          action: {
            type: 'highlight',
            target_block: list.block_id,
            color: 'rgba(250, 204, 21, 0.45)',
            draw_duration_ms: 600,
          },
        });
      }
      if (figure) {
        steps.push({
          at_ms: 1500,
          duration_ms: 3000,
          action: {
            type: 'pulse',
            target_block: figure.block_id,
            count: 2,
            intensity: 'strong',
          },
        });
      }
      if (caption && figure) {
        steps.push({
          at_ms: 2000,
          duration_ms: 3000,
          action: {
            type: 'callout',
            from_block: caption.block_id,
            to_block: figure.block_id,
            label: 'see',
            curve: 'curved',
          },
        });
      }
      if (para) {
        steps.push({
          at_ms: 2500,
          duration_ms: 2500,
          action: {
            type: 'box',
            target_block: para.block_id,
            color: '#3B82F6',
            style: 'dashed',
          },
        });
      }
      if (heading) {
        steps.push({
          at_ms: 3000,
          duration_ms: 2500,
          action: {
            type: 'label',
            target_block: heading.block_id,
            text: 'all effects',
            position: 'top',
          },
        });
      }
      if (crossPage && crossFig) {
        steps.push({
          at_ms: 3500,
          duration_ms: 2000,
          action: {
            type: 'ghost_reference',
            target_page: crossPage.page_number,
            target_block: crossFig.block_id,
            position: 'top-right',
          },
        });
      }
      if (steps.length === 0) return null;
      // Cap to 4 steps to satisfy StoryboardSchema (max 4). For "all overlays"
      // we build a longer sequence and fire it in two batches.
      return {
        version: 1,
        reasoning: 'preset: all overlays (batch 1)',
        steps: steps.slice(0, 4) as Storyboard['steps'],
      };
    },
  },
];

export function OverlayPresets({
  bbox,
  currentPage,
  narrationStore,
  onPageChange,
}: OverlayPresetsProps) {
  const index = useMemo(() => buildBBoxIndex(bbox), [bbox]);
  const engineRef = useRef<StoryboardEngine | null>(null);
  const viewportRef = useRef({ width: 800, height: 1000 });

  useEffect(() => {
    // Try to read the actual viewport so camera math lands correctly.
    const el = document.querySelector<HTMLElement>(
      '[data-role="tutor-mode-container"]',
    );
    if (el) {
      viewportRef.current = {
        width: el.clientWidth,
        height: el.clientHeight,
      };
    }
    engineRef.current = new StoryboardEngine({
      narrationStore,
      bboxIndex: index,
      getViewport: () => viewportRef.current,
      // Match the default hold in TutorModeContainer so preset overlays don't
      // flash past before the eye can register them.
      minOverlayDurationMs: 3500,
    });
    return () => engineRef.current?.cancelPending();
  }, [narrationStore, index]);

  function firePreset(preset: Preset) {
    const page = index.byPage.get(currentPage);
    if (!page) {
      // eslint-disable-next-line no-console
      console.warn('[preset] no page data for', currentPage);
      return;
    }
    // For ghost_reference / all-overlays we need a DIFFERENT page.
    const crossPage =
      bbox.find((p) => p.page_number !== currentPage && p.blocks.length > 0) ??
      undefined;
    const sb = preset.build(page, crossPage);
    if (!sb) {
      // eslint-disable-next-line no-console
      console.warn('[preset] build returned null for', preset.label);
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[preset] firing', preset.label, sb);
    narrationStore.getState().appendDebugEvent({
      kind: 'note',
      summary: `preset → ${preset.label}`,
      payload: sb,
    });
    engineRef.current?.execute(sb);
  }

  function clearAll() {
    narrationStore.getState().clearOverlays();
  }

  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 14, margin: 0 }}>
          Overlay presets <span style={{ opacity: 0.55, fontWeight: 400 }}>(bypass LLM)</span>
        </h3>
        <button
          onClick={clearAll}
          style={{
            fontSize: 11,
            padding: '2px 10px',
            background: '#1a1e2e',
            color: 'white',
            border: '1px solid #444',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10, lineHeight: 1.5 }}>
        Each button dispatches a storyboard DIRECTLY to the engine. If nothing
        visible appears when you click these, the rendering layer is broken —
        the LLM is not in the path. Presets fire against page {currentPage}.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => firePreset(preset)}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              background: '#1a1e2e',
              color: 'white',
              border: `1px solid ${preset.color}40`,
              borderLeft: `3px solid ${preset.color}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'ui-monospace, monospace',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ color: preset.color, marginRight: 8 }}>●</span>
            {preset.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55, lineHeight: 1.4 }}>
        Tip: open DevTools console — each click logs the storyboard. Preset #9
        (ghost_reference) and #10 (all-overlays) auto-pick a different page for
        the cross-page target. You can change page with the chunk composer nav.
        <span style={{ display: 'block', marginTop: 4 }}>
          Current page: {currentPage}
        </span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: '#1a1e2e',
            color: 'white',
            border: '1px solid #444',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ◀ Prev page
        </button>
        <button
          onClick={() => onPageChange(Math.min(bbox.length, currentPage + 1))}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: '#1a1e2e',
            color: 'white',
            border: '1px solid #444',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Next page ▶
        </button>
      </div>
    </div>
  );
}
