import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  guardarPreviewArchivadoValidado,
  limpiarPreviewsArchivadosParaTest,
  obtenerPreviewArchivadoValidado
} from '../src/modulos/modulo_generacion_pdf/domain/previewArchivado.js';

function preview(plantillaId: string) {
  return {
    docenteId: 'docente',
    periodoId: 'periodo',
    plantillaId,
    bookletConfig: { paginas: [1, 2] },
    blueprintJson: '{}',
    mapaVariante: { ordenPreguntas: ['p1'], ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3, 4] } }
  };
}

describe('cache de previews de extraordinario archivado', () => {
  afterEach(() => {
    vi.useRealTimers();
    limpiarPreviewsArchivadosParaTest();
  });

  it('expira a los diez minutos y elimina la entrada vencida', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00.000Z'));
    guardarPreviewArchivadoValidado(preview('plantilla-expira'));
    expect(obtenerPreviewArchivadoValidado(preview('plantilla-expira'))?.plantillaId).toBe('plantilla-expira');

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(obtenerPreviewArchivadoValidado(preview('plantilla-expira'))).toBeUndefined();
  });

  it('limita el cache a 32 previews y expulsa primero la entrada más antigua', () => {
    for (let indice = 0; indice < 33; indice += 1) {
      guardarPreviewArchivadoValidado(preview(`plantilla-${indice}`));
    }

    expect(obtenerPreviewArchivadoValidado(preview('plantilla-0'))).toBeUndefined();
    expect(obtenerPreviewArchivadoValidado(preview('plantilla-1'))?.plantillaId).toBe('plantilla-1');
  });

  it('devuelve una copia aislada de la configuración y limpia todas las entradas', () => {
    guardarPreviewArchivadoValidado(preview('plantilla-copia'));
    const primeraLectura = obtenerPreviewArchivadoValidado(preview('plantilla-copia'))!;
    (primeraLectura.bookletConfig.paginas as number[]).push(3);
    expect(obtenerPreviewArchivadoValidado(preview('plantilla-copia'))?.bookletConfig.paginas).toEqual([1, 2]);

    limpiarPreviewsArchivadosParaTest();
    expect(obtenerPreviewArchivadoValidado(preview('plantilla-copia'))).toBeUndefined();
  });
});
