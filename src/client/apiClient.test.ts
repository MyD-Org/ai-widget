import { describe, it, expect, vi } from 'vitest';
import { createApiClient, toChatEvent } from './apiClient';
import { ApiError } from '../types';
import type { RawSseEvent } from './sse';

const cfg = { baseUrl: 'https://api.test', agentId: 'agent-1' };

describe('toChatEvent', () => {
  it('maps a text event', () => {
    const raw: RawSseEvent = { event: 'text', data: '{"delta":"hi"}' };
    expect(toChatEvent(raw)).toEqual({ type: 'text', delta: 'hi' });
  });
  it('maps a done event with camelCased fields', () => {
    const raw: RawSseEvent = { event: 'done', data: '{"usage":{},"rounds":2,"stopped_by_max_rounds":false,"stop_reason":"end_turn"}' };
    expect(toChatEvent(raw)).toEqual({ type: 'done', usage: {}, rounds: 2, stoppedByMaxRounds: false, stopReason: 'end_turn' });
  });
  it('maps a tool event', () => {
    expect(toChatEvent({ event: 'tool', data: '{"name":"search"}' })).toEqual({ type: 'tool', name: 'search' });
  });
  it('maps a card event to a typed card', () => {
    const card = { type: 'budget', title: 'Presupuesto #1042', lines: [], actions: [] };
    const raw = { event: 'card', data: JSON.stringify(card) };
    expect(toChatEvent(raw)).toEqual({ type: 'card', card });
  });
});

describe('createApiClient', () => {
  it('createConversation POSTs agent_id with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'conv-1' }), { status: 201 }),
    );
    const client = createApiClient(cfg, () => 'jwt-123', fetchMock);
    const out = await client.createConversation();
    expect(out).toEqual({ id: 'conv-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/v1/conversations');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(JSON.parse(init.body)).toEqual({ agent_id: 'agent-1' });
  });

  it('maps HTTP 401 to ApiError code "auth"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    const client = createApiClient(cfg, () => 'jwt', fetchMock);
    await expect(client.createConversation()).rejects.toMatchObject({ status: 401, code: 'auth' });
    expect((await client.createConversation().catch((e) => e))).toBeInstanceOf(ApiError);
  });

  it('maps HTTP 429 to ApiError code "rate_limit"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    const client = createApiClient(cfg, () => 'jwt', fetchMock);
    await expect(client.createConversation()).rejects.toMatchObject({ status: 429, code: 'rate_limit' });
  });

  it('listMessages GETs the history', async () => {
    const history = [{ id: 'm1', role: 'user', text: 'hola', created_at: 't' }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(history), { status: 200 }));
    const client = createApiClient(cfg, () => 'jwt', fetchMock);
    expect(await client.listMessages('conv-1')).toEqual(history);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v1/conversations/conv-1/messages');
  });
});

describe('eventos custom + page_context + kind (dashboard builder)', () => {
  it('mapea un evento desconocido a custom (passthrough)', () => {
    const raw: RawSseEvent = { event: 'dashboard', data: '{"version":1,"meta":{"name":"Ventas"}}' };
    expect(toChatEvent(raw)).toEqual({
      type: 'custom',
      name: 'dashboard',
      payload: { version: 1, meta: { name: 'Ventas' } },
    });
  });

  it('createConversation manda kind cuando está configurado', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response('{"id":"c1"}', { status: 201 });
    }) as typeof fetch;
    const client = createApiClient(
      { baseUrl: 'http://x', agentId: 'a1', token: 't', kind: 'dashboard_builder' },
      () => 't',
      fetchImpl,
    );
    await client.createConversation();
    expect(calls[0].body).toEqual({ agent_id: 'a1', kind: 'dashboard_builder' });
  });

  it('streamMessage incluye page_context de getPageContext', async () => {
    const calls: Array<{ body: unknown }> = [];
    const sse = 'event: done\ndata: {}\n\n';
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ body: JSON.parse(String(init?.body)) });
      return { ok: true, status: 200, body } as unknown as Response;
    }) as typeof fetch;
    const client = createApiClient(
      { baseUrl: 'http://x', agentId: 'a1', token: 't', getPageContext: () => ({ version: 1 }) },
      () => 't',
      fetchImpl,
    );
    for await (const _ev of client.streamMessage('c1', 'hola')) { /* drain */ }
    expect(calls[0].body).toEqual({ content: 'hola', page_context: { version: 1 } });
  });
});
