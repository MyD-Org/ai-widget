import type { CSSProperties } from 'react';

export interface Branding {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  primaryColor?: string;
  launcherPosition?: 'bottom-right' | 'bottom-left';
}

export function brandingStyle(branding?: Branding): CSSProperties {
  const style: Record<string, string> = {};
  if (branding?.primaryColor) style['--aichat-primary'] = branding.primaryColor;
  return style as CSSProperties;
}
