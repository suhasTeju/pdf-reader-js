'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { PageBBoxData, NarrationStoreApi } from '@pdf-reader/core';

interface ScriptedChunk {
  page: number;
  /** The expected block_id the LLM should anchor to. Shown next to the chunk
   *  button so you can visually verify the storyboard lands on this block. */
  expectedBlockId: string;
  text: string;
  /** Original block type — used for badge coloring so the inventory is scannable. */
  type: string;
}

/**
 * Block types worth surfacing as scripted chunks. Pure anchor/layout types
 * (figure_region, table) and empty-text blocks are skipped — they don't make
 * meaningful tutor chunks.
 */
const CHUNK_TYPES = new Set(['heading', 'paragraph', 'list_item', 'caption', 'figure']);

function deriveScriptedChunks(bbox: PageBBoxData[]): ScriptedChunk[] {
  const chunks: ScriptedChunk[] = [];
  for (const page of bbox) {
    const sorted = [...page.blocks].sort(
      (a, b) => a.reading_order - b.reading_order,
    );
    for (const b of sorted) {
      if (!b.text || !b.text.trim()) continue;
      if (!CHUNK_TYPES.has(b.type)) continue;
      chunks.push({
        page: page.page_number,
        expectedBlockId: b.block_id,
        text: b.text,
        type: b.type,
      });
    }
  }
  return chunks;
}

const TYPE_COLOR: Record<string, string> = {
  heading: '#F472B6',
  paragraph: '#FBBF24',
  list_item: '#34D399',
  caption: '#A78BFA',
  figure: '#60A5FA',
};

const TOUCH_BTN: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '10px 14px',
  background: '#334155',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  touchAction: 'manipulation',
};

export interface ChunkComposerProps {
  bbox: PageBBoxData[];
  currentPage: number;
  narrationStore: NarrationStoreApi;
  onChunk: (text: string | null) => void;
  onPageChange: (page: number) => void;
}

interface Timing {
  sendAt: number | null;
  llmMs: number | null;
  ttfaMs: number | null;
  status: 'idle' | 'running' | 'done' | 'failed';
  error?: string;
}

const INITIAL_TIMING: Timing = {
  sendAt: null,
  llmMs: null,
  ttfaMs: null,
  status: 'idle',
};

export function ChunkComposer({
  bbox,
  currentPage,
  narrationStore,
  onChunk,
  onPageChange,
}: ChunkComposerProps) {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(8);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timing, setTiming] = useState<Timing>(INITIAL_TIMING);

  // Reactive store subscriptions used to compute timing.
  const llmStatus = useStore(narrationStore, (s) => s.llmStatus);
  const lastError = useStore(narrationStore, (s) => s.lastError);
  const activeOverlaysCount = useStore(
    narrationStore,
    (s) => s.activeOverlays.length,
  );

  // LLM latency: transitions from 'in-flight' → 'idle' or 'failed' after send
  useEffect(() => {
    if (timing.status !== 'running' || timing.sendAt === null) return;
    if (llmStatus === 'idle' || llmStatus === 'failed') {
      setTiming((t) => {
        if (t.status !== 'running' || t.sendAt === null || t.llmMs !== null) {
          return t;
        }
        return {
          ...t,
          llmMs: Math.round(performance.now() - t.sendAt),
          status: llmStatus === 'failed' ? 'failed' : t.status,
          error:
            llmStatus === 'failed'
              ? (lastError ?? 'LLM failed')
              : t.error,
        };
      });
    }
  }, [llmStatus, lastError, timing.status, timing.sendAt]);

  // Time-to-first-annotation: first growth in activeOverlays after send.
  const prevOverlayCountRef = useRef(0);
  useEffect(() => {
    const prev = prevOverlayCountRef.current;
    prevOverlayCountRef.current = activeOverlaysCount;
    if (activeOverlaysCount <= prev) return;
    setTiming((t) => {
      if (
        t.status !== 'running' ||
        t.sendAt === null ||
        t.ttfaMs !== null
      ) {
        return t;
      }
      return {
        ...t,
        ttfaMs: Math.round(performance.now() - t.sendAt),
      };
    });
  }, [activeOverlaysCount]);

  // Once both measurements are in (or LLM failed but TTFA arrived via
  // fallback/safety-net), flip to 'done'.
  useEffect(() => {
    setTiming((t) => {
      if (t.status !== 'running') return t;
      if (t.llmMs !== null && t.ttfaMs !== null) {
        return { ...t, status: 'done' };
      }
      return t;
    });
  }, [timing.llmMs, timing.ttfaMs]);

  const scriptedChunks = useMemo(() => deriveScriptedChunks(bbox), [bbox]);
  const pageScriptedChunks = useMemo(
    () => scriptedChunks.filter((c) => c.page === currentPage),
    [scriptedChunks, currentPage],
  );

  function beginTiming() {
    prevOverlayCountRef.current = narrationStore.getState().activeOverlays.length;
    setTiming({
      sendAt: performance.now(),
      llmMs: null,
      ttfaMs: null,
      status: 'running',
    });
  }

  function send() {
    if (!text.trim()) return;
    beginTiming();
    onChunk(text);
  }

  function sendScripted(chunk: ScriptedChunk) {
    if (chunk.page !== currentPage) onPageChange(chunk.page);
    setText(chunk.text);
    beginTiming();
    onChunk(chunk.text);
  }

  function toggleAutoplay() {
    if (playing) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      autoplayRef.current = null;
      setPlaying(false);
      return;
    }
    if (scriptedChunks.length === 0) return;
    let i = 0;
    autoplayRef.current = setInterval(
      () => {
        const next = scriptedChunks[i % scriptedChunks.length];
        if (next.page !== currentPage) onPageChange(next.page);
        beginTiming();
        onChunk(next.text);
        setText(next.text);
        i += 1;
      },
      Math.max(1000, (60 / rate) * 1000),
    );
    setPlaying(true);
  }

  const isSending = timing.status === 'running';

  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h3 style={{ fontSize: 15, margin: 0 }}>Chunk composer</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            style={TOUCH_BTN}
            aria-label="Previous page"
          >
            ◀
          </button>
          <span style={{ fontSize: 13, minWidth: 70, textAlign: 'center' }}>
            page {currentPage}/{bbox.length}
          </span>
          <button
            onClick={() =>
              onPageChange(Math.min(bbox.length, currentPage + 1))
            }
            style={TOUCH_BTN}
            aria-label="Next page"
          >
            ▶
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a chunk to send"
        style={{
          width: '100%',
          minHeight: 80,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          padding: 10,
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'system-ui, sans-serif',
          boxSizing: 'border-box',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={send}
          disabled={isSending || !text.trim()}
          style={{
            ...TOUCH_BTN,
            flex: 1,
            background: isSending
              ? '#1e3a8a'
              : !text.trim()
                ? '#1f2937'
                : '#3b82f6',
            cursor: isSending || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: !text.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isSending ? (
            <>
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: 'white',
                  animation: 'chunk-spin 0.8s linear infinite',
                }}
              />
              Sending…
            </>
          ) : (
            'Send'
          )}
        </button>
        <button
          onClick={() => {
            setText('');
            onChunk(null);
            setTiming(INITIAL_TIMING);
          }}
          style={TOUCH_BTN}
        >
          Clear
        </button>
      </div>
      <TimingStrip timing={timing} />
      <style>{`
        @keyframes chunk-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 13 }}>
          Autoplay rate: {rate} chunks/min
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          style={{ width: '100%', height: 28, marginTop: 4 }}
        />
        <button
          onClick={toggleAutoplay}
          style={{ ...TOUCH_BTN, marginTop: 6, width: '100%' }}
        >
          {playing ? 'Stop autoplay' : 'Start autoplay'}
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Scripted chunks for page {currentPage} (derived from bbox blocks):
          </div>
          <div style={{ fontSize: 11, opacity: 0.55 }}>
            {pageScriptedChunks.length} / {scriptedChunks.length} total
          </div>
        </div>
        {pageScriptedChunks.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.5, padding: '8px 0' }}>
            No text-bearing blocks on this page.
          </div>
        ) : (
          pageScriptedChunks.map((c) => (
            <button
              key={c.expectedBlockId}
              onClick={() => sendScripted(c)}
              style={{
                cursor: 'pointer',
                padding: '12px 12px',
                fontSize: 13,
                lineHeight: 1.4,
                background: '#1a1e2e',
                color: 'white',
                border: '1px solid #2d3548',
                borderRadius: 6,
                marginBottom: 6,
                width: '100%',
                textAlign: 'left',
                touchAction: 'manipulation',
                minHeight: 44,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'baseline',
                  marginBottom: 4,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#93C5FD' }}>p{c.page}</span>
                <span style={{ color: TYPE_COLOR[c.type] ?? '#FBBF24' }}>
                  {c.type}
                </span>
                <span style={{ color: '#FBBF24' }}>→ {c.expectedBlockId}</span>
              </div>
              {c.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

function TimingStrip({ timing }: { timing: Timing }) {
  // Running clock: show elapsed time while in flight so the user sees the
  // counter move, not a frozen "—".
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (timing.status !== 'running') {
      setNowMs(null);
      return;
    }
    const start = timing.sendAt ?? performance.now();
    const id = setInterval(() => {
      setNowMs(Math.round(performance.now() - start));
    }, 50);
    return () => clearInterval(id);
  }, [timing.status, timing.sendAt]);

  if (timing.status === 'idle') {
    return (
      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 8 }}>
        Send a chunk to measure LLM + first-annotation latency.
      </div>
    );
  }

  const running = timing.status === 'running';
  const failed = timing.status === 'failed';
  const elapsed = running ? nowMs : timing.ttfaMs ?? timing.llmMs;

  const dotColor = running ? '#FBBF24' : failed ? '#EF4444' : '#10B981';
  const label = running
    ? 'Running'
    : failed
      ? 'LLM failed'
      : 'Done';

  return (
    <div
      style={{
        marginTop: 10,
        padding: '8px 10px',
        background: '#0b0f1a',
        border: '1px solid #1f2937',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        lineHeight: 1.6,
      }}
      title="Latency from clicking Send to storyboard + first overlay painting on the PDF."
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: running ? `0 0 8px ${dotColor}` : undefined,
          }}
        />
        <span style={{ color: dotColor, fontWeight: 600 }}>{label}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.55 }}>
          elapsed {fmtMs(elapsed ?? null)}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr',
          gap: 4,
          opacity: 0.85,
        }}
      >
        <span style={{ opacity: 0.6 }}>LLM latency</span>
        <span style={{ color: '#FBBF24' }}>{fmtMs(timing.llmMs)}</span>
        <span style={{ opacity: 0.6 }}>First overlay</span>
        <span style={{ color: '#34D399' }}>{fmtMs(timing.ttfaMs)}</span>
        {timing.llmMs !== null && timing.ttfaMs !== null ? (
          <>
            <span style={{ opacity: 0.6 }}>Render gap</span>
            <span style={{ color: '#60A5FA' }}>
              {fmtMs(timing.ttfaMs - timing.llmMs)}
            </span>
          </>
        ) : null}
      </div>
      {timing.error ? (
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid #1f2937',
            color: '#FCA5A5',
            fontSize: 10,
            wordBreak: 'break-word',
          }}
        >
          {timing.error.slice(0, 160)}
        </div>
      ) : null}
    </div>
  );
}
