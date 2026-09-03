/**
 * pdfKitRenderer
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import type { ExamenPdf } from '../domain/examenPdf';
import {
  ALTO_CARTA,
  ANCHO_CARTA,
  MM_A_PUNTOS,
  type BlockSpecOmr,
  type EngineHintsOmr,
  type MarkerSpecOmr,
  type PaginaOmr,
  type PerfilLayoutImpresion,
  type PerfilPlantillaOmr,
  type ResultadoGeneracionPdf
} from '../shared/tiposPdf';
import { PERFIL_OMR_CANONICO } from '../domain/layoutExamen';
import { TEMPLATE_VERSION_CANONICA } from '../domain/templateCanonico';
import { PDF_VISUAL_BASELINE_RGB } from './pdfVisualBaseline';

type PerfilPlantillaRender = PerfilPlantillaOmr & {
  version: 4;
  qrRasterScale: number;
  burbujaStroke: number;
  burbujaOffsetX: number;
  omrHeaderGap: number;
  omrTagWidth: number;
  omrTagHeight: number;
  omrTagFontSize: number;
  omrLabelFontSize: number;
  omrBoxBorderWidth: number;
  omrPanelPadding: number;
  fiducialMargin: number;
  fiducialQuietZone: number;
};

type LogoEmbed = {
  image: PDFImage;
  width: number;
  height: number;
};

type SegmentoTexto = { texto: string; font: PDFFont; size: number; esCodigo?: boolean; subrayado?: boolean };
type LineaSegmentos = { segmentos: SegmentoTexto[]; lineHeight: number };
type RectBox = { x: number; y: number; width: number; height: number };
type EstiloTexto = 'regular' | 'bold' | 'italic';
type TextRunDebug = {
  tipo: 'texto' | 'codigo';
  fuente: string;
  size: number;
  lineHeight: number;
  bbox: RectBox;
};

const PERFIL_OMR_CANONICO_RENDER: PerfilPlantillaRender = {
  ...PERFIL_OMR_CANONICO,
  version: 4,
  // Escala entera: evita bordes antialiasados al rasterizar cada modulo.
  qrRasterScale: 16,
  burbujaStroke: 1,
  burbujaOffsetX: 4.4,
  omrHeaderGap: 4,
  omrTagWidth: 23,
  omrTagHeight: 9,
  omrTagFontSize: 7.2,
  omrLabelFontSize: 5.6,
  omrBoxBorderWidth: 0.9,
  omrPanelPadding: 0.8,
  fiducialMargin: 0.9,
  fiducialQuietZone: PERFIL_OMR_CANONICO.fiducialQuietZone ?? 0.5 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
};

function mmAPuntos(mm: number) {
  return mm * MM_A_PUNTOS;
}

// Colision AABB para prevenir solapes de bloques en la plantilla final.
function rectInterseca(a: RectBox, b: RectBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Falla temprano si un bloque critico sale del area imprimible.
function assertRectDentroPagina(rect: RectBox, nombre: string) {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > ANCHO_CARTA || rect.y + rect.height > ALTO_CARTA) {
    throw new Error(`Layout invalido: ${nombre} fuera de la pagina`);
  }
}

// Los elementos de identidad no solo deben estar dentro de la hoja: deben
// estar contenidos en la reserva que los gobierna. La tolerancia permite
// absorber el redondeo de puntos sin ocultar un solape real.
function assertRectContenida(rect: RectBox, contenedor: RectBox, nombre: string, tolerancia = 0.01) {
  if (
    rect.x < contenedor.x - tolerancia ||
    rect.y < contenedor.y - tolerancia ||
    rect.x + rect.width > contenedor.x + contenedor.width + tolerancia ||
    rect.y + rect.height > contenedor.y + contenedor.height + tolerancia
  ) {
    throw new Error(`Layout invalido: ${nombre} fuera de su reserva`);
  }
}

function normalizarEspacios(valor: string) {
  return valor.replace(/\s+/g, ' ').trim();
}

function sanitizarTextoPdf(valor: string) {
  return String(valor ?? '')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2191/g, '^')
    .replace(/\u2193/g, 'v')
    .replace(/\u21d2/g, '=>')
    .replace(/\u21d0/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00b7/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u25cf/g, 'O')
    .replace(/\u25d0/g, 'O')
    .replace(/\u2717/g, 'x')
    .replace(/\u2713/g, 'v')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

function partirCodigoEnLineas(texto: string) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/\t/g, '  '));
}

// Detecta bloques fenced code (`...`) para render monoespaciado.
function partirBloquesCodigo(texto: string) {
  const src = String(texto ?? '');
  const bloques: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];
  let indice = 0;

  while (indice < src.length) {
    const inicio = src.indexOf('```', indice);
    if (inicio === -1) {
      bloques.push({ tipo: 'texto', contenido: src.slice(indice) });
      break;
    }

    if (inicio > indice) bloques.push({ tipo: 'texto', contenido: src.slice(indice, inicio) });

    const fin = src.indexOf('```', inicio + 3);
    if (fin === -1) {
      bloques.push({ tipo: 'texto', contenido: src.slice(inicio) });
      break;
    }

    const cuerpo = src.slice(inicio + 3, fin);
    const lineas = partirCodigoEnLineas(cuerpo);
    const primera = lineas[0] ?? '';
    const resto = lineas.slice(1);
    const pareceLenguaje = primera.trim().length > 0 && resto.length > 0;
    bloques.push({ tipo: 'codigo', contenido: (pareceLenguaje ? resto : lineas).join('\n') });
    indice = fin + 3;
  }

  return bloques;
}

// Tokeniza codigo inline con backticks para estilo diferenciado.
function partirInlineCodigo(texto: string) {
  const src = String(texto ?? '');
  const salida: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];
  let actual = '';
  let enCodigo = false;

  for (let indice = 0; indice < src.length; indice += 1) {
    const caracter = src[indice];
    if (caracter === '`') {
      salida.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
      actual = '';
      enCodigo = !enCodigo;
      continue;
    }
    actual += caracter;
  }

  salida.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
  return salida;
}

function partirInlineEstilosMarkdown(texto: string) {
  const src = String(texto ?? '');
  const salida: Array<{ texto: string; estilo: EstiloTexto; subrayado: boolean }> = [];
  let actual = '';
  let negrita = false;
  let cursiva = false;
  let subrayado = false;

  const estiloActual = (): EstiloTexto => {
    if (negrita) return 'bold';
    if (cursiva) return 'italic';
    return 'regular';
  };

  const pushActual = () => {
    if (!actual) return;
    salida.push({ texto: actual, estilo: estiloActual(), subrayado });
    actual = '';
  };

  let i = 0;
  while (i < src.length) {
    if (src.slice(i).match(/^<u>/i)) {
      pushActual();
      subrayado = true;
      i += 3;
      continue;
    }
    if (src.slice(i).match(/^<\/u>/i)) {
      pushActual();
      subrayado = false;
      i += 4;
      continue;
    }
    if (src[i] === '_' && src[i + 1] === '_') {
      pushActual();
      subrayado = !subrayado;
      i += 2;
      continue;
    }
    if (src[i] === '*' && src[i + 1] === '*') {
      pushActual();
      negrita = !negrita;
      i += 2;
      continue;
    }
    if (src[i] === '*') {
      pushActual();
      cursiva = !cursiva;
      i += 1;
      continue;
    }
    actual += src[i];
    i += 1;
  }
  pushActual();
  return salida;
}

function normalizarEspaciosSuaves(texto: string) {
  return String(texto ?? '')
    .replace(/\t/g, '  ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function widthSeg(segmento: SegmentoTexto) {
  return segmento.font.widthOfTextAtSize(segmento.texto, segmento.size);
}

// Word-wrap por segmentos preservando estilo (texto/codigo) y cortes seguros.
function envolverSegmentos({
  segmentos,
  maxWidth,
  preservarEspaciosIniciales
}: {
  segmentos: SegmentoTexto[];
  maxWidth: number;
  preservarEspaciosIniciales?: boolean;
}) {
  const lineas: SegmentoTexto[][] = [];
  let actual: SegmentoTexto[] = [];
  let anchoActual = 0;

  const pushLinea = () => {
    lineas.push(actual);
    actual = [];
    anchoActual = 0;
  };

  for (const segmento of segmentos) {
    const texto = String(segmento.texto ?? '');
    if (!texto) continue;

    const tokens = segmento.esCodigo ? [texto] : texto.split(/(\s+)/).filter((parte) => parte.length > 0);

    for (const token of tokens) {
      const esEspacio = /^\s+$/.test(token);
      if (!preservarEspaciosIniciales && actual.length === 0 && esEspacio) continue;

      const tokenSeg = { ...segmento, texto: token };
      const ancho = widthSeg(tokenSeg);
      if (anchoActual + ancho <= maxWidth) {
        actual.push(tokenSeg);
        anchoActual += ancho;
        continue;
      }

      if (actual.length > 0) {
        pushLinea();
        if (!preservarEspaciosIniciales && esEspacio) continue;
      }

      if (ancho > maxWidth) {
        let chunk = '';
        for (const caracter of token) {
          const siguiente = chunk + caracter;
          const anchoSiguiente = segmento.font.widthOfTextAtSize(siguiente, segmento.size);
          if (anchoSiguiente <= maxWidth) {
            chunk = siguiente;
            continue;
          }
          if (chunk) {
            actual.push({ ...segmento, texto: chunk });
            pushLinea();
          }
          chunk = caracter;
        }
        if (chunk) {
          actual.push({ ...segmento, texto: chunk });
          anchoActual = widthSeg({ ...segmento, texto: chunk });
        }
        continue;
      }

      actual.push(tokenSeg);
      anchoActual = ancho;
    }
  }

  if (actual.length > 0) lineas.push(actual);
  return lineas.length > 0 ? lineas : [[]];
}

// Envoltura de texto enriquecido con soporte de fenced-code e inline-code.
function envolverTextoMixto({
  texto,
  maxWidth,
  fuente,
  fuenteBold,
  fuenteItalica,
  fuenteMono,
  sizeTexto,
  sizeCodigoInline,
  sizeCodigoBloque,
  lineHeightTexto,
  lineHeightCodigo
}: {
  texto: string;
  maxWidth: number;
  fuente: PDFFont;
  fuenteBold: PDFFont;
  fuenteItalica: PDFFont;
  fuenteMono: PDFFont;
  sizeTexto: number;
  sizeCodigoInline: number;
  sizeCodigoBloque: number;
  lineHeightTexto: number;
  lineHeightCodigo: number;
}) {
  const bloques = partirBloquesCodigo(sanitizarTextoPdf(texto));
  const lineas: LineaSegmentos[] = [];

  for (const bloque of bloques) {
    if (bloque.tipo === 'codigo') {
      const lineasCodigo = partirCodigoEnLineas(bloque.contenido);
      for (const linea of lineasCodigo) {
        const seg: SegmentoTexto = { texto: String(linea ?? ''), font: fuenteMono, size: sizeCodigoBloque, esCodigo: true };
        const env = envolverSegmentos({ segmentos: [seg], maxWidth, preservarEspaciosIniciales: true });
        for (const lineaEnvuelta of env) {
          lineas.push({
            segmentos: lineaEnvuelta.length > 0 ? lineaEnvuelta : [{ ...seg, texto: '' }],
            lineHeight: lineHeightCodigo
          });
        }
      }
      continue;
    }

    const lineasTexto = String(bloque.contenido ?? '').replace(/\r\n?/g, '\n').split('\n');
    for (const lineaOriginal of lineasTexto) {
      const matchLista = /^(\s*(?:[-*]|\d+[.)]))\s+/.exec(lineaOriginal);
      const prefijoLista = matchLista ? `${matchLista[1].trim()} ` : '';
      const cuerpoLinea = matchLista ? lineaOriginal.slice(matchLista[0].length) : lineaOriginal;

      const inline = partirInlineCodigo(cuerpoLinea);
      const segmentos: SegmentoTexto[] = [];
      if (prefijoLista) {
        segmentos.push({ texto: prefijoLista, font: fuenteBold, size: sizeTexto, esCodigo: false });
      }

      for (const segmento of inline) {
        if (!segmento.contenido) continue;
        if (segmento.tipo === 'codigo') {
          const textoCodigo = normalizarEspaciosSuaves(String(segmento.contenido));
          if (!textoCodigo) continue;
          segmentos.push({ texto: textoCodigo, font: fuenteMono, size: sizeCodigoInline, esCodigo: true });
          continue;
        }

        const trozos = partirInlineEstilosMarkdown(String(segmento.contenido));
        for (const trozo of trozos) {
          const textoPlano = normalizarEspaciosSuaves(trozo.texto);
          if (!textoPlano) continue;
          const font = trozo.estilo === 'bold' ? fuenteBold : trozo.estilo === 'italic' ? fuenteItalica : fuente;
          segmentos.push({ texto: textoPlano, font, size: sizeTexto, esCodigo: false, subrayado: trozo.subrayado });
        }
      }

      if (segmentos.length === 0) {
        lineas.push({ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto });
        continue;
      }

      const segmentosConEspacios: SegmentoTexto[] = [];
      for (const segmento of segmentos) {
        if (segmentosConEspacios.length > 0) {
          const previo = segmentosConEspacios[segmentosConEspacios.length - 1];
          if (!/\s$/.test(previo.texto) && !/^\s/.test(segmento.texto)) {
            segmentosConEspacios.push({ texto: ' ', font: fuente, size: sizeTexto, esCodigo: false });
          }
        }
        segmentosConEspacios.push(segmento);
      }

      const env = envolverSegmentos({ segmentos: segmentosConEspacios, maxWidth });
      for (const linea of env) {
        lineas.push({
          segmentos: linea.length > 0 ? linea : [{ texto: '', font: fuente, size: sizeTexto }],
          lineHeight: lineHeightTexto
        });
      }
    }
  }

  return lineas.length > 0
    ? lineas
    : [{ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto }];
}

// Dibuja lineas mixtas respetando el espaciado calculado en la envoltura.
function dibujarLineasMixtas({
  page,
  lineas,
  x,
  y,
  colorTexto,
  registrarRuns
}: {
  page: PDFPage;
  lineas: LineaSegmentos[];
  x: number;
  y: number;
  colorTexto?: ReturnType<typeof rgb>;
  registrarRuns?: (run: TextRunDebug) => void;
}) {
  let cursorY = y;
  for (const linea of lineas) {
    let cursorX = x;
    for (const segmento of linea.segmentos) {
      const texto = String(segmento.texto ?? '');
      if (!texto) continue;
      page.drawText(texto, { x: cursorX, y: cursorY, size: segmento.size, font: segmento.font, color: colorTexto });
      const width = segmento.font.widthOfTextAtSize(texto, segmento.size);
      if (segmento.subrayado) {
        page.drawLine({
          start: { x: cursorX, y: cursorY - 1.2 },
          end: { x: cursorX + width, y: cursorY - 1.2 },
          color: colorTexto ?? rgb(0, 0, 0),
          thickness: Math.max(0.45, segmento.size * 0.045)
        });
      }
      if (registrarRuns) {
        registrarRuns({
          tipo: segmento.esCodigo ? 'codigo' : 'texto',
          fuente: segmento.esCodigo ? 'Courier' : 'Helvetica',
          size: segmento.size,
          lineHeight: linea.lineHeight,
          bbox: {
            x: cursorX,
            y: cursorY,
            width,
            height: Math.max(linea.lineHeight, segmento.size + 1)
          }
        });
      }
      cursorX += width;
    }
    cursorY -= linea.lineHeight;
  }
  return cursorY;
}

function partirEnLineas({
  texto,
  maxWidth,
  font,
  size
}: {
  texto: string;
  maxWidth: number;
  font: PDFFont;
  size: number;
}) {
  const limpio = normalizarEspacios(sanitizarTextoPdf(String(texto ?? '')));
  if (!limpio) return [''];

  const palabras = limpio.split(' ');
  const lineas: string[] = [];
  let actual = '';

  const cabe = (valor: string) => font.widthOfTextAtSize(valor, size) <= maxWidth;

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(candidato)) {
      actual = candidato;
      continue;
    }

    if (actual) lineas.push(actual);
    if (!cabe(palabra)) {
      let chunk = '';
      for (const caracter of palabra) {
        const siguiente = chunk + caracter;
        if (cabe(siguiente)) {
          chunk = siguiente;
        } else {
          if (chunk) lineas.push(chunk);
          chunk = caracter;
        }
      }
      actual = chunk;
    } else {
      actual = palabra;
    }
  }

  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [''];
}

function resolverPerfilRender(templateVersion: 4, perfilBase: PerfilPlantillaOmr): PerfilPlantillaRender {
  if (templateVersion !== TEMPLATE_VERSION_CANONICA) {
    throw new Error(`Template version ${String(templateVersion)} no compatible para renderer OMR canónico`);
  }
  const base = PERFIL_OMR_CANONICO_RENDER;
  return {
    ...base,
    version: TEMPLATE_VERSION_CANONICA,
    qrSize: perfilBase.qrSize,
    qrPadding: perfilBase.qrPadding,
    qrMarginModulos: perfilBase.qrMarginModulos,
    marcasEsquina: perfilBase.marcasEsquina,
    marcaCuadradoSize: perfilBase.marcaCuadradoSize,
    marcaCuadradoQuietZone: perfilBase.marcaCuadradoQuietZone,
    burbujaRadio: perfilBase.burbujaRadio,
    burbujaPasoY: perfilBase.burbujaPasoY,
    cajaOmrAncho: perfilBase.cajaOmrAncho,
    fiducialSize: perfilBase.fiducialSize,
    fiducialMargin: perfilBase.fiducialMargin ?? base.fiducialMargin,
    fiducialQuietZone: perfilBase.fiducialQuietZone ?? base.fiducialQuietZone,
    bubbleStrokePt: perfilBase.bubbleStrokePt ?? base.bubbleStrokePt,
    labelToBubbleMm: perfilBase.labelToBubbleMm ?? base.labelToBubbleMm,
    preguntasPorBloque: perfilBase.preguntasPorBloque ?? base.preguntasPorBloque,
    opcionesPorPregunta: perfilBase.opcionesPorPregunta ?? base.opcionesPorPregunta
  };
}

function agregarMarcasRegistro(page: PDFPage, margen: number, perfil: PerfilPlantillaRender) {
  const quiet = perfil.marcaCuadradoQuietZone;
  const tam = perfil.marcaCuadradoSize;
  const esquinas = [
    { x: margen, y: ALTO_CARTA - margen },
    { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
    { x: margen, y: margen },
    { x: ANCHO_CARTA - margen, y: margen }
  ];

  for (const esquina of esquinas) {
    // Las marcas de registro quedan completamente dentro de la hoja. Antes
    // se abrian hacia fuera y el borde del papel las recortaba al imprimir.
    const grosor = Math.max(0.8, Math.min(1.4, tam * 0.1));
    const esIzquierda = esquina.x === margen;
    const esSuperior = esquina.y === ALTO_CARTA - margen;
    const xHorizontal = esIzquierda ? esquina.x : esquina.x - tam;
    const yHorizontal = esSuperior ? esquina.y - grosor : esquina.y;
    const xVertical = esIzquierda ? esquina.x : esquina.x - grosor;
    const yVertical = esSuperior ? esquina.y - tam : esquina.y;

    const xMin = Math.max(0, Math.min(xHorizontal, xVertical) - quiet);
    const yMin = Math.max(0, Math.min(yHorizontal, yVertical) - quiet);
    const xMax = Math.min(ANCHO_CARTA, Math.max(xHorizontal + tam, xVertical + grosor) + quiet);
    const yMax = Math.min(ALTO_CARTA, Math.max(yHorizontal + grosor, yVertical + tam) + quiet);
    page.drawRectangle({ x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin, color: rgb(1, 1, 1) });

    page.drawRectangle({
      x: xHorizontal,
      y: yHorizontal,
      width: tam,
      height: grosor,
      color: rgb(0, 0, 0)
    });
    page.drawRectangle({
      x: xVertical,
      y: yVertical,
      width: grosor,
      height: tam,
      color: rgb(0, 0, 0)
    });
  }
}

function dibujarFiducialOmr(page: PDFPage, x: number, y: number, size: number, quietZone: number) {
  if (quietZone > 0) {
    page.drawRectangle({
      x: x - size / 2 - quietZone,
      y: y - size / 2 - quietZone,
      width: size + quietZone * 2,
      height: size + quietZone * 2,
      color: rgb(1, 1, 1)
    });
  }
  page.drawRectangle({
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
    color: rgb(0, 0, 0)
  });
}

async function agregarQr(pdfDoc: PDFDocument, page: PDFPage, qrTexto: string, margen: number, perfil: PerfilPlantillaRender) {
  const qrDataUrl = await QRCode.toDataURL(qrTexto, {
    margin: perfil.qrMarginModulos,
    scale: perfil.qrRasterScale,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const qrImage = await pdfDoc.embedPng(qrBytes);

  const qrSize = perfil.qrSize;
  const padding = perfil.qrPadding;
  const boxW = qrSize + padding * 2;
  const boxH = qrSize + padding * 2;

  // La caja exterior completa, incluido su quiet zone, queda dentro de la
  // cabecera y alineada con el borde imprimible. Antes el calculo usaba solo
  // el bitmap y dejaba el marco del QR fuera del encabezado.
  const bordeDerechoReserva = ANCHO_CARTA - margen - 7;
  const bordeSuperiorReserva = ALTO_CARTA - margen - 5;
  const x = bordeDerechoReserva - qrSize - padding;
  const y = bordeSuperiorReserva - qrSize - padding;

  page.drawRectangle({
    x: x - padding,
    y: y - padding,
    width: boxW,
    height: boxH,
    color: rgb(1, 1, 1),
    borderWidth: 1,
    borderColor: rgb(0.75, 0.79, 0.84)
  });

  page.drawImage(qrImage, {
    x,
    y,
    width: qrSize,
    height: qrSize
  });

  return { qrSize, x, y, padding };
}

async function intentarEmbedImagen(pdfDoc: PDFDocument, src?: string): Promise<LogoEmbed | undefined> {
  const ruta = String(src ?? '').trim();
  if (!ruta) return undefined;

  try {
    const embeberBuffer = async (buffer: Buffer, formato: string) => {
      const formatoNormalizado = formato.toLowerCase();
      if (formatoNormalizado === 'png') {
        const image = await pdfDoc.embedPng(buffer);
        return { image, width: image.width, height: image.height };
      }
      if (formatoNormalizado === 'jpg' || formatoNormalizado === 'jpeg') {
        const image = await pdfDoc.embedJpg(buffer);
        return { image, width: image.width, height: image.height };
      }

      // Formatos no nativos de pdf-lib: convertir de forma segura a PNG en memoria.
      const convertidoPng = await sharp(buffer, { animated: true }).png().toBuffer();
      const image = await pdfDoc.embedPng(convertidoPng);
      return { image, width: image.width, height: image.height };
    };

    const dataUrlMatch = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(ruta);
    if (dataUrlMatch) {
      const formato = (dataUrlMatch[1] || '').toLowerCase();
      const base64 = dataUrlMatch[2] ?? '';
      const buffer = Buffer.from(base64, 'base64');
      return await embeberBuffer(buffer, formato);
    }

    const candidatos = (() => {
      if (path.isAbsolute(ruta)) return [ruta];
      const cwd = process.cwd();
      return [
        path.resolve(cwd, ruta),
        path.resolve(cwd, '..', ruta),
        path.resolve(cwd, '..', '..', ruta),
        path.resolve(cwd, '..', '..', '..', ruta)
      ];
    })();

    let encontrada: string | undefined;
    for (const candidato of candidatos) {
      try {
        await fs.access(candidato);
        encontrada = candidato;
        break;
      } catch {
        // continúa búsqueda
      }
    }

    const objetivo = encontrada ?? (path.isAbsolute(ruta) ? ruta : path.resolve(process.cwd(), ruta));
    const buffer = await fs.readFile(objetivo);
    const ext = path.extname(objetivo).toLowerCase().replace('.', '');
    return await embeberBuffer(buffer, ext || 'png');
  } catch {
    return undefined;
  }
}

function dibujarPatronGeometricoEncabezado(page: PDFPage, rect: RectBox, color: ReturnType<typeof rgb>) {
  const diamondWidth = 13;
  const diamondHeight = 7;
  const horizontalGap = 24;
  const verticalGap = 19;
  for (let y = rect.y + 14; y <= rect.y + rect.height - diamondHeight - 8; y += verticalGap) {
    for (let x = rect.x + 18; x <= rect.x + rect.width - diamondWidth - 18; x += horizontalGap) {
      const top = { x: x + diamondWidth / 2, y: y + diamondHeight };
      const right = { x: x + diamondWidth, y: y + diamondHeight / 2 };
      const bottom = { x: x + diamondWidth / 2, y };
      const left = { x, y: y + diamondHeight / 2 };
      page.drawLine({ start: top, end: right, color, thickness: 0.35, opacity: 0.1 });
      page.drawLine({ start: right, end: bottom, color, thickness: 0.35, opacity: 0.1 });
      page.drawLine({ start: bottom, end: left, color, thickness: 0.35, opacity: 0.1 });
      page.drawLine({ start: left, end: top, color, thickness: 0.35, opacity: 0.1 });
    }
  }
}

function dibujarDegradadoEncabezado(page: PDFPage, rect: RectBox) {
  const bandas = 14;
  const altoBanda = rect.height / bandas;
  for (let indice = 0; indice < bandas; indice += 1) {
    const t = indice / Math.max(1, bandas - 1);
    page.drawRectangle({
      x: rect.x,
      y: rect.y + indice * altoBanda,
      width: rect.width,
      height: altoBanda + 0.5,
      color: rgb(0.93 - t * 0.06, 0.98 - t * 0.04, 1),
      opacity: 0.2
    });
  }
}

function dibujarMarcoLogo(
  page: PDFPage,
  rect: RectBox,
  colorAcento: ReturnType<typeof rgb>,
  colorLinea: ReturnType<typeof rgb>,
  fuente: PDFFont,
  etiqueta: string
) {
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
    opacity: 0.78,
    borderColor: colorLinea,
    borderWidth: 0.65,
    borderOpacity: 0.9
  });

  // Respaldo ilustrativo vectorial: mantiene la identidad visual y la reserva
  // del logo aunque el docente no haya cargado una imagen.
  const centroX = rect.x + rect.width / 2;
  const centroY = rect.y + rect.height * 0.58;
  const radio = Math.min(rect.width, rect.height) * 0.22;
  page.drawCircle({ x: centroX, y: centroY, size: radio, color: colorAcento, opacity: 0.18, borderColor: colorAcento, borderWidth: 1 });
  page.drawLine({ start: { x: centroX - radio * 1.45, y: centroY - radio * 1.55 }, end: { x: centroX + radio * 1.45, y: centroY - radio * 1.55 }, color: colorAcento, thickness: 1.1, opacity: 0.72 });
  page.drawLine({ start: { x: centroX - radio * 1.1, y: centroY - radio * 2.05 }, end: { x: centroX + radio * 1.1, y: centroY - radio * 2.05 }, color: colorAcento, thickness: 0.7, opacity: 0.58 });
  const size = Math.min(6.5, Math.max(5, rect.width * 0.14));
  const ancho = fuente.widthOfTextAtSize(etiqueta, size);
  page.drawText(etiqueta, { x: centroX - ancho / 2, y: rect.y + rect.height * 0.12, size, font: fuente, color: colorAcento, opacity: 0.72 });
}

function dibujarBordePagina(page: PDFPage, margen: number, color: ReturnType<typeof rgb>) {
  const inset = margen + 3.5;
  page.drawRectangle({
    x: inset,
    y: inset,
    width: ANCHO_CARTA - inset * 2,
    height: ALTO_CARTA - inset * 2,
    borderColor: color,
    borderWidth: 0.65,
    borderOpacity: 0.52
  });
}

async function intentarEmbedFuenteEcofont(pdfDoc: PDFDocument): Promise<PDFFont | undefined> {
  const nombreArchivo = 'ecofont_vera_sans_regular.ttf';
  const configurada = String(process.env.EXAMEN_FONT_ECOFONT_PATH ?? '').trim();
  const cwd = process.cwd();
  const candidatos = [
    ...(configurada ? [configurada] : []),
    path.resolve(cwd, 'apps', 'backend', 'assets', 'fonts', nombreArchivo),
    path.resolve(cwd, 'assets', 'fonts', nombreArchivo),
    path.resolve(cwd, '..', 'assets', 'fonts', nombreArchivo),
    path.resolve(cwd, '..', 'apps', 'backend', 'assets', 'fonts', nombreArchivo),
    path.resolve(cwd, '..', '..', 'apps', 'backend', 'assets', 'fonts', nombreArchivo)
  ];

  for (const candidato of candidatos) {
    try {
      const buffer = await fs.readFile(candidato);
      return await pdfDoc.embedFont(buffer, { subset: true });
    } catch {
      // La salida sigue siendo funcional si una instalación no trae el asset.
    }
  }
  return undefined;
}

function mapearPreguntasOrdenadas(examen: ExamenPdf) {
  const mapa = new Map(examen.preguntas.map((pregunta) => [pregunta.id, pregunta]));
  return examen.mapaVariante.ordenPreguntas
    .map((idPregunta) => mapa.get(idPregunta))
    .filter((pregunta): pregunta is ExamenPdf['preguntas'][number] => Boolean(pregunta));
}

export class PdfKitRenderer {
  constructor(
    private readonly perfilOmr: PerfilPlantillaOmr,
    private readonly perfilLayout: PerfilLayoutImpresion
  ) {}

  async generarPdf(examen: ExamenPdf): Promise<ResultadoGeneracionPdf> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fuente = (await intentarEmbedFuenteEcofont(pdfDoc)) ?? await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fuenteBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fuenteItalica = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fuenteMono = await pdfDoc.embedFont(StandardFonts.Courier);

    void examen.tipoExamen;

    const templateVersion = examen.layout.templateVersion;
    if (templateVersion !== TEMPLATE_VERSION_CANONICA) {
      throw new Error(`Template version ${String(templateVersion)} no compatible para renderer OMR canónico`);
    }
    const perfilOmr = resolverPerfilRender(templateVersion, this.perfilOmr);
    const margenMm = examen.layout.margenMm;
    const margen = mmAPuntos(margenMm);
    const paginasObjetivo = Number.isFinite(examen.layout.totalPaginas)
      ? Math.max(1, Math.floor(examen.layout.totalPaginas))
      : 1;

    const colorPrimario = rgb(...PDF_VISUAL_BASELINE_RGB.primary);
    const colorGris = rgb(...PDF_VISUAL_BASELINE_RGB.textSoft);
    const colorLinea = rgb(...PDF_VISUAL_BASELINE_RGB.line);
    const colorAcento = rgb(...PDF_VISUAL_BASELINE_RGB.accent);
    const colorAcentoSuave = rgb(...PDF_VISUAL_BASELINE_RGB.accentSoft);
    const colorSeccion = rgb(...PDF_VISUAL_BASELINE_RGB.section);
    const colorTinta = rgb(...PDF_VISUAL_BASELINE_RGB.primary);
    const colorPanelOmr = rgb(0.985, 0.99, 1);

    // Plantilla base en puntos (1pt ~= 1px a 72dpi) para posicionamiento estable.
    const PLANTILLA_PX = Object.freeze({
      headerPadTop: 10,
      headerPadBottom: 10,
      titleGap: 2.5,
      lemaGap: 2,
      metaGapTop: 2,
      metaLine: 10.8,
      // Estos valores son separaciones entre cajas tipograficas, no distancias
      // de linea base; asi se evita que el texto de una fila invada la otra.
      camposGapTop: 3,
      campoRowGap: 3,
      // La linea del campo queda debajo del glifo, no atravesando la etiqueta.
      campoLineOffsetY: -2.5
    });

    const fontScale = Math.min(1.3, Math.max(0.9, Number(examen.layout.fontScale ?? 1) || 1));
    const lineSpacing = Math.min(1.6, Math.max(0.9, Number(examen.layout.lineSpacing ?? 1) || 1));
    const sizeTitulo = 15.6 * fontScale;
    // Tipografia de lectura humana. Estos valores recuperan la escala legible
    // del generador original y mantienen fontScale/lineSpacing configurables;
    // el OMR se conserva como columna secundaria, no como sustituto del texto.
    const sizeMeta = 9 * fontScale;
    const sizePregunta = 10.6 * fontScale;
    const sizeOpcion = 9 * fontScale;
    const sizeCodigoInline = 8.6 * fontScale;
    const sizeCodigoBloque = 8.4 * fontScale;

    const lineaPregunta = Math.max(13.2 * fontScale, sizePregunta * 1.24) * lineSpacing;
    const lineaOpcion = Math.max(11.4 * fontScale, sizeOpcion * 1.24) * lineSpacing;
    const lineaCodigoBloque = Math.max(10.8 * fontScale, sizeCodigoBloque * 1.24) * lineSpacing;
    // Separacion corta pero visible: el ritmo lo aporta la linea divisoria y
    // el bloque numerado, no un hueco vertical que robe reactivos legibles.
    const separacionPregunta = 2 * lineSpacing;

    const omrTotalLetras = 5;
    const omrRadio = perfilOmr.burbujaRadio;
    const omrPasoY = perfilOmr.burbujaPasoY;
    const omrMargenHorizontal = 4;
    const omrEtiquetaGap = 3.2;
    const omrMargenSuperior = 13;
    const omrMargenInferior = 5;
    // El panel OMR compacto usa una fila horizontal de cinco burbujas. La
    // geometria queda en el mapa por pregunta, pero deja altura suficiente
    // para el minimo editorial de 10 reactivos por pagina.
    // Cinco celdas independientes (letra + separacion + burbuja) necesitan
    // mas ancho que una fila basada solo en centros; evita que las letras
    // terminen dentro de la burbuja anterior al imprimir.
    // La reserva OMR debe poder leerse y marcarse sin que la etiqueta de una
    // opcion quede pegada a la burbuja anterior. El ancho minimo es parte de
    // la composicion visual, no solo del calculo de deteccion.
    const anchoColRespuesta = perfilOmr.cajaOmrAncho;
    if (!Number.isFinite(anchoColRespuesta) || anchoColRespuesta < 132) {
      throw new Error(`Perfil OMR canónico inválido: ancho de caja ${String(anchoColRespuesta)}pt`);
    }
    const gutterRespuesta = 8;
    // El panel y su halo blanco deben quedar dentro del borde imprimible.
    // Antes se alineaban con el margen nominal y cruzaban el marco interior.
    const safeRight = ANCHO_CARTA - margen - 7;
    const xColRespuesta = safeRight - anchoColRespuesta;
    const xDerechaTexto = xColRespuesta - gutterRespuesta;

    const xNumeroPregunta = margen;
    const xTextoPregunta = margen + 22;
    const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

    const instruccionesDefault =
      'Por favor conteste las siguientes preguntas referentes al parcial. ' +
      'Rellene el círculo de la respuesta más adecuada, evitando salirse del mismo. ' +
      'Cada pregunta vale 10 puntos si está completa y es correcta.';

    const defaultInstitucion = 'Centro Universitario Hidalguense';
    const defaultLema = 'La sabiduria es nuestra fuerza';

    const institucion = String(examen.encabezado?.institucion ?? process.env.EXAMEN_INSTITUCION ?? defaultInstitucion).trim();
    const lema = String(examen.encabezado?.lema ?? process.env.EXAMEN_LEMA ?? defaultLema).trim();
    const materia = String(examen.encabezado?.materia ?? '').trim();
    const docente = String(examen.encabezado?.docente ?? '').trim();
    const mostrarInstrucciones = examen.encabezado?.mostrarInstrucciones !== false;
    const instrucciones = String(examen.encabezado?.instrucciones ?? '').trim() || instruccionesDefault;
    // La cabecera central tiene un ancho finito entre los dos logos y el QR.
    // Estimar las lineas antes de crear las paginas permite hacerla mas alta
    // solo para contenido largo, sin penalizar la densidad de examenes normales.
    const qrRectXEstimado = ANCHO_CARTA - margen - 7 - perfilOmr.qrSize - perfilOmr.qrPadding * 2;
    const logoDerechoXEstimado = qrRectXEstimado - 10 - 50 - 8;
    const xTextoHeaderEstimado = margen + 74;
    const anchoHeaderCentralEstimado = Math.max(220, logoDerechoXEstimado - 10 - xTextoHeaderEstimado);
    const estimarLineasCabecera = (texto: string, font: PDFFont, size: number) =>
      partirEnLineas({ texto, maxWidth: anchoHeaderCentralEstimado, font, size }).length;
    const metaCampos = [
      materia ? `Materia: ${materia}` : '',
      docente ? `Docente: ${docente}` : ''
    ].filter(Boolean);
    const lineasMetaEstimadas = metaCampos.reduce(
      (total, campo) => total + estimarLineasCabecera(campo, fuente, sizeMeta),
      0
    );
    const lineasExtraCabecera = Math.max(
      0,
      estimarLineasCabecera(institucion, fuenteBold, 12.6 * fontScale) - 1
    ) + Math.max(
      0,
      estimarLineasCabecera(examen.titulo, fuenteBold, sizeTitulo) - 1
    ) + Math.max(
      0,
      estimarLineasCabecera(lema, fuenteItalica, 9.6 * fontScale) - 1
    ) + Math.max(
      0,
      lineasMetaEstimadas - 1
    );
    const altoEncabezadoPrimeraMinimo = 96 + lineasExtraCabecera * 12;
    const logoIzqSrc = String(examen.layout.logos?.izquierdaPath ?? '').trim()
      || String(examen.encabezado?.logos?.izquierdaPath ?? '').trim()
      || String(process.env.EXAMEN_LOGO_IZQ_PATH ?? '').trim()
      || 'logos/logo_cuh.png';
    const logoDerSrc = String(examen.layout.logos?.derechaPath ?? '').trim()
      || String(examen.encabezado?.logos?.derechaPath ?? '').trim()
      || String(process.env.EXAMEN_LOGO_DER_PATH ?? '').trim()
      || 'logos/logo_sys.png';

    const logoIzquierda = await intentarEmbedImagen(pdfDoc, logoIzqSrc);
    const logoDerecha = await intentarEmbedImagen(pdfDoc, logoDerSrc);

    const preguntasOrdenadas = mapearPreguntasOrdenadas(examen);
    const totalPreguntas = preguntasOrdenadas.length;

    const imagenesPregunta = new Map<string, LogoEmbed>();
    const estadoImagenPregunta = new Map<string, 'ok' | 'error'>();
    let imagenesIntentadas = 0;
    let imagenesRenderizadas = 0;
    let imagenesFallidas = 0;
    for (const pregunta of preguntasOrdenadas) {
      const src = String(pregunta.imagenUrl ?? '').trim();
      if (!src) continue;
      imagenesIntentadas += 1;
      const emb = await intentarEmbedImagen(pdfDoc, src);
      if (emb) {
        imagenesPregunta.set(pregunta.id, emb);
        estadoImagenPregunta.set(pregunta.id, 'ok');
        imagenesRenderizadas += 1;
      } else {
        estadoImagenPregunta.set(pregunta.id, 'error');
        imagenesFallidas += 1;
      }
    }

    const GRID_STEP = this.perfilLayout.gridStepPt;
    // Redondear al punto de retícula más cercano evita que `floor` acumule
    // hasta un paso completo por reactivo y robe espacio útil de la página.
    // La planificación y el render comparten esta misma operación para que
    // el último reactivo previsto coincida con el que realmente se dibuja.
    const snapToGrid = (y: number) => Math.round(y / GRID_STEP) * GRID_STEP;

    const markerSpec: MarkerSpecOmr = {
      family: 'solid_square_4pt_v1',
      sizeMm: Number((perfilOmr.fiducialSize / MM_A_PUNTOS).toFixed(2)),
      quietZoneMm: Number((perfilOmr.fiducialQuietZone / MM_A_PUNTOS).toFixed(2))
    };
    const letrasOmr = Array.from({ length: omrTotalLetras }, (_valor, idx) => String.fromCharCode(65 + idx));
    const etiquetaAnchoMaxOmr = Math.max(...letrasOmr.map((letra) => fuente.widthOfTextAtSize(letra, 6.8)));
    const diametroBurbujaOmr = omrRadio * 2;
    const pasoBurbujaX = etiquetaAnchoMaxOmr + omrEtiquetaGap + diametroBurbujaOmr;
    const blockSpec: BlockSpecOmr = {
      preguntasPorBloque: perfilOmr.preguntasPorBloque ?? 10,
      opcionesPorPregunta: perfilOmr.opcionesPorPregunta ?? 5,
      bubbleDiameterMm: Number((diametroBurbujaOmr / MM_A_PUNTOS).toFixed(2)),
      bubblePitchXmm: Number((pasoBurbujaX / MM_A_PUNTOS).toFixed(2)),
      bubblePitchYmm: Number((omrPasoY / MM_A_PUNTOS).toFixed(2)),
      labelToBubbleMm: Number((perfilOmr.labelToBubbleMm ?? 5).toFixed(2)),
      bubbleStrokePt: Number((perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke).toFixed(2))
    };
    const engineHints: EngineHintsOmr = {
      preferredEngine: 'cv',
      enableClahe: true,
      adaptiveThreshold: true,
      conservativeDecision: true,
      // El mapa se consume por pagina en el endpoint OMR. Mantener la
      // coordenada del PDF evita recalibraciones locales sobre los fiduciales.
      forceSimpleScale: true,
      // La escala global da una base estable; los cuatro fiduciales sólidos
      // permiten después corregir el desplazamiento local de cada panel.
      useMapCoordinatesStrict: false
    };

    const paginasMeta: ResultadoGeneracionPdf['paginas'] = [];
    const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
    const paginasOmr: PaginaOmr[] = [];
    const lineHeightViolations: Array<{ pagina: number; preguntaId: string; lineHeight: number; min: number }> = [];
    let minLineHeightApplied = Number.POSITIVE_INFINITY;

    const maxWidthIndicaciones = Math.max(120, xDerechaTexto - (margen + 10));
    const mostrarBloqueIndicaciones = ['1', 'true', 'yes', 'si'].includes(
      String(process.env.EXAMEN_LAYOUT_MOSTRAR_BLOQUE_INDICACIONES ?? '1').trim().toLowerCase()
    );
    const indicacionesPendientes = mostrarBloqueIndicaciones && mostrarInstrucciones && instrucciones.length > 0;

    const headerHeightFirst = this.perfilLayout.headerHeightFirst;
    const headerHeightOther = this.perfilLayout.headerHeightOther;

    let indicePregunta = 0;
    let numeroPagina = 1;

    // La cantidad configurada es un objetivo editorial, no un limite que
    // pueda provocar reactivos omitidos cuando el contenido exige mas alto.
    // El tope defensivo evita bucles infinitos si un reactivo es imposible de
    // acomodar con la tipografia minima legible.
    const maxPaginasSeguras = Math.max(paginasObjetivo, totalPreguntas + 1);
    while (numeroPagina <= maxPaginasSeguras && indicePregunta < totalPreguntas) {
      const page = pdfDoc.addPage([ANCHO_CARTA, ALTO_CARTA]);
      const qrTextoPagina = examen.generarTextoQrPagina(numeroPagina);

      let preguntasDel = 0;
      let preguntasAl = 0;
      const mapaPagina: PaginaOmr['preguntas'] = [];
      const headerTextBlocks: Array<{ x: number; y: number; width: number; height: number; id: string }> = [];
      const continuationTextBlocks: Array<{ x: number; y: number; width: number; height: number; id: string }> = [];
      const headerSlotBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const headerFieldBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const questionBlockBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const omrPanelBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const collisionBoxes: Array<{ pagina: number; a: string; b: string }> = [];
      let rectIndicaciones: RectBox | undefined;
      let rectContinuacion: RectBox | undefined;

      const yTop = ALTO_CARTA - margen;
      const esPrimera = numeroPagina === 1;
      const altoEncabezado = esPrimera ? Math.max(headerHeightFirst, altoEncabezadoPrimeraMinimo) : headerHeightOther;
      const xCaja = margen + 4;
      const wCaja = ANCHO_CARTA - 2 * margen - 8;
      const yCaja = yTop - altoEncabezado;

      // El texto se dibuja desde la linea base hacia arriba; dejar solo 8 pt
      // despues del encabezado permite que el primer glifo invada su borde.
      let yFinHeaderPrimera = yCaja - 24;
      if (esPrimera) {
        if (this.perfilLayout.usarRellenosDecorativos) {
          page.drawRectangle({ x: xCaja, y: yCaja, width: wCaja, height: altoEncabezado, color: colorSeccion });
        }
        // Borde base de la cabecera, antes de aplicar sus zonas de identidad.
        page.drawRectangle({
          x: xCaja,
          y: yCaja,
          width: wCaja,
          height: altoEncabezado,
          borderWidth: 0.8,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : rgb(1, 1, 1)
        });

        dibujarDegradadoEncabezado(
          page,
          { x: xCaja + 1, y: yCaja + 1, width: wCaja - 2, height: altoEncabezado - 2 }
        );
        dibujarPatronGeometricoEncabezado(
          page,
          { x: xCaja + 1, y: yCaja + 1, width: wCaja - 2, height: altoEncabezado - 2 },
          colorAcento
        );

        // Una regla superior aporta identidad sin atravesar la tipografia. La
        // banda anterior ocupaba las mismas coordenadas que institucion y
        // titulo, por lo que los glifos quedaban cortados visualmente.
        if (this.perfilLayout.usarRellenosDecorativos) {
          page.drawRectangle({
            x: xCaja + 1,
            y: yTop - 7,
            width: wCaja - 2,
            height: 3.5,
            color: colorPrimario
          });
          page.drawRectangle({
            x: xCaja + 1,
            y: yTop - 7,
            width: wCaja - 2,
            height: 1.1,
            color: colorAcento
          });
        }

        // Banda inferior: concentra los campos que la persona debe llenar y
        // evita que compitan visualmente con la identidad institucional.
        page.drawRectangle({
          x: xCaja + 1,
          y: yCaja + 7,
          width: wCaja - 2,
          height: 42,
          color: rgb(1, 1, 1),
          opacity: 0.82
        });
        page.drawRectangle({
          x: xCaja + 1,
          y: yCaja + 7,
          width: 3.5,
          height: 42,
          color: colorAcento,
          opacity: 0.88
        });
        page.drawLine({
          start: { x: xCaja + 8, y: yCaja + 49 },
          end: { x: xCaja + wCaja - 8, y: yCaja + 49 },
          color: colorLinea,
          thickness: 0.55,
          opacity: 0.72
        });

        // Acento interior: separa visualmente la identidad institucional del
        // contenido sin reducir el area util del encabezado.
        if (this.perfilLayout.usarRellenosDecorativos) {
          page.drawRectangle({
            x: xCaja + 5,
            y: yCaja + 8,
            width: 3.5,
            height: Math.max(24, altoEncabezado - 16),
            color: colorAcento
          });
        }

        page.drawLine({
          start: { x: xCaja, y: yTop - 6 },
          end: { x: xCaja + wCaja, y: yTop - 6 },
          color: colorLinea,
          thickness: 0.95
        });
      }

      agregarMarcasRegistro(page, margen, perfilOmr);
      dibujarBordePagina(page, margen, colorLinea);
      const { x: xQr, y: yQr, padding: qrPadding, qrSize } = await agregarQr(pdfDoc, page, qrTextoPagina, margen, perfilOmr);
      const rectHeader: RectBox = { x: xCaja, y: yCaja, width: wCaja, height: altoEncabezado };
      const rectQr: RectBox = {
        x: xQr - qrPadding,
        y: yQr - qrPadding,
        width: qrSize + qrPadding * 2,
        height: qrSize + qrPadding * 2
      };
      assertRectDentroPagina(rectHeader, 'encabezado');
      assertRectDentroPagina(rectQr, 'qr');
      if (esPrimera) {
        assertRectContenida(rectQr, rectHeader, 'reserva QR de primera pagina');
      }

      const marcasPagina: PaginaOmr['marcasPagina'] = {
        tipo: perfilOmr.marcasEsquina,
        size: perfilOmr.marcaCuadradoSize,
        quietZone: perfilOmr.marcaCuadradoQuietZone,
        tl: { x: margen, y: ALTO_CARTA - margen },
        tr: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
        bl: { x: margen, y: margen },
        br: { x: ANCHO_CARTA - margen, y: margen }
      };

      const yFolio = yQr - qrPadding - 8;
      const yPag = yFolio - 8;
      const folioQr = examen.folioNormalizado;
      if (yFolio > yCaja + 4) {
        page.drawText(folioQr, { x: xQr, y: yFolio, size: 8.1, font: fuenteBold, color: colorPrimario });
        page.drawText(`PAG ${numeroPagina}`, { x: xQr, y: yPag, size: 7.6, font: fuente, color: colorGris });
      }

      let limiteContenidoContinuacion = Number.POSITIVE_INFINITY;
      if (!esPrimera) {
        // La reserva del QR ya no deja una franja superior visualmente muerta:
        // se utiliza para identificar la continuacion sin competir con el
        // primer reactivo ni con los elementos OMR.
        const xContinuacion = xCaja + 8;
        const etiquetaContinuacion = 'CONTINUACIÓN DEL EXAMEN';
        const etiquetaSize = 7.1;
        const etiquetaWidth = fuenteBold.widthOfTextAtSize(etiquetaContinuacion, etiquetaSize);
        const wContinuacion = Math.max(180, rectQr.x - xContinuacion - 16);
        const xEtiqueta = xContinuacion + wContinuacion - etiquetaWidth - 9;
        const maxWidthTitulo = Math.max(80, xEtiqueta - (xContinuacion + 9) - 12);
        let tituloSize = 10.2;
        while (tituloSize > 7.2 && fuenteBold.widthOfTextAtSize(examen.titulo, tituloSize) > maxWidthTitulo) {
          tituloSize = Math.max(7.2, tituloSize - 0.2);
        }
        const lineasTitulo = partirEnLineas({
          texto: examen.titulo,
          maxWidth: maxWidthTitulo,
          font: fuenteBold,
          size: tituloSize
        });
        const lineasTituloSeguras = lineasTitulo.length > 0 ? lineasTitulo : ['Examen'];
        const tituloLineGap = tituloSize + 1;
        const altoBandaContinuacion = Math.max(21, 10 + lineasTituloSeguras.length * tituloLineGap);
        const yContinuacion = yTop - 10 - altoBandaContinuacion;
        rectContinuacion = { x: xContinuacion, y: yContinuacion, width: wContinuacion, height: altoBandaContinuacion };
        limiteContenidoContinuacion = yContinuacion - 10;
        page.drawRectangle({
          x: xContinuacion,
          y: yContinuacion,
          width: wContinuacion,
          height: altoBandaContinuacion,
          color: colorSeccion,
          opacity: 0.94,
          borderColor: colorLinea,
          borderWidth: 0.5,
          borderOpacity: 0.7
        });
        page.drawRectangle({
          x: xContinuacion,
          y: yContinuacion + altoBandaContinuacion - 3.5,
          width: wContinuacion,
          height: 3.5,
          color: colorPrimario
        });
        const yTituloInicial = yContinuacion + 6 + (lineasTituloSeguras.length - 1) * tituloLineGap;
        for (let indiceLinea = 0; indiceLinea < lineasTituloSeguras.length; indiceLinea += 1) {
          const linea = lineasTituloSeguras[indiceLinea] ?? '';
          const yLinea = yTituloInicial - indiceLinea * tituloLineGap;
          page.drawText(linea, {
            x: xContinuacion + 9,
            y: yLinea,
            size: tituloSize,
            font: fuenteBold,
            color: colorPrimario
          });
          continuationTextBlocks.push({
            id: `continuacion-titulo-${indiceLinea}`,
            x: xContinuacion + 9,
            y: yLinea,
            width: fuenteBold.widthOfTextAtSize(linea, tituloSize),
            height: tituloSize + 1
          });
        }
        const yEtiqueta = yContinuacion + Math.max(5, (altoBandaContinuacion - etiquetaSize) / 2 - 1);
        page.drawText(etiquetaContinuacion, {
          x: xEtiqueta,
          y: yEtiqueta,
          size: etiquetaSize,
          font: fuenteBold,
          color: colorAcento
        });
        continuationTextBlocks.push({
          id: 'continuacion-etiqueta',
          x: xEtiqueta,
          y: yEtiqueta,
          width: etiquetaWidth,
          height: etiquetaSize + 1
        });
      }

      page.drawText(folioQr, { x: margen, y: margen - 16, size: 8.5, font: fuenteBold, color: colorPrimario });
      page.drawText(`PAG ${numeroPagina}`, { x: margen, y: margen - 26, size: 8, font: fuente, color: colorGris });
      page.drawText(`Pagina ${numeroPagina}`, {
        x: ANCHO_CARTA - margen - 120,
        y: margen - 16,
        size: 8.5,
        font: fuente,
        color: colorGris
      });
      page.drawLine({
        start: { x: margen, y: margen - 6 },
        end: { x: ANCHO_CARTA - margen, y: margen - 6 },
        color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : colorLinea,
        thickness: 0.75
      });

      if (esPrimera) {
        const headerLeft = xCaja + 8;
        const logoSlotLeftX = headerLeft + 2;
        const logoSlotWidth = 50;
        const logoSlotHeight = 50;
        const xTextoHeader = logoSlotLeftX + logoSlotWidth + 10;
        const qrSlotLeft = rectQr.x - 10;
        const logoDerechoSlotWidth = logoSlotWidth;
        const logoDerechoSlotX = qrSlotLeft - logoDerechoSlotWidth - 8;
        const xMaxEnc = logoDerechoSlotX - 10;
        const maxWidthEnc = Math.max(220, xMaxEnc - xTextoHeader);
        const xCentroHeader = xTextoHeader + maxWidthEnc / 2;
        const innerTop = yTop - PLANTILLA_PX.headerPadTop;
        const innerBottom = yCaja + PLANTILLA_PX.headerPadBottom;
        const xTextoCentrado = (texto: string, font: PDFFont, size: number) => {
          const ancho = font.widthOfTextAtSize(texto, size);
          const xObjetivo = xCentroHeader - ancho / 2;
          return Math.max(xTextoHeader, Math.min(xMaxEnc - ancho, xObjetivo));
        };

        const ajustarLineas = (texto: string, font: PDFFont, size: number) =>
          partirEnLineas({ texto, maxWidth: maxWidthEnc, font, size });

        let escala = 1;
        let yNombre = innerBottom + 24;
        let yGrupo = innerBottom + 8;
        let metaLineas: string[] = [];
        let instiLineas: string[] = [];
        let titLineas: string[] = [];
        let lemLineas: string[] = [];
        let sizeInst = 12 * fontScale;
        let sizeTit = sizeTitulo;
        let sizeLem = 9 * fontScale;
        let sizeMetaEsc = sizeMeta;
        let sizeCampo = 9.6 * fontScale;
        let metaLineGap: number = PLANTILLA_PX.metaLine;
        let yInsti = innerTop - sizeInst;
        let yTitulo = yInsti;
        let yLema = yTitulo;
        let yMeta = yLema;

        for (let i = 0; i < 8; i += 1) {
          sizeInst = 12.6 * fontScale * escala;
          sizeTit = sizeTitulo * escala;
          sizeLem = 9.6 * fontScale * escala;
          sizeMetaEsc = sizeMeta * escala;
          sizeCampo = 10.2 * fontScale * escala;
          metaLineGap = Math.max(PLANTILLA_PX.metaLine * escala, sizeMetaEsc + 1.2);
          instiLineas = ajustarLineas(institucion, fuenteBold, sizeInst);
          titLineas = ajustarLineas(examen.titulo, fuenteBold, sizeTit);
          lemLineas = lema ? ajustarLineas(lema, fuenteItalica, sizeLem) : [];

          const lineGapInst = sizeInst + 1.2;
          const lineGapTit = sizeTit + 1.2;
          const lineGapLem = sizeLem + 1.1;
          yInsti = innerTop - sizeInst;
          const yInstUltima = yInsti - Math.max(0, instiLineas.length - 1) * lineGapInst;
          yTitulo = yInstUltima - (sizeTit + 1 + PLANTILLA_PX.titleGap * escala);
          const yTituloUltima = yTitulo - Math.max(0, titLineas.length - 1) * lineGapTit;
          yLema = lemLineas.length > 0
            ? yTituloUltima - (sizeLem + 1 + PLANTILLA_PX.lemaGap * escala)
            : yTituloUltima - 2;
          const yLemaUltima = yLema - Math.max(0, lemLineas.length - 1) * lineGapLem;
          yMeta = yLemaUltima - (sizeMetaEsc + 1 + PLANTILLA_PX.metaGapTop * escala);
          // Cada campo conserva su etiqueta y ocupa su propia linea. Unirlos
          // en un solo parrafo hacia que el nombre del docente quedara
          // centrado como si fuera una continuacion de la materia.
          metaLineas = metaCampos.flatMap((campo) => partirEnLineas({
            texto: campo,
            maxWidth: maxWidthEnc,
            font: fuente,
            size: sizeMetaEsc
          }));
          const yMetaUlt = yMeta - (Math.max(1, metaLineas.length) - 1) * metaLineGap;
          const yNombreCalculado = yMetaUlt - (sizeCampo + 1 + PLANTILLA_PX.camposGapTop * escala);
          // Los campos de captura viven en una banda propia, debajo del panel
          // central. Esto evita que la linea de nombre atraviese metadatos o
          // se confunda con el borde decorativo del bloque superior.
          const yLimiteSuperiorCampos = yMeta - 7 - 4;
          yNombre = Math.min(yNombreCalculado, yLimiteSuperiorCampos - sizeCampo - 1);
          yGrupo = yNombre - (sizeCampo + 1 + PLANTILLA_PX.campoRowGap * escala);

          if (yGrupo >= innerBottom + 1) {
            break;
          }
          escala = Math.max(0.78, escala - 0.06);
        }

        const panelCentralBottom = yMeta - 7;
        const panelCentralTop = yInsti + sizeInst + 5;
        page.drawRectangle({
          x: xTextoHeader + 5,
          y: panelCentralBottom,
          width: Math.max(80, maxWidthEnc - 10),
          height: Math.max(32, panelCentralTop - panelCentralBottom),
          color: rgb(1, 1, 1),
          opacity: 0.9,
          borderColor: colorLinea,
          borderWidth: 0.35,
          borderOpacity: 0.32
        });
        const fieldBandBottom = yGrupo - 5;
        const fieldBandTop = panelCentralBottom - 1;
        if (fieldBandTop > fieldBandBottom) {
          page.drawRectangle({
            x: xTextoHeader + 5,
            y: fieldBandBottom,
            width: Math.max(80, maxWidthEnc - 10),
            height: fieldBandTop - fieldBandBottom,
            color: rgb(0.97, 0.99, 1),
            opacity: 0.92,
            borderColor: colorLinea,
            borderWidth: 0.3,
            borderOpacity: 0.25
          });
        }

        // La cabecera ahora es clara; mantener la institucion en blanco aqui
        // la hacia practicamente invisible al eliminar la banda oscura.
        const colorInstitucion = colorAcento;
        const dibujarLineasCabecera = (
          lineas: string[],
          yInicial: number,
          lineGap: number,
          font: PDFFont,
          size: number,
          color: ReturnType<typeof rgb>,
          id: string
        ) => {
          lineas.forEach((linea, indice) => {
            const yLinea = yInicial - indice * lineGap;
            const xLinea = xTextoCentrado(linea, font, size);
            page.drawText(linea, { x: xLinea, y: yLinea, size, font, color });
            headerTextBlocks.push({
              id: `${id}-${indice + 1}`,
              x: xLinea,
              y: yLinea,
              width: font.widthOfTextAtSize(linea, size),
              height: size + 1
            });
          });
        };

        dibujarLineasCabecera(instiLineas, yInsti, sizeInst + 1.2, fuenteBold, sizeInst, colorInstitucion, 'institucion');
        dibujarLineasCabecera(titLineas, yTitulo, sizeTit + 1.2, fuenteBold, sizeTit, colorPrimario, 'titulo');
        dibujarLineasCabecera(lemLineas, yLema, sizeLem + 1.1, fuenteItalica, sizeLem, colorGris, 'lema');

        metaLineas.forEach((linea, indice) => {
          if (!linea) return;
          const yLinea = yMeta - indice * metaLineGap;
          const xMeta = xTextoCentrado(linea, fuente, sizeMetaEsc);
          page.drawText(linea, {
            x: xMeta,
            y: yLinea,
            size: sizeMetaEsc,
            font: fuente,
            color: colorGris
          });
          headerTextBlocks.push({
            id: `meta-${indice + 1}`,
            x: xMeta,
            y: yLinea,
            width: fuente.widthOfTextAtSize(linea, sizeMetaEsc),
            height: sizeMetaEsc + 1
          });
        });

        const etiquetaNombre = 'Nombre del alumno:';
        const etiquetaGrupo = 'Grupo:';
        const anchoEtiquetaNombre = fuenteBold.widthOfTextAtSize(etiquetaNombre, sizeCampo);
        const anchoEtiquetaGrupo = fuenteBold.widthOfTextAtSize(etiquetaGrupo, sizeCampo);
        const xLineaNombre = Math.min(xTextoHeader + anchoEtiquetaNombre + 6, xMaxEnc - 260);
        const xLineaGrupo = xTextoHeader + anchoEtiquetaGrupo + 12;
        const xLineaGrupoFin = Math.min(xMaxEnc, xLineaGrupo + 42);

        page.drawText(etiquetaNombre, { x: xTextoHeader, y: yNombre, size: sizeCampo, font: fuenteBold, color: colorPrimario });
        headerTextBlocks.push({
          id: 'nombre-etiqueta',
          x: xTextoHeader,
          y: yNombre,
          width: fuenteBold.widthOfTextAtSize(etiquetaNombre, sizeCampo),
          height: sizeCampo + 1
        });
        page.drawLine({
          start: { x: xLineaNombre, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          end: { x: xMaxEnc, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          color: colorLinea,
          thickness: 0.8
        });
        headerFieldBoxes.push({
          id: 'nombre-linea',
          x: xLineaNombre,
          y: yNombre + PLANTILLA_PX.campoLineOffsetY - 0.4,
          width: Math.max(0, xMaxEnc - xLineaNombre),
          height: 0.8
        });
        page.drawText(etiquetaGrupo, { x: xTextoHeader, y: yGrupo, size: sizeCampo, font: fuenteBold, color: colorPrimario });
        headerTextBlocks.push({
          id: 'grupo-etiqueta',
          x: xTextoHeader,
          y: yGrupo,
          width: fuenteBold.widthOfTextAtSize(etiquetaGrupo, sizeCampo),
          height: sizeCampo + 1
        });
        page.drawLine({
          start: { x: xLineaGrupo, y: yGrupo + PLANTILLA_PX.campoLineOffsetY },
          end: { x: xLineaGrupoFin, y: yGrupo + PLANTILLA_PX.campoLineOffsetY },
          color: colorLinea,
          thickness: 0.8
        });
        headerFieldBoxes.push({
          id: 'grupo-linea',
          x: xLineaGrupo,
          y: yGrupo + PLANTILLA_PX.campoLineOffsetY - 0.4,
          width: Math.max(0, xLineaGrupoFin - xLineaGrupo),
          height: 0.8
        });

        const logoY = innerTop - logoSlotHeight - 2;
        const logoIzqSlot: RectBox = {
          x: logoSlotLeftX,
          y: logoY,
          width: logoSlotWidth,
          height: logoSlotHeight
        };
        const logoDerSlot: RectBox = {
          x: logoDerechoSlotX,
          y: logoY,
          width: logoDerechoSlotWidth,
          height: logoSlotHeight
        };
        assertRectDentroPagina(logoIzqSlot, 'slot-logo-izquierdo');
        assertRectDentroPagina(logoDerSlot, 'slot-logo-derecho');
        assertRectContenida(logoIzqSlot, rectHeader, 'slot-logo-izquierdo');
        assertRectContenida(logoDerSlot, rectHeader, 'slot-logo-derecho');
        if (rectInterseca(logoIzqSlot, rectQr) || rectInterseca(logoDerSlot, rectQr)) {
          throw new Error('Layout invalido: un slot de logo invade la reserva del QR');
        }
        headerSlotBoxes.push(
          { id: 'logo-izquierdo', ...logoIzqSlot },
          { id: 'logo-derecho', ...logoDerSlot }
        );
        dibujarMarcoLogo(page, logoIzqSlot, colorAcento, colorLinea, fuenteBold, 'INST.');
        dibujarMarcoLogo(page, logoDerSlot, colorAcento, colorLinea, fuenteBold, 'PROG.');

        if (logoIzquierda) {
          const escala = Math.min(1, logoSlotWidth / Math.max(1, logoIzquierda.width), logoSlotHeight / Math.max(1, logoIzquierda.height));
          const w = logoIzquierda.width * escala;
          const h = logoIzquierda.height * escala;
          const xLogo = logoSlotLeftX + (logoSlotWidth - w) / 2;
          const yLogo = logoIzqSlot.y + (logoSlotHeight - h) / 2;
          page.drawImage(logoIzquierda.image, { x: xLogo, y: yLogo, width: w, height: h });
        }

        if (logoDerecha) {
          const escala = Math.min(1, logoDerechoSlotWidth / Math.max(1, logoDerecha.width), logoSlotHeight / Math.max(1, logoDerecha.height));
          const w = logoDerecha.width * escala;
          const h = logoDerecha.height * escala;
          const xLogo = logoDerechoSlotX + (logoDerechoSlotWidth - w) / 2;
          const yLogo = logoDerSlot.y + (logoSlotHeight - h) / 2;
          if (xLogo + w <= rectQr.x - 8) {
            page.drawImage(logoDerecha.image, { x: xLogo, y: yLogo, width: w, height: h });
          }
        }

        yFinHeaderPrimera = Math.min(yCaja - 24, yGrupo - 10);
      }

      // La reserva del QR y la metadata son zonas independientes: cualquier
      // interseccion aqui es un error de composicion, no una preferencia visual.
      for (let i = 0; i < headerTextBlocks.length; i += 1) {
        const bloque = headerTextBlocks[i];
        assertRectContenida(bloque, rectHeader, `texto ${bloque.id} de la cabecera de la pagina ${numeroPagina}`);
        if (rectInterseca(bloque, rectQr)) {
          collisionBoxes.push({ pagina: numeroPagina, a: bloque.id, b: 'qr' });
        }
        for (let j = i + 1; j < headerTextBlocks.length; j += 1) {
          const otro = headerTextBlocks[j];
          if (rectInterseca(bloque, otro)) {
            collisionBoxes.push({ pagina: numeroPagina, a: bloque.id, b: otro.id });
          }
        }
      }
      for (const field of headerFieldBoxes) {
        if (rectInterseca(field, rectQr)) {
          collisionBoxes.push({ pagina: numeroPagina, a: field.id, b: 'qr' });
        }
        for (const textBlock of headerTextBlocks) {
          if (rectInterseca(field, textBlock)) {
            collisionBoxes.push({ pagina: numeroPagina, a: field.id, b: textBlock.id });
          }
        }
      }
      if (rectContinuacion) {
        assertRectDentroPagina(rectContinuacion, 'banda de continuacion');
        for (let i = 0; i < continuationTextBlocks.length; i += 1) {
          const bloque = continuationTextBlocks[i];
          assertRectContenida(bloque, rectContinuacion, `texto ${bloque.id} de la continuacion`);
          if (rectInterseca(bloque, rectQr)) {
            collisionBoxes.push({ pagina: numeroPagina, a: bloque.id, b: 'qr' });
          }
          for (let j = i + 1; j < continuationTextBlocks.length; j += 1) {
            const otro = continuationTextBlocks[j];
            if (rectInterseca(bloque, otro)) {
              collisionBoxes.push({ pagina: numeroPagina, a: bloque.id, b: otro.id });
            }
          }
        }
      }
      if (collisionBoxes.length > 0) {
        const detalle = collisionBoxes.map((colision) => `${colision.a}<->${colision.b}`).join(', ');
        throw new Error(`Layout invalido: colisiones en cabecera de la pagina ${numeroPagina}: ${detalle}`);
      }

      // Reserva separacion visual clara entre encabezado y primera pregunta.
      const yZonaContenidoBase = esPrimera
        ? Math.min(yFinHeaderPrimera, yCaja - 24)
        // La primera pregunta de una continuación usa la zona izquierda junto
        // al QR. Su panel permanece debajo del QR, en la columna derecha; así
        // se aprovecha la franja superior sin superponer reservas.
        : Math.min(yTop - 16, rectQr.y + 28, limiteContenidoContinuacion);
      // En continuacion, el primer reactivo usa la izquierda del QR y su
      // panel se baja por separado; no es necesario desperdiciar toda la
      // franja superior solo por la reserva derecha.
      const yZonaContenido = yZonaContenidoBase;
      const cursorYInicio = snapToGrid(yZonaContenido);
      if (esPrimera && cursorYInicio >= yCaja) {
        throw new Error('Layout invalido: el contenido invade el encabezado de la primera pagina');
      }
      let cursorY = cursorYInicio;

      const alturaDisponibleMin = margen + this.perfilLayout.bottomSafePt;
      const maxImagenPreguntaAncho = Math.min(anchoTextoPregunta * 0.42, 130);
      const maxImagenPreguntaAlto = 34;
      // Las cajas de texto usan baseline + lineHeight; reservar una línea
      // completa evita que el ascendente de "A)" toque o invada el borde
      // inferior de la ilustración al imprimir.
      const separacionImagenOpciones = Math.max(4, lineaOpcion, lineaCodigoBloque) + 1.5;

      const xDerechaTextoContinuacion = Math.max(
        xTextoPregunta + 60,
        Math.min(xDerechaTexto, rectQr.x - 10, xColRespuesta - gutterRespuesta)
      );
      const obtenerLayoutOpciones = (
        pregunta: ExamenPdf['preguntas'][number],
        limiteDerecho = xDerechaTexto
      ) => {
        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const totalOpciones = ordenOpciones.length;
        const anchoOpcionesTotal = Math.max(80, limiteDerecho - xTextoPregunta);
        const candidatos = totalOpciones >= 5 ? [2, 3] : [1, 2];
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);

        return candidatos
          .map((columnas) => {
            const porColumna = Math.ceil(totalOpciones / columnas);
            const gutterCols = columnas === 3 ? 6 : 8;
            const colWidth = totalOpciones > 1
              ? (anchoOpcionesTotal - gutterCols * (columnas - 1)) / columnas
              : anchoOpcionesTotal;
            const cols = Array.from(
              { length: columnas },
              (_valor, idx) => ordenOpciones.slice(idx * porColumna, (idx + 1) * porColumna)
            );
            const alturas = cols.map((col) => col.reduce((total, indiceOpcion) => {
              const opcion = pregunta.opciones[indiceOpcion];
              const lineas = envolverTextoMixto({
                texto: opcion?.texto ?? '',
                maxWidth: Math.max(30, colWidth - prefixWidth),
                fuente,
                fuenteBold,
                fuenteItalica,
                fuenteMono,
                sizeTexto: sizeOpcion,
                sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
                sizeCodigoBloque,
                lineHeightTexto: lineaOpcion,
                lineHeightCodigo: lineaCodigoBloque
              });
              return total + lineas.reduce((acc, linea) => acc + linea.lineHeight, 0) + 0.3;
            }, 0));

            return { columnas, porColumna, gutterCols, colWidth, alturas };
          })
          .sort((a, b) => {
            const alturaA = Math.max(...a.alturas);
            const alturaB = Math.max(...b.alturas);
            // Dos columnas ofrecen mayor ancho de lectura. Solo se cambia a
            // tres cuando la reduccion vertical es material, por ejemplo en
            // opciones extensas que de otro modo dispararian otra pagina.
            const ratioAB = alturaA / Math.max(1, alturaB);
            const ratioBA = alturaB / Math.max(1, alturaA);
            if (a.columnas === 2 && b.columnas === 3 && ratioAB <= 1.35) return -1;
            if (a.columnas === 3 && b.columnas === 2 && ratioBA <= 1.35) return 1;
            return alturaA - alturaB || a.columnas - b.columnas;
          })[0]!;
      };

      const calcularAlturaPregunta = (
        pregunta: ExamenPdf['preguntas'][number],
        limiteDerecho = xDerechaTexto
      ) => {
        const anchoTextoPreguntaActual = Math.max(60, limiteDerecho - xTextoPregunta);
        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPreguntaActual,
          fuente,
          fuenteBold,
          fuenteItalica: fuenteItalica,
          fuenteMono,
          sizeTexto: sizePregunta,
          sizeCodigoInline,
          sizeCodigoBloque,
          lineHeightTexto: lineaPregunta,
          lineHeightCodigo: lineaCodigoBloque
        });

        let alto = lineasEnunciado.reduce((acc, linea) => acc + linea.lineHeight, 0);

        const emb = imagenesPregunta.get(pregunta.id);
        if (emb) {
          const maxW = Math.min(maxImagenPreguntaAncho, anchoTextoPreguntaActual * 0.42);
          const maxH = maxImagenPreguntaAlto;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          alto += emb.height * escala + separacionImagenOpciones;
        }

        const layoutOpciones = obtenerLayoutOpciones(pregunta, limiteDerecho);
        const altoOpciones = Math.max(...layoutOpciones.alturas);
        const altoOmrMin = omrRadio * 2 + omrMargenSuperior + omrMargenInferior;
        // En continuaciones el panel de la primera pregunta vive en la
        // columna derecha, debajo del QR. Medirlo como una segunda fila bajo
        // las opciones inflaba artificialmente la altura y dejaba páginas
        // finales subutilizadas.
        alto += Math.max(altoOpciones, altoOmrMin);
        // El render ajusta el cursor a la retícula después de cada bloque y
        // conserva la línea divisoria. La reserva adicional cubre ese ajuste
        // y la diferencia entre la altura tipográfica estimada y la posición
        // final de las opciones, evitando planificar contenido que luego no
        // alcanza el margen inferior seguro. La holgura queda acotada para
        // conservar diez reactivos legibles en una hoja Letter cuando el
        // contenido es corto; el ajuste de retícula ya cubre el redondeo.
        alto += separacionPregunta + 2;
        return alto;
      };

      if (esPrimera && indicacionesPendientes) {
        const xInd = margen + 10;
        const yTopInd = yCaja - 8;
        const wIndMax = Math.max(140, xDerechaTexto - xInd - 6);
        const wInd = Math.min(wIndMax, maxWidthIndicaciones + 16);

        const hDisponible = yTopInd - (alturaDisponibleMin + 2);
        let hMin = 30;
        const hMax = Math.max(hMin, hDisponible);

        let sizeIndicaciones = 8 * fontScale;
        let lineaIndicaciones = 9.6 * fontScale * lineSpacing;
        // Reservar una franja propia para el rotulo evita que la primera
        // linea de instrucciones invada el titulo al renderizar en PDF.
        const offsetPrimeraLinea = 31;
        const paddingInferior = 8;
        let lineasIndicaciones = partirEnLineas({
          texto: instrucciones,
          maxWidth: wInd - 16,
          font: fuente,
          size: sizeIndicaciones
        });

        for (let i = 0; i < 10; i += 1) {
          const hNecesaria = offsetPrimeraLinea + lineasIndicaciones.length * lineaIndicaciones + paddingInferior;
          if (hNecesaria <= hMax) break;
          sizeIndicaciones = Math.max(7.2, sizeIndicaciones - 0.2);
          lineaIndicaciones = Math.max(8.6, lineaIndicaciones - 0.2);
          lineasIndicaciones = partirEnLineas({
            texto: instrucciones,
            maxWidth: wInd - 16,
            font: fuente,
            size: sizeIndicaciones
          });
        }

        const hNecesariaFinal = offsetPrimeraLinea + lineasIndicaciones.length * lineaIndicaciones + paddingInferior;
        hMin = Math.max(hMin, hNecesariaFinal, 40);
        const hCaja = Math.max(hMin, hNecesariaFinal);

        page.drawRectangle({
          x: xInd,
          y: yTopInd - hCaja,
          width: wInd,
          height: hCaja,
          borderWidth: 1,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorSeccion : rgb(1, 1, 1)
        });
        rectIndicaciones = { x: xInd, y: yTopInd - hCaja, width: wInd, height: hCaja };

        page.drawRectangle({
          x: xInd,
          y: yTopInd - 4,
          width: wInd,
          height: 4,
          color: colorPrimario
        });

        page.drawLine({
          start: { x: xInd + 8, y: yTopInd - 21 },
          end: { x: xInd + Math.min(wInd - 8, 92), y: yTopInd - 21 },
          color: colorLinea,
          thickness: 0.8
        });

        page.drawText('Indicaciones', { x: xInd + 8, y: yTopInd - 16, size: 9 * fontScale, font: fuenteBold, color: colorAcento });

        let yLinea = yTopInd - offsetPrimeraLinea;
        const yMinTexto = yTopInd - hCaja + 8;
        if (yLinea < yMinTexto) yLinea = yMinTexto;

        for (const linea of lineasIndicaciones) {
          if (yLinea < yMinTexto) break;
          page.drawText(linea, { x: xInd + 8, y: yLinea, size: sizeIndicaciones, font: fuente, color: colorTinta });
          yLinea -= lineaIndicaciones;
        }

        // La línea base no es el límite superior del glifo: reservar este
        // espacio evita que ascendentes/descendentes invadan el borde de la
        // caja de indicaciones en el PDF impreso.
        // La separación editorial después de las indicaciones debe conservar
        // un colchón tipográfico real: la línea base no coincide con el borde
        // superior de los glifos del primer enunciado.
        cursorY = snapToGrid(yTopInd - hCaja - 18);
        if (hCaja > hDisponible || cursorY <= alturaDisponibleMin) {
          throw new Error(`Layout invalido: el bloque de indicaciones deja sin espacio la pagina ${numeroPagina}`);
        }
      }

      const minPreguntasPorPagina = Math.max(
        1,
        Number.parseInt(String(process.env.EXAMEN_MIN_PREGUNTAS_POR_PAGINA ?? '10'), 10) || 10
      );
      const maxPreguntasPorPagina = Math.max(
        minPreguntasPorPagina,
        Number.parseInt(String(process.env.EXAMEN_MAX_PREGUNTAS_POR_PAGINA ?? '15'), 10) || 15
      );
      const paginasRestantesIncluyendoActual = Math.max(1, paginasObjetivo - numeroPagina + 1);
      const preguntasRestantesIncluyendoActual = Math.max(0, totalPreguntas - indicePregunta);
      // El mínimo editorial solo aplica cuando el banco contiene suficientes
      // reactivos para llenar todas las páginas objetivo. En exámenes cortos,
      // imponerlo concentra todo al principio y deja una última hoja casi
      // vacía (por ejemplo, 12 reactivos -> 10 + 2).
      const minimoPlanificado = totalPreguntas >= minPreguntasPorPagina * paginasObjetivo
        ? minPreguntasPorPagina
        : 1;
      // Repartir de forma equilibrada evita concentrar reactivos en una hoja
      // y dejar la siguiente visualmente vacia. El rango editorial conserva
      // entre 10 y 15 reactivos cuando el contenido lo permite.
      const objetivoBalance = Math.ceil(preguntasRestantesIncluyendoActual / paginasRestantesIncluyendoActual);
      let topePaginaActual = Math.max(minimoPlanificado, Math.min(maxPreguntasPorPagina, objetivoBalance));
      const planPagina: Array<{ indice: number; altura: number }> = [];
      let yPlanPagina = cursorY;
      const recalcularPlanPagina = () => {
        let yBase = cursorY;
        for (const item of planPagina) yBase = snapToGrid(yBase - item.altura);
        const separacionExtraPlan = planPagina.length > 1
          ? Math.min(
            22,
            Math.max(0, (yBase - alturaDisponibleMin) / (planPagina.length - 1) - GRID_STEP)
          )
          : 0;
        let yRender = cursorY;
        for (let indice = 0; indice < planPagina.length; indice += 1) {
          const item = planPagina[indice]!;
          yRender = snapToGrid(yRender - item.altura - (indice < planPagina.length - 1 ? separacionExtraPlan : 0));
        }
        return { yBase, yRender };
      };
      while (indicePregunta + planPagina.length < preguntasOrdenadas.length && planPagina.length < topePaginaActual) {
        const preguntaPlan = preguntasOrdenadas[indicePregunta + planPagina.length];
        if (!preguntaPlan) break;
        const esPrimeraContinuacionPlan = !esPrimera && planPagina.length === 0;
        const limiteDerechoPlan = esPrimeraContinuacionPlan ? xDerechaTextoContinuacion : xDerechaTexto;
        const alturaPlan = calcularAlturaPregunta(
          preguntaPlan,
          limiteDerechoPlan
        );
        if (process.env.DEBUG_PDF_BALANCE === '1') console.error(`[pdf-plan] pagina=${numeroPagina} idx=${indicePregunta + planPagina.length + 1} y=${yPlanPagina.toFixed(2)} h=${alturaPlan.toFixed(2)} safe=${alturaDisponibleMin.toFixed(2)}`);
        if (yPlanPagina - alturaPlan < alturaDisponibleMin) break;
        planPagina.push({ indice: indicePregunta + planPagina.length, altura: alturaPlan });
        // El renderer vuelve a ajustar cada cursor a la retícula de impresión;
        // simularlo durante la planificación evita acumular fracciones que
        // permiten planear un reactivo que el render real ya no puede dibujar.
        yPlanPagina = snapToGrid(yPlanPagina - alturaPlan);
      }
      while (planPagina.length > 0) {
        const simulacion = recalcularPlanPagina();
        if (simulacion.yRender >= alturaDisponibleMin) {
          yPlanPagina = simulacion.yBase;
          break;
        }
        planPagina.pop();
      }
      if (planPagina.length === 0) yPlanPagina = cursorY;
      if (process.env.DEBUG_PDF_BALANCE === '1') {
        console.error(`[pdf-plan-final] pagina=${numeroPagina} n=${planPagina.length} yBase=${yPlanPagina.toFixed(2)} yRender=${recalcularPlanPagina().yRender.toFixed(2)}`);
      }
      // Si la primera hoja no alcanza el mínimo editorial, el objetivo
      // original de páginas ya no es físicamente viable con este contenido.
      // Reservar una continuación adicional y limitar el primer bloque evita
      // el patrón 8/6/6; los exámenes cortos quedan fuera de esta regla porque
      // no activan el mínimo editorial (por ejemplo, 12 reactivos -> 6/6).
      if (
        esPrimera &&
        paginasObjetivo > 1 &&
        totalPreguntas >= minPreguntasPorPagina * paginasObjetivo &&
        planPagina.length < minPreguntasPorPagina
      ) {
        const objetivoConContinuacion = Math.ceil(totalPreguntas / (paginasObjetivo + 1));
        const limitePrimeraHoja = Math.max(1, Math.min(planPagina.length, objetivoConContinuacion));
        while (planPagina.length > limitePrimeraHoja) {
          planPagina.pop();
        }
        yPlanPagina = recalcularPlanPagina().yBase;
      }
      // Si el corte natural dejaria uno, dos o tres reactivos en una pagina
      // adicional, probar colas crecientes del plan actual. Mover solo el
      // ultimo reactivo no siempre cabe porque la primera pregunta de una
      // continuación tiene una reserva lateral para el QR; probar una cola
      // mayor evita conservar una hoja casi vacía por una falsa dicotomía.
      if (!esPrimera && planPagina.length > 2) {
        const restantesTrasPlan = preguntasOrdenadas.length - (indicePregunta + planPagina.length);
        if (restantesTrasPlan > 0 && restantesTrasPlan <= minPreguntasPorPagina) {
          const yInicioNuevaContinuacion = snapToGrid(
            Math.min(yTop - 16, rectQr.y + 28, limiteContenidoContinuacion)
          );
          const maxReactivosParaMover = Math.min(planPagina.length - 2, 5);
          let movimientoElegido = 0;
          let mejorDiferencia = Number.POSITIVE_INFINITY;
          for (let reactivosAMover = 1; reactivosAMover <= maxReactivosParaMover; reactivosAMover += 1) {
            const totalNuevaPagina = reactivosAMover + restantesTrasPlan;
            let yNuevaPagina = yInicioNuevaContinuacion;
            let cabenEnNuevaPagina = true;
            for (let offset = 0; offset < totalNuevaPagina; offset += 1) {
              const indicePlan = indicePregunta + planPagina.length - reactivosAMover + offset;
              const preguntaPlan = preguntasOrdenadas[indicePlan];
              if (!preguntaPlan) {
                cabenEnNuevaPagina = false;
                break;
              }
              const limiteDerechoPlan = offset === 0 ? xDerechaTextoContinuacion : xDerechaTexto;
              const alturaPlan = calcularAlturaPregunta(preguntaPlan, limiteDerechoPlan);
              if (yNuevaPagina - alturaPlan < alturaDisponibleMin) {
                cabenEnNuevaPagina = false;
                break;
              }
              yNuevaPagina -= alturaPlan;
            }
            if (cabenEnNuevaPagina) {
              const paginaActualTrasMovimiento = planPagina.length - reactivosAMover;
              const diferencia = Math.abs(paginaActualTrasMovimiento - totalNuevaPagina);
              if (diferencia < mejorDiferencia) {
                mejorDiferencia = diferencia;
                movimientoElegido = reactivosAMover;
              }
            }
          }
          if (movimientoElegido > 0) {
            for (let indice = 0; indice < movimientoElegido; indice += 1) planPagina.pop();
            yPlanPagina = recalcularPlanPagina().yBase;
          }
        }
      }
      // El sobrante se reparte entre reactivos ya planificados. La separación
      // se limita por intervalo, no por página completa: así una continuación
      // corta no queda comprimida arriba, pero tampoco crea huecos editoriales
      // excesivos entre preguntas.
      // `calcularAlturaPregunta` incluye holgura defensiva para no planificar
      // bloques al limite. No se reutiliza como espacio dibujable: hacerlo
      // puede provocar una hoja adicional en bancos que parecen cortos pero
      // tienen opciones de dos lineas.
      const espacioLibrePagina = Math.max(0, yPlanPagina - alturaDisponibleMin);
      const separacionExtraPagina = planPagina.length > 1
        ? Math.min(22, espacioLibrePagina / (planPagina.length - 1))
        : 0;
      while (indicePregunta < preguntasOrdenadas.length && cursorY > alturaDisponibleMin) {
        if (mapaPagina.length >= planPagina.length) break;
        const pregunta = preguntasOrdenadas[indicePregunta];
        const numero = indicePregunta + 1;
        const yPreguntaTop = cursorY;
        const textRunsPregunta: TextRunDebug[] = [];
        let imagenPregunta: RectBox | undefined;
        const esPrimeraPreguntaContinuacion = !esPrimera && mapaPagina.length === 0;
        const limiteDerechoPregunta = esPrimeraPreguntaContinuacion ? xDerechaTextoContinuacion : xDerechaTexto;
        const anchoTextoPreguntaActual = Math.max(60, limiteDerechoPregunta - xTextoPregunta);

        const alturaNecesaria = calcularAlturaPregunta(
          pregunta,
          limiteDerechoPregunta
        );
        if (cursorY - alturaNecesaria < alturaDisponibleMin) break;

        if (!preguntasDel) preguntasDel = numero;
        preguntasAl = numero;

        const textoNumero = String(numero);
        const wNum = 18;
        const hNum = 14;
        const xNum = xNumeroPregunta;
        const yNum = cursorY - 1;
        const sizeNum = textoNumero.length >= 3 ? 8 : 9;
        const numWidth = fuenteBold.widthOfTextAtSize(textoNumero, sizeNum);
        page.drawRectangle({
          x: xNum,
          y: yNum,
          width: wNum,
          height: hNum,
          borderWidth: 0.7,
          borderColor: colorPrimario,
          color: colorPrimario
        });
        page.drawText(textoNumero, {
          x: xNum + (wNum - numWidth) / 2,
          y: yNum + 3.2,
          size: sizeNum,
          font: fuenteBold,
          color: rgb(1, 1, 1)
        });
        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPreguntaActual,
          fuente,
          fuenteBold,
          fuenteItalica: fuenteItalica,
          fuenteMono,
          sizeTexto: sizePregunta,
          sizeCodigoInline,
          sizeCodigoBloque,
          lineHeightTexto: lineaPregunta,
          lineHeightCodigo: lineaCodigoBloque
        });
        const minLocalEnunciado = Math.max(12.8 * fontScale, sizePregunta * 1.24) * lineSpacing;
        for (const linea of lineasEnunciado) {
          minLineHeightApplied = Math.min(minLineHeightApplied, linea.lineHeight);
          if (linea.lineHeight + 0.001 < minLocalEnunciado) {
            lineHeightViolations.push({
              pagina: numeroPagina,
              preguntaId: pregunta.id,
              lineHeight: linea.lineHeight,
              min: minLocalEnunciado
            });
          }
        }
        cursorY = dibujarLineasMixtas({
          page,
          lineas: lineasEnunciado,
          x: xTextoPregunta,
          y: cursorY,
          registrarRuns: (run) => textRunsPregunta.push(run)
        });

        const emb = imagenesPregunta.get(pregunta.id);
        if (emb) {
          const maxW = Math.min(maxImagenPreguntaAncho, anchoTextoPreguntaActual * 0.42);
          const maxH = maxImagenPreguntaAlto;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          const w = emb.width * escala;
          const h = emb.height * escala;
          imagenPregunta = { x: xTextoPregunta, y: cursorY - h, width: w, height: h };
          page.drawImage(emb.image, imagenPregunta);
          cursorY -= h + separacionImagenOpciones;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const layoutOpciones = obtenerLayoutOpciones(pregunta, limiteDerechoPregunta);
        const { columnas, porColumna, gutterCols, colWidth } = layoutOpciones;
        const xCols = Array.from({ length: columnas }, (_valor, idx) => xTextoPregunta + idx * (colWidth + gutterCols));
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);

        const yInicioOpciones = cursorY;
        const yCols = Array.from({ length: columnas }, () => yInicioOpciones);

        const opcionesOmr: Array<{ letra: string; x: number; y: number }> = [];

        const itemsCols = Array.from({ length: columnas }, (_valor, idxCol) =>
          ordenOpciones.slice(idxCol * porColumna, (idxCol + 1) * porColumna)
            .map((indiceOpcion, idx) => ({ indiceOpcion, letra: String.fromCharCode(65 + idxCol * porColumna + idx) }))
        );

        const dibujarItem = (xCol: number, yLocal: number, item: { indiceOpcion: number; letra: string }) => {
          page.drawText(`${item.letra})`, { x: xCol, y: yLocal, size: sizeOpcion, font: fuenteBold, color: colorTinta });
          const opcion = pregunta.opciones[item.indiceOpcion];
          const textoOpcion = String(opcion?.texto ?? '');
          const textoLimpio = sanitizarTextoPdf(textoOpcion);
          const lineasOpcion = envolverTextoMixto({
            texto: textoLimpio,
            maxWidth: Math.max(30, colWidth - prefixWidth),
            fuente,
            fuenteBold,
            fuenteItalica: fuenteItalica,
            fuenteMono,
            sizeTexto: sizeOpcion,
            sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
            sizeCodigoBloque,
            lineHeightTexto: lineaOpcion,
            lineHeightCodigo: lineaCodigoBloque
          });
          const minLocalOpcion = Math.max(11 * fontScale, sizeOpcion * 1.24) * lineSpacing;
          for (const linea of lineasOpcion) {
            minLineHeightApplied = Math.min(minLineHeightApplied, linea.lineHeight);
            if (linea.lineHeight + 0.001 < minLocalOpcion) {
              lineHeightViolations.push({
                pagina: numeroPagina,
                preguntaId: pregunta.id,
                lineHeight: linea.lineHeight,
                min: minLocalOpcion
              });
            }
          }
          const yFinal = dibujarLineasMixtas({
            page,
            lineas: lineasOpcion,
            x: xCol + prefixWidth,
            y: yLocal,
            colorTexto: colorTinta,
            registrarRuns: (run) => textRunsPregunta.push(run)
          });
          return yFinal - 0.8;
        };

        for (let idxCol = 0; idxCol < itemsCols.length; idxCol += 1) {
          const items = itemsCols[idxCol] ?? [];
          for (const item of items) yCols[idxCol] = dibujarItem(xCols[idxCol] ?? xTextoPregunta, yCols[idxCol] ?? yInicioOpciones, item);
        }
        const letras = letrasOmr;
        // En una continuación, el primer reactivo usa el ancho izquierdo para
        // no invadir el QR. Su panel OMR, sin embargo, cabe en la columna
        // derecha justo debajo del QR. Colocarlo allí evita añadir una altura
        // artificial debajo de las opciones y mejora el reparto entre páginas.
        const panelOmrLateralContinuacion = esPrimeraPreguntaContinuacion;
        const yPrimeraBurbujaLateral = rectQr.y - 8 - omrRadio - omrMargenSuperior;
        const yPrimeraBurbuja = panelOmrLateralContinuacion
          ? yPrimeraBurbujaLateral
          : yInicioOpciones - perfilOmr.omrHeaderGap - 10;
        const top = yPrimeraBurbuja + omrRadio + omrMargenSuperior;
        const bottom = yPrimeraBurbuja - omrRadio - omrMargenInferior;
        const hCaja = Math.max(22, top - bottom);
        const panelPad = perfilOmr.omrPanelPadding;
        const xPanel = xColRespuesta;
        const panelRect: RectBox = {
          x: xPanel,
          y: bottom,
          width: anchoColRespuesta,
          height: hCaja
        };
        const panelOuterRect: RectBox = {
          x: xPanel - panelPad,
          y: bottom - panelPad,
          width: anchoColRespuesta + panelPad * 2,
          height: hCaja + panelPad * 2
        };
        assertRectDentroPagina(panelOuterRect, `halo-omr-pregunta-${numero}`);
        if (esPrimeraPreguntaContinuacion && rectInterseca(panelOuterRect, rectQr)) {
          throw new Error(`Layout invalido: el primer panel OMR de la pagina ${numeroPagina} invade el QR`);
        }
        if (panelOuterRect.x < margen + 3.5 || panelOuterRect.x + panelOuterRect.width > ANCHO_CARTA - margen - 3.5) {
          throw new Error(`Layout invalido: panel OMR ${numero} invade el marco imprimible`);
        }
        omrPanelBoxes.push({ id: `omr-${numero}`, ...panelOuterRect });

        if (panelPad > 0) {
          page.drawRectangle({
            ...panelOuterRect,
            color: rgb(1, 1, 1)
          });
        }
        page.drawRectangle({
          ...panelRect,
          borderWidth: perfilOmr.omrBoxBorderWidth,
          borderColor: colorPrimario,
          color: colorPanelOmr
        });
        assertRectDentroPagina(
          panelRect,
          `omr-pregunta-${numero}`
        );

        const hTag = perfilOmr.omrTagHeight;
        const wTag = perfilOmr.omrTagWidth;
        const xTag = xPanel + 4;
        const yTag = yPrimeraBurbuja + omrRadio + 3;
        page.drawRectangle({
          x: xPanel + 0.8,
          y: top - 11.5,
          width: anchoColRespuesta - 1.6,
          height: 10.7,
          color: colorAcentoSuave
        });
        if (this.perfilLayout.usarEtiquetaOmrSolida) {
          page.drawRectangle({ x: xTag, y: yTag, width: wTag, height: hTag, color: colorPrimario });
          page.drawText(`#${numero}`, { x: xTag + 3, y: yTag + 2.1, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: rgb(1, 1, 1) });
        } else {
          page.drawRectangle({
            x: xTag,
            y: yTag,
            width: wTag,
            height: hTag,
            borderWidth: 0.85,
            borderColor: colorLinea,
            color: rgb(1, 1, 1)
          });
          page.drawText(`#${numero}`, { x: xTag + 3, y: yTag + 2.1, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: colorPrimario });
        }

        const label = 'RESP.';
        const labelSize = perfilOmr.omrLabelFontSize;
        const labelWidth = fuenteBold.widthOfTextAtSize(label, labelSize);
        const maxLabelSpace = anchoColRespuesta - wTag - 8;
        if (labelWidth <= maxLabelSpace) {
          page.drawText(label, { x: xTag + wTag + 1.2, y: yTag + 1.2, size: labelSize, font: fuenteBold, color: colorAcento });
        }

        const etiquetaAnchoMax = etiquetaAnchoMaxOmr;
        const diametroBurbuja = diametroBurbujaOmr;
        const anchoFilaOmr = letras.length * pasoBurbujaX;
        const xInicioFilaOmr = xPanel + Math.max(omrMargenHorizontal, (anchoColRespuesta - anchoFilaOmr) / 2);
        const xBurbujaInicial = xInicioFilaOmr + etiquetaAnchoMax + omrEtiquetaGap + omrRadio;
        const cajasBurbujas: RectBox[] = [];
        for (let idx = 0; idx < letras.length; idx += 1) {
          const letra = letras[idx];
          const xBurbuja = xBurbujaInicial + idx * pasoBurbujaX;
          const yBurbuja = yPrimeraBurbuja;
          const etiquetaAncho = fuente.widthOfTextAtSize(letra, 6.8);
          if (xBurbuja - omrRadio < xPanel || xBurbuja + omrRadio > xPanel + anchoColRespuesta) {
            throw new Error(`Layout invalido: opcion OMR ${letra} fuera del panel de la pregunta ${numero}`);
          }
          const cajaBurbuja: RectBox = {
            x: xBurbuja - omrRadio,
            y: yBurbuja - omrRadio,
            width: diametroBurbuja,
            height: diametroBurbuja
          };
          assertRectContenida(cajaBurbuja, panelRect, `burbuja ${letra} de la pregunta ${numero}`);
          const cajaEtiqueta: RectBox = {
            x: xBurbuja - omrRadio - omrEtiquetaGap - etiquetaAncho,
            y: yBurbuja - 2.4,
            width: etiquetaAncho,
            height: 6.8 + 1
          };
          assertRectContenida(cajaEtiqueta, panelRect, `etiqueta ${letra} de la pregunta ${numero}`);
          if (cajasBurbujas.some((anterior) => rectInterseca(anterior, cajaBurbuja))) {
            throw new Error(`Layout invalido: burbujas OMR superpuestas en la pregunta ${numero}`);
          }
          cajasBurbujas.push(cajaBurbuja);
          page.drawCircle({
            x: xBurbuja,
            y: yBurbuja,
            size: omrRadio,
            borderWidth: perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke,
            borderColor: rgb(0, 0, 0)
          });
          page.drawText(letra, {
            x: xBurbuja - omrRadio - omrEtiquetaGap - etiquetaAncho,
            y: yBurbuja - 2.4,
            size: 6.8,
            font: fuente,
            color: colorTinta
          });
          opcionesOmr.push({ letra, x: xBurbuja, y: yBurbuja });
        }

        const fidSize = perfilOmr.fiducialSize;
        const fidMargin = Math.max(1.2, perfilOmr.fiducialMargin);
        const halfFid = fidSize / 2;
        // El quiet zone tambien ocupa tinta/espacio: el centro debe
        // calcularse a partir de ambos, no solo del tamano del fiducial.
        const fidEdgeInset = halfFid + perfilOmr.fiducialQuietZone + fidMargin;
        const xFid = xPanel + fidEdgeInset;
        const xFidRight = xPanel + anchoColRespuesta - fidEdgeInset;
        const yFidTop = top - fidEdgeInset;
        const yFidBottom = bottom + fidEdgeInset;
        if (yFidBottom >= yFidTop) {
          throw new Error(`Layout invalido: fiduciales invertidos en pregunta ${numero}`);
        }
        dibujarFiducialOmr(page, xFid, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFid, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);

        const cajasQuietFiduciales = [
          { x: xFid - halfFid - perfilOmr.fiducialQuietZone, y: yFidTop - halfFid - perfilOmr.fiducialQuietZone, width: fidSize + perfilOmr.fiducialQuietZone * 2, height: fidSize + perfilOmr.fiducialQuietZone * 2 },
          { x: xFid - halfFid - perfilOmr.fiducialQuietZone, y: yFidBottom - halfFid - perfilOmr.fiducialQuietZone, width: fidSize + perfilOmr.fiducialQuietZone * 2, height: fidSize + perfilOmr.fiducialQuietZone * 2 },
          { x: xFidRight - halfFid - perfilOmr.fiducialQuietZone, y: yFidTop - halfFid - perfilOmr.fiducialQuietZone, width: fidSize + perfilOmr.fiducialQuietZone * 2, height: fidSize + perfilOmr.fiducialQuietZone * 2 },
          { x: xFidRight - halfFid - perfilOmr.fiducialQuietZone, y: yFidBottom - halfFid - perfilOmr.fiducialQuietZone, width: fidSize + perfilOmr.fiducialQuietZone * 2, height: fidSize + perfilOmr.fiducialQuietZone * 2 }
        ];
        for (const [indiceFid, cajaFid] of cajasQuietFiduciales.entries()) {
          assertRectContenida(cajaFid, panelRect, `quiet zone fiducial ${indiceFid + 1} de la pregunta ${numero}`);
          if (cajasBurbujas.some((cajaBurbuja) => rectInterseca(cajaBurbuja, cajaFid))) {
            throw new Error(`Layout invalido: una burbuja invade la quiet zone de un fiducial en la pregunta ${numero}`);
          }
        }

        if (imagenPregunta) {
          assertRectDentroPagina(imagenPregunta, `imagen de pregunta ${numero}`);
          for (const run of textRunsPregunta) {
            if (rectInterseca(run.bbox, imagenPregunta)) {
              collisionBoxes.push({ pagina: numeroPagina, a: `texto-${numero}`, b: `imagen-${numero}` });
            }
          }
        }
        for (const run of textRunsPregunta) {
          if (rectInterseca(run.bbox, panelRect)) {
            collisionBoxes.push({ pagina: numeroPagina, a: `texto-${numero}`, b: `omr-${numero}` });
          }
        }
        if (collisionBoxes.length > 0) {
          const detalle = collisionBoxes.map((colision) => `${colision.a}<->${colision.b}`).join(', ');
          throw new Error(`Layout invalido: colisiones en la pregunta ${numero} de la pagina ${numeroPagina}: ${detalle}`);
        }

        cursorY = Math.min(...yCols, bottom - 2);
        const hayOtraPreguntaPlaneada = mapaPagina.length < planPagina.length;
        cursorY -= separacionPregunta + (hayOtraPreguntaPlaneada ? separacionExtraPagina : 0);
        cursorY = snapToGrid(cursorY);
        page.drawLine({
          start: { x: xTextoPregunta, y: cursorY + 4.5 },
          end: { x: limiteDerechoPregunta, y: cursorY + 4.5 },
          color: colorAcentoSuave,
          thickness: 0.55
        });
        const yFinPregunta = cursorY + separacionPregunta;

        indicePregunta += 1;
        const bboxPregunta = {
          x: xNumeroPregunta,
          y: yFinPregunta,
          width: xColRespuesta + anchoColRespuesta - xNumeroPregunta,
          height: Math.max(1, yPreguntaTop - yFinPregunta)
        };
        questionBlockBoxes.push({ id: `pregunta-${numero}`, ...bboxPregunta });

        mapaPagina.push({
          numeroPregunta: numero,
          idPregunta: pregunta.id,
          bboxPregunta,
          opciones: opcionesOmr,
          textRuns: textRunsPregunta,
          imagen: imagenPregunta,
          imageRenderStatus: estadoImagenPregunta.get(pregunta.id),
          cajaOmr: panelRect,
          perfilOmr: { radio: omrRadio, pasoY: omrPasoY, pasoX: pasoBurbujaX, cajaAncho: anchoColRespuesta },
          fiduciales: {
            leftTop: { x: xFid, y: yFidTop },
            leftBottom: { x: xFid, y: yFidBottom },
            rightTop: { x: xFidRight, y: yFidTop },
            rightBottom: { x: xFidRight, y: yFidBottom }
          }
        });
      }

      if (mapaPagina.length === 0 && indicePregunta < totalPreguntas) {
        throw new Error(
          `Layout invalido: el reactivo ${String(indicePregunta + 1)} no cabe en una pagina ` +
            `con el tamano de letra minimo legible (${fontScale.toFixed(2)}x).`
        );
      }

      const alturaUtil = Math.max(1, cursorYInicio - alturaDisponibleMin);
      const alturaRestante = Math.max(0, cursorY - alturaDisponibleMin);
      const fraccionVacia = Math.max(0, Math.min(1, alturaRestante / alturaUtil));
      metricasPaginas.push({ numero: numeroPagina, fraccionVacia, preguntas: mapaPagina.length });

      if (mapaPagina.length === 0 && (preguntasDel !== 0 || preguntasAl !== 0)) {
        throw new Error(`Layout invalido: rangos inconsistentes en pagina ${numeroPagina}`);
      }
      if (mapaPagina.length > 0) {
        const esperadoDel = mapaPagina[0]?.numeroPregunta ?? 0;
        const esperadoAl = mapaPagina[mapaPagina.length - 1]?.numeroPregunta ?? 0;
        if (preguntasDel !== esperadoDel || preguntasAl !== esperadoAl) {
          throw new Error(
            `Layout invalido: pagina ${numeroPagina} calculada ${preguntasDel}-${preguntasAl} pero render ${esperadoDel}-${esperadoAl}`
          );
        }
      }

      paginasMeta.push({ numero: numeroPagina, qrTexto: qrTextoPagina, preguntasDel, preguntasAl });
      paginasOmr.push({
        numeroPagina,
        markerSpec,
        engineHints,
        qr: { texto: qrTextoPagina, x: xQr, y: yQr, size: qrSize, padding: qrPadding },
        marcasPagina,
        preguntas: mapaPagina,
        layoutDebug: {
          layoutTemplateVersion: 8,
          header: { x: rectHeader.x, y: rectHeader.y, width: rectHeader.width, height: rectHeader.height },
          continuationBand: rectContinuacion,
          continuationTextBlocks,
          qr: { x: rectQr.x, y: rectQr.y, width: rectQr.width, height: rectQr.height },
          instructions: rectIndicaciones,
          headerSlots: headerSlotBoxes,
          headerTextBlocks,
          headerFieldBoxes,
          lineHeightViolations: lineHeightViolations
            .filter((v) => v.pagina === numeroPagina)
            .map((v) => ({ preguntaId: v.preguntaId, lineHeight: v.lineHeight, min: v.min })),
          contentStartY: cursorYInicio,
          contentEndY: cursorY,
          questionBlockBoxes,
          omrPanelBoxes,
          collisionBoxes
        }
      });

      numeroPagina += 1;
    }

    const pdfBytes = Buffer.from(await pdfDoc.save());
    const preguntasRestantes = Math.max(0, totalPreguntas - indicePregunta);
    const esPreview = examen.folio === 'PREVIEW';
    const minPreguntasPorPagina = Math.max(
      1,
      Number.parseInt(String(process.env.EXAMEN_MIN_PREGUNTAS_POR_PAGINA ?? '10'), 10) || 10
    );
    const umbralTotal = minPreguntasPorPagina * paginasObjetivo;
    // En modo PREVIEW no se lanza error por densidad baja; se permite previsualizar
    // plantillas con pocas preguntas sin bloquear el flujo editorial.
    // Solo se aplica el minimo editorial cuando el objetivo de paginas fue
    // suficiente. Si el contenido fuerza paginas adicionales, la densidad
    // deja de ser una restriccion dura para preservar legibilidad y totalidad.
    if (!esPreview && paginasMeta.length <= paginasObjetivo && totalPreguntas >= umbralTotal) {
      const paginasEsperadas = paginasMeta.slice(0, paginasObjetivo);
      const paginaConBajaDensidad = paginasEsperadas.find((p) => {
        const del = Number(p.preguntasDel ?? 0);
        const al = Number(p.preguntasAl ?? 0);
        const total = del > 0 && al >= del ? al - del + 1 : 0;
        return total < minPreguntasPorPagina;
      });
      if (paginaConBajaDensidad) {
        throw new Error(
          `Layout invalido: densidad insuficiente en pagina ${paginaConBajaDensidad.numero}. ` +
            `Minimo requerido ${minPreguntasPorPagina} preguntas por pagina.`
        );
      }
    }

    return {
      pdfBytes,
      layoutEngine: 'pdf-lib-canonical',
      layoutTemplateVersion: TEMPLATE_VERSION_CANONICA,
      paginas: paginasMeta,
      metricasPaginas,
      metricasLayout: {
        minLineHeightApplied: Number.isFinite(minLineHeightApplied) ? minLineHeightApplied : lineaOpcion,
        fontSizePregunta: sizePregunta,
        fontSizeOpcion: sizeOpcion,
        fontSizeIndicaciones: 8 * fontScale,
        lineHeightPregunta: lineaPregunta,
        lineHeightOpcion: lineaOpcion,
        preguntasConFormatoRico: preguntasOrdenadas.length,
        imagenesIntentadas,
        imagenesRenderizadas,
        imagenesFallidas
      },
      mapaOmr: {
        margenMm,
        templateVersion: perfilOmr.version,
        markerSpec,
        blockSpec,
        engineHints,
        perfilLayout: {
          gridStepPt: this.perfilLayout.gridStepPt,
          headerHeightFirst: this.perfilLayout.headerHeightFirst,
          headerHeightOther: this.perfilLayout.headerHeightOther,
          bottomSafePt: this.perfilLayout.bottomSafePt,
          usarRellenosDecorativos: this.perfilLayout.usarRellenosDecorativos,
          usarEtiquetaOmrSolida: this.perfilLayout.usarEtiquetaOmrSolida
        },
        perfil: {
          qrSize: perfilOmr.qrSize,
          qrPadding: perfilOmr.qrPadding,
          qrMarginModulos: perfilOmr.qrMarginModulos,
          marcasEsquina: perfilOmr.marcasEsquina,
          marcaCuadradoSize: perfilOmr.marcaCuadradoSize,
          marcaCuadradoQuietZone: perfilOmr.marcaCuadradoQuietZone,
          burbujaRadio: perfilOmr.burbujaRadio,
          burbujaPasoY: perfilOmr.burbujaPasoY,
          cajaOmrAncho: perfilOmr.cajaOmrAncho,
          fiducialSize: perfilOmr.fiducialSize,
          bubbleStrokePt: perfilOmr.bubbleStrokePt,
          labelToBubbleMm: perfilOmr.labelToBubbleMm,
          preguntasPorBloque: perfilOmr.preguntasPorBloque,
          opcionesPorPregunta: perfilOmr.opcionesPorPregunta
        },
        paginas: paginasOmr
      },
      preguntasRestantes
    };
  }
}


