import { describe, it, expect } from 'vitest';
import { parseSse, extractDelta } from '../../src/director/sse-parser';

function mockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(chunks[i++]));
    },
  });
}

describe('parseSse', () => {
  it('yields parsed JSON for each data: line', async () => {
    const stream = mockStream([
      'data: {"id":"1","choices":[{"delta":{"content":"a"}}]}\n',
      'data: {"id":"1","choices":[{"delta":{"content":"b"}}]}\n',
      'data: [DONE]\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(2);
    expect(extractDelta(collected[0])).toBe('a');
    expect(extractDelta(collected[1])).toBe('b');
  });

  it('handles chunks split across reads', async () => {
    const stream = mockStream([
      'data: {"id":"1","choic',
      'es":[{"delta":{"content":"xy"}}]}\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(1);
    expect(extractDelta(collected[0])).toBe('xy');
  });

  it('skips malformed lines silently', async () => {
    const stream = mockStream([
      'data: {not json}\n',
      'data: {"id":"1","choices":[{"delta":{"content":"ok"}}]}\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(1);
    expect(extractDelta(collected[0])).toBe('ok');
  });

  it('extractDelta returns null for non-chunks', () => {
    expect(extractDelta(null)).toBeNull();
    expect(extractDelta({})).toBeNull();
    expect(extractDelta({ choices: [] })).toBeNull();
  });
});
