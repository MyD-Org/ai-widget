import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ConversationSummary } from '../types';
import type { Labels } from './labels';
import type { HistoryStatus } from '../hooks/useConversation';
import { filterConversations, groupConversations } from './conversationGroups';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function ConversationMenu({
  open,
  labels,
  conversations,
  status,
  currentId,
  triggerRef,
  onSelect,
  onNew,
  onRetry,
  onClose,
}: {
  open: boolean;
  labels: Labels;
  conversations: ConversationSummary[];
  status: HistoryStatus;
  currentId: string | null;
  /** Botón del header que abre el menú: se excluye del click-outside para que no se cierre
   *  y se reabra en el mismo click. */
  triggerRef: RefObject<HTMLButtonElement>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // El buscador arranca limpio en cada apertura (filtrar es una acción del momento, no un
  // estado que valga la pena recordar) y toma el foco para poder tipear directo.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    searchRef.current?.focus();
  }, [open]);

  // Escape cierra y devuelve el foco al botón que abrió; click afuera solo cierra.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
      triggerRef.current?.focus();
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose, triggerRef]);

  const groups = useMemo(
    () => groupConversations(filterConversations(conversations, query, labels), labels),
    [conversations, query, labels],
  );

  const ready = status === 'ready';
  const isEmpty = ready && conversations.length === 0;
  const noResults = ready && conversations.length > 0 && groups.length === 0;
  // Sin conversaciones no hay nada que filtrar: el buscador solo estorbaría.
  const showSearch = ready && conversations.length > 0;

  return (
    <div
      ref={menuRef}
      className={`aichat-menu ${open ? 'aichat-menu-open' : ''}`}
      role="dialog"
      aria-label={labels.historyLabel}
      aria-hidden={!open}
    >
      <button type="button" className="aichat-menu-new" onClick={onNew}>
        <PlusIcon />
        {labels.historyNewLabel}
      </button>

      {showSearch && (
        <div className="aichat-menu-search-wrap">
          <div className="aichat-menu-search">
            <SearchIcon />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder={labels.historySearchPlaceholder}
              aria-label={labels.historySearchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="aichat-menu-list">
        {status === 'loading' && (
          <div className="aichat-menu-skeleton" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aichat-menu-skeleton-row">
                <i className="aichat-sk aichat-sk-title" />
                <i className="aichat-sk aichat-sk-meta" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="aichat-menu-error-wrap">
            <div className="aichat-error">{labels.historyError}</div>
            <button type="button" className="aichat-menu-retry" onClick={onRetry}>
              <RetryIcon />
              {labels.historyRetry}
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="aichat-menu-empty">
            <span className="aichat-menu-empty-icon" aria-hidden="true">
              <ChatIcon />
            </span>
            <span className="aichat-menu-empty-title">{labels.historyEmpty}</span>
          </div>
        )}

        {noResults && <div className="aichat-menu-noresults">{labels.historyNoResults}</div>}

        {groups.map((g) => (
          <div key={g.key} className="aichat-menu-group">
            <span className="aichat-menu-group-label">{g.label}</span>
            {g.items.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`aichat-menu-row ${c.id === currentId ? 'aichat-menu-row-active' : ''}`}
                aria-current={c.id === currentId ? 'true' : undefined}
                onClick={() => onSelect(c.id)}
              >
                <span className="aichat-menu-row-texts">
                  <span className="aichat-menu-row-title">{c.title}</span>
                  <span className="aichat-menu-row-meta">{c.meta}</span>
                </span>
                {c.id === currentId && <i className="aichat-menu-row-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
