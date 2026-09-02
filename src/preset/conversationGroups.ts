import type { ConversationSummary } from '../types';
import type { Labels } from './labels';

export interface ConversationRow {
  id: string;
  /** `title` del backend, o el fallback de labels cuando todavía no tiene uno. */
  title: string;
  /** Línea secundaria de la fila: "Hoy · 10:42", "Ayer · 17:03" o "26 ago". */
  meta: string;
}

export interface ConversationGroup {
  key: 'today' | 'week' | 'older';
  label: string;
  items: ConversationRow[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const time = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
const shortDate = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });

/** Días completos entre `date` y `now`, contando por día calendario (no por 24hs exactas):
 *  algo de ayer a las 23:50 es "ayer" aunque hayan pasado 20 minutos. */
function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

export function conversationMeta(c: ConversationSummary, labels: Labels, now: Date): string {
  const date = new Date(c.created_at);
  if (Number.isNaN(date.getTime())) return '';
  const days = daysAgo(date, now);
  if (days <= 0) return `${labels.historyGroupToday} · ${time.format(date)}`;
  if (days === 1) return `Ayer · ${time.format(date)}`;
  return shortDate.format(date);
}

/** Agrupa el listado por fecha (hoy / últimos 7 días / anteriores) preservando el orden que
 *  vino del backend dentro de cada grupo. Los grupos vacíos no se devuelven. Una fecha
 *  ilegible cae en "anteriores" en vez de romper el render. */
export function groupConversations(
  conversations: ConversationSummary[],
  labels: Labels,
  now: Date = new Date(),
): ConversationGroup[] {
  const groups: ConversationGroup[] = [
    { key: 'today', label: labels.historyGroupToday, items: [] },
    { key: 'week', label: labels.historyGroupWeek, items: [] },
    { key: 'older', label: labels.historyGroupOlder, items: [] },
  ];
  for (const c of conversations) {
    const date = new Date(c.created_at);
    const days = Number.isNaN(date.getTime()) ? Infinity : daysAgo(date, now);
    const bucket = days <= 0 ? groups[0] : days < 7 ? groups[1] : groups[2];
    bucket.items.push({
      id: c.id,
      title: c.title?.trim() || labels.untitledConversation,
      meta: conversationMeta(c, labels, now),
    });
  }
  return groups.filter((g) => g.items.length > 0);
}

/** Filtro del buscador: match case-insensitive sobre el título ya resuelto (incluye el
 *  fallback "Sin título", que es lo que el usuario ve). Se aplica antes de agrupar. */
export function filterConversations(
  conversations: ConversationSummary[],
  query: string,
  labels: Labels,
): ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return conversations;
  return conversations.filter((c) =>
    (c.title?.trim() || labels.untitledConversation).toLowerCase().includes(needle),
  );
}
