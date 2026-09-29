import { useEffect, useRef, useState } from 'react';
import type {
  CartCard,
  CommerceCallbacks,
  HandoffCard,
  ProductsCard,
  RepliesCard,
  ResolvedProduct,
  SalesCard as SalesCardType,
} from '../types';
import type { Labels } from './labels';
import { formatArs } from './budgetSerializer';

type ResolveFn = CommerceCallbacks['resolveProducts'];

// La foto la manda el host, pero igual filtramos el esquema: una card no debería poder colar
// un `javascript:` o un `data:` arbitrario en el DOM aunque el host tenga un bug.
const SAFE_IMG_SCHEMES = new Set(['http:', 'https:']);
function safeImageSrc(url?: string): string | undefined {
  if (!url) return undefined;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  try {
    const u = new URL(url, base);
    return SAFE_IMG_SCHEMES.has(u.protocol) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Precio "exhibible": solo un número finito > 0. Un $0 es un producto sin precio en la lista de
// quien mira (el Shop ni lo deja entrar al carrito), no un regalo: se trata como no resuelto.
function displayPrice(p?: ResolvedProduct): number | undefined {
  return p && typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0 ? p.price : undefined;
}

// Resuelve los ids de UNA card con el catálogo del host. Tres garantías:
// - Una sola llamada por card: el efecto depende del string de ids, no de la identidad del
//   callback. ChatBody re-renderiza en cada token del streaming y un host que pasa una arrow
//   inline dispararía un request por token.
// - Nunca tira: rechazo, excepción síncrona o respuesta que no es array → mapa vacío, y cada
//   fila cae al `label` del modelo sin precio ni foto.
// - Mientras carga, el mapa está vacío: se ven los labels (sin precio) y no hay spinner que
//   después haga saltar el layout.
export function useResolvedProducts(
  ids: string[],
  resolveProducts?: ResolveFn,
): { products: Map<string, ResolvedProduct>; loading: boolean } {
  const key = JSON.stringify(ids);
  const fnRef = useRef(resolveProducts);
  fnRef.current = resolveProducts;
  const hasResolver = typeof resolveProducts === 'function';
  const [state, setState] = useState<{ key: string; products: Map<string, ResolvedProduct> } | null>(null);

  useEffect(() => {
    const fn = fnRef.current;
    if (!fn) return;
    const requested = JSON.parse(key) as string[];
    if (requested.length === 0) return;
    let cancelled = false;
    const done = (products: Map<string, ResolvedProduct>) => {
      if (!cancelled) setState({ key, products });
    };
    let pending: Promise<ResolvedProduct[]>;
    try {
      pending = Promise.resolve(fn(requested));
    } catch {
      pending = Promise.resolve([]);
    }
    pending
      .then((list) => {
        const products = new Map<string, ResolvedProduct>();
        if (Array.isArray(list)) {
          for (const p of list) {
            // El host puede devolver el id como número (ids de Alegra): normalizamos a string,
            // que es como viaja en la card.
            if (p && (typeof p.id === 'string' || typeof p.id === 'number') && typeof p.name === 'string') {
              products.set(String(p.id), p);
            }
          }
        }
        done(products);
      })
      .catch(() => done(new Map()));
    return () => {
      cancelled = true;
    };
  }, [key, hasResolver]);

  const resolved = state?.key === key ? state.products : EMPTY;
  return { products: resolved, loading: hasResolver && state?.key !== key };
}

const EMPTY: Map<string, ResolvedProduct> = new Map();

function CardTitle({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="aichat-card-head">
      <span className="aichat-card-title">{title}</span>
    </div>
  );
}

function ProductsBody({ card, commerce, labels }: { card: ProductsCard; commerce?: CommerceCallbacks; labels: Labels }) {
  const { products, loading } = useResolvedProducts(
    card.items.map((i) => i.id),
    commerce?.resolveProducts,
  );
  // "Agregado" es por fila: agregar uno no debe marcar los demás.
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  const onAdd = commerce?.onAddProducts;
  const onOpen = commerce?.onOpenProduct;

  return (
    <div className="aichat-card aichat-sales aichat-products" aria-busy={loading || undefined}>
      <CardTitle title={card.title} />
      <div className="aichat-product-rows">
        {card.items.map((item, i) => {
          const p = products.get(item.id);
          const name = p?.name || item.label;
          const img = safeImageSrc(p?.imageUrl);
          const price = displayPrice(p);
          const unavailable = p?.available === false;
          const isAdded = added.has(i);
          return (
            <div key={i} className="aichat-product">
              {img && <img className="aichat-product-img" src={img} alt={name} loading="lazy" width={48} height={48} />}
              <div className="aichat-product-info">
                <span className="aichat-product-name">{name}</span>
                {p?.brand && <span className="aichat-product-brand">{p.brand}</span>}
                {item.reason && <span className="aichat-product-reason">{item.reason}</span>}
                {(price != null || unavailable) && (
                  <span className="aichat-product-meta">
                    {price != null && <span className="aichat-card-amount">{formatArs(price)}</span>}
                    {unavailable && <span className="aichat-tag">{labels.unavailableLabel}</span>}
                  </span>
                )}
              </div>
              {(onAdd || onOpen) && (
                <div className="aichat-product-actions">
                  {onAdd && (
                    <button
                      type="button"
                      className="aichat-mini aichat-mini-primary"
                      disabled={unavailable || isAdded}
                      onClick={() => {
                        onAdd([{ id: item.id, qty: 1 }]);
                        setAdded((s) => new Set(s).add(i));
                      }}
                    >
                      {isAdded ? labels.addedLabel : labels.addLabel}
                    </button>
                  )}
                  {onOpen && (
                    <button type="button" className="aichat-mini" onClick={() => onOpen(item.id)}>
                      {labels.viewProductLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CartBody({ card, commerce, labels }: { card: CartCard; commerce?: CommerceCallbacks; labels: Labels }) {
  const { products, loading } = useResolvedProducts(
    card.lines.map((l) => l.id),
    commerce?.resolveProducts,
  );
  const [added, setAdded] = useState(false);
  const onAdd = commerce?.onAddProducts;

  const priced = card.lines.map((l) => {
    const unit = displayPrice(products.get(l.id));
    return unit != null ? unit * l.qty : undefined;
  });
  // Total solo si TODAS las líneas tienen precio: un total parcial se leería como el total del
  // pedido y sería menor al real.
  const allPriced = priced.length > 0 && priced.every((x) => x != null);
  const total = allPriced ? priced.reduce<number>((s, x) => s + (x ?? 0), 0) : 0;

  return (
    <div className="aichat-card aichat-sales aichat-cart" aria-busy={loading || undefined}>
      <CardTitle title={card.title} />
      <div className="aichat-card-lines">
        {card.lines.map((l, i) => (
          <div key={i} className="aichat-card-line">
            <span>
              {`${l.qty}× `}
              {products.get(l.id)?.name || l.label}
            </span>
            {priced[i] != null && <span className="aichat-card-amount">{formatArs(priced[i] as number)}</span>}
          </div>
        ))}
      </div>
      {allPriced && (
        <div className="aichat-card-total">
          <span className="aichat-card-total-label">{labels.referenceTotalLabel}</span>
          <span>{formatArs(total)}</span>
        </div>
      )}
      {onAdd && (
        <div className="aichat-card-actions">
          <button
            type="button"
            className="aichat-action aichat-action-primary"
            disabled={added}
            onClick={() => {
              // Solo {id, qty}: precio, IVA y stock los recalcula el host (el carrito del Shop
              // no acepta otra cosa).
              onAdd(card.lines.map(({ id, qty }) => ({ id, qty })));
              setAdded(true);
            }}
          >
            {added ? labels.addedLabel : labels.addAllLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function RepliesBody({ card, onReply }: { card: RepliesCard; onReply?: (text: string) => void }) {
  // Sin onReply no hay nada que hacer con los botones: no se dibujan. ChatBody además solo lo
  // pasa para el último mensaje y fuera del streaming, así no quedan sugerencias viejas.
  if (!onReply || card.options.length === 0) return null;
  return (
    <div className="aichat-replies">
      {card.options.map((opt, i) => (
        <button key={i} type="button" className="aichat-reply" onClick={() => onReply(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

const PHONE_RE = /^[0-9]{8,15}$/;

function HandoffBody({ card, commerce, labels }: { card: HandoffCard; commerce?: CommerceCallbacks; labels: Labels }) {
  // Un teléfono fuera del contrato (solo dígitos, E.164 sin `+`) es config rota del tenant:
  // no ofrecemos un botón que lleve a un chat inexistente, ni con callback del host.
  const validPhone = PHONE_RE.test(card.phone ?? '');
  const onHandoff = commerce?.onHandoff;
  return (
    <div className="aichat-card aichat-sales aichat-handoff">
      <div className="aichat-card-lines">
        <p className="aichat-handoff-summary">{card.summary}</p>
      </div>
      {validPhone && (
        <div className="aichat-card-actions">
          {onHandoff ? (
            <button type="button" className="aichat-action aichat-action-whatsapp" onClick={() => onHandoff(card)}>
              {labels.handoffLabel}
            </button>
          ) : (
            <a
              className="aichat-action aichat-action-whatsapp"
              href={`https://wa.me/${card.phone}?text=${encodeURIComponent(card.summary)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {labels.handoffLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function SalesCard({
  card,
  commerce,
  onReply,
  labels,
}: {
  card: SalesCardType;
  commerce?: CommerceCallbacks;
  onReply?: (text: string) => void;
  labels: Labels;
}) {
  switch (card.type) {
    case 'products':
      return Array.isArray(card.items) ? <ProductsBody card={card} commerce={commerce} labels={labels} /> : null;
    case 'cart':
      return Array.isArray(card.lines) ? <CartBody card={card} commerce={commerce} labels={labels} /> : null;
    case 'replies':
      return Array.isArray(card.options) ? <RepliesBody card={card} onReply={onReply} /> : null;
    case 'handoff':
      return <HandoffBody card={card} commerce={commerce} labels={labels} />;
    default:
      return null;
  }
}
