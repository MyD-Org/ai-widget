# @myd-org/ai-widget

Embeddable React chat widget for [ai-api](../ai-api).

## Install

```
npm install @myd-org/ai-widget
```

## Drop-in (preset)

```tsx
import { ChatDrawer } from '@myd-org/ai-widget/preset';
import '@myd-org/ai-widget/styles';

<ChatDrawer
  config={{
    baseUrl: 'https://api.tu-tenant.com',
    agentId: 'soporte',
    fetchToken: async () => {
      const r = await fetch('/api/ai-token', { method: 'POST' }); // tu backend mintea el JWT
      return (await r.json()).token;
    },
  }}
  branding={{ title: 'Central Led', primaryColor: '#c4161c' }}
/>
```

`<ChatPanel>` is the inline variant (same props). `showActivity` shows tool/debug
activity (off by default).

### ChatDrawer: controlado, acoplado y pedidos del host

```tsx
<ChatDrawer
  config={config}
  open={open}                 // opcional: controlado por el host
  onOpenChange={setOpen}
  dock={wide ? 'right' : 'none'} // 'right': panel de alto completo, ancho --aichat-dock-width (400px)
  sendRequest={request}       // { id, text }: cada id nuevo abre el chat y envía text una vez
  commerce={{
    resolveProducts,          // suma code, attributes y specUrl para la card spec
    onNavigateCatalog: (filters, card) => ({ undo }), // card catalog
    shouldAutoNavigate: () => onCatalog && wide,      // navegar sola (solo cards en vivo)
  }}
/>
```

Con `dock="right"` el host reserva el ancho en su layout (p.ej. `padding-right:
var(--aichat-dock-width, 400px)`).

En escritorio la cabecera tiene **Cerrar** y Escape cierra el chat (si el menú de conversaciones
está abierto, Escape cierra primero el menú). Con `launcher={false}` no se dibuja la burbuja (ni el
teaser): el host abre el chat con su propio botón (`open`/`onOpenChange` o `sendRequest`) y, al
cerrar, el foco vuelve a ese botón.

### ChatDrawer en mobile

Por debajo de `mobileBreakpoint` (768 px por defecto) el drawer es una hoja a pantalla
completa (`100dvh`, con `env(safe-area-inset-*)`; declarar `viewport-fit=cover` en el meta
viewport). Entre el breakpoint y 1279 px sigue el drawer flotante, y `dock="right"` no cambia
en escritorio (en mobile manda la hoja).

```tsx
<ChatDrawer
  config={config}
  mobileBreakpoint={768}
  presentation={presentation}      // opcional: 'expanded' | 'peek', controlado por el host
  onPresentationChange={setPresentation}
  teaser={{ id: 'sin-resultados', text: '¿Le ayudo a elegir?', actionLabel: 'Sí, ayúdeme', dismissLabel: 'Descartar' }}
  onTeaserAction={(id) => {/* abrir y enviar con sendRequest */}}
  onTeaserDismiss={(id) => {/* contar para el tope */}}
/>
```

- **Hoja expandida**: `role="dialog"` + `aria-modal`, foco atrapado, scroll del body
  bloqueado (se restaura la posición al soltar), cabecera con Minimizar y Cerrar. Sigue a
  `window.visualViewport` para que la caja de texto quede arriba del teclado; el input va a
  16 px (sin zoom de iOS) con `enterkeyhint="send"`.
- **Peek**: barra inferior (`--aichat-peek-height`, 64 px, más la safe-area) con el último
  mensaje del asistente en una línea. Se llega con Minimizar, Escape, el botón atrás del
  sistema o arrastrando la cabecera hacia abajo (80 px o un tirón); arrastrar la barra hacia
  arriba o tocarla la expande. Sin `presentation`, la hoja maneja su estado (abre expandida).
  Controlada: al abrirse el chat (launcher, `sendRequest` u `open`) con `presentation` en
  `'peek'`, el widget llama `onPresentationChange('expanded')` para no reabrir minimizado.
- **Atrás del sistema**: al expandir se suma una entrada al historial (copia el `state` del
  host, así routers como el de Next la reconocen); atrás la saca y minimiza. Al minimizar o
  cerrar por otra vía se saca con `history.back()` solo si sigue arriba de todo (con la marca,
  o sin ella —un `replaceState` del router— pero sin entradas nuevas encima) y el host no
  navegó.
- **Co-navegación**: si una card `catalog` navega (sola en vivo con `shouldAutoNavigate`, una
  única vez por card, o con "Ver en el catálogo"), la hoja pasa a peek con "Filtros aplicados:
  …" y "Ver resultados" (cierra el chat). Abrir un producto (`onOpenProduct`) también la pasa a
  peek, con el último mensaje. En esos casos no hay `history.back()` ni se restaura el scroll
  de la página anterior.
- **Launcher**: 56 px, respeta `safe-area-inset-bottom` y `--aichat-launcher-bottom` (16 px)
  para no tapar barras fijas del host. Se oculta mientras la hoja está abierta.
- **Teaser**: burbuja junto al launcher (píldora arriba de él en mobile). Se dibuja fuera del
  proveedor del chat: no pide token ni crea conversación. Se oculta con el chat abierto y al
  tocar cualquiera de sus botones; un `id` nuevo vuelve a mostrarse. Respeta
  `prefers-reduced-motion`.

Textos nuevos en `labels`: `minimizeLabel`, `closeLabel`, `peekExpandLabel`,
`peekEmptyLabel`, `peekResultsLabel`.

## Headless

```tsx
import { AiChatProvider, useConversation } from '@myd-org/ai-widget';

function MyChat() {
  const { messages, status, send } = useConversation();
  // build your own UI
}

<AiChatProvider config={config}><MyChat /></AiChatProvider>
```

## Auth

The widget never sees the tenant API key. Provide `fetchToken()` returning a
short-lived end-user JWT minted by your backend (`POST /v1/end-user-sessions`).
The widget refreshes it automatically on 401. For demos, pass a static `token`
instead.

## Theming

Override the CSS custom properties after importing the stylesheet:

```css
.aichat-root {
  --aichat-primary: #c4161c;
  --aichat-radius: 8px;
  --aichat-launcher-bottom: 72px; /* mobile: arriba de una barra fija del host */
}
```
