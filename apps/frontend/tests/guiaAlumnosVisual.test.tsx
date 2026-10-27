import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GuiaAlumnosVisual } from '../src/apps/app_docente/GuiaAlumnosVisual';

describe('GuiaAlumnosVisual', () => {
  beforeEach(() => {
    localStorage.removeItem('ep.guia.alumnos.oculta');
  });

  it('inicia plegada y permite consultar la guía cuando se necesita', () => {
    render(<GuiaAlumnosVisual />);

    const mostrar = screen.getByRole('button', { name: /Ver guía rápida de gestión de alumnos/i });
    expect(mostrar.textContent).not.toContain('💡');
    expect(mostrar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Guía rápida de gestión de alumnos' })).not.toBeInTheDocument();

    fireEvent.click(mostrar);
    expect(screen.getByRole('region', { name: 'Guía rápida de gestión de alumnos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar guía rápida' })).toHaveAttribute('aria-expanded', 'true');
  });
});
