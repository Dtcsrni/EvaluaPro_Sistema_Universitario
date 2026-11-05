import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GuiaAsistenciasVisual } from '../src/apps/app_docente/GuiaAsistenciasVisual';

describe('GuiaAsistenciasVisual', () => {
  afterEach(() => localStorage.removeItem('ep.guia.asistencias.oculta'));

  it('explica los cuatro estados y usa iconografía compartida sin pictogramas', () => {
    localStorage.setItem('ep.guia.asistencias.oculta', 'true');
    const { container } = render(<GuiaAsistenciasVisual />);

    const botonGuia = screen.getByRole('button', { name: 'Ver guía rápida de asistencias' });
    expect(botonGuia).toHaveAttribute('aria-expanded', 'false');
    expect(botonGuia).toHaveAttribute('aria-controls', 'guia-asistencias-panel');
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    fireEvent.click(botonGuia);

    expect(screen.getByRole('button', { name: 'Ocultar guía rápida de asistencias' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Ocultar guía rápida de asistencias' })).toHaveAttribute('aria-controls', 'guia-asistencias-panel');
    expect(screen.getByRole('region', { name: 'Ayuda: Control de asistencias y pase de lista' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marca la asistencia' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revisa el derecho a examen' })).toBeInTheDocument();
    expect(container.querySelector('.guia-step-card--emerald p')?.textContent).toMatch(/Todos presentes marca a toda la lista como presente/i);
    expect(screen.getByText('Justificado')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Fast-Check|Semáforo/i);
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.querySelector('.guia-materia-card svg:not(.icono-lucide)')).toBeNull();
  });
});
