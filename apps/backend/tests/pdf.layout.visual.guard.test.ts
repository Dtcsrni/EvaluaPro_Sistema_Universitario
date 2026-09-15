/**
 * pdf.layout.visual.guard.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { ANCHO_CARTA, ALTO_CARTA } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
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
    expect(calificacion?.y ?? 0).toBeLessThan(Math.min(...segundaFila) - 8);
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
        expect(slot.width).toBeGreaterThanOrEqual(76);
        expect(slot.height).toBeGreaterThanOrEqual(76);
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

function assertPreguntasLayout(pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number]) {
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
        // La compactación solo elimina aire estructural; el diámetro, el
        // paso y las quiet zones de las marcas se validan debajo sin cambiar.
        expect(omr.height).toBeGreaterThanOrEqual(30);
        expect(omr.height).toBeLessThanOrEqual(33);
        expect(actual.perfilOmr?.etiquetaBordeInferiorGap).toBeGreaterThan(2.39);
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

describe('pdf layout visual guard', () => {
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
    expect(resultado.mapaOmr.perfil.qrSize).toBeCloseTo(28 * (72 / 25.4), 5);
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
        // La cabecera estándar usa la reserva compacta; este límite evita que
        // una modificación futura vuelva a consumir el espacio recuperado.
        expect(header.height).toBeLessThanOrEqual(152.01);
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
        mostrarMarcaInstitucional: true
      }
    });

    const primeraPagina = resultado.mapaOmr.paginas[0]!;
    const bloques = primeraPagina.layoutDebug?.headerTextBlocks ?? [];
    const slots = primeraPagina.layoutDebug?.headerSlots ?? [];
    const nombre = bloques.find((bloque) => bloque.id === 'nombre-etiqueta');
    const grupo = bloques.find((bloque) => bloque.id === 'grupo-etiqueta');
    const logos = slots.filter((slot) => slot.id === 'logo-izquierdo' || slot.id === 'logo-derecho');

    expect(nombre).toBeDefined();
    expect(grupo).toBeDefined();
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
    expect(primerEncabezado.some((bloque) => /^(institucion|lema|meta)-/.test(bloque.id))).toBe(false);
    expect(primerEncabezado.some((bloque) => /^titulo-/.test(bloque.id))).toBe(true);
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
    expect(resultado.mapaOmr.blockSpec?.bubbleDiameterMm).toBe(6);
    expect(resultado.mapaOmr.perfil.cajaOmrAncho).toBe(137);
    expect(resultado.mapaOmr.blockSpec?.bubblePitchXmm).toBe(8.82);
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
    expect([...conteos].sort((a, b) => a - b)).toEqual([12, 13]);
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
      ...crearParametros(16),
      totalPaginas: 4
    });

    const continuaciones = resultado.mapaOmr.paginas.filter((pagina) => pagina.numeroPagina > 1 && pagina.tipoPagina !== 'reverso-vacio');
    expect(continuaciones.length).toBeGreaterThanOrEqual(1);
    for (const pagina of continuaciones) {
      expect(pagina.preguntas.length).toBeGreaterThanOrEqual(1);
      expect(pagina.layoutDebug?.contentEndY ?? Number.POSITIVE_INFINITY).toBeGreaterThan(0);
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });
});
