import { useEffect, useId, useRef, useState } from 'react';
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
import { formatArs, splitArs } from './budgetSerializer';
import { ProductCarousel } from './ProductCarousel';

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
): { products: Map<string, ResolvedProduct>; loading: boolean; complete: boolean } {
  const key = JSON.stringify(ids);
  const fnRef = useRef(resolveProducts);
  fnRef.current = resolveProducts;
  const hasResolver = typeof resolveProducts === 'function';
  // `ok`: el host respondió (aunque sea sin algunos ids). Distingue "no lo encontró" (el producto
  // no se vende) de "falló la consulta" (no sabemos nada y no hay que bloquear el botón).
  const [state, setState] = useState<{ key: string; products: Map<string, ResolvedProduct>; ok: boolean } | null>(null);

  useEffect(() => {
    const fn = fnRef.current;
    if (!fn) return;
    const requested = JSON.parse(key) as string[];
    if (requested.length === 0) return;
    let cancelled = false;
    const done = (products: Map<string, ResolvedProduct>, ok: boolean) => {
      if (!cancelled) setState({ key, products, ok });
    };
    let pending: Promise<ResolvedProduct[]>;
    try {
      pending = Promise.resolve(fn(requested));
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending
      .then((list) => {
        const products = new Map<string, ResolvedProduct>();
        if (!Array.isArray(list)) return done(products, false);
        {
          for (const p of list) {
            // El host puede devolver el id como número (ids de Alegra): normalizamos a string,
            // que es como viaja en la card.
            if (p && (typeof p.id === 'string' || typeof p.id === 'number') && typeof p.name === 'string') {
              products.set(String(p.id), p);
            }
          }
        }
        done(products, true);
      })
      .catch(() => done(new Map(), false));
    return () => {
      cancelled = true;
    };
  }, [key, hasResolver]);

  const current = state?.key === key ? state : null;
  return {
    products: current?.products ?? EMPTY,
    loading: hasResolver && !current,
    // Respuesta completa del host: un id que no vino es un producto que no se vende.
    complete: current?.ok === true,
  };
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

// Aviso de stock bajo: solo con un `stock` entero de 1 a 5 (sin dato, no se inventa uno).
function stockNote(stock: number | undefined, labels: Labels): string | undefined {
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 1 || stock > 5) return undefined;
  return stock === 1 ? labels.stockOneLabel : labels.stockFewLabel.replace('{n}', String(stock));
}

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2.5 3.5h2.7l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

// "$ 1.244⁰⁷": los centavos van chicos y en superíndice. El texto completo queda para lectores
// de pantalla (el visual va aria-hidden: "1.244 07" se leería como dos números).
function ProductPrice({ value }: { value: number }) {
  const { whole, cents, text } = splitArs(value);
  return (
    <span className="aichat-product-price">
      <span aria-hidden="true">
        {`$\u00a0${whole}`}
        {cents && <sup className="aichat-product-cents">{cents}</sup>}
      </span>
      <span className="aichat-sr-only">{text}</span>
    </span>
  );
}

// Cantidad en el carrito del host: entero > 0 o nada.
function cartQty(map: Record<string, number> | undefined, id: string): number {
  const n = map?.[id];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function ProductItem({
  itemId,
  label,
  product,
  complete,
  commerce,
  labels,
}: {
  itemId: string;
  label: string;
  product?: ResolvedProduct;
  complete: boolean;
  commerce?: CommerceCallbacks;
  labels: Labels;
}) {
  const nameId = useId();
  // "Agregado" solo se usa sin contador (modo 0.5.x): con contador lo dice el propio contador.
  const [added, setAdded] = useState(false);
  // El contador solo anima si lo provoca un clic en "Agregar": uno que ya estaba en el carrito
  // al cargar la card aparece quieto.
  const [animateIn, setAnimateIn] = useState(false);
  const { onAddProducts: onAdd, onOpenProduct: onOpen, onSetQuantity, cartQuantities } = commerce ?? {};
  const stepper = onSetQuantity != null && cartQuantities != null;
  const qty = stepper ? cartQty(cartQuantities, itemId) : 0;

  const name = product?.name || label;
  const img = safeImageSrc(product?.imageUrl);
  const price = displayPrice(product);
  // Sin el producto en una respuesta completa del host, "Agregar" no haría nada (el Shop no
  // puede cargar algo que no vende): se muestra como no disponible.
  const unavailable = product?.available === false || (complete && !product);
  // Resuelto pero sin precio: tampoco se vende (el Shop no lo deja entrar al carrito).
  const blocked = unavailable || (product != null && price == null);
  const stock = unavailable ? undefined : stockNote(product?.stock, labels);
  const sku = product?.sku?.trim();
  const max =
    typeof product?.maxQuantity === 'number' && product.maxQuantity >= 1 ? Math.floor(product.maxQuantity) : Infinity;
  // Bloqueado o ya pasado del tope: no se suma más, pero sí se puede bajar.
  const canIncrement = !blocked && qty < max;

  return (
    <article className="aichat-product">
      <div className="aichat-product-media">
        {img && <img className="aichat-product-img" src={img} alt={name} loading="lazy" />}
      </div>
      <div className="aichat-product-body">
        {product?.brand && <span className="aichat-product-brand">{product.brand}</span>}
        <span id={nameId} className="aichat-product-name">
          {onOpen ? (
            // Enlace estirado: el ::after cubre toda la card, así hay un solo elemento
            // interactivo por card para abrir la ficha (los botones de abajo quedan por encima).
            <button type="button" className="aichat-product-open" onClick={() => onOpen(itemId)}>
              {name}
            </button>
          ) : (
            name
          )}
        </span>
        {sku && <span className="aichat-product-code">{`${labels.codeLabel} ${sku}`}</span>}
        {unavailable && <span className="aichat-tag">{labels.unavailableLabel}</span>}
        {(price != null || stock) && (
          <div className="aichat-product-pricerow">
            {price != null && <ProductPrice value={price} />}
            {stock && <span className="aichat-stock-low">{stock}</span>}
          </div>
        )}
        {qty > 0 ? (
          <div className={`aichat-qty${animateIn ? ' aichat-qty-enter' : ''}`}>
            <button
              type="button"
              className="aichat-qty-btn"
              aria-label={qty === 1 ? labels.removeLabel : labels.decrementLabel}
              aria-describedby={nameId}
              onClick={() => onSetQuantity?.(itemId, qty - 1)}
            >
              {qty === 1 ? <TrashIcon /> : '\u2212'}
            </button>
            <span className="aichat-qty-value" role="status">
              {qty}
            </span>
            <button
              type="button"
              className="aichat-qty-btn"
              aria-label={labels.incrementLabel}
              aria-describedby={nameId}
              disabled={!canIncrement}
              onClick={() => onSetQuantity?.(itemId, qty + 1)}
            >
              +
            </button>
          </div>
        ) : (
          onAdd && (
            <button
              type="button"
              className="aichat-product-add"
              aria-describedby={nameId}
              disabled={blocked || (!stepper && added)}
              onClick={() => {
                onAdd([{ id: itemId, qty: 1 }]);
                if (stepper) setAnimateIn(true);
                else setAdded(true);
              }}
            >
              {!added && <CartIcon />}
              {added && !stepper ? labels.addedLabel : labels.addLabel}
            </button>
          )
        )}
      </div>
    </article>
  );
}

function ProductsBody({ card, commerce, labels }: { card: ProductsCard; commerce?: CommerceCallbacks; labels: Labels }) {
  const { products, loading, complete } = useResolvedProducts(
    card.items.map((i) => i.id),
    commerce?.resolveProducts,
  );

  const cards = card.items.map((item, i) => (
    <ProductItem
      key={i}
      itemId={item.id}
      label={item.label}
      product={products.get(item.id)}
      complete={complete}
      commerce={commerce}
      labels={labels}
    />
  ));

  return (
    <div className="aichat-card aichat-sales aichat-products" aria-busy={loading || undefined}>
      {card.title && <h4 className="aichat-products-title">{card.title}</h4>}
      {/* Varios productos: carrusel. Uno solo: la card sola, sin carrusel. */}
      {cards.length > 1 ? (
        <ProductCarousel label={labels.carouselLabel} prevLabel={labels.carouselPrev} nextLabel={labels.carouselNext}>
          {cards}
        </ProductCarousel>
      ) : (
        <div className="aichat-product-single">{cards}</div>
      )}
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
