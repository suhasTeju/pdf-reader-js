'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
  loadDocumentWithCallbacks,
  useViewerStore,
  type NarrationStoreApi,
  type LlmConfig,
} from '@pdf-reader/core';
import { JOINTS_BBOX } from './fixtures/joints-bbox';
import { ChunkComposer } from './ChunkComposer';
import { LLMConfigPanel } from './LLMConfigPanel';
import { StoryboardLog } from './StoryboardLog';
import { DebugLog } from './DebugLog';
import { PageBlocksPanel } from './PageBlocksPanel';
import { OverlayPresets } from './OverlayPresets';

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

function TutorContent({
  narrationStore,
  currentPage,
  setCurrentPage,
  currentChunk,
  llm,
}: {
  narrationStore: NarrationStoreApi;
  currentPage: number;
  setCurrentPage: (n: number) => void;
  currentChunk: string | null;
  llm: LlmConfig;
}) {
  const setDocument = useViewerStore((s) => s.setDocument);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_PDF_URL;
    if (!url) return;
    const { promise, cancel } = loadDocumentWithCallbacks({
      src: url,
      onDocumentReady: (doc) => setDocument(doc),
      onFirstPageReady: () => {},
    });
    promise.catch(() => {});
    return () => cancel();
  }, [setDocument]);

  return (
    <TutorModeContainer
      pageNumber={currentPage}
      bboxData={JOINTS_BBOX}
      narrationStore={narrationStore}
      scale={1}
      currentChunk={currentChunk}
      llm={llm}
      onExitTutorMode={() => setCurrentPage(1)}
    />
  );
}

export default function TutorPage() {
  const storeRef = useRef<NarrationStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createNarrationStore();
  const narrationStore = storeRef.current;

  const [currentChunk, setCurrentChunk] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [llm, setLlm] = useState<LlmConfig>(() => {
    let extraBody: Record<string, unknown> | undefined;
    try {
      const raw = process.env.NEXT_PUBLIC_LLM_EXTRA_BODY;
      extraBody = raw ? JSON.parse(raw) : undefined;
    } catch {
      extraBody = undefined;
    }
    return {
      endpointUrl: process.env.NEXT_PUBLIC_LLM_ENDPOINT ?? '',
      model: process.env.NEXT_PUBLIC_LLM_MODEL ?? '',
      authToken: process.env.NEXT_PUBLIC_LLM_TOKEN,
      extraBody,
      maxTokens: 1024,
      temperature: 0.3,
      useJsonSchema: true,
      stream: false,
    };
  });

  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(!isMobile);

  // Auto-collapse on mobile, auto-expand on desktop when viewport changes
  useEffect(() => {
    setPanelOpen(!isMobile);
  }, [isMobile]);

  const sidebarContent = (
    <>
      <OverlayPresets
        bbox={JOINTS_BBOX}
        currentPage={currentPage}
        narrationStore={narrationStore}
        onPageChange={setCurrentPage}
      />
      <ChunkComposer
        bbox={JOINTS_BBOX}
        currentPage={currentPage}
        narrationStore={narrationStore}
        onChunk={setCurrentChunk}
        onPageChange={setCurrentPage}
      />
      <PageBlocksPanel
        bbox={JOINTS_BBOX}
        currentPage={currentPage}
        narrationStore={narrationStore}
        onSendBlockChunk={setCurrentChunk}
      />
      <StoryboardLog narrationStore={narrationStore} />
      <DebugLog narrationStore={narrationStore} />
      <LLMConfigPanel llm={llm} onChange={setLlm} />
    </>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <style>{`
        :root { -webkit-text-size-adjust: 100%; }
        html, body { overscroll-behavior: none; touch-action: manipulation; }
        button { touch-action: manipulation; }
      `}</style>

      <div
        style={{
          padding: isMobile ? '6px 10px' : '8px 16px',
          background: '#1e293b',
          color: 'white',
          fontSize: isMobile ? 11 : 13,
          fontFamily: 'system-ui, sans-serif',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ flex: 1, lineHeight: 1.3 }}>
          {isMobile ? (
            <>Tap a scripted chunk to send it. LLM emits a storyboard, engine plays it on the PDF.</>
          ) : (
            <>
              <strong>How to use:</strong> Click a scripted chunk on the right
              (or type your own). The LLM Director receives that text + the
              current page&apos;s bbox blocks, then emits a storyboard the engine
              plays over the PDF.
            </>
          )}
        </span>
        {isMobile ? (
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
            style={{
              minWidth: 44,
              minHeight: 44,
              padding: '8px 12px',
              background: '#334155',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            {panelOpen ? '✕' : '☰'}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: isMobile ? 'column' : 'row',
          position: 'relative',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
          <PDFViewerProvider>
            <TutorContent
              narrationStore={narrationStore}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              currentChunk={currentChunk}
              llm={llm}
            />
          </PDFViewerProvider>
        </div>

        {isMobile ? (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: panelOpen ? '40%' : '100%',
              background: '#0b0f1a',
              color: 'white',
              borderTop: '1px solid #333',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              transition: 'top 250ms ease-out',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              zIndex: 100,
              boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
            }}
            data-role="mobile-sheet"
          >
            <div
              onClick={() => setPanelOpen(false)}
              style={{
                position: 'sticky',
                top: 0,
                background: '#0b0f1a',
                padding: '8px 0',
                textAlign: 'center',
                cursor: 'pointer',
                borderBottom: '1px solid #1f2937',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  background: '#475569',
                  borderRadius: 2,
                  margin: '0 auto',
                }}
              />
            </div>
            {sidebarContent}
          </div>
        ) : (
          <div
            style={{
              width: 420,
              borderLeft: '1px solid #333',
              overflowY: 'auto',
              background: '#0b0f1a',
              color: 'white',
              flexShrink: 0,
            }}
          >
            {sidebarContent}
          </div>
        )}
      </div>
    </div>
  );
}
