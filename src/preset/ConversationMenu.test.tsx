import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';
import type { ConversationSummary } from '../types';

const config = { baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const listado: ConversationSummary[] = [
  { id: 'c1', agent_id: 'a', title: 'Presupuesto techo Belgrano', created_at: new Date().toISOString() },
  { id: 'c2', agent_id: 'a', title: 'Stock de perfiles C', created_at: new Date().toISOString() },
];

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('menú de conversaciones', () => {
  it('no renderiza el botón de historial si enableHistory está apagado', () => {
    render(<ChatPanel config={config} />);
    expect(screen.queryByRole('button', { name: 'Conversaciones' })).toBeNull();
  });

  it('lista las conversaciones al abrir y carga los mensajes de la que se elige', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(json(listado))
      .mockResolvedValueOnce(json([{ id: 'm1', role: 'user', text: 'necesito 40 m²' }]));

    render(<ChatPanel config={config} enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));

    expect(await screen.findByText('Presupuesto techo Belgrano')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Presupuesto techo Belgrano'));

    expect(await screen.findByText('necesito 40 m²')).toBeInTheDocument();
    // El listado es un GET a /v1/conversations y recién después se piden los mensajes del hilo.
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v1/conversations');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/v1/conversations/c1/messages');
  });

  it('el buscador filtra por título y muestra el vacío de resultados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(json(listado));

    render(<ChatPanel config={config} enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));
    await screen.findByText('Presupuesto techo Belgrano');

    await userEvent.type(screen.getByPlaceholderText('Buscar conversación'), 'perfiles');
    expect(screen.queryByText('Presupuesto techo Belgrano')).toBeNull();
    expect(screen.getByText('Stock de perfiles C')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Buscar conversación'), 'zzz');
    expect(await screen.findByText('No encontramos conversaciones con ese texto.')).toBeInTheDocument();
  });

  it('sin conversaciones muestra el estado vacío y esconde el buscador', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(json([]));

    render(<ChatPanel config={config} enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));

    expect(await screen.findByText('Todavía no tenés conversaciones')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar conversación')).toBeNull();
  });

  it('muestra el error de carga y reintenta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json(listado));

    render(<ChatPanel config={config} enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));

    expect(await screen.findByText('No pudimos cargar tus conversaciones.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Presupuesto techo Belgrano')).toBeInTheDocument();
  });

  it('"Nueva conversación" limpia el chat y cierra el menú', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(json(listado))
      .mockResolvedValueOnce(json([{ id: 'm1', role: 'user', text: 'necesito 40 m²' }]));

    render(<ChatPanel config={config} enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));
    await userEvent.click(await screen.findByText('Presupuesto techo Belgrano'));
    await screen.findByText('necesito 40 m²');

    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));
    await userEvent.click(await screen.findByRole('button', { name: /Nueva conversación/ }));

    expect(screen.queryByText('necesito 40 m²')).toBeNull();
    expect(screen.getByText('¿En qué te puedo ayudar?')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Conversaciones' })).toHaveAttribute('aria-expanded', 'false'),
    );
  });

  it('Escape cierra el menú y devuelve el foco al botón', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(json(listado));

    render(<ChatPanel config={config} enableHistory />);
    const trigger = screen.getByRole('button', { name: 'Conversaciones' });
    await userEvent.click(trigger);
    await screen.findByText('Presupuesto techo Belgrano');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });

  it('un click afuera cierra el menú', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(json(listado));

    render(<ChatPanel config={config} enableHistory />);
    const trigger = screen.getByRole('button', { name: 'Conversaciones' });
    await userEvent.click(trigger);
    await screen.findByText('Presupuesto techo Belgrano');

    await userEvent.click(screen.getByPlaceholderText('Escribí tu mensaje…'));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('el header no tiene botón de nueva conversación: la acción vive sólo en el popover', () => {
    render(<ChatPanel config={config} enableHistory />);
    const header = screen.getByRole('button', { name: 'Conversaciones' }).parentElement!;
    expect(header.querySelectorAll('button')).toHaveLength(1);
  });

  it('con conversationId pre-creado el historial no se ofrece', () => {
    render(<ChatPanel config={{ ...config, conversationId: 'fijo' }} enableHistory />);
    expect(screen.queryByRole('button', { name: 'Conversaciones' })).toBeNull();
  });
});
