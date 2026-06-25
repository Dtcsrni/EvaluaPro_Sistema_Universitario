/**
 * pdfKitRenderer
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
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
import {
  TEMPLATE_VERSION_TV3,
  TEMPLATE_VERSION_TV4
} from '../domain/templateCompat';
import { PDF_VISUAL_BASELINE_RGB } from './pdfVisualBaseline';

type PerfilPlantillaRender = PerfilPlantillaOmr & {
  version: 1 | 3 | 4;
  qrRasterWidth: number;
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

type SegmentoTexto = { texto: string; font: PDFFont; size: number; esCodigo?: boolean };
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

const PERFIL_OMR_V3_RENDER: PerfilPlantillaRender = {
  version: 3,
  qrSize: 22 * MM_A_PUNTOS,
  qrPadding: 2.2 * MM_A_PUNTOS,
  qrMarginModulos: 6,
  qrRasterWidth: 780,
  marcasEsquina: 'cuadrados',
  marcaCuadradoSize: 5.8 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 0.8 * MM_A_PUNTOS,
  burbujaRadio: (3.1 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 3.9 * MM_A_PUNTOS,
  burbujaStroke: 1,
  burbujaOffsetX: 4.4,
  omrHeaderGap: 4,
  omrTagWidth: 12,
  omrTagHeight: 6,
  omrTagFontSize: 4.3,
  omrLabelFontSize: 4.2,
  omrBoxBorderWidth: 0.9,
  omrPanelPadding: 0.8,
  cajaOmrAncho: 48,
  // Fiduciales compactos para evitar recortes y mejorar deteccion.
  fiducialSize: 0.78 * MM_A_PUNTOS,
  fiducialMargin: 0.9,
  fiducialQuietZone: 0.18 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
  labelToBubbleMm: 2.2,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
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
  const salida: Array<{ texto: string; estilo: EstiloTexto }> = [];
  let actual = '';
  let negrita = false;
  let cursiva = false;

  const estiloActual = (): EstiloTexto => {
    if (negrita) return 'bold';
    if (cursiva) return 'italic';
    return 'regular';
  };

  const pushActual = () => {
    if (!actual) return;
    salida.push({ texto: actual, estilo: estiloActual() });
    actual = '';
  };

  let i = 0;
  while (i < src.length) {
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
          segmentos.push({ texto: textoPlano, font, size: sizeTexto, esCodigo: false });
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

function resolverPerfilRender(templateVersion: 1 | 3 | 4, perfilBase: PerfilPlantillaOmr): PerfilPlantillaRender {
  if (templateVersion !== 1 && templateVersion !== TEMPLATE_VERSION_TV3 && templateVersion !== TEMPLATE_VERSION_TV4) {
    throw new Error(`Template version ${String(templateVersion)} no compatible para renderer legacy`);
  }
  const base = PERFIL_OMR_V3_RENDER;
  return {
    ...base,
    version: templateVersion,
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
    bubbleStrokePt: perfilBase.bubbleStrokePt ?? base.bubbleStrokePt,
    labelToBubbleMm: perfilBase.labelToBubbleMm ?? base.labelToBubbleMm,
    preguntasPorBloque: perfilBase.preguntasPorBloque ?? base.preguntasPorBloque,
    opcionesPorPregunta: perfilBase.opcionesPorPregunta ?? base.opcionesPorPregunta
  };
}

function agregarMarcasRegistro(page: PDFPage, margen: number, perfil: PerfilPlantillaRender) {
  const quiet = perfil.marcaCuadradoQuietZone;
  const tam = perfil.marcaCuadradoSize;
  const mitad = tam / 2;
  const esquinas = [
    { x: margen, y: ALTO_CARTA - margen },
    { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
    { x: margen, y: margen },
    { x: ANCHO_CARTA - margen, y: margen }
  ];

  for (const esquina of esquinas) {
    page.drawRectangle({
      x: esquina.x - mitad - quiet,
      y: esquina.y - mitad - quiet,
      width: tam + quiet * 2,
      height: tam + quiet * 2,
      color: rgb(1, 1, 1)
    });
    page.drawRectangle({
      x: esquina.x - mitad,
      y: esquina.y - mitad,
      width: tam,
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
    width: perfil.qrRasterWidth,
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

  const x = ANCHO_CARTA - margen - qrSize;
  const y = ALTO_CARTA - margen - qrSize;

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
    const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fuenteBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fuenteItalica = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fuenteMono = await pdfDoc.embedFont(StandardFonts.Courier);

    void examen.tipoExamen;

    const templateVersion = examen.layout.templateVersion;
    if (templateVersion !== 1 && templateVersion !== TEMPLATE_VERSION_TV3 && templateVersion !== TEMPLATE_VERSION_TV4) {
      throw new Error(`Template version ${String(templateVersion)} no compatible para renderer legacy`);
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

    // Plantilla base en puntos (1pt ~= 1px a 72dpi) para posicionamiento estable.
    const PLANTILLA_PX = Object.freeze({
      headerPadTop: 12,
      headerPadBottom: 10,
      titleGap: 18,
      lemaGap: 14,
      metaGapTop: 10,
      metaLine: 10.8,
      camposGapTop: 10,
      campoRowGap: 16,
      campoLineOffsetY: 3.2
    });

    const sizeTitulo = 15.6;
    const sizeMeta = 8.4;
    const sizePregunta = 10.6;
    const sizeOpcion = 9;
    const sizeCodigoInline = 8.6;
    const sizeCodigoBloque = 8.4;

    const lineaPregunta = Math.max(13.2, sizePregunta * 1.26);
    const lineaOpcion = Math.max(11.4, sizeOpcion * 1.25);
    const lineaCodigoBloque = Math.max(10.8, sizeCodigoBloque * 1.25);
    const separacionPregunta = 10;

    const omrTotalLetras = 5;
    const omrRadio = perfilOmr.burbujaRadio;
    const omrPasoY = perfilOmr.burbujaPasoY;
    const omrPadding = 1.4;
    const omrExtraTitulo = 2;

    const anchoColRespuesta = Math.max(50, perfilOmr.cajaOmrAncho);
    const gutterRespuesta = 10;
    const xColRespuesta = ANCHO_CARTA - margen - anchoColRespuesta;
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
    const altoEncabezadoPrimeraMinimo = 112;

    const logoIzqSrc = examen.encabezado?.logos?.izquierdaPath ?? process.env.EXAMEN_LOGO_IZQ_PATH ?? '';
    const logoDerSrc = examen.encabezado?.logos?.derechaPath ?? process.env.EXAMEN_LOGO_DER_PATH ?? '';

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
    const snapToGrid = (y: number) => Math.floor(y / GRID_STEP) * GRID_STEP;

    const markerSpec: MarkerSpecOmr = {
      family: 'aruco_4x4_50',
      sizeMm: 18,
      quietZoneMm: 3,
      ids: { tl: 7, tr: 11, bl: 19, br: 23 }
    };
    const blockSpec: BlockSpecOmr = {
      preguntasPorBloque: perfilOmr.preguntasPorBloque ?? 10,
      opcionesPorPregunta: perfilOmr.opcionesPorPregunta ?? 5,
      bubbleDiameterMm: Number((omrRadio * 2 / MM_A_PUNTOS).toFixed(2)),
      bubblePitchYmm: Number((omrPasoY / MM_A_PUNTOS).toFixed(2)),
      labelToBubbleMm: Number((perfilOmr.labelToBubbleMm ?? 5).toFixed(2)),
      bubbleStrokePt: Number((perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke).toFixed(2))
    };
    const engineHints: EngineHintsOmr = {
      preferredEngine: 'cv',
      enableClahe: true,
      adaptiveThreshold: true,
      conservativeDecision: true
    };

    const paginasMeta: ResultadoGeneracionPdf['paginas'] = [];
    const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
    const paginasOmr: PaginaOmr[] = [];
    const lineHeightViolations: Array<{ pagina: number; preguntaId: string; lineHeight: number; min: number }> = [];
    let minLineHeightApplied = Number.POSITIVE_INFINITY;

    const maxWidthIndicaciones = Math.max(120, xDerechaTexto - (margen + 10));
    const mostrarBloqueIndicaciones = ['1', 'true', 'yes', 'si'].includes(
      String(process.env.EXAMEN_LAYOUT_MOSTRAR_BLOQUE_INDICACIONES ?? '0').trim().toLowerCase()
    );
    const indicacionesPendientes = mostrarBloqueIndicaciones && mostrarInstrucciones && instrucciones.length > 0;

    const headerHeightFirst = this.perfilLayout.headerHeightFirst;
    const headerHeightOther = this.perfilLayout.headerHeightOther;

    let indicePregunta = 0;
    let numeroPagina = 1;

    while (numeroPagina <= paginasObjetivo && (numeroPagina === 1 || indicePregunta < totalPreguntas)) {
      const page = pdfDoc.addPage([ANCHO_CARTA, ALTO_CARTA]);
      const qrTextoPagina = examen.generarTextoQrPagina(numeroPagina);

      let preguntasDel = 0;
      let preguntasAl = 0;
      const mapaPagina: PaginaOmr['preguntas'] = [];
      const headerTextBlocks: Array<{ x: number; y: number; width: number; height: number; id: string }> = [];

      const yTop = ALTO_CARTA - margen;
      const esPrimera = numeroPagina === 1;
      const altoEncabezado = esPrimera ? Math.max(headerHeightFirst, altoEncabezadoPrimeraMinimo) : headerHeightOther;
      const xCaja = margen + 2;
      const wCaja = ANCHO_CARTA - 2 * margen - 4;
      const yCaja = yTop - altoEncabezado;

      let yFinHeaderPrimera = yCaja - 8;

      if (esPrimera) {
        if (this.perfilLayout.usarRellenosDecorativos) {
          page.drawRectangle({ x: xCaja, y: yCaja, width: wCaja, height: altoEncabezado, color: colorSeccion });
          page.drawRectangle({
            x: xCaja,
            y: yTop - 8,
            width: wCaja,
            height: 8,
            color: colorAcento
          });
        }

        page.drawRectangle({
          x: xCaja,
          y: yCaja,
          width: wCaja,
          height: altoEncabezado,
          borderWidth: 0.8,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : rgb(1, 1, 1)
        });

        page.drawLine({
          start: { x: xCaja, y: yTop - 6 },
          end: { x: xCaja + wCaja, y: yTop - 6 },
          color: colorLinea,
          thickness: 0.95
        });
      }

      agregarMarcasRegistro(page, margen, perfilOmr);
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
      if (esPrimera && !rectInterseca(rectHeader, rectQr)) {
        throw new Error('Layout invalido: QR fuera del area de encabezado en primera pagina');
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
      let folioEnEncabezado = false;
      if (yFolio > yCaja + 4) {
        page.drawText(folioQr, { x: xQr, y: yFolio, size: 8.1, font: fuenteBold, color: colorPrimario });
        page.drawText(`PAG ${numeroPagina}`, { x: xQr, y: yPag, size: 7.6, font: fuente, color: colorGris });
        folioEnEncabezado = true;
      }

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

      if (!folioEnEncabezado) {
        page.drawText(folioQr, { x: margen, y: margen - 16, size: 8.5, font: fuenteBold, color: colorPrimario });
        page.drawText(`PAG ${numeroPagina}`, { x: margen, y: margen - 26, size: 8, font: fuente, color: colorGris });
      }

      if (esPrimera) {
        const headerLeft = xCaja + 8;
        const logoSlotLeftX = headerLeft + 2;
        const logoSlotWidth = 46;
        const logoSlotHeight = 46;
        const xTextoHeader = logoSlotLeftX + logoSlotWidth + 10;
        const qrSlotLeft = rectQr.x - 10;
        const logoDerechoSlotWidth = 34;
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

        const ajustarLinea = (texto: string, font: PDFFont, size: number) =>
          (partirEnLineas({ texto, maxWidth: maxWidthEnc, font, size })[0] ?? '').trim();

        let escala = 1;
        let yNombre = innerBottom + 24;
        let yGrupo = innerBottom + 8;
        let metaLineas: string[] = [];
        let insti = '';
        let tit = '';
        let lem = '';
        let sizeInst = 12;
        let sizeTit = sizeTitulo;
        let sizeLem = 9;
        let sizeMetaEsc = sizeMeta;
        let sizeCampo = 9.6;

        for (let i = 0; i < 8; i += 1) {
          sizeInst = 12.6 * escala;
          sizeTit = sizeTitulo * escala;
          sizeLem = 9.6 * escala;
          sizeMetaEsc = sizeMeta * escala;
          sizeCampo = 10.2 * escala;

          insti = ajustarLinea(institucion, fuenteBold, sizeInst);
          tit = ajustarLinea(examen.titulo, fuenteBold, sizeTit);
          lem = lema ? ajustarLinea(lema, fuenteItalica, sizeLem) : '';

          const yInst = innerTop - sizeInst;
          const yTit = yInst - PLANTILLA_PX.titleGap * escala;
          const yLem = lem ? yTit - PLANTILLA_PX.lemaGap * escala : yTit - 2;
          const yMeta = yLem - PLANTILLA_PX.metaGapTop * escala;
          const meta = [materia ? `Materia: ${materia}` : '', docente ? `Docente: ${docente}` : ''].filter(Boolean).join('   |   ');
          metaLineas = partirEnLineas({ texto: meta, maxWidth: maxWidthEnc, font: fuente, size: sizeMetaEsc }).slice(0, 2);
          const yMetaUlt = yMeta - (Math.max(1, metaLineas.length) - 1) * PLANTILLA_PX.metaLine * escala;
          yNombre = yMetaUlt - PLANTILLA_PX.camposGapTop * escala;
          yGrupo = yNombre - PLANTILLA_PX.campoRowGap * escala;

          if (yGrupo - 8 >= innerBottom) {
            break;
          }
          escala = Math.max(0.78, escala - 0.06);
        }

        const yInsti = innerTop - sizeInst;
        const yTitulo = yInsti - PLANTILLA_PX.titleGap * escala;
        const yLema = lem ? yTitulo - PLANTILLA_PX.lemaGap * escala : yTitulo - 2;
        const yMeta = yLema - PLANTILLA_PX.metaGapTop * escala;

        const xInsti = xTextoCentrado(insti, fuenteBold, sizeInst);
        page.drawText(insti, { x: xInsti, y: yInsti, size: sizeInst, font: fuenteBold, color: colorAcento });
        headerTextBlocks.push({
          id: 'institucion',
          x: xInsti,
          y: yInsti,
          width: fuenteBold.widthOfTextAtSize(insti, sizeInst),
          height: sizeInst + 2
        });
        const xTitulo = xTextoCentrado(tit, fuenteBold, sizeTit);
        page.drawText(tit, { x: xTitulo, y: yTitulo, size: sizeTit, font: fuenteBold, color: colorPrimario });
        headerTextBlocks.push({
          id: 'titulo',
          x: xTitulo,
          y: yTitulo,
          width: fuenteBold.widthOfTextAtSize(tit, sizeTit),
          height: sizeTit + 2
        });
        if (lem) {
          const xLema = xTextoCentrado(lem, fuenteItalica, sizeLem);
          page.drawText(lem, { x: xLema, y: yLema, size: sizeLem, font: fuenteItalica, color: colorGris });
          headerTextBlocks.push({
            id: 'lema',
            x: xLema,
            y: yLema,
            width: fuenteItalica.widthOfTextAtSize(lem, sizeLem),
            height: sizeLem + 2
          });
        }

        metaLineas.forEach((linea, indice) => {
          if (!linea) return;
          const yLinea = yMeta - indice * PLANTILLA_PX.metaLine * escala;
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
            height: sizeMetaEsc + 2
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
          height: sizeCampo + 2
        });
        page.drawLine({
          start: { x: xLineaNombre, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          end: { x: xMaxEnc, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          color: colorLinea,
          thickness: 1
        });
        page.drawText(etiquetaGrupo, { x: xTextoHeader, y: yGrupo, size: sizeCampo, font: fuenteBold, color: colorPrimario });
        headerTextBlocks.push({
          id: 'grupo-etiqueta',
          x: xTextoHeader,
          y: yGrupo,
          width: fuenteBold.widthOfTextAtSize(etiquetaGrupo, sizeCampo),
          height: sizeCampo + 2
        });
        page.drawLine({
          start: { x: xLineaGrupo, y: yGrupo + PLANTILLA_PX.campoLineOffsetY },
          end: { x: xLineaGrupoFin, y: yGrupo + PLANTILLA_PX.campoLineOffsetY },
          color: colorLinea,
          thickness: 1
        });

        if (logoIzquierda) {
          const escala = Math.min(1, logoSlotWidth / Math.max(1, logoIzquierda.width), logoSlotHeight / Math.max(1, logoIzquierda.height));
          const w = logoIzquierda.width * escala;
          const h = logoIzquierda.height * escala;
          const xLogo = logoSlotLeftX + (logoSlotWidth - w) / 2;
          const yLogo = yTop - 18 - h;
          page.drawImage(logoIzquierda.image, { x: xLogo, y: yLogo, width: w, height: h });
        }

        if (logoDerecha) {
          const escala = Math.min(1, logoDerechoSlotWidth / Math.max(1, logoDerecha.width), logoSlotHeight / Math.max(1, logoDerecha.height));
          const w = logoDerecha.width * escala;
          const h = logoDerecha.height * escala;
          const xLogo = logoDerechoSlotX + (logoDerechoSlotWidth - w) / 2;
          const yLogo = yTop - 18 - h;
          if (xLogo + w <= rectQr.x - 8) {
            page.drawImage(logoDerecha.image, { x: xLogo, y: yLogo, width: w, height: h });
          }
        }

        yFinHeaderPrimera = Math.min(yCaja - 8, yGrupo - 10);
      }

      // Reserva separacion visual clara entre encabezado y primera pregunta.
      const yZonaContenidoBase = esPrimera ? yFinHeaderPrimera : yTop - 16;
      const yZonaContenidoSeguro = yQr - (qrPadding + 8);
      const yZonaContenido = esPrimera ? yZonaContenidoBase : Math.min(yZonaContenidoBase, yZonaContenidoSeguro);
      const cursorYInicio = snapToGrid(yZonaContenido);
      if (esPrimera && cursorYInicio >= yCaja) {
        throw new Error('Layout invalido: el contenido invade el encabezado de la primera pagina');
      }
      let cursorY = cursorYInicio;

      if (esPrimera) {
        const instruccionCorta = 'Instrucción: rellena un solo círculo por pregunta; evita tachones y marcas fuera.';
        const yInstruccion = Math.min(yCaja - 6.8, yZonaContenido + 1.2);
        const xInstruccion = margen + 8;
        const wInstruccion = Math.max(180, ANCHO_CARTA - margen * 2 - 16);
        page.drawRectangle({
          x: xInstruccion,
          y: yInstruccion - 1.5,
          width: wInstruccion,
          height: 9.4,
          borderWidth: 0.7,
          borderColor: rgb(0.72, 0.79, 0.86),
          color: rgb(1, 1, 1)
        });
        page.drawText(instruccionCorta, {
          x: xInstruccion + 4,
          y: yInstruccion,
          size: 6.4,
          font: fuenteBold,
          color: colorPrimario
        });
      }

      const alturaDisponibleMin = margen + this.perfilLayout.bottomSafePt;
      const maxImagenPreguntaAncho = Math.min(anchoTextoPregunta * 0.5, 160);
      const maxImagenPreguntaAlto = 42;

      const calcularAlturaPregunta = (pregunta: ExamenPdf['preguntas'][number]) => {
        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPregunta,
          fuente: fuenteBold,
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
          const maxW = maxImagenPreguntaAncho;
          const maxH = maxImagenPreguntaAlto;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          alto += emb.height * escala + 3;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const totalOpciones = ordenOpciones.length;
        const mitad = Math.ceil(totalOpciones / 2);

        const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
        const gutterCols = 8;
        const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);
        const maxTextWidth = Math.max(30, colWidth - prefixWidth);

        const cols = [ordenOpciones.slice(0, mitad), ordenOpciones.slice(mitad)];
        const alturasCols = [0, 0];
        cols.forEach((col, idxCol) => {
          for (const indiceOpcion of col) {
            const opcion = pregunta.opciones[indiceOpcion];
            const lineasOpcion = envolverTextoMixto({
              texto: opcion?.texto ?? '',
              maxWidth: maxTextWidth,
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
            alturasCols[idxCol] += lineasOpcion.reduce((acc, l) => acc + l.lineHeight, 0) + 0.5;
          }
        });

        const altoOpciones = Math.max(alturasCols[0], alturasCols[1]);
        const altoOmrMin = (omrTotalLetras - 1) * omrPasoY + (omrExtraTitulo + omrPadding);
        alto += Math.max(altoOpciones, altoOmrMin);
        alto += separacionPregunta + 2;
        return alto;
      };

      if (esPrimera && indicacionesPendientes) {
        const xInd = margen + 10;
        const yTopInd = yZonaContenido - 6;
        const wIndMax = Math.max(140, xDerechaTexto - xInd - 6);
        const wInd = Math.min(wIndMax, maxWidthIndicaciones + 16);

        const hDisponible = yTopInd - (alturaDisponibleMin + 2);
        let hMin = 34;
        const hMax = Math.max(hMin, hDisponible);

        let sizeIndicaciones = 6.0;
        let lineaIndicaciones = 6.6;
        const hLabel = 9;
        const paddingY = 1;
        let lineasIndicaciones = partirEnLineas({
          texto: instrucciones,
          maxWidth: wInd - 16,
          font: fuente,
          size: sizeIndicaciones
        });

        for (let i = 0; i < 10; i += 1) {
          const hNecesaria = hLabel + paddingY + lineasIndicaciones.length * lineaIndicaciones;
          if (hNecesaria <= hMax) break;
          sizeIndicaciones = Math.max(6.0, sizeIndicaciones - 0.25);
          lineaIndicaciones = Math.max(6.6, lineaIndicaciones - 0.25);
          lineasIndicaciones = partirEnLineas({
            texto: instrucciones,
            maxWidth: wInd - 16,
            font: fuente,
            size: sizeIndicaciones
          });
        }

        const hNecesariaFinal = hLabel + paddingY + lineasIndicaciones.length * lineaIndicaciones;
        hMin = Math.max(hMin, hLabel + paddingY + lineaIndicaciones + 12);
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

        page.drawLine({
          start: { x: xInd + 8, y: yTopInd - 18 },
          end: { x: xInd + Math.min(wInd - 8, 92), y: yTopInd - 18 },
          color: colorLinea,
          thickness: 0.8
        });

        page.drawText('Indicaciones', { x: xInd + 8, y: yTopInd - 16, size: 9, font: fuenteBold, color: colorAcento });

        let yLinea = yTopInd - 26;
        const yMinTexto = yTopInd - hCaja + 8;
        if (yLinea < yMinTexto) yLinea = yMinTexto;

        for (const linea of lineasIndicaciones) {
          if (yLinea < yMinTexto) break;
          page.drawText(linea, { x: xInd + 8, y: yLinea, size: sizeIndicaciones, font: fuente, color: rgb(0.1, 0.1, 0.1) });
          yLinea -= lineaIndicaciones;
        }

        cursorY = snapToGrid(yTopInd - hCaja - 6);
        if (hCaja > hDisponible || cursorY < alturaDisponibleMin + 40) {
          cursorY = alturaDisponibleMin - 1;
        }
      }

      const minPreguntasPorPagina = Math.max(
        1,
        Number.parseInt(String(process.env.EXAMEN_MIN_PREGUNTAS_POR_PAGINA ?? '8'), 10) || 8
      );
      const maxPreguntasPorPagina = Math.max(
        minPreguntasPorPagina,
        Number.parseInt(String(process.env.EXAMEN_MAX_PREGUNTAS_POR_PAGINA ?? '9'), 10) || 9
      );
      const paginasRestantesIncluyendoActual = Math.max(1, paginasObjetivo - numeroPagina + 1);
      const preguntasRestantesIncluyendoActual = Math.max(0, totalPreguntas - indicePregunta);
      const objetivoBalance = Math.ceil(preguntasRestantesIncluyendoActual / paginasRestantesIncluyendoActual);
      const topePaginaActual = Math.max(minPreguntasPorPagina, Math.min(maxPreguntasPorPagina, objetivoBalance));

      while (indicePregunta < preguntasOrdenadas.length && cursorY > alturaDisponibleMin) {
        if (mapaPagina.length >= topePaginaActual) break;
        const pregunta = preguntasOrdenadas[indicePregunta];
        const numero = indicePregunta + 1;
        const yPreguntaTop = cursorY;
        const textRunsPregunta: TextRunDebug[] = [];

        const alturaNecesaria = calcularAlturaPregunta(pregunta);
        if (cursorY - alturaNecesaria < alturaDisponibleMin) break;

        if (!preguntasDel) preguntasDel = numero;
        preguntasAl = numero;

        const textoNumero = String(numero);
        const wNum = 18;
        const hNum = 14;
        const xNum = xNumeroPregunta;
        const yNum = cursorY - 1;
        page.drawRectangle({
          x: xNum,
          y: yNum,
          width: wNum,
          height: hNum,
          borderWidth: 1,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : rgb(1, 1, 1)
        });
        const sizeNum = textoNumero.length >= 3 ? 8 : 9;
        page.drawText(textoNumero, { x: xNum + 5, y: yNum + 3.2, size: sizeNum, font: fuenteBold, color: colorPrimario });

        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPregunta,
          fuente: fuenteBold,
          fuenteBold,
          fuenteItalica: fuenteItalica,
          fuenteMono,
          sizeTexto: sizePregunta,
          sizeCodigoInline,
          sizeCodigoBloque,
          lineHeightTexto: lineaPregunta,
          lineHeightCodigo: lineaCodigoBloque
        });
        const minLocalEnunciado = Math.max(12, sizePregunta * 1.25);
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
          const maxW = maxImagenPreguntaAncho;
          const maxH = maxImagenPreguntaAlto;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          const w = emb.width * escala;
          const h = emb.height * escala;
          page.drawImage(emb.image, { x: xTextoPregunta, y: cursorY - h, width: w, height: h });
          cursorY -= h + 3;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const totalOpciones = ordenOpciones.length;
        const mitad = Math.ceil(totalOpciones / 2);

        const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
        const gutterCols = 8;
        const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
        const xCol1 = xTextoPregunta;
        const xCol2 = xTextoPregunta + colWidth + gutterCols;
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);

        const yInicioOpciones = cursorY;
        let yCol1 = yInicioOpciones;
        let yCol2 = yInicioOpciones;

        const opcionesOmr: Array<{ letra: string; x: number; y: number }> = [];

        const itemsCol1 = ordenOpciones.slice(0, mitad).map((indiceOpcion, idx) => ({ indiceOpcion, letra: String.fromCharCode(65 + idx) }));
        const itemsCol2 = ordenOpciones.slice(mitad).map((indiceOpcion, idx) => ({ indiceOpcion, letra: String.fromCharCode(65 + (mitad + idx)) }));

        const dibujarItem = (xCol: number, yLocal: number, item: { indiceOpcion: number; letra: string }) => {
          page.drawText(`${item.letra})`, { x: xCol, y: yLocal, size: sizeOpcion, font: fuenteBold, color: rgb(0.12, 0.12, 0.12) });
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
          const minLocalOpcion = Math.max(10.4, sizeOpcion * 1.25);
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
            colorTexto: rgb(0.1, 0.1, 0.1),
            registrarRuns: (run) => textRunsPregunta.push(run)
          });
          return yFinal - 2;
        };

        for (const item of itemsCol1) yCol1 = dibujarItem(xCol1, yCol1, item);
        for (const item of itemsCol2) yCol2 = dibujarItem(xCol2, yCol2, item);

        const letras = Array.from({ length: omrTotalLetras }, (_valor, idx) => String.fromCharCode(65 + idx));
        const yPrimeraBurbuja = yInicioOpciones - perfilOmr.omrHeaderGap;
        const top = yPrimeraBurbuja + omrRadio + omrExtraTitulo + 2;
        const yUltimaBurbuja = yPrimeraBurbuja - (omrTotalLetras - 1) * omrPasoY;
        const omrExtraBottom = 1;
        const bottom = yUltimaBurbuja - omrRadio - 2 - omrExtraBottom;
        const hCaja = Math.max(22, top - bottom);
        const panelPad = perfilOmr.omrPanelPadding;

        if (panelPad > 0) {
          page.drawRectangle({
            x: xColRespuesta - panelPad,
            y: bottom - panelPad,
            width: anchoColRespuesta + panelPad * 2,
            height: hCaja + panelPad * 2,
            color: rgb(1, 1, 1)
          });
        }

        page.drawRectangle({
          x: xColRespuesta,
          y: bottom,
          width: anchoColRespuesta,
          height: hCaja,
          borderWidth: perfilOmr.omrBoxBorderWidth,
          borderColor: rgb(0, 0, 0),
          color: this.perfilLayout.usarRellenosDecorativos ? colorSeccion : rgb(1, 1, 1)
        });
        assertRectDentroPagina(
          { x: xColRespuesta, y: bottom, width: anchoColRespuesta, height: hCaja },
          `omr-pregunta-${numero}`
        );

        const hTag = perfilOmr.omrTagHeight;
        const wTag = perfilOmr.omrTagWidth;
        const yTag = top - hTag - 6;
        if (this.perfilLayout.usarEtiquetaOmrSolida) {
          page.drawRectangle({ x: xColRespuesta, y: yTag, width: wTag, height: hTag, color: colorPrimario });
          page.drawText(`#${numero}`, { x: xColRespuesta + 4, y: yTag + 2.2, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: rgb(1, 1, 1) });
        } else {
          page.drawRectangle({
            x: xColRespuesta,
            y: yTag,
            width: wTag,
            height: hTag,
            borderWidth: 0.85,
            borderColor: colorLinea,
            color: rgb(1, 1, 1)
          });
          page.drawText(`#${numero}`, { x: xColRespuesta + 4, y: yTag + 2.2, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: colorPrimario });
        }

        const label = 'RESP';
        const labelSize = perfilOmr.omrLabelFontSize;
        const labelWidth = fuenteBold.widthOfTextAtSize(label, labelSize);
        const maxLabelSpace = anchoColRespuesta - wTag - 8;
        if (labelWidth <= maxLabelSpace) {
          page.drawText(label, { x: xColRespuesta + wTag + 1.2, y: yTag + 1.2, size: labelSize, font: fuenteBold, color: colorPrimario });
        }

        const xBurbuja = xColRespuesta + omrPadding + perfilOmr.burbujaOffsetX;
        for (let idx = 0; idx < letras.length; idx += 1) {
          const letra = letras[idx];
          const yBurbuja = yPrimeraBurbuja - idx * omrPasoY;
          page.drawCircle({
            x: xBurbuja,
            y: yBurbuja,
            size: omrRadio,
            borderWidth: perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke,
            borderColor: rgb(0, 0, 0)
          });
          page.drawText(letra, {
            x: xBurbuja + omrRadio + mmAPuntos(perfilOmr.labelToBubbleMm ?? 5),
            y: yBurbuja - 2.4,
            size: 7.9,
            font: fuente,
            color: rgb(0.12, 0.12, 0.12)
          });
          opcionesOmr.push({ letra, x: xBurbuja, y: yBurbuja });
        }

        const fidSize = perfilOmr.fiducialSize;
        const fidMargin = perfilOmr.fiducialMargin;
        const halfFid = fidSize / 2;
        const xFid = xColRespuesta + halfFid + fidMargin;
        const xFidRight = xColRespuesta + anchoColRespuesta - (halfFid + fidMargin);
        const yFidTop = top - (halfFid + fidMargin);
        const yFidBottom = bottom + halfFid + fidMargin;
        if (yFidBottom >= yFidTop) {
          throw new Error(`Layout invalido: fiduciales invertidos en pregunta ${numero}`);
        }
        dibujarFiducialOmr(page, xFid, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFid, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);

        cursorY = Math.min(yCol1, yCol2, bottom - 2);
        cursorY -= separacionPregunta;
        cursorY = snapToGrid(cursorY);

        indicePregunta += 1;

        mapaPagina.push({
          numeroPregunta: numero,
          idPregunta: pregunta.id,
          bboxPregunta: {
            x: xNumeroPregunta,
            y: cursorY,
            width: xColRespuesta + anchoColRespuesta - xNumeroPregunta,
            height: Math.max(1, yPreguntaTop - cursorY)
          },
          opciones: opcionesOmr,
          textRuns: textRunsPregunta,
          imageRenderStatus: estadoImagenPregunta.get(pregunta.id),
          cajaOmr: { x: xColRespuesta, y: bottom, width: anchoColRespuesta, height: hCaja },
          perfilOmr: { radio: omrRadio, pasoY: omrPasoY, cajaAncho: anchoColRespuesta },
          fiduciales: {
            leftTop: { x: xFid, y: yFidTop },
            leftBottom: { x: xFid, y: yFidBottom },
            rightTop: { x: xFidRight, y: yFidTop },
            rightBottom: { x: xFidRight, y: yFidBottom }
          }
        });
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
        qr: { texto: qrTextoPagina, x: xQr, y: yQr, size: qrSize, padding: qrPadding },
        marcasPagina,
        preguntas: mapaPagina,
        layoutDebug: {
          layoutTemplateVersion: 8,
          header: { x: rectHeader.x, y: rectHeader.y, width: rectHeader.width, height: rectHeader.height },
          qr: { x: rectQr.x, y: rectQr.y, width: rectQr.width, height: rectQr.height },
          headerTextBlocks,
          lineHeightViolations: lineHeightViolations
            .filter((v) => v.pagina === numeroPagina)
            .map((v) => ({ preguntaId: v.preguntaId, lineHeight: v.lineHeight, min: v.min })),
          contentStartY: cursorYInicio,
          contentEndY: cursorY
        }
      });

      numeroPagina += 1;
    }

    const pdfBytes = Buffer.from(await pdfDoc.save());
    const preguntasRestantes = Math.max(0, totalPreguntas - indicePregunta);
    const minPreguntasPorPagina = Math.max(
      1,
      Number.parseInt(String(process.env.EXAMEN_MIN_PREGUNTAS_POR_PAGINA ?? '8'), 10) || 8
    );
    const umbralTotal = minPreguntasPorPagina * paginasObjetivo;
    if (totalPreguntas >= umbralTotal) {
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
      layoutEngine: 'pdf-lib-legacy',
      layoutTemplateVersion: perfilOmr.version === 4 ? 4 : 3,
      paginas: paginasMeta,
      metricasPaginas,
      metricasLayout: {
        minLineHeightApplied: Number.isFinite(minLineHeightApplied) ? minLineHeightApplied : lineaOpcion,
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


