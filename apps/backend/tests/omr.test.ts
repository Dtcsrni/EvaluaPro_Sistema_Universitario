// Pruebas del servicio OMR.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

async function crearImagenBlancaBase64() {
  const buffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('analizarOmr', () => {
  it('devuelve advertencias y respuestas nulas sin marcas', async () => {
    const imagenBase64 = await crearImagenBlancaBase64();
    const mapaPagina = {
      numeroPagina: 1,
      preguntas: [
        {
          numeroPregunta: 1,
          idPregunta: 'p1',
          opciones: [
            { letra: 'A', x: 100, y: 100 },
            { letra: 'B', x: 120, y: 100 },
            { letra: 'C', x: 140, y: 100 },
            { letra: 'D', x: 160, y: 100 }
          ]
        }
      ]
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, ['TEST', 'EXAMEN:TEST:P1'], 10);

    expect(resultado.qrTexto).toBeUndefined();
    expect(resultado.advertencias).toEqual(
      expect.arrayContaining([
        'No se detecto QR en la imagen',
        'No se detectaron todas las marcas de registro; usando escala simple'
      ])
    );
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0].confianza).toBe(0);
  });
});
