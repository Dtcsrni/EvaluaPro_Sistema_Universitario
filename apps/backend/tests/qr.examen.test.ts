/**
 * qr.examen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
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
    expect(resumen?.payloadSignatureValid).toBe(true);
    expect(resumen?.variantHash).toBe('001122334455');
    expect(resumen?.answerKeyHash).toBe('AABBCCDDEEFF');
    expect(resumen?.pageAnswerKey).toBe('ABC');
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
