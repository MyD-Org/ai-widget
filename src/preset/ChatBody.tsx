import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useConversation } from '../hooks/useConversation';
import { labelForError, type Labels } from './labels';
import { Markdown } from './Markdown';
import type { Branding } from './branding';

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatBody({ branding, labels, showActivity }: { branding?: Branding; labels: Labels; showActivity: boolean }) {
  const { messages, status, activity, error, send } = useConversation();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const title = branding?.title ?? labels.headerTitle;
  const streaming = status === 'streaming';
  const lastIsUser = messages[messages.length - 1]?.role === 'user';
  const showActivityChip = streaming && showActivity && Boolean(activity);

  // Autoscroll al fondo cuando llegan mensajes o cambia el estado de streaming.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, activity]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft('');
  };

  return (
    <div className="aichat-panel">
      <div className="aichat-header">
        {branding?.avatarUrl ? (
          <img className="aichat-avatar" src={branding.avatarUrl} alt="" />
        ) : (
          <span className="aichat-avatar aichat-avatar-fallback" aria-hidden="true">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="aichat-header-titles">
          <span className="aichat-title">{title}</span>
          <span className="aichat-status">
            <i className="aichat-status-dot" />
            {branding?.subtitle ?? labels.statusOnline}
          </span>
        </div>
      </div>

      <div className="aichat-log" ref={logRef}>
        {messages.length === 0 && !streaming && <div className="aichat-empty">{labels.emptyState}</div>}

        {messages.map((m) => (
          <div key={m.id} className={`aichat-msg aichat-msg-${m.role}`}>
            {m.role === 'assistant' ? <Markdown>{m.text}</Markdown> : m.text}
          </div>
        ))}

        {showActivityChip && (
          <div className="aichat-typing">
            <span className="aichat-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="aichat-activity-text">{activity!.tool}…</span>
          </div>
        )}
        {streaming && lastIsUser && !showActivityChip && (
          <div className="aichat-typing">
            <span className="aichat-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      {error && <div className="aichat-error">{labelForError(error.code, labels)}</div>}

      <form className="aichat-form" onSubmit={onSubmit}>
        <input
          className="aichat-input"
          value={draft}
          placeholder={labels.placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="aichat-send"
          type="submit"
          aria-label={labels.sendLabel}
          disabled={streaming || draft.trim() === ''}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
