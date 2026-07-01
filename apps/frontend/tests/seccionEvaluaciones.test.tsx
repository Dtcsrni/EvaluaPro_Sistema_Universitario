/**
 * seccionEvaluaciones.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionEvaluaciones } from '../src/apps/app_docente/SeccionEvaluaciones';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionEvaluaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta: string) => {
      if (String(ruta).startsWith('/evaluaciones/v2/contexto')) {
        return {
          politicas: [
            { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC' },
            { codigo: 'POLICY_SV_EXCEL_2026', version: 1, nombre: 'SV' }
          ],
          configuracion: { politicaCodigo: 'POLICY_LISC_ENCUADRE_2026', politicaVersion: 1 }
        };
      }
      if (String(ruta).startsWith('/evaluaciones/v2/classroom/mapeos')) {
        return { mapeos: [] };
      }
      return {};
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  it('renderiza y guarda configuración de política', async () => {
    render(
      <SeccionEvaluaciones
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar
        puedeClassroomConectar
        puedeClassroomPull
      />
    );

    expect(screen.getByRole('heading', { name: /Evaluaciones y políticas/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(clienteApi.obtener)).toHaveBeenCalledWith('/evaluaciones/v2/contexto?periodoId=per-1');
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar política/i }));

    await waitFor(() => {
      expect(vi.mocked(clienteApi.enviar)).toHaveBeenCalledWith(
        '/evaluaciones/v2/politica',
        expect.objectContaining({
          periodoId: 'per-1',
          politicaCodigo: 'POLICY_LISC_ENCUADRE_2026'
        })
      );
    });
  });

  it('maneja fallos de red (offline/500) de forma resiliente sin colapsar', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Network Error'));

    render(
      <SeccionEvaluaciones
        periodos={[{ _id: 'per-2', nombre: 'Periodo 2' }]}
        alumnos={[{ _id: 'alu-2', nombreCompleto: 'Alumno 2', matricula: 'A2', periodoId: 'per-2' }]}
        puedeGestionar
        puedeClassroomConectar
        puedeClassroomPull
      />
    );

    expect(screen.getByRole('heading', { name: /Evaluaciones y políticas/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar política/i }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    // La UI no debe crashear, debe mantener el botón visible
    expect(screen.getByRole('button', { name: /Guardar política/i })).toBeInTheDocument();
  });
});
