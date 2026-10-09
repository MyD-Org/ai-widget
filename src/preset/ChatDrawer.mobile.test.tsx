import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatDrawer } from './ChatDrawer';
import { installPointerEvent, mockMatchMedia, mockVisualViewport, type MediaEnv } from '../test/mobileEnv';
import catalogFx from './__fixtures__/sales-cards/catalog.json';

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

function mockApi(reply: string[] = ['event: text\ndata: {"delta":"Hola, **te** ayudo"}\n\n', 'event: done\ndata: {}\n\n']) {
  return vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/conversations') && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'c1' }), { status: 201 });
    }
    if (url.endsWith('/messages') && init?.method === 'POST') return sseResponse(reply);
    return new Response('[]', { status: 200 });
  }) as never);
}

const flushPop = () => act(() => new Promise((r) => setTimeout(r, 20)));

let media: MediaEnv;
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  installPointerEvent();
  media = mockMatchMedia(375);
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as never;
  document.body.removeAttribute('style');
  history.replaceState({ host: 1 }, '', location.href);
});

afterEach(async () => {
  media.restore();
  // Deja el historial en una entrada del host para el test siguiente.
  await flushPop();
});

const sheet = (c: HTMLElement) => c.querySelector('.aichat-drawer') as HTMLElement;
const openChat = () => userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));

describe('ChatDrawer · breakpoint', () => {
  it('por debajo de 768 es hoja a pantalla completa; por encima, el drawer flotante', async () => {
    media.setWidth(1024);
    const { container } = render(<ChatDrawer config={config} open />);
    expect(sheet(container)).toHaveClass('aichat-drawer-bottom-right');
    expect(screen.getByRole('button', { name: 'Expandir' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => media.setWidth(375));
    expect(sheet(container)).toHaveClass('aichat-sheet');
    expect(container.querySelector('.aichat-root')).toHaveClass('aichat-mobile');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Minimizar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expandir' })).toBeNull();
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toHaveAttribute('enterkeyhint', 'send');

    act(() => media.setWidth(800));
    expect(sheet(container)).toHaveClass('aichat-drawer-bottom-right');
  });

  it('mobileBreakpoint configurable', () => {
    media.setWidth(900);
    const { container, rerender } = render(<ChatDrawer config={config} open />);
    expect(sheet(container)).not.toHaveClass('aichat-sheet');
    rerender(<ChatDrawer config={config} open mobileBreakpoint={1024} />);
    expect(sheet(container)).toHaveClass('aichat-sheet');
  });

  it('dock="right" sigue igual en escritorio; en mobile manda la hoja', () => {
    media.setWidth(1300);
    const { container } = render(<ChatDrawer config={config} open dock="right" />);
    expect(sheet(container)).toHaveClass('aichat-drawer-dock');
    act(() => media.setWidth(375));
    expect(sheet(container)).toHaveClass('aichat-sheet');
    expect(sheet(container)).not.toHaveClass('aichat-drawer-dock');
  });

  it('el launcher se oculta con la hoja abierta y vuelve al cerrar', async () => {
    render(<ChatDrawer config={config} />);
    await openChat();
    expect(screen.queryByRole('button', { name: 'Abrir chat' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    const launcher = screen.getByRole('button', { name: 'Abrir chat' });
    expect(launcher).toHaveFocus();
  });
});

describe('ChatDrawer · peek', () => {
  it('sin control: Minimizar pasa a la barra con el último mensaje y tocarla expande', async () => {
    mockApi();
    const onPresentationChange = vi.fn();
    const { container } = render(<ChatDrawer config={config} onPresentationChange={onPresentationChange} />);
    await openChat();
    // Sin respuestas todavía, la barra muestra el texto de respaldo.
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    expect(onPresentationChange).toHaveBeenLastCalledWith('peek');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Continuar la conversación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir la conversación' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    expect(onPresentationChange).toHaveBeenLastCalledWith('expanded');
    const input = screen.getByPlaceholderText('Escribí tu mensaje…');
    await userEvent.type(input, 'hola{Enter}');
    await screen.findByText('te');
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    // Una línea sin el markdown crudo.
    expect(container.querySelector('.aichat-peek-text')).toHaveTextContent('Hola, te ayudo');
  });

  it('controlado: presentation manda y los gestos solo piden el cambio', async () => {
    const onPresentationChange = vi.fn();
    const { container, rerender } = render(
      <ChatDrawer config={config} open presentation="peek" onPresentationChange={onPresentationChange} />,
    );
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    expect(onPresentationChange).toHaveBeenCalledWith('expanded');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    rerender(<ChatDrawer config={config} open presentation="expanded" onPresentationChange={onPresentationChange} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sin control, reabrir después de cerrar desde la barra arranca expandida', async () => {
    render(<ChatDrawer config={config} />);
    await openChat();
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await openChat();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('en escritorio presentation no tiene efecto', () => {
    media.setWidth(1024);
    const { container } = render(<ChatDrawer config={config} open presentation="peek" />);
    expect(sheet(container)).not.toHaveClass('aichat-sheet-peek');
    expect(container.querySelector('.aichat-peek')).toBeNull();
  });
});

describe('ChatDrawer · arrastre', () => {
  function drag(el: Element, from: number, to: number, ms: number) {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(0);
    fireEvent.pointerDown(el, { pointerId: 1, clientY: from, button: 0 });
    fireEvent.pointerMove(el, { pointerId: 1, clientY: (from + to) / 2 });
    fireEvent.pointerMove(el, { pointerId: 1, clientY: to });
    now.mockReturnValue(ms);
    fireEvent.pointerUp(el, { pointerId: 1, clientY: to });
    now.mockRestore();
  }

  it('bajar la cabecera 80px o más minimiza; menos (y lento) no', () => {
    const onPresentationChange = vi.fn();
    const { container } = render(<ChatDrawer config={config} open onPresentationChange={onPresentationChange} />);
    const header = container.querySelector('.aichat-header') as HTMLElement;
    drag(header, 100, 150, 1000);
    expect(onPresentationChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    drag(header, 100, 185, 1000);
    expect(onPresentationChange).toHaveBeenCalledWith('peek');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
  });

  it('un tirón rápido minimiza aunque no llegue al umbral', () => {
    const { container } = render(<ChatDrawer config={config} open />);
    drag(container.querySelector('.aichat-header') as HTMLElement, 100, 130, 20);
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
  });

  it('después de un arrastre (sin click del navegador) el próximo toque funciona', async () => {
    const { container } = render(<ChatDrawer config={config} open />);
    drag(container.querySelector('.aichat-header') as HTMLElement, 100, 200, 1000);
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    clock.mockRestore();
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
  });

  it('el click que el navegador emite justo después del arrastre se descarta', () => {
    const { container } = render(<ChatDrawer config={config} open />);
    const header = container.querySelector('.aichat-header') as HTMLElement;
    drag(header, 100, 130, 1000); // no llega al umbral
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('el scroll de la lista de mensajes no dispara el gesto', () => {
    const onPresentationChange = vi.fn();
    const { container } = render(<ChatDrawer config={config} open onPresentationChange={onPresentationChange} />);
    drag(container.querySelector('.aichat-log') as HTMLElement, 100, 400, 50);
    expect(onPresentationChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('subir la barra minimizada la expande', () => {
    const onPresentationChange = vi.fn();
    const { container } = render(<ChatDrawer config={config} open onPresentationChange={onPresentationChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    const bar = container.querySelector('.aichat-peek') as HTMLElement;
    drag(bar, 300, 280, 1000); // 20px lento: nada
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    drag(bar, 300, 250, 1000);
    expect(onPresentationChange).toHaveBeenLastCalledWith('expanded');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un toque (sin arrastre) en los botones de la cabecera sigue funcionando', async () => {
    const { container } = render(<ChatDrawer config={config} open />);
    const btn = screen.getByRole('button', { name: 'Minimizar' });
    fireEvent.pointerDown(btn, { pointerId: 1, clientY: 20 });
    fireEvent.pointerUp(btn, { pointerId: 1, clientY: 22 });
    await userEvent.click(btn);
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
  });
});

describe('ChatDrawer · scroll lock, viewport y foco', () => {
  it('bloquea el scroll del body con la hoja expandida y restaura la posición al soltar', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 340 });
    render(<ChatDrawer config={config} />);
    await openChat();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-340px');
    expect(document.body.style.overflow).toBe('hidden');

    // En peek el host vuelve a scrollear.
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollTo).toHaveBeenLastCalledWith(0, 340);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    expect(document.body.style.position).toBe('fixed');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(document.body.style.position).toBe('');
    expect(scrollTo).toHaveBeenCalledTimes(2);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('respeta estilos inline previos del body', async () => {
    document.body.style.overflow = 'auto';
    render(<ChatDrawer config={config} open />);
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    expect(document.body.style.overflow).toBe('auto');
  });

  it('sigue a visualViewport (teclado abierto) descontando el hueco de arriba; sin soporte rige el CSS', () => {
    const gap = '(var(--aichat-sheet-gap, 48px) + env(safe-area-inset-top, 0px))';
    const vv = mockVisualViewport(700);
    const { container, unmount } = render(<ChatDrawer config={config} open />);
    expect(sheet(container).style.height).toBe(`calc(700px - ${gap})`);
    act(() => vv.set(380, 60));
    expect(sheet(container).style.height).toBe(`calc(380px - ${gap})`);
    expect(sheet(container).style.top).toBe(`calc(60px + ${gap})`);
    unmount();
    vv.restore();
    const second = render(<ChatDrawer config={config} open />);
    expect(sheet(second.container).style.height).toBe('');
  });

  it('atrapa el foco dentro de la hoja expandida', async () => {
    render(<ChatDrawer config={config} open />);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    const minimize = screen.getByRole('button', { name: 'Minimizar' });
    const input = screen.getByPlaceholderText('Escribí tu mensaje…');
    input.focus();
    // El botón de enviar está deshabilitado: el textarea es el último enfocable.
    await userEvent.tab();
    expect(minimize).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(input).toHaveFocus();
  });

  it('Escape minimiza', async () => {
    const { container } = render(<ChatDrawer config={config} open />);
    await userEvent.keyboard('{Escape}');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
  });

  it('con el menú de conversaciones abierto, Escape cierra solo el menú', async () => {
    mockApi();
    const { container } = render(<ChatDrawer config={config} open enableHistory />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversaciones' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Conversaciones' })).toHaveAttribute('aria-expanded', 'false');
    expect(sheet(container)).not.toHaveClass('aichat-sheet-peek');
  });
});

describe('ChatDrawer · botón atrás del sistema', () => {
  it('abrir suma una entrada (con el state del host); atrás minimiza sin salir de la página', async () => {
    const onPresentationChange = vi.fn();
    const href = location.href;
    const len = history.length;
    const { container } = render(<ChatDrawer config={config} onPresentationChange={onPresentationChange} />);
    await openChat();
    expect(history.length).toBe(len + 1);
    expect(history.state).toEqual({ host: 1, aichatSheet: true });

    await act(async () => history.back());
    await flushPop();
    expect(onPresentationChange).toHaveBeenLastCalledWith('peek');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(history.state).toEqual({ host: 1 });
    expect(location.href).toBe(href);
  });

  it('Minimizar y Cerrar sacan la entrada propia (sin entradas sueltas)', async () => {
    const back = vi.spyOn(history, 'back');
    const { container } = render(<ChatDrawer config={config} />);
    await openChat();
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    await flushPop();
    expect(back).toHaveBeenCalledTimes(1);
    expect(history.state).toEqual({ host: 1 });
    // El popstate de nuestro propio back() no cambia nada.
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    expect(history.state).toEqual({ host: 1, aichatSheet: true });
    // El atrás del usuario vuelve a funcionar después de nuestro propio back().
    await act(async () => history.back());
    await flushPop();
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(back).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await flushPop();
    expect(back).toHaveBeenCalledTimes(3);
    expect(history.state).toEqual({ host: 1 });
  });

  it('si el host ya puso otra entrada arriba, no hace back() (no lo saca de su página)', async () => {
    const back = vi.spyOn(history, 'back');
    render(<ChatDrawer config={config} />);
    await openChat();
    history.pushState({ host: 2 }, '', location.href);
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    await flushPop();
    expect(back).not.toHaveBeenCalled();
    expect(history.state).toEqual({ host: 2 });
  });

  it('una entrada propia que quedó debajo de la del host se saltea al volver', async () => {
    render(<ChatDrawer config={config} />);
    await openChat();
    history.pushState({ host: 2 }, '', location.href);
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    await act(async () => history.back());
    await flushPop();
    expect(history.state).toEqual({ host: 1 });
  });

  it('al montar le saca la marca a la entrada actual (recarga con la hoja abierta)', () => {
    history.replaceState({ host: 1, aichatSheet: true }, '', location.href);
    render(<ChatDrawer config={config} />);
    expect(history.state).toEqual({ host: 1 });
  });

  it('en escritorio no toca el historial', async () => {
    media.setWidth(1024);
    const len = history.length;
    render(<ChatDrawer config={config} />);
    await openChat();
    expect(history.length).toBe(len);
  });
});

describe('ChatDrawer · co-navegación en mobile', () => {
  it('una card catalog en vivo navega una vez y la hoja pasa a peek con "Ver resultados"', async () => {
    mockApi([`event: card\ndata: ${JSON.stringify(catalogFx)}\n\n`, 'event: done\ndata: {}\n\n']);
    const back = vi.spyOn(history, 'back');
    // El host navega detrás, y como el router de Next lo hace después del commit.
    const onNavigateCatalog = vi.fn(() => {
      setTimeout(() => history.pushState({ host: 'catalogo' }, '', location.href), 0);
    });
    const onPresentationChange = vi.fn();
    const onOpenChange = vi.fn();
    const commerce = { onNavigateCatalog, shouldAutoNavigate: () => true };
    const { container } = render(
      <ChatDrawer
        config={config}
        commerce={commerce}
        onPresentationChange={onPresentationChange}
        onOpenChange={onOpenChange}
      />,
    );
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    await openChat();
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflectores{Enter}');
    await waitFor(() => expect(sheet(container)).toHaveClass('aichat-sheet-peek'));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(onPresentationChange).toHaveBeenLastCalledWith('peek');
    expect(container.querySelector('.aichat-peek-text')).toHaveTextContent(
      'Filtros aplicados: Reflectores · Luz cálida · Apto exterior',
    );
    // El host navegó: ni back() ni volver al scroll de la página anterior.
    await flushPop();
    expect(back).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();

    // Expandir y volver: no navega de nuevo y el aviso ya no está.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la conversación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar' }));
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Ver resultados' })).toBeNull();

    // Cerrar desde la barra cierra el chat.
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('"Ver resultados" cierra la hoja', async () => {
    mockApi([`event: card\ndata: ${JSON.stringify(catalogFx)}\n\n`, 'event: done\ndata: {}\n\n']);
    const onOpenChange = vi.fn();
    render(
      <ChatDrawer
        config={config}
        commerce={{ onNavigateCatalog: vi.fn(), shouldAutoNavigate: () => true }}
        onOpenChange={onOpenChange}
      />,
    );
    await openChat();
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflectores{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver resultados' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Abrir chat' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Asistente' })).toBeNull();
  });

  it('en escritorio la card catalog navega sin cambiar la presentación', async () => {
    media.setWidth(1024);
    mockApi([`event: card\ndata: ${JSON.stringify(catalogFx)}\n\n`, 'event: done\ndata: {}\n\n']);
    const onNavigateCatalog = vi.fn();
    const onPresentationChange = vi.fn();
    render(
      <ChatDrawer
        config={config}
        open
        commerce={{ onNavigateCatalog, shouldAutoNavigate: () => true }}
        onPresentationChange={onPresentationChange}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflectores{Enter}');
    await screen.findByText('Filtros aplicados: Reflectores · Luz cálida · Apto exterior');
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(onPresentationChange).not.toHaveBeenCalled();
  });
});

describe('ChatDrawer · otras navegaciones del host en mobile', () => {
  const productsSse = [
    `event: card\ndata: ${JSON.stringify({ type: 'products', items: [{ id: 'p1', label: 'Reflector' }] })}\n\n`,
    'event: done\ndata: {}\n\n',
  ];
  // Como el router de Next: la entrada nueva aparece después del commit.
  const hostPush = (tag: string) => () => {
    setTimeout(() => history.pushState({ host: tag }, '', location.href), 0);
  };

  it('"Ver en el catálogo" (sin navegación automática) pasa a peek sin back()', async () => {
    mockApi([`event: card\ndata: ${JSON.stringify(catalogFx)}\n\n`, 'event: done\ndata: {}\n\n']);
    const back = vi.spyOn(history, 'back');
    const { container } = render(
      <ChatDrawer config={config} commerce={{ onNavigateCatalog: vi.fn(hostPush('catalogo')), shouldAutoNavigate: () => false }} />,
    );
    await openChat();
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflectores{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver en el catálogo' }));
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(container.querySelector('.aichat-peek-text')).toHaveTextContent('Filtros aplicados: Reflectores');
    expect(screen.getByRole('button', { name: 'Ver resultados' })).toBeInTheDocument();
    await flushPop();
    expect(back).not.toHaveBeenCalled();
    expect(history.state).toEqual({ host: 'catalogo' });
  });

  it('abrir un producto pasa a peek sin back() ni restaurar el scroll', async () => {
    mockApi(productsSse);
    const back = vi.spyOn(history, 'back');
    const onOpenProduct = vi.fn(hostPush('ficha'));
    const { container } = render(<ChatDrawer config={config} commerce={{ onOpenProduct }} />);
    await openChat();
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflector{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Reflector' }));
    expect(onOpenProduct).toHaveBeenCalledWith('p1');
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(screen.queryByRole('button', { name: 'Ver resultados' })).toBeNull();
    await flushPop();
    expect(back).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('host que ignora peek: atrás vuelve a nuestra entrada y pide minimizar; el ciclo siguiente saca su entrada', async () => {
    mockApi(productsSse);
    const back = vi.spyOn(history, 'back');
    const onPresentationChange = vi.fn();
    const onOpenChange = vi.fn();
    const props = {
      config,
      presentation: 'expanded' as const, // nunca acepta 'peek'
      onPresentationChange,
      onOpenChange,
      commerce: { onOpenProduct: hostPush('ficha') },
    };
    const { rerender } = render(<ChatDrawer {...props} open />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflector{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Reflector' }));
    await flushPop();
    expect(history.state).toEqual({ host: 'ficha' });
    expect(onPresentationChange).toHaveBeenCalledTimes(1);

    // Atrás desde la ficha: aterriza en nuestra entrada (con la marca). No se queda ahí mudo.
    await act(async () => history.back());
    await flushPop();
    expect(history.state).toEqual({ host: 1, aichatSheet: true });
    expect(onPresentationChange).toHaveBeenCalledTimes(2);
    expect(onPresentationChange).toHaveBeenLastCalledWith('peek');

    // Cerrar: la marca de navegación del host ya no vale; la entrada se saca con back().
    back.mockClear();
    rerender(<ChatDrawer {...props} open={false} />);
    await flushPop();
    expect(back).toHaveBeenCalledTimes(1);
    expect(history.state).toEqual({ host: 1 });
  });

  it('una navegación del host no deja trabado el cierre siguiente (back y scroll)', async () => {
    mockApi([`event: card\ndata: ${JSON.stringify(catalogFx)}\n\n`, 'event: done\ndata: {}\n\n']);
    const back = vi.spyOn(history, 'back');
    const props = {
      config,
      presentation: 'expanded' as const,
      commerce: { onNavigateCatalog: hostPush('catalogo'), shouldAutoNavigate: () => true },
    };
    const { rerender } = render(<ChatDrawer {...props} open />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'reflectores{Enter}');
    await screen.findByText('Filtros aplicados: Reflectores · Luz cálida · Apto exterior');
    await flushPop();
    // El host ignoró 'peek' y cierra: navegó, así que ni back() ni scroll de la página anterior.
    rerender(<ChatDrawer {...props} open={false} />);
    await flushPop();
    expect(back).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();

    // Ciclo siguiente sin navegación: todo vuelve a la normalidad.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    rerender(<ChatDrawer {...props} open />);
    rerender(<ChatDrawer {...props} open={false} />);
    await flushPop();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    expect(back).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 120);
    expect(history.state).toEqual({ host: 'catalogo' });
  });

  it('si el router pisa el state con replaceState (sin la marca), cerrar igual saca la entrada', async () => {
    const back = vi.spyOn(history, 'back');
    render(<ChatDrawer config={config} />);
    await openChat();
    history.replaceState({ router: 'next' }, '', location.href); // se perdió aichatSheet
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await flushPop();
    expect(back).toHaveBeenCalledTimes(1);
    expect(history.state).toEqual({ host: 1 });
  });

  it('sin la marca, el atrás del usuario igual minimiza', async () => {
    const { container } = render(<ChatDrawer config={config} />);
    await openChat();
    history.replaceState({ router: 'next' }, '', location.href);
    await act(async () => history.back());
    await flushPop();
    expect(sheet(container)).toHaveClass('aichat-sheet-peek');
    expect(history.state).toEqual({ host: 1 });
  });
});

describe('ChatDrawer · presentation al abrir', () => {
  it('controlado y dejado en peek: al abrir pide expanded (launcher)', async () => {
    const onPresentationChange = vi.fn();
    render(<ChatDrawer config={config} presentation="peek" onPresentationChange={onPresentationChange} />);
    await openChat();
    expect(onPresentationChange).toHaveBeenCalledWith('expanded');
  });

  it('controlado y dejado en peek: al abrir con sendRequest también', async () => {
    mockApi();
    const onPresentationChange = vi.fn();
    render(
      <ChatDrawer
        config={config}
        presentation="peek"
        onPresentationChange={onPresentationChange}
        sendRequest={{ id: 'r1', text: 'hola' }}
      />,
    );
    await waitFor(() => expect(onPresentationChange).toHaveBeenCalledWith('expanded'));
  });

  it('ya en expanded no emite nada al abrir', async () => {
    const onPresentationChange = vi.fn();
    render(<ChatDrawer config={config} onPresentationChange={onPresentationChange} />);
    await openChat();
    expect(onPresentationChange).not.toHaveBeenCalled();
  });
});

describe('ChatDrawer · teaser', () => {
  const teaser = { id: 't1', text: '¿Le ayudo a encontrarlo?', actionLabel: 'Sí, ayúdeme', dismissLabel: 'Descartar' };

  it('se dibuja sin pedir token ni crear conversación', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
    const fetchToken = vi.fn(async () => 'jwt');
    media.setWidth(1024);
    const { container } = render(
      <ChatDrawer config={{ baseUrl: 'https://api.test', agentId: 'a', fetchToken }} teaser={teaser} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(teaser.text);
    expect(container.querySelector('.aichat-teaser')).toHaveClass('aichat-teaser-bottom-right');
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchToken).not.toHaveBeenCalled();
  });

  it('acción y descarte llaman al host con el id y la ocultan; un id nuevo vuelve a mostrarse', async () => {
    const onTeaserAction = vi.fn();
    const onTeaserDismiss = vi.fn();
    const { rerender } = render(
      <ChatDrawer config={config} teaser={teaser} onTeaserAction={onTeaserAction} onTeaserDismiss={onTeaserDismiss} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sí, ayúdeme' }));
    expect(onTeaserAction).toHaveBeenCalledWith('t1');
    expect(screen.queryByText(teaser.text)).toBeNull();

    const t2 = { ...teaser, id: 't2' };
    rerender(<ChatDrawer config={config} teaser={t2} onTeaserAction={onTeaserAction} onTeaserDismiss={onTeaserDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onTeaserDismiss).toHaveBeenCalledWith('t2');
    expect(screen.queryByText(teaser.text)).toBeNull();
    expect(onTeaserAction).toHaveBeenCalledTimes(1);
  });

  it('se oculta con el chat abierto', async () => {
    render(<ChatDrawer config={config} teaser={teaser} />);
    expect(screen.getByText(teaser.text)).toBeInTheDocument();
    await openChat();
    expect(screen.queryByText(teaser.text)).toBeNull();
  });

  it('en mobile es la píldora arriba del launcher, enfocable con teclado', async () => {
    const { container } = render(<ChatDrawer config={config} teaser={teaser} />);
    expect(container.querySelector('.aichat-root')).toHaveClass('aichat-mobile');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Sí, ayúdeme' })).toHaveFocus();
  });
});

describe('ChatDrawer · hoja con la página asomando y sugerencias', () => {
  it('tocar el fondo atenuado cierra el chat; minimizada no hay fondo', async () => {
    const onOpenChange = vi.fn();
    const { container } = render(<ChatDrawer config={config} open onOpenChange={onOpenChange} />);
    const scrim = container.querySelector('.aichat-scrim') as HTMLElement;
    expect(scrim).not.toBeNull();
    await userEvent.click(scrim);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('la manija es el botón Minimizar y la cabecera no tiene otro', async () => {
    const { container } = render(<ChatDrawer config={config} open />);
    const minimizar = screen.getByRole('button', { name: 'Minimizar' });
    expect(minimizar.className).toContain('aichat-grabber');
    await userEvent.click(minimizar);
    expect(container.querySelector('.aichat-scrim')).toBeNull();
  });

  it('las sugerencias del estado vacío se envían como mensaje', async () => {
    const sent: string[] = [];
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v1/conversations') && init?.method === 'POST') return new Response(JSON.stringify({ id: 'c1' }), { status: 201 });
      if (url.endsWith('/messages') && init?.method === 'POST') {
        sent.push(JSON.parse(String(init.body)).content);
        return new Response('event: done\ndata: {}\n\n', { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }) as never);
    render(<ChatDrawer config={config} open suggestions={['Reflectores para exterior']} />);
    const boton = await screen.findByRole('button', { name: 'Reflectores para exterior' });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    await waitFor(() => expect(sent).toEqual(['Reflectores para exterior']));
  });
});
