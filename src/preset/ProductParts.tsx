import type { Labels } from './labels';

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function CartIcon() {
  return (
    <svg {...icon}>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.76L20 8H6.2" {...stroke} />
      <circle cx="9.5" cy="20" r="1" fill="currentColor" />
      <circle cx="17" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...icon}>
      <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...icon}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" {...stroke} />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg {...icon}>
      <path d="M5 12h14" {...stroke} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...icon}>
      <path d="M12 5v14M5 12h14" {...stroke} />
    </svg>
  );
}

// Como el catálogo: enteros limpios ("$ 14.990") y, con centavos, los dos dígitos en superíndice
// ("$ 1.244⁰⁷"). Sin grupos raros por locale: el separador de miles es siempre el punto.
export function ProductPrice({ value }: { value: number }) {
  const cents = Math.round(value * 100) % 100;
  const whole = Math.floor(Math.abs(Math.round(value * 100)) / 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (
    <span className="aichat-product-price">
      {value < 0 ? '-' : ''}$ {grouped}
      {cents !== 0 && <sup className="aichat-product-cents">{String(Math.abs(cents)).padStart(2, '0')}</sup>}
    </span>
  );
}

// Contador "− cantidad +" del mismo alto que el botón Agregar (nada salta al agregar). Con 1
// unidad el "−" es un tacho que lo saca del carrito. `max` frena el "+", y se puede seguir
// bajando aunque el carrito ya supere el tope.
export function QuantityStepper({
  qty,
  max,
  disabled,
  animate,
  labels,
  describedBy,
  onChange,
}: {
  qty: number;
  max?: number;
  disabled?: boolean;
  animate?: boolean;
  labels: Labels;
  describedBy?: string;
  onChange: (qty: number) => void;
}) {
  const atMax = disabled || (max != null && qty >= max);
  return (
    <div
      className={`aichat-stepper${animate ? ' aichat-stepper-enter' : ''}`}
      role="group"
      aria-describedby={describedBy}
    >
      <button
        type="button"
        className="aichat-stepper-btn"
        aria-label={qty <= 1 ? labels.removeLabel : labels.decrementLabel}
        onClick={() => onChange(qty - 1)}
      >
        {qty <= 1 ? <TrashIcon /> : <MinusIcon />}
      </button>
      <span className="aichat-stepper-value" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="aichat-stepper-btn"
        aria-label={labels.incrementLabel}
        disabled={atMax}
        onClick={() => onChange(qty + 1)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
