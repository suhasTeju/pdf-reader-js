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

function nearestFigureOnPage(
  caption: Block,
  page: PageBBoxData | undefined,
): Block | null {
  if (!page) return null;
  // Captions usually sit directly under/above their figure. Score figures on
  // the same page by vertical centre distance; closest wins.
  const [cx1, cy1, cx2, cy2] = caption.bbox;
  const ccx = (cx1 + cx2) / 2;
  const ccy = (cy1 + cy2) / 2;
  let best: { block: Block; dist: number } | null = null;
  for (const b of page.blocks) {
    if (b.block_id === caption.block_id) continue;
    if (b.type !== 'figure' && b.type !== 'figure_region') continue;
    const [x1, y1, x2, y2] = b.bbox;
    const fx = (x1 + x2) / 2;
    const fy = (y1 + y2) / 2;
    const dist = Math.hypot(fx - ccx, fy - ccy);
    if (!best || dist < best.dist) best = { block: b, dist };
  }
  return best?.block ?? null;
}

function truncateLabel(text: string | null, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + '…';
}

/**
 * Build a fallback storyboard from a matched block. Keys on `block.type`
 * (7 types) rather than `block.default_action` (4 values) so every block
 * class produces a visually distinct storyboard — not every failure rounds
 * down to camera + box. An optional `page` lets caption blocks route to a
 * callout→figure on the same page.
 *
 * Never throws — emits a clear-only storyboard when no match is supplied.
 */
export function storyboardFromMatch(
  match: BlockMatch | null,
  page?: PageBBoxData,
): Storyboard {
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
  const id = block.block_id;
  const reason = `fallback (block.type=${block.type}): matched ${id} (${match.score.toFixed(2)})`;

  switch (block.type) {
    case 'heading': {
      // Headings anchor structure — spotlight + title label.
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 700,
            action: {
              type: 'spotlight',
              target_block: id,
              dim_opacity: 0.6,
              feather_px: 40,
              shape: 'rounded',
            },
          },
          {
            at_ms: 300,
            duration_ms: 1200,
            action: {
              type: 'label',
              target_block: id,
              text: truncateLabel(block.text, 32) || 'section',
              position: 'top',
            },
          },
        ],
      };
    }
    case 'paragraph': {
      // Paragraphs read like prose — gentle re-centre + sketch underline.
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 600,
            action: {
              type: 'camera',
              target_block: id,
              scale: 1.1,
              padding: 80,
              easing: 'ease-out',
            },
          },
          {
            at_ms: 300,
            duration_ms: 900,
            action: {
              type: 'underline',
              target_block: id,
              color: '#FBBF24',
              style: 'sketch',
              draw_duration_ms: 800,
            },
          },
        ],
      };
    }
    case 'list_item':
    case 'mcq_option': {
      // Enumerated items — inline highlight, no camera move.
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 500,
            action: {
              type: 'highlight',
              target_block: id,
              color: 'rgba(250, 204, 21, 0.35)',
              draw_duration_ms: 450,
            },
          },
        ],
      };
    }
    case 'caption': {
      // Caption → route a callout arrow to the nearest figure on the same page.
      const figure = nearestFigureOnPage(block, page);
      if (figure) {
        return {
          version: 1,
          reasoning: `${reason}; caption → figure ${figure.block_id}`,
          steps: [
            {
              at_ms: 0,
              duration_ms: 900,
              action: {
                type: 'callout',
                from_block: id,
                to_block: figure.block_id,
                label: 'see',
                curve: 'curved',
              },
            },
            {
              at_ms: 600,
              duration_ms: 1000,
              action: {
                type: 'pulse',
                target_block: figure.block_id,
                count: 2,
                intensity: 'normal',
              },
            },
          ],
        };
      }
      // No figure on the page — just underline the caption so it stays legible.
      return {
        version: 1,
        reasoning: `${reason}; no figure on page, underlining caption`,
        steps: [
          {
            at_ms: 0,
            duration_ms: 800,
            action: {
              type: 'underline',
              target_block: id,
              color: '#FBBF24',
              style: 'sketch',
              draw_duration_ms: 700,
            },
          },
        ],
      };
    }
    case 'figure': {
      // Figure blocks — pulse to draw the eye, then frame with a box.
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 900,
            action: {
              type: 'pulse',
              target_block: id,
              count: 2,
              intensity: 'strong',
            },
          },
          {
            at_ms: 400,
            duration_ms: 1200,
            action: {
              type: 'box',
              target_block: id,
              color: '#3B82F6',
              style: 'solid',
            },
          },
        ],
      };
    }
    case 'figure_region': {
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 900,
            action: {
              type: 'pulse',
              target_block: id,
              count: 2,
              intensity: 'normal',
            },
          },
        ],
      };
    }
    case 'table': {
      return {
        version: 1,
        reasoning: reason,
        steps: [
          {
            at_ms: 0,
            duration_ms: 700,
            action: {
              type: 'camera',
              target_block: id,
              scale: 1.2,
              padding: 60,
              easing: 'ease-out',
            },
          },
          {
            at_ms: 300,
            duration_ms: 1000,
            action: {
              type: 'box',
              target_block: id,
              color: '#3B82F6',
              style: 'dashed',
            },
          },
        ],
      };
    }
    default: {
      // Unknown block type — safe default that still has variety.
      return {
        version: 1,
        reasoning: `${reason}; unknown block.type, using highlight`,
        steps: [
          {
            at_ms: 0,
            duration_ms: 600,
            action: {
              type: 'highlight',
              target_block: id,
              color: 'rgba(250, 204, 21, 0.35)',
              draw_duration_ms: 500,
            },
          },
        ],
      };
    }
  }
}
