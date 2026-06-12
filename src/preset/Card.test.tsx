import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import type { BudgetCard } from '../types';

const budget: BudgetCard = {
  type: 'budget',
  title: 'Presupuesto #1042',
  subtitle: 'Central Led · vence 15/07',
  lines: [{ label: 'Panel LED 60x60 40W', qty: 50, amount: '$878.750' }],
  total: { label: 'Total', amount: '$878.750' },
  actions: [
    { label: 'Descargar PDF', url: 'https://x/p.pdf', icon: 'download', download: true },
    { label: 'Pedir por WhatsApp', url: 'https://wa.me/549110000?text=hola', style: 'whatsapp', icon: 'whatsapp' },
  ],
};

describe('Card (budget)', () => {
  it('renders title, subtitle, line and total label', () => {
    render(<Card card={budget} />);
    expect(screen.getByText('Presupuesto #1042')).toBeInTheDocument();
    expect(screen.getByText('Central Led · vence 15/07')).toBeInTheDocument();
    expect(screen.getByText(/Panel LED 60x60 40W/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
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
});
