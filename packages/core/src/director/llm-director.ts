import {
  StoryboardSchema,
  StoryboardStepSchema,
  storyboardJsonSchema,
} from './storyboard-schema';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  type BuildUserPromptInput,
} from './prompts';
import { parseSse, extractDelta } from './sse-parser';
import type { Storyboard } from '../types/storyboard';

export interface LlmConfig {
  endpointUrl: string;
  model: string;
  authToken?: string;
  extraBody?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  /** If true, include response_format: json_schema (disable if the backend doesn't support it). */
  useJsonSchema?: boolean;
  /** If true, request streaming (default false: simpler, more reliable for non-streaming backends). */
  stream?: boolean;
}

export interface DirectorInput extends BuildUserPromptInput {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DirectorResult {
  storyboard: Storyboard | null;
  raw: string;
  error?: string;
}

/**
 * Call the LLM, stream the response, extract a JSON storyboard, validate with zod.
 * Returns { storyboard: null } with an error string on any failure path.
 */
export async function directStoryboard(
  config: LlmConfig,
  input: DirectorInput,
): Promise<DirectorResult> {
  const {
    endpointUrl,
    model,
    authToken,
    extraBody,
    maxTokens = 1024,
    temperature = 0.3,
    useJsonSchema = true,
    stream = false,
  } = config;

  const userContent = buildUserPrompt(input);

  const body: Record<string, unknown> = {
    model,
    stream,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    ...(extraBody ?? {}),
  };

  if (useJsonSchema) {
    const validBlockIds = input.page.blocks.map((b) => b.block_id);
    const validCrossPageBlockIds = input.index.crossPageFigures
      .filter((f) => f.page !== input.pageNumber)
      .map((f) => f.block_id);
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'storyboard',
        strict: true,
        schema: storyboardJsonSchema({
          validBlockIds,
          validCrossPageBlockIds,
        }),
      },
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const timeoutController = new AbortController();
  const timer = setTimeout(
    () => timeoutController.abort(),
    input.timeoutMs ?? 2500,
  );
  const signal = mergeSignals(input.signal, timeoutController.signal);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok || !response.body) {
      return {
        storyboard: null,
        raw: '',
        error: `HTTP ${response.status}`,
      };
    }

    let raw = '';
    if (stream && response.body) {
      for await (const chunk of parseSse(response.body)) {
        const delta = extractDelta(chunk);
        if (delta) raw += delta;
      }
    } else {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      raw = json.choices?.[0]?.message?.content ?? '';
    }

    const stripped = collapseWhitespaceRuns(stripCodeFences(raw).trim());
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      return {
        storyboard: null,
        raw,
        error: `parse error: ${(e as Error).message}`,
      };
    }

    // OpenAI's strict structured-outputs mode forces every property to appear
    // in `required`, so the LLM emits nulls for inapplicable fields (e.g.,
    // target_bbox: null on a spotlight action). Strip nulls before validation
    // so the per-action zod schemas see only the relevant fields.
    const cleaned = clampNumericRanges(stripNullsDeep(parsed));

    const validation = StoryboardSchema.safeParse(cleaned);
    if (validation.success) {
      return {
        storyboard: enforceOverlayPresence(validation.data as Storyboard),
        raw,
      };
    }

    const salvaged = salvageStoryboard(cleaned);
    if (salvaged) {
      return { storyboard: enforceOverlayPresence(salvaged), raw };
    }

    return {
      storyboard: null,
      raw,
      error: `validation failed: ${validation.error.message}`,
    };
  } catch (e) {
    const name = (e as Error).name;
    const msg = name === 'AbortError' ? 'aborted' : (e as Error).message;
    return { storyboard: null, raw: '', error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function stripCodeFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1] : s;
}

/**
 * Small models (gpt-4.1-nano in particular) sometimes emit runs of dozens of
 * tab characters between a property value and the following comma. That's
 * technically valid JSON whitespace but blows up some downstream inspectors
 * and bloats the transcript. Collapse any run of 8+ whitespace chars into a
 * single space — only OUTSIDE string literals so we don't corrupt user text.
 */
function collapseWhitespaceRuns(src: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  let run = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      out += c;
      if (escape) {
        escape = false;
      } else if (c === '\\') {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      out += c;
      inString = true;
      run = 0;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      run++;
      if (run <= 1) out += ' ';
      continue;
    }
    run = 0;
    out += c;
  }
  return out;
}

/**
 * Clamp numeric fields that the LLM commonly emits out of range. The schema
 * rejects values outside [0.5, 4.0] for camera.scale etc.; rather than throw
 * away the whole storyboard over a 0.394 scale value, clamp to the nearest
 * legal value and proceed. Mirrors the zod schema min/max bounds.
 */
function clampNumericRanges(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(clampNumericRanges);
  if (typeof input !== 'object') return input;

  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = clampNumericRanges(v);
  }

  const type = typeof out.type === 'string' ? (out.type as string) : undefined;
  if (type === 'camera') {
    if (typeof out.scale === 'number') out.scale = clamp(out.scale, 0.5, 4.0);
    if (typeof out.padding === 'number') {
      out.padding = clamp(out.padding, 0, 400);
    }
  }
  if (typeof out.dim_opacity === 'number') {
    out.dim_opacity = clamp(out.dim_opacity, 0, 1);
  }
  if (typeof out.feather_px === 'number') {
    out.feather_px = clamp(out.feather_px, 0, 200);
  }
  if (typeof out.draw_duration_ms === 'number') {
    out.draw_duration_ms = clamp(out.draw_duration_ms, 100, 3000);
  }
  if (typeof out.count === 'number') {
    out.count = Math.round(clamp(out.count, 1, 5));
  }
  // Step-level timings (at_ms 0-5000, duration_ms 100-5000).
  if (typeof out.at_ms === 'number') {
    out.at_ms = clamp(out.at_ms, 0, 5000);
  }
  if (typeof out.duration_ms === 'number' && type === undefined) {
    // Only clamp on step objects (which have no `type`), not on action objects.
    out.duration_ms = clamp(out.duration_ms, 100, 5000);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * HARD REQUIREMENT from the system prompt: a storyboard may not be a single
 * camera step. If the LLM slips through with camera-only output, append a
 * gentle pulse on the same target so the viewer always sees an overlay.
 */
function enforceOverlayPresence(sb: Storyboard): Storyboard {
  if (sb.steps.length === 0) return sb;
  const hasOverlay = sb.steps.some(
    (s) => s.action.type !== 'camera' && s.action.type !== 'clear',
  );
  if (hasOverlay) return sb;

  const cameraStep = sb.steps.find((s) => s.action.type === 'camera');
  if (!cameraStep || cameraStep.action.type !== 'camera') return sb;
  const target = cameraStep.action.target_block;
  if (!target) return sb;

  return {
    ...sb,
    reasoning: `${sb.reasoning} [auto-appended pulse: camera-only storyboards are forbidden]`,
    steps: [
      ...sb.steps,
      {
        at_ms: Math.min(4800, (cameraStep.at_ms ?? 0) + 200),
        duration_ms: 900,
        action: {
          type: 'pulse' as const,
          target_block: target,
          count: 2,
          intensity: 'normal' as const,
        },
      },
    ],
  };
}

/** Recursively remove keys whose value is null. Arrays of nulls become empty. */
function stripNullsDeep(input: unknown): unknown {
  if (input === null) return undefined;
  if (Array.isArray(input)) {
    return input
      .map(stripNullsDeep)
      .filter((v) => v !== undefined);
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      const cleaned = stripNullsDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return input;
}

/**
 * Best-effort salvage when the full StoryboardSchema rejects the LLM output.
 * Tries to keep individual valid steps; returns null if nothing usable remains.
 */
function salvageStoryboard(parsed: unknown): Storyboard | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { steps?: unknown; reasoning?: unknown };
  if (!Array.isArray(obj.steps)) return null;

  const goodSteps: Array<ReturnType<typeof StoryboardStepSchema.parse>> = [];
  for (const step of obj.steps) {
    const r = StoryboardStepSchema.safeParse(step);
    if (r.success) goodSteps.push(r.data);
    if (goodSteps.length >= 4) break;
  }
  if (goodSteps.length === 0) return null;

  return {
    version: 1,
    reasoning:
      typeof obj.reasoning === 'string'
        ? obj.reasoning + ' (salvaged)'
        : 'salvaged',
    steps: goodSteps as Storyboard['steps'],
  };
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!a) return b as AbortSignal;
  if (!b) return a;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return ctrl.signal;
}
