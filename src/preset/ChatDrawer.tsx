import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { AiChatProvider } from '../hooks/AiChatProvider';
import { resolveLabels } from './labels';
import { brandingStyle, themeClass } from './branding';
import { ChatBody, type ChatRequest, type SheetControls } from './ChatBody';
import type { ChatPresetProps } from './ChatPanel';
import {
  focusableIn,
  useBodyScrollLock,
  useMediaQuery,
  useVisualViewport,
  type ChatPresentation,
} from './mobile';
import { SheetContext, type SheetContextValue } from './sheetContext';

/** Invitación proactiva junto al launcher (se dibuja fuera del proveedor del chat: no pide token
 *  ni crea conversación). */
export interface ChatTeaser {
  /** Identifica la invitación en los callbacks; un id nuevo vuelve a mostrarse. */
  id: string;
  text: string;
  actionLabel: string;
  /** Nombre accesible del botón que la descarta. */
  dismissLabel: string;
}

export interface ChatDrawerProps extends ChatPresetProps {
  /** Abierto/cerrado controlado por el host. Sin `open`, el drawer maneja su propio estado
   *  (como siempre) y `onOpenChange` solo avisa. */
  open?: boolean;
  /** Se llama cuando el widget quiere abrir o cerrar (launcher, `sendRequest`). */
  onOpenChange?: (open: boolean) => void;
  /** 'right': panel acoplado a la derecha, de alto completo (`--aichat-dock-width`, 400px por
   *  defecto). El host reserva el ancho en su layout. 'none' (default): drawer flotante. Por
   *  debajo de `mobileBreakpoint` manda la hoja mobile. */
  dock?: 'none' | 'right';
  /** Pedido del host para enviar un mensaje del usuario (p.ej. "Conversar" desde el catálogo).
   *  Cada `id` nuevo (no vacío) abre el chat y envía `text` una sola vez, cuando la conversación
   *  está lista. Un `id` ya visto no se reenvía, ni al cerrar y volver a abrir. */
  sendRequest?: ChatRequest;
  /** Ancho (px) por debajo del cual el chat es una hoja a pantalla completa. Default 768. */
  mobileBreakpoint?: number;
  /** Presentación de la hoja mobile, controlada por el host. Sin esto, la hoja maneja su propio
   *  estado (abre expandida) y `onPresentationChange` solo avisa. Sin efecto en escritorio. */
  presentation?: ChatPresentation;
  /** Se llama cuando la hoja quiere expandirse o minimizarse (botón, arrastre, Escape, botón
   *  atrás del sistema, card `catalog` que navegó sola). */
  onPresentationChange?: (presentation: ChatPresentation) => void;
  /** Invitación junto al launcher (burbuja en escritorio, píldora en mobile). Se oculta con el
   *  chat abierto y al tocar cualquiera de sus botones. */
  teaser?: ChatTeaser;
  /** false: no se dibuja el launcher (ni el teaser, que va pegado a él). El host abre el chat
   *  con su propio botón vía `open`/`onOpenChange` o `sendRequest`; se cierra con la X de la
   *  cabecera o Escape. Al cerrar, el foco vuelve a lo que lo tenía antes de abrir. Default true. */
  launcher?: boolean;
  onTeaserAction?: (id: string) => void;
  onTeaserDismiss?: (id: string) => void;
}

const SHEET_STATE_KEY = 'aichatSheet';

/** Hueco arriba de la hoja expandida: la página del host asoma (atenuada) y tocarla cierra. */
const SHEET_GAP = '(var(--aichat-sheet-gap, 48px) + env(safe-area-inset-top, 0px))';

function historyStateIsOurs(): boolean {
  const st: unknown = window.history.state;
  return typeof st === 'object' && st !== null && (st as Record<string, unknown>)[SHEET_STATE_KEY] === true;
}

export function ChatDrawer({
  config,
  branding,
  labels,
  showActivity = false,
  className,
  enableCopy = false,
  enableHistory = false,
  theme = 'auto',
  onSendToChannel,
  onUseBudget,
  onUseMessage,
  commerce,
  suggestions,
  open: openProp,
  onOpenChange,
  dock = 'none',
  sendRequest,
  mobileBreakpoint = 768,
  presentation: presentationProp,
  onPresentationChange,
  teaser,
  onTeaserAction,
  onTeaserDismiss,
  launcher = true,
}: ChatDrawerProps) {
  const resolved = resolveLabels(labels);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const [floatExpanded, setFloatExpanded] = useState(false);
  const pos = branding?.launcherPosition ?? 'bottom-right';
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint - 0.02}px)`);
  const docked = dock === 'right' && !isMobile;

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openRef = useRef(open);
  openRef.current = open;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [controlled],
  );

  // Presentación de la hoja mobile: controlada si el host pasa `presentation`.
  const [internalPresentation, setInternalPresentation] = useState<ChatPresentation>('expanded');
  const presentationControlled = presentationProp !== undefined;
  const presentation = presentationControlled ? presentationProp : internalPresentation;
  const onPresentationChangeRef = useRef(onPresentationChange);
  onPresentationChangeRef.current = onPresentationChange;
  const setPresentation = useCallback(
    (next: ChatPresentation) => {
      if (!presentationControlled) setInternalPresentation(next);
      onPresentationChangeRef.current?.(next);
    },
    [presentationControlled],
  );
  const [peekNotice, setPeekNotice] = useState<string | null>(null);

  const sheetOpen = open && isMobile;
  const sheetExpanded = sheetOpen && presentation === 'expanded';
  const sheetExpandedRef = useRef(sheetExpanded);
  sheetExpandedRef.current = sheetExpanded;
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  // Al cerrar, la próxima apertura (sin control del host) arranca expandida y sin aviso. Al
  // abrir (launcher, sendRequest, `open` del host) con la presentación en 'peek', se pide
  // 'expanded': un host que controla `presentation` y la dejó minimizada no reabre en la barra.
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!open) {
      setInternalPresentation('expanded');
      setPeekNotice(null);
      return;
    }
    if (opening && presentationRef.current !== 'expanded') setPresentation('expanded');
  }, [open, setPresentation]);

  // El host navegó detrás de la hoja (una card lo pidió): ni se restaura el scroll de la página
  // anterior ni se hace history.back() (volvería a la URL de antes, deshaciendo la navegación).
  // Solo vale mientras la hoja está expandida con su entrada puesta; lo consume la próxima
  // salida de la expansión (minimizar o cerrar) y se limpia al volver a expandir.
  const hostNavigatedRef = useRef(false);
  useBodyScrollLock(sheetExpanded, hostNavigatedRef);
  const viewport = useVisualViewport(sheetExpanded);

  // Botón atrás del sistema: con la hoja expandida hay una entrada propia en el historial (copia
  // del state del host + marca, así un router como el de Next la reconoce como suya). Atrás la
  // saca y la hoja se minimiza en vez de salir de la página. Al minimizar o cerrar por otra vía
  // la sacamos con history.back(), solo si sigue arriba de todo. Nunca desde un cleanup: el
  // doble montaje de StrictMode dispararía un back() asíncrono contra la hoja recién abierta.
  // pushedRef: nuestra entrada está puesta (y no la sacamos). No se depende solo de la marca en
  // history.state: el router de Next puede hacer replaceState y perderla; por eso también se
  // guarda history.length (un replaceState no lo cambia, un push del host sí). pushedHrefRef: la
  // URL al ponerla; si cambió, el host navegó aunque no nos haya avisado.
  const pushedRef = useRef(false);
  const pushedHrefRef = useRef('');
  const pushedLengthRef = useRef(0);
  const ignorePopRef = useRef(0);
  // Si la página se recargó con la hoja abierta, la entrada actual (una página real del host)
  // quedó con la marca: se la sacamos para no saltearla después como si fuera vieja.
  useEffect(() => {
    if (typeof window === 'undefined' || !historyStateIsOurs()) return;
    const rest = { ...(window.history.state as Record<string, unknown>) };
    delete rest[SHEET_STATE_KEY];
    window.history.replaceState(rest, '', window.location.href);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sheetExpanded) {
      if (!pushedRef.current) {
        pushedRef.current = true;
        pushedHrefRef.current = window.location.href;
        hostNavigatedRef.current = false;
        const st: unknown = window.history.state;
        const base = typeof st === 'object' && st !== null ? (st as Record<string, unknown>) : {};
        window.history.pushState({ ...base, [SHEET_STATE_KEY]: true }, '', window.location.href);
        pushedLengthRef.current = window.history.length;
      }
      return;
    }
    // Salió de la expansión (minimizar, cerrar, pasar a escritorio).
    const hostNavigated = hostNavigatedRef.current || window.location.href !== pushedHrefRef.current;
    hostNavigatedRef.current = false;
    if (!pushedRef.current) return;
    pushedRef.current = false;
    // Nuestra entrada sigue arriba: con la marca, o sin ella pero sin entradas nuevas encima.
    const onTop = historyStateIsOurs() || window.history.length === pushedLengthRef.current;
    if (!hostNavigated && onTop) {
      ignorePopRef.current += 1;
      window.history.back();
    }
  }, [sheetExpanded]);
  useEffect(() => {
    const onPop = () => {
      if (ignorePopRef.current > 0) {
        ignorePopRef.current -= 1;
        return;
      }
      const onOurs = historyStateIsOurs();
      if (pushedRef.current && (!onOurs || hostNavigatedRef.current)) {
        // Atrás del usuario. Sin nuestra marca, la entrada ya salió: solo queda minimizar. Con la
        // marca pero con una navegación del host en el medio (que no minimizó la hoja), volvió a
        // nuestra entrada: se minimiza y la transición la saca con back() como siempre.
        if (!onOurs) pushedRef.current = false;
        hostNavigatedRef.current = false;
        pushedHrefRef.current = window.location.href;
        setPresentation('peek');
      } else if (!pushedRef.current && onOurs) {
        // Entrada vieja (quedó debajo de una navegación del host): se saltea sin detenerse.
        ignorePopRef.current += 1;
        window.history.back();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setPresentation]);

  // Escape cierra el chat en escritorio (flotante o acoplado). El menú de conversaciones corta la
  // propagación de su Escape, así primero se cierra él.
  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isMobile, setOpen]);

  // Sin launcher, el foco vuelve al cerrar a lo que lo tenía al abrir (el botón del host).
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (launcher) return;
    if (open) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      return;
    }
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || !document.contains(active);
    if (el && focusLost && document.contains(el)) el.focus();
  }, [open, launcher]);

  // Escape minimiza la hoja. En window: el menú de conversaciones escucha en document y corta la
  // propagación, así su Escape lo cierra a él y no a la hoja.
  useEffect(() => {
    if (!sheetExpanded) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setPresentation('peek');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetExpanded, setPresentation]);

  // Foco: al expandir entra a la hoja; al minimizar va a la barra; al cerrar vuelve al launcher.
  const drawerRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const prevSheet = useRef<'closed' | ChatPresentation>('closed');
  useEffect(() => {
    const now: 'closed' | ChatPresentation = sheetOpen ? presentation : 'closed';
    const before = prevSheet.current;
    prevSheet.current = now;
    if (now === before) return;
    const el = drawerRef.current;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || !document.contains(active);
    if (now === 'expanded' && el && !el.contains(active)) el.focus();
    else if (now === 'peek' && el && (focusLost || el.contains(active)))
      el.querySelector<HTMLElement>('.aichat-peek-main')?.focus();
    else if (now === 'closed' && before !== 'closed' && focusLost) launcherRef.current?.focus();
  }, [sheetOpen, presentation]);

  const onSheetKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!sheetExpanded || e.key !== 'Tab') return;
    const root = drawerRef.current;
    if (!root) return;
    const nodes = focusableIn(root);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // El pedido pendiente vive acá y no en ChatBody: el cuerpo se desmonta al cerrar, y un
  // "ya enviado" guardado adentro se perdería (el mismo pedido se reenviaría al reabrir).
  const [pending, setPending] = useState<ChatRequest | null>(null);
  const lastRequestId = useRef<string | null>(null);
  const requestText = sendRequest?.text ?? '';
  const requestId = sendRequest?.id ?? '';
  useEffect(() => {
    if (!requestId || requestId === lastRequestId.current) return;
    lastRequestId.current = requestId;
    setPending({ id: requestId, text: requestText });
    if (!openRef.current) setOpen(true);
    // Solo un id nuevo dispara el pedido; el texto viaja con él.
  }, [requestId]);
  const onRequestSent = useCallback((id: string) => {
    setPending((p) => (p?.id === id ? null : p));
  }, []);

  // Co-navegación en mobile: una card hizo navegar al host (catálogo, ficha de producto) → la
  // hoja pasa a "peek" para que se vea la página nueva; con catálogo, con el aviso de filtros.
  const catalogAppliedRef = useRef(resolved.catalogAppliedLabel);
  catalogAppliedRef.current = resolved.catalogAppliedLabel;
  const sheetContext = useMemo<SheetContextValue>(
    () => ({
      onHostNavigated: (notice) => {
        if (!isMobileRef.current || !openRef.current) return;
        if (sheetExpandedRef.current && pushedRef.current) hostNavigatedRef.current = true;
        setPeekNotice(notice ? catalogAppliedRef.current.replace('{summary}', notice.catalogSummary) : null);
        setPresentation('peek');
      },
    }),
    [setPresentation],
  );

  const sheetControls: SheetControls | undefined = sheetOpen
    ? {
        presentation,
        notice: presentation === 'peek' ? peekNotice : null,
        onMinimize: () => setPresentation('peek'),
        onExpand: () => {
          setPeekNotice(null);
          setPresentation('expanded');
        },
        onClose: () => setOpen(false),
        onViewResults: () => setOpen(false),
      }
    : undefined;

  // Teaser: se descarta localmente al tocarlo, sin esperar a que el host saque la prop.
  const [teaserDone, setTeaserDone] = useState<string | null>(null);
  const showTeaser = Boolean(launcher && teaser && teaser.id && !open && teaserDone !== teaser.id);

  let drawerClass: string;
  let drawerStyle: CSSProperties | undefined;
  if (isMobile) {
    drawerClass = `aichat-drawer aichat-sheet ${presentation === 'peek' ? 'aichat-sheet-peek' : ''}`;
    if (sheetExpanded && viewport) {
      drawerStyle = {
        top: `calc(${viewport.offsetTop}px + ${SHEET_GAP})`,
        bottom: 'auto',
        height: `calc(${viewport.height}px - ${SHEET_GAP})`,
      };
    }
  } else if (docked) {
    drawerClass = 'aichat-drawer aichat-drawer-dock aichat-dock';
  } else {
    drawerClass = `aichat-drawer aichat-drawer-${pos} ${floatExpanded ? 'aichat-drawer-expanded' : ''}`;
  }
  const title = branding?.title ?? resolved.headerTitle;

  return (
    <div
      className={`aichat-root ${themeClass(theme)} ${isMobile ? 'aichat-mobile' : ''} ${className ?? ''}`}
      style={brandingStyle(branding)}
    >
      {sheetExpanded && <div className="aichat-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <div
          ref={drawerRef}
          className={drawerClass}
          style={drawerStyle}
          {...(sheetExpanded
            ? { role: 'dialog', 'aria-modal': true, 'aria-label': title, tabIndex: -1, onKeyDown: onSheetKeyDown }
            : {})}
        >
          <SheetContext.Provider value={sheetContext}>
            <AiChatProvider config={config}>
              <ChatBody
                branding={branding}
                labels={resolved}
                showActivity={showActivity}
                enableCopy={enableCopy}
                enableHistory={enableHistory && !config.conversationId}
                expanded={floatExpanded}
                onToggleExpand={docked || isMobile ? undefined : () => setFloatExpanded((e) => !e)}
                onSendToChannel={onSendToChannel}
                onUseBudget={onUseBudget}
                onUseMessage={onUseMessage}
                commerce={commerce}
                suggestions={suggestions}
                pendingRequest={pending}
                onRequestSent={onRequestSent}
                sheet={sheetControls}
                onClose={isMobile ? undefined : () => setOpen(false)}
              />
            </AiChatProvider>
          </SheetContext.Provider>
        </div>
      )}
      {showTeaser && teaser && (
        <div className={`aichat-teaser aichat-teaser-${pos}`} role="group" aria-label={title}>
          <p className="aichat-teaser-text" role="status">
            {teaser.text}
          </p>
          <div className="aichat-teaser-actions">
            <button
              type="button"
              className="aichat-teaser-action"
              onClick={() => {
                setTeaserDone(teaser.id);
                onTeaserAction?.(teaser.id);
              }}
            >
              {teaser.actionLabel}
            </button>
            <button
              type="button"
              className="aichat-teaser-dismiss"
              aria-label={teaser.dismissLabel}
              title={teaser.dismissLabel}
              onClick={() => {
                setTeaserDone(teaser.id);
                onTeaserDismiss?.(teaser.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {launcher && (
      <button
        ref={launcherRef}
        type="button"
        aria-label={resolved.launcherAria}
        className={`aichat-launcher aichat-launcher-${pos}`}
        hidden={sheetOpen}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      )}
    </div>
  );
}
