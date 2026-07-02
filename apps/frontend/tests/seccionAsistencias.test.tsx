import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAsistencias } from '../src/apps/app_docente/SeccionAsistencias';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionAsistencias (Resiliencia)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maneja fallos de red al cargar el resumen de asistencias sin colapsar', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('DB Timeout Connection'));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar={true}
      />
    );

    // Seleccionamos un periodo para gatillar la carga
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'per-1' }
    });

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    // La UI no debe crashear, debe mantener el título principal visible
    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });

  it('maneja fallos al guardar un pase de lista (DB offline)', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Network Error'));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
        puedeGestionar={true}
      />
    );

    // Cambiar el periodo para que se muestre el formulario de "Nueva sesión"
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.change(comboboxes[0], {
      target: { value: 'per-1' }
    });

    // Esperar a que renderice "Crear e iniciar"
    await screen.findByRole('button', { name: /Crear e iniciar/i });

    // Cambiar el grupo en el select de la sesión nueva
    const selects = screen.getAllByRole('combobox');
    if (selects.length > 1) {
      fireEvent.change(selects[1], { target: { value: 'A' } });
    }

    // Guardar (Crear sesión)
    fireEvent.click(screen.getByRole('button', { name: /Crear e iniciar/i }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });
});
