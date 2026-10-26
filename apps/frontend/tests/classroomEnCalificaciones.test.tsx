import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomEnCalificaciones } from '../src/apps/app_docente/ClassroomEnCalificaciones';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import type { Alumno, PermisosUI } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: vi.fn(), obtenerBinario: vi.fn(), enviar: vi.fn(), actualizar: vi.fn(), baseApi: 'http://localhost:4000/api' }
}));
vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({ useConfirmDialog: () => vi.fn().mockResolvedValue(true) }));

const permisos = { evaluaciones: { leer: true }, classroom: { pull: true } } as PermisosUI;
const alumnos: Alumno[] = [
  { _id: 'alumno-1', nombreCompleto: 'Ana Pérez', matricula: 'A-01', correo: 'ana@escuela.test', periodoId: 'per-1' },
  { _id: 'alumno-2', nombreCompleto: 'Luis Gómez', matricula: 'A-02', correo: 'luis@escuela.test', periodoId: 'per-1' }
];
const actividadClassroom = {
  id: 'evidencia-1', alumnoId: 'alumno-1', titulo: 'Entrega', fechaEvidencia: '2026-09-20T12:00:00.000Z',
  fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 9,
  metadata: { alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details' },
  classroom: { courseId: 'course-1', courseWorkId: 'work-1', submissionId: 'submission-1', courseWorkTitle: 'Actividad Classroom', assignedGrade: 90, draftGrade: 50, maxPoints: 100 }
};

describe('ClassroomEnCalificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [actividadClassroom, {
        ...actividadClassroom,
        id: 'evidencia-2', alumnoId: 'alumno-2', titulo: 'Práctica adicional', fechaEvidencia: '2026-09-21T12:00:00.000Z',
        metadata: null, classroom: { courseId: 'course-1', courseWorkTitle: 'Práctica adicional', assignedGrade: 70, maxPoints: 100 }
      }, { ...actividadClassroom, id: 'manual-1', fuente: 'manual' }], nextCursor: null };
      if (String(ruta).includes('/entregas/submission-1/historial')) return { eventos: [
        { id: 'evento-1', corte: 1, puntosObtenidos: 90, puntosPosibles: 100, calificacionSobre10: 9, estado: 'calificada', estadoClassroom: 'RETURNED', importacionId: 'importacion-1', observadoEn: '2026-10-14T12:00:00.000Z' }
      ], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [
        { classroomUserId: 'google-user-1', fullName: 'Ana Pérez', emailAddress: 'ana@classroom.test', alumnoIdConfirmado: 'alumno-1' },
        { classroomUserId: 'google-user-2', fullName: 'Luis Gómez', emailAddress: 'luis@classroom.test', alumnoIdConfirmado: 'alumno-2' }
      ] };
      if (String(ruta).includes('/importaciones/jobs/')) return {
        jobId: 'job-test', estado: 'succeeded', progreso: 1, total: 1,
        resultado: { totalActividades: 1, graded: 1, importadas: 1, actualizadas: 2 }
      };
      return {};
    });
  });

  it('permite filtrar por tema y revisar texto, fechas y materiales sin usar datos inferidos', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      if (String(ruta).includes('/actividades?')) return {
        completa: false,
        temas: [{ id: 'topic-2', name: 'Segundo Parcial' }, { id: 'topic-3', name: 'Tercer Parcial' }],
        errores: [{ recurso: 'temas', codigo: 'CLASSROOM_API_ERROR' }],
        actividades: [
          { id: 'work-1', title: 'Debate empresarial', description: 'Descripción completa para analizar.', topicId: 'topic-2', topicName: 'Segundo Parcial', state: 'DRAFT', workType: 'ASSIGNMENT', dueAtUtc: '2026-10-23T15:30:00.000Z', maxPoints: 20, materials: [{ tipo: 'Enlace', nombre: 'Lectura base', enlace: 'https://docs.google.com/document/d/abc' }], alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details' },
          { id: 'work-2', title: 'Actividad de otro tema', description: 'No corresponde al filtro.', topicId: 'topic-3', topicName: 'Tercer Parcial', state: 'PUBLISHED' }
        ]
      };
      return {};
    });

    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    expect(await screen.findByText('La consulta de actividades está incompleta. Se conservan los datos recibidos; revisa los recursos con error y vuelve a cargar.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por tema de Classroom'), { target: { value: 'topic-2' } });
    const resumen = await screen.findByText(/Debate empresarial/);
    fireEvent.click(resumen);

    expect(await screen.findByText('Descripción completa para analizar.')).toBeInTheDocument();
    expect(screen.getByText('Descripción completa para analizar.').closest('details')).toHaveTextContent(/Fecha de entrega:.*UTC/);
    expect(screen.getByRole('link', { name: 'Abrir material' })).toHaveAttribute('href', 'https://docs.google.com/document/d/abc');
    expect(within(screen.getByRole('region', { name: 'Revisar actividades por tema' })).queryByText('Actividad de otro tema')).not.toBeInTheDocument();
  });

  it('no presenta una consulta incompleta como si el curso no tuviera actividades', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      if (String(ruta).includes('/actividades?')) return {
        completa: false,
        temas: [],
        errores: [{ recurso: 'actividades', codigo: 'CLASSROOM_API_ERROR' }],
        actividades: []
      };
      return {};
    });

    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });

    expect(await screen.findByText('La consulta de actividades está incompleta. Se conservan los datos recibidos; revisa los recursos con error y vuelve a cargar.')).toBeInTheDocument();
    expect(screen.getByText('No hay actividades en el tema seleccionado.')).toBeInTheDocument();
    expect(screen.queryByText('No hay actividades publicadas para mapear en este curso.')).not.toBeInTheDocument();
  });

  it('filtra la materia, muestra solo evidencias Classroom y mantiene las notas como solo lectura', async () => {
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    expect(await screen.findByRole('cell', { name: 'Actividad Classroom' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '90 / 100' })).toBeInTheDocument();
    const enlaceActividad = screen.getByRole('link', { name: 'Abrir en Google Classroom: Actividad Classroom' });
    expect(enlaceActividad).toHaveAttribute('href', 'https://classroom.google.com/c/course-1/a/work-1/details');
    expect(enlaceActividad).toHaveAttribute('target', '_blank');
    expect(enlaceActividad).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('cell', { name: 'Entrega' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar|calificar|revisar/i })).not.toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/evidencias?periodoId=per-1&limite=400');
    expect(clienteApi.actualizar).not.toHaveBeenCalled();
    expect(clienteApi.enviar).not.toHaveBeenCalled();
  });

  it('permite consultar desde cada evidencia su historial de entrega paginado', async () => {
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver historial' }))[0]);
    expect(await screen.findByRole('region', { name: 'Historial de la entrega' })).toBeInTheDocument();
    expect(screen.getByText('Calificación sincronizada')).toBeInTheDocument();
    expect(screen.getByText('90 / 100 puntos')).toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledWith(expect.stringContaining('/alumnos/alumno-1/entregas/submission-1/historial?'));
  });

  it('muestra y cambia explícitamente la materia local destino desde Classroom', () => {
    const onPeriodoChange = vi.fn();
    render(<ClassroomEnCalificaciones
      periodoId="per-1"
      periodos={[{ _id: 'per-1', nombre: 'Desarrollo Web' }, { _id: 'per-2', nombre: 'Inteligencia de Negocios', activo: false }]}
      onPeriodoChange={onPeriodoChange}
      alumnos={alumnos}
      permisos={permisos}
    />);

    const destino = screen.getByLabelText('Materia local destino');
    expect(destino).toHaveValue('per-1');
    expect(within(destino).getByRole('option', { name: 'Inteligencia de Negocios (ID: per-2) (Archivada)' })).toBeInTheDocument();
    fireEvent.change(destino, { target: { value: 'per-2' } });
    expect(onPeriodoChange).toHaveBeenCalledWith('per-2');
  });

  it('deja la vinculación de estudiantes en Calificaciones y guarda solo relaciones del periodo', async () => {
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    const curso = await screen.findByLabelText('Curso de Classroom');
    fireEvent.change(curso, { target: { value: 'course-1' } });
    const selectoresAlumno = await screen.findAllByLabelText('Alumno en esta materia');
    expect(selectoresAlumno[0]).toHaveValue('alumno-1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar vinculaciones' }));
    await waitFor(() => expect(clienteApi.actualizar).toHaveBeenCalledWith(
      '/evaluaciones/v2/classroom/cursos/course-1/mapeo-alumnos',
      { periodoId: 'per-1', asignaciones: [
        { classroomUserId: 'google-user-1', alumnoId: 'alumno-1' },
        { classroomUserId: 'google-user-2', alumnoId: 'alumno-2' }
      ] }
    ));
  });

  it('filtra vinculaciones y evidencias con conteos visibles para grupos grandes', async () => {
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    const busquedaAlumnos = await screen.findByRole('searchbox', { name: 'Buscar estudiante vinculado' });
    fireEvent.change(busquedaAlumnos, { target: { value: 'ana@classroom.test' } });
    expect(screen.getByText('Mostrando 1 de 2 estudiantes')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Alumno en esta materia')).toHaveLength(1);

    const busquedaEvidencias = screen.getByRole('searchbox', { name: 'Buscar evidencias' });
    fireEvent.change(busquedaEvidencias, { target: { value: 'practica adicional' } });
    expect(screen.getByText('Mostrando 1 de 2 evidencias')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Práctica adicional' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Actividad Classroom' })).not.toBeInTheDocument();
  });

  it('mantiene las actividades y entregas en Google Classroom; aquí solo mapea y sincroniza datos existentes', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/importaciones/jobs/')) return {
        jobId: 'job-test', estado: 'succeeded', progreso: 1, total: 1,
        resultado: { totalActividades: 1, graded: 1, importadas: 1, actualizadas: 2 }
      };
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [actividadClassroom], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      if (String(ruta).includes('/actividades?')) return { actividades: [{ id: 'work-1', title: 'Actividad Classroom', state: 'PUBLISHED', maxPoints: 100 }] };
      return {};
    });
    const actividadPreview = (faltanteExplicito: boolean) => ({
      courseId: 'course-1', courseWorkId: 'work-1', courseWorkTitle: 'Actividad Classroom', submissions: [{
        submissionId: 'submission-missing', alumnoId: 'alumno-2', alumnoNombre: 'Luis Gómez', estadoClassroom: 'CREATED',
        vencida: true, puedeConfirmarFaltante: true, faltanteExplicito
      }]
    });
    const proyeccionAna = {
      alumnoId: 'alumno-1', alumnoNombre: 'Ana Pérez', puntosObtenidos: 90, puntosPosibles: 100,
      promedioSobre10: 9, continuaSobre5: 4.5, actividadesCalificadas: 1, actividadesFaltantesConfirmadas: 0
    };
    vi.mocked(clienteApi.enviar)
      .mockResolvedValueOnce({ planHash: 'a'.repeat(64), totalActividades: 1, graded: 1, wouldCreate: 1, wouldUpdate: 0, actividades: [actividadPreview(false)], promediosEvaluacionContinuaTercerParcial: [proyeccionAna] })
      .mockResolvedValueOnce({ planHash: 'a'.repeat(64), totalActividades: 1, graded: 1, wouldCreate: 1, wouldUpdate: 0, actividades: [actividadPreview(true)], promediosEvaluacionContinuaTercerParcial: [proyeccionAna, {
        alumnoId: 'alumno-2', alumnoNombre: 'Luis Gómez', puntosObtenidos: 0, puntosPosibles: 100,
        promedioSobre10: 0, continuaSobre5: 0, actividadesCalificadas: 0, actividadesFaltantesConfirmadas: 1
      }] })
      .mockResolvedValueOnce({ jobId: 'job-test', estado: 'queued', progreso: 0, total: 1 });
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    fireEvent.change(await screen.findByLabelText('Parcial destino'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar evaluación continua' }));
    expect(await screen.findByRole('table', { name: 'Proyección de evaluación continua del tercer parcial desde Classroom' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '4.5' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Contar como 0 · Luis Gómez · Actividad Classroom' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar y sincronizar selección' });
    expect(confirmar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar proyección' }));
    const filaFaltante = await screen.findByRole('row', { name: /Luis Gómez/ });
    expect(within(filaFaltante).getAllByRole('cell', { name: '0' })).toHaveLength(3);
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenNthCalledWith(2, '/evaluaciones/v2/classroom/importaciones/preview', {
      periodoId: 'per-1', actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 3, faltantesConfirmados: ['submission-missing'] }]
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/classroom/importaciones/jobs', expect.objectContaining({
      periodoId: 'per-1', actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 3, faltantesConfirmados: ['submission-missing'] }],
      clientRequestId: expect.any(String)
    })));
    expect(await screen.findByText('Sincronización completada. Nuevas: 1; actualizadas: 2. Evidencias releídas.')).toBeInTheDocument();
    expect(screen.getByText(/1 actividades · 1 calificadas .* 1 nuevas · 2 actualizadas/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Proyección de evaluación continua del tercer parcial desde Classroom' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar y sincronizar selección' })).not.toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/evidencias?periodoId=per-1&limite=400');
    expect(clienteApi.enviar.mock.calls.every(([ruta]) => String(ruta).includes('/importaciones/'))).toBe(true);
    expect(clienteApi.actualizar.mock.calls.every(([ruta]) => String(ruta).includes('/mapeo-alumnos'))).toBe(true);
  });

  it('envía la reentrega en la solicitud de sincronización solo cuando el docente la marca', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/importaciones/jobs/')) return { jobId: 'job-test', estado: 'succeeded', progreso: 1, total: 1, resultado: { importadas: 0, actualizadas: 1 } };
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/actividades?')) return { actividades: [{ id: 'work-1', title: 'Actividad Classroom', state: 'PUBLISHED', maxPoints: 100 }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      return {};
    });
    vi.mocked(clienteApi.enviar)
      .mockResolvedValueOnce({ planHash: 'a'.repeat(64), totalActividades: 1, actividades: [{
        courseId: 'course-1', courseWorkId: 'work-1', courseWorkTitle: 'Actividad Classroom',
        submissions: [{ submissionId: 'submission-returned', alumnoId: 'alumno-1', alumnoNombre: 'Ana Pérez', revisionPendiente: true }]
      }] })
      .mockResolvedValueOnce({ jobId: 'job-test', estado: 'queued', progreso: 0, total: 1 });

    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    fireEvent.change(await screen.findByLabelText('Parcial destino'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar evaluación continua' }));
    const autorizacion = await screen.findByRole('checkbox', { name: 'Actualizar solo por solicitud docente · Ana Pérez · Actividad Classroom' });
    expect(autorizacion).not.toBeChecked();
    fireEvent.click(autorizacion);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenNthCalledWith(2, '/evaluaciones/v2/classroom/importaciones/jobs', expect.objectContaining({
      periodoId: 'per-1', actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 1, reentregasConfirmadas: ['submission-returned'] }],
      clientRequestId: expect.any(String)
    })));
  });

  it('pagina todas las fichas del historial sin invalidar las capturas ya cargadas', async () => {
    let numeroUrl = 0;
    const revocar = vi.fn();
    const URLNativa = URL;
    class URLConBlob extends URLNativa {
      static createObjectURL = vi.fn(() => `blob:historial-${++numeroUrl}`);
      static revokeObjectURL = revocar;
    }
    vi.stubGlobal('URL', URLConBlob);
    vi.mocked(clienteApi.obtenerBinario).mockImplementation(async (ruta) => {
      if (String(ruta).includes('snapshot-2')) throw new Error('imagen no disponible');
      return { blob: async () => new Blob(['ficha']) } as Response;
    });
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [], nextCursor: null };
      if (String(ruta).includes('/cortes/1/historial') && String(ruta).includes('cursor=')) return {
        eventos: [{ id: 'snapshot-2', corte: 1, promedioSobre10: 7, estado: 'calculado', puntosObtenidos: 70, puntosPosibles: 100, capturaHash: 'hash-2', capturaBytes: 1200, createdAt: '2026-10-13T10:00:00.000Z' }],
        nextCursor: null
      };
      if (String(ruta).includes('/cortes/1/historial')) return {
        eventos: [{ id: 'snapshot-1', corte: 1, promedioSobre10: 8, estado: 'calculado', puntosObtenidos: 80, puntosPosibles: 100, capturaHash: 'hash-1', capturaBytes: 1100, createdAt: '2026-10-14T10:00:00.000Z' }],
        nextCursor: 'cursor-2'
      };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [] };
      return {};
    });
    const vista = render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(screen.getByLabelText('Alumno'), { target: { value: 'alumno-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }));
    expect(await screen.findByText(/8 \/ 10/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más capturas' }));
    expect(await screen.findByText(/7 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 capturas del historial.')).toBeInTheDocument();
    expect(clienteApi.obtenerBinario).toHaveBeenCalledWith(expect.stringContaining('snapshot-2'));
    const avisoImagen = await screen.findByText(/La ficha está en el historial, pero no se pudo cargar su imagen/i);
    expect(avisoImagen).toHaveAttribute('role', 'status');
    expect(screen.getAllByRole('img', { name: /Ficha del promedio/ })).toHaveLength(1);
    expect(revocar).not.toHaveBeenCalled();
    expect(clienteApi.obtener).toHaveBeenCalledWith(expect.stringContaining('cursor=cursor-2'));
    vista.unmount();
    expect(revocar).toHaveBeenCalledTimes(1);
  });

  it('limita el selector de historial al periodo activo e identifica alumnos por matrícula', () => {
    const alumnosDeOtroPeriodo: Alumno = {
      _id: 'alumno-otro-periodo', nombreCompleto: 'Ana Pérez', matricula: 'A-03', correo: 'ana.otro@escuela.test', periodoId: 'per-2'
    };
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={[...alumnos, alumnosDeOtroPeriodo]} permisos={permisos} />);

    const selectorAlumno = screen.getByLabelText('Alumno');
    expect(within(selectorAlumno).getByRole('option', { name: 'A-01 · Ana Pérez' })).toBeInTheDocument();
    expect(within(selectorAlumno).queryByRole('option', { name: 'A-03 · Ana Pérez' })).not.toBeInTheDocument();
    expect(within(selectorAlumno).getAllByRole('option', { name: /Ana Pérez/ })).toHaveLength(1);
  });

  it('distingue una sincronización completada de una relectura fallida', async () => {
    let fallarRelectura = false;
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/importaciones/jobs/')) return { jobId: 'job-test', estado: 'succeeded', progreso: 1, total: 1, resultado: { totalActividades: 1, importadas: 0, actualizadas: 1 } };
      if (String(ruta).includes('/evaluaciones/evidencias')) {
        if (fallarRelectura) throw new Error('La relectura de evidencias falló.');
        return { evidencias: [actividadClassroom], nextCursor: null };
      }
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      if (String(ruta).includes('/actividades?')) return { actividades: [{ id: 'work-1', title: 'Actividad Classroom', state: 'PUBLISHED', maxPoints: 100 }] };
      return {};
    });
    vi.mocked(clienteApi.enviar)
      .mockResolvedValueOnce({ planHash: 'a'.repeat(64), totalActividades: 1, graded: 1, wouldCreate: 0, wouldUpdate: 1 })
      .mockResolvedValueOnce({ jobId: 'job-test', estado: 'queued', progreso: 0, total: 1 });
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    fireEvent.change(await screen.findByLabelText('Parcial destino'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar evaluación continua' }));
    await screen.findByText(/1 actividades .* 1 por actualizar/);
    fallarRelectura = true;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Sincronización completada. Nuevas: 0; actualizadas: 1.');
    expect(alerta).toHaveTextContent('No se pudieron releer las evidencias');
    expect(alerta).not.toHaveTextContent('Evidencias releídas.');
    expect(screen.getByText(/1 actividades .* 0 nuevas · 1 actualizadas/)).toBeInTheDocument();
  });

  it('advierte cuando la API termina parcialmente la sincronización', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/importaciones/jobs/')) return { jobId: 'job-test', estado: 'partial', progreso: 1, total: 1, resultado: {
        totalActividades: 1, importadas: 1, actualizadas: 0,
        errores: [{ courseId: 'course-1', courseWorkId: 'work-1', mensaje: 'Error al sincronizar actividad' }]
      } };
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [actividadClassroom], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'Ingeniería de Software' }] };
      if (String(ruta).includes('/alumnos?')) return { alumnosClassroom: [] };
      if (String(ruta).includes('/actividades?')) return { actividades: [{ id: 'work-1', title: 'Actividad Classroom', state: 'PUBLISHED', maxPoints: 100 }] };
      return {};
    });
    vi.mocked(clienteApi.enviar)
      .mockResolvedValueOnce({ planHash: 'a'.repeat(64), totalActividades: 1, graded: 1, wouldCreate: 1, wouldUpdate: 0, actividades: [{
        courseId: 'course-1', courseWorkId: 'work-1', courseWorkTitle: 'Actividad Classroom', submissions: []
      }], promediosEvaluacionContinuaTercerParcial: [{
        alumnoId: 'alumno-1', alumnoNombre: 'Ana Pérez', puntosObtenidos: 90, puntosPosibles: 100,
        promedioSobre10: 9, continuaSobre5: 4.5, actividadesCalificadas: 1, actividadesFaltantesConfirmadas: 0
      }] })
      .mockResolvedValueOnce({ jobId: 'job-test', estado: 'queued', progreso: 0, total: 1 });
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    fireEvent.change(await screen.findByLabelText('Curso de Classroom'), { target: { value: 'course-1' } });
    fireEvent.change(await screen.findByLabelText('Parcial destino'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar evaluación continua' }));
    await screen.findByRole('table', { name: 'Proyección de evaluación continua del tercer parcial desde Classroom' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sincronización finalizada con errores. Nuevas: 1; actualizadas: 0; actividades con error: 1. Evidencias releídas.');
    expect(screen.getByText('Error al sincronizar actividad')).toBeInTheDocument();
    expect(screen.queryByText('Sincronización completada. Nuevas: 0; actualizadas: 0. Evidencias releídas.')).not.toBeInTheDocument();
  });

  it('explica que Classroom requiere OAuth y no muestra el estado vacío si falla la consulta de cursos', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return { evidencias: [], nextCursor: null };
      if (ruta === '/evaluaciones/v2/classroom/cursos') {
        throw new ErrorRemoto('Classroom requiere conexión OAuth.', { status: 503, codigo: 'CLASSROOM_NO_CONFIG' });
      }
      return {};
    });

    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Google Classroom no está disponible en esta instalación.');
    expect(screen.queryByText(/No hay cursos activos disponibles/)).not.toBeInTheDocument();
  });

  it('no convierte metadata con destino externo o protocolo inseguro en enlaces', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).includes('/evaluaciones/evidencias')) return {
        evidencias: [
          { ...actividadClassroom, id: 'hostile-1', metadata: { alternateLink: 'https://attacker.example/classroom' } },
          { ...actividadClassroom, id: 'hostile-2', metadata: { alternateLink: 'javascript:alert(1)' } }
        ], nextCursor: null
      };
      if (ruta === '/evaluaciones/v2/classroom/cursos') return { cursos: [] };
      return {};
    });
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    expect(screen.queryByRole('link', { name: /Abrir en Google Classroom/ })).not.toBeInTheDocument();
  });

  it('anuncia errores de consulta como alerta accesible', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('No fue posible consultar las evidencias.'));
    render(<ClassroomEnCalificaciones periodoId="per-1" periodos={[{ _id: 'per-1', nombre: 'Ingeniería' }]} onPeriodoChange={vi.fn()} alumnos={alumnos} permisos={permisos} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible consultar las evidencias.');
  });
});

