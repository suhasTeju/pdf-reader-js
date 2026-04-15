import type { PageBBoxData, Block } from '../types/bbox';
import type { Storyboard } from '../types/storyboard';

export interface EmbeddingProvider {
  /** Return embeddings (normalized or raw — similarity function handles either). */
  embed: (texts: string[]) => Promise<Float32Array[]>;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface BlockMatch {
  block: Block;
  score: number;
}

export async function matchChunkToBlock(
  chunk: string,
  page: PageBBoxData,
  provider: EmbeddingProvider,
): Promise<BlockMatch | null> {
  const textBlocks = page.blocks.filter(
    (b) => typeof b.text === 'string' && b.text.trim().length > 0,
  );
  if (textBlocks.length === 0) return null;
  const inputs = [chunk, ...textBlocks.map((b) => b.text as string)];
  const embeds = await provider.embed(inputs);
  if (embeds.length < 2) return null;
  const chunkEmbed = embeds[0];
  let best: BlockMatch | null = null;
  for (let i = 0; i < textBlocks.length; i++) {
    const score = cosineSimilarity(chunkEmbed, embeds[i + 1]);
    if (!best || score > best.score) best = { block: textBlocks[i], score };
  }
  return best;
}

/**
 * Build a minimal safe storyboard from a matched block + its default_action.
 * Never fails — emits a plain clear-only storyboard if no match.
 */
export function storyboardFromMatch(match: BlockMatch | null): Storyboard {
  if (!match) {
    return {
      version: 1,
      reasoning: 'fallback: no match — clearing overlays',
      steps: [
        {
          at_ms: 0,
          duration_ms: 800,
          action: { type: 'clear', targets: 'overlays' },
        },
      ],
    };
  }
  const { block } = match;
  const camera = {
    type: 'camera' as const,
    target_block: block.block_id,
    scale: 1.5,
    padding: 60,
    easing: 'ease-out' as const,
  };

  const defaultAction = block.default_action;
  let second: Storyboard['steps'][0]['action'];
  switch (defaultAction) {
    case 'spotlight':
      second = {
        type: 'spotlight',
        target_block: block.block_id,
        dim_opacity: 0.65,
        feather_px: 40,
        shape: 'rounded',
      };
      break;
    case 'underline':
      second = {
        type: 'underline',
        target_block: block.block_id,
        color: '#FBBF24',
        style: 'sketch',
        draw_duration_ms: 600,
      };
      break;
    case 'pulse':
      second = {
        type: 'pulse',
        target_block: block.block_id,
        count: 2,
        intensity: 'normal',
      };
      break;
    case 'zoom_pan':
    default:
      second = {
        type: 'box',
        target_block: block.block_id,
        color: '#3B82F6',
        style: 'solid',
      };
  }

  return {
    version: 1,
    reasoning: `fallback: matched ${block.block_id} (${match.score.toFixed(2)})`,
    steps: [
      { at_ms: 0, duration_ms: 700, action: camera },
      { at_ms: 300, duration_ms: 1200, action: second },
    ],
  };
}
