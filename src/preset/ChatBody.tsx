import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useConversation } from '../hooks/useConversation';
import { labelForError, type Labels } from './labels';
import { Markdown } from './Markdown';
import { mdToWhatsApp } from './mdToWhatsApp';
import { Card } from './Card';
import type { Branding } from './branding';
import type { BudgetCard } from '../types';

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatBody({
  branding,
  labels,
  showActivity,
  enableCopy = false,
  enableNewConversation = false,
  onSendToChannel,
  onUseBudget,
}: {
  branding?: Branding;
  labels: Labels;
  showActivity: boolean;
  enableCopy?: boolean;
  enableNewConversation?: boolean;
  onSendToChannel?: (text: string) => void;
  onUseBudget?: (card: BudgetCard) => void;
}) {
  const { messages, status, activity, error, send, reset } = useConversation();
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Si el usuario scrolleó hacia arriba, dejamos de autoscrollear para no "tironearlo" al fondo
  // en cada token del streaming. Vuelve a pegarse al fondo si baja hasta el final.
  const stickToBottom = useRef(true);

  const copyMessage = (id: string, text: string) => {
    // El operador pega la respuesta en WhatsApp: convertimos el Markdown a su sintaxis
    // (*negrita*, _cursiva_, • viñetas…) para no copiar los `**` crudos ni aplanar el formato.
    void navigator.clipboard?.writeText(mdToWhatsApp(text)).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  };

  const title = branding?.title ?? labels.headerTitle;
  const streaming = status === 'streaming';
  const lastIsUser = messages[messages.length - 1]?.role === 'user';
  const showActivityChip = streaming && showActivity && Boolean(activity);

  // Autoscroll al fondo cuando llegan mensajes o cambia el estado de streaming, PERO solo si el
  // usuario ya está pegado al fondo. Si scrolleó hacia arriba a leer, no lo interrumpimos.
  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, activity]);

  // En cada scroll recalculamos si sigue "pegado" al fondo (con un margen de 80px de tolerancia).
  const onLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Auto-crece el textarea con el contenido (reset a 'auto' para poder achicar también).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = () => {
    send(draft);
    setDraft('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envía; Shift+Enter inserta salto de línea. Respeta IME (isComposing).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
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
        {enableNewConversation && (
        <button
          type="button"
          className="aichat-new"
          onClick={reset}
          disabled={streaming}
          aria-label={labels.newConversation}
          title={labels.newConversation}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        )}
      </div>

      <div className="aichat-log" ref={logRef} onScroll={onLogScroll}>
        {messages.length === 0 && !streaming && <div className="aichat-empty">{labels.emptyState}</div>}

        {messages.map((m) => (
          <Fragment key={m.id}>
            {(m.role === 'user' || m.text.trim() !== '') && (
              <div className={`aichat-msg aichat-msg-${m.role}`}>
                {m.role === 'assistant' ? <Markdown>{m.text}</Markdown> : m.text}
                {enableCopy && m.role === 'assistant' && m.text.trim() !== '' && (
                  <button
                    type="button"
                    className="aichat-copy"
                    onClick={() => copyMessage(m.id, m.text)}
                  >
                    {copiedId === m.id ? labels.copiedLabel : labels.copyLabel}
                  </button>
                )}
              </div>
            )}
            {m.card && (
              <Card
                card={m.card}
                onSendToChannel={onSendToChannel}
                onUseBudget={onUseBudget}
                useBudgetLabel={labels.useBudgetLabel}
                copiedLabel={labels.copiedLabel}
              />
            )}
          </Fragment>
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
        <textarea
          ref={inputRef}
          className="aichat-input"
          rows={1}
          value={draft}
          placeholder={labels.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
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
