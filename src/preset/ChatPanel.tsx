import type { AiChatConfig } from '../types';
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
}

export function ChatPanel({ config, branding, labels, showActivity = false, className, enableCopy = false }: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  return (
    <div className={`aichat-root aichat-fill ${className ?? ''}`} style={brandingStyle(branding)}>
      <AiChatProvider config={config}>
        <ChatBody branding={branding} labels={resolved} showActivity={showActivity} enableCopy={enableCopy} />
      </AiChatProvider>
    </div>
  );
}
