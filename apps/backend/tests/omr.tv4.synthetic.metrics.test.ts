import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { analizarOmr as analizarOmrCv } from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import {
  debeIncluirIssueSintetico,
  esRechazoSeguroMarcaInvalida,
  resumirConfianzaCoberturaAutoCalificacion
} from '../scripts/omr-tv4-synthetic-lib.js';

describe('métricas del evaluador sintético TV4', () => {
  it('reutiliza el QR exacto sin cambiar las respuestas OMR frente a una decodificación independiente', async () => {
    const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
    const manifest = JSON.parse(
      await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
    ) as { capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }> };
    const captura = manifest.capturas.find((item) => item.captureId === 'TV4-SYNTH-005-P2');
    expect(captura).toBeDefined();
    if (!captura) return;
    const [imageBuffer, mapaRaw] = await Promise.all([
      readFile(path.join(datasetRoot, captura.imagePath)),
      readFile(path.join(datasetRoot, captura.mapaOmrPath), 'utf8')
    ]);
    const mapa = JSON.parse(mapaRaw) as { qr: { texto: string }; numeroPagina: number };
    const imagen = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const debugInfo = { folio: captura.captureId, numeroPagina: mapa.numeroPagina, templateVersionDetectada: 4 as const };
    const base = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, { noRetry: true });
    const reutilizado = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, {
      noRetry: true,
      qrTextoPrevalidado: mapa.qr.texto
    });
    const hintIncorrecto = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, {
      noRetry: true,
      qrTextoPrevalidado: 'EXAMEN:OTRO_LOTE:OTRO_FOLIO'
    });

    expect(reutilizado.qrTexto).toBe(mapa.qr.texto);
    expect(reutilizado.qrFuenteDeteccion).toBe('pipeline_validated_payload');
    expect(hintIncorrecto.qrTexto).toBe(mapa.qr.texto);
    expect(hintIncorrecto.qrFuenteDeteccion).not.toBe('pipeline_validated_payload');
    expect(reutilizado.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    }))).toEqual(base.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    })));
    expect(hintIncorrecto.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    }))).toEqual(base.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    })));
  }, 120_000);

  it('se abstiene ante una burbuja vacía contaminada por el panel y ante manchas parciales', async () => {
    const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
    const manifest = JSON.parse(
      await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
    ) as { capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }> };
    const casos = [
      { captureId: 'TV4-SYNTH-001-P1', numeroPregunta: 7 },
      { captureId: 'TV4-SYNTH-004-P2', numeroPregunta: 20 },
      { captureId: 'TV4-SYNTH-005-P2', numeroPregunta: 16 }
    ];

    for (const caso of casos) {
      const captura = manifest.capturas.find((item) => item.captureId === caso.captureId);
      expect(captura, `captura sintética faltante: ${caso.captureId}`).toBeDefined();
      if (!captura) continue;
      const [imageBuffer, mapaRaw] = await Promise.all([
        readFile(path.join(datasetRoot, captura.imagePath)),
        readFile(path.join(datasetRoot, captura.mapaOmrPath), 'utf8')
      ]);
      const mapa = JSON.parse(mapaRaw) as { qr: { texto: string }; numeroPagina: number };
      const resultado = await analizarOmr(
        `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        mapa as never,
        mapa.qr.texto,
        10,
        { folio: caso.captureId, numeroPagina: mapa.numeroPagina, templateVersionDetectada: 4 },
        caso.captureId
      );
      const respuesta = resultado.respuestasDetectadas.find(
        (item) => item.numeroPregunta === caso.numeroPregunta
      );

      expect(respuesta?.opcion, `${caso.captureId} Q${caso.numeroPregunta}`).toBeNull();
      expect(['ambigua', 'doble_marca', 'tachada']).toContain(respuesta?.estadoRespuesta);
    }
  }, 180_000);

  it('considera rechazo seguro una marca doble aunque exista una opción candidata', () => {
    expect(esRechazoSeguroMarcaInvalida('doble_marca', 'A')).toBe(true);
  });

  it('considera rechazo seguro una respuesta ambigua con o sin opción candidata', () => {
    expect(esRechazoSeguroMarcaInvalida('ambigua', null)).toBe(true);
    expect(esRechazoSeguroMarcaInvalida('ambigua', 'B')).toBe(true);
  });

  it('solo cuenta como sin marca segura el estado sin_marca sin opción', () => {
    expect(esRechazoSeguroMarcaInvalida('sin_marca', null)).toBe(true);
    expect(esRechazoSeguroMarcaInvalida('sin_marca', 'C')).toBe(false);
    expect(esRechazoSeguroMarcaInvalida('respondida', 'C')).toBe(false);
    expect(esRechazoSeguroMarcaInvalida(undefined, null)).toBe(false);
  });

  it('registra falsos positivos antes de cerrar el cálculo de confusión', () => {
    expect(debeIncluirIssueSintetico('blank', null, 'A')).toBe(true);
    expect(debeIncluirIssueSintetico('valid', 'A', 'B')).toBe(true);
    expect(debeIncluirIssueSintetico('valid', 'A', 'A')).toBe(false);
    expect(debeIncluirIssueSintetico('double', null, null)).toBe(true);
  });

  it('mide confianza solo en notas automáticas y cobertura contra páginas claramente elegibles', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { claramenteElegible: true, autoCalificable: true, calificacionCoincide: true },
      { claramenteElegible: true, autoCalificable: false, calificacionCoincide: false },
      { claramenteElegible: false, autoCalificable: false, calificacionCoincide: false }
    ]);

    expect(metricas).toMatchObject({
      autoEligibleCaptures: 1,
      clearlyEligibleCaptures: 2,
      autoCoverageRate: 0.5,
      autoGradeTrustRate: 1,
      automaticGradeDiscordances: 0
    });
  });

  it('falla la confianza si una nota autocalificada difiere de la clave o se emitió sobre una hoja inválida', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { claramenteElegible: true, autoCalificable: true, calificacionCoincide: false },
      { claramenteElegible: false, autoCalificable: true, calificacionCoincide: true }
    ]);

    expect(metricas).toMatchObject({
      autoEligibleCaptures: 2,
      clearlyEligibleCaptures: 1,
      autoCoverageRate: 1,
      autoGradeTrustRate: 0,
      automaticGradeDiscordances: 2
    });
  });

  it('no presenta la abstención total como falta de cobertura resuelta', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { claramenteElegible: true, autoCalificable: false, calificacionCoincide: false }
    ]);

    expect(metricas).toMatchObject({ autoEligibleCaptures: 0, autoCoverageRate: 0 });
  });
});
