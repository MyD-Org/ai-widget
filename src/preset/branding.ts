import type { CSSProperties } from 'react';

export interface Branding {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  primaryColor?: string;
  /** Color del texto y los íconos que van ENCIMA del acento: burbuja del usuario, botón
   *  de enviar, launcher, avatar. Default: blanco.
   *
   *  Existe porque el acento no siempre es oscuro. Con un acento claro (un dorado, un
   *  ámbar, un verde pastel) el blanco encima no llega a contraste legible y hay que
   *  poner tinta oscura. Sin esta prop, esos tonos quedaban vetados: no por gusto, sino
   *  porque el texto no se leía. */
  onPrimaryColor?: string;
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
  if (branding?.onPrimaryColor) style['--aichat-on-primary'] = branding.onPrimaryColor;
  return style as CSSProperties;
}
