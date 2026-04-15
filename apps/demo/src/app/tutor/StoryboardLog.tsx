'use client';

import React from 'react';
import { useStore } from 'zustand';
import type { NarrationStoreApi } from '@pdf-reader/core';

export interface StoryboardLogProps {
  narrationStore: NarrationStoreApi;
}

export function StoryboardLog({ narrationStore }: StoryboardLogProps) {
  const lastStoryboard = useStore(narrationStore, (s) => s.lastStoryboard);
  const llmStatus = useStore(narrationStore, (s) => s.llmStatus);
  const engineStatus = useStore(narrationStore, (s) => s.engineStatus);
  const lastError = useStore(narrationStore, (s) => s.lastError);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 8 }}>
        Storyboard log
      </h3>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <div>
          LLM:{' '}
          <span style={{ color: llmStatus === 'failed' ? '#ef4444' : '#10b981' }}>
            {llmStatus}
          </span>
        </div>
        <div>Engine: {engineStatus}</div>
        {lastError ? (
          <div style={{ color: '#ef4444' }}>Error: {lastError}</div>
        ) : null}
      </div>
      {lastStoryboard ? (
        <pre
          style={{
            fontSize: 11,
            background: '#0b0f1a',
            border: '1px solid #333',
            padding: 8,
            borderRadius: 4,
            overflow: 'auto',
            maxHeight: 340,
          }}
        >
          {JSON.stringify(lastStoryboard, null, 2)}
        </pre>
      ) : (
        <div style={{ opacity: 0.6, fontSize: 12 }}>
          No storyboard yet. Send a chunk.
        </div>
      )}
    </div>
  );
}
