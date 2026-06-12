import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';

function sseResponse(blocks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of blocks) c.enqueue(enc.encode(b));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('ChatPanel', () => {
  it('sends a message and renders the streamed assistant reply', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c1' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Hola "}\n\n',
          'event: text\ndata: {"delta":"Fede"}\n\n',
          'event: done\ndata: {}\n\n',
        ]),
      );

    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);

    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'hola{Enter}');
    expect(await screen.findByText('hola')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Hola Fede')).toBeInTheDocument());
  });

  it('renders assistant markdown (bold) instead of raw asterisks', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c2' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse(['event: text\ndata: {"delta":"Hola **Juan**"}\n\n', 'event: done\ndata: {}\n\n']),
      );

    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'hola{Enter}');

    const strong = await screen.findByText('Juan');
    expect(strong.tagName).toBe('STRONG');
    // los asteriscos crudos no deben aparecer en el DOM
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('Shift+Enter inserta salto de línea sin enviar; Enter envía', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c3' }), { status: 201 }))
      .mockResolvedValueOnce(sseResponse(['event: done\ndata: {}\n\n']));

    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    const ta = screen.getByPlaceholderText('Escribí tu mensaje…') as HTMLTextAreaElement;

    await userEvent.type(ta, 'linea1{Shift>}{Enter}{/Shift}linea2');
    expect(ta.value).toBe('linea1\nlinea2'); // Shift+Enter metió un salto de línea
    expect(fetchMock).not.toHaveBeenCalled(); // y NO envió

    await userEvent.type(ta, '{Enter}'); // Enter solo → envía
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('shows a mapped error message on 429', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }));
    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'hi{Enter}');
    expect(await screen.findByText('Demasiados mensajes. Probá en un momento.')).toBeInTheDocument();
  });
});
