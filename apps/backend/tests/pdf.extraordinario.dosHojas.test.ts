import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

describe('PDF de extraordinario archivado', () => {
  it('aprovecha las cuatro páginas sin un máximo fijo de reactivos y conserva legibilidad', async () => {
    const preguntas = Array.from({ length: 60 }, (_, indice) => ({
      id: `reactivo-breve-${indice + 1}`,
      enunciado: `Reactivo ${indice + 1}: ¿Cuánto es 2 + 2?`,
      opciones: ['1', '2', '4', '6', '8'].map((texto, opcion) => ({
        texto,
        esCorrecta: opcion === 2
      }))
    }));
    const resultado = await generarPdfExamen({
      titulo: 'Examen Extraordinario',
      folio: 'PREVIEW-EXTRA-CAPACIDAD',
      preguntas,
      mapaVariante: {
        ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
        ordenOpcionesPorPregunta: {}
      },
      tipoExamen: 'extraordinario',
      totalPaginas: 4,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1, distribuirEnPaginasObjetivo: true }
    });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.paginas).toHaveLength(4);
    expect(resultado.mapaOmr.paginas).toHaveLength(4);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.idPregunta)).sort())
      .toEqual(preguntas.map((pregunta) => pregunta.id).sort());
    expect(resultado.metricasLayout?.fontSizePregunta).toBeGreaterThanOrEqual(10);
    expect(resultado.metricasLayout?.fontSizeOpcion).toBeGreaterThanOrEqual(8.5);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.collisionBoxes ?? [])).toHaveLength(0);
    expect(resultado.mapaOmr.impresion).toMatchObject({ modo: 'duplex', paginasPorHoja: 2 });
  });

  it('reparte el banco completo en cuatro páginas legibles para impresión dúplex', async () => {
    const repeticionesPorReactivo = [3, 3, 2, 3, 1, 2, 1, 3, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 3, 3, 2, 3, 3, 2, 3];
    const preguntas = Array.from({ length: 25 }, (_, indice) => ({
      id: `reactivo-${indice + 1}`,
      enunciado: `Pregunta ${indice + 1}: Para implementar una aplicación web, el equipo define componentes reutilizables, valida los datos recibidos y conserva el estado de la interfaz. ${'La lógica mantiene un contrato explícito, valida entradas en su límite y separa responsabilidades entre módulos. '.repeat(repeticionesPorReactivo[indice] ?? 1)}¿Qué decisión mantiene ese comportamiento?`,
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
      bookletConfig: { autoFitPages: true, autoFitTypography: true, distribuirEnPaginasObjetivo: false }
    });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.paginas).toHaveLength(4);
    expect(resultado.mapaOmr.paginas).toHaveLength(4);
    expect(resultado.metricasLayout?.minLineHeightApplied).toBeGreaterThan(0);
    expect(resultado.metricasLayout?.fontSizePregunta).toBeGreaterThanOrEqual(8);
    expect(resultado.metricasPaginas).toHaveLength(4);
    const fraccionesVacias = resultado.metricasPaginas.map((pagina) => pagina.fraccionVacia);
    expect(resultado.metricasPaginas.every((pagina) => pagina.preguntas > 0 && pagina.fraccionVacia < 0.35)).toBe(true);
    expect(Math.max(...fraccionesVacias) - Math.min(...fraccionesVacias)).toBeLessThan(0.2);
    const debugPaginas = resultado.mapaOmr.paginas.map((pagina) => pagina.layoutDebug);
    const interseca = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(debugPaginas[1]?.contentStartY).toBeGreaterThan(700);
    expect(debugPaginas[2]?.contentStartY).toBeGreaterThan(700);
    expect(debugPaginas[3]?.contentStartY).toBeGreaterThan(700);
    for (const pagina of debugPaginas.slice(1)) {
      const reservaGrapa = pagina?.bindingKeepOutZone;
      expect(reservaGrapa).toBeDefined();
      expect((pagina?.questionPromptBoxes ?? []).every((caja) => !interseca(reservaGrapa!, caja))).toBe(true);
    }
    expect(debugPaginas.every((pagina) => (pagina?.questionBlockBoxes ?? []).every((caja) => caja.x + caja.width <= 600))).toBe(true);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.idPregunta)).sort())
      .toEqual(preguntas.map((pregunta) => pregunta.id).sort());
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas.map((pregunta) => pregunta.numeroPregunta)))
      .toEqual(preguntas.map((_pregunta, indice) => indice + 1));
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.collisionBoxes ?? [])).toHaveLength(0);
    expect(resultado.mapaOmr.impresion).toMatchObject({ modo: 'duplex', paginasPorHoja: 2 });
  });

  it('mantiene la calificación dentro de la cabecera institucional sin colisiones', async () => {
    const pregunta = {
      id: 'reactivo-cabecera',
      enunciado: '¿Qué práctica ayuda a mantener una aplicación web segura y mantenible?',
      opciones: [
        { texto: 'Validar las entradas y separar responsabilidades.', esCorrecta: true },
        { texto: 'Aceptar cualquier dato antes de validarlo.', esCorrecta: false },
        { texto: 'Duplicar la lógica en cada pantalla.', esCorrecta: false },
        { texto: 'Compartir estado global sin contratos.', esCorrecta: false },
        { texto: 'Eliminar las pruebas de integración.', esCorrecta: false }
      ]
    };
    const resultado = await generarPdfExamen({
      titulo: 'Examen Extraordinario',
      folio: 'PREVIEW-HEADER-CALIF',
      preguntas: [pregunta],
      mapaVariante: {
        ordenPreguntas: [pregunta.id],
        ordenOpcionesPorPregunta: {}
      },
      tipoExamen: 'extraordinario',
      totalPaginas: 1,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'Sapientia est nostra fortis',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Ceron'
      }
    });

    const pagina = resultado.mapaOmr.paginas[0];
    const cabecera = pagina?.layoutDebug?.header;
    const campoCalificacion = pagina?.layoutDebug?.headerFieldBoxes.find((caja) => caja.id === 'calificacion-linea');
    expect(resultado.paginas).toHaveLength(1);
    expect(campoCalificacion).toBeDefined();
    expect(campoCalificacion!.width).toBeGreaterThanOrEqual(15);
    expect(campoCalificacion!.y).toBeGreaterThan(cabecera!.y);
    expect(pagina?.layoutDebug?.collisionBoxes).toHaveLength(0);
  });
});
