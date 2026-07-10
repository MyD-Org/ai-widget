import { describe, it, expect } from 'vitest';
import { mdToWhatsApp } from './mdToWhatsApp';

describe('mdToWhatsApp', () => {
  it('convierte negrita **..** y __..__ a *..* de WhatsApp', () => {
    expect(mdToWhatsApp('dale **6 mm²** y __ya__')).toBe('dale *6 mm²* y *ya*');
  });

  it('convierte cursiva *..* y _.._ a _.._ de WhatsApp', () => {
    expect(mdToWhatsApp('es *importante* y _urgente_')).toBe('es _importante_ y _urgente_');
  });

  it('convierte tachado ~~..~~ a ~..~', () => {
    expect(mdToWhatsApp('~~agotado~~')).toBe('~agotado~');
  });

  it('convierte viñetas -,*,+ en • y preserva los saltos de línea', () => {
    expect(mdToWhatsApp('- uno\n* dos\n+ tres')).toBe('• uno\n• dos\n• tres');
  });

  it('deja las listas numeradas como están', () => {
    expect(mdToWhatsApp('1. uno\n2. dos')).toBe('1. uno\n2. dos');
  });

  it('convierte encabezados en una línea en negrita', () => {
    expect(mdToWhatsApp('# Título\n\ncuerpo')).toBe('*Título*\n\ncuerpo');
  });

  it('aplana links [texto](url) a "texto (url)"', () => {
    expect(mdToWhatsApp('mirá el [catálogo](https://x.io/c)')).toBe('mirá el catálogo (https://x.io/c)');
  });

  it('deja solo la url cuando el texto del link es la url misma', () => {
    expect(mdToWhatsApp('[https://x.io](https://x.io)')).toBe('https://x.io');
  });

  it('no toca el contenido del código inline ni de los bloques', () => {
    expect(mdToWhatsApp('usá `a **b** c` así')).toBe('usá `a **b** c` así');
    expect(mdToWhatsApp('```\n**no** _tocar_\n```')).toBe('```\n**no** _tocar_\n```');
  });

  it('quita citas y reglas horizontales, y colapsa líneas en blanco', () => {
    expect(mdToWhatsApp('> cita\n\n---\n\n\n\nfin')).toBe('cita\n\nfin');
  });

  it('caso real del copiloto: lista con negritas queda legible en WhatsApp', () => {
    const input = [
      'Datos que necesito:',
      '',
      '- **¿Qué sección?** Lo habitual es **6 mm²**.',
      '- **¿Térmica?** No está en lista.',
    ].join('\n');
    const expected = [
      'Datos que necesito:',
      '',
      '• *¿Qué sección?* Lo habitual es *6 mm²*.',
      '• *¿Térmica?* No está en lista.',
    ].join('\n');
    expect(mdToWhatsApp(input)).toBe(expected);
  });
});
