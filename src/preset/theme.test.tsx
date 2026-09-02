import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';
import { themeClass } from './branding';

const config = { baseUrl: 'https://api.test', agentId: 'a', token: 'jwt', persist: 'none' } as const;

describe('themeClass', () => {
  it('auto es el default y sigue al sistema', () => {
    expect(themeClass()).toBe('aichat-auto');
    expect(themeClass('auto')).toBe('aichat-auto');
  });

  it('dark lo dicta el host', () => {
    expect(themeClass('dark')).toBe('aichat-dark');
  });

  it('light no agrega clase: los tokens claros ya son el default de .aichat-root', () => {
    expect(themeClass('light')).toBe('');
  });
});

describe('prop theme', () => {
  const root = (el: HTMLElement) => el.querySelector('.aichat-root')!;

  it('sin theme, el root queda en auto', () => {
    const { container } = render(<ChatPanel config={config} />);
    expect(root(container).classList.contains('aichat-auto')).toBe(true);
    expect(root(container).classList.contains('aichat-dark')).toBe(false);
  });

  it('theme="dark" fuerza oscuro sin importar el sistema', () => {
    const { container } = render(<ChatPanel config={config} theme="dark" />);
    expect(root(container).classList.contains('aichat-dark')).toBe(true);
    expect(root(container).classList.contains('aichat-auto')).toBe(false);
  });

  it('theme="light" fuerza claro: ni auto ni dark', () => {
    const { container } = render(<ChatPanel config={config} theme="light" />);
    expect(root(container).classList.contains('aichat-auto')).toBe(false);
    expect(root(container).classList.contains('aichat-dark')).toBe(false);
  });

  it('el tema convive con la variante dock', () => {
    const { container } = render(<ChatPanel config={config} theme="dark" variant="dock" />);
    expect(root(container).classList.contains('aichat-dark')).toBe(true);
    expect(root(container).classList.contains('aichat-dock')).toBe(true);
  });
});
