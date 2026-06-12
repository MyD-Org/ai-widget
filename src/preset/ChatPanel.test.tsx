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
