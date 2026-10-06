/**
 * evaluaciones.modulo.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente.js';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens.js';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno.js';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('módulo evaluaciones (LISC)', () => {
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

  async function crearContexto() {
    const docente = await Docente.create({
      _id: '507f1f77bcf86cd799439500',
      nombreCompleto: 'Docente Evaluaciones',
      correo: 'evaluaciones@test.com',
      roles: ['docente'],
      activo: true
    });

    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439501',
      docenteId: docente._id,
      nombre: 'Lógica de Programación',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });

    const alumno = await Alumno.create({
      _id: '507f1f77bcf86cd799439502',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Lisc'
    });

    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    const auth = { Authorization: `Bearer ${token}` };

    return { docente, periodo, alumno, auth };
  }

  it('rechaza vincular un examen fuente inexistente al componente global', async () => {
    const { periodo, alumno, auth } = await crearContexto();
    const respuesta = await request(app)
      .post('/api/evaluaciones/v2/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'global',
        teoricoDecimal: 8,
        practicas: [9],
        examenGeneradoId: '507f1f77bcf86cd7994395ff'
      })
      .expect(409);
    expect(respuesta.body.error.codigo).toBe('EXAMEN_FUENTE_INCOMPATIBLE');
  });

  it('guarda el Global con un examen fuente vigente del mismo periodo', async () => {
    const { periodo, alumno, auth } = await crearContexto();
    const periodoDb = await prisma.periodo.findUniqueOrThrow({ where: { id: String(periodo._id) }, select: { docenteId: true } });
    const plantilla = await prisma.examenPlantilla.create({
      data: {
        docenteId: periodoDb.docenteId,
        periodoId: String(periodo._id),
        tipo: 'global',
        titulo: 'Global fuente de prueba',
        tituloNormalizado: 'global fuente de prueba',
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}'
      }
    });
    const examenFuente = await prisma.examenGenerado.create({
      data: {
        docenteId: periodoDb.docenteId,
        periodoId: String(periodo._id),
        plantillaId: plantilla.id,
        alumnoId: null,
        folio: 'GLOBAL-FUENTE-001',
        mapaVariante: '{}'
      }
    });
    const respuesta = await request(app)
      .post('/api/evaluaciones/v2/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'global',
        teoricoDecimal: 8,
        practicas: [9],
        examenGeneradoId: examenFuente.id
      })
      .expect(201);

    expect(respuesta.body.componente.examenGeneradoId).toBe(examenFuente.id);
  });

  it('calcula resumen por política LISC usando evidencias y componentes', async () => {
    const { periodo, alumno, auth } = await crearContexto();

    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        cortes: [
          { numero: 1, nombre: 'C1', fechaCorte: '2026-01-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 2, nombre: 'C2', fechaCorte: '2026-02-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 3, nombre: 'C3', fechaCorte: '2026-03-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.6 }
        ],
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 }
      })
      .expect(200);

    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E01',
        calificacionDecimal: 8,
        ponderacion: 1,
        fechaEvidencia: '2026-01-10T00:00:00.000Z'
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E02',
        calificacionDecimal: 9,
        ponderacion: 1,
        fechaEvidencia: '2026-02-10T00:00:00.000Z'
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E03',
        calificacionDecimal: 10,
        ponderacion: 1,
        fechaEvidencia: '2026-01-12T00:00:00.000Z',
        corte: 3
      })
      .expect(201);

    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial1',
        teoricoDecimal: 8,
        practicas: [8]
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial2',
        teoricoDecimal: 9,
        practicas: [7, 9]
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'global',
        teoricoDecimal: 10,
        practicas: [10]
      })
      .expect(201);

    const respuesta = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    const resumen = respuesta.body?.resumen;
    expect(resumen).toBeTruthy();
    expect(resumen.politicaCodigo).toBe('POLICY_LISC_ENCUADRE_2026');
    expect(resumen.continuaPorCorte).toEqual({ c1: 8, c2: 8.5, c3: 9 });
    expect(Number(resumen.bloqueContinuaDecimal)).toBeCloseTo(8.7, 4);
    expect(Number(resumen.bloqueExamenesDecimal)).toBeCloseTo(9.32, 4);
    expect(Number(resumen.finalDecimal)).toBeCloseTo(9.01, 4);
    expect(Number(resumen.finalRedondeada)).toBe(9);
    expect(resumen.estado).toBe('completo');
  });

  it('no marca faltante cuando la calificación del examen es 0 si el componente existe', async () => {
    const { periodo, alumno, auth } = await crearContexto();

    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
        reglasCierre: { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: false, continuaMinima: 0 }
      })
      .expect(200);

    for (const corte of ['parcial1', 'parcial2', 'global']) {
      await request(app)
        .post('/api/evaluaciones/examenes/componentes')
        .set(auth)
        .send({
          periodoId: String(periodo._id),
          alumnoId: String(alumno._id),
          corte,
          teoricoDecimal: 0,
          practicas: [0]
        })
        .expect(201);
    }

    const respuesta = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    const resumen = respuesta.body?.resumen;
    expect(resumen.estado).toBe('completo');
    expect(Array.isArray(resumen.faltantes) ? resumen.faltantes.length : -1).toBe(0);
    expect(Number(resumen.finalDecimal)).toBe(0);
    expect(Number(resumen.finalRedondeada)).toBe(0);
  });

  it('marca incompleto cuando falta componente práctico requerido por corte', async () => {
    const { periodo, alumno, auth } = await crearContexto();

    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
        reglasCierre: { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: false, continuaMinima: 0 }
      })
      .expect(200);

    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial1',
        teoricoDecimal: 8,
        practicas: []
      })
      .expect(201);

    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial2',
        teoricoDecimal: 8,
        practicas: [8]
      })
      .expect(201);

    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'global',
        teoricoDecimal: 8,
        practicas: [8]
      })
      .expect(201);

    const respuesta = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    const resumen = respuesta.body?.resumen;
    expect(resumen.estado).toBe('incompleto');
    expect(Array.isArray(resumen.faltantes)).toBe(true);
    expect(resumen.faltantes).toContain('examen.parcial1.practica');
  });

  it('marca faltantes de continua minima cuando la regla esta activa', async () => {
    const { periodo, alumno, auth } = await crearContexto();

    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        cortes: [
          { numero: 1, nombre: 'C1', fechaCorte: '2026-01-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 2, nombre: 'C2', fechaCorte: '2026-02-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 3, nombre: 'C3', fechaCorte: '2026-03-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.6 }
        ],
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
        reglasCierre: { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: true, continuaMinima: 6 }
      })
      .expect(200);

    for (const fecha of ['2026-01-10T00:00:00.000Z', '2026-02-10T00:00:00.000Z', '2026-03-10T00:00:00.000Z']) {
      await request(app)
        .post('/api/evaluaciones/evidencias')
        .set(auth)
        .send({
          periodoId: String(periodo._id),
          alumnoId: String(alumno._id),
          titulo: `E-${fecha}`,
          calificacionDecimal: 5,
          ponderacion: 1,
          fechaEvidencia: fecha
        })
        .expect(201);
    }

    for (const corte of ['parcial1', 'parcial2', 'global']) {
      await request(app)
        .post('/api/evaluaciones/examenes/componentes')
        .set(auth)
        .send({
          periodoId: String(periodo._id),
          alumnoId: String(alumno._id),
          corte,
          teoricoDecimal: 8,
          practicas: [8]
        })
        .expect(201);
    }

    const respuesta = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    const resumen = respuesta.body?.resumen;
    expect(resumen.estado).toBe('incompleto');
    expect(resumen.faltantes).toContain('continua.c1.minima');
    expect(resumen.faltantes).toContain('continua.c2.minima');
    expect(resumen.faltantes).toContain('continua.c3.minima');
  });

  it('crea políticas por docente, versiona cambios y aplica los pesos elegidos al cálculo', async () => {
    const { periodo, alumno, auth } = await crearContexto();
    const politicaBase = {
      codigo: 'POLICY_PRUEBA_DOCENTE',
      familia: 'lisc_encuadre',
      nombre: 'Política de prueba',
      descripcion: 'Verifica pesos por versión',
      parametros: {
        pesosGlobales: { continua: 0, examenes: 1 },
        pesosExamenes: { parcial1: 0.3, parcial2: 0.3, global: 0.4 },
        pesosContinuaCortes: { c1: 0.2, c2: 0.2, c3: 0.6 },
        pesosComponentesExamen: { teorico: 0.6, practicas: 0.4 },
        umbralAprobacion: 6
      },
      clientRequestId: '38b4324c-e4ef-41a6-9f6d-4934d3e31001'
    };

    const creada = await request(app).post('/api/evaluaciones/politicas').set(auth).send(politicaBase).expect(201);
    expect(creada.body.politica.version).toBe(1);
    await request(app).post('/api/evaluaciones/politicas').set(auth).send(politicaBase).expect(200);
    await request(app).post('/api/evaluaciones/politicas').set(auth).send({
      ...politicaBase,
      nombre: 'Contenido distinto con la misma clave'
    }).expect(409);
    const auditoriaCreacion = await request(app)
      .get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/auditoria`)
      .set(auth).expect(200);
    expect(auditoriaCreacion.body.eventos).toHaveLength(1);
    expect(auditoriaCreacion.body.eventos[0]).toMatchObject({
      accion: 'crear', version: 1, clientRequestId: politicaBase.clientRequestId, antes: null
    });
    const lista = await request(app).get('/api/evaluaciones/politicas').set(auth).expect(200);
    expect(lista.body.politicas.some((item: any) => item.codigo === politicaBase.codigo && item.version === 1)).toBe(true);

    await request(app).post('/api/evaluaciones/configuracion-periodo').set(auth).send({
      periodoId: String(periodo._id),
      politicaCodigo: politicaBase.codigo,
      politicaVersion: 1
    }).expect(200);

    for (const [corte, teorico] of [['parcial1', 4], ['parcial2', 6], ['global', 10]] as const) {
      await request(app).post('/api/evaluaciones/examenes/componentes').set(auth).send({
        periodoId: String(periodo._id), alumnoId: String(alumno._id), corte, teoricoDecimal: teorico, practicas: [teorico]
      }).expect(201);
    }
    const calculoV1 = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth).expect(200);
    expect(Number(calculoV1.body.resumen.finalDecimal)).toBeCloseTo(7, 4);
    expect(calculoV1.body.resumen.auditoria.politicaVersion).toBe(1);
    expect(calculoV1.body.resumen.auditoria.politicaId).toBe(creada.body.politica.id);
    expect(calculoV1.body.resumen.auditoria.parametros.pesosGlobales).toEqual({ continua: 0, examenes: 1 });

    const politicaV2 = {
      ...politicaBase,
      nombre: 'Política de prueba v2',
      parametros: { ...politicaBase.parametros, pesosGlobales: { continua: 1, examenes: 0 } },
      clientRequestId: '38b4324c-e4ef-41a6-9f6d-4934d3e31002'
    };
    const versionada = await request(app)
      .put(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}`).set(auth).send(politicaV2).expect(201);
    expect(versionada.body.politica.version).toBe(2);

    const calculoPersistenteV1 = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth).expect(200);
    expect(Number(calculoPersistenteV1.body.resumen.finalDecimal)).toBeCloseTo(7, 4);

    await request(app).post('/api/evaluaciones/configuracion-periodo').set(auth).send({
      periodoId: String(periodo._id), politicaCodigo: politicaBase.codigo, politicaVersion: 2
    }).expect(200);
    const calculoV2 = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth).expect(200);
    expect(Number(calculoV2.body.resumen.finalDecimal)).toBe(0);
    expect(calculoV2.body.resumen.auditoria.politicaVersion).toBe(2);

    const requestArchivo = '830e66e4-9c89-40e1-a8f0-d6fec747664a';
    const archivo = await request(app)
      .post(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/archivar`)
      .set(auth)
      .send({ motivo: 'Reemplazada por una regla vigente', clientRequestId: requestArchivo, confirmarEliminacion: true })
      .expect(200);
    expect(archivo.body.politica).toMatchObject({ version: 3, activa: false });
    await request(app)
      .post(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/archivar`)
      .set(auth)
      .send({ motivo: 'Reemplazada por una regla vigente', clientRequestId: requestArchivo, confirmarEliminacion: true })
      .expect(200);
    const archivoConOtraClave = await request(app)
      .post(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/archivar`)
      .set(auth)
      .send({ motivo: 'Reemplazada por una regla vigente', clientRequestId: '8f947d40-17a0-4628-81f6-a687badacfd5', confirmarEliminacion: true })
      .expect(409);
    expect(archivoConOtraClave.body.error.codigo).toBe('POLITICA_ARCHIVADA');

    const auditoriaPrimera = await request(app)
      .get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/auditoria?limite=2`)
      .set(auth).expect(200);
    expect(auditoriaPrimera.body.eventos.map((evento: any) => evento.accion)).toEqual(['archivar', 'versionar']);
    expect(auditoriaPrimera.body.eventos[0]).toMatchObject({
      version: 3, motivo: 'Reemplazada por una regla vigente', clientRequestId: requestArchivo,
      antes: expect.objectContaining({ version: 2, activa: true }),
      despues: expect.objectContaining({ version: 3, activa: false })
    });
    expect(auditoriaPrimera.body.nextCursor).toEqual(expect.any(String));
    const auditoriaSiguiente = await request(app)
      .get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/auditoria?limite=2&cursor=${encodeURIComponent(auditoriaPrimera.body.nextCursor)}`)
      .set(auth).expect(200);
    expect(auditoriaSiguiente.body.eventos.map((evento: any) => evento.accion)).toEqual(['crear']);
    const cursorInvalido = await request(app)
      .get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/auditoria?cursor=not-json`)
      .set(auth).expect(400);
    expect(cursorInvalido.body.error.codigo).toBe('CURSOR_INVALIDO');
    await request(app).post('/api/evaluaciones/configuracion-periodo').set(auth).send({
      periodoId: String(periodo._id), politicaCodigo: politicaBase.codigo, politicaVersion: 3
    }).expect(409);

    const segundoDocente = await Docente.create({
      _id: '507f1f77bcf86cd799439510', nombreCompleto: 'Otro docente', correo: 'otro-evaluaciones@test.com', roles: ['docente'], activo: true
    });
    const authOtro = { Authorization: `Bearer ${crearTokenDocente({ docenteId: String(segundoDocente._id), roles: ['docente'] })}` };
    await request(app).get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}?version=1`).set(authOtro).expect(404);
    const auditoriaOtro = await request(app)
      .get(`/api/evaluaciones/politicas/${encodeURIComponent(politicaBase.codigo)}/auditoria`).set(authOtro).expect(200);
    expect(auditoriaOtro.body.eventos).toEqual([]);
  });

  describe('política de cuarentena OMR (SPEC-OMR-CUARENTENA-RETENCION)', () => {
    it('clasifica capturas OMR inestables en cuarentena y prohíbe autocalificación', async () => {
      const { evaluarAutoCalificableOmr } = await import('../../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');

      // REQ-001: Baja confianza (0.25 <= 0.30) fuerza hardStop y autocalificableOmr = false
      const bajaConfianza = evaluarAutoCalificableOmr({
        estadoAnalisis: 'ok',
        calidadPagina: 0.8,
        confianzaPromedioPagina: 0.25,
        ratioAmbiguas: 0.1,
        coberturaDeteccion: 0.9
      });
      expect(bajaConfianza.hardStop).toBe(true);
      expect(bajaConfianza.autoCalificableOmr).toBe(false);

      // REQ-001: Ratio de ambiguas alto (0.90 >= 0.85) fuerza hardStop y autocalificableOmr = false
      const altaAmbiguedad = evaluarAutoCalificableOmr({
        estadoAnalisis: 'ok',
        calidadPagina: 0.8,
        confianzaPromedioPagina: 0.8,
        ratioAmbiguas: 0.9,
        coberturaDeteccion: 0.9
      });
      expect(altaAmbiguedad.hardStop).toBe(true);
      expect(altaAmbiguedad.autoCalificableOmr).toBe(false);

      // REQ-001: Rechazado por calidad fuerza hardStop
      const rechazadoCalidad = evaluarAutoCalificableOmr({
        estadoAnalisis: 'rechazado_calidad',
        calidadPagina: 0.3,
        confianzaPromedioPagina: 0.7,
        ratioAmbiguas: 0.1,
        coberturaDeteccion: 0.8
      });
      expect(rechazadoCalidad.hardStop).toBe(true);
      expect(rechazadoCalidad.autoCalificableOmr).toBe(false);
    });
  });
});
