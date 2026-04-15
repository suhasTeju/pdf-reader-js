'use client';

import React, { useRef, useState } from 'react';
import type { PageBBoxData } from '@pdf-reader/core';

const SCRIPTED_CHUNKS = [
  'A joint is a junction between two or more bones or cartilages.',
  'There are three structural classes of joints: fibrous, cartilaginous, and synovial.',
  'Fibrous joints include sutures, which are found only in the skull.',
  'See Fig 3.2 — the primary cartilaginous joint between epiphysis and diaphysis.',
  'Amphiarthroses are slightly movable joints, like the intervertebral discs.',
  'Diarthroses are freely movable synovial joints, the most evolved kind.',
  'Notice the sagittal suture on the skull — it dovetails two bones together.',
];

export interface ChunkComposerProps {
  bbox: PageBBoxData[];
  currentPage: number;
  onChunk: (text: string | null) => void;
  onPageChange: (page: number) => void;
}

export function ChunkComposer({
  bbox,
  currentPage,
  onChunk,
  onPageChange,
}: ChunkComposerProps) {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(8);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);

  function send() {
    if (!text.trim()) return;
    onChunk(text);
  }

  function sendScripted(chunk: string) {
    setText(chunk);
    onChunk(chunk);
  }

  function toggleAutoplay() {
    if (playing) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      autoplayRef.current = null;
      setPlaying(false);
      return;
    }
    let i = 0;
    autoplayRef.current = setInterval(
      () => {
        const next = SCRIPTED_CHUNKS[i % SCRIPTED_CHUNKS.length];
        onChunk(next);
        setText(next);
        i += 1;
      },
      Math.max(1000, (60 / rate) * 1000),
    );
    setPlaying(true);
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
        <h3 style={{ fontSize: 14, margin: 0 }}>Chunk composer</h3>
        <div>
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            ◀
          </button>
          <span style={{ margin: '0 8px' }}>
            page {currentPage}/{bbox.length}
          </span>
          <button
            onClick={() =>
              onPageChange(Math.min(bbox.length, currentPage + 1))
            }
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
          minHeight: 70,
          background: '#0b0f1a',
          color: 'white',
          border: '1px solid #444',
          padding: 8,
          borderRadius: 4,
          fontSize: 12,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={send}>Send</button>
        <button
          onClick={() => {
            setText('');
            onChunk(null);
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12 }}>
          Autoplay rate: {rate} chunks/min
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <button onClick={toggleAutoplay} style={{ marginTop: 4 }}>
          {playing ? 'Stop autoplay' : 'Start autoplay'}
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
          Scripted chunks:
        </div>
        {SCRIPTED_CHUNKS.map((c, i) => (
          <div
            key={i}
            onClick={() => sendScripted(c)}
            style={{
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 12,
              background: '#1a1e2e',
              borderRadius: 4,
              marginBottom: 4,
            }}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
