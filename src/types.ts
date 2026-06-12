export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  text: string;
  created_at?: string;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
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
