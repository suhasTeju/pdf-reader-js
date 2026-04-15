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
      scale={0.4}
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
    };
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
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
      <div
        style={{
          width: 420,
          borderLeft: '1px solid #333',
          overflowY: 'auto',
          background: '#0b0f1a',
          color: 'white',
        }}
      >
        <LLMConfigPanel llm={llm} onChange={setLlm} />
        <ChunkComposer
          bbox={JOINTS_BBOX}
          currentPage={currentPage}
          onChunk={setCurrentChunk}
          onPageChange={setCurrentPage}
        />
        <StoryboardLog narrationStore={narrationStore} />
      </div>
    </div>
  );
}
