// Entorno mobile simulado para jsdom: matchMedia con ancho configurable, visualViewport y
// PointerEvent (jsdom no trae ninguno de los tres).

type Listener = () => void;

export interface MediaEnv {
  setWidth: (w: number) => void;
  restore: () => void;
}

function evaluate(query: string, width: number): boolean {
  const max = /\(max-width:\s*([\d.]+)px\)/.exec(query);
  if (max) return width <= Number(max[1]);
  const min = /\(min-width:\s*([\d.]+)px\)/.exec(query);
  if (min) return width >= Number(min[1]);
  return false;
}

export function mockMatchMedia(initialWidth: number): MediaEnv {
  let width = initialWidth;
  const listeners = new Set<Listener>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return evaluate(query, width);
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    addListener: (l: Listener) => listeners.add(l),
    removeListener: (l: Listener) => listeners.delete(l),
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  return {
    setWidth(w) {
      width = w;
      for (const l of [...listeners]) l();
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

export interface ViewportEnv {
  set: (height: number, offsetTop?: number) => void;
  restore: () => void;
}

export function mockVisualViewport(height: number, offsetTop = 0): ViewportEnv {
  const target = new EventTarget() as EventTarget & { height: number; offsetTop: number };
  target.height = height;
  target.offsetTop = offsetTop;
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: target });
  return {
    set(h, top = 0) {
      target.height = h;
      target.offsetTop = top;
      target.dispatchEvent(new Event('resize'));
    },
    restore() {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    },
  };
}

export function installPointerEvent(): void {
  if (typeof window.PointerEvent === 'function') return;
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'touch';
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}
