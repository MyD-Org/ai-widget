import type { BudgetCard } from '../types';

// Formato argentino determinístico: `$` + entero con `.` como separador de miles, sin decimales.
// Impl propia (no toLocaleString) para no depender del ICU del runtime: 39500 → "$39.500".
export function formatArs(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${grouped}`;
}

// Suma de subtotales de las líneas: el total SIEMPRE se deriva de las líneas, así nunca puede
// contradecirlas (todo en lista pública).
export function budgetTotal(card: BudgetCard): number {
  return card.lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
}

// Desglose "(N x $unit)" derivable SOLO de la card: una única línea con qty>0 cuyo total
// se divide exactamente por qty. Si no es derivable, se omite (sin paréntesis).
function breakdown(card: BudgetCard, amount: number): string {
  if (card.lines.length !== 1) return '';
  const qty = card.lines[0].qty;
  if (!qty || qty <= 0) return '';
  if (amount % qty !== 0) return '';
  return ` (${qty} x ${formatArs(amount / qty)})`;
}

// Serializa UNA card a texto plano determinístico. Lee SOLO la card (nunca `m.text`).
// Precios de lista pública, total derivado de las líneas. Sin emojis, sin markdown, sin
// disclaimer, sin "orientativo", sin relleno.
export function budgetCardToPlainText(card: BudgetCard): string {
  const parts: string[] = [card.title];
  if (card.subtitle) parts.push(card.subtitle);

  for (const l of card.lines) {
    parts.push(`Cantidad: ${l.qty ?? 0}`);
    parts.push(`Precio unitario: ${formatArs(l.unitPrice ?? 0)}`);
    parts.push(`Subtotal: ${formatArs(l.subtotal ?? 0)}`);
  }

  const total = budgetTotal(card);
  parts.push(`Total: ${formatArs(total)}${breakdown(card, total)}`);

  return parts.join('\n');
}
