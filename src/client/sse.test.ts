import { describe, it, expect } from 'vitest';
import { parseSse, type RawSseEvent } from './sse';

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<RawSseEvent[]> {
  const out: RawSseEvent[] = [];
  for await (const ev of parseSse(stream)) out.push(ev);
  return out;
}

describe('parseSse', () => {
  it('parses one event with event + data lines', async () => {
    const s = streamFromChunks(['event: text\ndata: {"delta":"hola"}\n\n']);
    expect(await collect(s)).toEqual([{ event: 'text', data: '{"delta":"hola"}' }]);
  });

  it('parses multiple events in one chunk', async () => {
    const s = streamFromChunks(['event: text\ndata: {"delta":"a"}\n\nevent: done\ndata: {}\n\n']);
    expect(await collect(s)).toEqual([
      { event: 'text', data: '{"delta":"a"}' },
      { event: 'done', data: '{}' },
    ]);
  });

  it('reassembles an event split across chunk boundaries', async () => {
    const s = streamFromChunks(['event: te', 'xt\ndata: {"del', 'ta":"hi"}\n\n']);
    expect(await collect(s)).toEqual([{ event: 'text', data: '{"delta":"hi"}' }]);
  });

  it('flushes a trailing event with no terminating blank line', async () => {
    const s = streamFromChunks(['event: done\ndata: {}']);
    expect(await collect(s)).toEqual([{ event: 'done', data: '{}' }]);
  });
});
