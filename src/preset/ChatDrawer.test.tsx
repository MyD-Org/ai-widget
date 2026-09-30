import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatDrawer } from './ChatDrawer';

const config = { baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' as const };

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

// fetch por ruta: crear conversación → id; mensaje → SSE con un "ok". Devuelve los textos
// enviados como mensaje del usuario.
function mockApi() {
  const sent: string[] = [];
  let n = 0;
  vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/conversations') && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: `c${++n}` }), { status: 201 });
    }
    if (url.endsWith('/messages') && init?.method === 'POST') {
      sent.push(JSON.parse(String(init.body)).content);
      return sseResponse(['event: text\ndata: {"delta":"ok"}\n\n', 'event: done\ndata: {}\n\n']);
    }
    return new Response('[]', { status: 200 });
  }) as never);
  return sent;
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('ChatDrawer', () => {
  it('is closed initially and opens on launcher click', async () => {
    render(<ChatDrawer config={config} />);
    expect(screen.queryByPlaceholderText('Escribí tu mensaje…')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
  });

  it('respects launcherPosition branding', async () => {
    render(<ChatDrawer config={{ ...config, baseUrl: 'x' }} branding={{ launcherPosition: 'bottom-left' }} />);
    expect(screen.getByRole('button', { name: 'Abrir chat' }).className).toContain('aichat-launcher-bottom-left');
  });

  it('sin open, onOpenChange solo avisa y el drawer maneja su estado', async () => {
    const onOpenChange = vi.fn();
    render(<ChatDrawer config={config} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
  });

  it('controlado: open manda y el launcher solo pide el cambio con onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ChatDrawer config={config} open onOpenChange={onOpenChange} />);
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // El host no cambió `open`: sigue abierto.
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
    rerender(<ChatDrawer config={config} open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByPlaceholderText('Escribí tu mensaje…')).not.toBeInTheDocument();
  });

  it('dock="right": panel acoplado, sin botón de expandir', () => {
    const { container } = render(<ChatDrawer config={config} open dock="right" />);
    const drawer = container.querySelector('.aichat-drawer') as HTMLElement;
    expect(drawer).toHaveClass('aichat-drawer-dock', 'aichat-dock');
    expect(drawer).not.toHaveClass('aichat-drawer-bottom-right');
    expect(screen.queryByRole('button', { name: 'Expandir' })).toBeNull();
    // El launcher sigue para cerrar y reabrir.
    expect(screen.getByRole('button', { name: 'Abrir chat' })).toBeInTheDocument();
  });

  it('sin dock: drawer flotante con expandir', () => {
    const { container } = render(<ChatDrawer config={config} open />);
    expect(container.querySelector('.aichat-drawer')).toHaveClass('aichat-drawer-bottom-right');
    expect(container.querySelector('.aichat-drawer-dock')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expandir' })).toBeInTheDocument();
  });

  it('sendRequest abre el chat y envía el texto una sola vez por id', async () => {
    const sent = mockApi();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <StrictMode>
        <ChatDrawer config={config} onOpenChange={onOpenChange} sendRequest={{ id: 'r1', text: 'reflector para patio' }} />
      </StrictMode>,
    );
    expect(await screen.findByText('reflector para patio')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(sent).toEqual(['reflector para patio']);

    // Re-render con el mismo id: no reenvía.
    rerender(
      <StrictMode>
        <ChatDrawer config={config} onOpenChange={onOpenChange} sendRequest={{ id: 'r1', text: 'reflector para patio' }} />
      </StrictMode>,
    );
    // Cerrar y volver a abrir (el cuerpo se desmonta): tampoco.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await act(async () => {});
    expect(sent).toEqual(['reflector para patio']);

    // Un id nuevo sí se envía.
    rerender(
      <StrictMode>
        <ChatDrawer config={config} onOpenChange={onOpenChange} sendRequest={{ id: 'r2', text: 'y para interior' }} />
      </StrictMode>,
    );
    await waitFor(() => expect(sent).toEqual(['reflector para patio', 'y para interior']));
  });

  it('sendRequest con id vacío no hace nada', async () => {
    const sent = mockApi();
    render(<ChatDrawer config={config} sendRequest={{ id: '', text: 'hola' }} />);
    await act(async () => {});
    expect(screen.queryByPlaceholderText('Escribí tu mensaje…')).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('sendRequest espera al token antes de enviar', async () => {
    const sent = mockApi();
    let resolveToken: (t: string) => void = () => {};
    const fetchToken = () => new Promise<string>((r) => (resolveToken = r));
    render(
      <ChatDrawer
        config={{ baseUrl: 'https://api.test', agentId: 'a', fetchToken, persist: 'none' }}
        sendRequest={{ id: 'r1', text: 'hola' }}
      />,
    );
    expect(await screen.findByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
    expect(sent).toEqual([]);
    await act(async () => resolveToken('jwt'));
    await waitFor(() => expect(sent).toEqual(['hola']));
  });

  it('sendRequest con una conversación retomada espera al historial (no lo pisa)', async () => {
    sessionStorage.setItem('aichat:conv:a', 'saved-1');
    const sent: string[] = [];
    let resolveHistory: (r: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string, init?: RequestInit) => {
      if (url.endsWith('/messages') && init?.method === 'POST') {
        sent.push(JSON.parse(String(init.body)).content);
        return sseResponse(['event: text\ndata: {"delta":"ok"}\n\n', 'event: done\ndata: {}\n\n']);
      }
      return new Promise<Response>((r) => (resolveHistory = r));
    }) as never);
    render(<ChatDrawer config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt' }} sendRequest={{ id: 'r1', text: 'nuevo' }} />);
    await screen.findByPlaceholderText('Escribí tu mensaje…');
    expect(sent).toEqual([]);
    await act(async () => resolveHistory(new Response(JSON.stringify([{ id: 'h1', role: 'user', text: 'viejo' }]), { status: 200 })));
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
    expect(sent).toEqual(['nuevo']);
    expect(screen.getByText('viejo')).toBeInTheDocument();
    expect(screen.getByText('nuevo')).toBeInTheDocument();
  });
});
