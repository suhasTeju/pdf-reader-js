import type { BBoxIndex, PageBBoxData } from '../types/bbox';
import type { CameraState, ActiveOverlay } from '../types/storyboard';
import type { ChunkHistoryEntry } from '../store/narration-store';

export const SYSTEM_PROMPT = `You are the cinematic director of an AI tutor's PDF visualization. Given what the tutor just said, emit a JSON storyboard of 1-4 visual steps so the explanation feels like a produced teaching video.

Grammar rules:
- Start with \`camera\` to bring the relevant region into view.
- Use \`spotlight\` when analyzing a paragraph (prefer it when the block's default_action is "spotlight").
- Use \`underline\` for list items / enumerations (default_action: "underline").
- Use \`pulse\` or \`callout\` for figures (default_action: "pulse").
- Use \`ghost_reference\` when the tutor mentions a figure from another page.
- Respect each block's default_action unless context suggests otherwise.
- Prefer deliberate, minimal motion. Don't flicker.
- Output ONLY valid JSON matching the provided schema.`;

export interface BuildUserPromptInput {
  chunk: string;
  pageNumber: number;
  page: PageBBoxData;
  index: BBoxIndex;
  history: ChunkHistoryEntry[];
  camera: CameraState;
  activeOverlays: ActiveOverlay[];
  maxSteps?: number;
}

/** Truncate text to ~max chars, word-aware. */
export function truncate(text: string | null, max = 200): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const last = slice.lastIndexOf(' ');
  return (last > 40 ? slice.slice(0, last) : slice) + '…';
}

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const {
    chunk,
    pageNumber,
    page,
    index,
    history,
    camera,
    activeOverlays,
    maxSteps = 4,
  } = input;

  const pageBlocks = page.blocks.map((b) => ({
    block_id: b.block_id,
    type: b.type,
    text: truncate(b.text, 200),
    bbox: b.bbox,
    default_action: b.default_action,
  }));

  const xPageFigures = index.crossPageFigures
    .filter((f) => f.page !== pageNumber)
    .slice(0, 20)
    .map((f) => ({
      block_id: f.block_id,
      page: f.page,
      type: f.type,
      text: truncate(f.text, 200),
    }));

  const recent = history.slice(-3).map((h) => h.text);
  const overlaySummary = activeOverlays.map((o) => ({ id: o.id, kind: o.kind }));

  return [
    `Current chunk: ${JSON.stringify(chunk)}`,
    `Current page: ${pageNumber}`,
    `Recent chunks: ${JSON.stringify(recent)}`,
    `Current camera: ${JSON.stringify(camera)}`,
    `Active overlays: ${JSON.stringify(overlaySummary)}`,
    '',
    `Page blocks: ${JSON.stringify(pageBlocks)}`,
    '',
    `Cross-page figures index: ${JSON.stringify(xPageFigures)}`,
    '',
    `Max steps: ${maxSteps}`,
    `Output JSON storyboard.`,
  ].join('\n');
}
