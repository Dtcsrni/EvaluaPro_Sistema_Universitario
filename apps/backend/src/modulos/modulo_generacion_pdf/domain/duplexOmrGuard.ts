import type { MapaOmr, PaginaOmr } from '../shared/tiposPdf.js';

const MM_A_PUNTOS = 72 / 25.4;
const ANCHO_CARTA_PT = 612;
const ALTO_CARTA_PT = 792;
const TOLERANCIA_REGISTRO_MM_DEFAULT = 3;

type Rect = { x: number; y: number; width: number; height: number };
type ZonaLeida = { id: string; tipo: 'burbuja' | 'qr' | 'fiducial'; rect: Rect; pregunta?: number };
type ZonaTinta = { id: string; tipo: 'texto' | 'imagen' | 'burbuja' | 'etiqueta' | 'qr' | 'fiducial' | 'campo'; rect: Rect };

export interface ColisionDuplexOmr {
  paginaFrente: number;
  paginaReverso: number;
  preguntaFrente: number;
  preguntaReverso: number;
  opcionFrente: string;
  opcionReverso: string;
  separacionPt: number;
  separacionMinimaPt: number;
  tipo?: 'burbuja-con-burbuja' | 'burbuja-con-tinta-reverso' | 'qr-con-tinta-reverso' | 'fiducial-con-tinta-reverso';
}

function rect(x: number, y: number, width: number, height: number): Rect | null {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function inflar(rectangulo: Rect, pt: number): Rect {
  return { x: rectangulo.x - pt, y: rectangulo.y - pt, width: rectangulo.width + pt * 2, height: rectangulo.height + pt * 2 };
}

function reflejar(rectangulo: Rect, volteo: 'borde-largo' | 'borde-corto'): Rect {
  return volteo === 'borde-largo'
    ? { ...rectangulo, x: ANCHO_CARTA_PT - rectangulo.x - rectangulo.width }
    : { ...rectangulo, y: ALTO_CARTA_PT - rectangulo.y - rectangulo.height };
}

function interseca(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function esMarcaGemelaAlineada(
  zona: ZonaLeida,
  tinta: ZonaTinta,
  volteo: 'borde-largo' | 'borde-corto'
): boolean {
  if (zona.tipo !== 'fiducial' || tinta.tipo !== 'fiducial') return false;
  const esquinaZona = /^fiducial-(tl|tr|bl|br)$/.exec(zona.id)?.[1];
  const esquinaTinta = /^fiducial-pagina-(tl|tr|bl|br)$/.exec(tinta.id)?.[1];
  if (!esquinaZona || !esquinaTinta) return false;
  const gemela: Record<string, Record<'borde-largo' | 'borde-corto', string>> = {
    tl: { 'borde-largo': 'tr', 'borde-corto': 'bl' },
    tr: { 'borde-largo': 'tl', 'borde-corto': 'br' },
    bl: { 'borde-largo': 'br', 'borde-corto': 'tl' },
    br: { 'borde-largo': 'bl', 'borde-corto': 'tr' }
  };
  return gemela[esquinaZona]?.[volteo] === esquinaTinta;
}

function rectsTexto(pagina: PaginaOmr, perfil: MapaOmr['perfil']): ZonaTinta[] {
  const zonas: ZonaTinta[] = [];
  const agregar = (id: string, tipo: ZonaTinta['tipo'], caja: Partial<Rect> | undefined) => {
    if (!caja) return;
    const valido = rect(Number(caja.x), Number(caja.y), Number(caja.width), Number(caja.height));
    if (valido) zonas.push({ id, tipo, rect: valido });
  };

  for (const [indice, caja] of (pagina.layoutDebug?.headerTextBlocks ?? []).entries()) agregar(caja.id || `encabezado-texto-${indice}`, 'texto', caja);
  for (const [indice, caja] of (pagina.layoutDebug?.continuationTextBlocks ?? []).entries()) agregar(caja.id || `continuacion-texto-${indice}`, 'texto', caja);
  for (const [indice, caja] of (pagina.layoutDebug?.headerFieldBoxes ?? []).entries()) agregar(caja.id || `campo-${indice}`, 'campo', caja);
  for (const [indice, caja] of (pagina.layoutDebug?.headerIconBoxes ?? []).entries()) agregar(caja.id || `icono-${indice}`, 'imagen', caja);
  // `questionBackgroundBoxes` is the bounding box for sparse dotted ornament,
  // not a filled rectangle. The inline candidate omits that ornament so dots
  // cannot show through the answer region from the back side.

  if (pagina.layoutDebug?.bindingLabel) agregar('etiqueta-grapa', 'texto', pagina.layoutDebug.bindingLabel);
  for (const pregunta of pagina.preguntas) {
    for (const [indiceRun, run] of (pregunta.textRuns ?? []).entries()) agregar(`pregunta-${pregunta.numeroPregunta}-texto-${indiceRun}`, 'texto', run.bbox);
    if (pregunta.imagen) agregar(`pregunta-${pregunta.numeroPregunta}-imagen`, 'imagen', pregunta.imagen);
    for (const opcion of pregunta.opciones) {
      const radio = Number(opcion.radio ?? perfil?.burbujaRadio);
      if (Number.isFinite(opcion.x) && Number.isFinite(opcion.y) && Number.isFinite(radio) && radio > 0) {
        agregar(`pregunta-${pregunta.numeroPregunta}-burbuja-${opcion.letra}`, 'burbuja', { x: opcion.x - radio, y: opcion.y - radio, width: radio * 2, height: radio * 2 });
      }
      if (opcion.labelBounds) agregar(`pregunta-${pregunta.numeroPregunta}-etiqueta-${opcion.letra}`, 'etiqueta', opcion.labelBounds);
    }
    if (pregunta.fiduciales) {
      const tamano = Number(pagina.markerSpec?.sizeMm) * MM_A_PUNTOS;
      if (Number.isFinite(tamano) && tamano > 0) {
        for (const [nombre, punto] of Object.entries(pregunta.fiduciales)) {
          if (!punto) continue;
          agregar(`pregunta-${pregunta.numeroPregunta}-fiducial-${nombre}`, 'fiducial', {
            x: punto.x - tamano / 2, y: punto.y - tamano / 2, width: tamano, height: tamano
          });
        }
      }
    }
  }

  if (pagina.qr) {
    const padding = Math.max(0, Number(pagina.qr.padding) || 0);
    agregar('qr-y-reserva', 'qr', {
      x: pagina.qr.x - padding, y: pagina.qr.y - padding,
      width: pagina.qr.size + padding * 2, height: pagina.qr.size + padding * 2
    });
  }
  if (pagina.layoutDebug?.qr) agregar('tarjeta-qr', 'qr', pagina.layoutDebug.qr);

  if (pagina.marcasPagina?.tipo === 'cuadrados') {
    const size = pagina.marcasPagina.size;
    const quiet = Math.max(0, pagina.marcasPagina.quietZone);
    const marcas = pagina.marcasPagina;
    const corners: Array<[string, { x: number; y: number }, boolean, boolean]> = [
      ['tl', marcas.tl, true, true], ['tr', marcas.tr, false, true],
      ['bl', marcas.bl, true, false], ['br', marcas.br, false, false]
    ];
    for (const [nombre, punto, izquierda, arriba] of corners) {
      const x = izquierda ? punto.x : punto.x - size;
      const y = arriba ? punto.y - size : punto.y;
      agregar(`fiducial-pagina-${nombre}`, 'fiducial', { x: x - quiet, y: y - quiet, width: size + quiet * 2, height: size + quiet * 2 });
    }
  }

  return zonas;
}

function zonasLeidas(pagina: PaginaOmr, toleranciaPt: number, perfil: MapaOmr['perfil']): ZonaLeida[] {
  const zonas: ZonaLeida[] = [];
  for (const pregunta of pagina.preguntas) {
    for (const opcion of pregunta.opciones) {
      const radio = Number(opcion.radio ?? perfil?.burbujaRadio);
      if (Number.isFinite(opcion.x) && Number.isFinite(opcion.y) && Number.isFinite(radio) && radio > 0) {
        const area = rect(opcion.x - radio, opcion.y - radio, radio * 2, radio * 2);
        if (area) zonas.push({ id: `pregunta-${pregunta.numeroPregunta}-${opcion.letra}`, tipo: 'burbuja', rect: inflar(area, toleranciaPt), pregunta: pregunta.numeroPregunta });
      }
    }
  }
  if (pagina.qr) {
    const padding = Math.max(0, Number(pagina.qr.padding) || 0);
    const area = rect(pagina.qr.x - padding, pagina.qr.y - padding, pagina.qr.size + padding * 2, pagina.qr.size + padding * 2);
    if (area) zonas.push({ id: 'qr', tipo: 'qr', rect: inflar(area, toleranciaPt) });
  }
  if (pagina.marcasPagina?.tipo === 'cuadrados') {
    const size = pagina.marcasPagina.size;
    const quiet = Math.max(0, pagina.marcasPagina.quietZone);
    for (const [nombre, punto, izquierda, arriba] of [
      ['tl', pagina.marcasPagina.tl, true, true], ['tr', pagina.marcasPagina.tr, false, true],
      ['bl', pagina.marcasPagina.bl, true, false], ['br', pagina.marcasPagina.br, false, false]
    ] as const) {
      const x = izquierda ? punto.x : punto.x - size;
      const y = arriba ? punto.y - size : punto.y;
      const area = rect(x - quiet, y - quiet, size + quiet * 2, size + quiet * 2);
      if (area) zonas.push({ id: `fiducial-${nombre}`, tipo: 'fiducial', rect: inflar(area, toleranciaPt) });
    }
  }
  return zonas;
}

function crearColision(args: {
  pageA: PaginaOmr; pageB: PaginaOmr; zona: ZonaLeida; tinta: ZonaTinta;
}): ColisionDuplexOmr {
  const tipo = args.zona.tipo === 'burbuja'
    ? 'burbuja-con-tinta-reverso'
    : args.zona.tipo === 'qr' ? 'qr-con-tinta-reverso' : 'fiducial-con-tinta-reverso';
  return {
    paginaFrente: args.pageA.numeroPagina,
    paginaReverso: args.pageB.numeroPagina,
    preguntaFrente: args.zona.pregunta ?? 0,
    preguntaReverso: 0,
    opcionFrente: args.zona.id,
    opcionReverso: args.tinta.id,
    separacionPt: 0,
    separacionMinimaPt: 0,
    tipo
  };
}

/** Detecta conflictos de burbujas enfrentadas y tinta impresa sobre áreas OMR/QR/fiduciales. */
export function detectarColisionesDuplexOmr(mapa: MapaOmr): ColisionDuplexOmr[] {
  const impresion = mapa.impresion;
  if (!impresion || impresion.modo !== 'duplex' || mapa.paginas.length < 2) return [];

  const toleranciaMm = Number.isFinite(impresion.toleranciaRegistroMm)
    ? Math.min(10, Math.max(0, Number(impresion.toleranciaRegistroMm)))
    : TOLERANCIA_REGISTRO_MM_DEFAULT;
  const toleranciaPt = toleranciaMm * MM_A_PUNTOS;
  const radioBurbuja = Number(mapa.perfil?.burbujaRadio);
  if (!Number.isFinite(radioBurbuja) || radioBurbuja <= 0) {
    throw new Error('El mapa OMR dúplex no declara un radio de burbuja válido.');
  }

  const porHoja = new Map<number, { frente?: PaginaOmr; reverso?: PaginaOmr }>();
  for (const pagina of mapa.paginas) {
    const hoja = pagina.duplex?.hoja ?? Math.ceil(pagina.numeroPagina / impresion.paginasPorHoja);
    const lado = pagina.duplex?.lado ?? (pagina.numeroPagina % 2 === 1 ? 'frente' : 'reverso');
    const par = porHoja.get(hoja) ?? {};
    par[lado] = pagina;
    porHoja.set(hoja, par);
  }

  const colisiones: ColisionDuplexOmr[] = [];
  for (const { frente, reverso } of porHoja.values()) {
    if (!frente || !reverso) continue;
    const tintaFrente = rectsTexto(frente, mapa.perfil);
    const tintaReverso = rectsTexto(reverso, mapa.perfil);
    const zonasFrente = zonasLeidas(frente, toleranciaPt, mapa.perfil);
    const zonasReverso = zonasLeidas(reverso, toleranciaPt, mapa.perfil);

    for (const preguntaFrente of frente.preguntas) {
      for (const opcionFrente of preguntaFrente.opciones) {
        for (const preguntaReverso of reverso.preguntas) {
          for (const opcionReverso of preguntaReverso.opciones) {
            const xReverso = impresion.volteo === 'borde-largo' ? ANCHO_CARTA_PT - opcionReverso.x : opcionReverso.x;
            const yReverso = impresion.volteo === 'borde-largo' ? opcionReverso.y : ALTO_CARTA_PT - opcionReverso.y;
            const distancia = Math.hypot(opcionFrente.x - xReverso, opcionFrente.y - yReverso);
            const distanciaMinima = radioBurbuja * 2 + toleranciaPt;
            if (distancia < distanciaMinima) {
              colisiones.push({
                paginaFrente: frente.numeroPagina,
                paginaReverso: reverso.numeroPagina,
                preguntaFrente: preguntaFrente.numeroPregunta,
                preguntaReverso: preguntaReverso.numeroPregunta,
                opcionFrente: opcionFrente.letra,
                opcionReverso: opcionReverso.letra,
                separacionPt: distancia,
                separacionMinimaPt: distanciaMinima,
                tipo: 'burbuja-con-burbuja'
              });
            }
          }
        }
      }
    }

    const validarDorso = frente.templateId !== 'omr-canonical-v4' && reverso.templateId !== 'omr-canonical-v4';
    if (validarDorso) {
      for (const zona of zonasFrente) {
        for (const tinta of tintaReverso) {
          if (esMarcaGemelaAlineada(zona, tinta, impresion.volteo)) continue;
          if (interseca(zona.rect, reflejar(tinta.rect, impresion.volteo))) {
            colisiones.push(crearColision({ pageA: frente, pageB: reverso, zona, tinta }));
          }
        }
      }
      for (const zona of zonasReverso) {
        for (const tinta of tintaFrente) {
          if (esMarcaGemelaAlineada(zona, tinta, impresion.volteo)) continue;
          if (interseca(zona.rect, reflejar(tinta.rect, impresion.volteo))) {
            colisiones.push(crearColision({ pageA: reverso, pageB: frente, zona, tinta }));
          }
        }
      }
    }
  }
  return colisiones;
}

export function validarSeparacionDuplexOmr(mapa: MapaOmr): void {
  const colisiones = detectarColisionesDuplexOmr(mapa);
  if (colisiones.length === 0) return;
  const primera = colisiones[0]!;
  if (primera.tipo && primera.tipo !== 'burbuja-con-burbuja') {
    throw new Error(
      `Plantilla OMR dúplex insegura: contenido impreso detrás de una zona OMR/QR/fiducial (${primera.tipo}) ` +
      `(páginas ${primera.paginaFrente}/${primera.paginaReverso}, ${primera.opcionFrente}/${primera.opcionReverso}).`
    );
  }
  throw new Error(
    `Plantilla OMR dúplex insegura: ${colisiones.length} pares de burbujas se acercan más que ` +
    `${primera.separacionMinimaPt.toFixed(2)} pt con volteo ${mapa.impresion?.volteo} ` +
    `(páginas ${primera.paginaFrente}/${primera.paginaReverso}, ` +
    `preguntas ${primera.preguntaFrente}/${primera.preguntaReverso}).`
  );
}
