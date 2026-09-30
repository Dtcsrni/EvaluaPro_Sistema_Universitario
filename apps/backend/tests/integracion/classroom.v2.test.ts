/**
 * classroom.v2.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app.js';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno.js';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo.js';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente.js';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens.js';
import { EvidenciaEvaluacion } from '../../src/modulos/modulo_evaluaciones/modeloEvidenciaEvaluacion.js';
import { classroomGet, obtenerTokenAccesoClassroom } from '../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

vi.mock('../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle', () => ({
  construirUrlOauthClassroom: vi.fn(),
  completarOauthClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: vi.fn(),
  classroomGet: vi.fn(),
  classroomGetAll: vi.fn(),
  listarCursosClassroom: vi.fn(async () => [
    { id: 'course-1', name: 'Programación', section: 'A', courseState: 'ACTIVE' }
  ]),
  listarActividadesClassroom: vi.fn(async () => [
    { id: 'cw-1', title: 'Actividad 1', description: 'Desc', maxPoints: 100, state: 'PUBLISHED' }
  ]),
  desconectarOauthClassroom: vi.fn(async () => undefined)
}));

describe('classroom v2', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function crearContexto() {
    const docente = await Docente.create({
      _id: '507f1f77bcf86cd799439921',
      nombreCompleto: 'Docente Classroom V2',
      correo: 'classroomv2@test.com',
      roles: ['docente'],
      activo: true
    });
    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439922',
      docenteId: docente._id,
      nombre: 'Periodo Classroom V2',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });
    const alumno1 = await Alumno.create({
      _id: '507f1f77bcf86cd799439923',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU001',
      nombreCompleto: 'Alumno Uno',
      correo: 'uno@classroom.test'
    });
    const alumno2 = await Alumno.create({
      _id: '507f1f77bcf86cd799439924',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'MAT002',
      nombreCompleto: 'Alumno Dos'
    });
    const alumno3 = await Alumno.create({
      _id: '507f1f77bcf86cd799439925',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU003',
      nombreCompleto: 'Alumno Tres'
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    return {
      docente,
      periodo,
      alumno1,
      alumno2,
      alumno3,
      auth: { Authorization: `Bearer ${token}` }
    };
  }

  // Cobertura integral del flujo Classroom v2 en un solo escenario end-to-end.
  it('lista cursos, actividades, mapea alumnos y ejecuta preview/importación con historial', async () => {
    const { docente, periodo, alumno1, alumno2, alumno3, auth } = await crearContexto();
    const descripcionOriginal = 'Guía de estudio para el segundo parcial. '.repeat(400).trim();
    const incluirHoraLimite = true;
    let asignadaCalificacionUno = true;

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path) === 'courses/course-1') {
        return { id: 'course-1', name: 'Programación', section: 'A' };
      }
      if (String(path).includes('/students')) {
        return {
          students: [
            { userId: 'user-1', profile: { emailAddress: 'uno@classroom.test', name: { fullName: 'Alumno Uno' } } },
            { userId: 'user-2', profile: { emailAddress: 'mat002@institucion.test', name: { fullName: 'Alumno Dos' } } },
            { userId: 'user-3', profile: { emailAddress: 'tres@classroom.test', name: { fullName: 'Alumno Tres' } } }
          ]
        };
      }
      if (String(path).includes('/studentSubmissions')) {
        return {
          studentSubmissions: [
            { id: 'submission-1', userId: 'user-1', ...(asignadaCalificacionUno ? { assignedGrade: 90 } : {}), state: 'TURNED_IN', updateTime: '2026-02-10T10:00:00.000Z' },
            { id: 'submission-2', userId: 'user-2', draftGrade: 80, state: 'CREATED', updateTime: '2026-02-11T10:00:00.000Z' },
            { id: 'submission-3', userId: 'user-3', assignedGrade: 70, state: 'RETURNED', updateTime: '2026-02-12T10:00:00.000Z' }
          ]
        };
      }
      return {
        id: 'cw-1',
        title: 'Actividad 1',
        description: descripcionOriginal,
        maxPoints: 100,
        dueDate: { year: 2026, month: 2, day: 9 },
        ...(incluirHoraLimite ? { dueTime: { hours: 23, minutes: 59 } } : {}),
        updateTime: '2026-02-10T10:00:00.000Z'
      };
    });

    const estadoInicial = await request(app).get('/api/evaluaciones/v2/classroom/estado').set(auth).expect(200);
    expect(estadoInicial.body?.estado?.conectado).toBe(false);

    const cursos = await request(app).get('/api/evaluaciones/v2/classroom/cursos').set(auth).expect(200);
    expect(cursos.body?.cursos).toHaveLength(1);

    const actividades = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/actividades?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(actividades.body?.actividades).toHaveLength(1);

    const roster = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/alumnos?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(roster.body?.alumnosClassroom).toHaveLength(3);
    expect(roster.body?.alumnosClassroom?.find((fila: { classroomUserId: string }) => fila.classroomUserId === 'user-1')?.matchStrategy).toBe('email');
    expect(roster.body?.alumnosClassroom?.find((fila: { classroomUserId: string }) => fila.classroomUserId === 'user-2')?.matchStrategy).toBe('matricula');

    await request(app)
      .put('/api/evaluaciones/v2/classroom/cursos/course-1/mapeo-alumnos')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        asignaciones: [{ classroomUserId: 'user-3', alumnoId: String(alumno3._id) }]
      })
      .expect(200);

    const previewSinConfirmar = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 2, destinoColumna: 'Tareas y Ejercicios 2do Parcial' }]
      })
      .expect(200);
    expect(previewSinConfirmar.body?.acumuladoTareasSegundoParcial?.map((row: { alumnoNombre: string }) => row.alumnoNombre))
      .not.toContain('Alumno Dos');

    const preview = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 2, destinoColumna: 'Tareas y Ejercicios 2do Parcial', faltantesConfirmados: ['submission-2'] }]
      })
      .expect(200);

    expect(preview.body?.matched).toBe(3);
    expect(preview.body?.pending).toBe(1);
    expect(preview.body?.graded).toBe(2);
    const previewBorrador = preview.body?.actividades?.[0]?.submissions?.find((row: { submissionId: string }) => row.submissionId === 'submission-2');
    expect(previewBorrador).toEqual(expect.objectContaining({ estadoCaptura: 'pendiente', pending: true, graded: false }));
    expect(previewBorrador?.calificacionDecimal).toBeUndefined();
    expect(preview.body?.unmatched).toBe(0);
    expect(preview.body?.acumuladoTareasSegundoParcial).toEqual([
      expect.objectContaining({ alumnoNombre: 'Alumno Dos', puntosObtenidos: 0, puntosPosibles: 100, promedio: 0, actividadesCalificadas: 0, actividadesFaltantesConfirmadas: 1 }),
      expect.objectContaining({ alumnoNombre: 'Alumno Tres', puntosObtenidos: 70, puntosPosibles: 100, promedio: 7, actividadesCalificadas: 1 }),
      expect.objectContaining({ alumnoNombre: 'Alumno Uno', puntosObtenidos: 90, puntosPosibles: 100, promedio: 9, actividadesCalificadas: 1 })
    ]);
    expect(preview.body?.actividades?.[0]?.submissions?.find((row: { submissionId: string }) => row.submissionId === 'submission-2'))
      .toEqual(expect.objectContaining({ vencida: true, puedeConfirmarFaltante: true, faltanteExplicito: true }));
    const previewPractica = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{
          courseId: 'course-1',
          courseWorkId: 'cw-1',
          tituloEvidencia: 'Actividad práctica',
          corte: 2,
          destinoColumna: 'Practica 2do Parcial'
        }]
      })
      .expect(200);
    expect(previewPractica.body?.acumuladoTareasSegundoParcial).toEqual([]);
    expect(await EvidenciaEvaluacion.countDocuments({ docenteId: docente._id, periodoId: periodo._id })).toBe(0);

    const previewTercerParcial = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad de tercer parcial', ponderacion: 1, corte: 3 }]
      })
      .expect(200);
    expect(previewTercerParcial.body?.promediosEvaluacionContinuaTercerParcial).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alumnoId: String(alumno1._id), alumnoNombre: 'Alumno Uno', puntosObtenidos: 90,
        puntosPosibles: 100, promedioSobre10: 9, continuaSobre5: 4.5, actividadesCalificadas: 1
      }),
      expect.objectContaining({
        alumnoId: String(alumno3._id), alumnoNombre: 'Alumno Tres', puntosObtenidos: 70,
        puntosPosibles: 100, promedioSobre10: 7, continuaSobre5: 3.5, actividadesCalificadas: 1
      })
    ]));
    expect(previewTercerParcial.body?.promediosEvaluacionContinuaTercerParcial).toHaveLength(2);
    expect(previewTercerParcial.body?.actividades?.[0]?.submissions?.find((row: { submissionId: string }) => row.submissionId === 'submission-2'))
      .toEqual(expect.objectContaining({ puedeConfirmarFaltante: true, faltanteExplicito: false, vencida: true }));
    expect(await EvidenciaEvaluacion.countDocuments({ docenteId: docente._id, periodoId: periodo._id })).toBe(0);
    const previewC3ConFaltanteSeleccionado = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad de tercer parcial', ponderacion: 1, corte: 3, faltantesConfirmados: ['submission-2'] }]
      })
      .expect(200);
    expect(previewC3ConFaltanteSeleccionado.body?.promediosEvaluacionContinuaTercerParcial).toEqual(expect.arrayContaining([
      expect.objectContaining({ alumnoId: String(alumno2._id), puntosObtenidos: 0, puntosPosibles: 100, promedioSobre10: 0, continuaSobre5: 0, actividadesFaltantesConfirmadas: 1 })
    ]));
    expect(await EvidenciaEvaluacion.countDocuments({ docenteId: docente._id, periodoId: periodo._id })).toBe(0);

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 2, destinoColumna: 'Tareas y Ejercicios 2do Parcial', faltantesConfirmados: ['submission-2'] }]
      })
      .expect(200);

    expect(ejecucion.body?.importadas).toBe(3);
    expect(ejecucion.body?.actualizadas).toBe(0);
    const actividadesRecargadas = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/actividades?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(actividadesRecargadas.body?.actividades?.[0]?.mapeo?.destinoColumna).toBe('Tareas y Ejercicios 2do Parcial');
    expect(actividadesRecargadas.body?.actividades?.[0]?.mapeo?.corte).toBe(2);
    const evidencias = await EvidenciaEvaluacion.find({ docenteId: docente._id, periodoId: periodo._id }).sort({ 'classroom.submissionId': 1 }).lean();
    expect(evidencias).toHaveLength(3);
    const faltanteConfirmado = evidencias.find((item) => item.classroom?.submissionId === 'submission-2');
    expect(faltanteConfirmado?.estadoCaptura).toBe('pendiente');
    expect(faltanteConfirmado?.calificacionDecimal).toBeNull();
    expect(faltanteConfirmado?.metadata?.faltanteClassroomConfirmado).toBeTruthy();
    expect(evidencias.find((item) => item.classroom?.submissionId === 'submission-1')?.estadoCaptura).toBe('calificada');
    expect(evidencias.find((item) => item.classroom?.submissionId === 'submission-1')?.calificacionDecimal).toBe(9);
    expect(evidencias.find((item) => item.classroom?.submissionId === 'submission-1')?.descripcion).toBe(descripcionOriginal);

    asignadaCalificacionUno = false;
    const reejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 2 }]
      })
      .expect(200);
    expect(reejecucion.body?.importadas).toBe(0);
    expect(reejecucion.body?.actualizadas).toBe(3);
    expect(await EvidenciaEvaluacion.countDocuments({ docenteId: docente._id, periodoId: periodo._id })).toBe(3);
    const notaRetirada = await EvidenciaEvaluacion.findOne({ docenteId: docente._id, 'classroom.submissionId': 'submission-1' }).lean();
    expect(notaRetirada?.estadoCaptura).toBe('pendiente');
    expect(notaRetirada?.calificacionDecimal).toBeNull();
    expect((await EvidenciaEvaluacion.findOne({ docenteId: docente._id, 'classroom.submissionId': 'submission-2' }).lean())?.metadata?.faltanteClassroomConfirmado).toBeTruthy();
    const mapeoPersistido = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/actividades?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(mapeoPersistido.body?.actividades?.[0]?.mapeo?.destinoColumna).toBe('Tareas y Ejercicios 2do Parcial');

    asignadaCalificacionUno = true;
    await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', corte: 3 }]
      })
      .expect(200);
    const evidenciaTercerParcial = await EvidenciaEvaluacion.findOne({ docenteId: docente._id, periodoId: periodo._id }).lean();
    expect(evidenciaTercerParcial?.corte).toBe(3);
    const mapeoTercerParcial = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/actividades?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(mapeoTercerParcial.body?.actividades?.[0]?.mapeo?.corte).toBe(3);

    await request(app)
      .post('/api/evaluaciones/v2/examenes/componentes')
      .set(auth)
      .send({ periodoId: String(periodo._id), alumnoId: String(alumno3._id), corte: 'global', teoricoDecimal: 8, practicas: [8] })
      .expect(201);
    const listaAcademica = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    const filaAlumno3 = listaAcademica.body?.filas?.find((fila: { alumnoId: string }) => fila.alumnoId === String(alumno3._id));
    expect(filaAlumno3).toMatchObject({
      global: '7.5',
      examenGlobalComponente: '8',
      examenGlobalLista: '4',
      continuaTercerParcialLista: '3.5',
      calificacionTercerParcial: '7.5'
    });
    const filaAlumno1 = listaAcademica.body?.filas?.find((fila: { alumnoId: string }) => fila.alumnoId === String(alumno1._id));
    expect(filaAlumno1?.continuaTercerParcialLista).toBe('4.5');
    const filaAlumno2 = listaAcademica.body?.filas?.find((fila: { alumnoId: string }) => fila.alumnoId === String(alumno2._id));
    expect(filaAlumno2?.continuaTercerParcialLista).toBe('0');

    const historial = await request(app)
      .get(`/api/evaluaciones/v2/classroom/importaciones/historial?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(historial.body?.historial?.length).toBeGreaterThanOrEqual(2);
  });

  it('maneja errores de red durante la importación (Network Error)', async () => {
    const { periodo, auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    // Simulamos que la API de Google falla abruptamente por error de red
    vi.mocked(classroomGet).mockRejectedValue(new Error('Network Error from Google API'));

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 1 }]
      })
      .expect(200); // El controlador v2 devuelve 200 con reporte de errores, no crashea

    expect(ejecucion.body?.importadas).toBe(0);
    expect(ejecucion.body?.errores?.length).toBeGreaterThan(0);
    // El backend enmascara errores genéricos por seguridad
    expect(ejecucion.body?.errores[0]?.mensaje).toBe('Error al sincronizar actividad');
  });

  it('persiste como cero una entrega vencida confirmada explícitamente para evaluación continua C3', async () => {
    const { docente, periodo, alumno1, auth } = await crearContexto();
    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      const ruta = String(path);
      if (ruta === 'courses/course-1') return { id: 'course-1', name: 'Programación', section: 'A' };
      if (ruta.includes('/students')) return { students: [{ userId: 'user-1', profile: { emailAddress: 'uno@classroom.test', name: { fullName: 'Alumno Uno' } } }] };
      if (ruta.includes('/studentSubmissions')) return { studentSubmissions: [{ id: 'submission-c3', userId: 'user-1', state: 'CREATED' }] };
      return {
        id: 'cw-c3', title: 'Actividad C3', maxPoints: 100,
        dueDate: { year: 2026, month: 2, day: 9 }, dueTime: { hours: 23, minutes: 59 },
        updateTime: '2026-02-10T10:00:00.000Z'
      };
    });

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-c3', tituloEvidencia: 'Actividad C3', corte: 3, faltantesConfirmados: ['submission-c3'] }]
      })
      .expect(200);

    expect(ejecucion.body?.importadas).toBe(1);
    const evidencia = await EvidenciaEvaluacion.findOne({ docenteId: docente._id, 'classroom.submissionId': 'submission-c3' }).lean();
    expect(evidencia?.alumnoId).toBe(String(alumno1._id));
    expect(evidencia?.corte).toBe(3);
    expect(evidencia?.estadoCaptura).toBe('pendiente');
    expect(evidencia?.calificacionDecimal).toBeNull();
    expect(evidencia?.metadata?.faltanteClassroomConfirmado).toBeTruthy();

    const lista = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    const fila = lista.body?.filas?.find((item: { alumnoId: string }) => item.alumnoId === String(alumno1._id));
    expect(fila?.continuaTercerParcialLista).toBe('0');
  });

  it('resuelve alumnos inactivos dentro de una materia archivada sin reactivarlos', async () => {
    const { docente, periodo, alumno1, auth } = await crearContexto();
    await prisma.periodo.update({ where: { id: String(periodo._id) }, data: { activo: false, archivadoEn: new Date() } });
    await prisma.alumno.update({ where: { id: String(alumno1._id) }, data: { activo: false } });

    const periodosArchivados = await request(app).get('/api/periodos?activo=false').set(auth).expect(200);
    expect(periodosArchivados.body?.periodos).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: String(periodo._id), activo: false })
    ]));

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path) === 'courses/course-1') return { id: 'course-1', name: 'Programación' };
      if (String(path).includes('/students')) {
        return { students: [{ userId: 'user-1', profile: { emailAddress: 'uno@classroom.test', name: { fullName: 'Alumno Uno' } } }] };
      }
      if (String(path).includes('/studentSubmissions')) {
        return { studentSubmissions: [{ id: 'submission-archivada', userId: 'user-1', assignedGrade: 80, state: 'RETURNED' }] };
      }
      return { id: 'cw-1', title: 'Actividad histórica', maxPoints: 100, state: 'PUBLISHED' };
    });

    const roster = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/alumnos?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(roster.body?.alumnosClassroom?.[0]).toEqual(expect.objectContaining({ alumnoIdSugerido: String(alumno1._id), matchStrategy: 'email' }));

    const preview = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({ periodoId: String(periodo._id), actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', corte: 3 }] })
      .expect(200);
    expect(preview.body?.matched).toBe(1);
    expect(preview.body?.actividades?.[0]?.submissions?.[0]).toEqual(expect.objectContaining({ alumnoId: String(alumno1._id), calificacionDecimal: 8 }));
    expect((await Alumno.findById(alumno1._id).lean())?.activo).toBe(false);
    expect((await Periodo.findById(periodo._id).lean())?.activo).toBe(false);
    expect(await EvidenciaEvaluacion.countDocuments({ docenteId: docente._id, periodoId: periodo._id })).toBe(0);

    await prisma.periodo.update({ where: { id: String(periodo._id) }, data: { activo: true, archivadoEn: null } });
    const rosterActivo = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/alumnos?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(rosterActivo.body?.alumnosClassroom?.[0]).toEqual(expect.objectContaining({ alumnoIdSugerido: null, matchStrategy: 'none' }));
  });

  it('maneja expiración de token de Google en medio de la solicitud (Token Expired)', async () => {
    const { periodo, auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockRejectedValue(new Error('Google OAuth token expired or revoked'));

    await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 1 }]
      })
      .expect(500); // Si obtenerToken falla fuera del try-catch de actividades, arroja error global
  });
});
