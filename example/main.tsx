import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatPanel, ChatDrawer } from '../src/preset';
import type { AiChatConfig } from '../src/types';
import { createMockFetch, MOCK_AGENTS, MOCK_PROFILES } from './mock';
import '../src/styles/aichat.css';

// baseUrl '' → URLs relativas (/v1, /demo) que el dev server de Vite proxea a ai-api.
const BASE_URL = '';

interface Agent {
  id: string;
  name: string;
}
interface Profile {
  key: string;
  display_name: string;
}

function mintToken(profile: string): Promise<string> {
  return fetch(`${BASE_URL}/demo/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`/demo/session ${r.status}`);
      return r.json();
    })
    .then((j) => j.token as string);
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [agentId, setAgentId] = useState('');
  const [profile, setProfile] = useState('');
  const [mode, setMode] = useState<'panel' | 'drawer'>('panel');
  const [showActivity, setShowActivity] = useState(true);
  const [enableHistory, setEnableHistory] = useState(true);
  const [accent, setAccent] = useState('#1c1917');
  const [mock, setMock] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // En mock no hay red: fetch inyectado que simula los endpoints.
  const mockFetch = useMemo(() => createMockFetch(), []);

  useEffect(() => {
    if (mock) {
      setAgents(MOCK_AGENTS);
      setProfiles(MOCK_PROFILES);
      setAgentId(MOCK_AGENTS[0].id);
      setProfile(MOCK_PROFILES[0].key);
      setErr(null);
      return;
    }
    Promise.all([
      fetch(`${BASE_URL}/demo/agents`).then((r) => r.json()),
      fetch(`${BASE_URL}/demo/profiles`).then((r) => r.json()),
    ])
      .then(([a, p]: [Agent[], Profile[]]) => {
        setAgents(a);
        setProfiles(p);
        setAgentId(a[0]?.id ?? '');
        setProfile(p[0]?.key ?? '');
      })
      .catch((e) => setErr(String(e)));
  }, [mock]);

  const config = useMemo<AiChatConfig | null>(() => {
    if (!agentId || !profile) return null;
    // En mock: token estático + fetch inyectado → cero red. En live: fetchToken real.
    return mock
      ? { baseUrl: BASE_URL, agentId, token: 'mock-token', persist: 'none', fetch: mockFetch }
      : { baseUrl: BASE_URL, agentId, fetchToken: () => mintToken(profile), persist: 'none' };
  }, [agentId, profile, mock, mockFetch]);

  // Remontar el widget cuando cambia agente/perfil/modo/mock (config nueva = sesión nueva).
  const widgetKey = `${agentId}:${profile}:${mode}:${mock ? 'mock' : 'live'}`;

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 1000, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 4 }}>@myd-org/ai-widget · playground</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Componente real contra <code>ai-api</code> (proxy → :3000). Editá <code>src/</code> y se actualiza con HMR.
      </p>

      {err && <div style={{ color: '#c00' }}>Error cargando demo: {err}. ¿Está ai-api en :3000?</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', margin: '1rem 0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#666', gap: 4 }}>
          Agente
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#666', gap: 4 }}>
          Perfil (cliente)
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.key} value={p.key}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#666', gap: 4 }}>
          Modo
          <select value={mode} onChange={(e) => setMode(e.target.value as 'panel' | 'drawer')}>
            <option value="panel">ChatPanel (inline)</option>
            <option value="drawer">ChatDrawer (flotante)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#666', gap: 4 }}>
          Acento (primaryColor)
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 48, height: 32, padding: 0, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={showActivity} onChange={(e) => setShowActivity(e.target.checked)} />
          showActivity
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={enableHistory} onChange={(e) => setEnableHistory(e.target.checked)} />
          enableHistory
        </label>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          title="Sin red: respuestas canned, no gasta tokens"
        >
          <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} />
          🧪 Mock (sin tokens)
        </label>
      </div>

      {mock && (
        <p style={{ fontSize: 12, color: '#8a6d00', background: '#fffbe6', border: '1px solid #f0e0a0', borderRadius: 6, padding: '.4rem .6rem', display: 'inline-block' }}>
          Modo mock: respuestas simuladas (rotan 4 formatos: listas, tabla, encabezados, texto+link). No le pega al agente.
        </p>
      )}

      {config && mode === 'panel' && (
        <div style={{ height: 560, maxWidth: 480 }}>
          <ChatPanel key={widgetKey} config={config} showActivity={showActivity} enableHistory={enableHistory} branding={{ title: 'Central Led', primaryColor: accent }} />
        </div>
      )}
      {config && mode === 'drawer' && (
        <>
          <p style={{ color: '#888' }}>El launcher flotante está abajo a la derecha 👉</p>
          <ChatDrawer key={widgetKey} config={config} showActivity={showActivity} enableHistory={enableHistory} branding={{ title: 'Central Led', primaryColor: accent }} />
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
