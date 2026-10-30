import cssRaw from './aichat.css?raw';
import { describe, expect, it } from 'vitest';

// El host pinta las cards de producto con sus tokens (README, Theming): si una regla vuelve a
// usar el primario directo, el Shop pierde los colores de su catálogo.
const css: string = cssRaw;
const regla = (selector: string) => {
  const i = css.indexOf(`\n${selector} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};

describe('tokens de las cards de producto', () => {
  it('declara los tokens con default en el primario', () => {
    for (const t of ['--aichat-price-note', '--aichat-add-bg', '--aichat-add-bg-hover', '--aichat-add-text']) {
      expect(css).toMatch(new RegExp(`${t}:`));
    }
  });

  it('priceNote, Agregar y el contador usan los tokens', () => {
    expect(regla('.aichat-product-pricenote')).toContain('var(--aichat-price-note)');
    expect(regla('.aichat-stepper')).toContain('var(--aichat-add-bg)');
    expect(regla('.aichat-stepper')).toContain('var(--aichat-add-text)');
    expect(css).toContain('.aichat-add:hover:not(:disabled) { background: var(--aichat-add-bg-hover); }');
  });
});
