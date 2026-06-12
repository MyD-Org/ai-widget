# Diseño — `@myd-org/ai-widget` (widget React embebible para ai-api)

Fecha: 2026-06-11
Estado: aprobado (brainstorm)
Subproyecto 2 del venture (ver `ai-api`).

## Objetivo

Convertir el flujo de la página de prueba de `ai-api` (`public/index.html`: mintea
sesión → crea conversación → envía mensaje → consume SSE) en un paquete React
embebible que un cliente (tenant) pega en su web. Doble objetivo:

- **Federico hoy:** chat de soporte/ventas en la web de la tienda con una sola línea.
- **Producto vendible:** reutilizable por otros tenants, con UI propia si la quieren.

El widget es un **cliente HTTP fino**. Toda la inteligencia (tools, memoria,
guardrails, modelo) vive en `ai-api`. El widget nunca ve la API key del tenant ni
el modelo: solo mintea/usa un JWT de sesión de usuario final y consume el stream.

## Decisiones (del brainstorm)

| Decisión | Elección |
|---|---|
| Repo | **Separado**, hermano de `ai-api`, bajo `github.com/MyD-Org` |
| Consumidor | **Apps React** (paquete npm React puro, sin Web Component ni loader `<script>`) |
| Qué expone | **Headless + preset drop-in** (hooks para UI a medida + componentes estilados) |
| Auth | **`fetchToken()` callback** (la API key vive en el backend del tenant), con atajo de `token` estático para demo |
| Form factor | **Ambas variantes**: `<ChatDrawer>` (flotante) y `<ChatPanel>` (inline) sobre el mismo núcleo |
| Theming | CSS custom properties + props `branding`/`labels` |

## Distribución y toolchain

- **Paquete:** `@myd-org/ai-widget`, scoped y privado, publicado a **GitHub Packages**
  (control de acceso por org sin pagar npm privado; migrable a npm público sin tocar código).
- **Build:** `tsup` (esbuild). Genera ESM + CJS + `.d.ts`. `react` y `react-dom` como
  `peerDependencies` (no se bundlean). CSS emitido como archivo aparte.
- **Exports multi-entry** (`package.json`):
  - `.` → capa headless (hooks + tipos + cliente SSE)
  - `./preset` → `<ChatDrawer>`, `<ChatPanel>` estilados
  - `./styles` → CSS del preset
- **Node/React:** React 18+ como peer.

## Arquitectura de capas

Cuatro capas, cada una testeable en aislamiento. Frontera dura: **los hooks no
renderizan, el preset no parsea SSE.**

```
┌─ preset/   ChatDrawer, ChatPanel   (UI estilada, branding, i18n)
│            └─ usa ─┐
├─ hooks/    useConversation()       (estado: messages, status, send())
│            useChatSession()        (token: fetch + refresh ante 401)
│            AiChatProvider          (sostiene config + client + sesión)
│            └─ usa ─┐
├─ client/   createApiClient()       (fetch tipado de los endpoints REST)
│            streamMessage()         (parser SSE: bloques \n\n, líneas event:/data:)
│            └─ habla con ─┐
└─ (red)     ai-api  /v1/end-user-sessions, /v1/conversations, SSE
```

### `client/` (sin React)

- `createApiClient(config)` → métodos tipados:
  - `createConversation(agentId)` → `POST /v1/conversations` → `{ id }`
  - `listMessages(conversationId)` → `GET /v1/conversations/:id/messages` →
    `[{ id, role, text, created_at }]`
  - (sesión: ver auth abajo)
- `async function* streamMessage(client, conversationId, content)` →
  `POST /v1/conversations/:id/messages` y rinde `ChatEvent` tipados a medida que
  llegan. Es el corazón y el único punto delicado. Función pura sobre el
  `ReadableStream`: testeable con un stream falso, sin React ni red.

```ts
type ChatEvent =
  | { type: 'text';  delta: string }
  | { type: 'tool';  name: string }
  | { type: 'done';  usage: object; rounds: number; stoppedByMaxRounds: boolean; stopReason: string }
  | { type: 'error'; code: string }
  // opcionales (solo si el tenant tiene debug_events):
  | { type: 'debug_context';     data: object }
  | { type: 'debug_tool_call';   data: object }
  | { type: 'debug_tool_result'; data: object }
```

El parser separa el buffer por `\n\n`, parsea líneas `event: <x>` y `data: <json>`,
y mapea a `ChatEvent`. Soporta `AbortSignal` para cancelar al desmontar / cerrar.

### `hooks/` (React, headless, sin estilo)

```ts
type AiChatConfig = {
  baseUrl: string;                      // base del ai-api del tenant
  agentId: string;                      // p.ej. soporte | ventas
  fetchToken?: () => Promise<string>;   // mintea/refresca el JWT (prod)
  token?: string;                       // atajo estático (demo); excluye fetchToken
  persist?: 'session' | 'none';         // reanudar conversación tras F5 (default 'session')
};

<AiChatProvider config={config}>{children}</AiChatProvider>

const {
  messages,   // [{ id, role: 'user'|'assistant', text }]
  status,     // 'idle' | 'streaming' | 'error'
  activity,   // null | { tool: string }  — "buscando productos…", no entra a messages
  error,      // null | { code: string }
  send,       // (text: string) => void
  retry,      // () => void  — reintenta el último envío
  reset,      // () => void  — nueva conversación (limpia id persistido)
} = useConversation();
```

- `messages` usa el mismo shape render-friendly que devuelve `GET /:id/messages`,
  así historial cargado y deltas del stream comparten tipo.
- Los eventos `tool` y `debug_*` **no** entran a `messages`: van a `activity`
  (y a un canal de debug opt-in). Mantiene la transcripción limpia.

### `preset/` (React, estilado)

```tsx
<ChatDrawer config={config} branding={...} labels={...} showActivity={false} />
<ChatPanel  config={config} branding={...} labels={...} showActivity={false} />
```

- Montan internamente `AiChatProvider` + `useConversation`. Drop-in de una línea.
- `<ChatDrawer>`: botón flotante (launcher) + panel deslizante. No ocupa layout.
- `<ChatPanel>`: contenedor inline para una página/sección dedicada.
- `showActivity` (default `false`): muestra el panel "detrás de escena" (eventos
  `tool`/`debug_*`) — útil en demo, off en producción.

## Auth y ciclo de conversación

### Token (`useChatSession`)

- Al montar invoca `fetchToken()` (o usa `token` estático) y guarda el JWT
  **en memoria** (nunca en storage: es sensible y dura ~1h).
- Toda request lleva `Authorization: Bearer <jwt>`.
- Ante **401** o error pre-stream de auth: invalida el token, re-invoca
  `fetchToken()` **una vez** y reintenta. Si vuelve a fallar → `status: 'error'`,
  `error.code = 'auth'`.
- El minteo en sí lo hace el backend del tenant (con la API key) vía
  `POST /v1/end-user-sessions`. El widget **no** llama a ese endpoint: recibe el
  JWT ya minteado desde `fetchToken()`.

### Conversación

- Primer `send()` sin conversación activa → `POST /v1/conversations {agentId}`,
  guarda el `id`.
- Persiste el `id` en **`sessionStorage`** (no el token) si `persist: 'session'`.
  Al montar, si hay `id`, hace `GET /:id/messages` y rehidrata `messages` (reanudar
  tras recarga).
- `reset()` limpia el `id` persistido y arranca de cero.

### Errores

El contrato distingue errores pre-stream (HTTP) de errores dentro del stream
(`event: error`). El hook los unifica en `error.code`, pero el preset puede
mapear cada uno a un mensaje distinto:

| Origen | `error.code` | Trato sugerido en preset |
|---|---|---|
| HTTP 401 | `auth` | "Sesión expirada" (tras fallar el refresh) |
| HTTP 404 | `not_found` | conversación/agente ajeno o inactivo |
| HTTP 429 | `rate_limit` | "Demasiados mensajes, probá en un momento" |
| `event: error` | `<code del backend>` | mensaje genérico de error del asistente |

## Theming / branding

- **CSS custom properties** como tokens: `--aichat-primary`, `--aichat-radius`,
  `--aichat-font`, `--aichat-bg`, `--aichat-text`, etc. El consumidor importa
  `@myd-org/ai-widget/styles` y sobrescribe variables.
- **Prefijo de clases `aichat-`** en todo para no chocar con la web anfitriona.
- **Prop `branding`** para las perillas comunes:
  `{ title, subtitle?, avatarUrl?, primaryColor?, launcherPosition?: 'bottom-right' | 'bottom-left' }`.
  `primaryColor` solo setea `--aichat-primary` inline.
- **Prop `labels`** con todos los textos (defaults en español, i18n-ready):
  `{ placeholder, sendLabel, newConversation, headerTitle, errorAuth, errorRateLimit, errorGeneric, ... }`.

## Testing

vitest + `@testing-library/react` + jsdom. Sin MSW: un `fetch` falso que devuelve
`ReadableStream`s controlados (igual que opera el demo-server de `ai-api`).

1. **`client/` (unit):**
   - `streamMessage` alimentado con un `ReadableStream` de bytes SSE (incluyendo
     bloques partidos a la mitad) → asserts sobre los `ChatEvent` rendidos, en orden.
   - `createApiClient` con `fetch` mockeado → arma URLs/headers/cuerpos correctos;
     mapea 401/404/429 a errores tipados.
2. **`hooks/`:** `renderHook` con cliente mockeado → transiciones de `status`,
   acumulación de `messages`, `activity` ante `tool`, refresh de token ante 401,
   reanudar conversación desde `sessionStorage`.
3. **`preset/`:** render de `ChatDrawer`/`ChatPanel` con provider mock → abre el
   drawer, envía, muestra streaming, muestra estados de error mapeados.

## Fuera de alcance (YAGNI)

- Web Component / loader `<script>` para sitios no-React (consumidor confirmado React).
- Wrappers para Vue / React Native (la frontera `client/` lo deja abierto, pero no se construye).
- Adjuntos, audio, markdown rico en mensajes (el contrato hoy es texto plano).
- i18n runtime con catálogos: alcanza con la prop `labels` y defaults en español.
- Persistencia cross-device del historial (vive en el backend; el widget solo reanuda por `sessionStorage`).

## Referencias

- Contrato de la API: ver memoria `ai-api-estado` y `ai-api/public/index.html` (flujo vanilla de referencia).
- Patrón de paquete: `@nullplatform/react-ai-chat` (`~/Documents/projects/null/frontend-packages/packages/react-ai-chat`) — hooks + presets + styles + exports multi-entry.
- agent_ids de demo: soporte `bda5668e-339b-4921-9900-d04ff1e36fd1`, ventas `439bb2b1-0ea3-43de-a8f6-b73bc31b9822`.
