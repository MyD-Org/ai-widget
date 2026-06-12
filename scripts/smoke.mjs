// Smoke test: el client/ construido del widget contra un ai-api REAL.
// Mintea token vía /demo/session (igual que haría fetchToken del consumidor),
// crea conversación y consume el SSE real con Claude real.
//
// Uso: node scripts/smoke.mjs [agentName] [profileKey] [prompt]
//   ai-api debe estar corriendo en BASE_URL (default http://localhost:3000).
import { createApiClient } from '../dist/index.js';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const agentName = process.argv[2] ?? 'ventas';
const profileKey = process.argv[3] ?? 'electricista';
const prompt =
  process.argv[4] ??
  'Necesito iluminar un salón de unos 50 paneles. ¿Qué me recomendás y cuánto saldría?';

function fail(msg) {
  console.error(`\n❌ SMOKE FAIL: ${msg}`);
  process.exit(1);
}

// 1) Mint token (el rol de fetchToken / backend del tenant)
const sessionRes = await fetch(`${BASE_URL}/demo/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ profile: profileKey }),
});
if (!sessionRes.ok) fail(`/demo/session → HTTP ${sessionRes.status}`);
const { token } = await sessionRes.json();
if (!token) fail('no token en /demo/session');
console.log(`✓ token minteado (perfil=${profileKey}), len=${token.length}`);

// 2) Resolver agent_id por nombre
const agentsRes = await fetch(`${BASE_URL}/demo/agents`);
const agents = await agentsRes.json();
const agent = agents.find((a) => a.name === agentName);
if (!agent) fail(`agente "${agentName}" no encontrado en ${JSON.stringify(agents)}`);
console.log(`✓ agente ${agent.name} → ${agent.id}`);

// 3) Cliente del widget, con el mismo contrato que usa el preset
const client = createApiClient({ baseUrl: BASE_URL, agentId: agent.id }, () => token);

const { id: conversationId } = await client.createConversation();
console.log(`✓ conversación creada: ${conversationId}`);

// 4) Stream del turno (Claude real)
console.log(`\n> ${prompt}\n`);
let text = '';
const tools = [];
let done = null;
let sawError = null;
process.stdout.write('  ');
for await (const ev of client.streamMessage(conversationId, prompt)) {
  if (ev.type === 'text') {
    text += ev.delta;
    process.stdout.write(ev.delta);
  } else if (ev.type === 'tool') {
    tools.push(ev.name);
    process.stdout.write(`\n  [tool: ${ev.name}] `);
  } else if (ev.type === 'done') {
    done = ev;
  } else if (ev.type === 'error') {
    sawError = ev.code;
  }
}
console.log('\n');

// 5) Asserts
if (sawError) fail(`evento error del backend: ${sawError}`);
if (text.trim().length === 0) fail('no llegó texto del asistente');
if (!done) fail('no llegó evento done');

console.log('—'.repeat(50));
console.log(`✓ texto recibido: ${text.length} chars`);
console.log(`✓ tools usadas: ${tools.length ? tools.join(', ') : '(ninguna)'}`);
console.log(`✓ done: rounds=${done.rounds}, stopReason=${done.stopReason}, stoppedByMaxRounds=${done.stoppedByMaxRounds}`);
console.log('\n✅ SMOKE OK — el client/ del widget conversa contra ai-api real.');
