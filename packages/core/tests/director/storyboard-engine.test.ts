import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoryboardEngine } from '../../src/director/storyboard-engine';
import { createNarrationStore } from '../../src/store/narration-store';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';
import type { Storyboard } from '../../src/types/storyboard';

function makeIndex(): BBoxIndex {
  const page: PageBBoxData = {
    id: 'p1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1000, height: 1400, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0',
        bbox: [100, 100, 500, 200],
        text: 'Heading',
        type: 'heading',
        parent_id: null,
        confidence: 1,
        reading_order: 0,
        default_action: 'zoom_pan',
        semantic_unit_id: 'su_1',
      },
      {
        block_id: 'p1_t1',
        bbox: [100, 300, 900, 600],
        text: 'Paragraph',
        type: 'paragraph',
        parent_id: null,
        confidence: 1,
        reading_order: 1,
        default_action: 'spotlight',
        semantic_unit_id: 'su_2',
      },
    ],
    created_at: '',
  };
  const byPage = new Map([[1, page]]);
  const blockById = new Map(
    page.blocks.map(
      (b) => [b.block_id, { block: b, pageNumber: 1 }] as const,
    ),
  );
  return { byPage, blockById, crossPageFigures: [] };
}

function storyboard(): Storyboard {
  return {
    version: 1,
    reasoning: 't',
    steps: [
      {
        at_ms: 0,
        duration_ms: 500,
        action: {
          type: 'camera',
          target_block: 'p1_t0',
          scale: 1.5,
          padding: 60,
          easing: 'ease-out',
        },
      },
      {
        at_ms: 200,
        duration_ms: 1000,
        action: {
          type: 'spotlight',
          target_block: 'p1_t1',
          dim_opacity: 0.65,
          feather_px: 40,
          shape: 'rounded',
        },
      },
    ],
  };
}

describe('StoryboardEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies camera at at_ms=0 and spotlight at at_ms=200', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(0);
    const cam = store.getState().camera;
    expect(cam.scale).toBeGreaterThan(0);
    expect(store.getState().activeOverlays).toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(store.getState().activeOverlays).toHaveLength(1);
    expect(store.getState().activeOverlays[0].kind).toBe('spotlight');
  });

  it('auto-removes overlay after its visible duration (clamped to min hold)', () => {
    const store = createNarrationStore();
    // Override the 3500ms production default so the test stays fast.
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
      minOverlayDurationMs: 500,
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(200);
    expect(store.getState().activeOverlays).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(store.getState().activeOverlays).toHaveLength(0);
  });

  it('floors overlay visible duration by minOverlayDurationMs', () => {
    const store = createNarrationStore();
    // Storyboard specifies duration_ms: 800 but min hold is 3000ms — the
    // overlay must stay past 2000ms (where it would have expired unclamped)
    // and be gone by 3500ms (past the floor).
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
      minOverlayDurationMs: 3000,
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(200);
    expect(store.getState().activeOverlays).toHaveLength(1);
    vi.advanceTimersByTime(1800); // t=2000ms — would have expired without floor
    expect(store.getState().activeOverlays).toHaveLength(1);
    vi.advanceTimersByTime(1500); // t=3500ms — past the 3000ms floor
    expect(store.getState().activeOverlays).toHaveLength(0);
  });

  it('drops steps with unknown block_id', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute({
      version: 1,
      reasoning: '',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: {
            type: 'spotlight',
            target_block: 'p1_t0',
            dim_opacity: 0.65,
            feather_px: 40,
            shape: 'rounded',
          },
        },
        {
          at_ms: 0,
          duration_ms: 500,
          action: {
            type: 'spotlight',
            target_block: 'NOPE',
            dim_opacity: 0.65,
            feather_px: 40,
            shape: 'rounded',
          },
        },
      ],
    });
    vi.advanceTimersByTime(0);
    expect(store.getState().activeOverlays).toHaveLength(1);
  });

  it('new storyboard cancels pending steps from the previous one', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(100);
    engine.execute({
      version: 1,
      reasoning: 'override',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: { type: 'clear', targets: 'all' },
        },
      ],
    });
    vi.advanceTimersByTime(100);
    expect(store.getState().activeOverlays).toHaveLength(0);
  });

  it('resetVisuals clears overlays and re-centers camera', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(500);
    engine.resetVisuals();
    expect(store.getState().activeOverlays).toHaveLength(0);
    // Fit-page scale for 1000×1400 page in 800×1000 viewport, × 0.95 padding.
    const expectedFit = Math.min(800 / 1000, 1000 / 1400) * 0.95;
    expect(store.getState().camera).toEqual({
      scale: expectedFit,
      x: 0,
      y: 0,
      easing: 'ease-in-out',
    });
  });

  it('clear with array of ids removes only those', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    store.getState().addOverlay({
      id: 'keep-me',
      kind: 'pulse',
      action: {
        type: 'pulse',
        target_block: 'p1_t0',
        count: 1,
        intensity: 'subtle',
      },
      createdAt: 0,
      expiresAt: 10_000,
    });
    store.getState().addOverlay({
      id: 'kill-me',
      kind: 'pulse',
      action: {
        type: 'pulse',
        target_block: 'p1_t0',
        count: 1,
        intensity: 'subtle',
      },
      createdAt: 0,
      expiresAt: 10_000,
    });
    engine.execute({
      version: 1,
      reasoning: '',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: { type: 'clear', targets: ['kill-me'] },
        },
      ],
    });
    vi.advanceTimersByTime(0);
    expect(store.getState().activeOverlays.map((o) => o.id)).toEqual(['keep-me']);
  });
});
