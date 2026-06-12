import type { Card as CardType, CardAction, BudgetCard } from '../types';

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

function CardActions({ actions }: { actions: CardAction[] }) {
  const usable = (actions ?? []).filter((a) => a.url);
  if (usable.length === 0) return null;
  return (
    <div className="aichat-card-actions">
      {usable.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          download={a.download || undefined}
          className={`aichat-action aichat-action-${a.style ?? 'default'}`}
        >
          <ActionIcon name={a.icon} />
          {a.label}
        </a>
      ))}
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
              {l.amount && <span className="aichat-card-amount">{l.amount}</span>}
            </div>
          ))}
        </div>
      )}
      {card.total && (
        <div className="aichat-card-total">
          <span>{card.total.label}</span>
          <span>{card.total.amount}</span>
        </div>
      )}
    </>
  );
}

export function Card({ card }: { card: CardType }) {
  return (
    <div className="aichat-card">
      {card.type === 'budget' && <BudgetBody card={card} />}
      <CardActions actions={card.actions} />
    </div>
  );
}
