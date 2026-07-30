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
  errorGeneric: string;
  copyLabel: string;
  copiedLabel: string;
  sendToChannelLabel: string;
  useBudgetLabel: string;
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
  errorGeneric: 'Hubo un problema. Intentá de nuevo.',
  copyLabel: 'Copiar',
  copiedLabel: 'Copiado',
  sendToChannelLabel: 'Enviar al canal',
  useBudgetLabel: 'Usar en presupuesto',
};

export function resolveLabels(overrides?: Partial<Labels>): Labels {
  return { ...defaultLabels, ...overrides };
}

export function labelForError(code: string | undefined, labels: Labels): string {
  if (code === 'auth') return labels.errorAuth;
  if (code === 'rate_limit') return labels.errorRateLimit;
  return labels.errorGeneric;
}
