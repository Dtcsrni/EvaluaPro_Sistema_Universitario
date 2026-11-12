import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuiaCalificacionesVisual } from '../src/apps/app_docente/GuiaCalificacionesVisual';

describe('GuiaCalificacionesVisual', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function simularViewport(movil: boolean) {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: movil }));
  }

  it('inicia plegada en móvil y permite abrir/cerrar la guía conservando el foco', () => {
    simularViewport(true);
    render(<GuiaCalificacionesVisual />);

    const mostrar = screen.getByRole('button', { name: 'Ver guía rápida de calificaciones' });
    expect(mostrar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Captura, revisión y calificación/i })).not.toBeInTheDocument();
    expect(screen.getByText(/GUÍA RÁPIDA · Captura y revisión de calificaciones/i)).not.toBeVisible();

    mostrar.focus();
    fireEvent.click(mostrar);
    const ocultar = screen.getByRole('button', { name: 'Ocultar guía rápida' });
    expect(ocultar).toHaveAttribute('aria-expanded', 'true');
    expect(ocultar).toHaveFocus();

    expect(screen.getByRole('region', { name: /Captura, revisión y calificación/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leer exámenes' })).toBeInTheDocument();
    expect(screen.getByText(/Carga imágenes de exámenes individuales o en lote/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revisar respuestas dudosas' })).toBeInTheDocument();
    expect(screen.getByText(/0, Supr o Retroceso/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calificar y exportar resultados' })).toBeInTheDocument();

    const textoGuia = document.body.textContent ?? '';
    ['💡', '✕', '98%', 'Instantánea', 'Acta Oficial'].forEach((elementoRemovido) => {
      expect(textoGuia).not.toContain(elementoRemovido);
    });

    fireEvent.click(ocultar);
    const mostrarDeNuevo = screen.getByRole('button', { name: 'Ver guía rápida de calificaciones' });
    expect(mostrarDeNuevo).toHaveAttribute('aria-expanded', 'false');
    expect(mostrarDeNuevo).toHaveFocus();
    expect(localStorage.getItem('ep.guia.calificaciones.oculta')).toBe('true');
  });

  it('mantiene abierta la guía por preferencia explícita en móvil y por defecto en escritorio', () => {
    simularViewport(true);
    localStorage.setItem('ep.guia.calificaciones.oculta', 'false');
    const { unmount } = render(<GuiaCalificacionesVisual />);
    expect(screen.getByRole('region', { name: /Captura, revisión y calificación/i })).toBeInTheDocument();
    unmount();

    localStorage.clear();
    simularViewport(false);
    render(<GuiaCalificacionesVisual />);
    expect(screen.getByRole('region', { name: /Captura, revisión y calificación/i })).toBeInTheDocument();
  });
});
