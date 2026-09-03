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
  errorRateLimit: string;
  /** code:'no_credits' (billing_error real de Anthropic) O code:'agent_disabled' (el agente
   *  existe pero su status es 'disabled' — demos/pilotos sin habilitar todavía). Mismo
   *  mensaje para las dos: al usuario no le importa cuál de las dos es, y ninguna se
   *  arregla reintentando. */
  errorNoCredits: string;
  errorGeneric: string;
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
  errorRateLimit: 'Demasiados mensajes. Probá en un momento.',
  errorNoCredits: 'No contás con créditos disponibles.',
  errorGeneric: 'Hubo un problema. Intentá de nuevo.',
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
};

export function resolveLabels(overrides?: Partial<Labels>): Labels {
  return { ...defaultLabels, ...overrides };
}

export function labelForError(code: string | undefined, labels: Labels): string {
  if (code === 'auth') return labels.errorAuth;
  if (code === 'rate_limit') return labels.errorRateLimit;
  if (code === 'no_credits' || code === 'agent_disabled') return labels.errorNoCredits;
  return labels.errorGeneric;
}
