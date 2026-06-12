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
}
```
