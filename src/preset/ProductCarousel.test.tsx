import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCarousel } from './ProductCarousel';

// jsdom no hace layout: simulamos el scroll de la pista.
function setup() {
  render(
    <ProductCarousel label="Productos" prevLabel="Anteriores" nextLabel="Siguientes">
      <div>uno</div>
      <div>dos</div>
      <div>tres</div>
    </ProductCarousel>,
  );
  const track = screen.getByRole('region', { name: 'Productos' }) as HTMLElement;
  const scrollBy = vi.fn();
  const scrollTo = vi.fn();
  Object.assign(track, { scrollBy, scrollTo });
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 900 });
  return { track, scrollBy, scrollTo };
}

const mm = (matches: boolean) =>
  vi.fn().mockImplementation((q: string) => ({ matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('ProductCarousel', () => {
  beforeEach(() => {
    window.matchMedia = mm(false) as unknown as typeof window.matchMedia;
  });

  it('es una región focuseable con aria-label', () => {
    const { track } = setup();
    expect(track).toHaveAttribute('tabindex', '0');
    expect(track).toHaveAttribute('aria-roledescription', 'carrusel');
  });

  it('las flechas aparecen si hay scroll: "anterior" deshabilitada al inicio', () => {
    const { track } = setup();
    fireEvent.scroll(track);
    expect(screen.getByRole('button', { name: 'Anteriores' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguientes' })).toBeEnabled();
  });

  it('sin scroll posible no dibuja flechas', () => {
    render(
      <ProductCarousel label="X" prevLabel="P" nextLabel="N">
        <div>solo</div>
      </ProductCarousel>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('las flechas del teclado desplazan la pista y no propagan el default', () => {
    const { track, scrollBy } = setup();
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
    fireEvent.keyDown(track, { key: 'ArrowLeft' });
    expect(scrollBy.mock.calls[1][0].left).toBeLessThan(0);
  });

  it('Home/End saltan a los extremos', () => {
    const { track, scrollTo } = setup();
    fireEvent.keyDown(track, { key: 'Home' });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    fireEvent.keyDown(track, { key: 'End' });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 900 }));
  });

  it('con prefers-reduced-motion el desplazamiento es instantáneo', () => {
    window.matchMedia = mm(true) as unknown as typeof window.matchMedia;
    const { track, scrollBy } = setup();
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });
});
