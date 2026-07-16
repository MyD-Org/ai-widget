import { useState } from 'react';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { resolveLabels } from './labels';
import { brandingStyle } from './branding';
import { ChatBody } from './ChatBody';
import type { ChatPresetProps } from './ChatPanel';

export function ChatDrawer({ config, branding, labels, showActivity = false, className, enableCopy = false, enableNewConversation = false, onSendToChannel, onUseBudget, onUseMessage }: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  const [open, setOpen] = useState(false);
  const pos = branding?.launcherPosition ?? 'bottom-right';
  return (
    <div className={`aichat-root ${className ?? ''}`} style={brandingStyle(branding)}>
      {open && (
        <div className={`aichat-drawer aichat-drawer-${pos}`}>
          <AiChatProvider config={config}>
            <ChatBody
              branding={branding}
              labels={resolved}
              showActivity={showActivity}
              enableCopy={enableCopy}
              enableNewConversation={enableNewConversation}
              onSendToChannel={onSendToChannel}
              onUseBudget={onUseBudget}
              onUseMessage={onUseMessage}
            />
          </AiChatProvider>
        </div>
      )}
      <button
        type="button"
        aria-label={resolved.launcherAria}
        className={`aichat-launcher aichat-launcher-${pos}`}
        onClick={() => setOpen((o) => !o)}
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
