import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';
import { budgetCardToPlainText } from './budgetSerializer';
import type { BudgetCard } from '../types';

const budget: BudgetCard = {
  type: 'budget',
  title: 'Presupuesto #1042',
  subtitle: 'Central Led · vence 15/07',
  lines: [{ label: 'Panel LED 60x60 40W', qty: 50, unitPrice: 17575, subtotal: 878750 }],
  actions: [
    { label: 'Descargar PDF', url: 'https://x/p.pdf', icon: 'download', download: true },
    { label: 'Pedir por WhatsApp', url: 'https://wa.me/549110000?text=hola', style: 'whatsapp', icon: 'whatsapp' },
  ],
};

describe('Card (budget)', () => {
  it('renders title, subtitle and line — sin Total con un solo producto', () => {
    render(<Card card={budget} />);
    expect(screen.getByText('Presupuesto #1042')).toBeInTheDocument();
    expect(screen.getByText('Central Led · vence 15/07')).toBeInTheDocument();
    expect(screen.getByText(/Panel LED 60x60 40W/)).toBeInTheDocument();
    expect(screen.queryByText('Total')).toBeNull();
  });

  it('muestra Total cuando hay más de un producto', () => {
    const multi: BudgetCard = {
      ...budget,
      lines: [
        { label: 'Panel LED 60x60 40W', qty: 2, unitPrice: 100, subtotal: 200 },
        { label: 'Reflector 50W', qty: 1, unitPrice: 300, subtotal: 300 },
      ],
    };
    render(<Card card={multi} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('renders actions as links opening a new tab safely', () => {
    render(<Card card={budget} />);
    const pdf = screen.getByRole('link', { name: 'Descargar PDF' });
    expect(pdf).toHaveAttribute('href', 'https://x/p.pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(pdf).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pdf).toHaveAttribute('download');

    const wa = screen.getByRole('link', { name: 'Pedir por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    expect(wa.className).toContain('aichat-action-whatsapp');
    expect(wa).not.toHaveAttribute('download');
  });

  it('drops actions with unsafe url schemes (javascript:)', () => {
    const malicious: BudgetCard = {
      type: 'budget',
      title: 'x',
      lines: [],
      actions: [
        { label: 'Safe', url: 'https://ok.test/' },
        { label: 'Evil', url: 'javascript:alert(1)' },
      ],
    };
    render(<Card card={malicious} />);
    expect(screen.getByRole('link', { name: 'Safe' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Evil' })).toBeNull();
  });
});

const cardA: BudgetCard = {
  type: 'budget',
  title: 'Opción A – Reflector LED 50W',
  subtitle: 'Luz fría',
  lines: [{ label: 'Reflector 50W', qty: 5, unitPrice: 9800, subtotal: 49000 }],
  actions: [
    { kind: 'copy', label: 'Copiar', icon: 'chat' },
    { kind: 'send', label: 'Enviar al canal', icon: 'external' },
  ],
};

const cardB: BudgetCard = {
  ...cardA,
  title: 'Opción B – Reflector LED 100W',
  lines: [{ label: 'Reflector 100W', qty: 2, unitPrice: 15000, subtotal: 30000 }],
};

describe('Card (budget) copy/send actions', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders Enviar al canal as button (not link) y oculta Copiar por redundante', () => {
    render(<Card card={cardA} onSendToChannel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Enviar al canal/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enviar al canal/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Copiar/ })).toBeNull();
  });

  it('Enviar al canal calls onSendToChannel once with this card serialized text', async () => {
    const onSend = vi.fn();
    render(<Card card={cardA} onSendToChannel={onSend} />);
    await userEvent.click(screen.getByRole('button', { name: /Enviar al canal/ }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(budgetCardToPlainText(cardA));
  });

  it('Copiar (sin send disponible) writes this card serialized text to clipboard y muestra Copiado', async () => {
    render(<Card card={cardA} copiedLabel="Copiado" />);
    await userEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      budgetCardToPlainText(cardA),
    );
    expect(await screen.findByRole('button', { name: /Copiado/ })).toBeInTheDocument();
  });

  it('is independent per card: sending A does not include B and vice versa', async () => {
    const onSend = vi.fn();
    render(
      <>
        <Card card={cardA} onSendToChannel={onSend} />
        <Card card={cardB} onSendToChannel={onSend} />
      </>,
    );
    const sendButtons = screen.getAllByRole('button', { name: /Enviar al canal/ });
    await userEvent.click(sendButtons[0]);
    expect(onSend).toHaveBeenLastCalledWith(budgetCardToPlainText(cardA));
    expect(onSend.mock.lastCall?.[0]).not.toContain('Opción B');

    await userEvent.click(sendButtons[1]);
    expect(onSend).toHaveBeenLastCalledWith(budgetCardToPlainText(cardB));
    expect(onSend.mock.lastCall?.[0]).not.toContain('Opción A');
  });

  it('degrades gracefully when onSendToChannel is absent (send hidden, copy works)', async () => {
    render(<Card card={cardA} copiedLabel="Copiado" />);
    expect(screen.queryByRole('button', { name: /Enviar al canal/ })).toBeNull();
    const copy = screen.getByRole('button', { name: /Copiar/ });
    await userEvent.click(copy);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      budgetCardToPlainText(cardA),
    );
  });

  it('keeps link actions rendering as <a> with safeHref (no regression)', () => {
    const withLink: BudgetCard = {
      ...cardA,
      actions: [
        { label: 'Descargar PDF', url: 'https://x/p.pdf', icon: 'download', download: true },
        { kind: 'copy', label: 'Copiar' },
      ],
    };
    render(<Card card={withLink} onSendToChannel={vi.fn()} />);
    const pdf = screen.getByRole('link', { name: 'Descargar PDF' });
    expect(pdf).toHaveAttribute('href', 'https://x/p.pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: /Copiar/ })).toBeInTheDocument();
  });
});
