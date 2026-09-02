import { describe, it, expect } from 'vitest';
import { brandingStyle } from './branding';

describe('brandingStyle', () => {
  it('sin branding no emite variables', () => {
    expect(brandingStyle()).toEqual({});
    expect(brandingStyle({})).toEqual({});
  });

  it('mapea el acento del tenant', () => {
    expect(brandingStyle({ primaryColor: '#a19268' })).toEqual({ '--aichat-primary': '#a19268' });
  });

  it('mapea el color del texto sobre el acento', () => {
    // Un acento claro necesita tinta oscura encima: con blanco la burbuja del usuario
    // no llega a contraste legible.
    expect(brandingStyle({ primaryColor: '#a19268', onPrimaryColor: '#16161a' })).toEqual({
      '--aichat-primary': '#a19268',
      '--aichat-on-primary': '#16161a',
    });
  });

  it('onPrimaryColor se puede pasar solo, sin acento', () => {
    expect(brandingStyle({ onPrimaryColor: '#000' })).toEqual({ '--aichat-on-primary': '#000' });
  });

  it('los campos que no son de color no viajan como CSS', () => {
    expect(brandingStyle({ title: 'Asistente', subtitle: 'x', launcherPosition: 'bottom-left' })).toEqual({});
  });
});
