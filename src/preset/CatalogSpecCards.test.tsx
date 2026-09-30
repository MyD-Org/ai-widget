import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';
import type { CatalogCard, ResolvedProduct, SpecCard } from '../types';
import catalogFx from './__fixtures__/sales-cards/catalog.json';
import specFx from './__fixtures__/sales-cards/spec.json';
import { SheetContext } from './sheetContext';

// Fixtures copiadas del contrato (platform/contracts/sales-cards/v1).
const catalog = catalogFx as CatalogCard;
const spec = specFx as SpecCard;
// Una copia por test: la card ya navegada se recuerda por identidad (WeakSet) en la página.
const freshCatalog = (): CatalogCard => JSON.parse(JSON.stringify(catalog));

const APPLIED = 'Filtros aplicados: Reflectores · Luz cálida · Apto exterior';
const SUGGESTED = 'Filtros sugeridos: Reflectores · Luz cálida · Apto exterior';

describe('card catalog', () => {
  it('en vivo y con shouldAutoNavigate: navega sola una única vez y ofrece Deshacer', async () => {
    const card = freshCatalog();
    const undo = vi.fn();
    const onNavigateCatalog = vi.fn().mockReturnValue({ undo });
    const commerce = () => ({ onNavigateCatalog, shouldAutoNavigate: () => true });
    const { rerender } = render(
      <StrictMode>
        <Card card={card} live commerce={commerce()} />
      </StrictMode>,
    );
    expect(await screen.findByText(APPLIED)).toBeInTheDocument();
    // Re-renders del streaming con callbacks nuevos: no vuelve a navegar.
    rerender(
      <StrictMode>
        <Card card={card} live commerce={commerce()} />
      </StrictMode>,
    );
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(onNavigateCatalog).toHaveBeenCalledWith(card.filters, card);

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    expect(screen.getByText(SUGGESTED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver en el catálogo' })).toBeInTheDocument();
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
  });

  it('avisa a la hoja mobile solo cuando navega sola, una vez (no con el botón)', async () => {
    const onCatalogAutoNavigated = vi.fn();
    const onNavigateCatalog = vi.fn().mockReturnValue(undefined);
    const card = freshCatalog();
    const ctx = { onCatalogAutoNavigated };
    const { rerender } = render(
      <StrictMode>
        <SheetContext.Provider value={ctx}>
          <Card card={card} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => true }} />
        </SheetContext.Provider>
      </StrictMode>,
    );
    await screen.findByText(APPLIED);
    rerender(
      <StrictMode>
        <SheetContext.Provider value={ctx}>
          <Card card={card} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => true }} />
        </SheetContext.Provider>
      </StrictMode>,
    );
    expect(onCatalogAutoNavigated).toHaveBeenCalledTimes(1);
    expect(onCatalogAutoNavigated).toHaveBeenCalledWith(catalog.summary);

    // Card sin permiso de navegar sola: el botón navega pero no minimiza la hoja.
    const manual = vi.fn();
    render(
      <SheetContext.Provider value={{ onCatalogAutoNavigated: manual }}>
        <Card card={freshCatalog()} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => false }} />
      </SheetContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el catálogo' }));
    expect(manual).not.toHaveBeenCalled();
  });

  it('si el host falla al navegar, no avisa a la hoja', async () => {
    const onCatalogAutoNavigated = vi.fn();
    const onNavigateCatalog = vi.fn(() => {
      throw new Error('nope');
    });
    render(
      <SheetContext.Provider value={{ onCatalogAutoNavigated }}>
        <Card card={freshCatalog()} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => true }} />
      </SheetContext.Provider>,
    );
    await act(async () => {});
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(onCatalogAutoNavigated).not.toHaveBeenCalled();
  });

  it('la misma card montada de nuevo no vuelve a navegar sola', async () => {
    const card = freshCatalog();
    const onNavigateCatalog = vi.fn().mockReturnValue(undefined);
    const commerce = { onNavigateCatalog, shouldAutoNavigate: () => true };
    const first = render(<Card card={card} live commerce={commerce} />);
    await screen.findByText(APPLIED);
    first.unmount();
    render(<Card card={card} live commerce={commerce} />);
    await act(async () => {});
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ver en el catálogo' })).toBeInTheDocument();
  });

  it('desde el historial nunca navega sola: ofrece "Ver en el catálogo"', async () => {
    const onNavigateCatalog = vi.fn().mockReturnValue(undefined);
    const shouldAutoNavigate = vi.fn().mockReturnValue(true);
    render(<Card card={freshCatalog()} commerce={{ onNavigateCatalog, shouldAutoNavigate }} />);
    await act(async () => {});
    expect(onNavigateCatalog).not.toHaveBeenCalled();
    expect(screen.getByText(SUGGESTED)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver en el catálogo' }));
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(screen.getByText(APPLIED)).toBeInTheDocument();
    // Sin undo devuelto por el host, no hay Deshacer.
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('en vivo con shouldAutoNavigate false (o ausente): no navega, muestra el botón', async () => {
    const onNavigateCatalog = vi.fn().mockReturnValue({ undo: vi.fn() });
    const { unmount } = render(
      <Card card={freshCatalog()} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => false }} />,
    );
    await act(async () => {});
    expect(onNavigateCatalog).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ver en el catálogo' })).toBeInTheDocument();
    unmount();

    render(<Card card={freshCatalog()} live commerce={{ onNavigateCatalog }} />);
    await act(async () => {});
    expect(onNavigateCatalog).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el catálogo' }));
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
  });

  it('sin onNavigateCatalog: solo texto, sin botones', async () => {
    render(<Card card={freshCatalog()} live commerce={{ shouldAutoNavigate: () => true }} />);
    await act(async () => {});
    expect(screen.getByText(SUGGESTED)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('si el host tira al navegar, la card no se rompe y queda el botón', async () => {
    const onNavigateCatalog = vi.fn(() => {
      throw new Error('router');
    });
    render(<Card card={freshCatalog()} live commerce={{ onNavigateCatalog, shouldAutoNavigate: () => true }} />);
    await act(async () => {});
    expect(onNavigateCatalog).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ver en el catálogo' })).toBeInTheDocument();
  });

  it('los textos se pueden reemplazar desde labels', async () => {
    const { defaultLabels } = await import('./labels');
    render(
      <Card
        card={freshCatalog()}
        commerce={{ onNavigateCatalog: () => undefined }}
        labels={{ ...defaultLabels, catalogSuggestedLabel: 'Sugerencia → {summary}', catalogViewLabel: 'Aplicar' }}
      />,
    );
    expect(screen.getByText('Sugerencia → Reflectores · Luz cálida · Apto exterior')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
  });
});

const product: ResolvedProduct = {
  id: '1234',
  name: 'Reflector LED 50W Cálido Macroled',
  brand: 'Macroled',
  imageUrl: 'https://img.test/1234.jpg',
  price: 25990,
  available: true,
  code: 'RF-50C',
  attributes: ['Luz cálida', 'Apto exterior'],
  specUrl: 'https://cdn.test/fichas/1234.pdf',
};

describe('card spec', () => {
  it('sin resolveProducts: label y nota del asesor, sin precio ni botones', () => {
    render(<Card card={spec} />);
    expect(screen.getByText('Reflector LED 50W cálido')).toBeInTheDocument();
    expect(screen.getByText('Para un patio de 6×8 m alcanza con uno bien ubicado.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('resuelto: foto, nombre, código, precio, disponibilidad y atributos como chips', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([product]);
    render(<Card card={spec} commerce={{ resolveProducts }} />);
    expect(await screen.findByText('Reflector LED 50W Cálido Macroled')).toBeInTheDocument();
    expect(resolveProducts).toHaveBeenCalledWith(['1234']);
    expect(screen.getByText('Macroled')).toBeInTheDocument();
    expect(screen.getByText('Cód. RF-50C')).toBeInTheDocument();
    expect(screen.getByText('$ 25.990')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'Características' });
    expect(chips).toHaveTextContent('Luz cálida');
    expect(chips).toHaveTextContent('Apto exterior');
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://img.test/1234.jpg');
  });

  it('sin code usa el sku', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([{ id: '1234', name: 'X', sku: 'SKU-9' }]);
    render(<Card card={spec} commerce={{ resolveProducts }} />);
    expect(await screen.findByText('Cód. SKU-9')).toBeInTheDocument();
  });

  it('el id que el host no encuentra cae al label y queda "No disponible"', async () => {
    const onAddProducts = vi.fn();
    const resolveProducts = vi.fn().mockResolvedValue([]);
    render(<Card card={spec} commerce={{ resolveProducts, onAddProducts }} />);
    expect(await screen.findByText('No disponible')).toBeInTheDocument();
    expect(screen.getByText('Reflector LED 50W cálido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar/ })).toBeDisabled();
  });

  it('"Ficha técnica (PDF)" solo con specUrl http(s), en pestaña nueva', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([product]);
    const { unmount } = render(<Card card={spec} commerce={{ resolveProducts }} />);
    const link = await screen.findByRole('link', { name: 'Ficha técnica (PDF)' });
    expect(link).toHaveAttribute('href', 'https://cdn.test/fichas/1234.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    unmount();

    const noPdf = vi.fn().mockResolvedValue([{ ...product, specUrl: undefined }]);
    const second = render(<Card card={spec} commerce={{ resolveProducts: noPdf }} />);
    await screen.findByText('Reflector LED 50W Cálido Macroled');
    expect(screen.queryByRole('link')).toBeNull();
    second.unmount();

    const unsafe = vi.fn().mockResolvedValue([{ ...product, specUrl: 'javascript:alert(1)' }]);
    render(<Card card={spec} commerce={{ resolveProducts: unsafe }} />);
    await screen.findByText('Reflector LED 50W Cálido Macroled');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('acciones opt-in: Agregar con onAddProducts y "Ver producto" con onOpenProduct', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([product]);
    const { unmount } = render(<Card card={spec} commerce={{ resolveProducts }} />);
    await screen.findByText('Reflector LED 50W Cálido Macroled');
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    const onAddProducts = vi.fn();
    const onOpenProduct = vi.fn();
    render(<Card card={spec} commerce={{ resolveProducts, onAddProducts, onOpenProduct }} />);
    await screen.findByText('Reflector LED 50W Cálido Macroled');
    await userEvent.click(screen.getByRole('button', { name: /Agregar/ }));
    expect(onAddProducts).toHaveBeenCalledWith([{ id: '1234', qty: 1 }]);
    expect(screen.getByRole('button', { name: /Agregado/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver producto' }));
    expect(onOpenProduct).toHaveBeenCalledWith('1234');
  });

  it('con el producto en el carrito muestra el contador de cantidad', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([product]);
    const onSetQuantity = vi.fn();
    render(
      <Card
        card={spec}
        commerce={{ resolveProducts, onAddProducts: vi.fn(), onSetQuantity, cartQuantities: { '1234': 2 } }}
      />,
    );
    await screen.findByText('Reflector LED 50W Cálido Macroled');
    expect(screen.getByText('2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar uno más' }));
    expect(onSetQuantity).toHaveBeenCalledWith('1234', 3);
  });

  it('card spec sin id válido no dibuja nada', async () => {
    const { container } = render(<Card card={{ type: 'spec', label: 'x' } as never} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
