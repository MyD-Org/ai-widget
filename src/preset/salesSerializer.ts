import type { SalesCard } from '../types';

// Serializa UNA card de venta a texto plano determinístico (copiar, y base del futuro canal
// WhatsApp). Solo `label`s, NUNCA precios: la card no trae precios (los resuelve el host con la
// lista de quien mira) y un texto que circula fuera del chat no debe fijar un precio viejo.
export function salesCardToPlainText(card: SalesCard): string {
  switch (card.type) {
    case 'products': {
      const parts = card.title ? [card.title] : [];
      for (const it of card.items) parts.push(`- ${it.label}`);
      return parts.join('\n');
    }
    case 'cart': {
      const parts = card.title ? [card.title] : [];
      for (const l of card.lines) parts.push(`- ${l.qty}× ${l.label}`);
      return parts.join('\n');
    }
    case 'replies':
      return card.options.join('\n');
    case 'handoff':
      return card.summary;
  }
}
