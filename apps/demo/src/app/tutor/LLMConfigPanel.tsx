'use client';

import React from 'react';
import type { LlmConfig } from '@pdf-reader/core';

export interface LLMConfigPanelProps {
  llm: LlmConfig;
  onChange: (llm: LlmConfig) => void;
}

export function LLMConfigPanel({ llm, onChange }: LLMConfigPanelProps) {
  const set = (patch: Partial<LlmConfig>) => onChange({ ...llm, ...patch });
  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 8 }}>LLM config</h3>
      <label style={{ fontSize: 11, opacity: 0.7 }}>Endpoint</label>
      <input
        value={llm.endpointUrl}
        onChange={(e) => set({ endpointUrl: e.target.value })}
        style={{
          width: '100%',
          marginBottom: 8,
          padding: 4,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          fontSize: 12,
        }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Model</label>
      <input
        value={llm.model}
        onChange={(e) => set({ model: e.target.value })}
        style={{
          width: '100%',
          marginBottom: 8,
          padding: 4,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          fontSize: 12,
        }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Auth token (optional)</label>
      <input
        value={llm.authToken ?? ''}
        onChange={(e) => set({ authToken: e.target.value || undefined })}
        type="password"
        style={{
          width: '100%',
          marginBottom: 8,
          padding: 4,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          fontSize: 12,
        }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Extra body (JSON)</label>
      <textarea
        value={llm.extraBody ? JSON.stringify(llm.extraBody, null, 2) : ''}
        onChange={(e) => {
          try {
            set({
              extraBody: e.target.value ? JSON.parse(e.target.value) : undefined,
            });
          } catch {
            // ignore invalid JSON while typing
          }
        }}
        style={{
          width: '100%',
          minHeight: 60,
          padding: 4,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={llm.useJsonSchema ?? true}
            onChange={(e) => set({ useJsonSchema: e.target.checked })}
          />
          &nbsp;JSON schema mode
        </label>
      </div>
    </div>
  );
}
