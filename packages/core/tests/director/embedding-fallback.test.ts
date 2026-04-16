import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  matchChunkToBlock,
  storyboardFromMatch,
} from '../../src/director/embedding-fallback';
import type { PageBBoxData } from '../../src/types/bbox';

const page: PageBBoxData = {
  id: '1',
  page_number: 1,
  page_text: '',
  page_dimensions: { width: 1000, height: 1400, dpi: 200 },
  blocks: [
    {
      block_id: 'b1',
      bbox: [0, 0, 100, 100],
      text: 'Definition of joints',
      type: 'paragraph',
      parent_id: null,
      confidence: 1,
      reading_order: 0,
      default_action: 'spotlight',
      semantic_unit_id: 's',
    },
    {
      block_id: 'b2',
      bbox: [0, 200, 100, 300],
      text: 'Classification list',
      type: 'list_item',
      parent_id: null,
      confidence: 1,
      reading_order: 1,
      default_action: 'underline',
      semantic_unit_id: 's',
    },
  ],
  created_at: '',
};

describe('embedding-fallback', () => {
  it('cosineSimilarity is 1 for equal vectors', () => {
    const v = new Float32Array([0.1, 0.2, 0.3]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('cosineSimilarity is 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('matchChunkToBlock picks the block closest to the chunk', async () => {
    const provider = {
      embed: async (texts: string[]) => {
        const vecs: Float32Array[] = [];
        for (const t of texts) {
          if (/Definition/i.test(t) || /what is a joint/i.test(t)) {
            vecs.push(new Float32Array([1, 0, 0]));
          } else if (/Classification/i.test(t)) {
            vecs.push(new Float32Array([0, 1, 0]));
          } else {
            vecs.push(new Float32Array([1, 0, 0]));
          }
        }
        return vecs;
      },
    };
    const match = await matchChunkToBlock('what is a joint?', page, provider);
    expect(match).not.toBeNull();
    expect(match!.block.block_id).toBe('b1');
  });

  it('storyboardFromMatch keys on block.type, not default_action — list_item → highlight only', () => {
    // b2 is a list_item with default_action:"underline" — new behavior ignores
    // default_action and keys on block.type, so list_item fallback is a single
    // highlight step (no camera, no underline).
    const match = { block: page.blocks[1], score: 0.9 };
    const sb = storyboardFromMatch(match);
    expect(sb.steps).toHaveLength(1);
    expect(sb.steps[0].action.type).toBe('highlight');
  });

  it('storyboardFromMatch renders paragraph as camera + underline', () => {
    // b1 is a paragraph — new fallback pairs a gentle re-centre camera with
    // an underline draw-in.
    const match = { block: page.blocks[0], score: 0.9 };
    const sb = storyboardFromMatch(match);
    expect(sb.steps).toHaveLength(2);
    expect(sb.steps[0].action.type).toBe('camera');
    expect(sb.steps[1].action.type).toBe('underline');
  });

  it('storyboardFromMatch routes caption → callout when a figure is on the page', () => {
    const pageWithFigure: PageBBoxData = {
      ...page,
      blocks: [
        ...page.blocks,
        {
          block_id: 'fig1',
          bbox: [0, 400, 100, 500],
          text: 'Fig 1',
          type: 'figure',
          parent_id: null,
          confidence: 1,
          reading_order: 2,
          default_action: 'pulse',
          semantic_unit_id: 's',
        },
        {
          block_id: 'cap1',
          bbox: [0, 520, 100, 560],
          text: 'Fig. 1 : example caption',
          type: 'caption',
          parent_id: null,
          confidence: 1,
          reading_order: 3,
          default_action: 'spotlight',
          semantic_unit_id: 's',
        },
      ],
    };
    const caption = pageWithFigure.blocks[pageWithFigure.blocks.length - 1];
    const sb = storyboardFromMatch({ block: caption, score: 0.9 }, pageWithFigure);
    const types = sb.steps.map((s) => s.action.type);
    expect(types).toContain('callout');
    expect(types).toContain('pulse');
  });

  it('storyboardFromMatch returns clear-only when no match', () => {
    const sb = storyboardFromMatch(null);
    expect(sb.steps).toHaveLength(1);
    expect(sb.steps[0].action.type).toBe('clear');
  });
});
