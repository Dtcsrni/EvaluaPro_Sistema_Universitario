import type { MapaOmr } from '../shared/tiposPdf.js';

const MM_A_PUNTOS = 72 / 25.4;
const ANCHO_CARTA_PT = 612;
const ALTO_CARTA_PT = 792;
const TOLERANCIA_REGISTRO_MM_DEFAULT = 3;

export interface ColisionDuplexOmr {
  paginaFrente: number;
  paginaReverso: number;
  preguntaFrente: number;
  preguntaReverso: number;
  opcionFrente: string;
  opcionReverso: string;
  separacionPt: number;
  separacionMinimaPt: number;
}

/** Compara los centros OMR tras voltear la cara posterior como se imprimiría. */
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

  const porHoja = new Map<number, { frente?: MapaOmr['paginas'][number]; reverso?: MapaOmr['paginas'][number] }>();
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
    for (const preguntaFrente of frente.preguntas) {
      for (const opcionFrente of preguntaFrente.opciones) {
        for (const preguntaReverso of reverso.preguntas) {
          for (const opcionReverso of preguntaReverso.opciones) {
            const xReverso = impresion.volteo === 'borde-largo'
              ? ANCHO_CARTA_PT - opcionReverso.x
              : opcionReverso.x;
            const yReverso = impresion.volteo === 'borde-largo'
              ? opcionReverso.y
              : ALTO_CARTA_PT - opcionReverso.y;
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
                separacionMinimaPt: distanciaMinima
              });
            }
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
  throw new Error(
    `Plantilla OMR dúplex insegura: ${colisiones.length} pares de burbujas se acercan más que ` +
    `${primera.separacionMinimaPt.toFixed(2)} pt con volteo ${mapa.impresion?.volteo} ` +
    `(páginas ${primera.paginaFrente}/${primera.paginaReverso}, ` +
    `preguntas ${primera.preguntaFrente}/${primera.preguntaReverso}).`
  );
}
