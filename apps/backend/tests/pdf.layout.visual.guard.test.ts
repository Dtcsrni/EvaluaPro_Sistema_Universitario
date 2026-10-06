/**
 * pdf.layout.visual.guard.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { ANCHO_CARTA, ALTO_CARTA } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { analizarOmr, leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { detectarColisionesDuplexOmr } from '../src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.js';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

type Rect = { x: number; y: number; width: number; height: number };

function interseca(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function contiene(contenedor: Rect, rect: Rect, tolerancia = 0.01) {
  return (
    rect.x >= contenedor.x - tolerancia &&
    rect.y >= contenedor.y - tolerancia &&
    rect.x + rect.width <= contenedor.x + contenedor.width + tolerancia &&
    rect.y + rect.height <= contenedor.y + contenedor.height + tolerancia
  );
}

function assertRectDentroPagina(rect: Rect) {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(ANCHO_CARTA);
  expect(rect.y + rect.height).toBeLessThanOrEqual(ALTO_CARTA);
}

function assertConteoPreguntasPorPagina(resultado: Awaited<ReturnType<typeof generarPdfExamen>>) {
  // La plantilla canónica horizontal decide el corte por altura real del
  // contenido. La densidad objetivo de 20--25 en dos páginas se verifica en
  // escenarios explícitos; los reversos vacíos se excluyen del conteo editorial
  // y las páginas con contenido no deben quedar fuera de escala.

  const conteoPorPagina = resultado.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => {
    const del = Number(pagina.preguntasDel ?? 0);
    const al = Number(pagina.preguntasAl ?? 0);
    return del > 0 && al >= del ? al - del + 1 : 0;
  });

  for (let indice = 0; indice < conteoPorPagina.length; indice += 1) {
    const conteo = conteoPorPagina[indice] ?? 0;
    expect(conteo).toBeGreaterThanOrEqual(1);
    expect(conteo).toBeLessThanOrEqual(25);
  }
}

function assertBloquesHeader(pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number], header: Rect) {
  const dbg = pagina.layoutDebug;
  const qr = dbg?.qr as Rect;
  assertRectDentroPagina(header);
  assertRectDentroPagina(qr);
  expect(ANCHO_CARTA - (qr.x + qr.width)).toBeGreaterThanOrEqual(30 * 72 / 25.4);
  const simboloQr: Rect = {
    x: Number(pagina.qr?.x ?? 0),
    y: Number(pagina.qr?.y ?? 0),
    width: Number(pagina.qr?.size ?? 0),
    height: Number(pagina.qr?.size ?? 0)
  };
  assertRectDentroPagina(simboloQr);
  expect(contiene(qr, simboloQr), 'el símbolo QR debe quedar íntegramente dentro de su tarjeta').toBe(true);

  if (pagina.numeroPagina === 1) {
    expect(contiene(header, qr), 'la reserva QR debe estar contenida en la cabecera').toBe(true);
    const marcaSuperiorDerecha = pagina.marcasPagina?.tr;
    const tamMarca = Number(pagina.marcasPagina?.size ?? 0);
    const quietMarca = Number(pagina.marcasPagina?.quietZone ?? 0);
    if (marcaSuperiorDerecha && tamMarca > 0) {
      const reservaFiducialSuperiorDerecha: Rect = {
        x: marcaSuperiorDerecha.x - tamMarca - quietMarca,
        y: marcaSuperiorDerecha.y - tamMarca - quietMarca,
        width: tamMarca + quietMarca * 2,
        height: tamMarca + quietMarca * 2
      };
      expect(
        interseca(qr, reservaFiducialSuperiorDerecha),
        'el QR invade la quiet zone del fiducial superior derecho'
      ).toBe(false);
      const separacionHorizontal = reservaFiducialSuperiorDerecha.x - (qr.x + qr.width);
      const separacionVertical = reservaFiducialSuperiorDerecha.y - (qr.y + qr.height);
      expect(
        separacionHorizontal > 0.01 || separacionVertical > 0.01,
        'la tarjeta QR debe conservar separación positiva del fiducial superior derecho en algún eje'
      ).toBe(true);
    }
  }

  const bloquesHeader = Array.isArray(dbg?.headerTextBlocks) ? dbg.headerTextBlocks : [];
  const camposHeader = Array.isArray(dbg?.headerFieldBoxes) ? dbg.headerFieldBoxes : [];
  const slotsHeader = Array.isArray(dbg?.headerSlots) ? dbg.headerSlots : [];
  const iconosHeader = Array.isArray(dbg?.headerIconBoxes) ? dbg.headerIconBoxes : [];
  const continuationBand = dbg?.continuationBand as Rect | undefined;
  const continuationTextBlocks = Array.isArray(dbg?.continuationTextBlocks) ? dbg.continuationTextBlocks : [];
  const violaciones = Array.isArray(dbg?.lineHeightViolations) ? dbg.lineHeightViolations : [];
  expect(violaciones.length).toBe(0);
  for (let i = 0; i < bloquesHeader.length; i += 1) {
    const a = bloquesHeader[i] as Rect;
    assertRectDentroPagina(a);
    for (let j = i + 1; j < bloquesHeader.length; j += 1) {
      const b = bloquesHeader[j] as Rect;
      expect(interseca(a, b)).toBe(false);
    }
  }
  for (const campo of camposHeader) {
    const caja = campo as Rect;
    assertRectDentroPagina(caja);
    for (const bloque of bloquesHeader) {
      expect(interseca(caja, bloque as Rect), `campo ${campo.id} invade texto de cabecera`).toBe(false);
    }
  }
  if (pagina.numeroPagina === 1) {
    expect(iconosHeader.map((icono) => icono.id)).toEqual([
      'icono-alumno',
      'icono-grupo',
      'icono-docente',
      'icono-indicaciones'
    ]);
    expect(camposHeader.map((campo) => campo.id)).toEqual(expect.arrayContaining([
      'reactivos-linea',
      'calificacion-linea'
    ]));
    expect(camposHeader.map((campo) => campo.id)).not.toContain('puntos-extra-linea');
    const grupo = bloquesHeader.find((bloque) => bloque.id === 'grupo-etiqueta') as Rect | undefined;
    const indicaciones = bloquesHeader.find((bloque) => bloque.id === 'indicaciones-etiqueta') as Rect | undefined;
    expect(indicaciones?.y ?? 0).toBeLessThan(grupo?.y ?? Number.POSITIVE_INFINITY);
    const segundaFila = ['reactivos-etiqueta', 'conteo-reactivos']
      .map((id) => bloquesHeader.find((bloque) => bloque.id === id)?.y)
      .filter((y): y is number => typeof y === 'number');
    expect(segundaFila).toHaveLength(2);
    expect(Math.max(...segundaFila) - Math.min(...segundaFila)).toBeLessThanOrEqual(0.001);
    const calificacion = bloquesHeader.find((bloque) => bloque.id === 'calificacion-etiqueta');
    const conteo = bloquesHeader.find((bloque) => bloque.id === 'conteo-reactivos');
    expect(calificacion).toBeTruthy();
    expect(conteo).toBeTruthy();
    if ((calificacion?.x ?? 0) >= (conteo?.x ?? 0) + (conteo?.width ?? 0)) {
      expect(calificacion?.y).toBeCloseTo(conteo?.y ?? 0, 3);
    } else {
      expect(calificacion?.y ?? 0).toBeLessThan(Math.min(...segundaFila) - 8);
    }
  }
  for (let i = 0; i < iconosHeader.length; i += 1) {
    const icono = iconosHeader[i] as Rect;
    assertRectDentroPagina(icono);
    expect(contiene(header, icono), `icono ${iconosHeader[i]?.id} fuera de la cabecera`).toBe(true);
    expect(interseca(icono, qr), `icono ${iconosHeader[i]?.id} invade el QR`).toBe(false);
    for (const bloque of bloquesHeader) {
      expect(interseca(icono, bloque as Rect), `icono ${iconosHeader[i]?.id} invade texto`).toBe(false);
    }
    for (const campo of camposHeader) {
      expect(interseca(icono, campo as Rect), `icono ${iconosHeader[i]?.id} invade campo`).toBe(false);
    }
    for (let j = i + 1; j < iconosHeader.length; j += 1) {
      expect(interseca(icono, iconosHeader[j] as Rect), 'iconos de cabecera superpuestos').toBe(false);
    }
  }
  if (pagina.numeroPagina === 1) {
    for (const slot of slotsHeader) {
      expect(contiene(header, slot as Rect), `slot ${slot.id} fuera de la cabecera`).toBe(true);
      expect(interseca(slot as Rect, qr), `slot ${slot.id} invade el QR`).toBe(false);
      if (slot.id === 'logo-izquierdo' || slot.id === 'logo-derecho') {
        expect(slot.width).toBeGreaterThanOrEqual(64);
        expect(slot.height).toBeGreaterThanOrEqual(64);
      }
    }
  }
  if (continuationBand) {
    assertRectDentroPagina(continuationBand);
    for (let i = 0; i < continuationTextBlocks.length; i += 1) {
      const bloque = continuationTextBlocks[i] as Rect;
      expect(contiene(continuationBand, bloque), `texto ${continuationTextBlocks[i]?.id} fuera de la banda`).toBe(true);
      for (let j = i + 1; j < continuationTextBlocks.length; j += 1) {
        expect(
          interseca(bloque, continuationTextBlocks[j] as Rect),
          `solape en banda de continuacion entre ${continuationTextBlocks[i]?.id} y ${continuationTextBlocks[j]?.id}`
        ).toBe(false);
      }
    }
  }
}

function assertPreguntasLayout(
  pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number],
  altaDensidad = false
) {
  if (pagina.tipoPagina === 'reverso-vacio') {
    expect(pagina.preguntas).toHaveLength(0);
    expect(pagina.qr).toBeUndefined();
    expect(pagina.marcasPagina).toBeUndefined();
    expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    return;
  }
  const preguntas = Array.isArray(pagina.preguntas) ? pagina.preguntas : [];
  const qr = pagina.layoutDebug?.qr as Rect | undefined;
  const fondosPreguntas = Array.isArray(pagina.layoutDebug?.questionBackgroundBoxes)
    ? pagina.layoutDebug.questionBackgroundBoxes as Rect[]
    : [];
  const cajasPregunta = Array.isArray(pagina.layoutDebug?.questionPromptBoxes)
    ? pagina.layoutDebug.questionPromptBoxes as Rect[]
    : [];
  for (let i = 0; i < preguntas.length; i += 1) {
    const actual = preguntas[i];
    expect(Array.isArray(actual.textRuns)).toBe(true);
    expect((actual.textRuns ?? []).length).toBeGreaterThan(0);
    const fondoPregunta = fondosPreguntas[i];
    expect(fondoPregunta, `falta el fondo del reactivo ${actual.numeroPregunta}`).toBeDefined();
    if (fondoPregunta) {
      assertRectDentroPagina(fondoPregunta);
      for (const run of actual.textRuns ?? []) {
        expect(
          contiene(fondoPregunta, run.bbox, 0.05),
          `el texto del reactivo ${actual.numeroPregunta} queda fuera de su fondo`
        ).toBe(true);
      }
    }
    const cajaPregunta = cajasPregunta[i];
    expect(cajaPregunta, `falta la caja punteada del enunciado ${actual.numeroPregunta}`).toBeDefined();
    if (cajaPregunta && fondoPregunta) {
      assertRectDentroPagina(cajaPregunta);
      expect(contiene(fondoPregunta, cajaPregunta, 0.05)).toBe(true);
      expect(cajaPregunta.height).toBeLessThan(fondoPregunta.height);
      for (const run of actual.textRuns ?? []) {
        const cruzaBordeInferior = run.bbox.y < cajaPregunta.y && run.bbox.y + run.bbox.height > cajaPregunta.y;
        expect(
          cruzaBordeInferior,
          `el texto del reactivo ${actual.numeroPregunta} cruza el borde inferior punteado`
        ).toBe(false);
      }
    }
    if (!actual.bboxPregunta) continue;
    const bbox = actual.bboxPregunta;
    assertRectDentroPagina(bbox);

    const omr = actual.cajaOmr;
    if (omr) {
      expect(omr.x + omr.width).toBeLessThanOrEqual(ANCHO_CARTA - 6.9);
      if (actual.perfilOmr?.orientacion === 'horizontal') {
        // El panel debe usar la reserva derecha prevista, sin invadir el
        // margen nominal ni volver a quedar innecesariamente separado del
        // borde imprimible.
        expect(omr.x + omr.width).toBeCloseTo(ANCHO_CARTA - (10 * 72 / 25.4) - 4, 5);
        // El panel compacto puede bajar a 25 pt, conservando burbuja de 6.4 mm,
        // distancia a la etiqueta y quiet zones; los paneles normales retienen
        // su reserva vertical mayor.
        expect(omr.height).toBeGreaterThanOrEqual(altaDensidad ? 26.5 : 30);
        // El perfil estándar usa más aire; 38+ reactivos reserva 1.2 pt arriba
        // y al menos 1.9 pt entre la etiqueta y el borde inferior.
        expect(omr.height).toBeLessThanOrEqual(35);
        expect(actual.perfilOmr?.etiquetaBordeInferiorGap).toBeGreaterThan(altaDensidad ? 0.99 : 0.79);
      }
      for (const run of actual.textRuns ?? []) {
        expect(interseca(run.bbox, omr), `texto superpuesto al OMR en pregunta ${actual.numeroPregunta}`).toBe(false);
      }
      if (pagina.numeroPagina > 1 && i === 0 && qr) {
        expect(interseca(omr, qr), 'el primer panel de continuacion invade el QR').toBe(false);
        for (const run of actual.textRuns ?? []) {
          expect(interseca(run.bbox, qr), 'el texto de continuacion invade el QR').toBe(false);
        }
      }
    }
    if (actual.imagen) {
      const imagen = actual.imagen as Rect;
      assertRectDentroPagina(imagen);
      for (const run of actual.textRuns ?? []) {
        expect(interseca(run.bbox, imagen), `texto superpuesto a imagen en pregunta ${actual.numeroPregunta}`).toBe(false);
      }
    }
    if (omr && actual.perfilOmr && Array.isArray(actual.opciones) && actual.opciones.length > 0) {
      const radio = Number(actual.perfilOmr.radio ?? 0);
      expect(actual.opciones.length).toBe(5);
      for (let idx = 0; idx < actual.opciones.length; idx += 1) {
        const opcion = actual.opciones[idx]!;
        expect(opcion.x - radio).toBeGreaterThanOrEqual(omr.x - 0.01);
        expect(opcion.x + radio).toBeLessThanOrEqual(omr.x + omr.width + 0.01);
        expect(opcion.y - radio).toBeGreaterThanOrEqual(omr.y - 0.01);
        expect(opcion.y + radio).toBeLessThanOrEqual(omr.y + omr.height + 0.01);
        if (idx > 0) {
          const anterior = actual.opciones[idx - 1]!;
          if (actual.perfilOmr.orientacion === 'horizontal') {
            expect(opcion.y).toBeCloseTo(anterior.y, 5);
            expect(Math.abs(opcion.x - anterior.x)).toBeGreaterThanOrEqual(radio * 2 + 0.5);
          } else {
            expect(opcion.x).toBeCloseTo(anterior.x, 5);
            expect(Math.abs(opcion.y - anterior.y)).toBeGreaterThanOrEqual(radio * 2 + 0.5);
          }
        }
      }
    }

    if (i > 0 && preguntas[i - 1]?.bboxPregunta) {
      const prev = preguntas[i - 1]!.bboxPregunta as Rect;
      expect(interseca(prev, bbox), `solape en preguntas ${preguntas[i - 1]?.numeroPregunta} y ${actual.numeroPregunta}`).toBe(false);
      const separacionReal = prev.y - (bbox.y + bbox.height);
      // El hueco editorial adicional debe ser cero; queda únicamente la
      // separación funcional de la línea divisoria y la guarda tipográfica.
      expect(separacionReal).toBeGreaterThanOrEqual(-0.01);
      expect(separacionReal).toBeLessThanOrEqual(8);
    }
  }
}

function assertPrimeraPreguntaDebajoDelHeader(
  pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number],
  header: Rect
) {
  if (pagina.numeroPagina !== 1 || pagina.preguntas.length === 0) return;
  const primera = pagina.preguntas[0]?.bboxPregunta;
  if (!primera) return;
  expect(primera.y + primera.height).toBeLessThanOrEqual(header.y + 0.01);
  const instructions = pagina.layoutDebug?.instructions as Rect | undefined;
  if (instructions) {
    assertRectDentroPagina(instructions);
    expect(primera.y + primera.height).toBeLessThanOrEqual(instructions.y - 0.5);
    for (const run of pagina.preguntas[0]?.textRuns ?? []) {
      expect(interseca(run.bbox, instructions), 'glifo del primer reactivo superpuesto a indicaciones').toBe(false);
    }
  }
}

function crearParametros(cantidadPreguntas = 24) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= cantidadPreguntas; i += 1) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta corta ${i}: selecciona la opcion correcta.`,
      opciones: [
        { texto: 'Opcion A', esCorrecta: i % 5 === 1 },
        { texto: 'Opcion B', esCorrecta: i % 5 === 2 },
        { texto: 'Opcion C', esCorrecta: i % 5 === 3 },
        { texto: 'Opcion D', esCorrecta: i % 5 === 4 },
        { texto: 'Opcion E', esCorrecta: i % 5 === 0 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return {
    titulo: 'Primer Parcial',
    folio: 'LAYOUT-GUARD-001',
    preguntas,
    mapaVariante,
    tipoExamen: 'parcial' as const,
    totalPaginas: 3,
    margenMm: 10,
    templateVersion: 4 as const
  };
}

function crearParametrosBrevesCompactos(cantidadPreguntas: number) {
  const parametros = crearParametros(cantidadPreguntas);
  for (const pregunta of parametros.preguntas) {
    pregunta.enunciado = '¿Cuánto es 2 + 2?';
    pregunta.opciones = ['1', '2', '4', '6', '8'].map((texto, indice) => ({
      texto,
      esCorrecta: indice === 2
    }));
  }
  return parametros;
}

describe('pdf layout visual guard', () => {
  it('dibuja y mapea una burbuja por opción en la plantilla experimental sin carril OMR separado', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(1),
      totalPaginas: 1,
      examId: 'INLINE-QA-EXAM-01',
      omrTemplateId: 'omr-inline-exam-v1'
    });
    const pagina = resultado.mapaOmr.paginas.find((item) => item.tipoPagina !== 'reverso-vacio');
    const pregunta = pagina?.preguntas[0];
    expect(resultado.mapaOmr.templateId).toBe('omr-inline-exam-v1');
    expect(pagina?.templateId).toBe('omr-inline-exam-v1');
    const qrInline = String(pagina?.qr?.texto ?? '');
    const resumenQrInline = extraerResumenQrExamen(qrInline);
    expect(resumenQrInline?.templateId).toBe('omr-inline-exam-v1');
    expect(resumenQrInline?.qrPayloadMode).toBe('manifest-bound');
    expect(resumenQrInline?.examId).toBeTruthy();
    expect(resumenQrInline?.payloadSignatureValid).toBe(true);
    expect(resumenQrInline?.keyId).toBeTruthy();
    expect(resumenQrInline?.answerKeyHash).toBeUndefined();
    expect(qrInline).toContain('TI:omr-inline-exam-v1');
    expect(qrInline).not.toMatch(/:(?:VH|AK|K):/);
    expect(pagina?.engineHints?.useMapCoordinatesStrict).toBe(true);
    expect(pregunta?.perfilOmr?.ubicacion).toBe('junto-a-opcion');
    expect(pregunta?.fiduciales).toBeUndefined();
    expect(pregunta?.opciones).toHaveLength(5);
    expect(pagina?.qr?.marginModules).toBe(4);
    expect(pagina?.qr?.matrixModules).toBeGreaterThan(0);
    expect(pagina?.qr?.moduleSize).toBeCloseTo(
      Number(pagina?.qr?.size) / (Number(pagina?.qr?.matrixModules) + Number(pagina?.qr?.marginModules) * 2),
      6
    );
    const reversoVacio = resultado.mapaOmr.paginas.find((item) => item.tipoPagina === 'reverso-vacio');
    expect(reversoVacio).toMatchObject({ numeroPagina: 2, duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 }, preguntas: [] });
    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({ partial: [1, 2], desiredWidth: 1530, imageBuffer: true, imageDataUrl: false });
      expect(capturas.pages).toHaveLength(2);
      const qrFinal = await sharp(capturas.pages[0]!.data).png().toBuffer();
      expect(await leerQrDesdeImagen(`data:image/png;base64,${qrFinal.toString('base64')}`)).toBe(pagina?.qr?.texto);
      const dorso = await sharp(capturas.pages[1]!.data).removeAlpha().raw().toBuffer();
      expect([...dorso].some((pixel) => pixel < 250)).toBe(false);
    } finally {
      await parser.destroy();
    }

    const opciones = pregunta?.opciones ?? [];
    const radioEsperado = 4 * 72 / 25.4;
    for (const opcion of opciones) {
      expect(opcion.radio).toBeCloseTo(radioEsperado, 4);
      const roi = { x: opcion.x - opcion.radio!, y: opcion.y - opcion.radio!, width: 2 * opcion.radio!, height: 2 * opcion.radio! };
      assertRectDentroPagina(roi);
      for (const run of pregunta?.textRuns ?? []) {
        expect(interseca(roi, run.bbox), `la burbuja ${opcion.letra} no debe cubrir texto`).toBe(false);
      }
    }
    expect(Math.max(...opciones.map((item) => item.x)) - Math.min(...opciones.map((item) => item.x))).toBeLessThan(0.01);
    const pasosY = opciones.slice(1).map((item, index) => Math.abs(item.y - opciones[index]!.y));
    for (const pasoY of pasosY) expect(pasoY).toBeGreaterThanOrEqual(10.5 * 72 / 25.4 - 0.1);
  });

  it('mantiene las burbujas inline separadas de opciones multilínea al repartir preguntas en páginas', async () => {
    const parametros = crearParametros(8);
    for (const pregunta of parametros.preguntas) {
      pregunta.enunciado = 'Analice el siguiente caso y seleccione la afirmación que describe correctamente el comportamiento del sistema.';
      pregunta.opciones = [
        'La alternativa describe una condición de entrada y explica el resultado esperado en el flujo normal de ejecución.',
        'La alternativa describe una condición distinta y detalla el efecto que produce sobre el estado persistido.',
        'La alternativa describe una condición de error y el mecanismo de recuperación que conserva la consistencia.',
        'La alternativa describe una condición límite y precisa el resultado observable para el usuario final.',
        'La alternativa describe una condición de concurrencia y explica cómo se resuelve el conflicto resultante.'
      ].map((texto, indice) => ({ texto, esCorrecta: indice === 2 }));
    }

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      examId: 'INLINE-QA-MULTILINE-01',
      omrTemplateId: 'omr-inline-exam-v1',
      encabezado: { institucion: 'Centro de prueba', materia: 'Geometría OMR multilínea' }
    });
    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');

    expect(paginas.length).toBeGreaterThan(1);
    expect(paginas.flatMap((pagina) => pagina.preguntas)).toHaveLength(8);
    expect(resultado.preguntasRestantes).toBe(0);
    for (const pagina of paginas) {
      expect(pagina.templateId).toBe('omr-inline-exam-v1');
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      expect(pagina.layoutDebug?.lineHeightViolations ?? []).toHaveLength(0);
      for (const pregunta of pagina.preguntas) {
        expect(pregunta.opciones).toHaveLength(5);
        expect(pregunta.fiduciales).toBeUndefined();
        for (const opcion of pregunta.opciones) {
          const radio = opcion.radio ?? 0;
          const roi = { x: opcion.x - radio, y: opcion.y - radio, width: radio * 2, height: radio * 2 };
          assertRectDentroPagina(roi);
          for (const run of pregunta.textRuns ?? []) {
            expect(interseca(roi, run.bbox), `la burbuja ${opcion.letra} no debe cubrir texto multilínea`).toBe(false);
          }
        }
      }
    }
    expect(resultado.mapaOmr.paginas.map((pagina) => pagina.tipoPagina)).toEqual(
      paginas.flatMap(() => ['examen', 'reverso-vacio'])
    );
    expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);
  });

  it('imprime folio y página en dos posiciones independientes del pie', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(1),
      folio: 'OCR-SERIAL-TEST-01',
      totalPaginas: 1,
      encabezado: { institucion: 'Centro de prueba', materia: 'Identificación de hoja' }
    });
    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const texto = (await parser.getText()).text;
      expect(texto.match(/OCR-SERIAL-TEST-01\s*[·•]\s*Pagina\s*1/gi)).toHaveLength(2);
    } finally {
      await parser.destroy();
    }
  });

  it('valida no solapes, cajas dentro de pagina y densidad controlada por pagina', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(24),
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Ceron',
        instrucciones: 'Rellene un solo circulo por pregunta y evite marcas fuera del area.',
        mostrarMarcaInstitucional: true
      }
    });
    expect(resultado.metricasLayout).toBeTruthy();
    expect(resultado.mapaOmr.perfil.marcasEsquina).toBe('cuadrados');
    expect(resultado.metricasLayout?.fontSizePregunta ?? 0).toBeGreaterThanOrEqual(10);
    expect(resultado.metricasLayout?.fontSizeOpcion ?? 0).toBeGreaterThanOrEqual(8.5);
    expect(resultado.metricasLayout?.fontSizeIndicaciones ?? 0).toBeGreaterThanOrEqual(7.5);
    expect(resultado.metricasLayout?.lineHeightPregunta ?? 0).toBeGreaterThanOrEqual(12);
    expect(resultado.metricasLayout?.lineHeightOpcion ?? 0).toBeGreaterThanOrEqual(10.2);
    expect((resultado.metricasLayout?.minLineHeightApplied ?? 0) >= 8.2).toBe(true);
    expect(resultado.mapaOmr.perfil.qrSize).toBeCloseTo(32 * (72 / 25.4), 5);
    expect(resultado.mapaOmr.perfil.qrPadding).toBeCloseTo(3 * (72 / 25.4), 5);
    expect(resultado.mapaOmr.perfil.qrMarginModulos).toBe(4);
    assertConteoPreguntasPorPagina(resultado);

    const metaBlocks = (resultado.mapaOmr.paginas[0]?.layoutDebug?.headerTextBlocks ?? [])
      .filter((bloque) => bloque.id.startsWith('meta-'));
    expect(metaBlocks.length).toBe(2);
    expect((metaBlocks[0]?.y ?? 0) - (metaBlocks[1]?.y ?? 0)).toBeGreaterThan(5);

    for (const pagina of resultado.mapaOmr.paginas) {
      if (pagina.tipoPagina === 'reverso-vacio') {
        expect(pagina.preguntas).toHaveLength(0);
        continue;
      }
      const dbg = pagina.layoutDebug;
      expect(dbg).toBeTruthy();
      const header = dbg?.header as Rect;
      assertBloquesHeader(pagina, header);
      if (pagina.numeroPagina === 1) {
        // El QR de 32 mm añade solo su reserva física necesaria a la cabecera;
        // conservar el techo evita que el encabezado vuelva a crecer sin límite.
        expect(header.height).toBeLessThanOrEqual(162.01);
      }
      assertPreguntasLayout(pagina);
      assertPrimeraPreguntaDebajoDelHeader(pagina, header);
    }
  });

  it('separa la fila de datos del alumno de los logotipos', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(4),
      totalPaginas: 1,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Ceron',
        instrucciones: 'Rellene un solo circulo por pregunta y evite marcas fuera del area.',
        alumno: { nombre: 'Erick Renato Vega Ceron', primerNombre: 'Erick', iniciales: 'ERVC', grupo: 'E512606A' },
        mostrarMarcaInstitucional: true
      }
    });

    const primeraPagina = resultado.mapaOmr.paginas[0]!;
    const bloques = primeraPagina.layoutDebug?.headerTextBlocks ?? [];
    const slots = primeraPagina.layoutDebug?.headerSlots ?? [];
    const nombre = bloques.find((bloque) => bloque.id === 'nombre-etiqueta');
    const grupo = bloques.find((bloque) => bloque.id === 'grupo-etiqueta');
    const identidad = bloques.find((bloque) => bloque.id === 'alumno-identidad');
    const logos = slots.filter((slot) => slot.id === 'logo-izquierdo' || slot.id === 'logo-derecho');

    expect(nombre).toBeDefined();
    expect(grupo).toBeDefined();
    expect(identidad).toBeDefined();
    expect(bloques.some((bloque) => bloque.id === 'alumno-iniciales')).toBe(false);
    expect(Number(identidad?.x ?? 0)).toBeGreaterThanOrEqual(Number(nombre?.x ?? 0));
    expect(logos).toHaveLength(2);
    const bordeInferiorLogos = Math.min(...logos.map((logo) => Number(logo.y)));
    expect(bordeInferiorLogos - Number(nombre?.y ?? 0) - Number(nombre?.height ?? 0))
      .toBeGreaterThanOrEqual(6);
    expect(bordeInferiorLogos - Number(grupo?.y ?? 0) - Number(grupo?.height ?? 0))
      .toBeGreaterThanOrEqual(6);
    expect(primeraPagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });

  it('mantiene el encabezado compacto libre de identidad institucional oculta', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(12),
      totalPaginas: 2,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Cerón',
        mostrarMarcaInstitucional: false
      }
    });

    const primerEncabezado = resultado.mapaOmr.paginas[0]?.layoutDebug?.headerTextBlocks ?? [];
    const primerHeaderSlots = resultado.mapaOmr.paginas[0]?.layoutDebug?.headerSlots ?? [];
    expect(primerEncabezado.some((bloque) => /^(institucion|lema|meta)-/.test(bloque.id))).toBe(false);
    expect(primerEncabezado.some((bloque) => /^titulo-/.test(bloque.id))).toBe(true);
    expect(primerHeaderSlots.some((slot) => slot.id.startsWith('logo-'))).toBe(false);
    const continuacion = resultado.mapaOmr.paginas[1]?.layoutDebug?.continuationTextBlocks ?? [];
    expect(continuacion).toEqual([]);
    expect(resultado.mapaOmr.paginas[1]?.layoutDebug?.continuationBand).toBeUndefined();
  });

  it('envuelve las indicaciones largas antes de la reserva del QR', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(6),
      totalPaginas: 1,
      encabezado: {
        instrucciones: 'Lea cada reactivo con atención. Marque una sola respuesta rellenando completamente el círculo, sin invadir sus bordes. Revise nombre, grupo y folio antes de entregar la hoja.',
        mostrarInstrucciones: true,
        mostrarMarcaInstitucional: false
      }
    });

    const primeraPagina = resultado.mapaOmr.paginas[0]!;
    const dbg = primeraPagina.layoutDebug!;
    const qr = dbg.qr as Rect;
    const indicaciones = (dbg.headerTextBlocks ?? [])
      .filter((bloque) => bloque.id.startsWith('indicaciones-'));
    expect(indicaciones.length).toBeGreaterThanOrEqual(3);
    expect(dbg.collisionBoxes).toEqual([]);
    for (const bloque of indicaciones) {
      expect(bloque.x + bloque.width).toBeLessThanOrEqual(qr.x - 8);
    }
  });

  it('sanitiza simbolos OMR no codificables en la fuente legacy', async () => {
    const parametros = crearParametros(6);
    parametros.preguntas[0]!.enunciado = 'Marca el circulo correcto: ● lleno, ◐ medio, ✗ tachado y ✓ valido.';

    const resultado = await generarPdfExamen(parametros);

    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(0);
  });

  it('mantiene separacion de cabecera con tipografia ampliada', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(6),
      bookletConfig: { fontScale: 1.1, lineSpacing: 1.15 },
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Ceron',
        mostrarMarcaInstitucional: true
      }
    });

    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(0);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      expect(pagina.layoutDebug?.lineHeightViolations ?? []).toHaveLength(0);
    }
  });

  it('envuelve cabeceras largas sin truncar identidad ni invadir sus reservas', async () => {
    const parametros = crearParametros(3);
    parametros.titulo = 'Evaluacion integral de protocolos HTTP, arquitectura de servicios y desarrollo web';
    const resultado = await generarPdfExamen({
      ...parametros,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense - Facultad de Ingenieria y Tecnologias Aplicadas',
        lema: 'La sabiduria es nuestra fuerza y el conocimiento transforma nuestra comunidad universitaria',
        materia: 'Diseno y Desarrollo de Aplicaciones Web y Servicios Distribuidos',
        docente: 'Erick Renato Vega Ceron, Departamento de Sistemas y Computacion',
        mostrarInstrucciones: false,
        mostrarMarcaInstitucional: true
      },
      bookletConfig: { fontScale: 1.1, lineSpacing: 1.12 }
    });

    const pagina = resultado.mapaOmr.paginas[0]!;
    const header = pagina.layoutDebug?.header as Rect;
    const bloques = pagina.layoutDebug?.headerTextBlocks ?? [];

    expect(header.height).toBeGreaterThan(96);
    expect(bloques.filter((bloque) => bloque.id.startsWith('institucion-')).length).toBeGreaterThan(1);
    expect(bloques.filter((bloque) => bloque.id.startsWith('titulo-')).length).toBeGreaterThan(1);
    expect(bloques.filter((bloque) => bloque.id.startsWith('lema-')).length).toBeGreaterThan(1);
    for (const bloque of bloques) {
      expect(contiene(header, bloque as Rect), `bloque ${bloque.id} fuera de la cabecera`).toBe(true);
    }
    expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(0);
  });

  it('renderiza formato rico con subrayado sin perder el contrato de layout', async () => {
    const parametros = crearParametros(1);
    parametros.preguntas[0]!.enunciado = '**Pregunta importante** con *énfasis* y __texto clave__.';

    const resultado = await generarPdfExamen(parametros);

    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(0);
    expect(resultado.mapaOmr.blockSpec?.bubbleDiameterMm).toBe(6.4);
    expect(resultado.mapaOmr.perfil.cajaOmrAncho).toBe(147);
    expect(resultado.mapaOmr.blockSpec?.bubblePitchXmm).toBe(9.17);
    expect(resultado.mapaOmr.blockSpec?.orientation).toBe('horizontal');
  });

  it('renderiza etiquetas enriquecidas de opciones sin exponer Markdown literal', async () => {
    const parametros = crearParametros(1);
    parametros.preguntas[0]!.enunciado = '<strong>Pregunta enriquecida</strong> con <em>énfasis</em>, H<sub>2</sub>O, <span data-latex="\\frac{x^2+1}{y_1}">\\(formula\\)</span> y <span data-latex="\\alpha + \\beta">\\(formula\\)</span>.';
    parametros.preguntas[0]!.opciones = [
      { texto: '<strong>Respuesta principal</strong> con <u>detalle</u>.', esCorrecta: true },
      { texto: 'Alternativa con <em>énfasis</em>.', esCorrecta: false },
      { texto: 'Opción con subíndice CO₂.', esCorrecta: false },
      { texto: 'Fórmula x² + y².', esCorrecta: false },
      { texto: 'Respuesta final.', esCorrecta: false }
    ];

    const resultado = await generarPdfExamen({
      ...parametros,
      bookletConfig: { densityMode: 'compact' }
    });
    const parser = new PDFParse({ data: resultado.pdfBytes });
    const texto = (await parser.getText()).text;
    await parser.destroy();

    expect(texto).not.toContain('**A)**');
    expect(texto).not.toContain('\\frac');
    expect(texto).not.toContain('\\(');
    expect(texto).not.toContain('\uFFFD');
    expect(texto).toMatch(/A\)\s*Respuesta principal/);
    expect(texto).toContain('alpha + beta');
    expect(texto).toMatch(/H\s*2\s*O/);
    expect(resultado.mapaOmr.blockSpec?.orientation).toBe('horizontal');
    expect(resultado.mapaOmr.paginas[0]?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });

  it('permite contenido rico en veinte reactivos cuando conserva el layout completo', async () => {
    const parametros = crearParametros(20);
    parametros.preguntas[0]!.enunciado = '<strong>Reactivo enriquecido</strong>: analiza <span data-latex="\\frac{x^2+1}{y_1}">\\(formula\\)</span>.';
    parametros.preguntas[0]!.imagenUrl = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180"><rect width="640" height="180" fill="#eef6fb"/><text x="320" y="105" text-anchor="middle" font-size="40">f(x)=(x²+1)/y₁</text></svg>'
    ).toString('base64')}`;

    const resultado = await generarPdfExamen({ ...parametros, totalPaginas: 2 });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.length).toBeGreaterThanOrEqual(2);
    expect(resultado.mapaOmr.paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('mantiene paridad de altura cuando una fila comparte una opcion de varias lineas', async () => {
    const parametros = crearParametros(25);
    parametros.preguntas[4]!.enunciado = '<strong>JavaScript</strong>: analiza el siguiente algoritmo y determina el resultado.';
    parametros.preguntas[4]!.opciones = [
      { texto: '<strong>Resultado principal</strong> con texto suficientemente largo para ocupar dos líneas y probar la retícula compartida.', esCorrecta: true },
      { texto: 'Alternativa breve.', esCorrecta: false },
      { texto: 'Otra alternativa breve.', esCorrecta: false },
      { texto: 'Opción adicional.', esCorrecta: false },
      { texto: 'Respuesta final.', esCorrecta: false }
    ];

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { mostrarMarcaInstitucional: false }
    });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
      .toEqual(Array.from({ length: 25 }, (_valor, indice) => indice + 1));
    expect(resultado.mapaOmr.paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('separa imagenes de pregunta, opciones y banda de continuacion', async () => {
    const parametros = crearParametros(20);
    parametros.titulo = 'Evaluacion integral de protocolos, servicios y arquitectura web distribuida';
    parametros.preguntas[0]!.imagenUrl = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="400" height="120" fill="#eef6fb"/><rect x="8" y="8" width="384" height="104" fill="#fff" stroke="#147db3" stroke-width="4"/></svg>'
    ).toString('base64')}`;

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 1,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Control de calidad',
        docente: 'EvaluaPro QA'
      }
    });

    expect(resultado.mapaOmr.paginas.length).toBeGreaterThan(1);
    const imagen = resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas).find((pregunta) => pregunta.imagen);
    expect(imagen?.imageRenderStatus).toBe('ok');
    expect(imagen?.imagen).toBeTruthy();
    expect(imagen?.imagenDisposicion).toBe('lateral');
    expect(imagen?.imagen?.x).toBeGreaterThan(150);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      const band = pagina.layoutDebug?.continuationBand;
      const blocks = pagina.layoutDebug?.continuationTextBlocks ?? [];
      if (band) {
        for (const block of blocks) expect(contiene(band as Rect, block as Rect)).toBe(true);
      }
    }
  });

  it('empaqueta doce reactivos en una página sin solapes con el panel horizontal canónico', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(12),
      totalPaginas: 2,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseno y Desarrollo de Aplicaciones Web',
        docente: 'EvaluaPro QA',
        instrucciones: 'Rellene un solo circulo por pregunta. Use tinta oscura y evite marcas fuera del area.'
      }
    });

    const conteos = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => pagina.preguntas.length);
    expect(conteos).toHaveLength(1);
    expect(conteos.reduce((total, conteo) => total + conteo, 0)).toBe(12);
    expect(Math.max(...conteos) - Math.min(...conteos)).toBeLessThanOrEqual(1);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('empaqueta trece reactivos cortos en una página manteniendo legibilidad y geometría OMR', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(13),
      totalPaginas: 1,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseno y Desarrollo de Aplicaciones Web',
        docente: 'EvaluaPro QA',
        instrucciones: 'Marque una opcion por reactivo.'
      }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas).toHaveLength(1);
    expect(paginas[0]?.preguntas).toHaveLength(13);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.blockSpec).toMatchObject({
      orientation: 'horizontal',
      bubbleDiameterMm: 6.4,
      bubblePitchXmm: 9.17
    });
    expect(paginas[0]?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    expect(paginas[0]?.layoutDebug?.lineHeightViolations ?? []).toHaveLength(0);
  });

  it('empaqueta quince reactivos breves con cabecera docente dentro del margen seguro', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(15),
      totalPaginas: 1,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseno y Desarrollo de Aplicaciones Web',
        docente: 'EvaluaPro QA',
        instrucciones: 'Marque una opcion por reactivo.'
      }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas).toHaveLength(1);
    expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual([15]);
    expect(paginas.reduce((total, pagina) => total + pagina.preguntas.length, 0)).toBe(15);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.lineHeightViolations ?? []).length === 0)).toBe(true);
    expect(paginas.every((pagina) => Boolean(pagina.qr?.texto?.length))).toBe(true);
    expect(paginas[0]?.layoutDebug?.contentEndY ?? 0).toBeGreaterThan(0);
  });

  it('aprovecha ambas caras para distribuir veintisiete reactivos cortos sin degradar la geometria OMR', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(27),
      totalPaginas: 2,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseno y Desarrollo de Aplicaciones Web',
        docente: 'EvaluaPro QA',
        instrucciones: 'Marque una opcion por reactivo.'
      }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas).toHaveLength(2);
    expect(paginas.reduce((total, pagina) => total + pagina.preguntas.length, 0)).toBe(27);
    expect(Math.max(...paginas.map((pagina) => pagina.preguntas.length))).toBeLessThanOrEqual(25);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.lineHeightViolations ?? []).length === 0)).toBe(true);
    const mapa = resultado.mapaOmr;
    expect(mapa.impresion).toMatchObject({ modo: 'duplex', volteo: 'borde-largo', toleranciaRegistroMm: 3 });
    expect(detectarColisionesDuplexOmr(mapa)).toHaveLength(0);
    const frente = mapa.paginas.find((pagina) => pagina.duplex?.lado === 'frente');
    const reverso = mapa.paginas.find((pagina) => pagina.duplex?.lado === 'reverso');
    expect(frente?.preguntas.length).toBeGreaterThan(0);
    expect(reverso?.preguntas.length).toBeGreaterThan(0);
    const separacionMinimaPt = Number(mapa.perfil?.burbujaRadio) * 2 + 3 * (72 / 25.4);
    const distanciasTrasVolteo = (frente?.preguntas ?? []).flatMap((preguntaFrente) =>
      preguntaFrente.opciones.flatMap((opcionFrente) =>
        (reverso?.preguntas ?? []).flatMap((preguntaReverso) => preguntaReverso.opciones.map((opcionReverso) => {
          const xReversoVolteado = ANCHO_CARTA - opcionReverso.x;
          return Math.hypot(opcionFrente.x - xReversoVolteado, opcionFrente.y - opcionReverso.y);
        }))
      )
    );
    expect(Math.min(...distanciasTrasVolteo)).toBeGreaterThanOrEqual(separacionMinimaPt);
  });

  it.each([
    { total: 29, paginasEsperadas: [13, 16] },
    { total: 30, paginasEsperadas: [13, 17] }
  ])('maximiza la capacidad OMR segura para $total reactivos breves', async ({ total, paginasEsperadas }) => {
    const resultado = await generarPdfExamen({
      ...crearParametros(total),
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: {
        institucion: 'Centro de prueba',
        materia: 'Control OMR',
        mostrarMarcaInstitucional: false
      }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual(paginasEsperadas);
    expect(paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
      .toEqual(Array.from({ length: total }, (_valor, indice) => indice + 1));
    expect(resultado.preguntasRestantes).toBe(0);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.lineHeightViolations ?? []).length === 0)).toBe(true);
    expect(resultado.mapaOmr.impresion).toMatchObject({ modo: 'duplex', volteo: 'borde-largo' });
    expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);
  });

  it('maximiza reactivos breves con panel OMR lateral y mantiene QR legibles en ambas páginas', async () => {
    const parametros = crearParametros(34);
    for (const pregunta of parametros.preguntas) {
      pregunta.enunciado = '¿Cuánto es 2 + 2?';
      pregunta.opciones = ['1', '2', '4', '6', '8'].map((texto, indice) => ({
        texto,
        esCorrecta: indice === 2
      }));
    }
    parametros.totalPaginas = 2;

    const resultado = await generarPdfExamen({
      ...parametros,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { institucion: 'Centro de prueba', materia: 'Control de capacidad', mostrarMarcaInstitucional: true }
    });
    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');

    expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual([15, 19]);
    expect(paginas.reduce((total, pagina) => total + pagina.preguntas.length, 0)).toBe(34);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.metricasLayout?.fontSizePregunta).toBeGreaterThanOrEqual(10.4);
    expect(resultado.metricasLayout?.fontSizeOpcion).toBeGreaterThanOrEqual(8.8);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
    expect(paginas.every((pagina) => Boolean(pagina.qr?.texto?.length))).toBe(true);
    expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({
        partial: paginas.map((pagina) => pagina.numeroPagina),
        desiredWidth: 1600,
        imageBuffer: true,
        imageDataUrl: false
      });
      expect(capturas.pages).toHaveLength(paginas.length);
      for (const [indice, captura] of capturas.pages.entries()) {
        const jpegMovil = await sharp(captura.data)
          .resize({ width: 1600, withoutEnlargement: true })
          .blur(0.3)
          .jpeg({ quality: 72, chromaSubsampling: '4:2:0' })
          .toBuffer();
        expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovil.toString('base64')}`))
          .toBe(paginas[indice]?.qr?.texto);
      }
    } finally {
      await parser.destroy();
    }
  });

  it('aprovecha la capacidad física combinada para 35 reactivos en dos páginas', async () => {
    const parametros = crearParametros(35);
    for (const pregunta of parametros.preguntas) {
      pregunta.enunciado = '¿Cuánto es 2 + 2?';
      pregunta.opciones = ['1', '2', '4', '6', '8'].map((texto, indice) => ({
        texto,
        esCorrecta: indice === 2
      }));
    }

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { institucion: 'Centro de prueba', materia: 'Control de capacidad', mostrarMarcaInstitucional: false }
    });
    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');

    expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual([17, 18]);
    expect(paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
      .toEqual(Array.from({ length: 35 }, (_valor, indice) => indice + 1));
    expect(paginas.flatMap((pagina) => pagina.preguntas).every((pregunta) => pregunta.opciones?.length === 5))
      .toBe(true);
    expect(paginas.every((pagina) =>
      pagina.qr?.errorCorrectionLevel === 'H'
      && (pagina.qr.texto?.length ?? Number.POSITIVE_INFINITY) <= 70
      && (pagina.qr.matrixModules ?? 0) <= 41
    )).toBe(true);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.pdfBytes.length, 'la trama abierta debe mantener compacto el PDF de 35 reactivos').toBeLessThan(650_000);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
    expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({
        partial: paginas.map((pagina) => pagina.numeroPagina),
        desiredWidth: 1600,
        imageBuffer: true,
        imageDataUrl: false
      });
      expect(capturas.pages).toHaveLength(paginas.length);
      for (const [indice, captura] of capturas.pages.entries()) {
        const jpegMovil = await sharp(captura.data)
          .resize({ width: 1600, withoutEnlargement: true })
          .blur(0.3)
          .jpeg({ quality: 72, chromaSubsampling: '4:2:0' })
          .toBuffer();
        expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovil.toString('base64')}`))
          .toBe(paginas[indice]?.qr?.texto);

        // El QR compacto debe seguir decodificándose en una captura reducida,
        // comprimida y ligeramente desenfocada; no basta la rasterización
        // grande usada para inspección visual.
        const jpegMovilReducida = await sharp(captura.data)
          .resize({ width: 800, withoutEnlargement: true })
          .blur(0.5)
          .jpeg({ quality: 60, chromaSubsampling: '4:2:0' })
          .toBuffer();
        expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovilReducida.toString('base64')}`))
          .toBe(paginas[indice]?.qr?.texto);
      }
    } finally {
      await parser.destroy();
    }
  }, 300_000);

  it('acomoda 36 reactivos breves compactos en dos páginas sin reducir OMR ni QR', async () => {
    const parametros = crearParametrosBrevesCompactos(36);

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { institucion: 'Centro de prueba', materia: 'Control de capacidad', mostrarMarcaInstitucional: false }
    });
    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual([18, 18]);
    expect(paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
      .toEqual(Array.from({ length: 36 }, (_valor, indice) => indice + 1));
    expect(resultado.preguntasRestantes).toBe(0);
    expect(paginas).toHaveLength(2);
    expect(resultado.mapaOmr.blockSpec?.bubbleDiameterMm).toBe(6.4);
    expect(resultado.mapaOmr.blockSpec?.bubblePitchXmm).toBe(9.17);
    const metadataCompacta = (paginas[0]?.layoutDebug?.headerTextBlocks ?? [])
      .filter((bloque) => ['reactivos-etiqueta', 'conteo-reactivos', 'calificacion-etiqueta'].includes(bloque.id));
    expect(metadataCompacta).toHaveLength(3);
    expect(Math.max(...metadataCompacta.map((bloque) => bloque.y))
      - Math.min(...metadataCompacta.map((bloque) => bloque.y))).toBeLessThan(0.01);
    expect(metadataCompacta.every((bloque) => bloque.height >= 7.4)).toBe(true);
    for (const pagina of paginas) {
      const numerosOmr = pagina.layoutDebug?.omrQuestionNumberBoxes ?? [];
      expect(numerosOmr.map((bloque) => bloque.numeroPregunta))
        .toEqual(pagina.preguntas.map((pregunta) => pregunta.numeroPregunta));
      for (const bloque of numerosOmr) {
        const pregunta = pagina.preguntas.find((item) => item.numeroPregunta === bloque.numeroPregunta)!;
        const panel = pregunta.cajaOmr!;
        expect(bloque.x + bloque.width).toBeLessThan(panel.x);
        expect(bloque.y).toBeGreaterThanOrEqual(pregunta.cajaOmr?.y ?? 0);
        expect(bloque.y + bloque.height).toBeLessThanOrEqual((pregunta.cajaOmr?.y ?? 0) + (pregunta.cajaOmr?.height ?? 0));
        for (const burbuja of pregunta.opciones) {
          const radio = pregunta.perfilOmr?.radio ?? 0;
          const cruza = bloque.x < burbuja.x + radio && bloque.x + bloque.width > burbuja.x - radio
            && bloque.y < burbuja.y + radio && bloque.y + bloque.height > burbuja.y - radio;
          expect(cruza).toBe(false);
        }
      }
    }
    for (const pagina of paginas) {
      assertPreguntasLayout(pagina);
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      expect(pagina.qr?.texto).toBeTruthy();
    }
    expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({
        partial: paginas.map((pagina) => pagina.numeroPagina),
        desiredWidth: 1600,
        imageBuffer: true,
        imageDataUrl: false
      });
      expect(capturas.pages).toHaveLength(paginas.length);
      for (const [indice, captura] of capturas.pages.entries()) {
        const jpegMovil = await sharp(captura.data)
          .resize({ width: 1600, withoutEnlargement: true })
          .blur(0.3)
          .jpeg({ quality: 72, chromaSubsampling: '4:2:0' })
          .toBuffer();
        expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovil.toString('base64')}`))
          .toBe(paginas[indice]?.qr?.texto);
        const jpegMovilReducida = await sharp(captura.data)
          .resize({ width: 800, withoutEnlargement: true })
          .blur(0.5)
          .jpeg({ quality: 60, chromaSubsampling: '4:2:0' })
          .toBuffer();
        expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovilReducida.toString('base64')}`))
          .toBe(paginas[indice]?.qr?.texto);
      }
    } finally {
      await parser.destroy();
    }
  }, 300_000);

  it('no autocalifica contornos vacíos y conserva círculos sintéticos marcados', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametrosBrevesCompactos(43),
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { institucion: 'Centro de prueba', materia: 'Diagnóstico OMR', mostrarMarcaInstitucional: false }
    });
    const pagina = resultado.mapaOmr.paginas.find((item) => item.numeroPagina === 2)!;
    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const captura = (await parser.getScreenshot({ partial: [2], desiredWidth: 1600, imageBuffer: true, imageDataUrl: false })).pages[0]!;
      const imagenJpeg = await sharp(captura.data).resize({ width: 1600, withoutEnlargement: true }).blur(0.3).jpeg({ quality: 72 }).toBuffer();
      const metadata = await sharp(captura.data).metadata();
      const escala = Number(metadata.width ?? 1600) / 612;
      const marcas = pagina.preguntas.flatMap((pregunta) => {
        const opcion = pregunta.opciones.find((item) => item.letra === ['A', 'B', 'C', 'D', 'E'][(pregunta.numeroPregunta - 1) % 5]);
        const radio = Number(pregunta.perfilOmr?.radio ?? 0) * escala * 0.62;
        return opcion && radio > 0 ? [`<circle cx="${opcion.x * escala}" cy="${(792 - opcion.y) * escala}" r="${radio}" fill="#292929"/>`] : [];
      }).join('');
      const marcada = await sharp(imagenJpeg).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${Number(metadata.height ?? 2070)}">${marcas}</svg>`) }]).jpeg({ quality: 84 }).toBuffer();
      const imagenVaciaBase64 = `data:image/jpeg;base64,${imagenJpeg.toString('base64')}`;
      const imagenMarcadaBase64 = `data:image/jpeg;base64,${marcada.toString('base64')}`;
      const [vacia, marcadaOmr] = await Promise.all([
        analizarOmr(imagenVaciaBase64, pagina, pagina.qr?.texto, 10),
        analizarOmr(imagenMarcadaBase64, pagina, pagina.qr?.texto, 10)
      ]);
      expect(vacia.respuestasDetectadas.every((respuesta) => respuesta.opcion === null), JSON.stringify(vacia.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).map((respuesta) => ({ numeroPregunta: respuesta.numeroPregunta, opcion: respuesta.opcion, estadoRespuesta: respuesta.estadoRespuesta, flags: respuesta.flags, scores: respuesta.scoresPorOpcion.filter((score) => score.opcion === respuesta.opcion) })))).toBe(true);
      expect(marcadaOmr.respuestasDetectadas.every((respuesta) =>
        respuesta.opcion === ['A', 'B', 'C', 'D', 'E'][(respuesta.numeroPregunta - 1) % 5] &&
        respuesta.estadoRespuesta === 'respondida'
      )).toBe(true);
    } finally {
      await parser.destroy();
    }
  }, 300_000);

  it('usa toda la capacidad legible de dos páginas y solo desborda cuando la geometría no admite otro reactivo', async () => {
    const capacidades = [
      [38, [21, 17]],
      [39, [21, 18]],
      [40, [21, 19]],
      [41, [21, 20]],
      [42, [21, 21]],
      [43, [21, 22]],
      [44, [21, 22, 1]]
    ] as const;
    for (const [totalPreguntas, conteosEsperados] of capacidades) {
      const resultado = await generarPdfExamen({
        ...crearParametrosBrevesCompactos(totalPreguntas),
        totalPaginas: 2,
        bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
        encabezado: { institucion: 'Centro de prueba', materia: 'Control de capacidad', mostrarMarcaInstitucional: false }
      });
      const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
      expect(paginas.map((pagina) => pagina.preguntas.length)).toEqual(conteosEsperados);
      expect(paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
        .toEqual(Array.from({ length: totalPreguntas }, (_valor, indice) => indice + 1));
      expect(resultado.preguntasRestantes).toBe(0);
      expect(resultado.metricasLayout?.fontSizePregunta ?? 0).toBeGreaterThanOrEqual(10);
      expect(resultado.metricasLayout?.fontSizeOpcion ?? 0).toBeGreaterThanOrEqual(8.5);
      expect(resultado.mapaOmr.blockSpec?.bubbleDiameterMm).toBe(6.4);
      expect(resultado.mapaOmr.blockSpec?.bubblePitchXmm).toBe(9.17);
      expect(detectarColisionesDuplexOmr(resultado.mapaOmr)).toHaveLength(0);
      for (const pagina of paginas) {
        assertPreguntasLayout(pagina, true);
        expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
        expect(pagina.qr?.texto).toBeTruthy();
      }

      const parser = new PDFParse({ data: resultado.pdfBytes });
      try {
        const capturas = await parser.getScreenshot({
          partial: paginas.map((pagina) => pagina.numeroPagina),
          desiredWidth: 1600,
          imageBuffer: true,
          imageDataUrl: false
        });
        expect(capturas.pages).toHaveLength(paginas.length);
        for (const [indice, captura] of capturas.pages.entries()) {
          if (![38, 39, 43, 44].includes(totalPreguntas)) continue;
          const jpegAlta = await sharp(captura.data)
            .resize({ width: 1600, withoutEnlargement: true })
            .blur(0.3)
            .jpeg({ quality: 72, chromaSubsampling: '4:2:0' })
            .toBuffer();
          expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegAlta.toString('base64')}`))
            .toBe(paginas[indice]?.qr?.texto);
          const jpegReducida = await sharp(captura.data)
            .resize({ width: 800, withoutEnlargement: true })
            .blur(0.5)
            .jpeg({ quality: 60, chromaSubsampling: '4:2:0' })
            .toBuffer();
          expect(await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegReducida.toString('base64')}`))
            .toBe(paginas[indice]?.qr?.texto);
          if (totalPreguntas === 43) {
            const pagina = paginas[indice]!;
            const metadata = await sharp(captura.data).metadata();
            const anchoRaster = Number(metadata.width ?? 1600);
            const altoRaster = Number(metadata.height ?? Math.round(792 * anchoRaster / 612));
            const escala = anchoRaster / 612;
            const letras = ['A', 'B', 'C', 'D', 'E'] as const;
            const respuestaEsperadaPorPregunta = new Map(
              pagina.preguntas.map((pregunta) => [
                pregunta.numeroPregunta,
                letras[(pregunta.numeroPregunta - 1) % letras.length]
              ])
            );
            const circulos = pagina.preguntas.flatMap((pregunta) => {
              const letra = respuestaEsperadaPorPregunta.get(pregunta.numeroPregunta);
              const opcion = pregunta.opciones.find((item) => item.letra === letra);
              const radio = Number(pregunta.perfilOmr?.radio ?? 0) * escala * 0.62;
              if (!opcion || radio <= 0) return [];
              return `<circle cx="${opcion.x * escala}" cy="${(792 - opcion.y) * escala}" r="${radio}" fill="#292929"/>`;
            }).join('');
            const marcasSvg = Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoRaster}" height="${altoRaster}">${circulos}</svg>`
            );
            const imagenMarcada = await sharp(captura.data)
              .composite([{ input: marcasSvg }])
              .blur(0.3)
              .jpeg({ quality: 84 })
              .toBuffer();
            const lecturaOmr = await analizarOmr(
              `data:image/jpeg;base64,${imagenMarcada.toString('base64')}`,
              pagina,
              pagina.qr?.texto,
              10
            );
            expect(lecturaOmr.respuestasDetectadas).toHaveLength(pagina.preguntas.length);
            const discordancias = lecturaOmr.respuestasDetectadas
              .filter((respuesta) =>
                respuesta.opcion !== respuestaEsperadaPorPregunta.get(respuesta.numeroPregunta) ||
                respuesta.estadoRespuesta !== 'respondida'
              )
              .map((respuesta) => ({
                pregunta: respuesta.numeroPregunta,
                opcion: respuesta.opcion,
                estado: respuesta.estadoRespuesta,
                confianza: respuesta.confianza
              }));
            expect(discordancias).toEqual([]);

            const lecturaVacia = await analizarOmr(
              `data:image/jpeg;base64,${jpegAlta.toString('base64')}`,
              pagina,
              pagina.qr?.texto,
              10
            );
            expect(lecturaVacia.respuestasDetectadas).toHaveLength(pagina.preguntas.length);
            const sinLetrasAutocalificables = lecturaVacia.respuestasDetectadas.every((respuesta) => respuesta.opcion === null);
            expect(sinLetrasAutocalificables, `Clasificacion de hoja vacia probable P${pagina.numeroPagina}: ${JSON.stringify({
              geometryLocalEnabled: lecturaVacia.geometryLocalEnabled,
              geometry: lecturaVacia.geomQuality,
              summary: lecturaVacia.resumenRespuestas,
              warnings: lecturaVacia.advertencias,
              states: lecturaVacia.respuestasDetectadas.map(({ numeroPregunta, opcion, estadoRespuesta, flags }) => ({ numeroPregunta, opcion, estadoRespuesta, flags }))
            })}`).toBe(true);
            expect(
              lecturaVacia.resumenRespuestas?.examenVacio === true ||
              lecturaVacia.resumenRespuestas?.examenVacioProbable === true
            ).toBe(true);
            expect(lecturaVacia.resumenRespuestas?.estadoExamen).toMatch(/^vacio_/);
          }
        }
      } finally {
        await parser.destroy();
      }
    }
  }, 900_000);

  it('no trunca bancos extensos por un máximo fijo de preguntas', async () => {
    const totalPreguntas = 60;
    const resultado = await generarPdfExamen({
      ...crearParametrosBrevesCompactos(totalPreguntas),
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 },
      encabezado: { institucion: 'Centro de prueba', materia: 'Control de capacidad', mostrarMarcaInstitucional: false }
    });
    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');

    expect(paginas.length).toBeGreaterThan(2);
    expect(paginas.flatMap((pagina) => pagina.preguntas).map((pregunta) => pregunta.numeroPregunta))
      .toEqual(Array.from({ length: totalPreguntas }, (_valor, indice) => indice + 1));
    expect(resultado.preguntasRestantes).toBe(0);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('mantiene la columna OMR libre en continuaciones con texto largo', async () => {
    const parametros = crearParametros(6);
    parametros.totalPaginas = 2;
    for (const [indice, pregunta] of parametros.preguntas.entries()) {
      pregunta.enunciado =
        `Reactivo ${indice + 1}: selecciona la afirmacion correcta sobre HTTP ` +
        'en el escenario descrito y justifica la lectura del enunciado completo.';
      pregunta.opciones = ['A', 'B', 'C', 'D', 'E'].map((letra, opcion) => ({
        texto: `${letra}) explicacion extensa para validar el ajuste de linea, la separacion del panel y la lectura humana.`,
        esCorrecta: opcion === indice % 5
      }));
    }

    const resultado = await generarPdfExamen(parametros);

    expect(resultado.preguntasRestantes).toBe(0);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });

  it('propaga el perfil compacto de la plantilla y distribuye 25 reactivos en dos paginas', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(25),
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    const conteos = paginas.map((pagina) => pagina.preguntas.length);
    expect(paginas).toHaveLength(2);
    expect(Math.max(...conteos) - Math.min(...conteos)).toBeLessThanOrEqual(3);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.blockSpec?.orientation).toBe('horizontal');
    expect(resultado.mapaOmr.blockSpec?.bubblePitchXmm).toBeGreaterThan(0);
    for (const pagina of paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });

  it('amplia automáticamente la tipografía hasta el mayor tamaño que conserva 25 reactivos en dos páginas', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(25),
      totalPaginas: 2,
      bookletConfig: {
        densityMode: 'compact',
        autoFitPages: true,
        autoFitTypography: true,
        fontScale: 1,
        lineSpacing: 1.1
      }
    });

    const paginas = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio');
    expect(paginas).toHaveLength(2);
    expect(paginas.reduce((total, pagina) => total + pagina.preguntas.length, 0)).toBe(25);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.metricasLayout?.fontSizePregunta ?? 0).toBeGreaterThan(10.4);
    expect(resultado.metricasLayout?.fontSizeOpcion ?? 0).toBeGreaterThan(8.8);
    expect(resultado.metricasLayout?.fontSizePregunta ?? 0).toBeCloseTo(10.4 * 1.3, 2);
    expect(resultado.metricasLayout?.fontSizeOpcion ?? 0).toBeCloseTo(8.8 * 1.3, 2);
    expect(paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('llena cada página antes de abrir otra cuando el contenido rico obliga a continuar', async () => {
    const parametros = crearParametros(25);
    for (const [indice, pregunta] of parametros.preguntas.entries()) {
      const numero = indice + 1;
      pregunta.enunciado =
        `<strong>Reactivo ${numero}</strong>: resuelve ` +
        `<span data-latex="\\frac{x^2+1}{y_1}">\\(formula\\)</span> ` +
        'y selecciona la opción correcta considerando el flujo completo.';
      pregunta.opciones = ['A', 'B', 'C', 'D', 'E'].map((letra, opcion) => ({
        texto:
          `<strong>${letra})</strong> alternativa con <em>énfasis</em> y ` +
          'explicación suficientemente larga para ocupar dos líneas legibles.',
        esCorrecta: opcion === indice % 5
      }));
    }

    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact', fontScale: 1, lineSpacing: 1 }
    });
    const conteos = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => pagina.preguntas.length);

    expect(conteos.length).toBeGreaterThanOrEqual(3);
    expect(conteos.reduce((total, conteo) => total + conteo, 0)).toBe(25);
    expect(resultado.preguntasRestantes).toBe(0);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });

  it('aplica la escala tipografica y el espaciado sin introducir colisiones', async () => {
    const base = crearParametros(20);
    const compacto = await generarPdfExamen({
      ...base,
      bookletConfig: { fontScale: 0.8, lineSpacing: 1 }
    });
    const grande = await generarPdfExamen({
      ...base,
      bookletConfig: { fontScale: 1.1, lineSpacing: 1.2 }
    });

    expect(grande.metricasLayout?.minLineHeightApplied ?? 0).toBeGreaterThan(
      compacto.metricasLayout?.minLineHeightApplied ?? 0
    );
    for (const resultado of [compacto, grande]) {
      expect(resultado.preguntasRestantes).toBe(0);
      for (const pagina of resultado.mapaOmr.paginas) {
        expect(pagina.layoutDebug?.lineHeightViolations ?? []).toHaveLength(0);
        expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
        assertPreguntasLayout(pagina);
        expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      }
    }
  });

  it('equilibra paginas adicionales cuando el contenido no cabe en el objetivo', async () => {
    const parametros = crearParametros(20);
    for (const [indice, pregunta] of parametros.preguntas.entries()) {
      pregunta.enunciado = `Reactivo ${indice + 1}: analiza el flujo HTTP completo y selecciona la afirmacion correcta para el escenario de integracion descrito.`;
      pregunta.opciones = [
        'El cliente consulta un recurso.',
        'El servidor crea un recurso.',
        'La peticion contiene metadatos.',
        'El navegador procesa la respuesta.',
        'La operacion termina con resultado valido.'
      ].map((texto, opcion) => ({ texto, esCorrecta: opcion === indice % 5 }));
    }
    const resultado = await generarPdfExamen({
      ...parametros,
      totalPaginas: 2,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'La sabiduria es nuestra fuerza',
        materia: 'Diseno y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Ceron',
        instrucciones: 'Rellene un solo circulo por pregunta. Evite marcas fuera del area y borre cualquier respuesta anterior.'
      }
    });

    const conteos = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => pagina.preguntas.length);
    expect(conteos.length).toBeGreaterThanOrEqual(2);
    expect(conteos.reduce((total, conteo) => total + conteo, 0)).toBe(20);
    expect(Math.min(...conteos)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...conteos)).toBeLessThanOrEqual(25);
    expect(resultado.preguntasRestantes).toBe(0);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });

  it('llena las continuaciones hasta su capacidad sin dejar hojas subutilizadas', async () => {
    const parametros = crearParametros(24);
    const imagenSvg = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180"><rect width="640" height="180" fill="#eef6fb"/><rect x="22" y="22" width="596" height="136" fill="#fff" stroke="#147db3" stroke-width="4"/></svg>'
    ).toString('base64')}`;
    for (const [indice, pregunta] of parametros.preguntas.entries()) {
      const numero = indice + 1;
      const extensa = numero % 4 === 0;
      pregunta.enunciado = extensa
        ? `Reactivo ${numero}: analiza el flujo completo de una peticion HTTP entre cliente, servidor y recurso, considerando validacion, estado y trazabilidad del resultado en un escenario distribuido.`
        : `Reactivo ${numero}: identifica el concepto correcto.`;
      pregunta.opciones = [
        'La opcion describe el comportamiento esperado del sistema.',
        'La opcion confunde la solicitud con la respuesta.',
        'La opcion atribuye el estado al componente incorrecto.',
        'La opcion omite una condicion del contrato.',
        'La opcion no corresponde al escenario planteado.'
      ].map((texto, opcion) => ({
        texto: extensa && opcion === 0
          ? `${texto} La explicacion adicional verifica el ajuste de linea y la lectura humana sin invadir el panel OMR.`
          : texto,
        esCorrecta: opcion === indice % 5
      }));
      if (extensa) pregunta.imagenUrl = imagenSvg;
    }

    const resultado = await generarPdfExamen({
      ...parametros,
      titulo: 'Evaluacion integral de protocolos, servicios y arquitectura web',
      totalPaginas: 2,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense - Facultad de Ingenieria y Tecnologias Aplicadas',
        lema: 'La sabiduria es nuestra fuerza y el conocimiento transforma nuestra comunidad universitaria',
        materia: 'Diseno y Desarrollo de Aplicaciones Web y Servicios Distribuidos',
        docente: 'EvaluaPro QA'
      },
      bookletConfig: { fontScale: 1.02, lineSpacing: 1.08 }
    });

    const conteos = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => pagina.preguntas.length);
    expect(conteos.reduce((total, conteo) => total + conteo, 0)).toBe(24);
    expect(conteos.every((conteo) => conteo >= 2)).toBe(true);
    expect(conteos.length).toBeGreaterThanOrEqual(2);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('prioriza llenar la hoja y conserva el minimo editorial en las paginas siguientes', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(20),
      totalPaginas: 2
    });

    const conteoPorPagina = resultado.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio').map((pagina) => {
      const del = Number(pagina.preguntasDel ?? 0);
      const al = Number(pagina.preguntasAl ?? 0);
      return del > 0 && al >= del ? al - del + 1 : 0;
    });

    expect(conteoPorPagina.length).toBeGreaterThanOrEqual(2);
    expect(conteoPorPagina.reduce((total, conteo) => total + conteo, 0)).toBe(20);
    expect(Math.min(...conteoPorPagina)).toBeGreaterThanOrEqual(1);
    expect(conteoPorPagina.every((conteo) => conteo >= 1 && conteo <= 25)).toBe(true);
    expect(resultado.preguntasRestantes).toBe(0);
  });

  it('mantiene la reticula horizontal en una continuacion de reactivos cortos', async () => {
    const parametros = crearParametros(20);
    parametros.totalPaginas = 2;
    for (const [indice, pregunta] of parametros.preguntas.entries()) {
      pregunta.enunciado = `¿Reactivo ${indice + 1}?`;
      pregunta.opciones = ['A', 'B', 'C', 'D', 'E'].map((texto, opcion) => ({
        texto,
        esCorrecta: opcion === indice % 5
      }));
    }

    const resultado = await generarPdfExamen(parametros);
    const segundaPagina = resultado.mapaOmr.paginas.find((pagina) => pagina.numeroPagina === 2);

    expect(segundaPagina?.preguntas.length ?? 0).toBeGreaterThanOrEqual(4);
    const primerReactivo = segundaPagina?.preguntas[0];
    const segundoReactivo = segundaPagina?.preguntas[1];
    expect(primerReactivo?.cajaOmr?.y ?? 0).toBeGreaterThan(segundoReactivo?.cajaOmr?.y ?? 0);
    expect(segundaPagina?.layoutDebug?.contentEndY ?? Number.POSITIVE_INFINITY).toBeGreaterThan(0);
    expect(segundaPagina?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });

  it('conserva la zona inferior libre de colisiones en un examen corto', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(18),
      totalPaginas: 4
    });

    const continuaciones = resultado.mapaOmr.paginas.filter((pagina) => pagina.numeroPagina > 1 && pagina.tipoPagina !== 'reverso-vacio');
    expect(continuaciones.length).toBeGreaterThanOrEqual(1);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas)).toHaveLength(18);
    for (const pagina of continuaciones) {
      expect(pagina.preguntas.length).toBeGreaterThanOrEqual(1);
      expect(pagina.layoutDebug?.contentEndY ?? Number.POSITIVE_INFINITY).toBeGreaterThan(0);
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });
});
