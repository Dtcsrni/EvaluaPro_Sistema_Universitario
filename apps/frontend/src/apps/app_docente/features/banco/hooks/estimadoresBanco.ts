/**
 * estimadoresBanco
 *
 * Responsabilidad: Estimaciones heuristicas para operaciones de ajuste masivo en banco.
 * Limites: Heuristicas aproximadas; no sustituyen la paginacion real del backend/PDF.
 */
import { estimarPaginasParaPreguntas } from '../../../SeccionBanco.helpers';
import type { Pregunta } from '../../../tipos';
import { obtenerVersionPregunta } from '../../../utilidades';

export function estimarAltoPregunta(pregunta: Pregunta): number {
  const mmAPuntos = (mm: number) => mm * (72 / 25.4);
  const margen = mmAPuntos(10);
  const ANCHO_CARTA = 612;
  const GRID_STEP = 4;
  const snapToGrid = (y: number) => Math.floor(y / GRID_STEP) * GRID_STEP;

  const anchoColRespuesta = 42;
  const gutterRespuesta = 10;
  const xColRespuesta = ANCHO_CARTA - margen - anchoColRespuesta;
  const xDerechaTexto = xColRespuesta - gutterRespuesta;
  const xTextoPregunta = margen + 20;
  const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

  const sizePregunta = 8.1;
  const sizeOpcion = 7.0;
  const sizeNota = 6.3;
  const lineaPregunta = 8.6;
  const lineaOpcion = 7.6;
  const separacionPregunta = 0;

  const omrPasoY = 8.4;
  const omrPadding = 2.2;
  const omrExtraTitulo = 9.5;
  const omrTotalLetras = 5;

  function estimarLineasPorAncho(texto: string, maxWidthPts: number, fontSize: number): number {
    const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ');
    if (!limpio) return 1;
    const charWidth = fontSize * 0.58;
    const maxChars = Math.max(10, Math.floor(maxWidthPts / charWidth));
    const palabras = limpio.split(' ');

    let lineas = 1;
    let actual = '';
    for (const palabra of palabras) {
      const candidato = actual ? `${actual} ${palabra}` : palabra;
      if (candidato.length <= maxChars) {
        actual = candidato;
        continue;
      }
      if (!actual) {
        const trozos = Math.ceil(palabra.length / maxChars);
        lineas += Math.max(0, trozos - 1);
        actual = palabra.slice((trozos - 1) * maxChars);
      } else {
        lineas += 1;
        actual = palabra;
      }
    }
    return Math.max(1, Math.ceil(lineas * 1.08));
  }

  const version = obtenerVersionPregunta(pregunta);
  const tieneImagen = Boolean(String(version?.imagenUrl ?? '').trim());
  const lineasEnunciado = estimarLineasPorAncho(String(version?.enunciado ?? ''), anchoTextoPregunta, sizePregunta);
  let altoNecesario = lineasEnunciado * lineaPregunta;
  if (tieneImagen) altoNecesario += 43;

  const opcionesActuales = Array.isArray(version?.opciones) ? version!.opciones : [];
  const opciones = opcionesActuales.length === 5 ? opcionesActuales : [];
  const totalOpciones = opciones.length;
  const mitad = Math.ceil(totalOpciones / 2);
  const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
  const gutterCols = 8;
  const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
  const prefixWidth = sizeOpcion * 1.6;
  const maxTextWidth = Math.max(30, colWidth - prefixWidth);
  const alturasCols = [0, 0];

  opciones.slice(0, mitad).forEach((op) => {
    alturasCols[0] += estimarLineasPorAncho(String(op?.texto ?? ''), maxTextWidth, sizeOpcion) * lineaOpcion + 0.5;
  });
  opciones.slice(mitad).forEach((op) => {
    alturasCols[1] += estimarLineasPorAncho(String(op?.texto ?? ''), maxTextWidth, sizeOpcion) * lineaOpcion + 0.5;
  });
  const altoOpciones = Math.max(alturasCols[0], alturasCols[1]);
  const altoOmrMin = (omrTotalLetras - 1) * omrPasoY + (omrExtraTitulo + omrPadding);
  altoNecesario += Math.max(altoOpciones, altoOmrMin);
  altoNecesario += separacionPregunta + 2;
  altoNecesario = snapToGrid(altoNecesario);

  return Math.max(sizeNota + 10, altoNecesario);
}

export function sugerirPreguntasARecortar(preguntasTema: Pregunta[], paginasObjetivo: number): string[] {
  const objetivo = Math.max(1, Math.floor(Number(paginasObjetivo) || 1));
  const orden = [...(Array.isArray(preguntasTema) ? preguntasTema : [])];
  // La lista ya viene en orden reciente -> antiguo; recortamos del final.
  const seleccion: string[] = [];
  let paginas = estimarPaginasParaPreguntas(orden);
  while (orden.length > 0 && paginas > objetivo) {
    const quitada = orden.pop();
    if (!quitada) break;
    seleccion.push(quitada._id);
    paginas = estimarPaginasParaPreguntas(orden);
  }
  return seleccion;
}
