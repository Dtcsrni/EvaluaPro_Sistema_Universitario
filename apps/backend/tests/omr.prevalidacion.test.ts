import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { prevalidarLoteCapturas } from '../src/modulos/modulo_escaneo_omr/controladorEscaneoOmr';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+WmVQAAAAASUVORK5CYII=';

describe('OMR prevalidacion de lote', () => {
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
});

