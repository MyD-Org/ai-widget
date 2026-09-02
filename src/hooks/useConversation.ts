import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type ConversationSummary, type Message } from '../types';
import { useAiChatContext } from './AiChatProvider';

export type Status = 'idle' | 'streaming' | 'error';
/** Estado de la carga del listado del historial (GET /v1/conversations), independiente del
 *  `Status` del streaming: el listado puede estar fallando con el chat andando bien. */
export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';
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
  /** Id de la conversación abierta, o null mientras todavía no se creó ninguna (el backend
   *  la crea recién con el primer mensaje). Lo usa el historial para marcar la fila activa. */
  currentId: string | null;
  conversations: ConversationSummary[];
  conversationsStatus: HistoryStatus;
  /** Trae el listado del historial. Se llama al abrir el menú (y al reintentar tras un
   *  error), no en el mount: si el usuario nunca abre el historial no gastamos el request. */
  loadConversations: () => void;
  /** Abre una conversación existente: cambia el id activo y carga su historial de mensajes. */
  openConversation: (id: string) => void;
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
  // Espejo en estado del id de convIdRef: el ref maneja el flujo del streaming (sin re-render),
  // pero el historial necesita re-renderizar para marcar la fila activa.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsStatus, setConversationsStatus] = useState<HistoryStatus>('idle');

  // Con conversationId pre-creado (copiloto del operador, ADR 0007) el host dicta el id, así que
  // no persistimos en sessionStorage por agentId (evita pisar un contacto con otro). Default 'none'.
  const preCreatedId = config.conversationId;
  const persist = preCreatedId ? config.persist === 'session' : config.persist !== 'none';

  // Conversación pre-creada: sembramos el id y cargamos su historial (no se crea ninguna). Se
  // re-corre si cambia el id (p. ej. el operador cambia de contacto en el inbox del CRM).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!preCreatedId || !session.ready) return;
    // Solo recargamos cuando CAMBIA el id. Si el host re-renderiza (y recrea config/client),
    // repisar el estado local borraría el mensaje optimista en pleno streaming y las cards.
    if (loadedFor.current === preCreatedId) return;
    loadedFor.current = preCreatedId;
    convIdRef.current = preCreatedId;
    setCurrentId(preCreatedId);
    client.listMessages(preCreatedId).then(setMessages).catch(() => setMessages([]));
  }, [preCreatedId, session.ready, client]);

  // Resume from sessionStorage on mount once the session is ready.
  useEffect(() => {
    if (preCreatedId || !persist || !session.ready) return;
    const saved = sessionStorage.getItem(storageKey(config.agentId));
    if (!saved || convIdRef.current) return;
    convIdRef.current = saved;
    setCurrentId(saved);
    client
      .listMessages(saved)
      .then(setMessages)
      .catch(() => {
        sessionStorage.removeItem(storageKey(config.agentId));
        convIdRef.current = null;
        setCurrentId(null);
      });
  }, [preCreatedId, persist, session.ready, config.agentId, client]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (convIdRef.current) return convIdRef.current;
    // Con conversationId pre-creado nunca se crea una conversación nueva.
    if (preCreatedId) {
      convIdRef.current = preCreatedId;
      setCurrentId(preCreatedId);
      return preCreatedId;
    }
    const { id } = await client.createConversation();
    convIdRef.current = id;
    setCurrentId(id);
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
        } else if (ev.type === 'custom') {
          // Evento que el chat no renderiza (p.ej. 'dashboard'): lo consume el host.
          config.onEvent?.(ev.name, ev.payload);
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
    setCurrentId(null);
    if (persist) sessionStorage.removeItem(storageKey(config.agentId));
    setMessages([]);
    setStatus('idle');
    setActivity(null);
    setError(null);
  }, [persist, config.agentId]);

  const loadConversations = useCallback(() => {
    if (!session.ready) return;
    setConversationsStatus('loading');
    client
      .listConversations()
      .then((list) => {
        setConversations(list);
        setConversationsStatus('ready');
      })
      .catch(() => setConversationsStatus('error'));
  }, [client, session.ready]);

  const openConversation = useCallback(
    (id: string) => {
      if (id === convIdRef.current) return;
      convIdRef.current = id;
      lastSentRef.current = null;
      setCurrentId(id);
      if (persist) sessionStorage.setItem(storageKey(config.agentId), id);
      setMessages([]);
      setStatus('idle');
      setActivity(null);
      setError(null);
      client
        .listMessages(id)
        .then(setMessages)
        .catch(() => setError({ code: 'not_found' }));
    },
    [client, persist, config.agentId],
  );

  return {
    messages,
    status,
    activity,
    error,
    send,
    retry,
    reset,
    currentId,
    conversations,
    conversationsStatus,
    loadConversations,
    openConversation,
  };
}
