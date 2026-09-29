import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function Arrow({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'prev' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

/** Carrusel horizontal de cards. Scroll nativo con `scroll-snap` (en touch, swipe con la inercia
 *  del sistema); flechas discretas solo con mouse (CSS) y teclado con ←/→/Home/End. Sin scroll
 *  posible (todo entra) no dibuja flechas. Con `prefers-reduced-motion` el desplazamiento es
 *  instantáneo. */
export function ProductCarousel({
  label,
  prevLabel,
  nextLabel,
  children,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const move = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>('.aichat-carousel-item');
    const step = item ? item.offsetWidth + 10 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Solo con el foco en la pista: dentro de un botón, las flechas no deben desplazar.
    if (e.target !== e.currentTarget) return;
    const el = trackRef.current;
    if (!el) return;
    if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'Home') el.scrollTo({ left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else if (e.key === 'End') el.scrollTo({ left: el.scrollWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else return;
    e.preventDefault();
  };

  const canScroll = !(atStart && atEnd);

  return (
    <div className="aichat-carousel">
      <div
        ref={trackRef}
        className="aichat-carousel-track"
        role="region"
        aria-roledescription="carrusel"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={onKeyDown}
      >
        {Children.toArray(children).map((child, i) => (
          <div key={i} className="aichat-carousel-item">
            {child}
          </div>
        ))}
      </div>
      {canScroll && (
        <>
          <button type="button" className="aichat-carousel-arrow aichat-carousel-arrow-prev" aria-label={prevLabel} disabled={atStart} onClick={() => move(-1)}>
            <Arrow dir="prev" />
          </button>
          <button type="button" className="aichat-carousel-arrow aichat-carousel-arrow-next" aria-label={nextLabel} disabled={atEnd} onClick={() => move(1)}>
            <Arrow dir="next" />
          </button>
        </>
      )}
    </div>
  );
}
