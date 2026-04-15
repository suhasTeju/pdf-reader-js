import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoryboardEngine } from '../../src/director/storyboard-engine';
import { directStoryboard } from '../../src/director/llm-director';
import { createNarrationStore } from '../../src/store/narration-store';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

function makePage(): PageBBoxData {
  return {
    id: '1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1000, height: 1400, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0',
        bbox: [100, 100, 500, 200],
        text: 'H',
        type: 'heading',
        parent_id: null,
        confidence: 1,
        reading_order: 0,
        default_action: 'zoom_pan',
        semantic_unit_id: 's1',
      },
    ],
    created_at: '',
  };
}
function makeIndex(): BBoxIndex {
  const page = makePage();
  return {
    byPage: new Map([[1, page]]),
    blockById: new Map([
      ['p1_t0', { block: page.blocks[0], pageNumber: 1 }],
    ]),
    crossPageFigures: [],
  };
}

function mockSse(body: string): Response {
  const events = `data: ${JSON.stringify({ choices: [{ delta: { content: body } }] })}\ndata: [DONE]\n`;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(events));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('chunk → director → engine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a valid LLM response produces visible overlays', async () => {
    const store = createNarrationStore();
    const index = makeIndex();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: index,
      getViewport: () => ({ width: 800, height: 1000 }),
    });

    const sb = JSON.stringify({
      version: 1,
      reasoning: 'e2e',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: {
            type: 'camera',
            target_block: 'p1_t0',
            scale: 1.3,
            padding: 60,
            easing: 'ease-out',
          },
        },
        {
          at_ms: 50,
          duration_ms: 1000,
          action: {
            type: 'spotlight',
            target_block: 'p1_t0',
            dim_opacity: 0.65,
            feather_px: 40,
            shape: 'rounded',
          },
        },
      ],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSse(sb));

    const page = index.byPage.get(1)!;
    // Run fetch outside fake timers so the promise resolves normally
    vi.useRealTimers();
    const result = await directStoryboard(
      { endpointUrl: 'x', model: 'm', useJsonSchema: false },
      {
        chunk: 'hi',
        pageNumber: 1,
        page,
        index,
        history: [],
        camera: store.getState().camera,
        activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).not.toBeNull();

    vi.useFakeTimers();
    engine.execute(result.storyboard!);
    vi.advanceTimersByTime(50);
    expect(
      store.getState().activeOverlays.some((o) => o.kind === 'spotlight'),
    ).toBe(true);
  });
});
