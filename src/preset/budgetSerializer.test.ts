import { describe, it, expect } from 'vitest';
import { budgetCardToPlainText, budgetTotal, formatArs } from './budgetSerializer';
import type { BudgetCard } from '../types';

const baseCard: BudgetCard = {
  type: 'budget',
  title: 'Opción A – Reflector LED 50W exterior IP65',
  subtitle: 'Luz fría, alta potencia',
  lines: [{ label: 'Reflector LED 50W exterior IP65', qty: 5, unitPrice: 9800, subtotal: 49000 }],
  actions: [],
};

describe('budgetCardToPlainText', () => {
  it('produces the exact agreed format (character-for-character)', () => {
    const out = budgetCardToPlainText(baseCard);
    expect(out).toBe(
      [
        'Opción A – Reflector LED 50W exterior IP65',
        'Luz fría, alta potencia',
        'Cantidad: 5',
        'Precio unitario: $9.800',
        'Subtotal: $49.000',
        'Total: $49.000 (5 x $9.800)',
      ].join('\n'),
    );
  });

  it('total is derived from the lines (never contradicts them)', () => {
    const out = budgetCardToPlainText(baseCard);
    // 5 × 9.800 = 49.000 y el desglose usa el mismo precio unitario público.
    expect(out).toContain('Total: $49.000 (5 x $9.800)');
    expect(out).not.toMatch(/mayorista/i);
  });

  it('is channel-safe: no disclaimer, no "orientativo", no markdown, no emoji', () => {
    const out = budgetCardToPlainText(baseCard);
    expect(out).not.toMatch(/orientativo/i);
    expect(out).not.toMatch(/disclaimer/i);
    expect(out).not.toMatch(/[*_#|]/);
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('is deterministic: same card → identical output', () => {
    expect(budgetCardToPlainText(baseCard)).toBe(budgetCardToPlainText(baseCard));
  });

  describe('edge cases', () => {
    it('single option → one well-formed block, no block separators', () => {
      const out = budgetCardToPlainText(baseCard);
      expect(out.startsWith('Opción A – Reflector LED 50W exterior IP65')).toBe(true);
      expect(out.split('\n\n')).toHaveLength(1);
    });

    it('missing subtitle → title followed directly by Cantidad, no blank line', () => {
      const { subtitle: _omit, ...noSub } = baseCard;
      const out = budgetCardToPlainText(noSub as BudgetCard);
      const lines = out.split('\n');
      expect(lines[0]).toBe('Opción A – Reflector LED 50W exterior IP65');
      expect(lines[1]).toBe('Cantidad: 5');
      expect(out).not.toContain('\n\n');
    });

    it('multi-line total → sum of subtotals, no (N x unit) parenthesis', () => {
      const multi: BudgetCard = {
        ...baseCard,
        lines: [
          { label: 'A', qty: 2, unitPrice: 100, subtotal: 200 },
          { label: 'B', qty: 3, unitPrice: 100, subtotal: 300 },
        ],
      };
      const out = budgetCardToPlainText(multi);
      expect(out).toContain('Total: $500');
      expect(out).not.toMatch(/\(.*x.*\)/);
    });

    it('empty lines / zero amounts → valid text, $0, no crash', () => {
      const empty: BudgetCard = { type: 'budget', title: 'Opción vacía', lines: [], actions: [] };
      const out = budgetCardToPlainText(empty);
      expect(out).toBe(['Opción vacía', 'Total: $0'].join('\n'));

      const zeroLine: BudgetCard = {
        type: 'budget',
        title: 'Cero',
        lines: [{ label: 'x', qty: 0, unitPrice: 0, subtotal: 0 }],
        actions: [],
      };
      const outZero = budgetCardToPlainText(zeroLine);
      expect(outZero).toContain('Cantidad: 0');
      expect(outZero).toContain('Precio unitario: $0');
      expect(outZero).toContain('Subtotal: $0');
      expect(outZero).not.toMatch(/[*_#|]/);
    });
  });
});

describe('budgetTotal', () => {
  it('sums line subtotals', () => {
    expect(budgetTotal(baseCard)).toBe(49000);
    expect(
      budgetTotal({
        type: 'budget',
        title: 't',
        lines: [
          { label: 'A', qty: 2, unitPrice: 100, subtotal: 200 },
          { label: 'B', qty: 3, unitPrice: 100, subtotal: 300 },
        ],
        actions: [],
      }),
    ).toBe(500);
  });
});

describe('formatArs', () => {
  it('formats Argentine money: $ + dot thousands, no decimals', () => {
    expect(formatArs(9800)).toBe('$9.800');
    expect(formatArs(49000)).toBe('$49.000');
    expect(formatArs(39500)).toBe('$39.500');
    expect(formatArs(7900)).toBe('$7.900');
    expect(formatArs(0)).toBe('$0');
  });

  it('groups amounts over a million correctly', () => {
    expect(formatArs(1234567)).toBe('$1.234.567');
    expect(formatArs(100)).toBe('$100');
  });
});
