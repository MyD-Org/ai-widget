import { useCallback, useEffect, useRef, useState } from 'react';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { resolveLabels } from './labels';
import { brandingStyle, themeClass } from './branding';
import { ChatBody, type ChatRequest } from './ChatBody';
import type { ChatPresetProps } from './ChatPanel';

export interface ChatDrawerProps extends ChatPresetProps {
  /** Abierto/cerrado controlado por el host. Sin `open`, el drawer maneja su propio estado
   *  (como siempre) y `onOpenChange` solo avisa. */
  open?: boolean;
  /** Se llama cuando el widget quiere abrir o cerrar (launcher, `sendRequest`). */
  onOpenChange?: (open: boolean) => void;
  /** 'right': panel acoplado a la derecha, de alto completo (`--aichat-dock-width`, 400px por
   *  defecto). El host reserva el ancho en su layout. 'none' (default): drawer flotante. */
  dock?: 'none' | 'right';
  /** Pedido del host para enviar un mensaje del usuario (p.ej. "Conversar" desde el catálogo).
   *  Cada `id` nuevo (no vacío) abre el chat y envía `text` una sola vez, cuando la conversación
   *  está lista. Un `id` ya visto no se reenvía, ni al cerrar y volver a abrir. */
  sendRequest?: ChatRequest;
}

export function ChatDrawer({
  config,
  branding,
  labels,
  showActivity = false,
  className,
  enableCopy = false,
  enableHistory = false,
  theme = 'auto',
  onSendToChannel,
  onUseBudget,
  onUseMessage,
  commerce,
  open: openProp,
  onOpenChange,
  dock = 'none',
  sendRequest,
}: ChatDrawerProps) {
  const resolved = resolveLabels(labels);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const [expanded, setExpanded] = useState(false);
  const pos = branding?.launcherPosition ?? 'bottom-right';
  const docked = dock === 'right';

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openRef = useRef(open);
  openRef.current = open;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [controlled],
  );

  // El pedido pendiente vive acá y no en ChatBody: el cuerpo se desmonta al cerrar, y un
  // "ya enviado" guardado adentro se perdería (el mismo pedido se reenviaría al reabrir).
  const [pending, setPending] = useState<ChatRequest | null>(null);
  const lastRequestId = useRef<string | null>(null);
  const requestText = sendRequest?.text ?? '';
  const requestId = sendRequest?.id ?? '';
  useEffect(() => {
    if (!requestId || requestId === lastRequestId.current) return;
    lastRequestId.current = requestId;
    setPending({ id: requestId, text: requestText });
    if (!openRef.current) setOpen(true);
    // Solo un id nuevo dispara el pedido; el texto viaja con él.
  }, [requestId]);
  const onRequestSent = useCallback((id: string) => {
    setPending((p) => (p?.id === id ? null : p));
  }, []);

  const drawerClass = docked
    ? 'aichat-drawer aichat-drawer-dock aichat-dock'
    : `aichat-drawer aichat-drawer-${pos} ${expanded ? 'aichat-drawer-expanded' : ''}`;
  return (
    <div className={`aichat-root ${themeClass(theme)} ${className ?? ''}`} style={brandingStyle(branding)}>
      {open && (
        <div className={drawerClass}>
          <AiChatProvider config={config}>
            <ChatBody
              branding={branding}
              labels={resolved}
              showActivity={showActivity}
              enableCopy={enableCopy}
              enableHistory={enableHistory && !config.conversationId}
              expanded={expanded}
              onToggleExpand={docked ? undefined : () => setExpanded((e) => !e)}
              onSendToChannel={onSendToChannel}
              onUseBudget={onUseBudget}
              onUseMessage={onUseMessage}
              commerce={commerce}
              pendingRequest={pending}
              onRequestSent={onRequestSent}
            />
          </AiChatProvider>
        </div>
      )}
      <button
        type="button"
        aria-label={resolved.launcherAria}
        className={`aichat-launcher aichat-launcher-${pos}`}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
