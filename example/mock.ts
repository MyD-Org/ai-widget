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
  card?: unknown;
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
  {
    tools: ['create_budget'],
    text: 'Te armé el presupuesto 👇',
    card: {
      type: 'budget',
      title: 'Presupuesto #1042',
      subtitle: 'Central Led · vence 15/07',
      lines: [
        { label: 'Panel LED 60x60 40W', qty: 50, amount: '$878.750' },
        { label: 'Instalación', qty: 1, amount: '$120.000' },
      ],
      total: { label: 'Total', amount: '$998.750' },
      actions: [
        {
          label: 'Descargar PDF',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          icon: 'download',
          download: true,
          style: 'primary',
        },
        {
          label: 'Pedir por WhatsApp',
          url: 'https://wa.me/5491100000000?text=' + encodeURIComponent('Hola! Quiero avanzar con el presupuesto #1042 (Central Led).'),
          icon: 'whatsapp',
          style: 'whatsapp',
        },
        {
          label: 'Tengo una consulta',
          url: 'https://wa.me/5491100000000?text=' + encodeURIComponent('Hola! Tengo una consulta sobre el presupuesto #1042.'),
          icon: 'chat',
          style: 'default',
        },
      ],
    },
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
      if (canned.card) {
        await sleep(120);
        controller.enqueue(enc.encode(sseBlock('card', canned.card)));
      }
      controller.enqueue(enc.encode(sseBlock('done', { rounds: (canned.tools?.length ?? 0) + 1 })));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// Historial simulado: fechas relativas a hoy para que caigan en los tres grupos del menú.
const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, n === 0 ? 42 : 15, 0, 0);
  return d.toISOString();
};

const MOCK_CONVERSATIONS = [
  { id: 'mock-conv', agent_id: 'mock', title: 'Paneles LED para el living', created_at: daysAgo(0) },
  { id: 'mock-conv-2', agent_id: 'mock', title: 'Stock de spots embutidos', created_at: daysAgo(0, 9) },
  { id: 'mock-conv-3', agent_id: 'mock', title: 'Cambio de fecha de entrega', created_at: daysAgo(2, 17) },
  { id: 'mock-conv-4', agent_id: 'mock', title: null, created_at: daysAgo(12) },
  { id: 'mock-conv-5', agent_id: 'mock', title: 'Presupuesto salón Cataratas', created_at: daysAgo(21) },
];

const MOCK_HISTORY: Record<string, { id: string; role: 'user' | 'assistant'; text: string }[]> = {
  'mock-conv-2': [
    { id: 'h1', role: 'user', text: '¿Quedan spots embutidos de 7W?' },
    { id: 'h2', role: 'assistant', text: 'Quedan **38 unidades** en depósito central.' },
  ],
  'mock-conv-3': [
    { id: 'h3', role: 'user', text: 'Pasar la entrega del pedido 4821 al viernes' },
    { id: 'h4', role: 'assistant', text: 'Listo, reprogramada para el viernes.' },
  ],
};

export function createMockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.endsWith('/demo/session')) return json({ token: 'mock-token', expires_at: null }, 201);
    if (url.endsWith('/demo/agents')) return json(MOCK_AGENTS);
    if (url.endsWith('/demo/profiles')) return json(MOCK_PROFILES);
    if (/\/v1\/conversations$/.test(url)) {
      // Mismo path para crear (POST) y listar (GET): el método es lo que las separa.
      return method === 'POST' ? json({ id: 'mock-conv' }, 201) : json(MOCK_CONVERSATIONS);
    }
    const messages = url.match(/\/v1\/conversations\/(.+)\/messages$/);
    if (messages) {
      if (method !== 'POST') return json(MOCK_HISTORY[messages[1]] ?? []);
      const canned = CANNED[turn % CANNED.length];
      turn += 1;
      return sseResponse(canned);
    }
    return json({ error: 'mock_unhandled', url }, 404);
  }) as typeof fetch;
}
