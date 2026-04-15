/**
 * Parses an OpenAI-style SSE stream (event-stream with data: ... lines).
 * Yields each JSON "delta" chunk as a parsed object. Ignores [DONE] markers.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!rawLine.startsWith('data:')) continue;
        const payload = rawLine.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // malformed SSE payload — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Extract the assistant-message content delta from an OpenAI-compatible chunk. */
export function extractDelta(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const choices = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices;
  if (!choices || !choices.length) return null;
  return choices[0].delta?.content ?? null;
}
