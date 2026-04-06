/**
 * omr.contrato.test
 *
 * Smoke tests del contrato OMR CV único.
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analizarOmr, leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
type MapaOmr = Parameters<typeof analizarOmr>[1];

async function crearImagenBlancaBase64(width = 612, height = 792) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('OMR contrato unico smoke', () => {
  const mapaSimple: MapaOmr = {
    numeroPagina: 1,
    preguntas: [
      {
        numeroPregunta: 1,
        idPregunta: 'p1',
        opciones: [
          { letra: 'A', x: 480, y: 150 },
          { letra: 'B', x: 500, y: 150 },
          { letra: 'C', x: 520, y: 150 },
          { letra: 'D', x: 540, y: 150 }
        ]
      }
    ]
  };

  it('leerQrDesdeImagen responde sin lanzar en imagen sin QR', async () => {
    const imagenBlanca = await crearImagenBlancaBase64();
    const resultado = await leerQrDesdeImagen(imagenBlanca);
    expect(resultado).toBeUndefined();
  });

  it('analizarOmr retorna estructura esperada en imagen blanca', async () => {
    const imagenBlanca = await crearImagenBlancaBase64();
    const resultado = await analizarOmr(imagenBlanca, mapaSimple, ['TEST'], 10, { numeroPagina: 1 }, 'req-test');

    expect(Array.isArray(resultado.respuestasDetectadas)).toBe(true);
    expect(resultado.respuestasDetectadas.length).toBe(1);
    expect(['ok', 'requiere_revision', 'rechazado_calidad']).toContain(resultado.estadoAnalisis);
    expect(resultado.calidadPagina).toBeGreaterThanOrEqual(0);
    expect(resultado.calidadPagina).toBeLessThanOrEqual(1);
  });

  it('analizarOmr propaga error para base64 inválido', async () => {
    await expect(analizarOmr('data:image/png;base64,INVALID_BASE64', mapaSimple, ['TEST'], 10)).rejects.toThrow();
  });
});
