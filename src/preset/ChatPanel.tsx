import type { AiChatConfig, BudgetCard } from '../types';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { resolveLabels, type Labels } from './labels';
import { brandingStyle, type Branding } from './branding';
import { ChatBody } from './ChatBody';

export interface ChatPresetProps {
  config: AiChatConfig;
  branding?: Branding;
  labels?: Partial<Labels>;
  showActivity?: boolean;
  className?: string;
  /** Muestra un botón "Copiar" en cada respuesta del asistente (copia el texto al portapapeles).
   *  Pensado para el copiloto del operador en el admin del CRM. Default: false. Ver ADR 0007. */
  enableCopy?: boolean;
  /** Muestra el botón "Nueva conversación" en el header (ícono de recarga) que reinicia el chat.
   *  Opt-in: por defecto el botón no se renderiza. Default: false. */
  enableNewConversation?: boolean;
  /** Muestra el botón de historial en el header (ícono de lista) que abre el menú de
   *  conversaciones: permite abrir una conversación anterior o arrancar una nueva. Requiere
   *  que el backend exponga GET /v1/conversations para el end-user. Opt-in. Default: false.
   *  No tiene efecto con `config.conversationId` (el host dicta el hilo). */
  enableHistory?: boolean;
  /** Callback del host para la acción "Enviar al canal" de las budget cards: recibe el texto
   *  serializado de la card y lo prefila en el compose del CRM (no auto-envía). Opcional. */
  onSendToChannel?: (text: string) => void;
  /** Callback del host para "usar" una budget card como DATO ESTRUCTURADO (no texto): recibe
   *  la card completa (líneas con qty/unitPrice/materialId) para precargar un editor del host
   *  (p.ej. el editor de presupuestos de avantec). Si está presente, cada budget card muestra
   *  un botón extra (label: labels.useBudgetLabel). Opcional. */
  onUseBudget?: (card: BudgetCard) => void;
  /** Callback del host para el botón "Copiar" de cada respuesta del asistente (requiere
   *  enableCopy). Si está presente, en vez de copiar al portapapeles la acción del botón pasa
   *  a llamar a este callback con el texto (ya convertido a formato WhatsApp). Se usa en el
   *  copiloto del CRM para insertar la sugerencia directamente en el draft del operador; el
   *  label sigue siendo "Copiar" para no romper el reconocimiento visual. Opcional. */
  onUseMessage?: (text: string) => void;
  /** 'card' (default): panel flotante con borde/radio/sombra. 'dock': integrado a la vista
   *  (full-height, sin radio ni sombra, solo borde izquierdo) — p.ej. el dock del AI
   *  dashboard builder. */
  variant?: 'card' | 'dock';
}

export function ChatPanel({
  config,
  branding,
  labels,
  showActivity = false,
  className,
  enableCopy = false,
  enableNewConversation = false,
  enableHistory = false,
  onSendToChannel,
  onUseBudget,
  onUseMessage,
  variant = 'card',
}: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  return (
    <div
      className={`aichat-root aichat-fill ${variant === 'dock' ? 'aichat-dock' : ''} ${className ?? ''}`}
      style={brandingStyle(branding)}
    >
      <AiChatProvider config={config}>
        <ChatBody
          branding={branding}
          labels={resolved}
          showActivity={showActivity}
          enableCopy={enableCopy}
          enableNewConversation={enableNewConversation}
          enableHistory={enableHistory && !config.conversationId}
          onSendToChannel={onSendToChannel}
          onUseBudget={onUseBudget}
          onUseMessage={onUseMessage}
        />
      </AiChatProvider>
    </div>
  );
}
