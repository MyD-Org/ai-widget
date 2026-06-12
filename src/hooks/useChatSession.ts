import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiChatConfig } from '../types';

export interface ChatSession {
  ready: boolean;
  getToken: () => string;
  refresh: () => Promise<string>;
}

export function useChatSession(config: AiChatConfig): ChatSession {
  const tokenRef = useRef<string>(config.token ?? '');
  const [ready, setReady] = useState<boolean>(Boolean(config.token));

  const refresh = useCallback(async (): Promise<string> => {
    if (config.token) {
      tokenRef.current = config.token;
      return config.token;
    }
    if (!config.fetchToken) throw new Error('useChatSession: provide fetchToken or a static token');
    const jwt = await config.fetchToken();
    tokenRef.current = jwt;
    return jwt;
  }, [config.token, config.fetchToken]);

  useEffect(() => {
    if (config.token) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void refresh().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [config.token, refresh]);

  const getToken = useCallback(() => tokenRef.current, []);
  return { ready, getToken, refresh };
}
