export type Role = 'user' | 'assistant';

export interface CardAction {
  label: string;
  url: string;
  style?: 'primary' | 'whatsapp' | 'default';
  icon?: 'download' | 'whatsapp' | 'chat' | 'external';
  download?: boolean;
}

export interface BudgetCard {
  type: 'budget';
  title: string;
  subtitle?: string;
  lines: { label: string; qty?: number; amount?: string }[];
  total?: { label: string; amount: string };
  actions: CardAction[];
}

export type Card = BudgetCard;

export interface Message {
  id: string;
  role: Role;
  text: string;
  created_at?: string;
  card?: Card;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'card'; card: Card }
  | { type: 'done'; usage: unknown; rounds: number; stoppedByMaxRounds: boolean; stopReason: string }
  | { type: 'error'; code: string }
  | { type: 'debug_context'; data: unknown }
  | { type: 'debug_tool_call'; data: unknown }
  | { type: 'debug_tool_result'; data: unknown };

export interface AiChatConfig {
  baseUrl: string;
  agentId: string;
  fetchToken?: () => Promise<string>;
  token?: string;
  persist?: 'session' | 'none';
  /** Conversación pre-creada por el backend. Si se provee, el widget NO crea conversación
   *  (saltea POST /v1/conversations) y arranca con este id, cargando su historial. Lo usa el
   *  copiloto del operador en el admin del CRM (un hilo por contacto). Con conversationId, el
   *  default de `persist` pasa a 'none' (el host dicta el id). Ver ADR 0007 del platform. */
  conversationId?: string;
  /** Override del fetch (para tests, proxies o transportes mock). Default: global fetch. */
  fetch?: typeof fetch;
}

export type ErrorCode = 'auth' | 'not_found' | 'rate_limit' | string;

export class ApiError extends Error {
  constructor(public status: number, public code: ErrorCode, message?: string) {
    super(message ?? `API error ${status} (${code})`);
    this.name = 'ApiError';
  }
}
