import {
  StoryboardSchema,
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
  } = config;

  const userContent = buildUserPrompt(input);

  const body: Record<string, unknown> = {
    model,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    ...(extraBody ?? {}),
  };

  if (useJsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'storyboard',
        strict: true,
        schema: storyboardJsonSchema(),
      },
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
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
    for await (const chunk of parseSse(response.body)) {
      const delta = extractDelta(chunk);
      if (delta) raw += delta;
    }

    const stripped = stripCodeFences(raw).trim();
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

    const validation = StoryboardSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        storyboard: null,
        raw,
        error: `validation failed: ${validation.error.message}`,
      };
    }
    return { storyboard: validation.data as Storyboard, raw };
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

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!a) return b as AbortSignal;
  if (!b) return a;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return ctrl.signal;
}
