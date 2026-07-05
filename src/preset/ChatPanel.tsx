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
  /** Callback del host para la acción "Enviar al canal" de las budget cards: recibe el texto
   *  serializado de la card y lo prefila en el compose del CRM (no auto-envía). Opcional. */
  onSendToChannel?: (text: string) => void;
  /** Callback del host para "usar" una budget card como DATO ESTRUCTURADO (no texto): recibe
   *  la card completa (líneas con qty/unitPrice/materialId) para precargar un editor del host
   *  (p.ej. el editor de presupuestos de avantec). Si está presente, cada budget card muestra
   *  un botón extra (label: labels.useBudgetLabel). Opcional. */
  onUseBudget?: (card: BudgetCard) => void;
}

export function ChatPanel({
  config,
  branding,
  labels,
  showActivity = false,
  className,
  enableCopy = false,
  onSendToChannel,
  onUseBudget,
}: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  return (
    <div className={`aichat-root aichat-fill ${className ?? ''}`} style={brandingStyle(branding)}>
      <AiChatProvider config={config}>
        <ChatBody
          branding={branding}
          labels={resolved}
          showActivity={showActivity}
          enableCopy={enableCopy}
          onSendToChannel={onSendToChannel}
          onUseBudget={onUseBudget}
        />
      </AiChatProvider>
    </div>
  );
}
