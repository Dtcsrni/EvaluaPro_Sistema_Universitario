import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { CentroClassroom } from '../src/apps/app_docente/CentroClassroom';
import { emitToast } from '../src/ui/toast/toastBus';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
const actualizarMock = vi.fn();

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    baseApi: 'http://localhost:4000/api',
    obtener: (...args: unknown[]) => obtenerMock(...args),
    enviar: (...args: unknown[]) => enviarMock(...args),
    actualizar: (...args: unknown[]) => actualizarMock(...args)
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('CentroClassroom behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const openMock = vi.fn();
    vi.stubGlobal('open', openMock);
    Object.defineProperty(window, 'open', { value: openMock, writable: true });
  });

  it('muestra estado no disponible cuando el backend classroom esta deshabilitado', () => {
    render(
      <CentroClassroom
        periodoId="per-1"
        puedeClassroomConectar
        puedeClassroomPull
        classroomDisponible={false}
      />
    );

    expect(screen.getByText(/Google Classroom no está disponible en este entorno/i)).toBeInTheDocument();
  });

  it('muestra mensaje amigable cuando Classroom no esta configurado en backend', async () => {
    obtenerMock.mockRejectedValueOnce(
      new ErrorRemoto('API no disponible', { status: 503, codigo: 'CLASSROOM_NO_CONFIG' })
    );

    render(
      <CentroClassroom
        periodoId="per-1"
        puedeClassroomConectar
        puedeClassroomPull
        classroomDisponible
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Google Classroom no esta configurado en el backend/i)).toBeInTheDocument();
    });
  });

  it('recorre el flujo UI de cursos, mapeo, preview, importacion y reconexion oauth', async () => {
    let historialLlamadas = 0;

    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        return {
          estado: {
            conectado: true,
            correoGoogle: 'docente@classroom.test',
            ultimaSincronizacionEn: '2026-03-22T10:00:00.000Z',
            ultimoError: null
          }
        };
      }
      if (ruta === '/evaluaciones/v2/classroom/cursos') {
        return {
          cursos: [{ id: 'course-1', name: 'Programacion', section: 'A' }]
        };
      }
      if (ruta.includes('/classroom/importaciones/historial')) {
        historialLlamadas += 1;
        return {
          historial:
            historialLlamadas > 1
              ? [{ _id: 'hist-1', tipo: 'ejecucion', ejecutadoEn: '2026-03-22T11:00:00.000Z', resumen: { submissionsProcesadas: 2 } }]
              : []
        };
      }
      if (ruta.includes('/classroom/cursos/course-1/actividades')) {
        return {
          actividades: [{ id: 'cw-1', title: 'Actividad 1', description: 'Descripcion 1', maxPoints: 100, mapeo: null }]
        };
      }
      if (ruta.includes('/classroom/cursos/course-1/alumnos')) {
        return {
          alumnosLocales: [
            { _id: 'alu-1', nombreCompleto: 'Alumno Uno', matricula: 'ALU001' },
            { _id: 'alu-2', nombreCompleto: 'Alumno Dos', matricula: 'ALU002' }
          ],
          alumnosClassroom: [
            {
              classroomUserId: 'user-1',
              fullName: 'Alumno Uno GC',
              emailAddress: 'uno@classroom.test',
              alumnoIdConfirmado: null,
              alumnoIdSugerido: 'alu-1',
              matchStrategy: 'email'
            }
          ]
        };
      }
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') {
        return { url: 'https://accounts.google.com/mock-oauth' };
      }
      return {};
    });

    actualizarMock.mockResolvedValue({
      alumnosLocales: [
        { _id: 'alu-1', nombreCompleto: 'Alumno Uno', matricula: 'ALU001' },
        { _id: 'alu-2', nombreCompleto: 'Alumno Dos', matricula: 'ALU002' }
      ],
      alumnosClassroom: [
        {
          classroomUserId: 'user-1',
          fullName: 'Alumno Uno GC',
          emailAddress: 'uno@classroom.test',
          alumnoIdConfirmado: 'alu-1',
          alumnoConfirmado: { _id: 'alu-1', nombreCompleto: 'Alumno Uno', matricula: 'ALU001' },
          alumnoIdSugerido: null,
          matchStrategy: 'manual'
        }
      ]
    });

    enviarMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/evaluaciones/v2/classroom/importaciones/preview') {
        return {
          tipo: 'preview',
          submissionsProcesadas: 2,
          matched: 1,
          pending: 1,
          graded: 1,
          unmatched: 1,
          actividades: [
            {
              courseId: 'course-1',
              courseName: 'Programacion',
              courseWorkId: 'cw-1',
              courseWorkTitle: 'Actividad 1',
              submissionsProcesadas: 2,
              wouldCreate: 1,
              wouldUpdate: 0,
              submissions: [
                { submissionId: 'sub-1', studentName: 'Alumno Uno GC', alumnoNombre: 'Alumno Uno', estadoCaptura: 'calificada', calificacionDecimal: 9 },
                { submissionId: 'sub-2', studentName: 'Alumno Sin Match', alumnoNombre: null, estadoCaptura: 'pendiente' }
              ],
              errors: []
            }
          ]
        };
      }
      if (ruta === '/evaluaciones/v2/classroom/importaciones/ejecutar') {
        return {
          tipo: 'ejecucion',
          submissionsProcesadas: 2,
          matched: 1,
          pending: 1,
          graded: 1,
          unmatched: 1,
          actividades: [
            {
              courseId: 'course-1',
              courseName: 'Programacion',
              courseWorkId: 'cw-1',
              courseWorkTitle: 'Actividad 1',
              submissionsProcesadas: 2,
              wouldCreate: 0,
              wouldUpdate: 1,
              submissions: [{ submissionId: 'sub-1', studentName: 'Alumno Uno GC', alumnoNombre: 'Alumno Uno', estadoCaptura: 'calificada', calificacionDecimal: 9 }],
              errors: []
            }
          ]
        };
      }
      if (ruta === '/evaluaciones/v2/classroom/oauth/desconectar') {
        return undefined;
      }
      return {};
    });

    render(
      <CentroClassroom
        periodoId="per-1"
        puedeClassroomConectar
        puedeClassroomPull
        classroomDisponible
      />
    );

    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/estado'));
    await waitFor(() => expect(screen.getByText(/docente@classroom.test/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('option', { name: /Programacion \(A\)/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Reconectar Google/i }));
    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        'https://accounts.google.com/mock-oauth',
        'oauth_classroom',
        'width=980,height=760'
      )
    );

    fireEvent.change(screen.getByLabelText(/Curso/i), { target: { value: 'course-1' } });

    await waitFor(() => expect(screen.getByText(/Actividad 1/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Alumno Uno GC/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar mapeo/i }));

    await waitFor(() => expect(actualizarMock).toHaveBeenCalledTimes(1));
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Classroom', message: 'Mapeo de alumnos guardado' }));

    fireEvent.click(screen.getByRole('button', { name: /Preview importación/i }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/importaciones/preview', expect.anything()));
    await waitFor(() => expect(screen.getByText(/Procesadas: 2 \| Matched: 1/i)).toBeInTheDocument());
    expect(screen.getByText(/Alumno Uno GC -> Alumno Uno/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ejecutar importación/i }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/importaciones/ejecutar', expect.anything()));
    await waitFor(() => expect(screen.getByText(/Resultado de importación/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/ejecucion/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Desconectar/i }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/oauth/desconectar', {}));
  });
});
