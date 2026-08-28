/**
 * seccionPublicar.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionPublicar } from '../src/apps/app_docente/SeccionPublicar';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Periodo } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionPublicar', () => {
  const periodosMock: Periodo[] = [
    { _id: 'per-1', nombre: 'Física Cuántica', activo: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la sección y mantiene los botones bloqueados si no hay materia seleccionada', () => {
    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={vi.fn()}
        onCodigo={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Publicar en portal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Publicar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Generar codigo$/i })).toBeDisabled();
  });

  it('permite publicar resultados hacia el portal alumno tras seleccionar una materia', async () => {
    const mockPublicar = vi.fn().mockResolvedValue({});

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonPublicar = screen.getByRole('button', { name: /^Publicar$/i });
    expect(botonPublicar).not.toBeDisabled();

    fireEvent.click(botonPublicar);

    await waitFor(() => {
      expect(mockPublicar).toHaveBeenCalledWith('per-1');
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Publicacion' })
    );
  });

  it('permite generar un código de acceso temporal para el portal alumno', async () => {
    const mockPublicar = vi.fn().mockResolvedValue({});
    const mockCodigo = vi.fn().mockResolvedValue({
      codigo: 'CUH-EXP-8899',
      expiraEn: '2026-08-30T12:00:00.000Z'
    });

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={mockCodigo}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonCodigo = screen.getByRole('button', { name: /^Generar codigo$/i });
    fireEvent.click(botonCodigo);

    await waitFor(() => {
      expect(mockCodigo).toHaveBeenCalledWith('per-1');
      expect(mockPublicar).toHaveBeenCalledWith('per-1');
    });

    expect(screen.getByText(/Código generado: CUH-EXP-8899/i)).toBeInTheDocument();
    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Codigo' })
    );
  });

  it('muestra mensaje de error cuando falla la publicación', async () => {
    const mockPublicar = vi.fn().mockRejectedValue(new Error('Fallo de conexión al portal'));

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonPublicar = screen.getByRole('button', { name: /^Publicar$/i });
    fireEvent.click(botonPublicar);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Fallo de conexión al portal/i);
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', title: 'No se pudo publicar' })
    );
  });
});
