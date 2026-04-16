'use client';

import React from 'react';
import { useStore } from 'zustand';
import type { PageBBoxData, NarrationStoreApi } from '@pdf-reader/core';

export interface PageBlocksPanelProps {
  bbox: PageBBoxData[];
  currentPage: number;
  narrationStore: NarrationStoreApi;
  /** Click a block row → send a chunk containing that block's text. */
  onSendBlockChunk?: (text: string) => void;
}

/**
 * Surfaces the exact per-page block inventory that the LLM receives. Rows
 * highlight when an overlay is currently anchored to that block, so the
 * reader can verify the LLM anchored to the right target.
 */
export function PageBlocksPanel({
  bbox,
  currentPage,
  narrationStore,
  onSendBlockChunk,
}: PageBlocksPanelProps) {
  const page = bbox.find((p) => p.page_number === currentPage);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);

  const activeTargets = new Set<string>();
  for (const o of activeOverlays) {
    const a = o.action as { target_block?: string; from_block?: string; to_block?: string };
    if (a.target_block) activeTargets.add(a.target_block);
    if (a.from_block) activeTargets.add(a.from_block);
    if (a.to_block) activeTargets.add(a.to_block);
  }

  if (!page) {
    return (
      <div style={PAD}>
        <h3 style={H3}>Page blocks</h3>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          No fixture for page {currentPage}.
        </div>
      </div>
    );
  }

  return (
    <div style={PAD}>
      <h3 style={H3}>
        Page {currentPage} blocks ({page.blocks.length}) — these are what the LLM sees
      </h3>
      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>
        Valid target_block ids for this page. Rows pulse yellow when an overlay
        is anchored to them.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {page.blocks.map((b) => {
          const hot = activeTargets.has(b.block_id);
          return (
            <button
              key={b.block_id}
              onClick={() => b.text && onSendBlockChunk?.(b.text)}
              disabled={!b.text}
              style={{
                textAlign: 'left',
                background: hot ? '#422006' : '#0f1423',
                border: `1px solid ${hot ? '#FBBF24' : '#2a3244'}`,
                borderRadius: 6,
                padding: '8px 10px',
                color: 'white',
                cursor: b.text ? 'pointer' : 'default',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                lineHeight: 1.4,
                touchAction: 'manipulation',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: hot ? '#FBBF24' : '#60A5FA', fontWeight: 600 }}>
                  {b.block_id}
                </span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>
                  {b.type} · {b.default_action}
                </span>
              </div>
              {b.text ? (
                <div
                  style={{
                    marginTop: 4,
                    opacity: 0.85,
                    fontFamily: 'system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b.text}
                </div>
              ) : (
                <div style={{ marginTop: 4, opacity: 0.4, fontStyle: 'italic' }}>
                  (no text — figure region)
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PAD: React.CSSProperties = {
  padding: 16,
  borderBottom: '1px solid #333',
};

const H3: React.CSSProperties = {
  fontSize: 14,
  margin: '0 0 8px 0',
  fontFamily: 'system-ui, sans-serif',
};
