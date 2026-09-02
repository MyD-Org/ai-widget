import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useConversation } from '../hooks/useConversation';
import { labelForError, type Labels } from './labels';
import { Markdown } from './Markdown';
import { mdToWhatsApp } from './mdToWhatsApp';
import { Card } from './Card';
import { ConversationMenu } from './ConversationMenu';
import type { Branding } from './branding';
import type { BudgetCard } from '../types';

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

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
  enableHistory = false,
  expanded = false,
  onToggleExpand,
  onSendToChannel,
  onUseBudget,
  onUseMessage,
}: {
  branding?: Branding;
  labels: Labels;
  showActivity: boolean;
  enableCopy?: boolean;
  enableNewConversation?: boolean;
  enableHistory?: boolean;
  /** Estado actual del panel expandido (solo relevante si onToggleExpand está presente). */
  expanded?: boolean;
  /** Si está presente, muestra un botón de expandir/contraer en el header que llama a este
   *  callback. Lo cablea el ChatDrawer (variante flotante); el dock no lo pasa. Opcional. */
  onToggleExpand?: () => void;
  onSendToChannel?: (text: string) => void;
  onUseBudget?: (card: BudgetCard) => void;
  onUseMessage?: (text: string) => void;
}) {
  const {
    messages,
    status,
    activity,
    error,
    send,
    reset,
    currentId,
    conversations,
    conversationsStatus,
    loadConversations,
    openConversation,
  } = useConversation();
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyBtnRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Si el usuario scrolleó hacia arriba, dejamos de autoscrollear para no "tironearlo" al fondo
  // en cada token del streaming. Vuelve a pegarse al fondo si baja hasta el final.
  const stickToBottom = useRef(true);

  const copyMessage = (id: string, text: string) => {
    // Formato WhatsApp para no dejar los `**` crudos ni aplanar el formato: aplica igual sea que
    // el destino final sea el portapapeles o el compose del CRM (que reenvía a WhatsApp).
    const rendered = mdToWhatsApp(text);
    const done = () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    };
    // Si el host cablea onUseMessage (copiloto del CRM), la acción del botón pasa a "insertar
    // en el draft del operador" en vez de ir al portapapeles. Mantenemos el label "Copiar" y el
    // feedback "Copiado" para no romper el reconocimiento visual.
    if (onUseMessage) {
      onUseMessage(rendered);
      done();
      return;
    }
    void navigator.clipboard?.writeText(rendered).then(done);
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
  // El scroll se habilita SOLO al tocar el techo: con una línea no hay nada que scrollear,
  // y dejarlo en 'auto' fijo hacía aparecer la barra con un par de caracteres.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const full = el.scrollHeight;
    el.style.height = `${Math.min(full, 120)}px`;
    el.style.overflowY = full > 120 ? 'auto' : 'hidden';
  }, [draft]);

  // El listado se pide en cada apertura: crear una conversación o renombrarla del lado del
  // backend deja stale lo que trajimos antes, y es un GET barato.
  const openHistory = () => {
    setHistoryOpen(true);
    loadConversations();
  };

  const selectConversation = (id: string) => {
    setHistoryOpen(false);
    openConversation(id);
  };

  const newConversation = () => {
    setHistoryOpen(false);
    reset();
    inputRef.current?.focus();
  };

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
        {(onToggleExpand || enableNewConversation || enableHistory) && (
          <div className="aichat-header-actions">
            {enableHistory && (
              <button
                ref={historyBtnRef}
                type="button"
                className={`aichat-new ${historyOpen ? 'aichat-new-on' : ''}`}
                onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
                aria-label={historyOpen ? labels.closeHistoryLabel : labels.historyLabel}
                aria-expanded={historyOpen}
                aria-haspopup="dialog"
                title={labels.historyLabel}
              >
                <HistoryIcon />
              </button>
            )}
            {onToggleExpand && (
              <button
                type="button"
                className="aichat-new aichat-expand"
                onClick={onToggleExpand}
                aria-label={expanded ? labels.collapse : labels.expand}
                aria-pressed={expanded}
                title={expanded ? labels.collapse : labels.expand}
              >
                {expanded ? (
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
                    <path d="M4 14h6v6" />
                    <path d="M20 10h-6V4" />
                    <path d="m14 10 7-7" />
                    <path d="m3 21 7-7" />
                  </svg>
                ) : (
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
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                )}
              </button>
            )}
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
        )}
      </div>

      {enableHistory && (
        <ConversationMenu
          open={historyOpen}
          labels={labels}
          conversations={conversations}
          status={conversationsStatus}
          currentId={currentId}
          triggerRef={historyBtnRef}
          onSelect={selectConversation}
          onNew={newConversation}
          onRetry={loadConversations}
          onClose={() => setHistoryOpen(false)}
        />
      )}

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
