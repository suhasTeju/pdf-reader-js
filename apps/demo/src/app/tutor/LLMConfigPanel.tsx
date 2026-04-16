'use client';

import React, { useState } from 'react';
import type { LlmConfig } from 'pdfjs-reader-core';

export interface LLMConfigPanelProps {
  llm: LlmConfig;
  onChange: (llm: LlmConfig) => void;
}

const FIELD: React.CSSProperties = {
  width: '100%',
  marginBottom: 10,
  padding: '10px 12px',
  background: '#0b0f1a',
  color: 'white',
  border: '1px solid #444',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'system-ui, sans-serif',
  boxSizing: 'border-box',
  minHeight: 44,
};

export function LLMConfigPanel({ llm, onChange }: LLMConfigPanelProps) {
  const set = (patch: Partial<LlmConfig>) => onChange({ ...llm, ...patch });
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          minHeight: 44,
          touchAction: 'manipulation',
        }}
      >
        <h3 style={{ fontSize: 15, margin: 0 }}>LLM config</h3>
        <span style={{ fontSize: 18, opacity: 0.7 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </div>
      {collapsed ? null : (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Endpoint</label>
          <input
            value={llm.endpointUrl}
            onChange={(e) => set({ endpointUrl: e.target.value })}
            style={FIELD}
          />
          <label style={{ fontSize: 12, opacity: 0.7 }}>Model</label>
          <input
            value={llm.model}
            onChange={(e) => set({ model: e.target.value })}
            style={FIELD}
          />
          <label style={{ fontSize: 12, opacity: 0.7 }}>Auth token (optional)</label>
          <input
            value={llm.authToken ?? ''}
            onChange={(e) => set({ authToken: e.target.value || undefined })}
            type="password"
            style={FIELD}
          />
          <label style={{ fontSize: 12, opacity: 0.7 }}>Extra body (JSON)</label>
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
              ...FIELD,
              minHeight: 70,
              fontFamily: 'monospace',
              fontSize: 12,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <label
              style={{
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={llm.useJsonSchema ?? true}
                onChange={(e) => set({ useJsonSchema: e.target.checked })}
                style={{ width: 20, height: 20 }}
              />
              JSON schema mode
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
