/**
 * pdf.layout.visual.guard.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { ANCHO_CARTA, ALTO_CARTA } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes';

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
  const paginasObjetivo = Number(resultado.paginas.length || 1);
  const totalPreguntas = resultado.paginas.reduce((total, pagina) => {
    const del = Number(pagina.preguntasDel ?? 0);
    const al = Number(pagina.preguntasAl ?? 0);
    return total + (del > 0 && al >= del ? al - del + 1 : 0);
  }, 0);
  const minimoAplicable = totalPreguntas >= 10 * paginasObjetivo ? 10 : 1;

  const conteoPorPagina = resultado.paginas.map((pagina) => {
    const del = Number(pagina.preguntasDel ?? 0);
    const al = Number(pagina.preguntasAl ?? 0);
    return del > 0 && al >= del ? al - del + 1 : 0;
  });

  for (let indice = 0; indice < conteoPorPagina.length; indice += 1) {
    const conteo = conteoPorPagina[indice] ?? 0;
    if (conteo === 0) continue;
    const esUltimaPagina = indice === conteoPorPagina.length - 1;
    if (!esUltimaPagina) expect(conteo).toBeGreaterThanOrEqual(minimoAplicable);
    expect(conteo).toBeLessThanOrEqual(15);
  }
}

function assertBloquesHeader(pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number], header: Rect) {
  const dbg = pagina.layoutDebug;
  const qr = dbg?.qr as Rect;
  assertRectDentroPagina(header);
  assertRectDentroPagina(qr);

  if (pagina.numeroPagina === 1) {
    expect(contiene(header, qr), 'la reserva QR debe estar contenida en la cabecera').toBe(true);
  }

  const bloquesHeader = Array.isArray(dbg?.headerTextBlocks) ? dbg.headerTextBlocks : [];
  const camposHeader = Array.isArray(dbg?.headerFieldBoxes) ? dbg.headerFieldBoxes : [];
  const slotsHeader = Array.isArray(dbg?.headerSlots) ? dbg.headerSlots : [];
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
    for (const slot of slotsHeader) {
      expect(contiene(header, slot as Rect), `slot ${slot.id} fuera de la cabecera`).toBe(true);
      expect(interseca(slot as Rect, qr), `slot ${slot.id} invade el QR`).toBe(false);
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
  const preguntas = Array.isArray(pagina.preguntas) ? pagina.preguntas : [];
  const qr = pagina.layoutDebug?.qr as Rect | undefined;
  for (let i = 0; i < preguntas.length; i += 1) {
    const actual = preguntas[i];
    expect(Array.isArray(actual.textRuns)).toBe(true);
    expect((actual.textRuns ?? []).length).toBeGreaterThan(0);
    if (!actual.bboxPregunta) continue;
    const bbox = actual.bboxPregunta;
    assertRectDentroPagina(bbox);

    const omr = actual.cajaOmr;
    if (omr) {
      expect(interseca(bbox, omr)).toBe(true);
      expect(omr.x + omr.width).toBeLessThanOrEqual(ANCHO_CARTA - 6.9);
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
          expect(opcion.x - anterior.x).toBeGreaterThanOrEqual(radio * 2 + 0.5);
        }
      }
    }

    if (i > 0 && preguntas[i - 1]?.bboxPregunta) {
      const prev = preguntas[i - 1]!.bboxPregunta as Rect;
      expect(interseca(prev, bbox), `solape en preguntas ${preguntas[i - 1]?.numeroPregunta} y ${actual.numeroPregunta}`).toBe(false);
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
        instrucciones: 'Rellene un solo circulo por pregunta y evite marcas fuera del area.'
      }
    });
    expect(resultado.metricasLayout).toBeTruthy();
    expect(resultado.mapaOmr.perfil.marcasEsquina).toBe('lineas');
    expect(resultado.metricasLayout?.fontSizePregunta ?? 0).toBeGreaterThanOrEqual(10);
    expect(resultado.metricasLayout?.fontSizeOpcion ?? 0).toBeGreaterThanOrEqual(8.5);
    expect(resultado.metricasLayout?.fontSizeIndicaciones ?? 0).toBeGreaterThanOrEqual(7.5);
    expect(resultado.metricasLayout?.lineHeightPregunta ?? 0).toBeGreaterThanOrEqual(12.8);
    expect(resultado.metricasLayout?.lineHeightOpcion ?? 0).toBeGreaterThanOrEqual(11);
    expect((resultado.metricasLayout?.minLineHeightApplied ?? 0) >= 8.2).toBe(true);
    expect(resultado.mapaOmr.perfil.qrSize).toBeCloseTo(25 * (72 / 25.4), 5);
    expect(resultado.mapaOmr.perfil.qrPadding).toBeCloseTo(3 * (72 / 25.4), 5);
    expect(resultado.mapaOmr.perfil.qrMarginModulos).toBe(4);
    assertConteoPreguntasPorPagina(resultado);

    const metaBlocks = (resultado.mapaOmr.paginas[0]?.layoutDebug?.headerTextBlocks ?? [])
      .filter((bloque) => bloque.id.startsWith('meta-'));
    expect(metaBlocks.length).toBe(2);
    expect((metaBlocks[0]?.y ?? 0) - (metaBlocks[1]?.y ?? 0)).toBeGreaterThan(5);

    for (const pagina of resultado.mapaOmr.paginas) {
      const dbg = pagina.layoutDebug;
      expect(dbg).toBeTruthy();
      const header = dbg?.header as Rect;
      assertBloquesHeader(pagina, header);
      assertPreguntasLayout(pagina);
      assertPrimeraPreguntaDebajoDelHeader(pagina, header);
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
        docente: 'Erick Renato Vega Ceron'
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
        mostrarInstrucciones: false
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
    expect(resultado.mapaOmr.blockSpec?.bubbleDiameterMm).toBeGreaterThanOrEqual(4.8);
    expect(resultado.mapaOmr.perfil.cajaOmrAncho).toBe(132);
  });

  it('separa imagenes de pregunta, opciones y banda de continuacion', async () => {
    const parametros = crearParametros(12);
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
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
      const band = pagina.layoutDebug?.continuationBand;
      const blocks = pagina.layoutDebug?.continuationTextBlocks ?? [];
      if (band) {
        for (const block of blocks) expect(contiene(band as Rect, block as Rect)).toBe(true);
      }
    }
  });

  it('evita una tercera hoja casi vacia cuando doce reactivos caben en dos paginas', async () => {
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

    const conteos = resultado.mapaOmr.paginas.map((pagina) => pagina.preguntas.length);
    expect(conteos).toEqual([6, 6]);
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

    const conteos = resultado.mapaOmr.paginas.map((pagina) => pagina.preguntas.length);
    expect(conteos.length).toBe(3);
    expect(Math.max(...conteos) - Math.min(...conteos)).toBeLessThanOrEqual(1);
    expect(resultado.preguntasRestantes).toBe(0);
    for (const pagina of resultado.mapaOmr.paginas) {
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
    }
  });

  it('rebalancea mas de un reactivo cuando la ultima hoja quedaria subutilizada', async () => {
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

    const conteos = resultado.mapaOmr.paginas.map((pagina) => pagina.preguntas.length);
    expect(conteos).toEqual([3, 4, 4, 4, 4, 3, 2]);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.every((pagina) => (pagina.layoutDebug?.collisionBoxes ?? []).length === 0)).toBe(true);
  });

  it('prioriza llenar la hoja y conserva el minimo editorial en las paginas siguientes', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(20),
      totalPaginas: 2
    });

    const conteoPorPagina = resultado.paginas.map((pagina) => {
      const del = Number(pagina.preguntasDel ?? 0);
      const al = Number(pagina.preguntasAl ?? 0);
      return del > 0 && al >= del ? al - del + 1 : 0;
    });

    expect(conteoPorPagina).toHaveLength(2);
    expect(conteoPorPagina.reduce((total, conteo) => total + conteo, 0)).toBe(20);
    expect(Math.max(...conteoPorPagina) - Math.min(...conteoPorPagina)).toBeLessThanOrEqual(2);
    expect(conteoPorPagina.every((conteo) => conteo >= 10 && conteo <= 15)).toBe(true);
    expect(resultado.preguntasRestantes).toBe(0);
  });

  it('distribuye el sobrante vertical en una continuacion de reactivos cortos', async () => {
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

    expect(segundaPagina?.preguntas).toHaveLength(10);
    const primerReactivo = segundaPagina?.preguntas[0];
    const segundoReactivo = segundaPagina?.preguntas[1];
    expect(primerReactivo?.cajaOmr?.x).toBeCloseTo(segundoReactivo?.cajaOmr?.x ?? 0, 5);
    expect(segundaPagina?.layoutDebug?.contentEndY ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
    expect(segundaPagina?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });
});
