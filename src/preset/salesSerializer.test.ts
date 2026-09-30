import { describe, it, expect } from 'vitest';
import { salesCardToPlainText } from './salesSerializer';
import type { CartCard, CatalogCard, HandoffCard, ProductsCard, RepliesCard, SpecCard } from '../types';
import productsFx from './__fixtures__/sales-cards/products.json';
import cartFx from './__fixtures__/sales-cards/cart.json';
import repliesFx from './__fixtures__/sales-cards/replies.json';
import handoffFx from './__fixtures__/sales-cards/handoff.json';
import catalogFx from './__fixtures__/sales-cards/catalog.json';
import specFx from './__fixtures__/sales-cards/spec.json';

describe('salesCardToPlainText', () => {
  it('products: título + "- label" por ítem (sin reason ni precios)', () => {
    expect(salesCardToPlainText(productsFx as ProductsCard)).toBe(
      'Opciones para exterior\n- Reflector LED 50W IP65 luz fría\n- Reflector LED 100W IP66',
    );
  });

  it('products sin título: solo las líneas', () => {
    expect(salesCardToPlainText({ type: 'products', items: [{ id: '1', label: 'A' }] })).toBe('- A');
  });

  it('cart: título + "- qty× label"', () => {
    expect(salesCardToPlainText(cartFx as CartCard)).toBe(
      'Su pedido\n- 20× Dicroica LED GU10 7W cálida\n- 5× Transformador electrónico 12V 60W',
    );
  });

  it('replies: una opción por línea', () => {
    expect(salesCardToPlainText(repliesFx as RepliesCard)).toBe('Para interior\nPara exterior\nNo estoy seguro');
  });

  it('handoff: el resumen', () => {
    expect(salesCardToPlainText(handoffFx as HandoffCard)).toBe(
      'Consulta por precio mayorista para 200 dicroicas GU10.',
    );
  });

  it('catalog: el resumen de los filtros (sin ids)', () => {
    expect(salesCardToPlainText(catalogFx as CatalogCard)).toBe('Reflectores · Luz cálida · Apto exterior');
  });

  it('spec: solo el label (sin reason ni precios)', () => {
    expect(salesCardToPlainText(specFx as SpecCard)).toBe('Reflector LED 50W cálido');
  });
});
