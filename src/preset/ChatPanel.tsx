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
}

export function ChatPanel({ config, branding, labels, showActivity = false, className }: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  return (
    <div className={`aichat-root ${className ?? ''}`} style={brandingStyle(branding)}>
      <AiChatProvider config={config}>
        <ChatBody branding={branding} labels={resolved} showActivity={showActivity} />
      </AiChatProvider>
    </div>
  );
}
