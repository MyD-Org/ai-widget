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

// 503 y 401 mandan un motivo específico en el body ({error: '...'}); 404 y 429 se
// explican solos con el status. Clonamos por las dudas: si esto no es JSON válido,
// dejamos el body original intacto para quien llame después.
async function readErrorCode(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.clone().json()) as { error?: string; code?: string };
    return body?.code ?? body?.error ?? fallback;
  } catch {
    return fallback;
  }
}

// Un 401 tiene DOS causas que se resuelven distinto, y aplanarlas mandaba a la persona
// equivocada: si el token de sesión venció, recargar la página lo arregla; si la API key
// del host es inválida, recargar no cambia nada y hay que revisar la configuración.
// ai-api ya las distingue en el body — era el widget el que las juntaba.
const AUTH_CODES = new Set(['missing_session_token', 'invalid_session_token']);
const CONFIG_CODES = new Set(['missing_api_key', 'invalid_api_key']);

async function errorCodeFor(res: Response): Promise<string> {
  if (res.status === 503) return readErrorCode(res, 'http_error');
  if (res.status === 401) {
    const reason = await readErrorCode(res, 'auth');
    if (CONFIG_CODES.has(reason)) return 'config';
    if (AUTH_CODES.has(reason)) return 'auth';
    return 'auth'; // motivo desconocido: la sesión sigue siendo la causa más probable
  }
  return codeForStatus(res.status);
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
    throw new ApiError(res.status, await errorCodeFor(res));
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
      // ?agent_id= (soportado desde ai-api): cada widget lista SOLO sus conversaciones.
      // Sin el filtro el historial mezclaba las de todos los agentes del tenant.
      const res = await ensureOk(
        await fetchImpl(`${config.baseUrl}/v1/conversations?agent_id=${encodeURIComponent(config.agentId)}`, {
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
      if (!res.ok) throw new ApiError(res.status, await errorCodeFor(res));
      if (!res.body) throw new ApiError(0, 'no_stream');
      for await (const raw of parseSse(res.body, signal)) {
        const ev = toChatEvent(raw);
        if (ev) yield ev;
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
