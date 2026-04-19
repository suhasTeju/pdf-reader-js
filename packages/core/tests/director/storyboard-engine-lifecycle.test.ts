import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryboardEngine } from '../../src/director/storyboard-engine';
import { createNarrationStore } from '../../src/store/narration-store';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';
import type { Storyboard } from '../../src/types/storyboard';

/**
 * Regression test for the engine-teardown memory leak.
 *
 * The bug: `cancelPending()` cleared step-dispatch timers but NOT
 * overlay-removal timers. React's effect cleanup in
 * `TutorModeContainer` called `cancelPending()`, so when the effect
 * re-ran (e.g. on viewport change), each abandoned engine kept its
 * `overlayRemovalTimers` Map alive. Those `setTimeout`s retained
 * closures referencing `narrationStore` and `bboxIndex` (potentially
 * MBs of parsed textbook data), compounding silently.
 *
 * The fix: expose `destroy()` that cancels both timer sets, and call
 * it from the React cleanup instead of `cancelPending()`.
 */

function makePage(): PageBBoxData {
  return {
    id: 'p1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1756, height: 2269, dpi: 200 },
    blocks: [
      { block_id: 'b1', type: 'paragraph', bbox: [100, 100, 500, 200], text: 'one' },
      { block_id: 'b2', type: 'paragraph', bbox: [100, 300, 500, 400], text: 'two' },
    ],
  };
}

function makeIndex(page: PageBBoxData): BBoxIndex {
  return {
    byPage: new Map([[page.page_number, page]]),
    blockById: new Map(
      page.blocks.map((b) => [b.block_id, { block: b, pageNumber: page.page_number }]),
    ),
    crossPageFigures: [],
  };
}

function makeStoryboard(): Storyboard {
  return {
    version: 1,
    reasoning: 'test',
    steps: [
      {
        at_ms: 0,
        duration_ms: 200,
        action: {
          type: 'camera',
          target_block: 'b1',
          scale: 1,
          padding: 20,
          easing: 'ease-out',
        },
      },
      {
        at_ms: 100,
        duration_ms: 200,
        action: {
          type: 'spotlight',
          target_block: 'b1',
          dim_opacity: 0.65,
          feather_px: 40,
          shape: 'rounded',
        },
      },
      {
        at_ms: 200,
        duration_ms: 200,
        action: {
          type: 'highlight',
          target_block: 'b2',
          color: 'rgba(250,204,21,0.35)',
          draw_duration_ms: 300,
        },
      },
    ],
  };
}

describe('StoryboardEngine — lifecycle & leak regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelPending clears step timers but intentionally leaves overlay-removal timers alive', () => {
    const engine = new StoryboardEngine({
      narrationStore: createNarrationStore(),
      bboxIndex: makeIndex(makePage()),
      getViewport: () => ({ width: 400, height: 600 }),
      minOverlayDurationMs: 500,
    });

    engine.execute(makeStoryboard());
    vi.advanceTimersByTime(250);

    const before = engine._queueSizesForTest();
    expect(before.removals).toBeGreaterThan(0);

    engine.cancelPending();

    const after = engine._queueSizesForTest();
    expect(after.pending).toBe(0);
    // Intentional: mid-flight overlays keep their auto-expire timers (see
    // the "stuck spotlight" invariant in storyboard-engine.ts).
    expect(after.removals).toBe(before.removals);

    engine.destroy();
  });

  it('destroy() clears BOTH step timers and overlay-removal timers', () => {
    const engine = new StoryboardEngine({
      narrationStore: createNarrationStore(),
      bboxIndex: makeIndex(makePage()),
      getViewport: () => ({ width: 400, height: 600 }),
      minOverlayDurationMs: 500,
    });

    engine.execute(makeStoryboard());
    vi.advanceTimersByTime(250);

    const before = engine._queueSizesForTest();
    expect(before.removals).toBeGreaterThan(0);

    engine.destroy();

    const after = engine._queueSizesForTest();
    expect(after.pending).toBe(0);
    expect(after.removals).toBe(0);
  });

  it('destroy() is idempotent and safe to call twice', () => {
    const engine = new StoryboardEngine({
      narrationStore: createNarrationStore(),
      bboxIndex: makeIndex(makePage()),
      getViewport: () => ({ width: 400, height: 600 }),
    });

    engine.execute(makeStoryboard());
    engine.destroy();
    expect(() => engine.destroy()).not.toThrow();
    expect(engine._queueSizesForTest()).toEqual({ pending: 0, removals: 0 });
  });

  it('simulated churn: 20 engine recreations with destroy() leak zero timers', () => {
    // Mirrors the iOS Safari pattern where viewport state churn
    // repeatedly tore down and rebuilt the engine. With destroy(),
    // prior engines are released before the next instantiation.
    const store = createNarrationStore();
    const index = makeIndex(makePage());

    let last: StoryboardEngine | null = null;
    for (let i = 0; i < 20; i++) {
      const engine = new StoryboardEngine({
        narrationStore: store,
        bboxIndex: index,
        getViewport: () => ({ width: 400, height: 600 }),
        minOverlayDurationMs: 500,
      });
      engine.execute(makeStoryboard());
      vi.advanceTimersByTime(250);
      last?.destroy();
      last = engine;
    }
    last?.destroy();

    expect(last!._queueSizesForTest()).toEqual({ pending: 0, removals: 0 });
  });
});
