import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

  it('renders a streamed budget card with a WhatsApp action', async () => {
    const card = {
      type: 'budget',
      title: 'Presupuesto #1042',
      lines: [],
      actions: [{ label: 'Pedir por WhatsApp', url: 'https://wa.me/549110000?text=hola', style: 'whatsapp', icon: 'whatsapp' }],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c4' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Te armé el presupuesto"}\n\n',
          `event: card\ndata: ${JSON.stringify(card)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'precio{Enter}');
    expect(await screen.findByText('Presupuesto #1042')).toBeInTheDocument();
    const wa = screen.getByRole('link', { name: 'Pedir por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
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

  it('413 y 429 por usuario muestran su mensaje', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'message_too_long' }), { status: 413 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'tokens_per_day_user' }), { status: 429 }));
    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'largo{Enter}');
    expect(await screen.findByText('El mensaje es demasiado largo.')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'otro{Enter}');
    expect(await screen.findByText('Demasiados mensajes. Probá en un momento.')).toBeInTheDocument();
  });
});

describe('ChatPanel — cards de venta', () => {
  const replies = { type: 'replies', options: ['Para interior', 'Para exterior'] };
  const cfg = { baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' as const };

  // Stream que el test controla: permite afirmar qué se ve MIENTRAS sigue el streaming.
  function controlledSse() {
    const enc = new TextEncoder();
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (ctrl = c) });
    return {
      response: new Response(body, { status: 200 }),
      push: (block: string) => ctrl.enqueue(enc.encode(block)),
      close: () => ctrl.close(),
    };
  }

  it('replies no se dibuja durante el streaming; aparece al terminar y tocarla envía', async () => {
    const stream = controlledSse();
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'r1' }), { status: 201 }))
      .mockResolvedValueOnce(stream.response)
      .mockResolvedValueOnce(sseResponse(['event: text\ndata: {"delta":"Perfecto"}\n\n', 'event: done\ndata: {}\n\n']));
    render(<ChatPanel config={cfg} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'quiero luces{Enter}');

    stream.push('event: text\ndata: {"delta":"¿Dónde van?"}\n\n');
    stream.push(`event: card\ndata: ${JSON.stringify(replies)}\n\n`);
    expect(await screen.findByText('¿Dónde van?')).toBeInTheDocument();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Para exterior' })).toBeNull();

    stream.push('event: done\ndata: {}\n\n');
    stream.close();
    const opt = await screen.findByRole('button', { name: 'Para exterior' });
    await userEvent.click(opt);

    // Se envió como mensaje del usuario y las sugerencias viejas desaparecen.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ content: 'Para exterior' });
    expect(await screen.findByText('Perfecto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Para exterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Para interior' })).toBeNull();
  });

  it('replies que no es del último mensaje no se dibuja', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'r2' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          `event: card\ndata: ${JSON.stringify(replies)}\n\n`,
          `event: card\ndata: ${JSON.stringify({ type: 'products', items: [{ id: '1', label: 'Reflector' }] })}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    render(<ChatPanel config={cfg} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'hola{Enter}');
    expect(await screen.findByText('Reflector')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Para exterior' })).toBeNull();
  });

  it('commerce llega a las cards (onAddProducts del cart)', async () => {
    const onAddProducts = vi.fn();
    const cart = { type: 'cart', lines: [{ id: '7', label: 'Panel', qty: 3 }] };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'r3' }), { status: 201 }))
      .mockResolvedValueOnce(sseResponse([`event: card\ndata: ${JSON.stringify(cart)}\n\n`, 'event: done\ndata: {}\n\n']));
    render(<ChatPanel config={cfg} commerce={{ onAddProducts }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'armalo{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar todo al carrito' }));
    expect(onAddProducts).toHaveBeenCalledWith([{ id: '7', qty: 3 }]);
  });
});
