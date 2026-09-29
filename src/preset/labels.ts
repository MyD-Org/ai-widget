export interface Labels {
  headerTitle: string;
  statusOnline: string;
  emptyState: string;
  placeholder: string;
  sendLabel: string;
  newConversation: string;
  expand: string;
  collapse: string;
  launcherAria: string;
  errorAuth: string;
  /** API key del host inválida o ausente: recargar NO lo arregla, es configuración. */
  errorConfig: string;
  errorRateLimit: string;
  /** code:'no_credits' (billing_error real de Anthropic) O code:'agent_disabled' (el agente
   *  existe pero su status es 'disabled' — demos/pilotos sin habilitar todavía). Mismo
   *  mensaje para las dos: al usuario no le importa cuál de las dos es, y ninguna se
   *  arregla reintentando. */
  errorNoCredits: string;
  errorGeneric: string;
  /** code:'message_too_long' (413): el mensaje supera `max_message_chars` del tenant. */
  errorMessageTooLong: string;
  copyLabel: string;
  copiedLabel: string;
  sendToChannelLabel: string;
  useBudgetLabel: string;
  /** Aria/title del botón que abre el panel de historial en el header. */
  historyLabel: string;
  /** Aria/title del botón que cierra el panel de historial. */
  closeHistoryLabel: string;
  /** Texto del CTA "＋ Nueva conversación" dentro del panel de historial (más largo que el
   *  ícono ⟳ del header, que reusa `newConversation`). */
  historyNewLabel: string;
  /** Estado vacío del panel de historial (no hay conversaciones aún para este usuario). */
  historyEmpty: string;
  /** Fallback cuando el backend no le puso título a la conversación. */
  untitledConversation: string;
  /** Placeholder del buscador dentro del panel de historial. */
  historySearchPlaceholder: string;
  /** Mensaje cuando el buscador no matchea ninguna conversación. */
  historyNoResults: string;
  /** Encabezados de los grupos por fecha dentro del historial. */
  historyGroupToday: string;
  historyGroupWeek: string;
  historyGroupOlder: string;
  /** Texto del botón que reintenta GET /v1/conversations tras un error de carga. */
  historyRetry: string;
  /** Mensaje de error cuando falla la carga del listado de conversaciones. */
  historyError: string;
  // Cards de venta. Texto neutro (infinitivos, impersonal): sirve con el registro del agente
  // (vos) y con el del resto del producto del host (usted).
  /** Botón "Agregar" de una fila de la card `products` (requiere commerce.onAddProducts). */
  addLabel: string;
  /** Estado tras agregar (fila de `products` o botón de la card `cart`). */
  addedLabel: string;
  /** Botón de la card `cart` (requiere commerce.onAddProducts). */
  addAllLabel: string;
  /** Botón "Ver" de una fila de `products` (requiere commerce.onOpenProduct). */
  viewProductLabel: string;
  /** Botón de la card `handoff`. */
  handoffLabel: string;
  /** Tag de un producto que el host resolvió con available === false. */
  unavailableLabel: string;
  /** Nombre accesible del carrusel cuando el agente recomienda varios productos. */
  carouselLabel: string;
  carouselPrev: string;
  carouselNext: string;
  /** Aviso de stock bajo (1 a 5 unidades, si el host informa `stock`). */
  stockOneLabel: string;
  /** Idem para 2 a 5; `{n}` se reemplaza por la cantidad. */
  stockFewLabel: string;
  /** Fila de total de la card `cart` (solo si todas las líneas tienen precio resuelto). */
  referenceTotalLabel: string;
}

export const defaultLabels: Labels = {
  headerTitle: 'Asistente',
  statusOnline: 'En línea',
  emptyState: '¿En qué te puedo ayudar?',
  placeholder: 'Escribí tu mensaje…',
  sendLabel: 'Enviar',
  newConversation: 'Nueva conversación',
  expand: 'Expandir',
  collapse: 'Contraer',
  launcherAria: 'Abrir chat',
  errorAuth: 'Tu sesión expiró. Recargá la página.',
  errorConfig: 'El chat no está configurado correctamente. Avisale al equipo del sitio.',
  errorRateLimit: 'Demasiados mensajes. Probá en un momento.',
  errorNoCredits: 'No contás con créditos disponibles.',
  errorGeneric: 'Hubo un problema. Intentá de nuevo.',
  errorMessageTooLong: 'El mensaje es demasiado largo.',
  copyLabel: 'Copiar',
  copiedLabel: 'Copiado',
  sendToChannelLabel: 'Enviar al canal',
  useBudgetLabel: 'Usar en presupuesto',
  historyLabel: 'Conversaciones',
  closeHistoryLabel: 'Cerrar conversaciones',
  historyNewLabel: 'Nueva conversación',
  historyEmpty: 'Todavía no tenés conversaciones',
  untitledConversation: 'Sin título',
  historySearchPlaceholder: 'Buscar conversación',
  historyNoResults: 'No encontramos conversaciones con ese texto.',
  historyGroupToday: 'Hoy',
  historyGroupWeek: 'Esta semana',
  historyGroupOlder: 'Anteriores',
  historyRetry: 'Reintentar',
  historyError: 'No pudimos cargar tus conversaciones.',
  addLabel: 'Agregar',
  addedLabel: 'Agregado',
  addAllLabel: 'Agregar todo al carrito',
  viewProductLabel: 'Ver',
  handoffLabel: 'Continuar por WhatsApp',
  unavailableLabel: 'No disponible',
  referenceTotalLabel: 'Total de referencia',
  carouselLabel: 'Productos recomendados',
  carouselPrev: 'Ver anteriores',
  carouselNext: 'Ver siguientes',
  stockOneLabel: 'Queda 1',
  stockFewLabel: 'Quedan {n}',
};

export function resolveLabels(overrides?: Partial<Labels>): Labels {
  return { ...defaultLabels, ...overrides };
}

// Todos los 429 de ai-api: el genérico, los topes del tenant y los topes por end_user. Al
// usuario le da igual cuál saltó; ninguno se arregla reintentando ya.
const RATE_LIMIT_CODES = new Set([
  'rate_limit',
  'messages_per_day',
  'tokens_per_month',
  'messages_per_day_user',
  'tokens_per_day_user',
]);

export function labelForError(code: string | undefined, labels: Labels): string {
  if (code === 'auth') return labels.errorAuth;
  if (code === 'config') return labels.errorConfig;
  if (code === 'message_too_long') return labels.errorMessageTooLong;
  if (code && RATE_LIMIT_CODES.has(code)) return labels.errorRateLimit;
  if (code === 'no_credits' || code === 'agent_disabled') return labels.errorNoCredits;
  return labels.errorGeneric;
}
