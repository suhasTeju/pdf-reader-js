'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { PDFPageProxy } from 'pdfjs-dist';
import { PDFPage } from '../PDFPage';
import type { PageBBoxData, BBoxIndex } from '../../types/bbox';
import type { NarrationStoreApi } from '../../store/narration-store';
import { usePDFViewer } from '../../hooks';
import { CameraView } from './CameraView';
import { CinemaLayer } from './CinemaLayer';
import { StoryboardEngine } from '../../director/storyboard-engine';
import {
  directStoryboard,
  type LlmConfig,
} from '../../director/llm-director';
import {
  matchChunkToBlock,
  storyboardFromMatch,
  type EmbeddingProvider,
} from '../../director/embedding-fallback';

export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  rotation?: number;
  /** Reactive chunk from the tutor (updates as she speaks) */
  currentChunk?: string | null;
  /** LLM endpoint configuration provided by the consumer */
  llm?: LlmConfig;
  /** Milliseconds of no new chunks before the camera returns to fit-page */
  idleTimeoutMs?: number;
  /** Optional embedding provider for fallback matching when the LLM fails */
  embeddingProvider?: EmbeddingProvider;
  className?: string;
}

/** Build a cross-page/block index from the raw bbox list. */
export function buildBBoxIndex(bboxData: PageBBoxData[]): BBoxIndex {
  const byPage = new Map<number, PageBBoxData>();
  const blockById = new Map<
    string,
    { block: PageBBoxData['blocks'][number]; pageNumber: number }
  >();
  const crossPageFigures: BBoxIndex['crossPageFigures'] = [];

  for (const page of bboxData) {
    byPage.set(page.page_number, page);
    for (const block of page.blocks) {
      blockById.set(block.block_id, { block, pageNumber: page.page_number });
      if (
        (block.type === 'figure' ||
          block.type === 'figure_region' ||
          block.type === 'caption') &&
        typeof block.text === 'string' &&
        block.text.length > 0
      ) {
        crossPageFigures.push({
          block_id: block.block_id,
          page: page.page_number,
          type: block.type,
          text: block.text,
        });
      }
    }
  }
  return { byPage, blockById, crossPageFigures };
}

export function TutorModeContainer({
  pageNumber,
  bboxData,
  narrationStore,
  scale,
  rotation = 0,
  currentChunk,
  llm,
  idleTimeoutMs = 5000,
  embeddingProvider,
  className,
}: TutorModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildBBoxIndex(bboxData), [bboxData]);

  const { document } = usePDFViewer();
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 1000 });

  // Subscribe to store state for re-renders
  const camera = useStore(narrationStore, (s) => s.camera);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);

  // Track viewport size for camera math
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () =>
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the current PDF page proxy
  useEffect(() => {
    if (!document) {
      setPageProxy(null);
      return;
    }
    let cancelled = false;
    document
      .getPage(pageNumber)
      .then((p) => {
        if (!cancelled) setPageProxy(p);
      })
      .catch(() => {
        if (!cancelled) setPageProxy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

  // Engine instance tied to bbox index + viewport
  const engineRef = useRef<StoryboardEngine | null>(null);
  useEffect(() => {
    engineRef.current = new StoryboardEngine({
      narrationStore,
      bboxIndex: index,
      getViewport: () => viewport,
    });
    return () => engineRef.current?.cancelPending();
  }, [narrationStore, index, viewport]);

  // React to currentChunk: debounce → call LLM → engine.execute
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChunkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!llm) return;
    if (!currentChunk || currentChunk === lastChunkRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const chunk = currentChunk;
      if (chunk === lastChunkRef.current) return;
      lastChunkRef.current = chunk;

      const page = index.byPage.get(pageNumber);
      if (!page) return;

      narrationStore.getState().pushChunkHistory({
        text: chunk,
        pageNumber,
        timestamp: Date.now(),
      });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      narrationStore.getState().setLlmStatus('in-flight');
      const result = await directStoryboard(llm, {
        chunk,
        pageNumber,
        page,
        index,
        history: narrationStore.getState().chunkHistory,
        camera: narrationStore.getState().camera,
        activeOverlays: narrationStore.getState().activeOverlays,
        signal: abortRef.current.signal,
      });

      if (result.storyboard) {
        narrationStore.getState().setLlmStatus('idle');
        engineRef.current?.execute(result.storyboard);
      } else {
        narrationStore
          .getState()
          .setLlmStatus('failed', result.error ?? 'unknown');
        if (embeddingProvider) {
          try {
            const match = await matchChunkToBlock(chunk, page, embeddingProvider);
            const fallbackSb = storyboardFromMatch(match);
            engineRef.current?.execute(fallbackSb);
          } catch {
            // fallback itself failed — nothing more to do
          }
        }
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentChunk, llm, index, pageNumber, narrationStore, embeddingProvider]);

  // Idle recovery
  useEffect(() => {
    if (!currentChunk) return;
    const t = setTimeout(() => {
      if (!engineRef.current) return;
      const hist = narrationStore.getState().chunkHistory;
      const latest = hist.length > 0 ? hist[hist.length - 1] : null;
      if (!latest) return;
      if (Date.now() - latest.timestamp < idleTimeoutMs) return;
      engineRef.current.resetVisuals();
    }, idleTimeoutMs + 100);
    return () => clearTimeout(t);
  }, [currentChunk, idleTimeoutMs, narrationStore]);

  const page = index.byPage.get(pageNumber);
  if (!page) {
    return (
      <div
        className={className}
        ref={containerRef}
        data-tutor-mode-missing-page={pageNumber}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#111',
      }}
      data-role="tutor-mode-container"
    >
      <CameraView camera={camera}>
        <div
          style={{
            position: 'relative',
            width: page.page_dimensions.width * scale,
            height: page.page_dimensions.height * scale,
            margin: '0 auto',
          }}
        >
          <PDFPage
            pageNumber={pageNumber}
            page={pageProxy}
            scale={scale}
            rotation={rotation}
            showTextLayer={false}
            showHighlightLayer={false}
            showAnnotationLayer={false}
          />
          <CinemaLayer
            page={page}
            index={index}
            overlays={activeOverlays}
            scale={scale}
          />
        </div>
      </CameraView>
    </div>
  );
}
