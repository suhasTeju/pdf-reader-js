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
import { GhostReferenceOverlay } from './GhostReferenceOverlay';
import { LabelOverlay } from './LabelOverlay';
import { CalloutLabelOverlay } from './CalloutLabelOverlay';
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
import { StoryboardSchema } from '../../director/storyboard-schema';
import type { Storyboard } from '../../types/storyboard';

/**
 * Input passed to a consumer-supplied `storyboardProvider`. Gives the
 * provider everything the built-in director already has access to, so
 * the consumer can decide how much context to forward to their own
 * endpoint (typically: just `chunk` + `pageNumber`, since bbox is
 * usually cached server-side).
 */
export interface StoryboardProviderInput {
  chunk: string;
  pageNumber: number;
  /** The current page's bbox data — included in case the provider wants
   *  to forward it, though usually the provider's backend already has
   *  this cached. */
  page: PageBBoxData;
  /** Last few chunks the tutor has spoken, for conversational context. */
  history: ReadonlyArray<{
    text: string;
    pageNumber: number;
    timestamp: number;
  }>;
  /** AbortSignal — if the consumer's fetch supports it, wire it up so
   *  a newer chunk cancels a stale in-flight request. */
  signal: AbortSignal;
}

export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  rotation?: number;
  /** Reactive chunk from the tutor (updates as she speaks) */
  currentChunk?: string | null;
  /** LLM endpoint configuration used by the built-in director. */
  llm?: LlmConfig;
  /**
   * Consumer-owned director. When provided, this is called per chunk
   * INSTEAD OF `directStoryboard(llm, …)`. Return a storyboard matching
   * `StoryboardSchema` (or `null` to skip the chunk). The library still
   * validates the return value, runs salvage (range clamp, overlay-
   * presence), and emits debug events, so DebugLog telemetry is
   * identical to the built-in path.
   *
   * Use this when your backend owns the system prompt + bbox context
   * (e.g. a fine-tuned director endpoint) and you want to iterate on
   * prompt/model choices without a library upgrade.
   *
   * Priority: if BOTH `storyboardProvider` and `llm` are set, the
   * provider wins and `llm` is ignored.
   *
   * Added in v0.5.0.
   */
  storyboardProvider?: (input: StoryboardProviderInput) => Promise<
    Storyboard | null
  >;
  /** Milliseconds of no new chunks before the camera returns to fit-page */
  idleTimeoutMs?: number;
  /** LLM call timeout in ms. Default 30000 (Qwen3-32B and similar can take 5-15s). */
  llmTimeoutMs?: number;
  /** Optional embedding provider for fallback matching when the LLM fails */
  embeddingProvider?: EmbeddingProvider;
  /** Show subtitle bar with the current chunk text (default: true) */
  showSubtitles?: boolean;
  /**
   * Show the "Reset view" button (default: true). Clicking it clears all
   * overlays and returns the camera to fit-page. If `onExitTutorMode` is
   * also provided, it runs after the reset — useful when the host app
   * wants the same button to also leave tutor mode entirely.
   */
  showExitButton?: boolean;
  /**
   * Optional callback fired AFTER the engine's resetVisuals. Provide this
   * only if the host wants the reset button to also leave tutor mode /
   * navigate away. Omit it for a pure "reset the visuals" behaviour.
   */
  onExitTutorMode?: () => void;
  /**
   * Minimum hold time (ms) for every overlay, regardless of the
   * `duration_ms` the LLM specifies. Short LLM-emitted durations (600-1200ms)
   * flash past too quickly to read; bump this for narration-paired UX.
   * Default: 3500ms.
   */
  minOverlayDurationMs?: number;
  /**
   * Background colour of the container surround (visible around the PDF when
   * the viewport is larger than the page fit). Default: `#ffffff`. Pass a
   * dark value for dark-themed hosts.
   */
  backgroundColor?: string;
  /**
   * Optional content to render while the PDF document/page is still loading.
   * Receives the loading stage so the host can show a spinner, a skeleton,
   * or a custom brand. If omitted, a minimal default spinner is rendered on
   * the `backgroundColor` surround.
   */
  loadingComponent?: React.ReactNode;
  /**
   * Fired when the underlying viewer's page changes from any source — the
   * agent API (`agentTools.goToPage / nextPage / previousPage`), the sidebar
   * (bookmarks, thumbnails, search), or a programmatic
   * `useViewerStore().goToPage` call. Use this to keep your own
   * `pageNumber` state (the controlled prop you pass in) in lockstep with
   * the viewer, so agent-driven navigation actually moves the rendered
   * page and downstream concerns (progress save, recap, etc.) see the
   * right value.
   *
   * ```tsx
   * const [currentPage, setCurrentPage] = useState(1);
   * <TutorModeContainer
   *   pageNumber={currentPage}
   *   onPageChange={setCurrentPage}   // ← bidirectional sync
   * />
   * ```
   *
   * Added in v0.4.2.
   */
  onPageChange?: (page: number) => void;
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
  backgroundColor = '#ffffff',
  loadingComponent,
  onPageChange,
  storyboardProvider,
  className,
}: TutorModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildBBoxIndex(bboxData), [bboxData]);

  const {
    document,
    currentPage: viewerCurrentPage,
    numPages,
    goToPage: viewerGoToPage,
  } = usePDFViewer();
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 1000 });

  // Subscribe to store state for re-renders
  const camera = useStore(narrationStore, (s) => s.camera);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);

  // Bidirectional sync between the controlled `pageNumber` prop and the
  // internal viewer store's currentPage. Without this, the agent API's
  // `goToPage` / `nextPage` / `previousPage` calls write to viewerStore
  // but never reach the consumer's controlled state — the rendered page
  // stays stuck while the agent thinks it moved.

  // prop → viewerStore: whenever the consumer updates pageNumber, mirror
  // it into the viewer store so agent-api reads the correct current page.
  useEffect(() => {
    if (numPages <= 0) return;                     // doc not yet loaded
    if (pageNumber < 1 || pageNumber > numPages) return;
    if (viewerCurrentPage === pageNumber) return;  // already in sync
    viewerGoToPage(pageNumber);
  }, [pageNumber, numPages, viewerCurrentPage, viewerGoToPage]);

  // viewerStore → prop: when something else (agent nav, thumbnail click,
  // programmatic store update) moves the viewer's page, bubble it up so
  // the consumer can update its own state and re-pass pageNumber.
  useEffect(() => {
    if (!onPageChange) return;
    if (viewerCurrentPage === pageNumber) return;
    if (viewerCurrentPage < 1) return;
    onPageChange(viewerCurrentPage);
  }, [viewerCurrentPage, pageNumber, onPageChange]);

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
    // destroy() cancels BOTH pending step timers AND overlay removal
    // timers. On iOS Safari `viewport` can change frequently (address-bar
    // scroll animation), forcing this effect's cleanup. The old
    // `cancelPending()` left overlay-removal timers alive, retaining
    // closures holding `bboxIndex` across each recreation.
    return () => engineRef.current?.destroy();
  }, [narrationStore, index, viewport, minOverlayDurationMs]);

  // React to currentChunk: debounce → call LLM → engine.execute
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChunkRef = useRef<string | null>(null);

  useEffect(() => {
    // Need either a consumer-supplied provider OR an LLM config —
    // otherwise there's no director to turn chunks into storyboards.
    if (!storyboardProvider && !llm) return;
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

      // Path A — consumer-owned director (priority).
      if (storyboardProvider) {
        narrationStore.getState().setLlmStatus('in-flight');
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-request',
          summary: `provider (page ${pageNumber}, ${page.blocks.length} blocks)`,
          payload: {
            via: 'storyboardProvider',
            pageNumber,
            blockCount: page.blocks.length,
          },
        });

        try {
          const raw = await storyboardProvider({
            chunk,
            pageNumber,
            page,
            history: narrationStore.getState().chunkHistory,
            signal: abortRef.current.signal,
          });

          if (!raw) {
            narrationStore.getState().setLlmStatus('idle');
            narrationStore.getState().appendDebugEvent({
              kind: 'note',
              summary: 'provider returned null — no storyboard for this chunk',
            });
            return;
          }

          // Validate with the same schema the built-in director uses, so
          // the consumer can't slip through a malformed storyboard that
          // would crash the engine.
          const parsed = StoryboardSchema.safeParse(raw);
          if (!parsed.success) {
            narrationStore.getState().setLlmStatus(
              'failed',
              parsed.error.message,
            );
            narrationStore.getState().appendDebugEvent({
              kind: 'llm-error',
              summary: `provider storyboard rejected by schema: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
              payload: { raw, error: parsed.error.message },
            });
            return;
          }

          const storyboard = parsed.data as Storyboard;
          narrationStore.getState().setLlmStatus('idle');
          narrationStore.getState().appendDebugEvent({
            kind: 'llm-response',
            summary: summariseStoryboard(storyboard),
            payload: { via: 'storyboardProvider', storyboard },
          });
          engineRef.current?.execute(storyboard);
          narrationStore.getState().appendDebugEvent({
            kind: 'storyboard-execute',
            summary: `engine executing ${storyboard.steps.length} steps`,
            payload: storyboard.steps.map((s) => ({
              at_ms: s.at_ms,
              type: s.action.type,
              target:
                'target_block' in s.action
                  ? s.action.target_block
                  : undefined,
            })),
          });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          narrationStore
            .getState()
            .setLlmStatus('failed', (e as Error).message);
          narrationStore.getState().appendDebugEvent({
            kind: 'llm-error',
            summary: `provider threw: ${(e as Error).message.slice(0, 80)}`,
            payload: e,
          });
        }
        return;
      }

      // Path B — built-in director using the LLM config (legacy path,
      // still fully supported).
      if (!llm) return;

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
          summary: summariseStoryboard(result.storyboard),
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
  }, [
    currentChunk,
    llm,
    storyboardProvider,
    index,
    pageNumber,
    narrationStore,
    embeddingProvider,
    llmTimeoutMs,
  ]);

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

  const isReady = !!page && !!pageProxy;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: backgroundColor,
      }}
      data-role="tutor-mode-container"
      data-page-loaded={isReady ? 'true' : 'false'}
    >
      {showExitButton && isReady ? (
        <button
          onClick={() => {
            engineRef.current?.resetVisuals();
            onExitTutorMode?.();
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
            // Dark translucent pill with white text reads cleanly on both
            // light and dark container backgrounds.
            background: 'rgba(17,24,39,0.72)',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            touchAction: 'manipulation',
          }}
          aria-label="Reset view — clear overlays and fit the page"
          data-role="exit-tutor"
        >
          Reset view
        </button>
      ) : null}
      {isReady ? (
        <>
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
          {/* Viewport-space UI (outside the camera scale transform). */}
          <LabelOverlay
            overlays={activeOverlays}
            index={index}
            currentPage={pageNumber}
            camera={camera}
            viewport={viewport}
          />
          <CalloutLabelOverlay
            overlays={activeOverlays}
            index={index}
            currentPage={pageNumber}
            camera={camera}
            viewport={viewport}
          />
          <GhostReferenceOverlay overlays={activeOverlays} index={index} />
        </>
      ) : (
        <TutorLoadingState custom={loadingComponent} />
      )}
      {showSubtitles ? <SubtitleBar text={currentChunk ?? null} /> : null}
    </div>
  );
}

/**
 * Default loading state shown while the PDF document / page proxy is still
 * being fetched. Intentionally minimal — hosts with branding should pass
 * `loadingComponent` instead.
 */
function TutorLoadingState({
  custom,
}: {
  custom?: React.ReactNode;
}): React.ReactElement {
  if (custom) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-role="tutor-loading"
      >
        {custom}
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'rgba(0,0,0,0.55)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
      data-role="tutor-loading"
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(0,0,0,0.1)',
          borderTopColor: 'rgba(0,0,0,0.45)',
          animation: 'pdf-tutor-spin 0.9s linear infinite',
        }}
      />
      <span>Loading document…</span>
      <style>{`
        @keyframes pdf-tutor-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact one-liner for the DebugLog "storyboard ✓" summary. Uses the
 * model's `reasoning` if the director emitted one; otherwise falls
 * back to the list of step types so the log entry still communicates
 * what the engine is about to execute. Since v0.5.1 reasoning is
 * optional to save output tokens.
 */
function summariseStoryboard(
  sb: Storyboard & { reasoning?: string },
): string {
  const stepCount = sb.steps.length;
  const trimmedReasoning = (sb.reasoning ?? '').trim();
  if (trimmedReasoning) {
    return `storyboard ✓ ${stepCount} steps — ${trimmedReasoning.slice(0, 60)}`;
  }
  const kinds = sb.steps.map((s) => s.action.type).join(' → ');
  return `storyboard ✓ ${stepCount} steps — ${kinds}`;
}
