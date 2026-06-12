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
