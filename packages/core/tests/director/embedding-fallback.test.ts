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

  it('storyboardFromMatch uses the block default_action', () => {
    const match = {
      block: page.blocks[1],
      score: 0.9,
    };
    const sb = storyboardFromMatch(match);
    expect(sb.steps).toHaveLength(2);
    expect(sb.steps[0].action.type).toBe('camera');
    expect(sb.steps[1].action.type).toBe('underline');
  });

  it('storyboardFromMatch returns clear-only when no match', () => {
    const sb = storyboardFromMatch(null);
    expect(sb.steps).toHaveLength(1);
    expect(sb.steps[0].action.type).toBe('clear');
  });
});
