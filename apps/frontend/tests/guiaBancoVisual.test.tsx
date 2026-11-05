import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GuiaBancoVisual } from '../src/apps/app_docente/GuiaBancoVisual';

describe('GuiaBancoVisual', () => {
  afterEach(() => localStorage.removeItem('ep.guia.banco.oculta'));

  it('describe los tres pasos reales, la estimación y usa iconografía compartida', () => {
    localStorage.setItem('ep.guia.banco.oculta', 'true');
    const { container } = render(<GuiaBancoVisual />);

    const controlGuia = screen.getByRole('button', { name: 'Ver guía rápida de Banco de reactivos' });
    expect(controlGuia).toHaveAttribute('aria-expanded', 'false');
    expect(controlGuia).toHaveAttribute('aria-controls', 'guia-banco-panel');
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    fireEvent.click(controlGuia);

    expect(screen.getByRole('button', { name: 'Ocultar guía rápida de Banco de reactivos' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Ayuda: Banco de preguntas y estimación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimación de páginas' })).toBeInTheDocument();
    expect(screen.getByText(/estimación para el formato Carta con plantilla OMR/i)).toBeInTheDocument();
    expect(screen.getByText(/confirma la paginación en la vista previa del examen/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Paginación Real|motor tipográfico|en tiempo real/i);
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.querySelector('.guia-materia-card svg:not(.icono-lucide)')).toBeNull();
  });
});
