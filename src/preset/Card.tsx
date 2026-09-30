import { useState } from 'react';
import type { Card as CardType, CardAction, BudgetCard, CommerceCallbacks } from '../types';
import { budgetCardToPlainText, budgetTotal, formatArs } from './budgetSerializer';
import { defaultLabels, type Labels } from './labels';
import { SalesCard } from './SalesCards';
import { safeHref } from './safeUrl';

// Una acción sin `kind` es un link (retrocompat).
function actionKind(a: CardAction): 'link' | 'copy' | 'send' {
  return a.kind ?? 'link';
}

function ActionIcon({ name }: { name?: CardAction['icon'] }) {
  if (!name) return null;
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
  if (name === 'download')
    return (
      <svg {...common}>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === 'whatsapp')
    return (
      <svg {...common}>
        <path
          d="M5.5 4.5h2a1 1 0 0 1 1 .85l.4 2.5a1 1 0 0 1-.3.9l-1 1a13 13 0 0 0 5.6 5.6l1-1a1 1 0 0 1 .9-.3l2.5.4a1 1 0 0 1 .85 1v2a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 4 6.1 1.5 1.5 0 0 1 5.5 4.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === 'chat')
    return (
      <svg {...common}>
        <path
          d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 4h6v6M20 4l-9 9M19 13v6H5V5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Acciones de la card. `link` navega (safeHref). `copy`/`send` invocan un callback del host con
// el texto serializado de ESTA card (no navegan). El estado "Copiado" es local por-card.
// `onUseBudget` es una acción DEL HOST (no viaja en el wire): si está presente se agrega un
// botón extra que entrega la card estructurada (líneas con qty/unitPrice/materialId).
function CardActions({
  card,
  onSendToChannel,
  onUseBudget,
  useBudgetLabel,
  copiedLabel,
}: {
  card: BudgetCard;
  onSendToChannel?: (text: string) => void;
  onUseBudget?: (card: BudgetCard) => void;
  useBudgetLabel?: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const actions = card.actions ?? [];

  const serialized = () => budgetCardToPlainText(card);

  const onCopy = () => {
    void navigator.clipboard?.writeText(serialized()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  type Rendered = { action: CardAction; kind: 'link' | 'copy' | 'send'; href?: string };
  // "Copiar" y "Enviar al canal" terminan en el mismo lugar (el compose del operador) cuando el
  // host cablea onSendToChannel: dejamos solo "Enviar al canal" para no duplicar la acción.
  const hasSend = onSendToChannel != null && actions.some((a) => actionKind(a) === 'send');
  const rendered = actions
    .map((action): Rendered | null => {
      const kind = actionKind(action);
      if (kind === 'link') {
        const href = safeHref('url' in action ? action.url : undefined);
        return href ? { action, kind, href } : null;
      }
      // send sin callback del host → no se muestra.
      if (kind === 'send' && !onSendToChannel) return null;
      if (kind === 'copy' && hasSend) return null;
      return { action, kind };
    })
    .filter((x): x is Rendered => x !== null);

  // Botón del host: usar la card estructurada (p.ej. precargar el editor de presupuestos).
  const useBudget = Boolean(onUseBudget);

  if (rendered.length === 0 && !useBudget) return null;

  return (
    <div className="aichat-card-actions">
      {useBudget && (
        <button
          type="button"
          onClick={() => onUseBudget?.(card)}
          className="aichat-action aichat-action-primary"
        >
          <ActionIcon name="external" />
          {useBudgetLabel ?? 'Usar en presupuesto'}
        </button>
      )}
      {rendered.map(({ action, kind, href }, i) => {
        if (kind === 'link') {
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              download={('download' in action && action.download) || undefined}
              className={`aichat-action aichat-action-${action.style ?? 'default'}`}
            >
              <ActionIcon name={action.icon} />
              {action.label}
            </a>
          );
        }
        const onClick = kind === 'copy' ? onCopy : () => onSendToChannel?.(serialized());
        const label = kind === 'copy' && copied ? copiedLabel : action.label;
        return (
          <button
            key={i}
            type="button"
            onClick={onClick}
            className={`aichat-action aichat-action-${action.style ?? 'default'}`}
          >
            <ActionIcon name={action.icon} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BudgetBody({ card }: { card: BudgetCard }) {
  return (
    <>
      <div className="aichat-card-head">
        <span className="aichat-card-title">{card.title}</span>
        {card.subtitle && <span className="aichat-card-subtitle">{card.subtitle}</span>}
      </div>
      {card.lines.length > 0 && (
        <div className="aichat-card-lines">
          {card.lines.map((l, i) => (
            <div key={i} className="aichat-card-line">
              <span>
                {l.qty ? `${l.qty}× ` : ''}
                {l.label}
              </span>
              {/* Preferimos el monto numérico formateado; fallback al string legacy. */}
              {l.subtotal != null ? (
                <span className="aichat-card-amount">{formatArs(l.subtotal)}</span>
              ) : (
                l.amount && <span className="aichat-card-amount">{l.amount}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* La tarjeta muestra exactamente lo que se envía: con un solo producto el Total sería su
          mismo precio repetido, así que solo aparece cuando hay más de una línea. */}
      {card.lines.length !== 1 && (
        <div className="aichat-card-total">
          <span>Total</span>
          <span>{formatArs(budgetTotal(card))}</span>
        </div>
      )}
    </>
  );
}

// Despacha por `type`. La budget card sigue exactamente como antes; las de venta viven en
// SalesCards.tsx. Un `type` desconocido no dibuja nada: el evento SSE `card` se castea sin
// validar y un widget viejo tiene que ignorar tipos nuevos (contrato sales-cards/v1).
export function Card({
  card,
  onSendToChannel,
  onUseBudget,
  useBudgetLabel,
  copiedLabel = 'Copiado',
  commerce,
  onReply,
  labels = defaultLabels,
  live = false,
}: {
  card: CardType;
  onSendToChannel?: (text: string) => void;
  onUseBudget?: (card: BudgetCard) => void;
  useBudgetLabel?: string;
  copiedLabel?: string;
  /** Acciones de comercio del host para las cards de venta (opt-in, ADR 0008). */
  commerce?: CommerceCallbacks;
  /** Envía una respuesta sugerida (card `replies`). Sin esto, la card no dibuja botones. */
  onReply?: (text: string) => void;
  /** Textos de las cards de venta. */
  labels?: Labels;
  /** La card llegó en vivo por SSE en esta sesión (no del historial). Solo así una card
   *  `catalog` puede navegar sola. */
  live?: boolean;
}) {
  if (card.type !== 'budget') {
    return <SalesCard card={card} commerce={commerce} onReply={onReply} labels={labels} live={live} />;
  }
  return (
    <div className="aichat-card">
      <BudgetBody card={card} />
      <CardActions
        card={card}
        onSendToChannel={onSendToChannel}
        onUseBudget={onUseBudget}
        useBudgetLabel={useBudgetLabel}
        copiedLabel={copiedLabel}
      />
    </div>
  );
}
