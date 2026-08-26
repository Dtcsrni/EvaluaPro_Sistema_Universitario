import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SeccionClassroom } from '../src/apps/app_docente/SeccionClassroom';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Periodo } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    actualizar: vi.fn(),
    baseApi: 'http://localhost:4000/api'
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true)
  })
}));

const periodosMock: Periodo[] = [
  { _id: 'per-1', nombre: 'Ingeniería de Software', activo: true },
  { _id: 'per-2', nombre: 'Bases de Datos', activo: true }
];

describe('SeccionClassroom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ cursos: [], estado: { conectado: false } });
  });

  it('renderiza la sección y carga el estado de Classroom', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      estado: {
        conectado: true,
        correoGoogle: 'docente@cuh.mx',
        googleUserId: 'g-123',
        ultimaSincronizacionEn: '2026-08-26T00:00:00.000Z'
      }
    });

    render(
      <SeccionClassroom
        periodos={periodosMock}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    expect(screen.getByRole('heading', { name: /classroom/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/v2/classroom/estado');
    });
  });

  it('permite iniciar el flujo de conexión OAuth', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        return Promise.resolve({
          estado: { conectado: false }
        });
      }
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') {
        return Promise.resolve({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123'
        });
      }
      return Promise.resolve({});
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <SeccionClassroom
        periodos={periodosMock}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    const botonConectar = screen.getByRole('button', { name: /conectar google/i });
    fireEvent.click(botonConectar);

    await waitFor(() => {
      expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/v2/classroom/oauth/iniciar');
      expect(openSpy).toHaveBeenCalled();
    });
  });

  it('permite desconectar la cuenta de Google', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      estado: {
        conectado: true,
        correoGoogle: 'docente@cuh.mx'
      }
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ ok: true });

    render(
      <SeccionClassroom
        periodos={periodosMock}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /desconectar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /desconectar/i }));

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/classroom/oauth/desconectar', {});
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'ok', title: 'Classroom', message: 'Cuenta Classroom desconectada' })
      );
    });
  });
});
