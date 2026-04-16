'use client';

import React from 'react';
import { useStore } from 'zustand';
import type { NarrationStoreApi } from 'pdfjs-reader-core';

export interface StoryboardLogProps {
  narrationStore: NarrationStoreApi;
}

export function StoryboardLog({ narrationStore }: StoryboardLogProps) {
  const lastStoryboard = useStore(narrationStore, (s) => s.lastStoryboard);
  const llmStatus = useStore(narrationStore, (s) => s.llmStatus);
  const engineStatus = useStore(narrationStore, (s) => s.engineStatus);
  const lastError = useStore(narrationStore, (s) => s.lastError);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);
  const camera = useStore(narrationStore, (s) => s.camera);

  const llmColor =
    llmStatus === 'failed'
      ? '#ef4444'
      : llmStatus === 'in-flight'
        ? '#f59e0b'
        : '#10b981';

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 8 }}>
        Storyboard log
      </h3>

      <div style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.7 }}>
        <div>
          LLM:{' '}
          <span style={{ color: llmColor, fontWeight: 600 }}>
            {llmStatus === 'in-flight' ? '⏳ thinking…' : llmStatus}
          </span>
        </div>
        <div>Engine: {engineStatus}</div>
        <div>
          Camera: scale={camera.scale.toFixed(2)} x={camera.x.toFixed(0)} y=
          {camera.y.toFixed(0)}
        </div>
        <div>Active overlays: {activeOverlays.length}</div>
        {lastError ? (
          <div
            style={{
              color: '#ef4444',
              marginTop: 6,
              padding: 6,
              background: 'rgba(239,68,68,0.1)',
              borderRadius: 4,
              wordBreak: 'break-word',
            }}
          >
            Error: {lastError.slice(0, 200)}
            {lastError.length > 200 ? '…' : ''}
          </div>
        ) : null}
      </div>

      {activeOverlays.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Currently visible:
          </div>
          {activeOverlays.map((o) => (
            <div
              key={o.id}
              style={{
                fontSize: 11,
                background: '#1a1e2e',
                padding: '4px 8px',
                borderRadius: 4,
                marginBottom: 2,
                fontFamily: 'monospace',
              }}
            >
              {o.kind} →{' '}
              {'target_block' in o.action ? o.action.target_block : ''}
            </div>
          ))}
        </div>
      ) : null}

      {lastStoryboard ? (
        <>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Last storyboard from LLM:
          </div>
          {lastStoryboard.reasoning ? (
            <div
              style={{
                fontSize: 11,
                fontStyle: 'italic',
                opacity: 0.8,
                marginBottom: 6,
                padding: 6,
                background: '#1a1e2e',
                borderRadius: 4,
              }}
            >
              &ldquo;{lastStoryboard.reasoning}&rdquo;
            </div>
          ) : null}
          <pre
            style={{
              fontSize: 10,
              background: '#0b0f1a',
              border: '1px solid #333',
              padding: 8,
              borderRadius: 4,
              overflow: 'auto',
              maxHeight: 280,
              margin: 0,
            }}
          >
            {JSON.stringify(lastStoryboard, null, 2)}
          </pre>
        </>
      ) : (
        <div style={{ opacity: 0.6, fontSize: 12 }}>
          No storyboard yet. Click a scripted chunk below or send your own.
        </div>
      )}
    </div>
  );
}
