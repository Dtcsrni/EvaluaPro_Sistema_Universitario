/**
 * flujoExamen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del flujo completo de examen.
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { excluirReferenciasTecnologiaRetirada, mapearPreguntasBase, resolverPreguntasExtraordinarioArchivado, resolverPreguntasPlantilla } from '../../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';
import { generarExtraordinarioMaximo } from '../../src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('flujo de examen', () => {
  it('busca reactivos compactos fuera del prefijo aleatorio para maximizar la selección', async () => {
    const preguntas = [
      { id: 'larga-1', enunciado: 'L'.repeat(800), opciones: [{ texto: 'opción', esCorrecta: true }] },
      { id: 'larga-2', enunciado: 'L'.repeat(800), opciones: [{ texto: 'opción', esCorrecta: true }] },
      { id: 'corta-1', enunciado: 'S', opciones: [{ texto: 'opción', esCorrecta: true }] },
      { id: 'corta-2', enunciado: 'S', opciones: [{ texto: 'opción', esCorrecta: true }] }
    ];
    const alturas = preguntas.map((pregunta) => ({
      questionId: pregunta.id,
      plannedHeightPt: pregunta.id.startsWith('larga') ? 800 : 80,
      renderedHeightPt: pregunta.id.startsWith('larga') ? 800 : 80
    }));
    const renderizar = async (seleccion: typeof preguntas) => {
      const idsUsados = seleccion.length === 2 && seleccion.every((pregunta) => pregunta.id.startsWith('corta'))
        ? seleccion.map((pregunta) => pregunta.id)
        : [];
      return {
        pdfBytes: Buffer.alloc(0),
        paginas: [{ numero: 1 }, { numero: 2 }],
        preguntasRestantes: idsUsados.length === 2 ? 0 : seleccion.length,
        mapaOmr: {
          paginas: [{
            numeroPagina: 1,
            preguntas: idsUsados.map((idPregunta) => ({ idPregunta })),
            layoutDebug: { plannedQuestionHeights: alturas }
          }]
        }
      } as never;
    };
    const resultado = await generarExtraordinarioMaximo({
      preguntas,
      paginasObjetivo: 2,
      renderizar
    });
    const idsUsados = resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.idPregunta));
    expect(idsUsados).toEqual(['corta-1', 'corta-2']);
    expect(resultado.paginas).toHaveLength(2);
  });

  it('no vuelve a renderizar el mismo orden compacto al buscar el maximo', async () => {
    const preguntas = ['A', 'B', 'C', 'D'].map((id) => ({
      id,
      enunciado: 'Enunciado del reactivo',
      opciones: [{ texto: 'Opcion de respuesta', esCorrecta: true }]
    }));
    const llamadas: string[][] = [];
    const renderizar = async (seleccion: typeof preguntas) => {
      const idsUsados = seleccion.length <= 2 ? seleccion.map((pregunta) => pregunta.id) : [];
      llamadas.push(seleccion.map((pregunta) => pregunta.id));
      return {
        pdfBytes: Buffer.alloc(0),
        paginas: [{ numero: 1 }, { numero: 2 }],
        preguntasRestantes: idsUsados.length === seleccion.length ? 0 : seleccion.length,
        mapaOmr: {
          paginas: [{
            numeroPagina: 1,
            preguntas: idsUsados.map((idPregunta) => ({ idPregunta })),
            layoutDebug: { plannedQuestionHeights: [] }
          }]
        }
      } as never;
    };

    const resultado = await generarExtraordinarioMaximo({ preguntas, paginasObjetivo: 2, renderizar });

    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.idPregunta))).toHaveLength(2);
    expect(llamadas).toHaveLength(4);
  });

  const preguntasPorEscenario = 20;
  const app = crearApp();

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('excluye de cualquier nueva generación los reactivos DDAW que mencionan Mongo o Mongoose sin alterar fuentes', () => {
    const fuente = [
      {
        _id: 'reactivo-mongo', id: 'reactivo-mongo', versionActual: 1,
        versiones: [{ numeroVersion: 1, enunciado: 'Consulta MongoDB', opciones: [{ texto: 'Mongoose', esCorrecta: true }] }]
      },
      {
        _id: 'reactivo-neutral', id: 'reactivo-neutral', versionActual: 1,
        versiones: [{ numeroVersion: 1, enunciado: 'Consulta HTTP', opciones: [{ texto: 'Express', esCorrecta: true }] }]
      }
    ];

    const resultado = excluirReferenciasTecnologiaRetirada('Diseño y Desarrollo de Aplicaciones Web', fuente);

    expect(resultado.preguntasDb.map((pregunta) => pregunta.id)).toEqual(['reactivo-neutral']);
    expect([...resultado.idsExcluidos]).toEqual(['reactivo-mongo']);
    expect(fuente[0].versiones[0].enunciado).toBe('Consulta MongoDB');
    expect(excluirReferenciasTecnologiaRetirada('Inteligencia de Negocios', fuente).preguntasDb).toBe(fuente);
  });

  it('bloquea reactivos OMR con respuesta incorrecta o opciones genéricas', () => {
    const preguntaBase = {
      id: 'reactivo-invalido',
      versionActual: 1,
      versiones: [{
        numeroVersion: 1,
        enunciado: '¿Qué práctica valida los datos antes de guardarlos?',
        opciones: ['Validar tipo y rango', 'Opción B', 'Opción C', 'Opción D', 'Opción E'].map((texto, indice) => ({
          texto,
          esCorrecta: indice === 0
        }))
      }]
    };

    expect(() => mapearPreguntasBase([preguntaBase])).toThrow(expect.objectContaining({ codigo: 'PLANTILLA_REACTIVOS_OMR_INVALIDOS' }));
    const sinCorrecta = structuredClone(preguntaBase);
    sinCorrecta.versiones[0].opciones.forEach((opcion) => { opcion.esCorrecta = false; });
    expect(() => mapearPreguntasBase([sinCorrecta])).toThrow(expect.objectContaining({ codigo: 'PLANTILLA_REACTIVOS_OMR_INVALIDOS' }));
  });

  it('bloquea plantillas sin materia y preguntas seleccionadas desde el banco de otro periodo', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const docente = await prisma.docente.findUniqueOrThrow({ where: { correo: 'docente@prueba.test' } });
    const crearPeriodo = (nombre: string) => request(app).post('/api/periodos').set(auth).send({
      nombre,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-30'
    }).expect((response) => {
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    });
    const [periodoMateria, periodoAjeno] = await Promise.all([
      crearPeriodo('Materia origen'),
      crearPeriodo('Materia ajena')
    ]);
    const periodoId = String(periodoMateria.body.periodo._id);
    const periodoAjenoId = String(periodoAjeno.body.periodo._id);
    const [preguntaAjenaId] = await crearPreguntasCanonicas(auth, periodoAjenoId, 1);

    await expect(resolverPreguntasPlantilla({
      docenteId: docente.id,
      plantilla: { id: 'plantilla-sin-materia', preguntasIds: [preguntaAjenaId] }
    })).rejects.toMatchObject({ codigo: 'PLANTILLA_INVALIDA' });

    await expect(resolverPreguntasPlantilla({
      docenteId: docente.id,
      plantilla: { id: 'plantilla-materia-origen', periodoId, preguntasIds: [preguntaAjenaId] }
    })).rejects.toMatchObject({ codigo: 'REACTIVOS_FUERA_DEL_BANCO_MATERIA' });
  });

  it('combina reactivos de parciales archivados de la misma materia para un global extraordinario', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const docente = await prisma.docente.findUniqueOrThrow({ where: { correo: 'docente@prueba.test' } });
    const periodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Materia con global extraordinario',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-30'
    }).expect(201);
    const periodoId = String(periodo.body.periodo._id);
    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId, 5);
    const parcialDos = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'parcial', titulo: 'Segundo parcial materia actual', numeroPaginas: 2,
      preguntasIds: preguntasIds.slice(2, 4)
    }).expect((response) => {
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    });
    const parcial = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'parcial', titulo: 'Primer parcial materia actual', numeroPaginas: 2,
      preguntasIds: preguntasIds.slice(0, 2)
    }).expect(201);
    const global = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'global', titulo: 'Global materia actual', numeroPaginas: 4,
      preguntasIds: preguntasIds.slice(4)
    }).expect(201);
    await prisma.examenPlantilla.update({ where: { id: String(parcial.body.plantilla._id) }, data: { archivadoEn: new Date() } });
    await prisma.examenPlantilla.update({ where: { id: String(parcialDos.body.plantilla._id) }, data: { archivadoEn: new Date() } });
    const otroPeriodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Materia ajena al extraordinario', fechaInicio: '2026-01-01', fechaFin: '2026-06-30'
    }).expect(201);
    const preguntasAjena = await crearPreguntasCanonicas(auth, String(otroPeriodo.body.periodo._id), 1);
    const parcialAjeno = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId: String(otroPeriodo.body.periodo._id), tipo: 'parcial', titulo: 'Parcial de otra materia',
      numeroPaginas: 2, preguntasIds: preguntasAjena
    }).expect(201);
    await prisma.examenPlantilla.update({ where: { id: String(parcialAjeno.body.plantilla._id) }, data: { archivadoEn: new Date() } });

    const resultado = await resolverPreguntasExtraordinarioArchivado({
      docenteId: docente.id,
      materiaNombre: 'Inteligencia de Negocios',
      plantilla: {
        id: String(global.body.plantilla._id),
        periodoId,
        tipo: 'global',
        titulo: 'Global materia actual',
        preguntasIds: preguntasIds.slice(4),
        temas: [],
        reactivosObjetivo: 1
      }
    });

    expect(resultado.fuentesExtraordinario).toEqual(expect.arrayContaining(['Primer parcial materia actual', 'Segundo parcial materia actual']));
    expect(resultado.preguntasDb.map((pregunta) => String(pregunta.id))).toEqual(expect.arrayContaining(preguntasIds));
    expect(resultado.preguntasDb.map((pregunta) => String(pregunta.id))).not.toContain(preguntasAjena[0]);
    expect(resultado.fuentesExtraordinario).not.toContain('Parcial de otra materia');
    expect(resultado.totalPreguntasFuente).toBe(5);
    expect(resultado.reactivosOmitidosPorOmr).toEqual([]);
  });

  it('usa la preferencia global por tipo como páginas iniciales de la plantilla', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/autenticacion/preferencias/pdf').set(auth).send({
      paginasPorTipo: { parcial: 2, global: 6, extraordinario: 8 }
    }).expect(200);
    const periodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Preferencia de paginación', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const preguntasIds = await crearPreguntasCanonicas(auth, String(periodo.body.periodo._id), 1);

    const plantilla = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId: String(periodo.body.periodo._id),
      tipo: 'global',
      titulo: 'Global con preferencia de páginas',
      preguntasIds
    }).expect(201);

    expect(plantilla.body.plantilla.numeroPaginas).toBe(6);
    expect(plantilla.body.plantilla.bookletConfig.targetPages).toBe(6);
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

  async function crearPreguntasCanonicas(auth: { Authorization: string }, periodoId: string, total = preguntasPorEscenario) {
    const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: `Flujo de examen ${sufijo}` })
      .expect(201);
    const temaId = String(temaResp.body.tema._id);
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
      items: Array.from({ length: total }, (_, index) => ({
        externalKey: `flujo-examen-${sufijo}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta ${index + 1}` },
        options: [
          `Separar responsabilidades y validar cada dato al recibirlo en la aplicación ${index + 1}.`,
          `Duplicar las mismas reglas de validación dentro de cada pantalla del proyecto ${index + 1}.`,
          `Aceptar cualquier entrada y corregirla después de guardar el estado ${index + 1}.`,
          `Compartir variables globales para omitir contratos entre componentes ${index + 1}.`,
          `Desactivar la validación para acelerar todas las rutas ${index + 1}.`
        ].map((value, optionIndex) => ({
          key: ['A', 'B', 'C', 'D', 'E'][optionIndex],
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
        nombre: 'Diseño y Desarrollo de Aplicaciones Web - periodo vigente',
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
    await prisma.versionPregunta.update({
      where: { preguntaId_numeroVersion: { preguntaId: preguntasIds[0], numeroVersion: 1 } },
      data: { enunciado: 'Reactivo obsoleto sobre MongoDB que debe quedar fuera de toda nueva generación.' }
    });

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

    const preview = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar`)
      .set(auth)
      .expect((response) => { if (response.status !== 200) throw new Error(JSON.stringify(response.body)); });
    expect(preview.body.totalPreguntasOmitidasTecnologiaRetirada).toBe(1);
    expect(preview.body.totalDisponibles).toBe(preguntasPorEscenario - 1);

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
    expect(examenResp.body.examenGenerado.preguntasIds).not.toContain(preguntasIds[0]);
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
    const parcialPdf = await PDFDocument.load(pdfResp.body);
    expect(parcialPdf.getPageCount()).toBe(2);
    expect(parcialPdf.getPages().every((pagina) => pagina.getWidth() === 612 && pagina.getHeight() === 792)).toBe(true);
    const parcialPersistido = await prisma.examenGenerado.findUniqueOrThrow({ where: { id: examenId } });
    expect(JSON.parse(parcialPersistido.mapaOmr).impresion).toMatchObject({ modo: 'duplex', paginasPorHoja: 2 });

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
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set(auth).expect((response) => { if (response.status !== 200) throw new Error(JSON.stringify(response.body)); });

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
      totalReactivos: 2,
      origen: 'inferida manualmente',
      origenEvidencia: { loteId: examen.loteId, folio: examen.folio, documentoSha256: 'a'.repeat(64), criteriosAplicados: 'Cotejo del lote y folio contra el examen.' }
    }).expect(400);
    await request(app).post('/api/calificaciones/calificar').set(auth).send({
      examenGeneradoId: examen.id,
      alumnoId: examen.alumnoId,
      aciertos: 1,
      totalReactivos: 100,
      origen: 'inferida manualmente',
      origenEvidencia: { loteId: examen.loteId, folio: examen.folio, documentoSha256: 'a'.repeat(64), criteriosAplicados: 'Cotejo del lote y folio contra el examen.' }
    }).expect(400);
    await request(app).post('/api/calificaciones/calificar').set(auth).send({
      examenGeneradoId: examen.id,
      alumnoId: examen.alumnoId,
      aciertos: 8,
      totalReactivos: 10,
      origen: 'inferida manualmente',
      origenEvidencia: {
        loteId: 'LOTE-DISTINTO',
        folio: 'FOLIO-DISTINTO',
        documentoSha256: 'a'.repeat(64),
        criteriosAplicados: 'Cotejo manual del lote y folio contra el examen generado.'
      }
    }).expect(409);
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
    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId, 48);
    await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'parcial', titulo: 'Primer parcial Diseño Web', numeroPaginas: 2,
      preguntasIds: preguntasIds.slice(0, 16)
    }).expect((response) => {
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    });
    await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId, tipo: 'parcial', titulo: 'Segundo parcial Diseño Web', numeroPaginas: 2,
      preguntasIds: preguntasIds.slice(16, 32)
    }).expect(201);
    const plantillaResp = await request(app).post('/api/examenes/plantillas').set(auth).send({
      periodoId,
      tipo: 'global',
      titulo: 'Global Diseño Web',
      numeroPaginas: 4,
      preguntasIds: preguntasIds.slice(32)
    }).expect(201);
    const plantillaId = String(plantillaResp.body.plantilla._id);

    await request(app).post(`/api/periodos/${periodoId}/archivar`).set(auth).send({}).expect(200);
    const archivadas = await request(app).get('/api/examenes/plantillas?archivado=true').set(auth).expect(200);
    expect(archivadas.body.plantillas.map((item: { _id: string }) => item._id)).toContain(plantillaId);
    const fuenteAntesPreview = await prisma.examenPlantilla.findUniqueOrThrow({ where: { id: plantillaId } });
    const resumenPreview = await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar`).set(auth).expect((response) => {
      if (response.status !== 200) throw new Error(JSON.stringify(response.body));
    });
    expect(resumenPreview.body.numeroPaginas).toBe(4);
    expect(resumenPreview.body.totalPreguntasFuente).toBe(preguntasIds.length);
    expect(resumenPreview.body.fuentesExtraordinario).toEqual(['Primer parcial Diseño Web', 'Segundo parcial Diseño Web']);
    expect(resumenPreview.body.totalUsados).toBeGreaterThan(0);
    expect(resumenPreview.body.totalUsados).toBeLessThan(preguntasIds.length);
    const fuenteDespuesPreview = await prisma.examenPlantilla.findUniqueOrThrow({ where: { id: plantillaId } });
    expect(fuenteDespuesPreview.bookletConfig).toBe(fuenteAntesPreview.bookletConfig);
    expect(fuenteDespuesPreview.blueprintJson).toBe(fuenteAntesPreview.blueprintJson);
    expect(fuenteDespuesPreview.updatedAt).toEqual(fuenteAntesPreview.updatedAt);

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
    const mapaGenerado = JSON.parse(String(examen.mapaVariante)) as { ordenPreguntas?: string[] };
    expect(mapaGenerado.ordenPreguntas).toHaveLength(resumenPreview.body.totalUsados);
    const idsPreview = (resumenPreview.body.paginas as Array<{ preguntas?: Array<{ id?: string }> }>)
      .flatMap((pagina) => pagina.preguntas?.map((pregunta) => String(pregunta.id ?? '')) ?? [])
      .filter(Boolean);
    const idsGenerados = mapaGenerado.ordenPreguntas ?? [];
    expect(new Set(idsPreview).size).toBe(idsPreview.length);
    expect([...idsGenerados].sort()).toEqual([...idsPreview].sort());
    const pdf = await request(app).get(`/api/examenes/generados/lote/${loteId}/pdf`).set(auth).expect(200);
    expect(pdf.header['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await PDFDocument.load(pdf.body)).getPageCount()).toBe(4);

    expect((await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } })).activo).toBe(false);
    expect((await prisma.alumno.findUniqueOrThrow({ where: { id: alumnoId } })).activo).toBe(false);
    expect((await prisma.bancoPregunta.findMany({ where: { periodoId } })).every((pregunta) => pregunta.activo === false)).toBe(true);
    expect((await prisma.examenPlantilla.findUniqueOrThrow({ where: { id: plantillaId } })).archivadoEn).not.toBeNull();
  }, 240_000);

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
