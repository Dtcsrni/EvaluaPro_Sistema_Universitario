/**
 * qr.examen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import QRCode from 'qrcode';
import { configuracion } from '../src/configuracion.js';
import { construirTextoQrExamenPagina, extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';

function construirQrCompactoHistorico() {
  const keyId = String(configuracion.omrQrHmacKeyId).trim().toUpperCase().slice(0, 20);
  const clavePagina = 'ABC';
  const bitsClave = Buffer.alloc(Math.ceil(clavePagina.length * 3 / 8));
  for (let indice = 0; indice < clavePagina.length; indice += 1) {
    const codigo = clavePagina.charCodeAt(indice) - 65;
    const bitInicial = indice * 3;
    for (let bit = 0; bit < 3; bit += 1) {
      if (codigo & (1 << (2 - bit))) {
        const posicion = bitInicial + bit;
        bitsClave[Math.floor(posicion / 8)] |= 1 << (7 - (posicion % 8));
      }
    }
  }
  const compacto = Buffer.concat([
    Buffer.from([1, Buffer.byteLength(keyId)]),
    Buffer.from(keyId, 'ascii'),
    Buffer.from('001122334455', 'hex'),
    Buffer.from('AABBCCDDEEFF', 'hex'),
    Buffer.from([clavePagina.length]),
    bitsClave
  ]).toString('base64url');
  const firmado = `EXAMEN:FOLIO-OLD:P1:TV4:C:${compacto}`;
  const secreto = configuracion.omrQrHmacSecrets[keyId] ?? configuracion.omrQrHmacSecret;
  const firma = createHmac('sha256', secreto).update(firmado).digest('hex').slice(0, 24).toUpperCase();
  return `${firmado}:SG:H1${firma}`;
}

describe('qr examen enriquecido', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('verifica QR históricos con su clave OMR aunque el JWT actual haya rotado', async () => {
    const variables = [
      'NODE_ENV',
      'EVALUAPRO_FLAVOR',
      'CORS_ORIGENES',
      'PORTAL_SYNC_REQUIRED',
      'PORTAL_ALUMNO_URL',
      'PORTAL_ALUMNO_API_KEY',
      'JWT_SECRETO',
      'OMR_QR_HMAC_KEY_ID',
      'OMR_QR_HMAC_SECRET',
      'OMR_QR_HMAC_SECRETS_JSON',
      'OMR_QR_RECOVERY_KEY_ID',
      'OMR_QR_RECOVERY_SECRET',
      'OMR_QR_RECOVERY_SECRETS_JSON'
    ] as const;
    const anteriores = new Map(variables.map((key) => [key, process.env[key] ?? null]));
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRETO = 'jwt-rotado-en-la-actualizacion';
    process.env.OMR_QR_HMAC_KEY_ID = 'qr-h1-v2';
    process.env.OMR_QR_HMAC_SECRET = 'clave-omr-v2-independiente';
    process.env.OMR_QR_HMAC_SECRETS_JSON = JSON.stringify({
      'qr-h1-v1': 'clave-omr-v1-historica',
      'qr-h1-v2': 'clave-omr-v2-independiente'
    });
    vi.resetModules();

    try {
      const { extraerResumenQrExamen } = await import('../src/modulos/modulo_generacion_pdf/domain/qrExamen.js');
      const identidad = 'EXAMEN:FOLIO-ANTERIOR:P1:TV4';
      const segmentos = `${identidad}:LI:LOTE-ANTERIOR:KI:QR-H1-V1`;
      const firma = createHmac('sha256', 'clave-omr-v1-historica')
        .update(segmentos)
        .digest('hex')
        .slice(0, 24)
        .toUpperCase();
      const qr = `${segmentos}:SG:H1${firma}`;

      expect(extraerResumenQrExamen(qr)).toMatchObject({
        keyId: 'QR-H1-V1',
        payloadSignatureMode: 'hmac-v1',
        payloadSignatureValid: true
      });
    } finally {
      for (const [key, value] of anteriores) {
        if (value === null) delete process.env[key];
        else process.env[key] = value;
      }
      vi.resetModules();
    }
  });

  it('no firma QR de producción con JWT cuando falta la clave OMR', async () => {
    const variables = [
      'NODE_ENV',
      'EVALUAPRO_FLAVOR',
      'CORS_ORIGENES',
      'PORTAL_SYNC_REQUIRED',
      'PORTAL_ALUMNO_URL',
      'PORTAL_ALUMNO_API_KEY',
      'JWT_SECRETO',
      'OMR_QR_HMAC_KEY_ID',
      'OMR_QR_HMAC_SECRET',
      'OMR_QR_HMAC_SECRETS_JSON',
      'OMR_QR_RECOVERY_KEY_ID',
      'OMR_QR_RECOVERY_SECRET',
      'OMR_QR_RECOVERY_SECRETS_JSON'
    ] as const;
    const anteriores = new Map(variables.map((key) => [key, process.env[key] ?? null]));
    process.env.NODE_ENV = 'production';
    process.env.EVALUAPRO_FLAVOR = 'docente-local';
    process.env.CORS_ORIGENES = 'http://localhost:4173';
    process.env.PORTAL_SYNC_REQUIRED = '0';
    process.env.PORTAL_ALUMNO_URL = '';
    process.env.PORTAL_ALUMNO_API_KEY = '';
    process.env.JWT_SECRETO = 'jwt-production-no-es-clave-omr';
    for (const key of [
      'OMR_QR_HMAC_KEY_ID',
      'OMR_QR_HMAC_SECRET',
      'OMR_QR_HMAC_SECRETS_JSON',
      'OMR_QR_RECOVERY_KEY_ID',
      'OMR_QR_RECOVERY_SECRET',
      'OMR_QR_RECOVERY_SECRETS_JSON'
    ]) delete process.env[key];
    vi.resetModules();

    try {
      const { construirTextoQrExamenPagina, extraerResumenQrExamen } = await import('../src/modulos/modulo_generacion_pdf/domain/qrExamen.js');
      const segmentos = 'EXAMEN:FOLIO-SIN-OMR:P1:TV4:LI:LOTE-1:KI:QR-H1-V1';
      const firmaConJwt = createHmac('sha256', process.env.JWT_SECRETO!)
        .update(segmentos)
        .digest('hex')
        .slice(0, 24)
        .toUpperCase();

      expect(extraerResumenQrExamen(`${segmentos}:SG:H1${firmaConJwt}`)?.payloadSignatureValid).toBe(false);
      expect(() => construirTextoQrExamenPagina({
        folio: 'FOLIO-SIN-OMR',
        numeroPagina: 1,
        templateVersion: 4,
        loteId: 'LOTE-1',
        compacto: true
      })).toThrow('No hay una clave OMR configurada para firmar QR');
    } finally {
      for (const [key, value] of anteriores) {
        if (value === null) delete process.env[key];
        else process.env[key] = value;
      }
      vi.resetModules();
    }
  });

  it('incluye folio, pagina, template, hashes y ordenes de variante', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-TV4-001',
      numeroPagina: 2,
      templateVersion: 4,
      examId: 'EXAMEN-SEG-001',
      totalPreguntas: 16,
      preguntaDesde: 9,
      preguntaHasta: 16,
      questionIdsPagina: ['q9', 'q10'],
      mapaVariante: {
        ordenPreguntas: ['q9', 'q10'],
        ordenOpcionesPorPregunta: {
          q9: [2, 0, 1, 3, 4],
          q10: [4, 3, 2, 1, 0]
        }
      },
      preguntas: [
        {
          id: 'q9',
          enunciado: 'Pregunta 9',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: true },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        },
        {
          id: 'q10',
          enunciado: 'Pregunta 10',
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        }
      ]
    });

    const resumen = extraerResumenQrExamen(qr);
    expect(resumen).not.toBeNull();
    expect(resumen?.folio).toBe('FOLIO-TV4-001');
    expect(resumen?.loteId).toBeUndefined();
    expect(resumen?.numeroPagina).toBe(2);
    expect(resumen?.templateVersion).toBe(4);
    expect(resumen?.keyId).toBeTruthy();
    expect(resumen?.examId).toBe('EXAMEN-SEG-001');
    expect(resumen?.totalPreguntas).toBe(16);
    expect(resumen?.preguntaDesde).toBe(9);
    expect(resumen?.preguntaHasta).toBe(16);
    expect(resumen?.variantHash).toMatch(/^[A-Z0-9]{12}$/);
    expect(resumen?.answerKeyHash).toMatch(/^[A-Z0-9]{12}$/);
    expect(resumen?.pageAnswerKey).toBe('AE');
    expect(resumen?.payloadSignature).toMatch(/^H1[A-Z0-9]{24}$/);
    expect(resumen?.payloadSignatureMode).toBe('hmac-v1');
    expect(resumen?.payloadSignatureValid).toBe(true);
    expect(qr.length).toBeLessThan(210);
  });

  it('rechaza firmas que no pertenezcan al esquema HMAC canónico', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-001',
      numeroPagina: 1,
      templateVersion: 4,
      mapaVariante: { ordenPreguntas: [], ordenOpcionesPorPregunta: {} },
      preguntas: []
    });
    const qrObsoleto = qr.replace(/:SG:H1[A-Z0-9]{24}$/i, ':SG:AAAAAAAAAAAAAAAA');
    const resumen = extraerResumenQrExamen(qrObsoleto);

    expect(resumen?.payloadSignatureMode).toBe('unsupported');
    expect(resumen?.payloadSignatureValid).toBe(false);
  });

  it('mantiene lectura y validacion de QR compacto TV4 ya emitido', () => {
    const resumen = extraerResumenQrExamen(construirQrCompactoHistorico());

    expect(resumen?.qrPayloadMode).toBe('self-contained');
    expect(resumen?.loteId).toBeUndefined();
    expect(resumen?.payloadSignatureValid).toBe(true);
    expect(resumen?.variantHash).toBe('001122334455');
    expect(resumen?.answerKeyHash).toBe('AABBCCDDEEFF');
    expect(resumen?.pageAnswerKey).toBe('ABC');
  });

  it('incluye loteId como campo independiente dentro de la firma HMAC', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-001',
      numeroPagina: 2,
      templateVersion: 4,
      compacto: false,
      examId: 'EXAMEN-UUID-001',
      loteId: '0AFF2B75',
      totalPreguntas: 2,
      questionIdsPagina: ['q1', 'q2'],
      mapaVariante: { ordenPreguntas: ['q1', 'q2'], ordenOpcionesPorPregunta: {} },
      preguntas: []
    });
    const resumen = extraerResumenQrExamen(qr);

    expect(qr).toContain(':LI:0AFF2B75:');
    expect(qr).toMatch(/:SG:H1[A-Z0-9]{24}$/);
    expect(resumen).toMatchObject({
      loteId: '0AFF2B75',
      folio: 'FOLIO-001',
      examId: 'EXAMEN-UUID-001',
      numeroPagina: 2,
      payloadSignatureMode: 'hmac-v1',
      payloadSignatureValid: true
    });
  });

  it('emite un QR corto firmado para resolver la clave desde el manifiesto local', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-COMPACTO',
      numeroPagina: 1,
      templateVersion: 4,
      compacto: true,
      examId: 'EXAMEN-CON-UUID-LARGO-001',
      totalPreguntas: 12,
      questionIdsPagina: ['q1', 'q2'],
      mapaVariante: { ordenPreguntas: ['q1', 'q2'], ordenOpcionesPorPregunta: {} },
      preguntas: []
    });

    const resumen = extraerResumenQrExamen(qr);
    expect(resumen?.examId).toBeUndefined();
    expect(resumen?.qrPayloadMode).toBe('manifest-bound');
    expect(resumen?.keyId).toBeTruthy();
    expect(resumen?.variantHash).toBeUndefined();
    expect(resumen?.answerKeyHash).toBeUndefined();
    expect(resumen?.pageAnswerKey).toBeUndefined();
    expect(resumen?.payloadSignatureValid).toBe(true);
    expect(qr).not.toContain(':ID:');
    expect(qr).not.toContain(':C:');
    expect(qr).toContain(':S:');
    expect(qr.length).toBeLessThan(70);
  });

  it('mantiene el QR compacto con lote ligado al manifiesto y firmado con SG:H1', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-LOTE-COMPACTO',
      numeroPagina: 1,
      templateVersion: 4,
      compacto: true,
      examId: 'EXAMEN-CON-UUID-LARGO-001',
      loteId: 'LOTE-20261026-01',
      totalPreguntas: 12,
      questionIdsPagina: ['q1', 'q2'],
      mapaVariante: { ordenPreguntas: ['q1', 'q2'], ordenOpcionesPorPregunta: {} },
      preguntas: []
    });

    const resumen = extraerResumenQrExamen(qr);
    expect(qr).toContain(':LI:LOTE-20261026-01:');
    expect(qr).toMatch(/:SG:H1[A-Z0-9]{24}$/);
    expect(qr).not.toContain(':C:');
    expect(qr).not.toContain(':ID:');
    expect(resumen).toMatchObject({
      loteId: 'LOTE-20261026-01',
      examId: undefined,
      qrPayloadMode: 'manifest-bound',
      payloadSignatureMode: 'hmac-v1',
      payloadSignatureValid: true
    });
    expect(resumen?.variantHash).toBeUndefined();
    expect(resumen?.answerKeyHash).toBeUndefined();
    expect(resumen?.pageAnswerKey).toBeUndefined();
  });

  it('detecta cambios al loteId en el QR compacto manifest-bound', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-LOTE-COMPACTO',
      numeroPagina: 1,
      templateVersion: 4,
      compacto: true,
      loteId: 'LOTE-ORIGINAL',
      mapaVariante: { ordenPreguntas: [], ordenOpcionesPorPregunta: {} },
      preguntas: []
    });

    const resumen = extraerResumenQrExamen(qr.replace('LI:LOTE-ORIGINAL', 'LI:LOTE-ALTERADO'));
    expect(resumen?.qrPayloadMode).toBe('manifest-bound');
    expect(resumen?.payloadSignatureValid).toBe(false);
  });

  it('reduce bytes y módulos respecto del QR autocontenido equivalente', () => {
    const preguntas = Array.from({ length: 25 }, (_, indice) => ({
      id: `q${indice + 1}`,
      enunciado: `Pregunta ${indice + 1}`,
      opciones: [0, 1, 2, 3, 4].map((opcion) => ({ texto: String(opcion), esCorrecta: opcion === indice % 5 }))
    }));
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const payload = {
      folio: 'OMR-COMPACT-025',
      numeroPagina: 1,
      templateVersion: 4 as const,
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      totalPreguntas: 25,
      preguntaDesde: 1,
      preguntaHasta: 25,
      questionIdsPagina: ordenPreguntas.slice(0, 13),
      mapaVariante: {
        ordenPreguntas,
        ordenOpcionesPorPregunta: Object.fromEntries(ordenPreguntas.map((id) => [id, [0, 1, 2, 3, 4]]))
      },
      preguntas
    };
    const qrCorto = construirTextoQrExamenPagina({ ...payload, compacto: true });
    const qrAutocontenido = construirTextoQrExamenPagina(payload);
    const modulosCortos = QRCode.create(qrCorto, { errorCorrectionLevel: 'H' }).modules.size;
    const modulosAutocontenidos = QRCode.create(qrAutocontenido, { errorCorrectionLevel: 'H' }).modules.size;

    expect(qrCorto.length).toBeLessThan(qrAutocontenido.length * 0.6);
    expect(modulosCortos).toBeLessThan(modulosAutocontenidos);
    expect(modulosCortos).toBeLessThanOrEqual(41);
    expect(modulosAutocontenidos).toBeGreaterThan(49);
    expect(extraerResumenQrExamen(qrCorto)?.payloadSignatureValid).toBe(true);
  });
});
