import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

describe('PDF de extraordinario archivado', () => {
  it('reparte el banco completo en cuatro páginas legibles para impresión dúplex', async () => {
    const preguntas = Array.from({ length: 24 }, (_, indice) => ({
      id: `reactivo-${indice + 1}`,
      enunciado: `Pregunta ${indice + 1}: Para implementar una aplicación web, el equipo define componentes reutilizables, valida los datos recibidos y conserva el estado de la interfaz. ¿Qué decisión mantiene ese comportamiento?`,
      opciones: [
        { texto: 'Separar responsabilidades y validar cada dato en el límite del componente.', esCorrecta: true },
        { texto: 'Duplicar la lógica de validación en cada pantalla que usa el componente.', esCorrecta: false },
        { texto: 'Aceptar cualquier valor y corregirlo después de guardar el estado.', esCorrecta: false },
        { texto: 'Compartir variables globales para evitar definir contratos entre módulos.', esCorrecta: false }
      ]
    }));

    const resultado = await generarPdfExamen({
      titulo: 'Global sintético para extraordinario',
      folio: 'PREVIEW-EXTRA-4P',
      preguntas,
      mapaVariante: {
        ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
        ordenOpcionesPorPregunta: {}
      },
      tipoExamen: 'extraordinario',
      totalPaginas: 4,
      bookletConfig: { autoFitPages: true, autoFitTypography: true, distribuirEnPaginasObjetivo: true }
    });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.paginas).toHaveLength(4);
    expect(resultado.mapaOmr.paginas).toHaveLength(4);
    expect(resultado.metricasLayout?.minLineHeightApplied).toBeGreaterThan(0);
    expect(resultado.metricasLayout?.fontSizePregunta).toBeGreaterThanOrEqual(8);
    expect(resultado.metricasPaginas).toHaveLength(4);
    expect(resultado.metricasPaginas.every((pagina) => pagina.preguntas > 0 && pagina.fraccionVacia < 0.5)).toBe(true);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.idPregunta)).sort())
      .toEqual(preguntas.map((pregunta) => pregunta.id).sort());
    expect(resultado.mapaOmr.impresion).toMatchObject({ modo: 'duplex', paginasPorHoja: 2 });
  });
});
