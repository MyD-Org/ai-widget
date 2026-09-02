# Auto-reset por inactividad y aviso de max rounds

Fecha: 2026-09-02
Estado: aprobado (diseño)

## Contexto

El widget de chat mantiene la conversación abierta indefinidamente mientras la pestaña
sigue abierta: el id se persiste en `sessionStorage` (`aichat:conv:{agentId}`,
default `persist: 'session'`) y solo se corta si el usuario aprieta "Nueva conversación".
El historial completo lo mantiene el backend, así que cada mensaje cuesta más tokens que
el anterior en una conversación larga.

Además, el evento SSE `done` ya trae `stopped_by_max_rounds` (parseado en
`apiClient.ts` como `stoppedByMaxRounds`), pero el front lo ignora por completo: si el
backend corta la conversación por límite de rounds, el usuario no se entera.

## Objetivos

1. Reiniciar la conversación automáticamente tras 30 minutos de inactividad, con aviso
   visible para el usuario.
2. Detectar en el front el corte por max rounds del backend y avisar en el chat.

## Decisiones de diseño (aprobadas)

- **Timeout fijo de 30 minutos**, como constante del hook (no configurable vía
  `AiChatConfig`; YAGNI — el único consumidor actual no lo necesita).
- **Chequeo lazy**: no hay timers. Se evalúa la expiración al próximo `send()`.
- **Aviso + nueva conversación** (no reset silencioso): el usuario entiende por qué
  perdió el contexto.
- **Max rounds: solo aviso en el chat**, sin auto-reset. El usuario decide cuándo
  iniciar una nueva conversación.

## Diseño

### 1. Estado de aviso (`notice`)

`useConversation` expone:

```ts
notice: 'expired' | 'max_rounds' | null;
```

- `expired`: se setea en `send()` cuando se detecta inactividad > 30 min, antes de
  crear la conversación nueva, de modo que el mensaje que el usuario acaba de escribir
  va a la conversación fresca.
- `max_rounds`: se setea en `runStream` cuando el evento `done` trae
  `stoppedByMaxRounds: true`.
- Se limpia en `reset()`, `openConversation()` y al completarse exitosamente un envío
  posterior (el usuario decidió seguir en esa conversación a pesar del límite).

### 2. Detección de inactividad

- `lastActivityRef` (`useRef<number>`) guarda el timestamp del último stream
  completado. Se actualiza al finalizar cada stream, no al enviar: un stream largo no
  cuenta como inactividad.
- En `send()`: si `Date.now() - lastActivityRef > 30 * 60 * 1000`, se resetea la
  conversación (misma lógica que `reset()`) y se setea `notice = 'expired'`, luego el
  flujo de envío continúa con una conversación nueva.
- El `useEffect` de resume desde `sessionStorage` inicializa `lastActivityRef` en
  `Date.now()`: la referencia de actividad no sobrevive al reload, y contar desde el
  reload es el comportamiento correcto (el contexto del usuario en esta pestaña es
  nuevo).
- **No aplica con `conversationId` pre-creado** (copiloto del CRM, ADR 0007): ahí el
  host dicta el hilo y un auto-reset rompería el flujo del operador. La expiración es
  solo para conversaciones que el widget crea y posee.

### 3. Render del aviso

- `ChatBody` recibe `notice` del hook y lo renderiza como un banner de "mensaje del
  sistema" dentro del log (div con clase nueva `aichat-notice`), no como un `Message`:
  el tipo `Message` admite solo `user`/`assistant` y no se toca el contrato con el
  backend.
- CSS nuevo en `src/styles/aichat.css`, consistente con el estilo existente del log.

### 4. Labels

Dos entradas nuevas en `Labels` (`src/preset/labels.ts`), con defaults en español
rioplatense (mismo registro que el resto):

- `noticeExpired`: "La conversación anterior expiró por inactividad. Empezamos una
  nueva."
- `noticeMaxRounds`: "Esta conversación llegó a su límite de mensajes. Iniciá una
  nueva para continuar."

## Archivos afectados

- `src/hooks/useConversation.ts` — `notice`, `lastActivityRef`, chequeo lazy,
  detección de `stoppedByMaxRounds`.
- `src/preset/ChatBody.tsx` — render del banner de aviso.
- `src/preset/labels.ts` — labels nuevos.
- `src/styles/aichat.css` — clase `.aichat-notice` (y su build en `dist/`).
- `src/hooks/useConversation.test.tsx` — tests nuevos.

## Tests

Casos a cubrir en `useConversation.test.tsx`:

1. Pasados >30 min sin actividad, `send()` resetea la conversación, setea
   `notice === 'expired'` y el mensaje se crea en una conversación nueva
   (`createConversation` llamado de nuevo).
2. Actividad reciente (<30 min): `send()` continúa en la misma conversación, sin
   notice.
3. Un `done` con `stopped_by_max_rounds: true` deja `notice === 'max_rounds'`.
4. Con `conversationId` pre-creado, pasado cualquier tiempo, `send()` nunca expira.
5. `reset()` / `openConversation()` limpian el notice.
