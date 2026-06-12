import { useState, type FormEvent } from 'react';
import type { AiChatConfig } from '../types';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { useConversation } from '../hooks/useConversation';
import { resolveLabels, labelForError, type Labels } from './labels';
import { brandingStyle, type Branding } from './branding';

export interface ChatPresetProps {
  config: AiChatConfig;
  branding?: Branding;
  labels?: Partial<Labels>;
  showActivity?: boolean;
  className?: string;
}

function ChatBody({ branding, labels, showActivity }: { branding?: Branding; labels: Labels; showActivity: boolean }) {
  const { messages, status, activity, error, send } = useConversation();
  const [draft, setDraft] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft('');
  };

  return (
    <div className="aichat-panel">
      <div className="aichat-header">
        {branding?.avatarUrl && <img src={branding.avatarUrl} alt="" width={24} height={24} />}
        <span>{branding?.title ?? labels.headerTitle}</span>
      </div>
      <div className="aichat-log">
        {messages.map((m) => (
          <div key={m.id} className={`aichat-msg aichat-msg-${m.role}`}>
            {m.text}
          </div>
        ))}
        {showActivity && activity && <div className="aichat-activity">{activity.tool}…</div>}
      </div>
      {error && <div className="aichat-error">{labelForError(error.code, labels)}</div>}
      <form className="aichat-form" onSubmit={onSubmit}>
        <input
          className="aichat-input"
          value={draft}
          placeholder={labels.placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="aichat-send" type="submit" disabled={status === 'streaming'}>
          {labels.sendLabel}
        </button>
      </form>
    </div>
  );
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
