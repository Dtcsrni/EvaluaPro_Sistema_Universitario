/**
 * seccionClassroom.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  useConfirmDialog: () => vi.fn().mockResolvedValue(true)
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

  it('carga y renderiza estudiantes de Classroom incluso sin materia local seleccionada', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        return Promise.resolve({
          estado: { conectado: true, correoGoogle: 'erick.vega@cuh.mx' }
        });
      }
      if (ruta === '/evaluaciones/v2/classroom/cursos') {
        return Promise.resolve({
          cursos: [{ id: 'curso-101', name: 'Inteligencia de Negocios', section: 'ISC' }]
        });
      }
      if (ruta.includes('/classroom/cursos/curso-101/alumnos')) {
        return Promise.resolve({
          alumnosLocales: [],
          alumnosClassroom: [
            {
              classroomUserId: 'usr-1',
              fullName: 'Juan Pérez López',
              emailAddress: 'cuh512410168@cuh.mx'
            },
            {
              classroomUserId: 'usr-2',
              fullName: 'María González',
              emailAddress: 'cuh512410199@cuh.mx'
            }
          ]
        });
      }
      return Promise.resolve({});
    });

    render(
      <SeccionClassroom
        periodos={[]}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Juan Pérez López/i)).toBeInTheDocument();
      expect(screen.getByText(/María González/i)).toBeInTheDocument();
    });
  });

  it('conserva la materia local seleccionada al elegir otro curso de Google', async () => {
    const cursos = [
      { id: 'curso-bi', name: 'Inteligencia de Negocios' },
      { id: 'curso-web', name: 'Desarrollo Web' }
    ];
    const periodos = [
      { _id: 'periodo-web', nombre: 'Desarrollo Web', activo: true },
      { _id: 'periodo-bi', nombre: 'Inteligencia de Negocios', activo: true }
    ];
    let solicitudesCursos = 0;
    let resolverRecargaCursos: ((valor: { cursos: typeof cursos }) => void) | undefined;
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        return Promise.resolve({ estado: { conectado: true } });
      }
      if (ruta === '/evaluaciones/v2/classroom/cursos') {
        solicitudesCursos += 1;
        return solicitudesCursos === 1
          ? Promise.resolve({ cursos })
          : new Promise((resolve) => { resolverRecargaCursos = resolve; });
      }
      if (ruta.includes('/actividades')) return Promise.resolve({ actividades: [] });
      if (ruta.includes('/alumnos')) return Promise.resolve({ alumnosLocales: [], alumnosClassroom: [] });
      if (ruta.includes('/historial')) return Promise.resolve({ historial: [] });
      return Promise.resolve({});
    });

    render(
      <SeccionClassroom
        periodos={periodos}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    const materia = await screen.findByLabelText('Materia en EvaluaPro');
    const cursoGoogle = await screen.findByLabelText('Curso en Google Classroom');
    await waitFor(() => expect(cursoGoogle).toBeEnabled());
    expect(vi.mocked(clienteApi.obtener).mock.calls.filter(([ruta]) => ruta === '/evaluaciones/v2/classroom/cursos'))
      .toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /recargar cursos de Classroom/i }));
    await waitFor(() => expect(solicitudesCursos).toBe(2));
    expect(cursoGoogle).toBeEnabled();
    await act(async () => resolverRecargaCursos?.({ cursos }));

    fireEvent.change(materia, { target: { value: 'periodo-web' } });
    fireEvent.change(cursoGoogle, { target: { value: 'curso-bi' } });

    await waitFor(() => {
      expect(materia).toHaveValue('periodo-web');
      expect(clienteApi.obtener).toHaveBeenCalledWith(
        '/evaluaciones/v2/classroom/cursos/curso-bi/alumnos?periodoId=periodo-web'
      );
    });
  });

  it('ignora respuestas de roster tardías de un curso que ya no está seleccionado', async () => {
    let resolverRosterWeb: ((valor: { alumnosLocales: []; alumnosClassroom: Array<{ classroomUserId: string; fullName: string }> }) => void) | undefined;
    const rosterWebPendiente = new Promise<{ alumnosLocales: []; alumnosClassroom: Array<{ classroomUserId: string; fullName: string }> }>(
      (resolve) => { resolverRosterWeb = resolve; }
    );
    const cursos = [
      { id: 'curso-bi', name: 'Inteligencia de Negocios' },
      { id: 'curso-web', name: 'Desarrollo Web' }
    ];
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        return Promise.resolve({ estado: { conectado: true } });
      }
      if (ruta === '/evaluaciones/v2/classroom/cursos') return Promise.resolve({ cursos });
      if (ruta.includes('/actividades')) return Promise.resolve({ actividades: [] });
      if (ruta.includes('/classroom/cursos/curso-web/alumnos')) return rosterWebPendiente;
      if (ruta.includes('/classroom/cursos/curso-bi/alumnos')) {
        return Promise.resolve({
          alumnosLocales: [],
          alumnosClassroom: [{ classroomUserId: 'alumno-bi', fullName: 'Alumno BI' }]
        });
      }
      if (ruta.includes('/historial')) return Promise.resolve({ historial: [] });
      return Promise.resolve({});
    });

    render(
      <SeccionClassroom
        periodos={[{ _id: 'periodo-local', nombre: 'Materia local', activo: true }]}
        puedeClassroomConectar={true}
        puedeClassroomPull={true}
        classroomDisponible={true}
      />
    );

    const cursoGoogle = await screen.findByLabelText('Curso en Google Classroom');
    await waitFor(() => expect(cursoGoogle).toBeEnabled());
    fireEvent.change(cursoGoogle, { target: { value: 'curso-bi' } });
    fireEvent.change(cursoGoogle, { target: { value: 'curso-web' } });
    await waitFor(() => {
      expect(clienteApi.obtener).toHaveBeenCalledWith(
        '/evaluaciones/v2/classroom/cursos/curso-web/alumnos?periodoId=periodo-local'
      );
    });
    fireEvent.change(cursoGoogle, { target: { value: 'curso-bi' } });
    await screen.findByText('Alumno BI');

    await act(async () => {
      resolverRosterWeb?.({
        alumnosLocales: [],
        alumnosClassroom: [{ classroomUserId: 'alumno-web', fullName: 'Alumno Web' }]
      });
    });

    expect(screen.getByText('Alumno BI')).toBeInTheDocument();
    expect(screen.queryByText('Alumno Web')).not.toBeInTheDocument();
  });
});
