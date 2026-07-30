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

// Serializa UNA card a texto plano determinístico. Lee SOLO la card (nunca `m.text`).
// Una línea por producto con su precio y nada más: sin "Cantidad/Precio unitario/Subtotal", que
// para el caso típico (un producto) repetían tres veces el mismo número. El `Total` solo aparece
// cuando hay más de un producto — con uno solo sería idéntico a su precio.
// Precios de lista pública. Sin emojis, sin markdown, sin disclaimer, sin relleno.
export function budgetCardToPlainText(card: BudgetCard): string {
  const parts: string[] = [card.title];
  if (card.subtitle) parts.push(card.subtitle);

  for (const l of card.lines) {
    const qty = l.qty && l.qty > 1 ? `${l.qty}x ` : '';
    parts.push(`${qty}${l.label}: ${formatArs(l.subtotal ?? 0)}`);
  }

  if (card.lines.length !== 1) parts.push(`Total: ${formatArs(budgetTotal(card))}`);

  return parts.join('\n');
}
