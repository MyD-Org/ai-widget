import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/** Presentación de la hoja mobile: a pantalla completa o minimizada en una barra inferior. */
export type ChatPresentation = 'expanded' | 'peek';

/** `matchMedia` como estado. Sin `matchMedia` (SSR, jsdom) es `false`: el widget se comporta
 *  como en escritorio. En la hidratación usa el valor del servidor (false) y después se ajusta. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    },
    [query],
  );
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  return useSyncExternalStore(subscribe, get, () => false);
}

export interface ViewportBox {
  height: number;
  offsetTop: number;
}

/** Alto y desplazamiento del `visualViewport` mientras `active`. Con el teclado de iOS/Android
 *  abierto el viewport visual se achica (y en iOS se corre): la hoja lo sigue para que la caja
 *  de texto quede siempre arriba del teclado. Sin soporte devuelve null y rige el `100dvh`. */
export function useVisualViewport(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) {
      setBox(null);
      return;
    }
    const update = () =>
      setBox((prev) =>
        prev && prev.height === vv.height && prev.offsetTop === vv.offsetTop
          ? prev
          : { height: vv.height, offsetTop: vv.offsetTop },
      );
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return box;
}

/** Bloquea el scroll del body mientras `active` (position: fixed con el desplazamiento guardado,
 *  que en iOS es lo único que evita el scroll de fondo) y al soltar restaura estilos y posición.
 *  No restaura la posición si cambió la URL o si `skipRestoreRef` está en true (el host navegó
 *  detrás de la hoja): volver al scroll de otra página sería un salto sin sentido. */
export function useBodyScrollLock(active: boolean, skipRestoreRef: MutableRefObject<boolean>): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const { body } = document;
    const y = window.scrollY || 0;
    const href = window.location.href;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      Object.assign(body.style, prev);
      // El dueño del ref lo limpia: acá solo se lee (otros efectos de la misma transición
      // también lo consultan).
      if (!skipRestoreRef.current && window.location.href === href) window.scrollTo(0, y);
    };
  }, [active, skipRestoreRef]);
}

const DRAG_SLOP = 6;
const FLICK_VELOCITY = 0.5; // px/ms
const FLICK_MIN = 20;

/** Arrastre vertical con umbral o velocidad (p.ej. bajar la cabecera para minimizar). `dir` 1 es
 *  hacia abajo, -1 hacia arriba. Solo se engancha en el elemento que recibe los handlers, así
 *  el scroll de la lista de mensajes nunca lo dispara. Con menos de `DRAG_SLOP` px es un toque
 *  (los botones siguen funcionando); un arrastre de verdad se come el click que le sigue. */
export function useVerticalDrag({
  dir,
  threshold,
  onCommit,
  targetRef,
}: {
  dir: 1 | -1;
  threshold: number;
  onCommit: () => void;
  /** Elemento que sigue al dedo mientras se arrastra (translateY). Opcional. */
  targetRef?: MutableRefObject<HTMLElement | null>;
}) {
  const start = useRef<{ id: number; y: number; t: number; dragging: boolean } | null>(null);
  // Hasta cuándo descartar el click que sigue a un arrastre (si el navegador lo emite). Por
  // tiempo y no por bandera: en touch, un arrastre real muchas veces no produce click, y una
  // bandera quedaría armada comiéndose el próximo toque legítimo.
  const suppressClickUntil = useRef(0);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const setOffset = (dy: number) => {
    const el = targetRef?.current;
    if (!el) return;
    el.style.transform = dy > 0 ? `translateY(${dir * dy}px)` : '';
    el.style.transition = dy > 0 ? 'none' : '';
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { id: e.pointerId, y: e.clientY, t: now(), dragging: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dy = (e.clientY - s.y) * dir;
    if (!s.dragging) {
      if (dy < DRAG_SLOP) return;
      s.dragging = true;
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* sin pointer capture: el arrastre sigue igual mientras el dedo esté encima */
      }
    }
    setOffset(Math.max(0, dy));
  };
  const finish = (e: ReactPointerEvent, cancelled: boolean) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId || !s.dragging) return;
    setOffset(0);
    suppressClickUntil.current = Date.now() + 400;
    if (cancelled) return;
    const dy = (e.clientY - s.y) * dir;
    const dt = Math.max(1, now() - s.t);
    if (dy >= threshold || (dy >= FLICK_MIN && dy / dt >= FLICK_VELOCITY)) onCommitRef.current();
  };
  const onClickCapture = (e: ReactMouseEvent) => {
    if (Date.now() >= suppressClickUntil.current) return;
    suppressClickUntil.current = 0;
    e.preventDefault();
    e.stopPropagation();
  };
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent) => finish(e, true),
    onClickCapture,
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elementos enfocables visibles dentro de `root` (excluye lo oculto con hidden/aria-hidden,
 *  como el menú de conversaciones cerrado). */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden], [aria-hidden="true"]'),
  );
}

/** Una línea legible del markdown de un mensaje (para la barra minimizada). */
export function oneLine(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
