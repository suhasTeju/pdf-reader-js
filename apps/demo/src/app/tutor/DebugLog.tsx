'use client';

import React, { useState } from 'react';
import { useStore } from 'zustand';
import type { NarrationStoreApi, DebugEvent } from '@pdf-reader/core';

export interface DebugLogProps {
  narrationStore: NarrationStoreApi;
}

const KIND_COLORS: Record<DebugEvent['kind'], string> = {
  chunk: '#60a5fa',
  'llm-request': '#fbbf24',
  'llm-response': '#10b981',
  'llm-error': '#ef4444',
  'storyboard-execute': '#a78bfa',
  'fallback-fired': '#f59e0b',
  note: '#94a3b8',
};

/** Color per storyboard action type — mirrors CinemaLayer visual identity. */
const ACTION_COLORS: Record<string, string> = {
  camera: '#60A5FA',
  spotlight: '#FBBF24',
  underline: '#F59E0B',
  highlight: '#FACC15',
  pulse: '#F472B6',
  callout: '#34D399',
  ghost_reference: '#A78BFA',
  box: '#93C5FD',
  label: '#C4B5FD',
  clear: '#6B7280',
};

/** Tally action types across every `storyboard-execute` event in the session.
 *  Each payload is `{ at_ms, type, target }[]` — a straight flat reduce. */
function tallyActionKinds(events: DebugEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of events) {
    if (ev.kind !== 'storyboard-execute') continue;
    const steps = ev.payload as Array<{ type?: string }> | undefined;
    if (!Array.isArray(steps)) continue;
    for (const s of steps) {
      if (!s || typeof s.type !== 'string') continue;
      counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    }
  }
  return counts;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function serializeEvents(events: DebugEvent[]): string {
  return events
    .map((ev) => {
      const ts = fmtTime(ev.timestamp);
      const head = `[${ts}] [${ev.kind.toUpperCase()}] ${ev.summary}`;
      if (ev.payload === undefined) return head;
      const body =
        typeof ev.payload === 'string'
          ? ev.payload
          : JSON.stringify(ev.payload, null, 2);
      return `${head}\n${body}`;
    })
    .join('\n\n---\n\n');
}

export function DebugLog({ narrationStore }: DebugLogProps) {
  const events = useStore(narrationStore, (s) => s.debugEvents);
  const clear = useStore(narrationStore, (s) => s.clearDebugEvents);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  const kindTally = tallyActionKinds(events);
  const kindTallyEntries = Array.from(kindTally.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const totalSteps = kindTallyEntries.reduce((sum, [, n]) => sum + n, 0);

  async function copyAll() {
    const text = serializeEvents(events);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (http://) where clipboard API isn't available
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 1500);
  }

  return (
    <div style={{ padding: 16, borderTop: '1px solid #333' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 14, margin: 0 }}>
          Debug log <span style={{ opacity: 0.6 }}>({events.length})</span>
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={copyAll}
            disabled={events.length === 0}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              background:
                copyState === 'copied'
                  ? '#10b981'
                  : copyState === 'failed'
                    ? '#ef4444'
                    : '#1a1e2e',
              color: 'white',
              border: '1px solid #444',
              borderRadius: 4,
              cursor: events.length === 0 ? 'not-allowed' : 'pointer',
              opacity: events.length === 0 ? 0.5 : 1,
              minWidth: 56,
            }}
            title="Copy entire debug log to clipboard"
          >
            {copyState === 'copied'
              ? '✓ Copied'
              : copyState === 'failed'
                ? '✗ Failed'
                : '📋 Copy'}
          </button>
          <button
            onClick={clear}
            style={{
              fontSize: 11,
              padding: '2px 8px',
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
      </div>
      <div
        style={{
          marginBottom: 8,
          padding: '6px 8px',
          background: '#0b0f1a',
          border: '1px solid #1f2937',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
          lineHeight: 1.8,
        }}
        title="Distribution of storyboard action types across this session. Goal: ≥6 of 9 kinds represented."
      >
        <span style={{ opacity: 0.55, marginRight: 8 }}>
          Effect variety ({totalSteps} steps):
        </span>
        {kindTallyEntries.length === 0 ? (
          <span style={{ opacity: 0.4 }}>—</span>
        ) : (
          kindTallyEntries.map(([kind, n]) => (
            <span
              key={kind}
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                marginRight: 6,
                marginBottom: 2,
                background: '#1a1e2e',
                borderRadius: 3,
                borderLeft: `2px solid ${ACTION_COLORS[kind] ?? '#6B7280'}`,
                color: 'white',
              }}
            >
              <span style={{ color: ACTION_COLORS[kind] ?? '#9CA3AF' }}>
                {kind}
              </span>
              <span style={{ opacity: 0.65, marginLeft: 4 }}>·{n}</span>
            </span>
          ))
        )}
      </div>
      <div
        style={{
          maxHeight: 400,
          overflowY: 'auto',
          background: '#0b0f1a',
          border: '1px solid #333',
          borderRadius: 4,
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.6, fontSize: 12 }}>
            No events yet. Send a chunk to start capturing.
          </div>
        ) : (
          events
            .slice()
            .reverse()
            .map((ev) => {
              const isExpanded = expandedId === ev.id;
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid #1f2937',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                    }}
                  >
                    <span style={{ opacity: 0.5, fontSize: 10 }}>
                      {fmtTime(ev.timestamp)}
                    </span>
                    <span
                      style={{
                        color: KIND_COLORS[ev.kind],
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: 10,
                      }}
                    >
                      {ev.kind}
                    </span>
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>
                      {ev.summary}
                    </span>
                    <span style={{ opacity: 0.5 }}>{isExpanded ? '▾' : '▸'}</span>
                  </div>
                  {isExpanded && ev.payload !== undefined ? (
                    <pre
                      style={{
                        marginTop: 6,
                        marginBottom: 0,
                        padding: 8,
                        background: '#020617',
                        borderRadius: 4,
                        fontSize: 10,
                        overflow: 'auto',
                        maxHeight: 240,
                      }}
                    >
                      {typeof ev.payload === 'string'
                        ? ev.payload
                        : JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
