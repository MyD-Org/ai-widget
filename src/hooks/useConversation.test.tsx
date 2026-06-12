import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AiChatProvider } from './AiChatProvider';
import { useConversation } from './useConversation';

// Build an SSE Response body from raw SSE blocks
function sseResponse(blocks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of blocks) c.enqueue(enc.encode(b));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const wrapper =
  (token = 'jwt') =>
  ({ children }: { children: ReactNode }) =>
    (
      <AiChatProvider config={{ baseUrl: 'https://api.test', agentId: 'a', token, persist: 'none' }}>
        {children}
      </AiChatProvider>
    );

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('useConversation', () => {
  it('send(): creates a conversation, streams text, accumulates assistant message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'conv-1' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Ho"}\n\n',
          'event: text\ndata: {"delta":"la"}\n\n',
          'event: done\ndata: {"rounds":1}\n\n',
        ]),
      );

    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toBeTruthy());

    act(() => {
      result.current.send('hola?');
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const texts = result.current.messages.map((m) => `${m.role}:${m.text}`);
    expect(texts).toEqual(['user:hola?', 'assistant:Hola']);
  });

  it('sets activity on a tool event, clears it on done', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(sseResponse(['event: tool\ndata: {"name":"search"}\n\n', 'event: done\ndata: {}\n\n']));
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => {
      result.current.send('buscá');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.activity).toBeNull();
  });

  it('maps a 429 on send to error.code rate_limit', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }));
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => {
      result.current.send('hi');
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ code: 'rate_limit' });
  });
});
