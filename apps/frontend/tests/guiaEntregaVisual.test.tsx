import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuiaEntregaVisual } from '../src/apps/app_docente/GuiaEntregaVisual';

describe('GuiaEntregaVisual', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('usa iconos decorativos, ejemplos explícitos y conserva la ayuda al ocultar/mostrar', () => {
    localStorage.setItem('ep.guia.entrega.oculta', 'false');
    const { container } = render(<GuiaEntregaVisual />);

    expect(screen.getByRole('region', { name: 'Ayuda: Registro y recepción de exámenes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preparar revisión OMR' })).toBeInTheDocument();
    expect(screen.getByText(/lector QR o la acción manual de cada folio/i)).toBeInTheDocument();
    expect(screen.getByText('Folio de ejemplo: 84920')).toBeInTheDocument();
    expect(screen.getByText('Siguiente paso: lectura OMR')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.icono-lucide[aria-hidden="true"]')).toHaveLength(5);

    const cerrar = screen.getByRole('button', { name: 'Ocultar guía rápida de recepción de exámenes' });
    expect(cerrar).toHaveAttribute('aria-expanded', 'true');
    expect(cerrar).toHaveAttribute('aria-controls', expect.stringMatching(/^guia-entrega-/));
    fireEvent.click(cerrar);

    const abrir = screen.getByRole('button', { name: /Ver guía rápida de recepción de exámenes/i });
    expect(abrir).toBeInTheDocument();
    expect(abrir).toHaveAccessibleName(/Ver guía rápida de recepción de exámenes/i);
    expect(container.textContent).not.toMatch(/[💡✕✓]/u);

    fireEvent.click(abrir);
    expect(screen.getByRole('region', { name: 'Ayuda: Registro y recepción de exámenes' })).toBeInTheDocument();
  });

  it('inicia plegada en móvil y mantiene un disclosure accesible con preferencia persistente', () => {
    const descriptorMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });

    try {
      render(<GuiaEntregaVisual />);

      const mostrar = screen.getByRole('button', { name: 'Ver guía rápida de recepción de exámenes' });
      expect(mostrar).toHaveAttribute('aria-expanded', 'false');
      const contenidoId = mostrar.getAttribute('aria-controls');
      expect(contenidoId).toMatch(/^guia-entrega-/);
      expect(document.getElementById(contenidoId!)).toHaveAttribute('hidden');

      mostrar.focus();
      fireEvent.click(mostrar);
      expect(mostrar).toHaveFocus();
      expect(mostrar).toHaveAttribute('aria-expanded', 'true');
      expect(localStorage.getItem('ep.guia.entrega.oculta')).toBe('false');
      expect(screen.getByRole('region', { name: 'Ayuda: Registro y recepción de exámenes' })).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Ocultar guía rápida de recepción de exámenes' }));
      expect(screen.getByRole('button', { name: 'Ver guía rápida de recepción de exámenes' })).toHaveAttribute('aria-expanded', 'false');
      expect(localStorage.getItem('ep.guia.entrega.oculta')).toBe('true');
    } finally {
      if (descriptorMatchMedia) Object.defineProperty(window, 'matchMedia', descriptorMatchMedia);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
