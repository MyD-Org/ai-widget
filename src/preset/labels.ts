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
  /** Botón "Ver producto" de la card `spec` (requiere commerce.onOpenProduct). */
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
  /** Prefijo de la línea de código bajo el nombre: "Cód. ABC". */
  codeLabel: string;
  /** Contador de cantidad de la card de producto. */
  decrementLabel: string;
  incrementLabel: string;
  removeLabel: string;
  /** Card `catalog` después de navegar; `{summary}` se reemplaza por el resumen de los filtros. */
  catalogAppliedLabel: string;
  /** Card `catalog` sin navegación (historial, host que no navega solo o sin callback). */
  catalogSuggestedLabel: string;
  /** Botón que aplica los filtros de la card `catalog` (requiere commerce.onNavigateCatalog). */
  catalogViewLabel: string;
  /** Botón que deshace la navegación (solo si el host devolvió `undo`). */
  catalogUndoLabel: string;
  /** Link al PDF de la ficha técnica en la card `spec` (si el host informa `specUrl`). */
  specSheetLabel: string;
  /** Nombre accesible de la lista de atributos de la card `spec`. */
  specAttributesLabel: string;
  /** Tag de un producto que el host resolvió con available === true (card `spec`). */
  availableLabel: string;
  // Hoja mobile (ChatDrawer por debajo de `mobileBreakpoint`).
  /** Botón de la cabecera que minimiza la hoja a la barra inferior. */
  minimizeLabel: string;
  /** Botón que cierra el chat (cabecera de la hoja y barra minimizada). */
  closeLabel: string;
  /** Nombre accesible de la barra minimizada, que al tocarla vuelve a abrir la hoja. */
  peekExpandLabel: string;
  /** Texto de la barra minimizada cuando todavía no hay respuestas del asistente. */
  peekEmptyLabel: string;
  /** Botón de la barra minimizada tras aplicar filtros del catálogo: cierra el chat. */
  peekResultsLabel: string;
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
  viewProductLabel: 'Ver producto',
  handoffLabel: 'Continuar por WhatsApp',
  unavailableLabel: 'No disponible',
  referenceTotalLabel: 'Total de referencia',
  carouselLabel: 'Productos recomendados',
  carouselPrev: 'Ver anteriores',
  carouselNext: 'Ver siguientes',
  stockOneLabel: 'Queda 1',
  stockFewLabel: 'Quedan {n}',
  codeLabel: 'Cód.',
  decrementLabel: 'Quitar uno',
  incrementLabel: 'Agregar uno más',
  removeLabel: 'Quitar del carrito',
  catalogAppliedLabel: 'Filtros aplicados: {summary}',
  catalogSuggestedLabel: 'Filtros sugeridos: {summary}',
  catalogViewLabel: 'Ver en el catálogo',
  catalogUndoLabel: 'Deshacer',
  specSheetLabel: 'Ficha técnica (PDF)',
  specAttributesLabel: 'Características',
  availableLabel: 'Disponible',
  minimizeLabel: 'Minimizar',
  closeLabel: 'Cerrar',
  peekExpandLabel: 'Abrir la conversación',
  peekEmptyLabel: 'Continuar la conversación',
  peekResultsLabel: 'Ver resultados',
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
