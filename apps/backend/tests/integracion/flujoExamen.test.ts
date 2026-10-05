/**
 * flujoExamen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del flujo completo de examen.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('flujo de examen', () => {
  const preguntasPorEscenario = 20;
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPreguntasCanonicas(auth: { Authorization: string }, periodoId: string) {
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'Flujo de examen' })
      .expect(201);
    const temaId = String(temaResp.body.tema._id);
    const sufijo = Date.now();
    const lote = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `flujo-examen-${sufijo}`,
      target: { periodoId, temaIds: [temaId] },
      source: {
        kind: 'manual',
        generator: 'integracion-backend',
        generatedAt: '2026-09-24T00:00:00Z',
        sourceDocumentSha256: null
      },
      items: Array.from({ length: preguntasPorEscenario }, (_, index) => ({
        externalKey: `flujo-examen-${sufijo}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta ${index + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
          key,
          value: `Opcion ${key}`,
          isCorrect: optionIndex === 0
        })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'fixture de flujo de examen' }
      }))
    };
    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set(auth)
      .send(lote)
      .expect(200);
    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set(auth)
      .send({ planHash: preview.body.planHash, payload: lote })
      .expect(200);
    const preguntasIds: string[] = [];
    for (const reactivoId of confirmado.body.reactivoIds as string[]) {
      await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`)
        .set(auth)
        .send({})
        .expect(200);
      const publicado = await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
        .set(auth)
        .send({})
        .expect(200);
      preguntasIds.push(String(publicado.body.legacyPreguntaId));
    }
    return preguntasIds;
  }

  it('crea periodo, alumno, banco, plantilla, examen, vincula y califica', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410168',
        nombreCompleto: 'Alumno Prueba',
        correo: 'alumno@prueba.test',
        grupo: 'A'
      })
      .expect(201);
    const alumnoId = alumnoResp.body.alumno._id as string;

    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 2,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId })
      .expect(201);
    const examenId = examenResp.body.examenGenerado._id as string;
    const folio = examenResp.body.examenGenerado.folio as string;
    const totalReactivosExamen = Array.isArray(examenResp.body.examenGenerado.preguntasIds)
      ? examenResp.body.examenGenerado.preguntasIds.length
      : 1;

    await request(app)
      .post('/api/entregas/vincular-folio')
      .set(auth)
      .send({ folio, alumnoId })
      .expect(201);

    const calificacionResp = await request(app)
      .post('/api/calificaciones/calificar')
      .set(auth)
      .send({
        examenGeneradoId: examenId,
        alumnoId,
        aciertos: totalReactivosExamen,
        totalReactivos: totalReactivosExamen,
        bonoSolicitado: 0.5,
        evaluacionContinua: 5
      })
      .expect(201);
    expect(calificacionResp.body.calificacion.calificacionExamenFinalTexto).toBe('5');
    expect(calificacionResp.body.calificacion.calificacionParcialTexto).toBe('10');

    const pdfResp = await request(app)
      .get(`/api/examenes/generados/${examenId}/pdf`)
      .set(auth)
      .expect(200);
    expect(pdfResp.header['content-type']).toContain('application/pdf');

    const csvResp = await request(app)
      .get(`/api/analiticas/calificaciones-csv?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);
    expect(csvResp.text).toContain('matricula,nombre,grupo,parcial1,parcial2,global,final,banderas');

    const xlsxResp = await request(app)
      .get(`/api/analiticas/calificaciones-xlsx?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);
    expect(xlsxResp.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(String(xlsxResp.header['content-disposition'] ?? '')).toContain('calificaciones-produccion.xlsx');
  });

  it('genera extraordinarios solo para alumnos seleccionados y conserva su nota aparte', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Periodo extraordinario', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const alumnos = [];
    for (const [indice, nombre] of ['Seleccionado Uno', 'Seleccionado Dos', 'No Seleccionado'].entries()) {
      const respuesta = await request(app).post('/api/alumnos').set(auth).send({
        periodoId,
        matricula: `CUH51241900${indice + 1}`,
        nombreCompleto: nombre,
        correo: `${nombre.toLowerCase().replaceAll(' ', '.')}@prueba.test`,
        grupo: 'A'
      }).expect(201);
      alumnos.push(String(respuesta.body.alumno._id));
    }

    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);
    const plantillaResp = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Parcial 1 · plantilla para extraordinario',
      numeroPaginas: 2,
      preguntasIds
    }).expect(201);
    const plantillaId = String(plantillaResp.body.plantilla._id);
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth).expect(200);

    const loteId = `EXT_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    const respuesta = await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId,
      tipoExamen: 'extraordinario',
      alumnoIds: alumnos.slice(0, 2)
    }).expect(201);
    expect(respuesta.body.totalAlumnos).toBe(2);
    const examenes = await prisma.examenGenerado.findMany({ where: { loteId }, orderBy: { alumnoId: 'asc' } });
    expect(examenes).toHaveLength(2);
    expect(examenes.map((examen) => examen.alumnoId).sort()).toEqual(alumnos.slice(0, 2).sort());
    expect(examenes.every((examen) => examen.tipoExamen === 'extraordinario')).toBe(true);
    expect(examenes.every((examen) => /^[a-f0-9]{64}$/.test(examen.cohorteLoteHash ?? ''))).toBe(true);
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId,
      tipoExamen: 'extraordinario',
      alumnoIds: alumnos.slice(0, 2)
    }).expect(201);
    expect(await prisma.examenGenerado.count({ where: { loteId } })).toBe(2);
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId,
      tipoExamen: 'extraordinario',
      alumnoIds: alumnos
    }).expect(409);
    const historial = await request(app)
      .get(`/api/examenes/generados?plantillaId=${encodeURIComponent(plantillaId)}&limite=10`)
      .set(auth)
      .expect(200);
    expect(historial.body.examenes.filter((item: { tipoExamen?: string }) => item.tipoExamen === 'extraordinario')).toHaveLength(2);

    const examen = examenes[0];
    await request(app).post('/api/calificaciones/calificar').set(auth).send({
      examenGeneradoId: examen.id,
      alumnoId: examen.alumnoId,
      aciertos: 8,
      totalReactivos: 10,
      evaluacionContinua: 5,
      proyecto: 5
    }).expect(201);
    const calificacion = await prisma.calificacion.findFirstOrThrow({ where: { examenGeneradoId: examen.id } });
    expect(calificacion.tipoExamen).toBe('extraordinario');
    expect(calificacion.calificacionExamenFinalTexto).toBeTruthy();
    expect(calificacion.calificacionParcialTexto).toBeNull();
    expect(calificacion.calificacionGlobalTexto).toBeNull();
    expect(calificacion.evaluacionContinuaTexto).toBeNull();
    expect(calificacion.proyectoTexto).toBeNull();

    const otroPeriodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Otro periodo', fechaInicio: '2026-07-01', fechaFin: '2026-12-01'
    }).expect(201);
    const alumnoAjeno = await request(app).post('/api/alumnos').set(auth).send({
      periodoId: String(otroPeriodo.body.periodo._id),
      matricula: 'CUH512419004',
      nombreCompleto: 'Alumno Ajeno',
      correo: `ajeno-${Date.now()}@prueba.test`
    }).expect(201);
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId: `BAD_${Date.now().toString(36)}`.slice(0, 16).toUpperCase(),
      tipoExamen: 'extraordinario',
      alumnoIds: [String(alumnoAjeno.body.alumno._id)]
    }).expect(400);
  });

  it('genera un extraordinario de periodo cerrado desde la plantilla y el banco archivados', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Diseno Web - periodo concluido',
      fechaInicio: '2026-08-01',
      fechaFin: '2026-09-30',
      grupos: ['A']
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const alumnoResp = await request(app).post('/api/alumnos').set(auth).send({
      periodoId,
      matricula: 'CUH512419101',
      nombreCompleto: 'Carlos Anwar',
      correo: 'carlos.anwar@prueba.test',
      grupo: 'A'
    }).expect(201);
    const alumnoId = String(alumnoResp.body.alumno._id);
    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);
    const plantillaResp = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId,
      tipo: 'global',
      titulo: 'Global Diseño Web',
      numeroPaginas: 2,
      preguntasIds
    }).expect(201);
    const plantillaId = String(plantillaResp.body.plantilla._id);
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth).expect(200);

    await request(app).post(`/api/periodos/${periodoId}/archivar`).set(auth).send({}).expect(200);
    const archivadas = await request(app).get('/api/examenes/plantillas?archivado=true').set(auth).expect(200);
    expect(archivadas.body.plantillas.map((item: { _id: string }) => item._id)).toContain(plantillaId);
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth).expect(200);

    const ordinaryLotId = `ORD_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      loteId: ordinaryLotId
    }).expect(409);
    expect(await prisma.examenGenerado.count({ where: { loteId: ordinaryLotId } })).toBe(0);

    const otroPeriodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Otra materia vigente',
      fechaInicio: '2026-10-01',
      fechaFin: '2027-01-01'
    }).expect(201);
    const alumnoAjeno = await request(app).post('/api/alumnos').set(auth).send({
      periodoId: String(otroPeriodo.body.periodo._id),
      matricula: 'CUH512419102',
      nombreCompleto: 'Alumno de otra materia',
      correo: 'ajeno@prueba.test'
    }).expect(201);
    const loteAjenoId = `BAD_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      loteId: loteAjenoId,
      tipoExamen: 'extraordinario',
      alumnoIds: [String(alumnoAjeno.body.alumno._id)]
    }).expect(400);
    expect(await prisma.examenGenerado.count({ where: { loteId: loteAjenoId } })).toBe(0);

    const loteId = `EXT_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    const respuesta = await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId,
      tipoExamen: 'extraordinario',
      alumnoIds: [alumnoId]
    }).expect((response) => {
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    });
    expect(respuesta.body.totalAlumnos).toBe(1);

    const examen = await prisma.examenGenerado.findFirstOrThrow({ where: { loteId } });
    expect(examen.alumnoId).toBe(alumnoId);
    expect(examen.periodoId).toBe(periodoId);
    expect(examen.plantillaId).toBe(plantillaId);
    expect(examen.tipoExamen).toBe('extraordinario');
    expect(examen.estado).toBe('generado');
    const pdf = await request(app).get(`/api/examenes/generados/lote/${loteId}/pdf`).set(auth).expect(200);
    expect(pdf.header['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    expect((await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } })).activo).toBe(false);
    expect((await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } })).activo).toBe(false);
    expect((await prisma.bancoPregunta.findMany({ where: { periodoId } })).every((pregunta) => pregunta.activo === false)).toBe(true);
    expect((await prisma.examenPlantilla.findUniqueOrThrow({ where: { id: plantillaId } })).archivadoEn).not.toBeNull();
  });

  it('rechaza el extraordinario si el periodo está archivado antes de su fecha de fin', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const fechaInicio = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fechaFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo todavía vigente', fechaInicio, fechaFin, grupos: ['A']
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const alumnoResp = await request(app).post('/api/alumnos').set(auth).send({
      periodoId, matricula: 'CUH512419199', nombreCompleto: 'Alumno de prueba', correo: 'periodo-vigente@prueba.test'
    }).expect(201);
    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);
    const plantillaResp = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'global', titulo: 'Global del periodo vigente', numeroPaginas: 2, preguntasIds
    }).expect(201);
    const plantillaId = String(plantillaResp.body.plantilla._id);
    await request(app).post(`/api/periodos/${periodoId}/archivar`).set(auth).send({}).expect(200);
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth).expect(409);

    const loteId = `EXT_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId, confirmarMasivo: true, loteId, tipoExamen: 'extraordinario',
      alumnoIds: [String(alumnoResp.body.alumno._id)]
    }).expect(409);
    expect(await prisma.examenGenerado.count({ where: { loteId } })).toBe(0);
  });
});
