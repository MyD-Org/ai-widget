# Diseño — Mensajes interactivos: tarjeta de presupuesto

Fecha: 2026-06-11
Estado: aprobado (brainstorm)
Feature del widget `@myd-org/ai-widget` (ver `2026-06-11-ai-widget-design.md`).

## Objetivo

Permitir que un mensaje del asistente traiga un **artefacto estructurado interactivo**
—la primera instancia es una **tarjeta de presupuesto**— con acciones que el usuario
final puede ejecutar desde el chat: descargar el PDF, pedir el pedido por WhatsApp, o
consultar/pedir un cambio por WhatsApp.

El presupuesto lo arma el agente de ventas y termina impactando en Flexxus vía la API
intermedia. **Eso (el backend) está fuera de alcance de este diseño** (ver Subsistema A).
Acá diseñamos el **contrato** del mensaje interactivo y el **render en el widget**,
construidos y testeados contra datos mock.

## Alcance y decomposición

| Subsistema | Qué | Estado |
|---|---|---|
| **A — Backend** | Tool `create_budget` del agente → API intermedia → Flexxus; emite el evento `card` | **Fuera de alcance** (gateado por la API intermedia en construcción). Este spec documenta el contrato que A deberá cumplir. |
| **B — Contrato** | Evento SSE `card`, tipos `Card`/`CardAction`, `Message.card` | **En alcance** |
| **C — Widget** | Render de la tarjeta resumen + acciones genéricas | **En alcance** |

Dependencia: A produce los datos, B es la forma, C los consume. B+C se construyen
contra mock; A se enchufa después sin que el widget se entere.

## Decisiones (del brainstorm)

- **Render:** tarjeta **resumen** (número, total, ítems clave, vencimiento) + botones de
  acción. El detalle formal va en el PDF descargable. (No texto completo inline, no solo ícono.)
- **Acciones:** **data-driven**. El backend manda cada acción ya resuelta (`{label, url, style}`):
  la `wa.me` URL (número del local + texto prefijado + ref + datos del cliente) y la URL del PDF
  vienen listas. El widget solo renderiza botones que abren URLs. Cero lógica de tenant en el widget.
- **La tarjeta se adjunta al mensaje del asistente** (un turno = una burbuja con texto opcional
  + tarjeta opcional). Se renderiza como superficie propia, debajo del texto.

## Contrato (B)

### Evento SSE

Durante un turno del asistente, además de `text`/`tool`/`done`, el backend puede emitir:

```
event: card
data: <json Card>
```

### Tipos (`src/types.ts`)

```ts
export interface CardAction {
  label: string;
  url: string;                 // resuelto por el backend (wa.me/…, PDF)
  style?: 'primary' | 'whatsapp' | 'default';
  icon?: 'download' | 'whatsapp' | 'chat' | 'external';
  download?: boolean;          // hint para el atributo download (PDF)
}

export interface BudgetCard {
  type: 'budget';
  title: string;               // "Presupuesto #1042"
  subtitle?: string;           // "Central Led · vence 15/07"
  lines: { label: string; qty?: number; amount?: string }[];
  total?: { label: string; amount: string };
  actions: CardAction[];
}

export type Card = BudgetCard;  // unión extensible a futuros tipos de tarjeta

// ChatEvent suma:  | { type: 'card'; card: Card }
```

### Mapeo (`client/apiClient.ts → toChatEvent`)

```ts
case 'card': return { type: 'card', card: data as unknown as Card };
```

### Modelo de mensaje (`src/types.ts → Message`)

```ts
export interface Message {
  id: string;
  role: Role;
  text: string;
  created_at?: string;
  card?: Card;                 // adjunto estructurado (solo asistente)
}
```

### Acumulación en `useConversation`

- Al recibir un evento `card`: asegurar que existe el mensaje de asistente en curso
  (igual que con `text`: si no hay, crear uno con `text: ''`), y setearle `.card`.
- Si el mensaje de asistente en curso **ya tiene** `card`, crear un mensaje de asistente
  nuevo con esa tarjeta (1 tarjeta por mensaje; mantiene el modelo simple).
- Los eventos `tool`/`debug_*` siguen yendo a `activity`, sin cambios.

## Render en el widget (C)

### `src/preset/Card.tsx`

- `Card` (export) recibe `{ card: CardType }` y delega el cuerpo por `card.type`.
  - `type === 'budget'`: header (`title` + `subtitle`), lista de `lines`
    (`{qty}× {label}` … `{amount}`), y `total` destacado.
  - `type` desconocido: fallback mínimo (title si existe + acciones). Nunca rompe.
- `CardActions` (interno) renderiza `card.actions` como links-botón:

```tsx
<a
  href={action.url}
  target="_blank"
  rel="noopener noreferrer"
  download={action.download || undefined}
  className={`aichat-action aichat-action-${action.style ?? 'default'}`}
>
  {action.icon && <ActionIcon name={action.icon} />}
  {action.label}
</a>
```

`target="_blank" + rel="noopener noreferrer"` es obligatorio (higiene anti-tabnabbing en
un widget embebido). `download` solo se setea si es truthy.

### Integración en `ChatBody`

Por cada mensaje del asistente: el texto (markdown) y, si `message.card`, un `<Card>`
**debajo**, como hermano del texto (no dentro de la burbuja gris). La tarjeta es su
propia superficie (borde + `--aichat-surface` + sombra suave), alineada a la izquierda,
ancho generoso (hasta ~100% como las tablas).

### Estilos (`src/styles/aichat.css`)

Tokens/clases nuevas, scoped con prefijo `aichat-`:
- `.aichat-card` (superficie, borde, radius, sombra), `.aichat-card-head` (title/subtitle),
  `.aichat-card-line` (label · amount), `.aichat-card-total` (destacado), `.aichat-card-actions`.
- `.aichat-action` (botón base, full-width apilado), variantes `-primary` (usa `--aichat-primary`),
  `-whatsapp` (usa `--aichat-whatsapp: #25d366`), `-default` (neutro).
- Nuevo token: `--aichat-whatsapp: #25d366;` en `.aichat-root`.

## Mock (playground)

`example/mock.ts`: agregar una respuesta canned que, además de un texto breve
("Te armé el presupuesto 👇"), emite un evento `card` de tipo `budget` con acciones
data-driven reales:
- Descargar PDF → una URL de PDF de ejemplo (placeholder).
- Pedir por WhatsApp → `https://wa.me/<num>?text=<encoded>` con texto prefijado de ejemplo.
- Tengo una consulta → otra `wa.me` URL.

El mock documenta el contrato ejecutable que el backend A deberá emitir (mismo rol que
`fake-crm.ts`/`fake-catalog.ts` en ai-api).

## Manejo de errores / bordes

- Tarjeta sin `actions` → render del cuerpo sin botonera.
- `type` desconocido → fallback mínimo, no rompe el render del resto del chat.
- `data` de `card` no parseable → el parser ya cae a `{}`; `toChatEvent` produce un card
  con campos vacíos → el fallback lo maneja.
- Acciones: si `url` falta, no se renderiza ese botón.

## Testing

1. `toChatEvent`: evento `card` → `{ type:'card', card }` con el payload parseado.
2. `useConversation`: stream con `text` + `card` → el mensaje tiene `.text` y `.card`;
   un segundo `card` en el mismo turno → mensaje nuevo.
3. `Card`: renderiza `title`/`lines`/`total`; los botones tienen `href`, `target="_blank"`,
   `rel="noopener noreferrer"`, y `download` cuando corresponde; la clase de estilo whatsapp
   se aplica.
4. `ChatPanel` (integración): streamear un `card` y verificar que aparece el título y un
   link cuyo `href` empieza con `https://wa.me/`.

## Fuera de alcance (YAGNI)

- **Subsistema A** (tool del agente, API intermedia, Flexxus). Documentado arriba como
  contrato a cumplir.
- Persistencia del `card` en el historial (`GET /:id/messages`): hoy el widget maneja el
  `card` solo en el stream en vivo; que el historial lo devuelva es trabajo de A.
- Otros tipos de tarjeta (pago, agenda). La unión `Card` queda abierta, pero no se construyen.
- Acciones que no sean "abrir una URL" (ej. acciones que postean al backend). Si surgen,
  se suma un `kind` a `CardAction`; hoy todas son links.

## Contrato que el backend A deberá cumplir

Cuando exista la API intermedia: la tool `create_budget` resuelve server-side la `wa.me`
URL (número del local desde config del tenant + plantilla de texto + ref del presupuesto +
datos del cliente desde la sesión) y la URL del PDF (desde la API intermedia), y emite un
evento SSE `card` con la forma `BudgetCard`. Además, `GET /:id/messages` debe incluir el
`card` en los mensajes pasados para que el historial se rehidrate completo.
