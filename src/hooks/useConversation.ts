import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type Message } from '../types';
import { useAiChatContext } from './AiChatProvider';

export type Status = 'idle' | 'streaming' | 'error';
export interface Activity {
  tool: string;
}

export interface UseConversation {
  messages: Message[];
  status: Status;
  activity: Activity | null;
  error: { code: string } | null;
  send: (text: string) => void;
  retry: () => void;
  reset: () => void;
}

const storageKey = (agentId: string) => `aichat:conv:${agentId}`;
let idCounter = 0;
const localId = () => `local-${++idCounter}`;

export function useConversation(): UseConversation {
  const { config, client, session } = useAiChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<{ code: string } | null>(null);
  const convIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<string | null>(null);

  // Con conversationId pre-creado (copiloto del operador, ADR 0007) el host dicta el id, así que
  // no persistimos en sessionStorage por agentId (evita pisar un contacto con otro). Default 'none'.
  const preCreatedId = config.conversationId;
  const persist = preCreatedId ? config.persist === 'session' : config.persist !== 'none';

  // Conversación pre-creada: sembramos el id y cargamos su historial (no se crea ninguna). Se
  // re-corre si cambia el id (p. ej. el operador cambia de contacto en el inbox del CRM).
  useEffect(() => {
    if (!preCreatedId || !session.ready) return;
    convIdRef.current = preCreatedId;
    client.listMessages(preCreatedId).then(setMessages).catch(() => setMessages([]));
  }, [preCreatedId, session.ready, client]);

  // Resume from sessionStorage on mount once the session is ready.
  useEffect(() => {
    if (preCreatedId || !persist || !session.ready) return;
    const saved = sessionStorage.getItem(storageKey(config.agentId));
    if (!saved || convIdRef.current) return;
    convIdRef.current = saved;
    client
      .listMessages(saved)
      .then(setMessages)
      .catch(() => {
        sessionStorage.removeItem(storageKey(config.agentId));
        convIdRef.current = null;
      });
  }, [preCreatedId, persist, session.ready, config.agentId, client]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (convIdRef.current) return convIdRef.current;
    // Con conversationId pre-creado nunca se crea una conversación nueva.
    if (preCreatedId) {
      convIdRef.current = preCreatedId;
      return preCreatedId;
    }
    const { id } = await client.createConversation();
    convIdRef.current = id;
    if (persist) sessionStorage.setItem(storageKey(config.agentId), id);
    return id;
  }, [client, persist, config.agentId, preCreatedId]);

  const runStream = useCallback(
    async (conversationId: string, content: string) => {
      let assistant: Message | null = null;
      const ensureAssistant = (): Message => {
        if (!assistant) {
          assistant = { id: localId(), role: 'assistant', text: '' };
          const created = assistant;
          setMessages((m) => [...m, created]);
        }
        return assistant;
      };
      for await (const ev of client.streamMessage(conversationId, content)) {
        if (ev.type === 'text') {
          const a = ensureAssistant();
          a.text += ev.delta;
          const snapshot = a.text;
          const targetId = a.id;
          setMessages((m) => m.map((x) => (x.id === targetId ? { ...x, text: snapshot } : x)));
        } else if (ev.type === 'card') {
          let a = ensureAssistant();
          if (a.card) {
            // ya hay una tarjeta en este mensaje → abrir un mensaje nuevo
            const next: Message = { id: localId(), role: 'assistant', text: '' };
            setMessages((m) => [...m, next]);
            assistant = next;
            a = next;
          }
          a.card = ev.card;
          const targetId = a.id;
          const card = ev.card;
          setMessages((m) => m.map((x) => (x.id === targetId ? { ...x, card } : x)));
        } else if (ev.type === 'tool') {
          setActivity({ tool: ev.name });
        } else if (ev.type === 'error') {
          throw new ApiError(0, ev.code);
        } else if (ev.type === 'done') {
          setActivity(null);
        }
      }
    },
    [client],
  );

  const doSend = useCallback(
    async (text: string) => {
      setError(null);
      setStatus('streaming');
      setMessages((m) => [...m, { id: localId(), role: 'user', text }]);
      try {
        const conversationId = await ensureConversation();
        try {
          await runStream(conversationId, text);
        } catch (e) {
          if (e instanceof ApiError && e.code === 'auth') {
            await session.refresh();
            await runStream(conversationId, text);
          } else throw e;
        }
        setActivity(null);
        setStatus('idle');
      } catch (e) {
        setActivity(null);
        setStatus('error');
        setError({ code: e instanceof ApiError ? e.code : 'error' });
      }
    },
    [ensureConversation, runStream, session],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming') return;
      lastSentRef.current = trimmed;
      void doSend(trimmed);
    },
    [doSend, status],
  );

  const retry = useCallback(() => {
    if (lastSentRef.current) void doSend(lastSentRef.current);
  }, [doSend]);

  const reset = useCallback(() => {
    convIdRef.current = null;
    lastSentRef.current = null;
    if (persist) sessionStorage.removeItem(storageKey(config.agentId));
    setMessages([]);
    setStatus('idle');
    setActivity(null);
    setError(null);
  }, [persist, config.agentId]);

  return { messages, status, activity, error, send, retry, reset };
}
