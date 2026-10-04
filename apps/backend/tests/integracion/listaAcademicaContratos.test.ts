/**
 * listaAcademicaContratos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app.js';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente.js';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';
import { prepararEscenarioFlujo, registrarDocente } from './_flujoDocenteHelper.js';

function parsearBinario(res: NodeJS.ReadableStream & { setEncoding: (encoding: string) => void }, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('contratos de seguridad y observabilidad de lista academica', () => {
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

  it('requiere permiso analiticas:leer y periodoId para exportar', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-contrato-lista@prueba.test');
    const docenteSinPermisos = await Docente.create({
      nombreCompleto: 'Gestor Comercial Lista',
      correo: 'gestor-comercial-lista@prueba.test',
      roles: ['gestor_comercial'],
      activo: true
    });

    const tokenSinPermisos = crearTokenDocente({
      docenteId: String(docenteSinPermisos._id),
      roles: ['gestor_comercial']
    });

    await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set({ Authorization: `Bearer ${tokenSinPermisos}` })
      .expect(403);

    await request(app).get('/api/analiticas/lista-academica-csv').set(escenario.auth).expect(400);
    await request(app).get('/api/analiticas/lista-academica-docx').set(escenario.auth).expect(400);
    await request(app).get('/api/analiticas/lista-academica-firma').set(escenario.auth).expect(400);
    await request(app).get('/api/analiticas/lista-academica').set(escenario.auth).expect(400);
  });

  it('publica contadores de exportacion en /api/metrics', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-metricas-lista@prueba.test');

    await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);

    const consulta = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(Array.isArray(consulta.body?.filas)).toBe(true);

    await request(app)
      .get(`/api/analiticas/lista-academica-docx?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);

    await request(app)
      .get(`/api/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);

    const metricas = await request(app).get('/api/metrics').expect(200);
    const cuerpo = String(metricas.text ?? '');
    expect(cuerpo).toContain('evaluapro_lista_export_csv_total');
    expect(cuerpo).toContain('evaluapro_lista_export_docx_total');
    expect(cuerpo).toContain('evaluapro_lista_export_firma_total');
    expect(cuerpo).toContain('evaluapro_lista_export_error_total');
  });

  it('permite consultar la lista de un periodo archivado sin reactivarlo', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-lista-archivada@prueba.test');
    await request(app)
      .post(`/api/periodos/${encodeURIComponent(escenario.periodoId)}/archivar`)
      .set(escenario.auth)
      .send({})
      .expect(200);

    await request(app)
      .post('/api/analiticas/lista-academica/calificaciones')
      .set(escenario.auth)
      .send({
        periodoId: escenario.periodoId,
        alumnoId: escenario.alumnoId,
        componente: 'Practica 2do Parcial',
        calificacion: 7.5,
        clientRequestId: '40e93b0e-4803-4728-a940-e2f1e66f8cbe'
      })
      .expect(201);

    const archivados = await request(app).get('/api/periodos?activo=false').set(escenario.auth).expect(200);
    expect(archivados.body.periodos.map((periodo: { _id: string }) => periodo._id)).toContain(escenario.periodoId);

    const consulta = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(consulta.body.filas.map((fila: { alumnoId: string }) => fila.alumnoId)).toContain(escenario.alumnoId);
    expect(consulta.body.filas).toHaveLength(1);
    expect(consulta.body.filas[0].practica2doParcial).toBe('7.5');

    const tokenOtroDocente = await registrarDocente(app, 'docente-ajeno-lista-archivada@prueba.test');
    const consultaAjena = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set({ Authorization: `Bearer ${tokenOtroDocente}` })
      .expect(200);
    expect(consultaAjena.body.filas).toHaveLength(0);

    const activos = await request(app).get('/api/periodos?activo=true').set(escenario.auth).expect(200);
    expect(activos.body.periodos.map((periodo: { _id: string }) => periodo._id)).not.toContain(escenario.periodoId);
  });

  it('captura y modifica las columnas manuales por API y conserva versiones y escalas físicas', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-lista-fisica@prueba.test');
    const ruta = '/api/analiticas/lista-academica/calificaciones';
    const clientRequestIdAlta = 'e919a2f1-2de4-4c4a-b21a-d9271a252e3d';
    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial', calificacion: 7.5,
      clientRequestId: 'not-a-uuid'
    }).expect(400);
    const creada = await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial',
      calificacion: 7.5,
      clientRequestId: clientRequestIdAlta
    }).expect(201);
    expect(creada.body.calificacion).toMatchObject({ calificacion: 7.5, version: 1 });
    const altaRepetida = await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial', calificacion: 7.5,
      clientRequestId: clientRequestIdAlta
    }).expect(200);
    expect(altaRepetida.body).toMatchObject({ repetida: true, calificacion: { calificacion: 7.5, version: 1 } });

    const clientRequestIdCambio = 'a359e1ab-bce1-4e3a-95d2-6c0f91c7d7f9';
    const actualizada = await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial',
      calificacion: 8,
      version: 1,
      clientRequestId: clientRequestIdCambio
    }).expect(200);
    expect(actualizada.body.calificacion).toMatchObject({ calificacion: 8, version: 2 });
    const cambioRepetido = await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial', calificacion: 8, version: 1,
      clientRequestId: clientRequestIdCambio
    }).expect(200);
    expect(cambioRepetido.body).toMatchObject({ repetida: true, calificacion: { calificacion: 8, version: 2 } });
    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial', calificacion: 8.1, version: 1,
      clientRequestId: clientRequestIdCambio
    }).expect(409);

    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Exámen 2do Parcial',
      calificacion: 5.26,
      clientRequestId: 'f90c2856-0ea3-4a75-b37d-9af4b8676e75'
    }).expect(400);
    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Practica 2do Parcial',
      calificacion: 6,
      version: 1,
      clientRequestId: '026afbdd-306b-487d-a6af-6cbf7a7b98df'
    }).expect(409);
    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Exámen Global',
      calificacion: 4.5
    }).expect(400);

    const consulta = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(consulta.body.filas).toEqual(expect.arrayContaining([
      expect.objectContaining({ alumnoId: escenario.alumnoId, practica2doParcial: '8', practica2doParcialVersion: 2 })
    ]));
  });

  it('captura Exámen Global manual en escala física sin crear desglose teórico/práctico', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-global-manual-lista@prueba.test');
    const ruta = '/api/analiticas/lista-academica/calificaciones';
    await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Exámen Global',
      calificacion: 5.01,
      clientRequestId: 'fd6a22f0-20d5-4355-a7a5-e30b3259c710'
    }).expect(400);

    const alta = await request(app).post(ruta).set(escenario.auth).send({
      periodoId: escenario.periodoId,
      alumnoId: escenario.alumnoId,
      componente: 'Exámen Global',
      calificacion: 4.5,
      clientRequestId: '18764893-3262-4fb1-a521-081e23dd09d8'
    }).expect(201);
    expect(alta.body.calificacion).toMatchObject({ componente: 'Exámen Global', calificacion: 4.5, version: 1 });

    const consulta = await request(app)
      .get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(consulta.body.filas).toEqual(expect.arrayContaining([
      expect.objectContaining({ alumnoId: escenario.alumnoId, examenGlobalComponente: '', examenGlobalLista: '4.5', examenGlobalListaVersion: 1 })
    ]));
  });

  it('previsualiza el bono sin escribir y lo guarda de forma versionada por API', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-bono-lista@prueba.test');
    const rutaPreview = '/api/analiticas/lista-academica/bono/preview';
    const rutaGuardar = '/api/analiticas/lista-academica/calificaciones';
    const previa = await request(app).post(rutaPreview).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId, bono: 0.5
    }).expect(200);
    expect(previa.body.preview).toMatchObject({
      alumnoId: escenario.alumnoId, bonoSolicitado: '0.5', regla: 'continua-primero; global-c3, p2, p1',
      escalaMaxima: 10, requiereConfirmacion: true,
      bonoDistribucion: {
        continuaGlobal: 0, examenGlobal: 0,
        continuaParcial2: 0, examenParcial2: 0,
        continuaParcial1: 0, examenParcial1: 0
      }
    });

    const listaSinEscritura = await request(app).get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth).expect(200);
    const filaSinEscritura = listaSinEscritura.body.filas.find((fila: { alumnoId: string }) => fila.alumnoId === escenario.alumnoId);
    expect(filaSinEscritura.bonoExtracurricularSolicitado).toBe('0');

    const clientRequestId = 'c0f79945-9c65-4599-b36a-a23cd9c08ec2';
    const guardado = await request(app).post(rutaGuardar).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId, componente: 'Bono extracurricular',
      calificacion: 0.5, clientRequestId
    }).expect(201);
    expect(guardado.body.calificacion).toMatchObject({ calificacion: 0.5, version: 1 });
    const repetida = await request(app).post(rutaGuardar).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId, componente: 'Bono extracurricular',
      calificacion: 0.5, clientRequestId
    }).expect(200);
    expect(repetida.body).toMatchObject({ repetida: true, calificacion: { calificacion: 0.5, version: 1 } });
    await request(app).post(rutaGuardar).set(escenario.auth).send({
      periodoId: escenario.periodoId, alumnoId: escenario.alumnoId, componente: 'Bono extracurricular',
      calificacion: 0.75, clientRequestId
    }).expect(409);

    const consulta = await request(app).get(`/api/analiticas/lista-academica?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth).expect(200);
    expect(consulta.body.filas).toEqual(expect.arrayContaining([
      expect.objectContaining({ alumnoId: escenario.alumnoId, bonoExtracurricularSolicitado: '0.5', bonoExtracurricularVersion: 1 })
    ]));
  });

  it('no expone token o secretos en logs durante exportacion', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-seguridad-lista@prueba.test');
    const token = escenario.token;
    const espiaLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const espiaWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const espiaError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let lineas: string;
    try {
      await request(app)
        .get(`/api/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(escenario.periodoId)}`)
        .set(escenario.auth)
        .expect(200);
      lineas = [...espiaLog.mock.calls, ...espiaWarn.mock.calls, ...espiaError.mock.calls]
        .flat()
        .map((item) => String(item ?? ''))
        .join('\n');
    } finally {
      espiaLog.mockRestore();
      espiaWarn.mockRestore();
      espiaError.mockRestore();
    }
    expect(lineas).not.toContain(token);
    if (process.env.JWT_SECRETO) {
      expect(lineas).not.toContain(process.env.JWT_SECRETO);
    }
  });
});
