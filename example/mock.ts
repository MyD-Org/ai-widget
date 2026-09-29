// Transporte mock para el playground: simula los endpoints de ai-api sin gastar tokens.
// Se inyecta vía config.fetch del widget. Devuelve respuestas canned con formatos
// diversos y las streamea en chunks (con delays) para imitar el SSE real.

export const MOCK_AGENTS = [
  { id: 'mock-soporte', name: 'soporte-postventa (mock)' },
  { id: 'mock-ventas', name: 'ventas (mock)' },
];

// Catálogo del mock para `commerce.resolveProducts` del playground. El 1199 falta a
// propósito: la card tiene que caer al label del modelo, sin precio ni foto.
export const MOCK_PRODUCTS: Record<string, { name: string; brand: string; price: number; available: boolean; stock?: number; imageUrl?: string }> = {
  '1101': { name: 'Reflector LED 50W IP65 luz fría', brand: 'Marca Demo', price: 18900, available: true, stock: 1, imageUrl: '/producto.svg' },
  '1102': { name: 'Reflector LED 100W IP66', brand: 'Marca Demo', price: 32400, available: false, imageUrl: '/producto.svg' },
  '3303': { name: 'Tira LED 5m luz cálida con fuente incluida', brand: 'Marca Demo', price: 12500, available: true, imageUrl: '/producto.svg' },
  '2202': { name: 'Fotocélula 220V 10A', brand: 'Otra Marca', price: 6200, available: true, stock: 4, imageUrl: '/producto.svg' },
};

export const MOCK_PROFILES = [
  { key: 'hotel', display_name: 'Hotel Cataratas (mock)' },
  { key: 'electricista', display_name: 'Juan (mock)' },
];

interface Canned {
  tools?: string[];
  text: string;
  card?: unknown;
}

// Primero, el flujo del agente vendedor (cards de venta, platform ADR 0014): pregunta con
// respuestas sugeridas → opciones → carrito → traspaso. Los ids existen en MOCK_PRODUCTS.
// Después, 4 mensajes que ejercitan el renderer: listas+negritas, tabla, encabezados+hr,
// texto+código+link.
const CANNED: Canned[] = [
  {
    text: '¡Hola! Para recomendarte bien: ¿es para interior o exterior?',
    card: { type: 'replies', options: ['Para interior', 'Para exterior', 'No estoy seguro'] },
  },
  {
    tools: ['buscar_productos'],
    text: 'Para exterior te recomiendo estas opciones:',
    card: {
      type: 'products',
      items: [
        { id: '1101', label: 'Reflector LED 50W IP65', reason: 'Apto intemperie, ideal para un patio chico' },
        { id: '1102', label: 'Reflector LED 100W IP66', reason: 'Más potencia para patios grandes' },
        { id: '1199', label: 'Reflector solar 30W', reason: 'Sin cableado' },
        { id: '2202', label: 'Fotocélula 220V 10A', reason: 'Enciende sola al anochecer' },
        { id: '3303', label: 'Tira LED 5m', reason: 'Para el borde del techo' },
      ],
    },
  },
  {
    text: 'Te armé el pedido. ¿Te lo dejo en el carrito?',
    card: {
      type: 'cart',
      title: 'Tu pedido',
      lines: [
        { id: '1101', label: 'Reflector LED 50W IP65', qty: 4 },
        { id: '2202', label: 'Fotocélula 220V', qty: 4 },
      ],
    },
  },
  {
    text: 'Para un precio por volumen te conviene hablar con un asesor:',
    card: {
      type: 'handoff',
      channel: 'whatsapp',
      phone: '5491100000000',
      summary: 'Consulta por precio mayorista para 40 reflectores LED 50W IP65.',
    },
  },
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
