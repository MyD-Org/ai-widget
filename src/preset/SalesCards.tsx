import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type {
  CartCard,
  CatalogCard,
  CommerceCallbacks,
  HandoffCard,
  ProductsCard,
  RepliesCard,
  ResolvedProduct,
  SalesCard as SalesCardType,
  SpecCard,
} from '../types';
import type { Labels } from './labels';
import { formatArs } from './budgetSerializer';
import { ProductCarousel } from './ProductCarousel';
import { CartIcon, CheckIcon, ProductPrice, QuantityStepper } from './ProductParts';
import { safeHttpUrl } from './safeUrl';
import { SheetContext } from './sheetContext';

type ResolveFn = CommerceCallbacks['resolveProducts'];

// La foto la manda el host, pero igual filtramos el esquema: una card no debería poder colar
// un `javascript:` o un `data:` arbitrario en el DOM aunque el host tenga un bug.
const safeImageSrc = safeHttpUrl;

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

function maxQuantity(p?: ResolvedProduct): number | undefined {
  return typeof p?.maxQuantity === 'number' ? p.maxQuantity : typeof p?.stock === 'number' ? p.stock : undefined;
}

// "Agregar" / contador de cantidad de UN producto (cards `products` y `spec`). "Agregado" es por
// producto y solo aplica cuando el host no informa el carrito (`cartQuantities`): con carrito,
// el botón pasa al contador. Sin `onAddProducts` no se dibuja nada (ADR 0008).
function ProductAddControl({
  id,
  product,
  unavailable,
  nameId,
  commerce,
  labels,
}: {
  id: string;
  product?: ResolvedProduct;
  unavailable: boolean;
  nameId: string;
  commerce?: CommerceCallbacks;
  labels: Labels;
}) {
  const [added, setAdded] = useState(false);
  // Solo se anima la aparición del contador cuando la provoca un clic acá.
  const [justAdded, setJustAdded] = useState(false);
  const onAdd = commerce?.onAddProducts;
  if (!onAdd) return null;
  const onSetQuantity = commerce?.onSetQuantity;
  const cartQuantities = commerce?.cartQuantities;
  const inCart = cartQuantities?.[id] ?? 0;
  const showStepper = Boolean(onSetQuantity) && inCart > 0;
  return (
    <div className="aichat-product-actions">
      {showStepper ? (
        <QuantityStepper
          qty={inCart}
          max={maxQuantity(product)}
          disabled={unavailable}
          animate={justAdded}
          labels={labels}
          describedBy={nameId}
          onChange={(n) => onSetQuantity?.(id, Math.max(0, n))}
        />
      ) : (
        <button
          type="button"
          className="aichat-add"
          aria-describedby={nameId}
          disabled={unavailable || (!cartQuantities && added)}
          onClick={() => {
            onAdd([{ id, qty: 1 }]);
            setAdded(true);
            setJustAdded(true);
          }}
        >
          <CartIcon />
          {!cartQuantities && added ? labels.addedLabel : labels.addLabel}
        </button>
      )}
    </div>
  );
}

function ProductsBody({ card, commerce, labels }: { card: ProductsCard; commerce?: CommerceCallbacks; labels: Labels }) {
  const { products, loading, complete } = useResolvedProducts(
    card.items.map((i) => i.id),
    commerce?.resolveProducts,
  );
  const uid = useId();
  const onOpen = commerce?.onOpenProduct;

  const cards = card.items.map((item, i) => {
    const p = products.get(item.id);
    const name = p?.name || item.label;
    const img = safeImageSrc(p?.imageUrl);
    const price = displayPrice(p);
    // Sin el producto en una respuesta completa del host, "Agregar" no haría nada (el
    // Shop no puede cargar algo que no vende): se muestra como no disponible.
    const unavailable = p?.available === false || (complete && !p);
    const stock = unavailable ? undefined : stockNote(p?.stock, labels);
    const nameId = `${uid}-name-${i}`;
    return (
      <article key={i} className="aichat-product" data-clickable={onOpen ? '' : undefined}>
        <div className="aichat-product-media">
          {img && <img className="aichat-product-img" src={img} alt="" loading="lazy" />}
        </div>
        <div className="aichat-product-body">
          {p?.brand && <span className="aichat-product-brand">{p.brand}</span>}
          {/* Enlace estirado: el nombre cubre toda la card (::after) y el botón de cantidad queda por
              encima. Es un botón porque la ficha la abre el host (onOpenProduct), no una URL. */}
          {onOpen ? (
            <button type="button" id={nameId} className="aichat-product-name aichat-product-open" onClick={() => onOpen(item.id)}>
              {name}
            </button>
          ) : (
            <span id={nameId} className="aichat-product-name">{name}</span>
          )}
          {(p?.code || p?.sku) && <span className="aichat-product-code">{labels.codeLabel} {p?.code || p?.sku}</span>}
          {(price != null || stock) && (
            <div className="aichat-product-priceline">
              {price != null && <ProductPrice value={price} />}
              {stock && <span className="aichat-stock-low">{stock}</span>}
            </div>
          )}
          {unavailable && <span className="aichat-tag">{labels.unavailableLabel}</span>}
          <ProductAddControl id={item.id} product={p} unavailable={unavailable} nameId={nameId} commerce={commerce} labels={labels} />
        </div>
      </article>
    );
  });

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

function SpecBody({ card, commerce, labels }: { card: SpecCard; commerce?: CommerceCallbacks; labels: Labels }) {
  const { products, loading, complete } = useResolvedProducts([card.id], commerce?.resolveProducts);
  const nameId = `${useId()}-name`;
  const p = products.get(card.id);
  const name = p?.name || card.label;
  const img = safeImageSrc(p?.imageUrl);
  const price = displayPrice(p);
  // Mismo criterio que `products`: sin el producto en una respuesta completa, no se vende.
  const unavailable = p?.available === false || (complete && !p);
  const stock = unavailable ? undefined : stockNote(p?.stock, labels);
  const code = p?.code || p?.sku;
  const attributes = Array.isArray(p?.attributes)
    ? p.attributes.filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    : [];
  const pdf = safeHttpUrl(p?.specUrl);
  const onOpen = commerce?.onOpenProduct;
  return (
    <div className="aichat-card aichat-sales aichat-spec" aria-busy={loading || undefined}>
      <article className="aichat-product aichat-spec-product">
        <div className="aichat-spec-top">
          <div className="aichat-product-media aichat-spec-media">
            {img && <img className="aichat-product-img" src={img} alt="" loading="lazy" />}
          </div>
          <div className="aichat-product-body aichat-spec-body">
            {p?.brand && <span className="aichat-product-brand">{p.brand}</span>}
            <span id={nameId} className="aichat-product-name">{name}</span>
            {code && <span className="aichat-product-code">{labels.codeLabel} {code}</span>}
            {(price != null || stock) && (
              <div className="aichat-product-priceline">
                {price != null && <ProductPrice value={price} />}
                {stock && <span className="aichat-stock-low">{stock}</span>}
              </div>
            )}
            {unavailable ? (
              <span className="aichat-tag">{labels.unavailableLabel}</span>
            ) : (
              p?.available === true && <span className="aichat-tag aichat-tag-ok">{labels.availableLabel}</span>
            )}
          </div>
        </div>
        {attributes.length > 0 && (
          <ul className="aichat-spec-attrs" aria-label={labels.specAttributesLabel}>
            {attributes.map((a, i) => (
              <li key={i} className="aichat-spec-attr">
                {a}
              </li>
            ))}
          </ul>
        )}
        {card.reason && <p className="aichat-spec-note">{card.reason}</p>}
        {(commerce?.onAddProducts || pdf || onOpen) && (
          <div className="aichat-spec-actions">
            <ProductAddControl id={card.id} product={p} unavailable={unavailable} nameId={nameId} commerce={commerce} labels={labels} />
            {(pdf || onOpen) && (
              <div className="aichat-spec-links">
                {pdf && (
                  <a className="aichat-mini" href={pdf} target="_blank" rel="noopener noreferrer">
                    {labels.specSheetLabel}
                  </a>
                )}
                {onOpen && (
                  <button type="button" className="aichat-mini" aria-describedby={nameId} onClick={() => onOpen(card.id)}>
                    {labels.viewProductLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

// Cards `catalog` que ya navegaron solas en esta página. Complementa el ref del componente: si la
// card se vuelve a montar (el host cambia de drawer a panel acoplado, p.ej.) no navega otra vez.
const autoNavigated = new WeakSet<CatalogCard>();

function CatalogBody({
  card,
  commerce,
  labels,
  live,
}: {
  card: CatalogCard;
  commerce?: CommerceCallbacks;
  labels: Labels;
  live: boolean;
}) {
  const commerceRef = useRef(commerce);
  commerceRef.current = commerce;
  const [applied, setApplied] = useState(false);
  // El undo vive con el componente: una card del historial (u otra sesión) nunca lo tiene.
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const decided = useRef(false);

  const sheet = useContext(SheetContext);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const navigate = useCallback((): boolean => {
    const fn = commerceRef.current?.onNavigateCatalog;
    if (!fn) return false;
    let result: { undo?: () => void } | void;
    try {
      result = fn(card.filters ?? {}, card);
    } catch {
      return false; // el host no pudo navegar: queda el botón para reintentar
    }
    const u = result && typeof result.undo === 'function' ? result.undo : null;
    setApplied(true);
    setUndo(() => u);
    return true;
  }, [card]);

  // Navegación automática: una sola vez por card, solo en vivo y solo si el host lo permite
  // ahora. El ref sobrevive al doble efecto de StrictMode y a los re-renders del streaming.
  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    if (!live || autoNavigated.has(card)) return;
    const c = commerceRef.current;
    if (!c?.onNavigateCatalog) return;
    let auto = false;
    try {
      auto = c.shouldAutoNavigate?.() === true;
    } catch {
      auto = false;
    }
    if (!auto) return;
    autoNavigated.add(card);
    // En la hoja mobile, la navegación automática deja ver el catálogo detrás (pasa a "peek").
    // Va adentro de este bloque para heredar el "una sola vez por card".
    if (navigate()) sheetRef.current?.onCatalogAutoNavigated(typeof card.summary === 'string' ? card.summary : '');
  }, [card, live, navigate]);

  const summary = typeof card.summary === 'string' ? card.summary : '';
  const canNavigate = typeof commerce?.onNavigateCatalog === 'function';

  if (applied) {
    return (
      <div className="aichat-catalog aichat-catalog-applied" role="status">
        <span className="aichat-catalog-check">
          <CheckIcon />
        </span>
        <span className="aichat-catalog-text">{labels.catalogAppliedLabel.replace('{summary}', summary)}</span>
        {undo && (
          <button
            type="button"
            className="aichat-catalog-btn"
            onClick={() => {
              try {
                undo();
              } finally {
                setUndo(null);
                setApplied(false);
              }
            }}
          >
            {labels.catalogUndoLabel}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="aichat-catalog">
      <span className="aichat-catalog-text">{labels.catalogSuggestedLabel.replace('{summary}', summary)}</span>
      {canNavigate && (
        <button type="button" className="aichat-catalog-btn" onClick={() => navigate()}>
          {labels.catalogViewLabel}
        </button>
      )}
    </div>
  );
}

export function SalesCard({
  card,
  commerce,
  onReply,
  labels,
  live = false,
}: {
  card: SalesCardType;
  commerce?: CommerceCallbacks;
  onReply?: (text: string) => void;
  labels: Labels;
  live?: boolean;
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
    case 'catalog':
      return card.filters && typeof card.filters === 'object' ? (
        <CatalogBody card={card} commerce={commerce} labels={labels} live={live} />
      ) : null;
    case 'spec':
      return typeof card.id === 'string' && card.id !== '' ? <SpecBody card={card} commerce={commerce} labels={labels} /> : null;
    default:
      return null;
  }
}
