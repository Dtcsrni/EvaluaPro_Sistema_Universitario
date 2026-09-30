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
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';

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


it('expira un código local solo después de confirmación y conserva aviso de sincronización', async () => {
  const codigo = { id: 'code-1', periodoId: 'per-1', expiraEn: '2026-12-31T00:00:00.000Z', usado: false };
  const mockListar = vi.fn()
    .mockResolvedValueOnce({ codigosAcceso: [{ ...codigo, estado: 'vigente' }] })
    .mockResolvedValueOnce({ codigosAcceso: [{ ...codigo, estado: 'expirado' }] });
  const mockExpirar = vi.fn().mockResolvedValue({ codigoAccesoId: 'code-1', expirado: true });
  render(
    <ConfirmDialogProvider>
      <SeccionPublicar
        periodos={[{ _id: 'per-1', nombre: 'Física Cuántica', activo: true }]}
        onPublicar={vi.fn().mockResolvedValue({})}
        onCodigo={vi.fn().mockResolvedValue({ codigoAccesoId: 'code-1', codigo: 'ABC123', expiraEn: '2026-12-31T00:00:00.000Z' })}
        onListarCodigos={mockListar}
        onExpirarCodigo={mockExpirar}
      />
    </ConfirmDialogProvider>
  );
  fireEvent.change(screen.getByLabelText(/^Materia$/i), { target: { value: 'per-1' } });
  fireEvent.click(screen.getByRole('button', { name: /Consultar códigos/i }));
  expect(await screen.findByText('vigente')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Expirar localmente/i }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(/publicar los resultados por separado/i);
  fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
  expect(mockExpirar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Expirar localmente/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Expirar código$/i }));
  await waitFor(() => expect(mockExpirar).toHaveBeenCalledWith('code-1'));
  expect(await screen.findByText(/publica los resultados para sincronizar/i)).toBeInTheDocument();
  expect(await screen.findByText('expirado')).toBeInTheDocument();
  expect(mockListar).toHaveBeenCalledTimes(2);
});
