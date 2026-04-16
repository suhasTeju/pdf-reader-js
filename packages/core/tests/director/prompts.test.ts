import { describe, it, expect } from 'vitest';
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
  truncate,
} from '../../src/director/prompts';
import { StoryboardSchema } from '../../src/director/storyboard-schema';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

/** Extract balanced `{...}` JSON objects that look like fully-formed
 *  storyboards. The template in "Output shape" (with `<int>` placeholders)
 *  is deliberately skipped because it's a schematic, not literal JSON. */
function extractStoryboardJson(source: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = source.slice(start, i + 1);
        const looksLikeStoryboard =
          /"version"\s*:\s*1/.test(slice) && /"steps"\s*:\s*\[/.test(slice);
        const hasPlaceholder = /<[a-z_]+>/.test(slice);
        if (looksLikeStoryboard && !hasPlaceholder) {
          blocks.push(slice);
        }
        start = -1;
      }
    }
  }
  return blocks;
}

function makePage(): PageBBoxData {
  return {
    id: '1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1756, height: 2269, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0',
        bbox: [100, 100, 500, 200],
        text: 'Joints',
        type: 'heading',
        parent_id: null,
        confidence: 1,
        reading_order: 0,
        default_action: 'zoom_pan',
        semantic_unit_id: 'su_1',
      },
    ],
    created_at: '',
  };
}

function makeIndex(): BBoxIndex {
  const page = makePage();
  return {
    byPage: new Map([[1, page]]),
    blockById: new Map([['p1_t0', { block: page.blocks[0], pageNumber: 1 }]]),
    crossPageFigures: [
      {
        block_id: 'p2_i4',
        page: 2,
        type: 'figure',
        text: 'Diagram of long bone',
      },
      {
        block_id: 'p1_i2',
        page: 1,
        type: 'figure',
        text: 'Sagittal suture',
      },
    ],
  };
}

describe('prompt builder', () => {
  it('SYSTEM_PROMPT mentions the grammar rules', () => {
    expect(SYSTEM_PROMPT).toMatch(/camera/);
    expect(SYSTEM_PROMPT).toMatch(/spotlight/);
    expect(SYSTEM_PROMPT).toMatch(/default_action/);
  });

  it('SYSTEM_PROMPT includes intent-taxonomy recipes', () => {
    // Every recipe name should appear in prose + recipe headers.
    expect(SYSTEM_PROMPT).toMatch(/define\b/);
    expect(SYSTEM_PROMPT).toMatch(/point_out\b/);
    expect(SYSTEM_PROMPT).toMatch(/compare\b/);
    expect(SYSTEM_PROMPT).toMatch(/emphasize\b/);
  });

  it('SYSTEM_PROMPT gives behavioral guidance for all 9 non-clear action kinds', () => {
    // The "When to use each action" section must mention every overlay kind
    // so the LLM has a reason to pick from the full vocabulary.
    for (const kind of [
      'camera',
      'spotlight',
      'underline',
      'highlight',
      'pulse',
      'callout',
      'ghost_reference',
      'box',
      'label',
    ]) {
      expect(SYSTEM_PROMPT).toMatch(new RegExp(`\\b${kind}\\b`));
    }
  });

  describe('intent recipes', () => {
    const recipes = extractStoryboardJson(SYSTEM_PROMPT);

    it('embeds at least four recipes (define / point_out / compare / emphasize)', () => {
      expect(recipes.length).toBeGreaterThanOrEqual(4);
    });

    it('every recipe parses as valid JSON', () => {
      for (const r of recipes) {
        expect(() => JSON.parse(r)).not.toThrow();
      }
    });

    it('every recipe passes StoryboardSchema validation', () => {
      for (const r of recipes) {
        const parsed = StoryboardSchema.safeParse(JSON.parse(r));
        expect(
          parsed.success,
          `Recipe failed schema: ${r}\n${JSON.stringify(parsed, null, 2)}`,
        ).toBe(true);
      }
    });

    it('recipes collectively cover at least 6 distinct action kinds', () => {
      const kinds = new Set<string>();
      for (const r of recipes) {
        const sb = JSON.parse(r) as {
          steps: Array<{ action: { type: string } }>;
        };
        for (const s of sb.steps) kinds.add(s.action.type);
      }
      expect(
        kinds.size,
        `Only covered kinds: ${[...kinds].join(',')}`,
      ).toBeGreaterThanOrEqual(6);
    });
  });

  it('truncate shortens text and appends ellipsis', () => {
    const t = 'a'.repeat(500);
    expect(truncate(t, 100).length).toBeLessThanOrEqual(101);
    expect(truncate(t, 100).endsWith('…')).toBe(true);
  });

  it('truncate returns empty string for null/undefined', () => {
    expect(truncate(null)).toBe('');
  });

  it('buildUserPrompt includes chunk, page, and page blocks JSON', () => {
    const prompt = buildUserPrompt({
      chunk: 'A joint is a junction.',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    expect(prompt).toMatch(/"A joint is a junction\."/);
    expect(prompt).toMatch(/Current page: 1/);
    expect(prompt).toMatch(/"p1_t0"/);
    expect(prompt).toMatch(/"default_action":"zoom_pan"/);
  });

  it('buildUserPrompt excludes current page from cross-page index', () => {
    const prompt = buildUserPrompt({
      chunk: '…',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    expect(prompt).toMatch(/"p2_i4"/);
    expect(prompt).not.toMatch(/"p1_i2"/);
  });

  it('buildUserPrompt takes only the last 3 history entries', () => {
    const prompt = buildUserPrompt({
      chunk: 'x',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [
        { text: 'one', pageNumber: 1, timestamp: 1 },
        { text: 'two', pageNumber: 1, timestamp: 2 },
        { text: 'three', pageNumber: 1, timestamp: 3 },
        { text: 'four', pageNumber: 1, timestamp: 4 },
      ],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    expect(prompt).toMatch(/"two"/);
    expect(prompt).toMatch(/"four"/);
    expect(prompt).not.toMatch(/"one"/);
  });
});
