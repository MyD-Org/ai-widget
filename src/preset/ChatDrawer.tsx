import { useState } from 'react';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { resolveLabels } from './labels';
import { brandingStyle } from './branding';
import { ChatBody } from './ChatBody';
import type { ChatPresetProps } from './ChatPanel';

export function ChatDrawer({ config, branding, labels, showActivity = false, className }: ChatPresetProps) {
  const resolved = resolveLabels(labels);
  const [open, setOpen] = useState(false);
  const pos = branding?.launcherPosition ?? 'bottom-right';
  return (
    <div className={`aichat-root ${className ?? ''}`} style={brandingStyle(branding)}>
      {open && (
        <div className={`aichat-drawer aichat-drawer-${pos}`}>
          <AiChatProvider config={config}>
            <ChatBody branding={branding} labels={resolved} showActivity={showActivity} />
          </AiChatProvider>
        </div>
      )}
      <button
        type="button"
        aria-label={resolved.launcherAria}
        className={`aichat-launcher aichat-launcher-${pos}`}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  );
}
