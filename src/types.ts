export type Role = 'user' | 'assistant';

type CardActionStyle = 'primary' | 'whatsapp' | 'default';
type CardActionIcon = 'download' | 'whatsapp' | 'chat' | 'external';

// Unión discriminada: `link` navega (usa safeHref); `copy`/`send` invocan un callback del host
// con texto (no navegan, no tienen url). Retrocompat: una acción SIN `kind` se trata como `link`.
export type CardAction =
  | { kind?: 'link'; label: string; url: string; style?: CardActionStyle; icon?: CardActionIcon; download?: boolean }
  | { kind: 'copy'; label: string; style?: CardActionStyle; icon?: CardActionIcon }
  | { kind: 'send'; label: string; style?: CardActionStyle; icon?: CardActionIcon };

export interface BudgetLine {
  label: string;
  qty?: number;
  /** Monto numérico por línea (habilita formateo y serialización determinística). */
  unitPrice?: number;
  subtotal?: number;
  /** String preformateado legacy (fallback del render cuando falta `subtotal`). */
  amount?: string;
  /** ID del material/producto en el sistema del host (opcional). Permite que el host
   *  precargue el ítem exacto en su editor (callback onUseBudget) sin matchear por nombre. */
  materialId?: number;
}

export interface BudgetCard {
  type: 'budget';
  title: string;
  subtitle?: string;
  lines: BudgetLine[];
  actions: CardAction[];
}

// Cards de venta (contrato platform/contracts/sales-cards/v1). Llevan ids, NO datos
// comerciales: precio, foto y stock los completa el host con `commerce.resolveProducts`.
// `label` lo escribe el modelo y es solo texto de respaldo; nunca se muestra un precio suyo.
export interface ProductsCard {
  type: 'products';
  title?: string;
  items: { id: string; label: string; reason?: string }[];
}

export interface CartCard {
  type: 'cart';
  title?: string;
  lines: { id: string; label: string; qty: number }[];
}

/** Respuestas sugeridas: tocar una la envía como mensaje del usuario (no depende del host). */
export interface RepliesCard {
  type: 'replies';
  options: string[];
}

/** Traspaso a un humano. `phone` lo agrega ai-api desde la config del tenant (no el modelo). */
export interface HandoffCard {
  type: 'handoff';
  channel: 'whatsapp';
  /** Solo dígitos, E.164 sin `+`. */
  phone: string;
  summary: string;
}

export type SalesCard = ProductsCard | CartCard | RepliesCard | HandoffCard;

export type Card = BudgetCard | SalesCard;

/** Producto resuelto por el host (catálogo + lista de precios de quien mira). */
export interface ResolvedProduct {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  /** Precio unitario a exhibir, ya en la lista de quien mira. */
  price?: number;
  available?: boolean;
  /** Unidades en stock, si el host las conoce. Con 1 a 5 la card muestra "Queda 1" / "Quedan N". */
  stock?: number;
}

/** Acciones de comercio del host para las cards de venta. Todas opcionales (ADR 0008): sin el
 *  callback, el botón correspondiente no se dibuja. */
export interface CommerceCallbacks {
  /** Completa precio/foto/stock de los ids de una card. Si falla o no devuelve un id, la card
   *  muestra el `label` del modelo sin precio ni foto. */
  resolveProducts?: (ids: string[]) => Promise<ResolvedProduct[]>;
  /** "Agregar" / "Agregar todo al carrito". El host recalcula precio y stock del lado suyo. */
  onAddProducts?: (lines: { id: string; qty: number }[]) => void;
  /** "Ver": abrir la ficha del producto en el host. */
  onOpenProduct?: (id: string) => void;
  /** "Continuar por WhatsApp". Sin callback, la card abre `wa.me` con el resumen. */
  onHandoff?: (card: HandoffCard) => void;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  created_at?: string;
  card?: Card;
}

/** Resumen de conversación que devuelve GET /v1/conversations (todas las del end-user en el
 *  tenant). `title` puede ser null hasta que el backend le ponga uno; el front cae a un
 *  fallback ("Sin título" o el primer mensaje) para renderizarlo. */
export interface ConversationSummary {
  id: string;
  agent_id: string;
  title: string | null;
  status?: string;
  created_at: string;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'card'; card: Card }
  | { type: 'done'; usage: unknown; rounds: number; stoppedByMaxRounds: boolean; stopReason: string }
  | { type: 'error'; code: string }
  | { type: 'debug_context'; data: unknown }
  | { type: 'debug_tool_call'; data: unknown }
  | { type: 'debug_tool_result'; data: unknown }
  // Evento SSE que el chat no renderiza (p.ej. 'dashboard'): pasa al host vía config.onEvent.
  | { type: 'custom'; name: string; payload: unknown };

export interface AiChatConfig {
  baseUrl: string;
  agentId: string;
  fetchToken?: () => Promise<string>;
  token?: string;
  persist?: 'session' | 'none';
  /** Conversación pre-creada por el backend. Si se provee, el widget NO crea conversación
   *  (saltea POST /v1/conversations) y arranca con este id, cargando su historial. Lo usa el
   *  copiloto del operador en el admin del CRM (un hilo por contacto). Con conversationId, el
   *  default de `persist` pasa a 'none' (el host dicta el id). Ver ADR 0007 del platform. */
  conversationId?: string;
  /** Override del fetch (para tests, proxies o transportes mock). Default: global fetch. */
  fetch?: typeof fetch;
  /** Kind de la conversación al crearla (p.ej. 'dashboard_builder' para el AI dashboard builder). */
  kind?: 'standard' | 'dashboard_builder';
  /** Contexto de página enviado con CADA mensaje como body.page_context (p.ej. el documento
   *  dashboard actual). Se evalúa por envío. */
  getPageContext?: () => unknown;
  /** Callback para eventos SSE que el chat no renderiza (p.ej. 'dashboard'). */
  onEvent?: (name: string, payload: unknown) => void;
}

export type ErrorCode = 'auth' | 'not_found' | 'rate_limit' | 'no_credits' | 'agent_disabled' | string;

export class ApiError extends Error {
  constructor(public status: number, public code: ErrorCode, message?: string) {
    super(message ?? `API error ${status} (${code})`);
    this.name = 'ApiError';
  }
}
