# Interactive Cards (Budget) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an assistant message carry a structured, interactive **budget card** (summary + data-driven action buttons) rendered in the chat, built and tested against mock data.

**Architecture:** New SSE event `card` carries a typed `Card` (first kind: `budget`) attached to the current assistant message. The widget renders the card as its own surface below the text, with action buttons that are just links opening backend-resolved URLs (WhatsApp deep-link, PDF download). Backend (agent→Flexxus) is out of scope; the playground mock emits the `card` event to exercise the UI.

**Tech Stack:** TypeScript, React 18, vitest + @testing-library/react. No new deps.

**Spec:** `docs/superpowers/specs/2026-06-11-interactive-cards-design.md`

---

## File Structure

```
src/
├── types.ts            # MODIFY: CardAction, BudgetCard, Card; ChatEvent + card; Message.card
├── index.ts            # MODIFY: export Card/CardAction/BudgetCard types
├── client/
│   ├── apiClient.ts        # MODIFY: toChatEvent maps 'card'
│   └── apiClient.test.ts   # MODIFY: +card mapping test
├── hooks/
│   ├── useConversation.ts      # MODIFY: accumulate card onto assistant message
│   └── useConversation.test.tsx# MODIFY: +card accumulation tests
├── preset/
│   ├── Card.tsx            # CREATE: <Card> (budget body + generic CardActions)
│   ├── Card.test.tsx       # CREATE: render + action link tests
│   ├── ChatBody.tsx        # MODIFY: render message.card below text
│   ├── ChatPanel.test.tsx  # MODIFY: +card integration test
│   └── index.ts            # MODIFY: export Card
└── styles/aichat.css       # MODIFY: card + action styles + --aichat-whatsapp
example/mock.ts             # MODIFY: +canned card response
```

---

## Task 1: Types — Card, CardAction, ChatEvent.card, Message.card

**Files:**
- Modify: `src/types.ts`, `src/index.ts`

- [ ] **Step 1: Add card types to `src/types.ts`**

Add after the `ChatEvent` definition's existing union (extend the union with a `card` member) and after `Message`. Concretely, replace the `ChatEvent` and `Message` blocks and add the new interfaces:

```ts
export interface CardAction {
  label: string;
  url: string;
  style?: 'primary' | 'whatsapp' | 'default';
  icon?: 'download' | 'whatsapp' | 'chat' | 'external';
  download?: boolean;
}

export interface BudgetCard {
  type: 'budget';
  title: string;
  subtitle?: string;
  lines: { label: string; qty?: number; amount?: string }[];
  total?: { label: string; amount: string };
  actions: CardAction[];
}

export type Card = BudgetCard;

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'card'; card: Card }
  | { type: 'done'; usage: unknown; rounds: number; stoppedByMaxRounds: boolean; stopReason: string }
  | { type: 'error'; code: string }
  | { type: 'debug_context'; data: unknown }
  | { type: 'debug_tool_call'; data: unknown }
  | { type: 'debug_tool_result'; data: unknown };

export interface Message {
  id: string;
  role: Role;
  text: string;
  created_at?: string;
  card?: Card;
}
```

- [ ] **Step 2: Export the new types from `src/index.ts`**

Change the type export line to include the card types:

```ts
export type { AiChatConfig, Message, Role, ChatEvent, ErrorCode, Card, CardAction, BudgetCard } from './types';
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/index.ts
git commit -m "feat(types): Card/CardAction, ChatEvent.card, Message.card"
```

---

## Task 2: `toChatEvent` maps the `card` event

**Files:**
- Modify: `src/client/apiClient.ts`, `src/client/apiClient.test.ts`

- [ ] **Step 1: Write the failing test (append to the `toChatEvent` describe block)**

In `src/client/apiClient.test.ts`, add inside `describe('toChatEvent', ...)`:

```ts
  it('maps a card event to a typed card', () => {
    const card = { type: 'budget', title: 'Presupuesto #1042', lines: [], actions: [] };
    const raw = { event: 'card', data: JSON.stringify(card) };
    expect(toChatEvent(raw)).toEqual({ type: 'card', card });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/client/apiClient.test.ts`
Expected: FAIL — `toChatEvent` returns `null` for `card` (default branch).

- [ ] **Step 3: Add the `card` case in `toChatEvent`**

In `src/client/apiClient.ts`, add the import of `Card` to the existing type import and add a `case 'card'` before the `default`:

```ts
import { ApiError, type AiChatConfig, type Card, type ChatEvent, type Message } from '../types';
```

```ts
    case 'card':
      return { type: 'card', card: data as unknown as Card };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/client/apiClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/apiClient.ts src/client/apiClient.test.ts
git commit -m "feat(client): map SSE 'card' event to ChatEvent"
```

---

## Task 3: `useConversation` accumulates the card

**Files:**
- Modify: `src/hooks/useConversation.ts`, `src/hooks/useConversation.test.tsx`

- [ ] **Step 1: Write the failing tests (append to the `useConversation` describe block)**

In `src/hooks/useConversation.test.tsx`, add:

```ts
  it('attaches a card to the assistant message', async () => {
    const card = { type: 'budget', title: 'Presupuesto #1042', lines: [], actions: [] };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Te armé el presupuesto"}\n\n',
          `event: card\ndata: ${JSON.stringify(card)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => { result.current.send('precio'); });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.text).toBe('Te armé el presupuesto');
    expect(assistant?.card).toEqual(card);
  });

  it('a second card in the same turn lands on a new assistant message', async () => {
    const c1 = { type: 'budget', title: 'A', lines: [], actions: [] };
    const c2 = { type: 'budget', title: 'B', lines: [], actions: [] };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          `event: card\ndata: ${JSON.stringify(c1)}\n\n`,
          `event: card\ndata: ${JSON.stringify(c2)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    const { result } = renderHook(() => useConversation(), { wrapper: wrapper() });
    act(() => { result.current.send('dos'); });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    const cards = result.current.messages.filter((m) => m.role === 'assistant').map((m) => m.card?.title);
    expect(cards).toEqual(['A', 'B']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useConversation.test.tsx`
Expected: FAIL — `card` events are ignored (no branch), `assistant.card` undefined.

- [ ] **Step 3: Rewrite `runStream` in `src/hooks/useConversation.ts` to handle cards**

Replace the entire `runStream` callback with:

```ts
  const runStream = useCallback(
    async (conversationId: string, content: string) => {
      let assistant: Message | null = null;
      const ensureAssistant = (): Message => {
        if (!assistant) {
          assistant = { id: localId(), role: 'assistant', text: '' };
          const created = assistant;
          setMessages((m) => [...m, created]);
        }
        return assistant;
      };
      for await (const ev of client.streamMessage(conversationId, content)) {
        if (ev.type === 'text') {
          const a = ensureAssistant();
          a.text += ev.delta;
          const snapshot = a.text;
          const targetId = a.id;
          setMessages((m) => m.map((x) => (x.id === targetId ? { ...x, text: snapshot } : x)));
        } else if (ev.type === 'card') {
          let a = ensureAssistant();
          if (a.card) {
            // ya hay una tarjeta en este mensaje → abrir un mensaje nuevo
            const next: Message = { id: localId(), role: 'assistant', text: '' };
            setMessages((m) => [...m, next]);
            assistant = next;
            a = next;
          }
          a.card = ev.card;
          const targetId = a.id;
          const card = ev.card;
          setMessages((m) => m.map((x) => (x.id === targetId ? { ...x, card } : x)));
        } else if (ev.type === 'tool') {
          setActivity({ tool: ev.name });
        } else if (ev.type === 'error') {
          throw new ApiError(0, ev.code);
        } else if (ev.type === 'done') {
          setActivity(null);
        }
      }
    },
    [client],
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useConversation.test.tsx`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useConversation.ts src/hooks/useConversation.test.tsx
git commit -m "feat(hooks): accumulate card onto the assistant message"
```

---

## Task 4: `Card` component (budget body + generic actions)

**Files:**
- Create: `src/preset/Card.tsx`, `src/preset/Card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/preset/Card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import type { BudgetCard } from '../types';

const budget: BudgetCard = {
  type: 'budget',
  title: 'Presupuesto #1042',
  subtitle: 'Central Led · vence 15/07',
  lines: [{ label: 'Panel LED 60x60 40W', qty: 50, amount: '$878.750' }],
  total: { label: 'Total', amount: '$878.750' },
  actions: [
    { label: 'Descargar PDF', url: 'https://x/p.pdf', icon: 'download', download: true },
    { label: 'Pedir por WhatsApp', url: 'https://wa.me/549110000?text=hola', style: 'whatsapp', icon: 'whatsapp' },
  ],
};

describe('Card (budget)', () => {
  it('renders title, subtitle, line and total label', () => {
    render(<Card card={budget} />);
    expect(screen.getByText('Presupuesto #1042')).toBeInTheDocument();
    expect(screen.getByText('Central Led · vence 15/07')).toBeInTheDocument();
    expect(screen.getByText(/Panel LED 60x60 40W/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders actions as links opening a new tab safely', () => {
    render(<Card card={budget} />);
    const pdf = screen.getByRole('link', { name: 'Descargar PDF' });
    expect(pdf).toHaveAttribute('href', 'https://x/p.pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(pdf).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pdf).toHaveAttribute('download');

    const wa = screen.getByRole('link', { name: 'Pedir por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    expect(wa.className).toContain('aichat-action-whatsapp');
    expect(wa).not.toHaveAttribute('download');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/preset/Card.test.tsx`
Expected: FAIL — cannot find module `./Card`.

- [ ] **Step 3: Write `src/preset/Card.tsx`**

```tsx
import type { Card as CardType, CardAction, BudgetCard } from '../types';

function ActionIcon({ name }: { name?: CardAction['icon'] }) {
  if (!name) return null;
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
  if (name === 'download')
    return (
      <svg {...common}>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === 'whatsapp')
    return (
      <svg {...common}>
        <path d="M5.5 4.5h2a1 1 0 0 1 1 .85l.4 2.5a1 1 0 0 1-.3.9l-1 1a13 13 0 0 0 5.6 5.6l1-1a1 1 0 0 1 .9-.3l2.5.4a1 1 0 0 1 .85 1v2a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 4 6.1 1.5 1.5 0 0 1 5.5 4.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === 'chat')
    return (
      <svg {...common}>
        <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 4h6v6M20 4l-9 9M19 13v6H5V5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardActions({ actions }: { actions: CardAction[] }) {
  const usable = (actions ?? []).filter((a) => a.url);
  if (usable.length === 0) return null;
  return (
    <div className="aichat-card-actions">
      {usable.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          download={a.download || undefined}
          className={`aichat-action aichat-action-${a.style ?? 'default'}`}
        >
          <ActionIcon name={a.icon} />
          {a.label}
        </a>
      ))}
    </div>
  );
}

function BudgetBody({ card }: { card: BudgetCard }) {
  return (
    <>
      <div className="aichat-card-head">
        <span className="aichat-card-title">{card.title}</span>
        {card.subtitle && <span className="aichat-card-subtitle">{card.subtitle}</span>}
      </div>
      {card.lines.length > 0 && (
        <div className="aichat-card-lines">
          {card.lines.map((l, i) => (
            <div key={i} className="aichat-card-line">
              <span>
                {l.qty ? `${l.qty}× ` : ''}
                {l.label}
              </span>
              {l.amount && <span className="aichat-card-amount">{l.amount}</span>}
            </div>
          ))}
        </div>
      )}
      {card.total && (
        <div className="aichat-card-total">
          <span>{card.total.label}</span>
          <span>{card.total.amount}</span>
        </div>
      )}
    </>
  );
}

export function Card({ card }: { card: CardType }) {
  return (
    <div className="aichat-card">
      {card.type === 'budget' && <BudgetBody card={card} />}
      <CardActions actions={card.actions} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/preset/Card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preset/Card.tsx src/preset/Card.test.tsx
git commit -m "feat(preset): Card component (budget summary + generic action links)"
```

---

## Task 5: Render the card in `ChatBody` + export from preset

**Files:**
- Modify: `src/preset/ChatBody.tsx`, `src/preset/index.ts`, `src/preset/ChatPanel.test.tsx`

- [ ] **Step 1: Write the failing integration test (append to `ChatPanel.test.tsx`)**

In `src/preset/ChatPanel.test.tsx`, add inside the `describe('ChatPanel', ...)` block:

```tsx
  it('renders a streamed budget card with a WhatsApp action', async () => {
    const card = {
      type: 'budget',
      title: 'Presupuesto #1042',
      lines: [],
      actions: [{ label: 'Pedir por WhatsApp', url: 'https://wa.me/549110000?text=hola', style: 'whatsapp', icon: 'whatsapp' }],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never) as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c4' }), { status: 201 }))
      .mockResolvedValueOnce(
        sseResponse([
          'event: text\ndata: {"delta":"Te armé el presupuesto"}\n\n',
          `event: card\ndata: ${JSON.stringify(card)}\n\n`,
          'event: done\ndata: {}\n\n',
        ]),
      );
    render(<ChatPanel config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    await userEvent.type(screen.getByPlaceholderText('Escribí tu mensaje…'), 'precio{Enter}');
    expect(await screen.findByText('Presupuesto #1042')).toBeInTheDocument();
    const wa = screen.getByRole('link', { name: 'Pedir por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/preset/ChatPanel.test.tsx`
Expected: FAIL — card title not rendered (ChatBody ignores `message.card`).

- [ ] **Step 3: Render the card in `ChatBody.tsx`**

Add the import of `Fragment` and `Card`, and replace the messages `.map(...)` block.

Change the React import line:

```tsx
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
```

Add below the existing imports:

```tsx
import { Card } from './Card';
```

Replace the messages map:

```tsx
        {messages.map((m) => (
          <Fragment key={m.id}>
            {(m.role === 'user' || m.text.trim() !== '') && (
              <div className={`aichat-msg aichat-msg-${m.role}`}>
                {m.role === 'assistant' ? <Markdown>{m.text}</Markdown> : m.text}
              </div>
            )}
            {m.card && <Card card={m.card} />}
          </Fragment>
        ))}
```

- [ ] **Step 4: Export `Card` from `src/preset/index.ts`**

Append:

```ts
export { Card } from './Card';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/preset/ChatPanel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/preset/ChatBody.tsx src/preset/index.ts src/preset/ChatPanel.test.tsx
git commit -m "feat(preset): render message.card below the assistant text"
```

---

## Task 6: Card styles

**Files:**
- Modify: `src/styles/aichat.css`

- [ ] **Step 1: Add the WhatsApp token**

In the `.aichat-root` token block, add after `--aichat-muted`:

```css
  --aichat-whatsapp: #25d366;
```

- [ ] **Step 2: Append the card + action styles at the end of the file**

```css
/* tarjeta interactiva (presupuesto) */
.aichat-card {
  align-self: flex-start;
  width: 320px;
  max-width: 100%;
  background: var(--aichat-surface);
  border: 1px solid var(--aichat-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--aichat-shadow-1);
  animation: aichat-rise 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.aichat-card-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--aichat-border);
}
.aichat-card-title {
  font-weight: 600;
  font-size: 0.9rem;
}
.aichat-card-subtitle {
  font-size: 0.75rem;
  color: var(--aichat-muted);
}
.aichat-card-lines {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.625rem 0.875rem;
  font-size: 0.85rem;
}
.aichat-card-line {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.aichat-card-amount {
  color: var(--aichat-muted);
  white-space: nowrap;
}
.aichat-card-total {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-top: 1px solid var(--aichat-border);
  font-weight: 600;
}
.aichat-card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem 0.875rem;
  border-top: 1px solid var(--aichat-border);
}
.aichat-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.12s ease,
    opacity 0.15s ease;
}
.aichat-action:active {
  transform: scale(0.98);
}
.aichat-action-primary {
  background: var(--aichat-primary);
  color: var(--aichat-on-primary);
}
.aichat-action-whatsapp {
  background: var(--aichat-whatsapp);
  color: #fff;
}
.aichat-action-default {
  background: transparent;
  color: var(--aichat-text);
  border-color: var(--aichat-border);
}
@media (prefers-reduced-motion: reduce) {
  .aichat-card {
    animation: none;
  }
}
```

- [ ] **Step 3: Verify build + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/styles/aichat.css
git commit -m "feat(preset): styles for budget card + action buttons"
```

---

## Task 7: Mock canned card response (playground)

**Files:**
- Modify: `example/mock.ts`

- [ ] **Step 1: Add a card to the `Canned` type and a budget canned response**

In `example/mock.ts`, change the `Canned` interface and add a 5th entry to `CANNED`.

Replace the `Canned` interface with:

```ts
interface Canned {
  tools?: string[];
  text: string;
  card?: unknown;
}
```

Add as a new entry at the end of the `CANNED` array (before the closing `];`):

```ts
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
        { label: 'Descargar PDF', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', icon: 'download', download: true, style: 'primary' },
        { label: 'Pedir por WhatsApp', url: 'https://wa.me/5491100000000?text=' + encodeURIComponent('Hola! Quiero avanzar con el presupuesto #1042 (Central Led).'), icon: 'whatsapp', style: 'whatsapp' },
        { label: 'Tengo una consulta', url: 'https://wa.me/5491100000000?text=' + encodeURIComponent('Hola! Tengo una consulta sobre el presupuesto #1042.'), icon: 'chat', style: 'default' },
      ],
    },
  },
```

- [ ] **Step 2: Emit the card in the SSE stream**

In `sseResponse(canned)`, after the text chunks loop and before the `done` event, add the card emission. Locate:

```ts
      controller.enqueue(enc.encode(sseBlock('done', { rounds: (canned.tools?.length ?? 0) + 1 })));
```

Insert immediately BEFORE that line:

```ts
      if (canned.card) {
        await sleep(120);
        controller.enqueue(enc.encode(sseBlock('card', canned.card)));
      }
```

- [ ] **Step 3: Manual verification in the playground**

Run (if not already running): `npm run example` (and `ai-api` is not needed — mock is on by default).
Open `http://localhost:5174/`, send messages until the 5th rotates in (or send 5 messages). Expected: a budget card with title "Presupuesto #1042", two lines, total $998.750, and three buttons; the WhatsApp buttons open `wa.me` in a new tab; "Descargar PDF" downloads/opens the dummy PDF.

- [ ] **Step 4: Commit**

```bash
git add example/mock.ts
git commit -m "chore(example): mock canned budget card response"
```

---

## Self-Review

**Spec coverage:**
- Evento SSE `card` + tipos `Card`/`CardAction`/`BudgetCard` → Task 1. ✓
- `toChatEvent` mapea `card` → Task 2. ✓
- `Message.card` + acumulación en `useConversation` (incl. 2º card → mensaje nuevo) → Task 1 (type) + Task 3. ✓
- Render: `Card` (budget body + acciones genéricas, link `target=_blank rel=noopener`, `download`) → Task 4. ✓
- Integración en `ChatBody` (card debajo del texto, sin burbuja vacía si text='') → Task 5. ✓
- Estilos card + acciones + `--aichat-whatsapp` → Task 6. ✓
- Mock canned card (documenta el contrato del backend) → Task 7. ✓
- Fallback type desconocido: `Card` solo renderiza body si `type==='budget'`, acciones siempre → no rompe (Task 4). ✓
- Acción sin `url` no se renderiza → Task 4 (`.filter((a) => a.url)`). ✓
- Export de tipos (headless) y del componente `Card` (preset) → Task 1, Task 5. ✓

**Placeholder scan:** Sin TBD/TODO; todo el código está completo en cada paso. ✓

**Type consistency:** `Card`/`CardAction`/`BudgetCard` definidos en Task 1 y usados igual en 2/3/4. `toChatEvent` devuelve `{type:'card', card}` (Task 2) consumido por `useConversation` (Task 3) y renderizado por `Card` (Task 4). `message.card` (Task 1) leído en `ChatBody` (Task 5). Clases CSS (`aichat-card*`, `aichat-action*`) usadas en Task 4 y definidas en Task 6. ✓
