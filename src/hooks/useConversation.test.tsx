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

// Wrapper con conversationId pre-creado (copiloto del operador, ADR 0007).
const preCreatedWrapper =
  (conversationId: string, token = 'jwt') =>
  ({ children }: { children: ReactNode }) =>
    (
      <AiChatProvider config={{ baseUrl: 'https://api.test', agentId: 'a', token, conversationId }}>
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

  it('attaches a card to the assistant message', async () => {
    const card = { type: 'budget', title: 'Presupuesto #1042', lines: [], actions: [] };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Te armé el presupuesto"}\n\n',
          `event: card\ndata: ${JSON.stringify(card)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => {
      result.current.send('precio');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.text).toBe('Te armé el presupuesto');
    expect(assistant?.card).toEqual(card);
  });

  it('a second card in the same turn lands on a new assistant message', async () => {
    const c1 = { type: 'budget', title: 'A', lines: [], actions: [] };
    const c2 = { type: 'budget', title: 'B', lines: [], actions: [] };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          `event: card\ndata: ${JSON.stringify(c1)}\n\n`,
          `event: card\ndata: ${JSON.stringify(c2)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => {
      result.current.send('dos');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    const cards = result.current.messages.filter((m) => m.role === 'assistant').map((m) => m.card?.title);
    expect(cards).toEqual(['A', 'B']);
  });

  it('with config.conversationId: loads history and does NOT create a conversation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    // 1) GET history del hilo pre-creado; 2) POST mensaje (stream).
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'h1', role: 'assistant', text: 'Hola, soy el copiloto' }]), { status: 200 }),
      )
      .mockResolvedValueOnce(sseResponse(['event: text\ndata: {"delta":"ok"}\n\n', 'event: done\ndata: {}\n\n']));

    const { result } = renderHook(() => useConversation(), { wrapper: preCreatedWrapper('assist-42') });
    await waitFor(() => expect(result.current.messages.length).toBe(1));
    expect(result.current.messages[0].text).toBe('Hola, soy el copiloto');

    act(() => {
      result.current.send('buscá paneles');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    // Ninguna llamada fue a POST /v1/conversations (creación). El primer fetch fue GET de historial.
    const urls = fetchMock.mock.calls.map((c) => `${c[1]?.method ?? 'GET'} ${c[0]}`);
    expect(urls.some((u) => u.includes('POST') && u.endsWith('/v1/conversations'))).toBe(false);
    expect(urls[0]).toBe('GET https://api.test/v1/conversations/assist-42/messages');
    // El POST de mensaje fue al hilo pre-creado.
    expect(urls.some((u) => u === 'POST https://api.test/v1/conversations/assist-42/messages')).toBe(true);
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
