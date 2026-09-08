import { describe, expect, it } from 'vitest';
import {
  calcularEstimacionDensidadPlantilla,
  textoEstimacionDensidadPlantilla
} from '../src/apps/app_docente/features/plantillas/hooks/estimadorDensidadPlantilla';

describe('estimador de densidad de plantillas', () => {
  it('calcula un rango aproximado por reactivos, temas y configuración', () => {
    const estimacion = calcularEstimacionDensidadPlantilla({
      totalReactivos: 23,
      paginasConfiguradas: 2,
      temasSeleccionados: 7,
      fontScale: 1.1,
      lineSpacing: 1.1
    });

    expect(estimacion.paginasEstimadas).toBe(2);
    expect(estimacion.reactivosPorPaginaMin).toBe(11);
    expect(estimacion.reactivosPorPaginaMax).toBe(12);
    expect(textoEstimacionDensidadPlantilla(estimacion)).toBe('Aprox. 11–12 reactivos/página · 2 páginas');
  });

  it('aumenta las páginas estimadas cuando el contenido no cabe con legibilidad mínima', () => {
    const estimacion = calcularEstimacionDensidadPlantilla({
      totalReactivos: 40,
      paginasConfiguradas: 2,
      temasSeleccionados: 3,
      fontScale: 1,
      lineSpacing: 1.1
    });

    expect(estimacion.paginasEstimadas).toBe(4);
    expect(estimacion.reactivosPorPaginaMin).toBe(10);
    expect(estimacion.reactivosPorPaginaMax).toBe(10);
  });

  it('no permite estimar por debajo del tamaño de fuente legible', () => {
    const limite = calcularEstimacionDensidadPlantilla({
      totalReactivos: 20,
      paginasConfiguradas: 2,
      temasSeleccionados: 1,
      fontScale: 0.9,
      lineSpacing: 1.1
    });
    const inferior = calcularEstimacionDensidadPlantilla({
      totalReactivos: 20,
      paginasConfiguradas: 2,
      temasSeleccionados: 1,
      fontScale: 0.8,
      lineSpacing: 1.1
    });

    expect(inferior).toEqual(limite);
  });
});
