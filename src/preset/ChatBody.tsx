import { useState, type FormEvent } from 'react';
import { useConversation } from '../hooks/useConversation';
import { labelForError, type Labels } from './labels';
import type { Branding } from './branding';

export function ChatBody({ branding, labels, showActivity }: { branding?: Branding; labels: Labels; showActivity: boolean }) {
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
