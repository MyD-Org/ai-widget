import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AiChatConfig } from '../types';
import { createApiClient, type ApiClient } from '../client/apiClient';
import { useChatSession, type ChatSession } from './useChatSession';

interface AiChatContextValue {
  config: AiChatConfig;
  client: ApiClient;
  session: ChatSession;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ config, children }: { config: AiChatConfig; children: ReactNode }) {
  const session = useChatSession(config);
  const client = useMemo(
    () => createApiClient(config, session.getToken, config.fetch),
    [config, session.getToken],
  );
  const value = useMemo<AiChatContextValue>(() => ({ config, client, session }), [config, client, session]);
  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChatContext(): AiChatContextValue {
  const ctx = useContext(AiChatContext);
  if (!ctx) throw new Error('useConversation must be used inside <AiChatProvider>');
  return ctx;
}
