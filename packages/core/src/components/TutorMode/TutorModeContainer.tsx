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
import { SubtitleBar } from './SubtitleBar';
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
  /** LLM call timeout in ms. Default 30000 (Qwen3-32B and similar can take 5-15s). */
  llmTimeoutMs?: number;
  /** Optional embedding provider for fallback matching when the LLM fails */
  embeddingProvider?: EmbeddingProvider;
  /** Show subtitle bar with the current chunk text (default: true) */
  showSubtitles?: boolean;
  /** Show the "Exit tutor" button (default: true, only rendered if onExitTutorMode is provided) */
  showExitButton?: boolean;
  /** Called when the exit button is clicked; engine's resetVisuals runs first */
  onExitTutorMode?: () => void;
  /**
   * Minimum hold time (ms) for every overlay, regardless of the
   * `duration_ms` the LLM specifies. Short LLM-emitted durations (600-1200ms)
   * flash past too quickly to read; bump this for narration-paired UX.
   * Default: 3500ms.
   */
  minOverlayDurationMs?: number;
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
  llmTimeoutMs = 30000,
  embeddingProvider,
  showSubtitles = false,
  showExitButton = true,
  onExitTutorMode,
  minOverlayDurationMs,
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

  // Keep narrationStore.currentPage in sync with the rendered page so the
  // engine's resetVisuals can read the right page for fit-scale math.
  useEffect(() => {
    narrationStore.getState().setCurrentPage(pageNumber);
  }, [pageNumber, narrationStore]);

  // Initial fit-to-viewport: PDF is rendered at native scale=1; the camera
  // applies the scale that fits it. We pick the smaller of width-fit and
  // height-fit, with a tiny padding factor for breathing room.
  useEffect(() => {
    const page = index.byPage.get(pageNumber);
    if (!page) return;
    if (viewport.width === 0 || viewport.height === 0) return;
    if (narrationStore.getState().activeOverlays.length > 0) return;
    const fit =
      Math.min(
        viewport.width / page.page_dimensions.width,
        viewport.height / page.page_dimensions.height,
      ) * 0.95;
    narrationStore.getState().setCamera({ scale: fit, x: 0, y: 0 });
  }, [pageNumber, viewport, index, narrationStore]);

  // Engine instance tied to bbox index + viewport
  const engineRef = useRef<StoryboardEngine | null>(null);
  useEffect(() => {
    engineRef.current = new StoryboardEngine({
      narrationStore,
      bboxIndex: index,
      getViewport: () => viewport,
      minOverlayDurationMs,
    });
    return () => engineRef.current?.cancelPending();
  }, [narrationStore, index, viewport, minOverlayDurationMs]);

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
      narrationStore.getState().appendDebugEvent({
        kind: 'chunk',
        summary: `chunk → ${chunk.slice(0, 80)}${chunk.length > 80 ? '…' : ''}`,
        payload: { chunk, pageNumber },
      });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      narrationStore.getState().setLlmStatus('in-flight');
      narrationStore.getState().appendDebugEvent({
        kind: 'llm-request',
        summary: `LLM ${llm.model} (page ${pageNumber}, ${page.blocks.length} blocks)`,
        payload: { model: llm.model, pageNumber, blockCount: page.blocks.length },
      });

      const result = await directStoryboard(llm, {
        chunk,
        pageNumber,
        page,
        index,
        history: narrationStore.getState().chunkHistory,
        camera: narrationStore.getState().camera,
        activeOverlays: narrationStore.getState().activeOverlays,
        signal: abortRef.current.signal,
        timeoutMs: llmTimeoutMs,
      });

      if (result.storyboard) {
        narrationStore.getState().setLlmStatus('idle');
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-response',
          summary: `storyboard ✓ ${result.storyboard.steps.length} steps — ${result.storyboard.reasoning.slice(0, 60)}`,
          payload: { raw: result.raw, storyboard: result.storyboard },
        });
        engineRef.current?.execute(result.storyboard);
        narrationStore.getState().appendDebugEvent({
          kind: 'storyboard-execute',
          summary: `engine executing ${result.storyboard.steps.length} steps`,
          payload: result.storyboard.steps.map((s) => ({
            at_ms: s.at_ms,
            type: s.action.type,
            target:
              'target_block' in s.action
                ? s.action.target_block
                : 'target' in s.action
                  ? (s.action as { target?: string }).target
                  : undefined,
          })),
        });
      } else {
        narrationStore
          .getState()
          .setLlmStatus('failed', result.error ?? 'unknown');
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-error',
          summary: `LLM failed: ${(result.error ?? 'unknown').slice(0, 80)}`,
          payload: { error: result.error, raw: result.raw },
        });
        if (embeddingProvider) {
          try {
            const match = await matchChunkToBlock(chunk, page, embeddingProvider);
            const fallbackSb = storyboardFromMatch(match, page);
            narrationStore.getState().appendDebugEvent({
              kind: 'fallback-fired',
              summary: `embedding fallback → ${match?.block.block_id ?? 'no match'}`,
              payload: { match, storyboard: fallbackSb },
            });
            engineRef.current?.execute(fallbackSb);
          } catch (e) {
            narrationStore.getState().appendDebugEvent({
              kind: 'llm-error',
              summary: `fallback also failed: ${(e as Error).message}`,
              payload: e,
            });
          }
        }
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentChunk, llm, index, pageNumber, narrationStore, embeddingProvider, llmTimeoutMs]);

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
  // The bbox `page_dimensions` are at the source DPI (e.g., 200), while
  // pdfjs-dist's `getViewport({scale:1})` returns the page in PDF POINTS
  // (72 DPI). To align the rendered canvas with the bbox coordinate space,
  // we render at `dpi/72`. The `scale` prop is a quality multiplier on top.
  const dpiScale = page ? page.page_dimensions.dpi / 72 : 1;
  const rasterScale = dpiScale * (scale || 1);
  const baseW = page ? page.page_dimensions.width * (scale || 1) : 0;
  const baseH = page ? page.page_dimensions.height * (scale || 1) : 0;

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
      data-page-loaded={page ? 'true' : 'false'}
    >
      {showExitButton && onExitTutorMode ? (
        <button
          onClick={() => {
            engineRef.current?.resetVisuals();
            onExitTutorMode();
          }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 60,
            minHeight: 40,
            minWidth: 40,
            padding: '8px 14px',
            border: 'none',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            touchAction: 'manipulation',
          }}
          data-role="exit-tutor"
        >
          Exit
        </button>
      ) : null}
      {page ? (
        <CameraView camera={camera}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: baseW,
              height: baseH,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <PDFPage
              pageNumber={pageNumber}
              page={pageProxy}
              scale={rasterScale}
              rotation={rotation}
              showTextLayer={false}
              showHighlightLayer={false}
              showAnnotationLayer={false}
            />
            <CinemaLayer
              page={page}
              index={index}
              overlays={activeOverlays}
              scale={scale || 1}
            />
          </div>
        </CameraView>
      ) : null}
      {showSubtitles ? <SubtitleBar text={currentChunk ?? null} /> : null}
    </div>
  );
}
