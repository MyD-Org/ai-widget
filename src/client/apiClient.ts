import { ApiError, type AiChatConfig, type Card, type ChatEvent, type ConversationSummary, type Message } from '../types';
import { parseSse, type RawSseEvent } from './sse';

type FetchFn = typeof fetch;
type TokenGetter = () => string;

function codeForStatus(status: number): string {
  if (status === 401) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  return 'http_error';
}

export function toChatEvent(raw: RawSseEvent): ChatEvent | null {
  let data: Record<string, unknown> = {};
  try {
    data = raw.data ? (JSON.parse(raw.data) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  switch (raw.event) {
    case 'text':
      return { type: 'text', delta: (data.delta as string) ?? '' };
    case 'tool':
      return { type: 'tool', name: (data.name as string) ?? '' };
    case 'done':
      return {
        type: 'done',
        usage: data.usage,
        rounds: (data.rounds as number) ?? 0,
        stoppedByMaxRounds: (data.stopped_by_max_rounds as boolean) ?? false,
        stopReason: (data.stop_reason as string) ?? '',
      };
    case 'card':
      return { type: 'card', card: data as unknown as Card };
    case 'error':
      return { type: 'error', code: (data.code as string) ?? (data.error as string) ?? 'error' };
    case 'debug_context':
      return { type: 'debug_context', data };
    case 'debug_tool_call':
      return { type: 'debug_tool_call', data };
    case 'debug_tool_result':
      return { type: 'debug_tool_result', data };
    default:
      // Evento desconocido (p.ej. 'dashboard'): pasa como custom; useConversation lo rutea
      // a config.onEvent sin renderizarlo.
      return { type: 'custom', name: raw.event, payload: data };
  }
}

export function createApiClient(config: AiChatConfig, getToken: TokenGetter, fetchImpl: FetchFn = fetch) {
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

  async function ensureOk(res: Response): Promise<Response> {
    if (res.ok) return res;
    throw new ApiError(res.status, codeForStatus(res.status));
  }

  return {
    async createConversation(): Promise<{ id: string }> {
      const res = await ensureOk(
        await fetchImpl(`${config.baseUrl}/v1/conversations`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ agent_id: config.agentId, ...(config.kind ? { kind: config.kind } : {}) }),
        }),
      );
      return res.json() as Promise<{ id: string }>;
    },
    async listConversations(): Promise<ConversationSummary[]> {
      const res = await ensureOk(
        await fetchImpl(`${config.baseUrl}/v1/conversations`, {
          headers: authHeaders(),
        }),
      );
      return res.json() as Promise<ConversationSummary[]>;
    },
    async listMessages(conversationId: string): Promise<Message[]> {
      const res = await ensureOk(
        await fetchImpl(`${config.baseUrl}/v1/conversations/${conversationId}/messages`, {
          headers: authHeaders(),
        }),
      );
      return res.json() as Promise<Message[]>;
    },
    async *streamMessage(conversationId: string, content: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
      const pageContext = config.getPageContext?.();
      const res = await fetchImpl(`${config.baseUrl}/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content, ...(pageContext !== undefined ? { page_context: pageContext } : {}) }),
        signal,
      });
      if (!res.ok) throw new ApiError(res.status, codeForStatus(res.status));
      if (!res.body) throw new ApiError(0, 'no_stream');
      for await (const raw of parseSse(res.body, signal)) {
        const ev = toChatEvent(raw);
        if (ev) yield ev;
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
