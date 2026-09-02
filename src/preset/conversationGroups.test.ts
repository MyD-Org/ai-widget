import { describe, it, expect } from 'vitest';
import { conversationMeta, filterConversations, groupConversations } from './conversationGroups';
import { defaultLabels } from './labels';
import type { ConversationSummary } from '../types';

const now = new Date('2026-09-01T12:00:00');

function conv(id: string, created_at: string, title: string | null = id): ConversationSummary {
  return { id, agent_id: 'a', title, created_at };
}

describe('groupConversations', () => {
  it('reparte por hoy / esta semana / anteriores y omite los grupos vacíos', () => {
    const groups = groupConversations(
      [
        conv('hoy', '2026-09-01T10:42:00'),
        conv('anteayer', '2026-08-30T09:00:00'),
        conv('viejo', '2026-08-01T09:00:00'),
      ],
      defaultLabels,
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['today', 'week', 'older']);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['hoy'], ['anteayer'], ['viejo']]);
  });

  it('agrupa por día calendario, no por 24hs exactas', () => {
    // 23:50 de ayer es "ayer" aunque falten horas para las 24hs.
    const groups = groupConversations([conv('ayer', '2026-08-31T23:50:00')], defaultLabels, now);
    expect(groups[0].key).toBe('week');
    expect(groups[0].items[0].meta).toMatch(/^Ayer · /);
  });

  it('el borde de los 7 días cae en anteriores', () => {
    const groups = groupConversations(
      [conv('seis', '2026-08-26T10:00:00'), conv('siete', '2026-08-25T10:00:00')],
      defaultLabels,
      now,
    );
    expect(groups.find((g) => g.key === 'week')?.items.map((i) => i.id)).toEqual(['seis']);
    expect(groups.find((g) => g.key === 'older')?.items.map((i) => i.id)).toEqual(['siete']);
  });

  it('cae al fallback cuando el backend no puso título', () => {
    const groups = groupConversations([conv('c1', '2026-09-01T10:00:00', null)], defaultLabels, now);
    expect(groups[0].items[0].title).toBe(defaultLabels.untitledConversation);
  });

  it('una fecha ilegible cae en anteriores en vez de romper', () => {
    const groups = groupConversations([conv('roto', 'no-es-fecha')], defaultLabels, now);
    expect(groups[0].key).toBe('older');
    expect(groups[0].items[0].meta).toBe('');
  });
});

describe('conversationMeta', () => {
  it('muestra la hora para hoy y la fecha corta para lo viejo', () => {
    expect(conversationMeta(conv('a', '2026-09-01T10:42:00'), defaultLabels, now)).toBe('Hoy · 10:42');
    expect(conversationMeta(conv('b', '2026-08-01T10:42:00'), defaultLabels, now)).not.toContain('·');
  });
});

describe('filterConversations', () => {
  const list = [conv('c1', '2026-09-01T10:00:00', 'Presupuesto techo'), conv('c2', '2026-09-01T10:00:00', 'Stock de perfiles')];

  it('filtra por título sin distinguir mayúsculas', () => {
    expect(filterConversations(list, 'TECHO', defaultLabels).map((c) => c.id)).toEqual(['c1']);
  });

  it('una query vacía devuelve todo', () => {
    expect(filterConversations(list, '   ', defaultLabels)).toHaveLength(2);
  });

  it('matchea el fallback de título', () => {
    const sinTitulo = [conv('c3', '2026-09-01T10:00:00', null)];
    expect(filterConversations(sinTitulo, 'sin tít', defaultLabels)).toHaveLength(1);
  });
});
