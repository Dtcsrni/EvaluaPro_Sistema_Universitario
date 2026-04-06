/**
 * SeccionBanco.helpers
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import type { Pregunta } from './tipos';
import { obtenerVersionPregunta } from './utilidades';

export type TemaBanco = { _id: string; nombre: string; periodoId: string; createdAt?: string };

export function normalizarNombreTema(valor: unknown): string {
  return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

export function estimarPaginasParaPreguntas(preguntasTema: Pregunta[]): number {
  const ALTO_CARTA = 792;
  const mmAPuntos = (mm: number) => mm * (72 / 25.4);
  const margen = mmAPuntos(10);
  const ANCHO_CARTA = 612;
  const GRID_STEP = 4;
  const snapToGrid = (y: number) => Math.floor(y / GRID_STEP) * GRID_STEP;
  const QR_SIZE = 68;
  const QR_PADDING = 2;

  const anchoColRespuesta = 42;
  const gutterRespuesta = 10;
  const xColRespuesta = ANCHO_CARTA - margen - anchoColRespuesta;
  const xDerechaTexto = xColRespuesta - gutterRespuesta;
  const xTextoPregunta = margen + 20;
  const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

  const yTop = ALTO_CARTA - margen;
  const headerHeightFirst = 72;
  const cursorInicialPrimera = snapToGrid(yTop - headerHeightFirst - 2);
  const yZonaContenidoSeguro = yTop - QR_SIZE - (QR_PADDING + 8);
  const cursorInicialOtras = snapToGrid(Math.min(yTop - 2, yZonaContenidoSeguro));
  const limiteInferior = margen + 12;

  const INSTRUCCIONES_DEFAULT =
    'Por favor conteste las siguientes preguntas referentes al parcial. ' +
    'Rellene el círculo de la respuesta más adecuada, evitando salirse del mismo. ' +
    'Cada pregunta vale 10 puntos si está completa y es correcta.';

  const sizePregunta = 8.1;
  const sizeOpcion = 7.0;
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

  const lista = Array.isArray(preguntasTema) ? preguntasTema : [];
  if (lista.length === 0) return 0;

  let paginas = 1;
  let cursorY = cursorInicialPrimera;
  let esPrimeraPagina = true;

  const aplicarBloqueIndicaciones = () => {
    const maxWidthIndicaciones = Math.max(120, xDerechaTexto - (margen + 10));
    const hLabel = 9;
    const paddingY = 1;
    const yTopInd = cursorY - 6;
    const hDisponible = yTopInd - (limiteInferior + 2);
    let hMin = 34;
    const hMax = Math.max(hMin, hDisponible);

    let sizeIndicaciones = 6.6;
    let lineaIndicaciones = 7.2;
    let lineasIndicaciones = estimarLineasPorAncho(INSTRUCCIONES_DEFAULT, maxWidthIndicaciones, sizeIndicaciones);
    for (let i = 0; i < 10; i += 1) {
      const hNecesaria = hLabel + paddingY + lineasIndicaciones * lineaIndicaciones;
      if (hNecesaria <= hMax) break;
      sizeIndicaciones = Math.max(6.0, sizeIndicaciones - 0.25);
      lineaIndicaciones = Math.max(6.6, lineaIndicaciones - 0.25);
      lineasIndicaciones = estimarLineasPorAncho(INSTRUCCIONES_DEFAULT, maxWidthIndicaciones, sizeIndicaciones);
    }

    const hNecesariaFinal = hLabel + paddingY + lineasIndicaciones * lineaIndicaciones;
    hMin = Math.max(hMin, hLabel + paddingY + lineaIndicaciones + 12);
    const hCaja = Math.max(hMin, hNecesariaFinal);
    if (hCaja > hDisponible) {
      cursorY = limiteInferior - 1;
    } else {
      cursorY = snapToGrid(yTopInd - hCaja - 6);
    }
  };

  if (esPrimeraPagina) {
    aplicarBloqueIndicaciones();
    esPrimeraPagina = false;
  }

  for (const pregunta of lista) {
    const version = obtenerVersionPregunta(pregunta);
    const tieneImagen = Boolean(String(version?.imagenUrl ?? '').trim());

    const lineasEnunciado = estimarLineasPorAncho(String(version?.enunciado ?? ''), anchoTextoPregunta, sizePregunta);
    let altoNecesario = lineasEnunciado * lineaPregunta;
    if (tieneImagen) altoNecesario += 43;

    const opcionesActuales = Array.isArray(version?.opciones) ? version.opciones : [];
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
    altoNecesario += separacionPregunta + 4;
    altoNecesario = snapToGrid(altoNecesario);

    if (cursorY - altoNecesario < limiteInferior) {
      paginas += 1;
      cursorY = cursorInicialOtras;
      if (esPrimeraPagina) {
        aplicarBloqueIndicaciones();
        esPrimeraPagina = false;
      }
    }

    cursorY = snapToGrid(cursorY - altoNecesario);
  }

  return paginas;
}
