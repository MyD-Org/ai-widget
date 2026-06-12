// Transporte mock para el playground: simula los endpoints de ai-api sin gastar tokens.
// Se inyecta vía config.fetch del widget. Devuelve respuestas canned con formatos
// diversos y las streamea en chunks (con delays) para imitar el SSE real.

export const MOCK_AGENTS = [
  { id: 'mock-soporte', name: 'soporte-postventa (mock)' },
  { id: 'mock-ventas', name: 'ventas (mock)' },
];

export const MOCK_PROFILES = [
  { key: 'hotel', display_name: 'Hotel Cataratas (mock)' },
  { key: 'electricista', display_name: 'Juan (mock)' },
];

interface Canned {
  tools?: string[];
  text: string;
}

// 4 mensajes que ejercitan el renderer: listas+negritas, tabla, encabezados+hr, texto+código+link.
const CANNED: Canned[] = [
  {
    text: `¡Hola! 👋 Para ayudarte con el **living**, contame un poco más:

1. **¿Qué tipo de luminaria preferís?** Paneles embutidos, spots, tiras LED…
2. **¿Cuántos puntos de luz** necesitás aproximadamente?
3. **¿Las dimensiones del espacio?** (m², altura del cielorraso)

Con eso te armo una **recomendación** y un presupuesto a medida. 😊`,
  },
  {
    tools: ['search_products', 'get_price', 'get_price'],
    text: `Perfecto, te cotizo las dos opciones para que compares:

| Opción | Producto | Precio unit. | Subtotal (50u) |
|--------|----------|--------------|----------------|
| Estándar | Panel LED 60x60 40W | $17.575 | **$878.750** |
| Premium ⭐ | Panel LED 48W Pro | $39.140 | **$1.957.000** |

*Ambos precios incluyen un 5% de descuento por volumen.*`,
  },
  {
    text: `## Mi recomendación

Para un salón de uso intensivo te conviene el **Philips 48W Pro**:

- ✅ **50.000 hs** de vida útil (el doble que el estándar)
- ✅ Garantía de **36 meses**
- ✅ **CRI 90** → excelente reproducción del color

---

¿Avanzamos con alguna de las dos opciones?`,
  },
  {
    text: `Listo, te dejé el seguimiento en \`pedido #4821\`. Podés ver el estado en [tu panel](https://centralled.example/pedidos) cuando quieras. Cualquier cosa, escribime. 🙌`,
  },
];

let turn = 0;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sseBlock(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Streamea una respuesta canned: tools primero, después el texto en chunks, y done.
function sseResponse(canned: Canned): Response {
  const enc = new TextEncoder();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Eventos de tool (con una pausa, para que se vea el chip de actividad).
      for (const name of canned.tools ?? []) {
        await sleep(450);
        controller.enqueue(enc.encode(sseBlock('tool', { name })));
      }
      // Texto en chunks tipo "palabra" para imitar el streaming.
      await sleep(300);
      const chunks = canned.text.match(/\S+\s*/g) ?? [canned.text];
      for (const chunk of chunks) {
        controller.enqueue(enc.encode(sseBlock('text', { delta: chunk })));
        await sleep(18);
      }
      controller.enqueue(enc.encode(sseBlock('done', { rounds: (canned.tools?.length ?? 0) + 1 })));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

export function createMockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/demo/session')) return json({ token: 'mock-token', expires_at: null }, 201);
    if (url.endsWith('/demo/agents')) return json(MOCK_AGENTS);
    if (url.endsWith('/demo/profiles')) return json(MOCK_PROFILES);
    if (/\/v1\/conversations$/.test(url)) return json({ id: 'mock-conv' }, 201);
    if (/\/v1\/conversations\/.+\/messages$/.test(url)) {
      const canned = CANNED[turn % CANNED.length];
      turn += 1;
      return sseResponse(canned);
    }
    return json({ error: 'mock_unhandled', url }, 404);
  }) as typeof fetch;
}
