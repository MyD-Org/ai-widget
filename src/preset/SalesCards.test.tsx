import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';
import type { CartCard, HandoffCard, ProductsCard, RepliesCard, ResolvedProduct } from '../types';
import productsFx from './__fixtures__/sales-cards/products.json';
import cartFx from './__fixtures__/sales-cards/cart.json';
import repliesFx from './__fixtures__/sales-cards/replies.json';
import handoffFx from './__fixtures__/sales-cards/handoff.json';

// Las fixtures son copia del contrato (platform/contracts/sales-cards/v1): si el contrato
// cambia y el widget no, estos tests son los que tienen que romper.
const products = productsFx as ProductsCard;
const cart = cartFx as CartCard;
const replies = repliesFx as RepliesCard;
const handoff = handoffFx as HandoffCard;

const resolved: ResolvedProduct[] = [
  { id: '1101', name: 'Reflector LED 50W Macroled', brand: 'Macroled', imageUrl: 'https://img.test/1101.jpg', price: 25990, available: true },
  { id: '1102', name: 'Reflector LED 100W', price: 41500, available: false },
];

describe('card products', () => {
  it('renderiza la fixture con labels y reason, sin botones si el host no pasa callbacks', () => {
    render(<Card card={products} />);
    expect(screen.getByText('Opciones para exterior')).toBeInTheDocument();
    expect(screen.getByText('Reflector LED 50W IP65 luz fría')).toBeInTheDocument();
    // El motivo del agente ya no se dibuja: la card es la del catálogo.
    expect(screen.queryByText('Apto intemperie')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('con resolveProducts muestra nombre, marca, foto, precio y "No disponible"', async () => {
    const resolveProducts = vi.fn().mockResolvedValue(resolved);
    render(<Card card={products} commerce={{ resolveProducts }} />);
    expect(await screen.findByText('Reflector LED 50W Macroled')).toBeInTheDocument();
    expect(resolveProducts).toHaveBeenCalledWith(['1101', '1102']);
    expect(screen.getByText('Macroled')).toBeInTheDocument();
    expect(screen.getByText('$ 25.990')).toBeInTheDocument();
    expect(screen.getByText('$ 41.500')).toBeInTheDocument();
    expect(screen.getByText('No disponible')).toBeInTheDocument();
    // Decorativa: el nombre ya está en la card.
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('src', 'https://img.test/1101.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('llama resolveProducts una sola vez aunque el host pase una arrow nueva en cada render', async () => {
    const spy = vi.fn().mockResolvedValue(resolved);
    const { rerender } = render(<Card card={products} commerce={{ resolveProducts: (ids) => spy(ids) }} />);
    await screen.findByText('Reflector LED 50W Macroled');
    rerender(<Card card={products} commerce={{ resolveProducts: (ids) => spy(ids) }} />);
    rerender(<Card card={products} commerce={{ resolveProducts: (ids) => spy(ids) }} />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('si resolveProducts rechaza, quedan los labels sin precio ni foto', async () => {
    const resolveProducts = vi.fn().mockRejectedValue(new Error('500'));
    render(<Card card={products} commerce={{ resolveProducts }} />);
    await waitFor(() => expect(resolveProducts).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByText('Reflector LED 50W IP65 luz fría')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('un id que el host no devuelve cae al label; precio 0 o no finito no se muestra', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([{ id: '1101', name: 'Resuelto', price: 0 }]);
    render(<Card card={products} commerce={{ resolveProducts }} />);
    expect(await screen.findByText('Resuelto')).toBeInTheDocument();
    expect(screen.getByText('Reflector LED 100W IP66')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('descarta imageUrl con esquema inseguro', async () => {
    const resolveProducts = vi.fn().mockResolvedValue([{ id: '1101', name: 'X', imageUrl: 'javascript:alert(1)' }]);
    render(<Card card={products} commerce={{ resolveProducts }} />);
    await screen.findByText('X');
    expect(document.querySelector('img')).toBeNull();
  });

  it('Agregar manda [{id, qty:1}] y la fila pasa a "Agregado"; disabled si no está disponible', async () => {
    const onAddProducts = vi.fn();
    const resolveProducts = vi.fn().mockResolvedValue(resolved);
    render(<Card card={products} commerce={{ resolveProducts, onAddProducts }} />);
    await screen.findByText('No disponible');
    const [first, second] = screen.getAllByRole('button', { name: 'Agregar' });
    expect(second).toBeDisabled();
    await userEvent.click(first);
    expect(onAddProducts).toHaveBeenCalledWith([{ id: '1101', qty: 1 }]);
    expect(screen.getByRole('button', { name: 'Agregado' })).toBeDisabled();
    // la otra fila no cambia
    expect(screen.getByRole('button', { name: 'Agregar' })).toBe(second);
  });

  it('un id que falta en una respuesta completa queda "No disponible"; si el host falla, Agregar sigue', async () => {
    const onAddProducts = vi.fn();
    const soloUno = vi.fn().mockResolvedValue([resolved[0]]);
    const { unmount } = render(<Card card={products} commerce={{ resolveProducts: soloUno, onAddProducts }} />);
    await screen.findByText('No disponible');
    const [, faltante] = screen.getAllByRole('button', { name: 'Agregar' });
    expect(faltante).toBeDisabled();
    unmount();

    const falla = vi.fn().mockRejectedValue(new Error('500'));
    render(<Card card={products} commerce={{ resolveProducts: falla, onAddProducts }} />);
    await waitFor(() => expect(falla).toHaveBeenCalled());
    await act(async () => {});
    for (const b of screen.getAllByRole('button', { name: 'Agregar' })) expect(b).toBeEnabled();
  });

  it('la card abre la ficha solo con onOpenProduct (el nombre es el enlace estirado) y no hay botón Ver', async () => {
    const onOpenProduct = vi.fn();
    const { unmount } = render(<Card card={products} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(<Card card={products} commerce={{ onOpenProduct }} />);
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reflector LED 100W IP66' }));
    expect(onOpenProduct).toHaveBeenCalledWith('1102');
  });

  describe('contador de cantidad (como el catálogo)', () => {
    const one: ProductsCard = { type: 'products', items: [{ id: 'a', label: 'Reflector A' }] };
    const res = (o: Partial<ResolvedProduct> = {}) =>
      vi.fn().mockResolvedValue([{ id: 'a', name: 'Reflector A', price: 1244.07, available: true, sku: 'BT-55', ...o }]);

    it('muestra el código y los centavos en superíndice', async () => {
      render(<Card card={one} commerce={{ resolveProducts: res() }} />);
      expect(await screen.findByText('Cód. BT-55')).toBeInTheDocument();
      const price = screen.getByText(/\$ 1\.244/);
      expect(price.querySelector('sup')).toHaveTextContent('07');
    });

    it('con el producto en el carrito, "Agregar" pasa al contador; con 1, el "−" quita', async () => {
      const onSetQuantity = vi.fn();
      const commerce = { resolveProducts: res(), onAddProducts: vi.fn(), onSetQuantity, cartQuantities: { a: 1 } };
      render(<Card card={one} commerce={commerce} />);
      await screen.findByText('Reflector A');
      expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Quitar del carrito' }));
      expect(onSetQuantity).toHaveBeenCalledWith('a', 0);
      await userEvent.click(screen.getByRole('button', { name: 'Agregar uno más' }));
      expect(onSetQuantity).toHaveBeenCalledWith('a', 2);
    });

    it('con 3 unidades el "−" resta uno, y el "+" no pasa de maxQuantity', async () => {
      const onSetQuantity = vi.fn();
      const commerce = { resolveProducts: res({ maxQuantity: 3 }), onAddProducts: vi.fn(), onSetQuantity, cartQuantities: { a: 3 } };
      render(<Card card={one} commerce={commerce} />);
      await screen.findByText('Reflector A');
      expect(screen.getByRole('button', { name: 'Agregar uno más' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Quitar uno' }));
      expect(onSetQuantity).toHaveBeenCalledWith('a', 2);
    });

    it('sin cartQuantities/onSetQuantity se comporta como antes: Agregar y queda en "Agregado"', async () => {
      const onAddProducts = vi.fn();
      render(<Card card={one} commerce={{ resolveProducts: res(), onAddProducts }} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Agregar' }));
      expect(onAddProducts).toHaveBeenCalledWith([{ id: 'a', qty: 1 }]);
      expect(screen.getByRole('button', { name: 'Agregado' })).toBeDisabled();
    });

    it('con carrito informado, tras agregar el botón no queda en "Agregado" (lo reemplaza el contador)', async () => {
      const onAddProducts = vi.fn();
      const commerce = { resolveProducts: res(), onAddProducts, onSetQuantity: vi.fn(), cartQuantities: {} as Record<string, number> };
      const { rerender } = render(<Card card={one} commerce={commerce} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Agregar' }));
      rerender(<Card card={one} commerce={{ ...commerce, cartQuantities: { a: 1 } }} />);
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Agregado' })).toBeNull();
    });
  });
});

describe('card cart', () => {
  const priced: ResolvedProduct[] = [
    { id: '2201', name: 'Dicroica GU10 7W', price: 1500 },
    { id: '2202', name: 'Transformador 60W', price: 8000 },
  ];

  it('renderiza la fixture: título, "qty× label", sin precios ni total ni botón por defecto', () => {
    render(<Card card={cart} />);
    expect(screen.getByText('Su pedido')).toBeInTheDocument();
    expect(screen.getByText('20× Dicroica LED GU10 7W cálida')).toBeInTheDocument();
    expect(screen.getByText('5× Transformador electrónico 12V 60W')).toBeInTheDocument();
    expect(screen.queryByText('Total de referencia')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con todos los precios: subtotal por línea y total de referencia', async () => {
    render(<Card card={cart} commerce={{ resolveProducts: vi.fn().mockResolvedValue(priced) }} />);
    expect(await screen.findByText('$30.000')).toBeInTheDocument(); // 20 × 1500
    expect(screen.getByText('$40.000')).toBeInTheDocument(); // 5 × 8000
    expect(screen.getByText('Total de referencia')).toBeInTheDocument();
    expect(screen.getByText('$70.000')).toBeInTheDocument();
  });

  it('si falta un precio, no hay total (un total parcial engaña)', async () => {
    render(<Card card={cart} commerce={{ resolveProducts: vi.fn().mockResolvedValue([priced[0]]) }} />);
    expect(await screen.findByText('$30.000')).toBeInTheDocument();
    expect(screen.getByText('5× Transformador electrónico 12V 60W')).toBeInTheDocument();
    expect(screen.queryByText('Total de referencia')).toBeNull();
  });

  it('Agregar todo manda las líneas {id, qty} y queda "Agregado" deshabilitado', async () => {
    const onAddProducts = vi.fn();
    render(<Card card={cart} commerce={{ onAddProducts }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Agregar todo al carrito' }));
    expect(onAddProducts).toHaveBeenCalledWith([
      { id: '2201', qty: 20 },
      { id: '2202', qty: 5 },
    ]);
    expect(screen.getByRole('button', { name: 'Agregado' })).toBeDisabled();
  });
});

describe('card replies', () => {
  it('sin onReply no dibuja nada', () => {
    const { container } = render(<Card card={replies} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('con onReply dibuja un botón por opción y lo envía', async () => {
    const onReply = vi.fn();
    render(<Card card={replies} onReply={onReply} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Para exterior' }));
    expect(onReply).toHaveBeenCalledWith('Para exterior');
  });
});

describe('card handoff', () => {
  it('sin onHandoff: link a wa.me con el resumen codificado', () => {
    render(<Card card={handoff} />);
    expect(screen.getByText(handoff.summary)).toBeInTheDocument();
    const a = screen.getByRole('link', { name: 'Continuar por WhatsApp' });
    expect(a).toHaveAttribute(
      'href',
      'https://wa.me/5491100000000?text=Consulta%20por%20precio%20mayorista%20para%20200%20dicroicas%20GU10.',
    );
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('codifica acentos, & y saltos de línea del resumen', () => {
    render(<Card card={{ ...handoff, summary: 'Cotización & envío\nurgente' }} />);
    const href = screen.getByRole('link').getAttribute('href')!;
    expect(href).toBe(`https://wa.me/5491100000000?text=${encodeURIComponent('Cotización & envío\nurgente')}`);
    expect(decodeURIComponent(href.split('?text=')[1])).toBe('Cotización & envío\nurgente');
  });

  it('con onHandoff: botón que entrega la card, sin link', async () => {
    const onHandoff = vi.fn();
    render(<Card card={handoff} commerce={{ onHandoff }} />);
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar por WhatsApp' }));
    expect(onHandoff).toHaveBeenCalledWith(handoff);
  });

  it('teléfono fuera del contrato: muestra el resumen pero nada accionable', () => {
    render(<Card card={{ ...handoff, phone: '+54 9 11' }} commerce={{ onHandoff: vi.fn() }} />);
    expect(screen.getByText(handoff.summary)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('card de tipo desconocido', () => {
  it('no dibuja nada (un widget viejo ignora tipos nuevos)', () => {
    const { container } = render(<Card card={{ type: 'futuro' } as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});
