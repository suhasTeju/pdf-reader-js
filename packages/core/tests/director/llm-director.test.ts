import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { directStoryboard } from '../../src/director/llm-director';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

function makeIndex(): { page: PageBBoxData; index: BBoxIndex } {
  const page: PageBBoxData = {
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
  return {
    page,
    index: {
      byPage: new Map([[1, page]]),
      blockById: new Map([
        ['p1_t0', { block: page.blocks[0], pageNumber: 1 }],
      ]),
      crossPageFigures: [],
    },
  };
}

function mockSseResponse(payload: string): Response {
  const events = payload
    .split('\n')
    .filter(Boolean)
    .map(
      (line) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content: line + '\n' } }] })}\n`,
    )
    .join('');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(events + 'data: [DONE]\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('directStoryboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a validated storyboard on valid JSON', async () => {
    const { page, index } = makeIndex();
    const payload = JSON.stringify({
      version: 1,
      reasoning: 'ok',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: {
            type: 'spotlight',
            target_block: 'p1_t0',
            dim_opacity: 0.6,
            feather_px: 30,
            shape: 'rounded',
          },
        },
      ],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSseResponse(payload));

    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'test-model', useJsonSchema: false },
      {
        chunk: 'hi',
        pageNumber: 1,
        page,
        index,
        history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
        activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).not.toBeNull();
    expect(result.storyboard!.steps).toHaveLength(1);
  });

  it('returns error on HTTP failure', async () => {
    const { page, index } = makeIndex();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 500 }),
    );
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '',
        pageNumber: 1,
        page,
        index,
        history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
        activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });

  it('returns error on malformed JSON', async () => {
    const { page, index } = makeIndex();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockSseResponse('not { json'),
    );
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '',
        pageNumber: 1,
        page,
        index,
        history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
        activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).toBeNull();
    expect(result.error).toMatch(/parse error/);
  });

  it('strips markdown code fences', async () => {
    const { page, index } = makeIndex();
    const sb = JSON.stringify({
      version: 1,
      reasoning: 'ok',
      steps: [
        {
          at_ms: 0,
          duration_ms: 500,
          action: {
            type: 'spotlight',
            target_block: 'p1_t0',
            dim_opacity: 0.6,
            feather_px: 30,
            shape: 'rounded',
          },
        },
      ],
    });
    const fenced = '```json\n' + sb + '\n```';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSseResponse(fenced));
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '',
        pageNumber: 1,
        page,
        index,
        history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
        activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).not.toBeNull();
  });
});
