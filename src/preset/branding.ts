import type { CSSProperties } from 'react';

export interface Branding {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  primaryColor?: string;
  launcherPosition?: 'bottom-right' | 'bottom-left';
}

/** 'auto' (default): sigue prefers-color-scheme del sistema. 'light' | 'dark': lo dicta
 *  el host. Existe porque un host con su propio switch de tema (next-themes y similares)
 *  puede estar en oscuro con el sistema en claro: sin la prop el widget quedaría blanco
 *  sobre una app oscura. */
export type Theme = 'light' | 'dark' | 'auto';

/** Clase de tema para .aichat-root. 'light' no lleva clase: los tokens claros ya son
 *  el default de .aichat-root, así que agregar una sería ruido. */
export function themeClass(theme: Theme = 'auto'): string {
  if (theme === 'dark') return 'aichat-dark';
  if (theme === 'auto') return 'aichat-auto';
  return '';
}

export function brandingStyle(branding?: Branding): CSSProperties {
  const style: Record<string, string> = {};
  if (branding?.primaryColor) style['--aichat-primary'] = branding.primaryColor;
  return style as CSSProperties;
}
