import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatDrawer } from './ChatDrawer';

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('ChatDrawer', () => {
  it('is closed initially and opens on launcher click', async () => {
    render(<ChatDrawer config={{ baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' }} />);
    expect(screen.queryByPlaceholderText('Escribí tu mensaje…')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
  });

  it('respects launcherPosition branding', async () => {
    render(
      <ChatDrawer
        config={{ baseUrl: 'x', agentId: 'a', token: 'jwt', persist: 'none' }}
        branding={{ launcherPosition: 'bottom-left' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Abrir chat' }).className).toContain('aichat-launcher-bottom-left');
  });
});
