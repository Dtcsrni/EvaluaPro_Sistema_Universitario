/**
 * flujoExamen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del flujo completo de examen.
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarBaseDatosTest, conectarBaseDatosTest, limpiarBaseDatosTest } from '../utils/sqliteTestDatabase.js';

describe('flujo de examen', () => {
  const preguntasPorEscenario = 20;
  const app = crearApp();

  beforeAll(async () => {
    await conectarBaseDatosTest();
  });

  beforeEach(async () => {
    await limpiarBaseDatosTest();
  });

  afterAll(async () => {
    await cerrarBaseDatosTest();
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

  async function crearPreguntasCanonicas(auth: { Authorization: string }, periodoId: string, tema = 'Flujo de examen') {
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: tema })
      .expect(201);
    const temaId = String(temaResp.body.tema._id);
    const sufijo = Date.now();
    const opcionesEscenario = [
      'Validar los datos de entrada antes de persistirlos.',
      'Aceptar cualquier valor y ajustar el registro después.',
      'Desactivar la validación para evitar errores de captura.',
      'Usar un dato compartido sin comprobar su origen.',
      'Guardar primero y revisar la consistencia al final.'
    ];
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
        stem: { format: 'richtext', value: `Pregunta ${index + 1}: ¿qué práctica conserva la calidad de los datos?` },
        options: opcionesEscenario.map((value, optionIndex) => ({
          key: String.fromCharCode(65 + optionIndex),
          value,
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
    const pdfParcial = await PDFDocument.load(pdfResp.body);
    expect(pdfParcial.getPageCount()).toBe(2);
    const textoParcial = new PDFParse({ data: pdfResp.body });
    try {
      const contenidoParcial = (await textoParcial.getText()).text;
      expect(contenidoParcial).toContain('Parcial 1');
      expect(contenidoParcial).toContain('Pregunta 20');
    } finally {
      await textoParcial.destroy();
    }

    const plantillaGlobal = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId,
      tipo: 'global',
      titulo: 'Global de prueba',
      numeroPaginas: 2,
      preguntasIds
    }).expect(201);
    await request(app)
      .get(`/api/examenes/plantillas/${String(plantillaGlobal.body.plantilla._id)}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);
    const globalGenerado = await request(app).post('/api/examenes/generados').set(auth).send({
      plantillaId: String(plantillaGlobal.body.plantilla._id)
    }).expect(201);
    const pdfGlobalResp = await request(app)
      .get(`/api/examenes/generados/${String(globalGenerado.body.examenGenerado._id)}/pdf`)
      .set(auth)
      .expect(200);
    const pdfGlobal = await PDFDocument.load(pdfGlobalResp.body);
    expect(pdfGlobal.getPageCount()).toBe(2);
    const textoGlobal = new PDFParse({ data: pdfGlobalResp.body });
    try {
      const contenidoGlobal = (await textoGlobal.getText()).text;
      expect(contenidoGlobal).toContain('Global de prueba');
      expect(contenidoGlobal).toContain('Pregunta 20');
    } finally {
      await textoGlobal.destroy();
    }

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
    await request(app).post(`/api/periodos/${periodoId}/archivar`).set(auth).send({}).expect(200);
    const vistaPreviaArchivada = await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth);
    expect(vistaPreviaArchivada.status, JSON.stringify(vistaPreviaArchivada.body)).toBe(200);

    const loteId = `EXT_${Date.now().toString(36)}`.slice(0, 16).toUpperCase();
    const respuesta = await request(app).post('/api/examenes/generados/lote').set(auth).send({
      plantillaId,
      confirmarMasivo: true,
      loteId,
      tipoExamen: 'extraordinario',
      alumnoIds: alumnos.slice(0, 2)
    }).expect((response) => {
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    });
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
    const extraordinariosApi = await request(app)
      .get(`/api/examenes/generados?plantillaId=${encodeURIComponent(plantillaId)}&tipoExamen=extraordinario&limite=10`)
      .set(auth)
      .expect(200);
    expect(extraordinariosApi.body.examenes).toHaveLength(2);
    expect(extraordinariosApi.body.examenes.every((item: { tipoExamen?: string }) => item.tipoExamen === 'extraordinario')).toBe(true);
    await request(app).get(`/api/examenes/generados?tipoExamen=invalido`).set(auth).expect(400);

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
      instrucciones: 'Instrucciones del global de origen: entregue el global al docente.',
      preguntasIds
    }).expect(201);
    const plantillaId = String(plantillaResp.body.plantilla._id);
    const parcialIds = await crearPreguntasCanonicas(auth, periodoId, 'Segundo parcial · fuentes adicionales');
    const parcialExtraResp = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Segundo Parcial Diseño Web',
      numeroPaginas: 2,
      preguntasIds: [preguntasIds[0], parcialIds[0], parcialIds[1], parcialIds[2]]
    }).expect(201);
    const plantillaParcialExtraId = String(parcialExtraResp.body.plantilla._id);
    const otroPeriodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Materia archivada ajena',
      fechaInicio: '2026-07-01',
      fechaFin: '2026-09-30',
      grupos: ['A']
    }).expect(201);
    const otroPeriodoId = String(otroPeriodoResp.body.periodo._id);
    const preguntasMateriaAjena = await crearPreguntasCanonicas(auth, otroPeriodoId, 'Materia ajena');
    const plantillaMateriaAjena = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId: otroPeriodoId,
      tipo: 'parcial',
      titulo: 'Parcial de otra materia',
      numeroPaginas: 2,
      preguntasIds: [preguntasMateriaAjena[0]]
    }).expect(201);
    const reactivoInvalido = await prisma.bancoPregunta.findUniqueOrThrow({
      where: { id: parcialIds[2] },
      include: { versiones: { include: { opciones: true } } }
    });
    const opcionAEliminar = reactivoInvalido.versiones[0]?.opciones[4];
    expect(opcionAEliminar).toBeTruthy();
    await prisma.opcionPregunta.delete({ where: { id: opcionAEliminar!.id } });
    const vistaPreviaAntesDeCerrar = await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth);
    expect(vistaPreviaAntesDeCerrar.status, JSON.stringify(vistaPreviaAntesDeCerrar.body)).toBe(200);

    await request(app).post(`/api/periodos/${periodoId}/archivar`).set(auth).send({}).expect(200);
    await request(app).post(`/api/periodos/${otroPeriodoId}/archivar`).set(auth).send({}).expect(200);
    const archivadas = await request(app).get('/api/examenes/plantillas?archivado=true').set(auth).expect(200);
    expect(archivadas.body.plantillas.map((item: { _id: string }) => item._id)).toContain(plantillaId);
    expect(archivadas.body.plantillas.map((item: { _id: string }) => item._id)).toContain(plantillaParcialExtraId);
    expect(archivadas.body.plantillas.map((item: { _id: string }) => item._id)).toContain(String(plantillaMateriaAjena.body.plantilla._id));
    const fuenteArchivadaAntesDePreview = {
      periodo: await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } }),
      alumno: await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } }),
      plantillas: await prisma.examenPlantilla.findMany({ where: { periodoId }, orderBy: { id: 'asc' } }),
      reactivos: await prisma.bancoPregunta.findMany({
        where: { periodoId },
        include: { versiones: { include: { opciones: { orderBy: { id: 'asc' } } } } },
        orderBy: { id: 'asc' }
      })
    };
    const resumenPreview = await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar`).set(auth).expect(200);
    expect(resumenPreview.body.layoutConfirmado).toBe(true);
    expect(resumenPreview.body.totalDisponibles).toBe(23);
    expect(resumenPreview.body.totalUsados).toBe(22);
    expect(resumenPreview.body.totalPreguntasOmitidasPorOmr).toBe(1);
    expect(resumenPreview.body.preguntasOmitidasPorOmr).toEqual([
      expect.objectContaining({ id: parcialIds[2], problemas: expect.arrayContaining(['requiere exactamente cinco opciones']) })
    ]);
    const fuenteArchivadaDespuesDePreview = {
      periodo: await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } }),
      alumno: await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } }),
      plantillas: await prisma.examenPlantilla.findMany({ where: { periodoId }, orderBy: { id: 'asc' } }),
      reactivos: await prisma.bancoPregunta.findMany({
        where: { periodoId },
        include: { versiones: { include: { opciones: { orderBy: { id: 'asc' } } } } },
        orderBy: { id: 'asc' }
      })
    };
    expect(fuenteArchivadaDespuesDePreview).toEqual(fuenteArchivadaAntesDePreview);
    const vistaPreviaMateriaCerrada = await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth);
    expect(vistaPreviaMateriaCerrada.status, JSON.stringify(vistaPreviaMateriaCerrada.body)).toBe(200);

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
    const preguntasImpresas = JSON.parse(examen.mapaVariante) as { ordenPreguntas: string[] };
    expect(preguntasImpresas.ordenPreguntas).toHaveLength(22);
    expect(new Set(preguntasImpresas.ordenPreguntas).size).toBe(22);
    expect(preguntasIds.every((id) => preguntasImpresas.ordenPreguntas.includes(id))).toBe(true);
    expect(preguntasImpresas.ordenPreguntas).toContain(parcialIds[0]);
    expect(preguntasImpresas.ordenPreguntas).toContain(parcialIds[1]);
    expect(preguntasImpresas.ordenPreguntas).not.toContain(parcialIds[2]);
    expect(preguntasImpresas.ordenPreguntas).not.toContain(preguntasMateriaAjena[0]);
    const pdf = await request(app).get(`/api/examenes/generados/lote/${loteId}/pdf`).set(auth).expect(200);
    expect(pdf.header['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    const parser = new PDFParse({ data: pdf.body });
    try {
      const textoPdf = (await parser.getText()).text;
      expect(textoPdf).toContain('Examen Extraordinario');
      expect(textoPdf).toContain('Lea y razone cada reactivo');
      expect(textoPdf).not.toContain('Instrucciones del global de origen');
    } finally {
      await parser.destroy();
    }
    const pdfExtraordinario = await PDFDocument.load(pdf.body);
    expect(pdfExtraordinario.getPageCount()).toBe(4);

    expect((await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } })).activo).toBe(false);
    expect((await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } })).activo).toBe(false);
    expect((await prisma.bancoPregunta.findMany({ where: { periodoId } })).every((pregunta) => pregunta.activo === false)).toBe(true);
    expect((await prisma.examenPlantilla.findUniqueOrThrow({ where: { id: plantillaId } })).archivadoEn).not.toBeNull();
    expect({
      periodo: await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } }),
      alumno: await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } }),
      plantillas: await prisma.examenPlantilla.findMany({ where: { periodoId }, orderBy: { id: 'asc' } }),
      reactivos: await prisma.bancoPregunta.findMany({
        where: { periodoId },
        include: { versiones: { include: { opciones: { orderBy: { id: 'asc' } } } } },
        orderBy: { id: 'asc' }
      })
    }).toEqual(fuenteArchivadaAntesDePreview);
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
