import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuiaCalificacionesVisual } from '../src/apps/app_docente/GuiaCalificacionesVisual';

vi.mock('../src/ui/ux/componentes/Boton', () => ({ Boton: 'button' }));

describe('GuiaCalificacionesVisual', () => {
  beforeEach(() => localStorage.clear());

  it('muestra la escala OMR de 0 a 5 y la condición del bono con tope 5', () => {
    render(<GuiaCalificacionesVisual />);

    expect(screen.getByText('Análisis OMR local')).toBeInTheDocument();
    expect(screen.getByText('Abstiene ante dudas')).toBeInTheDocument();
    expect(screen.queryByText(/98%/)).not.toBeInTheDocument();
    expect(screen.getByText(/Calcula el examen sobre 5 puntos/i)).toBeInTheDocument();
    expect(screen.getByText('Escala 0–5 · Máximo 5')).toBeInTheDocument();
    expect(screen.getByText('Bono OCR +0.25 · Tope 5')).toBeInTheDocument();
    expect(screen.queryByText('Escala 0–10')).not.toBeInTheDocument();
  });
});
