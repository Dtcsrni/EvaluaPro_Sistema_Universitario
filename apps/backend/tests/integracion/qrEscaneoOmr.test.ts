/**
 * qrEscaneoOmr.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de escaneo QR asociado a un examen generado (OMR).
import request from 'supertest';
import QRCode from 'qrcode';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { extraerResumenQrExamen } from '../../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

function invalidarFirmaQr(textoQr: string) {
  return String(textoQr).replace(/:SG:[A-Z0-9]+$/i, ':SG:H1AAAAAAAAAAAAAAAAAAAAAAAA');
}

describe('escaneo OMR: QR asociado a examen', () => {
  const app = crearApp();
  const TEST_TIMEOUT_QR_MS = 60_000;
  const QR_IMAGE_WIDTH = 512;

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

  async function prepararExamenBasico(auth: { Authorization: string }) {
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

    const preguntasIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const preguntaResp = await request(app)
        .post('/api/banco-preguntas')
        .set(auth)
        .send({
          periodoId,
          enunciado: `Pregunta ${i + 1}`,
          opciones: [
            { texto: 'Opcion A', esCorrecta: true },
            { texto: 'Opcion B', esCorrecta: false },
            { texto: 'Opcion C', esCorrecta: false },
            { texto: 'Opcion D', esCorrecta: false },
            { texto: 'Opcion E', esCorrecta: false }
          ]
        })
        .expect(201);
      preguntasIds.push(preguntaResp.body.pregunta._id as string);
    }

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId })
      .expect(201);

    const examenId = examenResp.body.examenGenerado._id as string;
    const folio = examenResp.body.examenGenerado.folio as string;
    const paginas = examenResp.body.examenGenerado.paginas as Array<{ numero: number; qrTexto: string }>;

    return { periodoId, alumnoId, examenId, folio, paginas };
  }

  it('lee el QR esperado de una imagen y lo asocia al folio/pagina', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const { folio, paginas } = await prepararExamenBasico(auth);

    expect(Array.isArray(paginas)).toBe(true);
    expect(paginas.length).toBeGreaterThan(0);
    expect(paginas[0].numero).toBe(1);

    const qrEsperado = `EXAMEN:${folio}:P1:TV4`;
    const resumenQr = extraerResumenQrExamen(String(paginas[0].qrTexto || ''));
    expect(resumenQr).not.toBeNull();
    expect(resumenQr?.folio).toBe(folio);
    expect(resumenQr?.numeroPagina).toBe(1);
    expect(resumenQr?.templateVersion).toBe(4);
    expect(resumenQr?.keyId).toBeTruthy();
    expect(resumenQr?.variantHash).toBeTruthy();
    expect(resumenQr?.answerKeyHash).toBeTruthy();
    expect(resumenQr?.payloadSignature).toBeTruthy();
    expect((resumenQr?.questionRefs ?? []).length).toBeGreaterThan(0);
    expect((resumenQr?.optionOrders ?? []).length).toBeGreaterThan(0);

    const qrParaImagen = String(paginas[0].qrTexto || qrEsperado);
    const imagenBase64 = await QRCode.toDataURL(qrParaImagen, { margin: 1, width: QR_IMAGE_WIDTH });

    const resp = await request(app)
      .post('/api/omr/analizar')
      .set(auth)
      .send({
        folio,
        numeroPagina: 1,
        imagenBase64
      })
      .expect(200);

    const resultado = resp.body.resultado as {
      qrTexto?: string;
      advertencias: string[];
      engineVersion?: string;
      geomQuality?: number;
      photoQuality?: number;
      decisionPolicy?: string;
      motivosRevision?: string[];
    };
    expect(resultado.qrTexto).toBe(qrParaImagen);
    expect(resultado.advertencias).not.toContain('No se detecto QR en la imagen');
    expect(Array.isArray(resultado.advertencias)).toBe(true);
    expect(resultado.engineVersion).toBeDefined();
    expect(typeof resultado.geomQuality).toBe('number');
    expect(typeof resultado.photoQuality).toBe('number');
    expect(typeof resultado.decisionPolicy).toBe('string');
    expect(Array.isArray(resultado.motivosRevision)).toBe(true);
  }, TEST_TIMEOUT_QR_MS);

  it('si el QR corresponde a otro folio, lo detecta y advierte mismatch', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const { folio } = await prepararExamenBasico(auth);

    const qrIncorrecto = 'OTROFOLIO';
    const imagenBase64 = await QRCode.toDataURL(qrIncorrecto, { margin: 1, width: QR_IMAGE_WIDTH });

    const resp = await request(app)
      .post('/api/omr/analizar')
      .set(auth)
      .send({
        folio,
        numeroPagina: 1,
        imagenBase64
      })
      .expect(200);

    const resultado = resp.body.resultado as { qrTexto?: string; advertencias: string[] };
    expect(resultado.qrTexto).toBe(qrIncorrecto);
    expect(resultado.advertencias).toContain('El QR no coincide con el examen esperado');
  }, TEST_TIMEOUT_QR_MS);

  it('rechaza un QR con firma de integridad invalida', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const { folio, paginas } = await prepararExamenBasico(auth);
    const qrManipulado = invalidarFirmaQr(String(paginas[0]?.qrTexto ?? ''));
    const imagenBase64 = await QRCode.toDataURL(qrManipulado, { margin: 1, width: QR_IMAGE_WIDTH });

    const resp = await request(app)
      .post('/api/omr/analizar')
      .set(auth)
      .send({
        folio,
        numeroPagina: 1,
        imagenBase64
      })
      .expect(409);

    expect(resp.body.error.codigo).toBe('OMR_QR_FIRMA_INVALIDA');
  }, TEST_TIMEOUT_QR_MS);
});

