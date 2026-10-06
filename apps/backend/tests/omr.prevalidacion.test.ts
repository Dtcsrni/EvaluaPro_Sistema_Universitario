/**
 * omr.prevalidacion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ leerQrDesdeImagen: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/modulos/modulo_escaneo_omr/servicioOmr.js', () => ({
  analizarOmr: vi.fn(),
  leerQrDesdeImagen: mocks.leerQrDesdeImagen
}));
import { prevalidarLoteCapturas } from '../src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.js';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion.js';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+WmVQAAAAASUVORK5CYII=';

describe('OMR prevalidacion de lote', () => {
  beforeEach(() => mocks.leerQrDesdeImagen.mockClear());

  it('retorna sugerencias cuando la captura no es legible', async () => {
    const req = {
      body: {
        capturas: [{ nombreArchivo: 'p1.jpg', imagenBase64: PNG_1X1_BASE64 }]
      }
    } as unknown as SolicitudDocente;
    const res = crearRespuesta();

    await prevalidarLoteCapturas(req, res);

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      total: number;
      noLegibles: number;
      resultados: Array<{ legible: boolean; sugerencias: string[] }>;
    };
    expect(payload.total).toBe(1);
    expect(payload.noLegibles).toBe(1);
    expect(payload.resultados[0].legible).toBe(false);
    expect(payload.resultados[0].sugerencias.length).toBeGreaterThan(0);
  });

  it('omite la deteccion QR costosa en imagenes uniformes', async () => {
    const req = {
      body: { capturas: [{ imagenBase64: PNG_1X1_BASE64 }] }
    } as unknown as SolicitudDocente;

    await prevalidarLoteCapturas(req, crearRespuesta());

    expect(mocks.leerQrDesdeImagen).not.toHaveBeenCalled();
  });

  it('conserva la deteccion QR para imagenes con contraste', async () => {
    const png = await sharp(Buffer.from(
      '<svg width="100" height="100"><rect width="100" height="100" fill="#00ff00"/><rect x="20" y="20" width="60" height="60" fill="black"/></svg>'
    )).png().toBuffer();
    const req = {
      body: { capturas: [{ imagenBase64: png.toString('base64') }] }
    } as unknown as SolicitudDocente;

    await prevalidarLoteCapturas(req, crearRespuesta());

    expect(mocks.leerQrDesdeImagen).toHaveBeenCalledOnce();
  });

  it('mantiene la prevalidacion cuando falla el detector QR', async () => {
    mocks.leerQrDesdeImagen.mockRejectedValueOnce(new Error('decoder unavailable'));
    const png = await sharp(Buffer.from(
      '<svg width="100" height="100"><rect width="100" height="100" fill="#00ff00"/><rect x="20" y="20" width="60" height="60" fill="black"/></svg>'
    )).png().toBuffer();
    const req = {
      body: { capturas: [{ imagenBase64: png.toString('base64') }] }
    } as unknown as SolicitudDocente;
    const res = crearRespuesta();

    await expect(prevalidarLoteCapturas(req, res)).resolves.toBeUndefined();

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      resultados: Array<{ qrDetectado: boolean; sugerencias: string[] }>;
    };
    expect(payload.resultados[0].qrDetectado).toBe(false);
    expect(payload.resultados[0].sugerencias).toContain('No se detectó QR: recorta menos y captura la hoja completa.');
  });
});

