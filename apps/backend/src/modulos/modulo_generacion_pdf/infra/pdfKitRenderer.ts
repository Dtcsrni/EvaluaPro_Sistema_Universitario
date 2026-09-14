/**
 * pdfKitRenderer
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {
  LineCapStyle,
  PDFDocument,
  TextRenderingMode,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineWidth,
  setStrokingColor,
  setTextRenderingMode,
  type PDFFont,
  type PDFImage,
  type PDFPage
} from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import type { ExamenPdf } from '../domain/examenPdf.js';
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
} from '../shared/tiposPdf.js';
import { PERFIL_OMR_CANONICO } from '../domain/layoutExamen.js';
import { TEMPLATE_VERSION_CANONICA } from '../domain/templateCanonico.js';
import { PDF_VISUAL_BASELINE_RGB } from './pdfVisualBaseline.js';

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

type SegmentoTexto = {
  texto: string;
  font: PDFFont;
  size: number;
  esCodigo?: boolean;
  /** Evita separar una formula entre base, operador y sub/superindice. */
  noWrap?: boolean;
  subrayado?: boolean;
  offsetY?: number;
  espacioAntes?: boolean;
  espacioDespues?: boolean;
};
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
  // Escala entera alta: conserva bordes nítidos en el bitmap embebido antes
  // de que el driver Epson lo rasterice al tamaño físico del símbolo.
  qrRasterScale: 24,
  burbujaStroke: 1,
  burbujaOffsetX: 4.4,
  omrHeaderGap: 4,
  // La insignia numérica queda en la banda superior, separada verticalmente
  // de la primera burbuja. Su tamaño compacto evita que se interprete como
  // tinta vecina dentro del ROI OMR al rasterizar.
  // La etiqueta queda más alta y legible, pero sigue siendo una señal
  // auxiliar fuera de la ventana circular de respuesta. El tamaño permite
  // identificar el reactivo también después de fotografiar la hoja.
  omrTagWidth: 16,
  // La caja reducida conserva el numero en 8 pt y libera 1.2 pt visibles
  // antes de la primera burbuja, sin aumentar la altura del panel.
  omrTagHeight: 7,
  omrTagFontSize: 8,
  omrLabelFontSize: 5.6,
  omrBoxBorderWidth: 0.9,
  // Las quiet zones ya forman parte del panel; no añadir un halo blanco
  // exterior que agrande el rectángulo visible sin aportar señal OMR.
  omrPanelPadding: 0,
  fiducialMargin: 0.9,
  fiducialQuietZone: PERFIL_OMR_CANONICO.fiducialQuietZone ?? 0.5 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
};

const FUENTE_ECOFONT_ARCHIVO = 'ecofont_vera_sans_regular.ttf';
const FUENTE_ECOFONT_FAMILIA = 'Ecofont Vera Sans';

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

function quitarPrefijoReactivo(texto: string, numero: number) {
  const numeroEsperado = String(numero).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefijoEtiquetado = new RegExp(
    `^\\s*<([a-z][\\w-]*)(?:\\s[^>]*)?>\\s*Reactivo\\s+${numeroEsperado}\\s*[.:)\\-]?\\s*</\\1>\\s*[.:)\\-]?\\s*`,
    'i'
  );
  const prefijoPlano = new RegExp(`^\\s*Reactivo\\s+${numeroEsperado}\\s*[.:)\\-]?\\s*`, 'i');
  return texto.replace(prefijoEtiquetado, '').replace(prefijoPlano, '');
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
    .replace(/\u2260/g, '!=')
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

// Algunos editores entregan sub/superindices como caracteres Unicode en vez
// de HTML. Convertirlos solo en bloques de texto evita que una fuente PDF sin
// esos glifos produzca cuadrados, sin alterar bloques de codigo monoespaciado.
function normalizarIndicesUnicode(texto: string) {
  const subindices: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j',
    'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u',
    'ᵥ': 'v', 'ₓ': 'x'
  };
  const superindices: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i'
  };
  const convertir = (valor: string, tabla: Record<string, string>, etiqueta: 'sub' | 'sup') =>
    `<${etiqueta}>${tabla[valor] ?? valor}</${etiqueta}>`;
  return String(texto ?? '')
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]/g, (valor) => convertir(valor, subindices, 'sub'))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]/g, (valor) => convertir(valor, superindices, 'sup'));
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
  const salida: Array<{
    texto: string;
    estilo: EstiloTexto;
    subrayado: boolean;
    noWrap?: boolean;
    escala?: number;
    offsetY?: number;
    espacioAntes?: boolean;
    espacioDespues?: boolean;
  }> = [];
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
    salida.push({
      texto: actual,
      estilo: estiloActual(),
      subrayado,
      espacioAntes: /^\s/.test(actual),
      espacioDespues: /\s$/.test(actual)
    });
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

function decodificarEntidadesPdf(texto: string) {
  return texto
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function escaparHtmlTextoPdf(texto: string) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Conversor inline deliberadamente acotado: cubre la notación habitual de
// reactivos y la transforma en HTML tipográfico que el renderer ya sabe medir.
// No intenta ejecutar TeX ni deja que el contenido se interprete como HTML.
function convertirLatexAHtml(texto: string) {
  const fuente = decodificarEntidadesPdf(String(texto ?? ''))
    .trim()
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$|\$$/g, '')
    .trim();
  const comandos: Record<string, string> = {
    // La fuente de impresión base no contiene todos los glifos griegos;
    // usar nombres ASCII evita cuadrados vacíos y mantiene la fórmula legible
    // incluso cuando no se dispone de una fuente matemática dedicada.
    alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon', theta: 'theta',
    lambda: 'lambda', mu: 'mu', pi: 'π', sigma: 'sigma', phi: 'phi', omega: 'omega',
    Gamma: 'Gamma', Delta: 'Delta', Theta: 'Theta', Lambda: 'Lambda', Pi: 'Pi', Sigma: 'Sigma',
    Phi: 'Phi', Omega: 'Omega', pm: '+/-', times: 'x', cdot: '*', le: '<=', leq: '<=',
    ge: '>=', geq: '>=', neq: '!=', approx: '~', infty: 'infinity', to: '->',
    rightarrow: '->', leftarrow: '<-', partial: '∂', int: '∫', sum: '∑'
  };

  function grupo(indice: number): { html: string; indice: number } {
    if (fuente[indice] !== '{') return { html: '', indice };
    return fragmento(indice + 1);
  }

  function atom(indice: number): { html: string; indice: number } {
    if (fuente[indice] === '{') return grupo(indice);
    if (fuente[indice] === '\\') return comando(indice);
    return { html: escaparHtmlTextoPdf(fuente[indice] ?? ''), indice: indice + 1 };
  }

  function comando(indice: number): { html: string; indice: number } {
    const match = /^([A-Za-z]+|.)/.exec(fuente.slice(indice + 1));
    if (!match) return { html: '', indice: indice + 1 };
    const nombre = match[1] ?? '';
    let siguiente = indice + 1 + nombre.length;
    if (nombre === 'frac') {
      const numerador = grupo(siguiente);
      const denominador = grupo(numerador.indice);
      return { html: `(${numerador.html})/(${denominador.html})`, indice: denominador.indice };
    }
    if (nombre === 'sqrt') {
      if (fuente[siguiente] === '[') {
        const cierre = fuente.indexOf(']', siguiente + 1);
        siguiente = cierre === -1 ? siguiente : cierre + 1;
      }
      const radicando = grupo(siguiente);
      // Ecofont Vera Sans contiene el radical; usarlo evita la palabra
      // "sqrt" pegada al radicando y conserva la semántica matemática en
      // una hoja impresa de tamaño reducido.
      return { html: `√(${radicando.html})`, indice: radicando.indice };
    }
    if (nombre === 'text' || nombre === 'mathrm' || nombre === 'mathit') {
      const contenido = grupo(siguiente);
      return { html: contenido.html, indice: contenido.indice };
    }
    if (nombre === 'mathbf') {
      const contenido = grupo(siguiente);
      return { html: `<strong>${contenido.html}</strong>`, indice: contenido.indice };
    }
    if (nombre === 'left' || nombre === 'right' || nombre === 'displaystyle' || nombre === 'scriptstyle') {
      return { html: '', indice: siguiente };
    }
    if (nombre === ',' || nombre === ';' || nombre === ':' || nombre === '!') {
      return { html: nombre === '!' ? '' : ' ', indice: siguiente };
    }
    if (nombre === ' ' || nombre === '\\') return { html: nombre === '\\' ? '<br>' : ' ', indice: siguiente };
    if (nombre === '%' || nombre === '_' || nombre === '{' || nombre === '}') {
      return { html: escaparHtmlTextoPdf(nombre), indice: siguiente };
    }
    return { html: escaparHtmlTextoPdf(comandos[nombre] ?? nombre), indice: siguiente };
  }

  function fragmento(indiceInicial: number): { html: string; indice: number } {
    let indice = indiceInicial;
    let html = '';
    while (indice < fuente.length && fuente[indice] !== '}') {
      const caracter = fuente[indice];
      if (caracter === '^' || caracter === '_') {
        const siguiente = atom(indice + 1);
        const etiqueta = caracter === '^' ? 'sup' : 'sub';
        html += `<${etiqueta}>${siguiente.html}</${etiqueta}>`;
        indice = siguiente.indice;
        continue;
      }
      const siguiente = caracter === '\\' ? comando(indice) : atom(indice);
      html += siguiente.html;
      indice = siguiente.indice;
    }
    return { html, indice: fuente[indice] === '}' ? indice + 1 : indice };
  }

  return fragmento(0).html;
}

function reemplazarFormulasLatex(texto: string) {
  return String(texto ?? '').replace(
    /<span\b[^>]*\bdata-latex\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/span>/gi,
    (_coincidencia, doble: string | undefined, simple: string | undefined) =>
      `<math>${convertirLatexAHtml(doble ?? simple ?? '')}</math>`
  );
}

function partirInlineEstilosHtml(texto: string) {
  const salida: Array<{
    texto: string;
    estilo: EstiloTexto;
    subrayado: boolean;
    noWrap: boolean;
    escala?: number;
    offsetY?: number;
    espacioAntes?: boolean;
    espacioDespues?: boolean;
  }> = [];
  const pila: Array<{ etiqueta: string; negrita: boolean; cursiva: boolean; subrayado: boolean; noWrap: boolean; escala: number; offsetY: number }> = [];
  let negrita = false;
  let cursiva = false;
  let subrayado = false;
  let noWrap = false;
  let escala = 1;
  let offsetY = 0;
  const agregar = (valor: string) => {
    const contenido = decodificarEntidadesPdf(valor);
    if (contenido) salida.push({
      texto: contenido,
      estilo: negrita ? 'bold' : cursiva ? 'italic' : 'regular',
      subrayado,
      noWrap,
      escala,
      offsetY,
      espacioAntes: /^\s/.test(contenido),
      espacioDespues: /\s$/.test(contenido)
    });
  };
  const tokens = reemplazarFormulasLatex(String(texto ?? '')).replace(/<br\s*\/?>/gi, '\n').split(/(<[^>]+>)/g);
  for (const token of tokens) {
    if (!token) continue;
    const inicio = /^<\s*([a-z0-9]+)(?:\s[^>]*)?>$/i.exec(token);
    const cierre = /^<\s*\/\s*([a-z0-9]+)\s*>$/i.exec(token);
    if (!inicio && !cierre) {
      agregar(token);
      continue;
    }
    const etiqueta = (inicio?.[1] ?? cierre?.[1] ?? '').toLowerCase();
    if (cierre) {
      const anterior = pila.pop();
      if (anterior) ({ negrita, cursiva, subrayado, noWrap, escala, offsetY } = anterior);
      continue;
    }
    pila.push({ etiqueta, negrita, cursiva, subrayado, noWrap, escala, offsetY });
    if (etiqueta === 'strong' || etiqueta === 'b') negrita = true;
    else if (etiqueta === 'em' || etiqueta === 'i') cursiva = true;
    else if (etiqueta === 'u') subrayado = true;
    else if (etiqueta === 'math') noWrap = true;
    else if (etiqueta === 'sub') { escala = 0.72; offsetY = -2.3; }
    else if (etiqueta === 'sup') { escala = 0.72; offsetY = 3.8; }
  }
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

  let indiceSegmento = 0;
  while (indiceSegmento < segmentos.length) {
    const segmento = segmentos[indiceSegmento];
    const texto = String(segmento.texto ?? '');
    if (!texto) {
      indiceSegmento += 1;
      continue;
    }

    // Una formula se compone de varios segmentos (base, subindice y
    // superindice). Agruparlos durante el ajuste de linea evita que un
    // exponente quede aislado en el renglon siguiente.
    if (segmento.noWrap) {
      const grupo: SegmentoTexto[] = [];
      let anchoGrupo = 0;
      let finGrupo = indiceSegmento;
      while (finGrupo < segmentos.length && segmentos[finGrupo]?.noWrap) {
        const miembro = segmentos[finGrupo];
        if (miembro?.texto) {
          grupo.push(miembro);
          anchoGrupo += widthSeg(miembro);
        }
        finGrupo += 1;
      }

      const grupoEsEspacio = grupo.length > 0 && grupo.every((miembro) => /^\s+$/.test(miembro.texto));
      if (!preservarEspaciosIniciales && actual.length === 0 && grupoEsEspacio) {
        indiceSegmento = finGrupo;
        continue;
      }

      if (anchoGrupo <= maxWidth) {
        if (anchoActual > 0 && anchoActual + anchoGrupo > maxWidth) pushLinea();
        actual.push(...grupo);
        anchoActual += anchoGrupo;
        indiceSegmento = finGrupo;
        continue;
      }

      // Fallback defensivo para una formula excepcionalmente larga: se
      // permite partirla, pero solo después de intentar conservarla completa.
      for (const miembro of grupo) {
        const anchoMiembro = widthSeg(miembro);
        if (anchoMiembro <= maxWidth) {
          if (anchoActual > 0 && anchoActual + anchoMiembro > maxWidth) pushLinea();
          actual.push({ ...miembro, noWrap: false });
          anchoActual += anchoMiembro;
          continue;
        }
        for (const caracter of miembro.texto) {
          const caracterSeg = { ...miembro, texto: caracter, noWrap: false };
          const anchoCaracter = widthSeg(caracterSeg);
          if (anchoActual > 0 && anchoActual + anchoCaracter > maxWidth) pushLinea();
          actual.push(caracterSeg);
          anchoActual += anchoCaracter;
        }
      }
      indiceSegmento = finGrupo;
      continue;
    }

    const tokens = segmento.esCodigo || segmento.noWrap
      ? [texto]
      : texto.split(/(\s+)/).filter((parte) => parte.length > 0);

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

      if (ancho > maxWidth && !segmento.noWrap) {
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
    indiceSegmento += 1;
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

    const lineasTexto = normalizarIndicesUnicode(String(bloque.contenido ?? '')).replace(/\r\n?/g, '\n').split('\n');
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

        const trozos = /<\/?(?:strong|b|em|i|u|sub|sup|span|br)\b/i.test(String(segmento.contenido))
          ? partirInlineEstilosHtml(String(segmento.contenido))
          : partirInlineEstilosMarkdown(String(segmento.contenido));
        for (const trozo of trozos) {
          const textoPlano = normalizarEspaciosSuaves(trozo.texto);
          if (!textoPlano) continue;
          const font = trozo.estilo === 'bold' ? fuenteBold : trozo.estilo === 'italic' ? fuenteItalica : fuente;
          segmentos.push({
            texto: textoPlano,
            font,
            size: sizeTexto * (trozo.escala ?? 1),
            esCodigo: false,
            noWrap: trozo.noWrap,
            subrayado: trozo.subrayado,
            offsetY: trozo.offsetY,
            espacioAntes: trozo.espacioAntes,
            espacioDespues: trozo.espacioDespues
          });
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
          const separacionEscrita = Boolean(previo.espacioDespues || segmento.espacioAntes);
          const sinMetadatosDeSeparacion = previo.espacioDespues === undefined && segmento.espacioAntes === undefined;
          if (
            (separacionEscrita || sinMetadatosDeSeparacion) &&
            !/\s$/.test(previo.texto) &&
            !/^\s/.test(segmento.texto)
          ) {
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

function dibujarTextoConPesoVisual(
  page: PDFPage,
  texto: string,
  opciones: { x: number; y: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb> },
  reforzarPeso: boolean
) {
  if (!reforzarPeso) {
    page.drawText(texto, opciones);
    return;
  }

  // Ecofont solo dispone de una fuente regular. FillAndOutline refuerza el
  // trazo dentro del mismo operador de texto: mantiene la extracción PDF y
  // evita duplicar visualmente el contenido o alterar el ancho tipográfico.
  page.pushOperators(
    pushGraphicsState(),
    setTextRenderingMode(TextRenderingMode.FillAndOutline),
    setLineWidth(Math.max(0.2, opciones.size * 0.032)),
    setStrokingColor(opciones.color ?? rgb(0, 0, 0))
  );
  page.drawText(texto, opciones);
  page.pushOperators(popGraphicsState());
}

// Dibuja lineas mixtas respetando el espaciado calculado en la envoltura.
function dibujarLineasMixtas({
  page,
  lineas,
  x,
  y,
  colorTexto,
  reforzarPeso = false,
  registrarRuns
}: {
  page: PDFPage;
  lineas: LineaSegmentos[];
  x: number;
  y: number;
  colorTexto?: ReturnType<typeof rgb>;
  reforzarPeso?: boolean;
  registrarRuns?: (run: TextRunDebug) => void;
}) {
  let cursorY = y;
  for (const linea of lineas) {
    let cursorX = x;
    for (const segmento of linea.segmentos) {
      const texto = String(segmento.texto ?? '');
      if (!texto) continue;
      dibujarTextoConPesoVisual(page, texto, {
        x: cursorX,
        y: cursorY + (segmento.offsetY ?? 0),
        size: segmento.size,
        font: segmento.font,
        color: colorTexto
      }, reforzarPeso);
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
            fuente: FUENTE_ECOFONT_FAMILIA,
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

function resolverPerfilRender(
  templateVersion: 4,
  perfilBase: PerfilPlantillaOmr
): PerfilPlantillaRender {
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
    // La geometría OMR no depende de un modo de densidad ni de un fallback:
    // la plantilla canónica v4 siempre imprime cinco burbujas horizontales.
    // El diámetro de 6 mm y el paso de 25 pt mantienen señal útil y agregan
    // separación para blur, sombra, compresión y expansión de tinta en papel.
    burbujaRadio: (6 * MM_A_PUNTOS) / 2,
    burbujaPasoY: 0,
    burbujaPasoX: 25,
    orientacion: 'horizontal',
    cajaOmrAncho: 137,
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
    if (perfil.marcasEsquina === 'cuadrados') {
      const x = esquina.x === margen ? esquina.x : esquina.x - tam;
      const y = esquina.y === ALTO_CARTA - margen ? esquina.y - tam : esquina.y;
      const xMin = Math.max(0, x - quiet);
      const yMin = Math.max(0, y - quiet);
      const xMax = Math.min(ANCHO_CARTA, x + tam + quiet);
      const yMax = Math.min(ALTO_CARTA, y + tam + quiet);
      page.drawRectangle({ x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin, color: rgb(1, 1, 1) });
      page.drawRectangle({ x, y, width: tam, height: tam, color: rgb(0, 0, 0) });
      continue;
    }

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
  // jsQR devuelve las esquinas de la matriz, no las de la imagen completa con
  // quiet zone. Persistimos ambas dimensiones para que el detector pueda
  // reconstruir la referencia fisica exacta del simbolo.
  const qrSymbol = (QRCode as unknown as {
    create: (texto: string, opciones: { errorCorrectionLevel: 'H' }) => { modules: { size: number } };
  }).create(qrTexto, { errorCorrectionLevel: 'H' });
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
  // La leyenda se dibuja en la zona de silencio superior del QR. Mantener la
  // tarjeta sin una franja inferior evita espacio blanco y conserva la altura
  // disponible para reactivos en perfiles verticales.
  const captionHeight = 0;
  const cardW = qrSize + padding * 2;
  const cardH = qrSize + padding * 2 + captionHeight;

  // La caja exterior completa, incluido su quiet zone, queda dentro de la
  // cabecera y alineada con el borde imprimible. Antes el calculo usaba solo
  // el bitmap y dejaba el marco del QR fuera del encabezado.
  // El QR no puede compartir la quiet zone del fiducial superior derecho.
  // La separación se calcula con la geometría real del marcador, no con un
  // píxel visual aproximado que puede desaparecer al imprimir o fotografiar.
  const separacionMarcadorQr = perfil.marcaCuadradoSize + perfil.marcaCuadradoQuietZone + 4;
  // La tarjeta queda pegada al borde interior de la cabecera. La separación
  // con el fiducial superior derecho se conserva en el eje vertical: el QR
  // comienza debajo de la reserva del marcador, por lo que no se necesita
  // sacrificar una franja lateral completa.
  const bordeDerechoReserva = ANCHO_CARTA - margen - 4;
  const bordeSuperiorReserva = ALTO_CARTA - margen - separacionMarcadorQr;
  const cardX = bordeDerechoReserva - cardW;
  const cardY = bordeSuperiorReserva - cardH;
  const x = cardX + padding;
  const y = cardY + captionHeight + padding;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
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

  return {
    qrSize,
    x,
    y,
    padding,
    marginModules: perfil.qrMarginModulos,
    matrixModules: qrSymbol.modules.size,
    cardX,
    cardY,
    cardW,
    cardH
  };
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

function dibujarPatronPunteadoEncabezado(page: PDFPage, rect: RectBox, color: ReturnType<typeof rgb>) {
  // Composición vectorial experimental: retícula de rombos, órbitas
  // concéntricas, abanicos radiales y polígonos angulares. La combinación
  // ofrece variedad visual sin depender de una imagen raster y conserva una
  // opacidad baja para que el patrón no compita con identidad, QR ni texto.
  const margen = 9;
  const xMin = rect.x + margen;
  const xMax = rect.x + rect.width - margen;
  const yMin = rect.y + margen;
  const yMax = rect.y + rect.height - margen;
  const dentro = (punto: { x: number; y: number }) =>
    punto.x >= xMin && punto.x <= xMax && punto.y >= yMin && punto.y <= yMax;
  const linea = (inicio: { x: number; y: number }, fin: { x: number; y: number }, thickness: number, opacity: number) => {
    if (dentro(inicio) && dentro(fin)) page.drawLine({ start: inicio, end: fin, color, thickness, opacity });
  };
  const circuloPunteado = (
    centroCirculo: { x: number; y: number },
    radio: number,
    radioPunto: number,
    opacity: number,
    paso = 8
  ) => {
    const puntos = Math.max(12, Math.ceil((2 * Math.PI * radio) / paso));
    for (let indice = 0; indice < puntos; indice += 1) {
      const angulo = (Math.PI * 2 * indice) / puntos;
      const punto = {
        x: centroCirculo.x + Math.cos(angulo) * radio,
        y: centroCirculo.y + Math.sin(angulo) * radio
      };
      if (dentro(punto)) page.drawCircle({ x: punto.x, y: punto.y, size: radioPunto, color, opacity });
    }
  };
  const poligono = (vertices: Array<{ x: number; y: number }>, thickness: number, opacity: number) => {
    for (let indice = 0; indice < vertices.length; indice += 1) {
      linea(vertices[indice]!, vertices[(indice + 1) % vertices.length]!, thickness, opacity);
    }
  };

  // Retícula base de rombos, con alternancia de escala para evitar una
  // textura monótona y mantener una firma geométrica reconocible.
  const pasoX = 31;
  const pasoY = 24;
  for (let fila = 0, y = yMin; y <= yMax; fila += 1, y += pasoY) {
    const desplazamiento = fila % 2 === 0 ? 0 : pasoX / 2;
    for (let columna = 0, x = xMin + desplazamiento; x <= xMax; columna += 1, x += pasoX) {
      const radio = columna % 3 === 0 ? 7 : 5;
      const vertices = [
        { x, y: y + radio },
        { x: x + radio, y },
        { x, y: y - radio },
        { x: x - radio, y }
      ];
      poligono(vertices, 0.58, columna % 3 === 0 ? 0.09 : 0.065);
      if (dentro({ x, y })) page.drawCircle({ x, y, size: columna % 3 === 0 ? 0.9 : 0.62, color, opacity: 0.1 });
    }
  }

  // Mandala lineal central: los anillos y radios quedan suficientemente
  // claros para percibirse, pero su opacidad es menor detrás del título.
  const centro = { x: rect.x + rect.width * 0.52, y: rect.y + rect.height * 0.62 };
  const anchos = [148, 118, 88, 58];
  for (let indice = 0; indice < anchos.length; indice += 1) {
    const ancho = anchos[indice]!;
    const alto = ancho * 0.58;
    poligono([
      { x: centro.x, y: centro.y + alto },
      { x: centro.x + ancho, y: centro.y },
      { x: centro.x, y: centro.y - alto },
      { x: centro.x - ancho, y: centro.y }
    ], 0.72, 0.065 + indice * 0.012);
  }
  for (let indice = 0; indice < 12; indice += 1) {
    const angulo = (Math.PI * 2 * indice) / 12;
    const radio = 154;
    linea(
      centro,
      { x: centro.x + Math.cos(angulo) * radio, y: centro.y + Math.sin(angulo) * radio * 0.58 },
      0.52,
      0.052
    );
  }

  // Segundo nivel de geometria visionaria: roseta radial, triangulos
  // concentricos y un contorno bilateral tipo ojo. Es una interpretacion
  // abstracta de geometria sagrada y anatomia espiritual, no una imagen
  // raster ni una reproduccion de obra ajena.
  const radioRosetaMax = Math.max(
    1,
    Math.min(
      42,
      centro.x - xMin - 4,
      xMax - centro.x - 4,
      centro.y - yMin - 4,
      yMax - centro.y - 4
    )
  );
  const radiosRoseta = [0.34, 0.5, 0.66, 0.83, 1].map((factor) => radioRosetaMax * factor);
  for (let indice = 0; indice < radiosRoseta.length; indice += 1) {
    const radio = radiosRoseta[indice]!;
    circuloPunteado(centro, radio, indice % 2 === 0 ? 0.76 : 0.64, 0.068 + (indice % 2) * 0.008, 5.5);
  }
  for (let indice = 0; indice < 12; indice += 1) {
    const angulo = (Math.PI * 2 * indice) / 12 + Math.PI / 12;
    const radioInterior = indice % 2 === 0 ? 22 : 34;
    const radioExterior = indice % 2 === 0 ? 64 : 82;
    linea(
      { x: centro.x + Math.cos(angulo) * radioInterior, y: centro.y + Math.sin(angulo) * radioInterior },
      { x: centro.x + Math.cos(angulo) * radioExterior, y: centro.y + Math.sin(angulo) * radioExterior },
      0.6,
      0.06
    );
  }
  const ojoAlto = Math.min(12, radioRosetaMax * 0.48);
  const ojoAncho = Math.min(38, radioRosetaMax * 1.75);
  const ojoSuperior = [
    { x: centro.x - ojoAncho, y: centro.y },
    { x: centro.x - ojoAncho * 0.62, y: centro.y + ojoAlto * 0.72 },
    { x: centro.x, y: centro.y + ojoAlto },
    { x: centro.x + ojoAncho * 0.62, y: centro.y + ojoAlto * 0.72 },
    { x: centro.x + ojoAncho, y: centro.y }
  ];
  const ojoInferior = ojoSuperior.map((punto) => ({ x: punto.x, y: centro.y - (punto.y - centro.y) }));
  poligono(ojoSuperior, 0.72, 0.075);
  poligono(ojoInferior.reverse(), 0.72, 0.075);
  circuloPunteado(centro, 8, 0.68, 0.075, 4.8);
  page.drawCircle({ x: centro.x, y: centro.y, size: 2.2, color, opacity: 0.08 });

  // Nodos organicos simetricos en los laterales: aumentan la percepcion del
  // patron sin competir con la identidad institucional ni el texto.
  for (const direccion of [-1, 1]) {
    const nodo = { x: centro.x + direccion * 132, y: centro.y - 4 };
    if (!dentro(nodo)) continue;
    const radioNodoMax = Math.min(
      16,
      nodo.x - xMin - 3,
      xMax - nodo.x - 3,
      nodo.y - yMin - 3,
      yMax - nodo.y - 3
    );
    if (radioNodoMax > 0) {
      for (let indice = 0; indice < 5; indice += 1) {
        const radio = Math.max(0.6, radioNodoMax * (0.25 + indice * 0.18));
        circuloPunteado(nodo, radio, 0.56, 0.058 + indice * 0.007, 5);
      }
    }
    linea(
      { x: nodo.x - direccion * 32, y: nodo.y },
      { x: nodo.x + direccion * 32, y: nodo.y },
      0.55,
      0.08
    );
  }

  // Abanicos laterales y polígonos quebrados: añaden el carácter angular y
  // orgánico solicitado sin crear rectángulos de fondo ni marcos artificiales.
  const lados = [xMin + 18, xMax - 18];
  for (const [indice, x] of lados.entries()) {
    const direccion = indice === 0 ? 1 : -1;
    const origen = { x, y: yMax - 8 };
    const puntas = [0, 24, 48, 72, 96].map((desplazamiento, indicePunta) => ({
      x: x + direccion * (34 + desplazamiento),
      y: yMin + 20 + indicePunta * 17
    }));
    for (const [indicePunta, punta] of puntas.entries()) {
      linea(origen, punta, indicePunta % 2 === 0 ? 0.9 : 0.55, indicePunta % 2 === 0 ? 0.14 : 0.09);
    }
    poligono([
      { x: x, y: yMin + 8 },
      { x: x + direccion * 42, y: yMin + 38 },
      { x: x + direccion * 15, y: yMin + 68 },
      { x: x + direccion * 60, y: yMin + 92 }
    ], 0.7, 0.075);
  }

  // Micro-puntos de apoyo para conservar textura al imprimir, separados de
  // las líneas principales para que no parezca ruido ni degrade la lectura.
  for (let y = yMin + 4; y <= yMax; y += 9) {
    for (let x = xMin + 4; x <= xMax; x += 9) {
      if ((Math.round(x + y) / 9) % 3 !== 0) page.drawCircle({ x, y, size: 0.35, color, opacity: 0.05 });
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

function dibujarPatronBloqueCaptura(
  page: PDFPage,
  rect: RectBox,
  color: ReturnType<typeof rgb>,
  exclusiones: RectBox[]
) {
  // El bloque completo recibe únicamente una retícula de puntos tenue. Las
  // líneas de captura se excluyen por completo para preservar una superficie
  // limpia donde se escribe a mano; los patrones geométricos complejos quedan
  // reservados para la cabecera institucional.
  const margen = 4;
  const xMin = rect.x + margen;
  const xMax = rect.x + rect.width - margen;
  const yMin = rect.y + margen;
  const yMax = rect.y + rect.height - margen;
  const dentro = (caja: RectBox) =>
    caja.x >= xMin && caja.y >= yMin && caja.x + caja.width <= xMax && caja.y + caja.height <= yMax;
  const libre = (caja: RectBox) => dentro(caja) && exclusiones.every((exclusion) => !rectInterseca(caja, exclusion));
  const colorSecundario = rgb(0.12, 0.38, 0.58);
  const dibujarPunto = (x: number, y: number, radio: number, tono: ReturnType<typeof rgb>) => {
    const caja = { x: x - radio, y: y - radio, width: radio * 2, height: radio * 2 };
    if (!libre(caja)) return;
    page.drawCircle({ x, y, size: radio, color: tono, opacity: 0.055 });
  };

  // Malla fina continua y muy clara: mantiene profundidad visual en todo el
  // bloque sin crear bordes falsos ni competir con el texto.
  for (let fila = 0, y = yMin + 4; y <= yMax - 4; fila += 1, y += 9) {
    const desplazamiento = fila % 2 === 0 ? 0 : 4.5;
    for (let x = xMin + 4 + desplazamiento; x <= xMax - 4; x += 9) {
      dibujarPunto(x, y, 0.3, fila % 3 === 0 ? colorSecundario : color);
    }
  }
}

function dibujarPatronPunteadoReactivo(
  page: PDFPage,
  rect: RectBox,
  color: ReturnType<typeof rgb>
) {
  // Conserva la textura editorial, pero con una trama mas abierta y ligera.
  // El color base permanece debajo para no perder la estética de tarjeta.
  const inset = 2.8;
  const xMin = rect.x + inset;
  const xMax = rect.x + rect.width - inset;
  const yMin = rect.y + inset;
  const yMax = rect.y + rect.height - inset;
  const paso = 9.8;
  for (let fila = 0, y = yMin; y <= yMax; fila += 1, y += paso) {
    const desplazamiento = fila % 2 === 0 ? 0 : paso / 2;
    for (let x = xMin + desplazamiento; x <= xMax; x += paso) {
      page.drawCircle({
        x,
        y,
        size: 0.34,
        color,
        opacity: 0.055
      });
    }
  }
}

function dibujarOrnamentoPunteadoCuerpo(
  page: PDFPage,
  rect: RectBox,
  color: ReturnType<typeof rgb>
) {
  // Adorno de muy baja cobertura en las esquinas del cuerpo. Aporta
  // continuidad visual sin poner tinta debajo de preguntas, respuestas ni
  // paneles OMR. Los puntos se dibujan antes de los elementos funcionales.
  const margen = 8;
  const puntos = [
    { x: rect.x + margen, y: rect.y + margen },
    { x: rect.x + margen + 4.5, y: rect.y + margen },
    { x: rect.x + margen, y: rect.y + margen + 4.5 },
    { x: rect.x + rect.width - margen, y: rect.y + rect.height - margen },
    { x: rect.x + rect.width - margen - 4.5, y: rect.y + rect.height - margen },
    { x: rect.x + rect.width - margen, y: rect.y + rect.height - margen - 4.5 }
  ];
  for (const punto of puntos) {
    page.drawCircle({ x: punto.x, y: punto.y, size: 0.42, color, opacity: 0.08 });
  }
}

// Iconos de cabecera alineados con el sistema SVG existente en
// `apps/frontend/src/ui/iconos.tsx`. Se reutilizan sus trazos y proporciones
// mediante drawSvgPath para que la iconografia de la aplicacion y del PDF sea
// consistente, nítida y estable al imprimir en escala de grises.
const SVG_ICONO_ALUMNO_HOMBROS = 'M5.5 21a6.5 6.5 0 0 1 13 0';
const SVG_ICONO_ALUMNOS_HOMBRO = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2';
const SVG_ICONO_ALUMNOS_DERECHA = 'M22 21v-2a4 4 0 0 0-3-3.87';
const SVG_ICONO_ALUMNOS_ARCO = 'M16 3.13a4 4 0 0 1 0 7.75';
const SVG_ICONO_DOCENTE_GORRO = 'M22 10v6M2 10l10-5 10 5-10 5z';
const SVG_ICONO_DOCENTE_BANDA = 'M6 12v5c3 3 9 3 12 0v-5';
const SVG_ICONO_INFO = 'M12 16v-4';

const ESCALA_ICONO_CABECERA = 0.48;
const GROSOR_ICONO_CABECERA = 1.05;
const ALTO_ICONO_CABECERA = 11.6;

function dibujarPathIconoCabecera(
  page: PDFPage,
  path: string,
  x: number,
  y: number,
  color: ReturnType<typeof rgb>
) {
  page.drawSvgPath(path, {
    x,
    y: y + ALTO_ICONO_CABECERA,
    scale: ESCALA_ICONO_CABECERA,
    borderColor: color,
    borderWidth: GROSOR_ICONO_CABECERA,
    opacity: 0.96
  });
}

function dibujarIconoPersona(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>): RectBox {
  const escala = ESCALA_ICONO_CABECERA;
  dibujarPathIconoCabecera(page, SVG_ICONO_ALUMNO_HOMBROS, x, y, color);
  page.drawCircle({
    x: x + 12 * escala,
    y: y + ALTO_ICONO_CABECERA - 7 * escala,
    size: 4 * escala,
    borderColor: color,
    borderWidth: GROSOR_ICONO_CABECERA
  });
  return { x, y, width: 12, height: ALTO_ICONO_CABECERA };
}

function dibujarIconoGrupo(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>): RectBox {
  const escala = ESCALA_ICONO_CABECERA;
  dibujarPathIconoCabecera(page, SVG_ICONO_ALUMNOS_HOMBRO, x, y, color);
  dibujarPathIconoCabecera(page, SVG_ICONO_ALUMNOS_DERECHA, x, y, color);
  dibujarPathIconoCabecera(page, SVG_ICONO_ALUMNOS_ARCO, x, y, color);
  page.drawCircle({
    x: x + 9 * escala,
    y: y + ALTO_ICONO_CABECERA - 7 * escala,
    size: 4 * escala,
    borderColor: color,
    borderWidth: GROSOR_ICONO_CABECERA
  });
  return { x, y, width: 12, height: ALTO_ICONO_CABECERA };
}

function dibujarIconoDocente(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>): RectBox {
  dibujarPathIconoCabecera(page, SVG_ICONO_DOCENTE_GORRO, x, y, color);
  dibujarPathIconoCabecera(page, SVG_ICONO_DOCENTE_BANDA, x, y, color);
  // El birrete ocupa menos altura que los iconos de captura; conservar una
  // caja ajustada evita que el icono toque la linea de materia superior.
  return { x, y, width: 12, height: 9.6 };
}

function dibujarIconoIndicaciones(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>): RectBox {
  const escala = ESCALA_ICONO_CABECERA;
  dibujarPathIconoCabecera(page, 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18', x, y, color);
  dibujarPathIconoCabecera(page, SVG_ICONO_INFO, x, y, color);
  dibujarPathIconoCabecera(page, 'M12 8h.01', x, y, color);
  page.drawCircle({
    x: x + 12 * escala,
    y: y + ALTO_ICONO_CABECERA - 8 * escala,
    size: 1.35 * escala,
    color
  });
  return { x, y, width: 12, height: ALTO_ICONO_CABECERA };
}

function dibujarEjemplosMarca(
  page: PDFPage,
  x: number,
  y: number,
  fuente: PDFFont,
  size: number
): RectBox {
  const radio = 3.1;
  const centroY = y + 4.3;
  const xCorrecta = x + radio;
  const xIncorrecta = x + 53 + radio;
  const colorCorrecto = rgb(0.06, 0.4, 0.34);
  const colorIncorrecto = rgb(0.58, 0.2, 0.18);

  // Correcta: la marca queda centrada y separada del borde.
  page.drawCircle({
    x: xCorrecta,
    y: centroY,
    size: radio,
    borderColor: colorCorrecto,
    borderWidth: 0.7
  });
  page.drawCircle({ x: xCorrecta, y: centroY, size: 1.05, color: colorCorrecto });
  page.drawText('Correcta', { x: x + 8, y, size, font: fuente, color: colorCorrecto });

  // Incorrecta: la marca toca el borde y se tacha suavemente para que el
  // ejemplo no se confunda con una respuesta válida del examen.
  page.drawCircle({
    x: xIncorrecta,
    y: centroY,
    size: radio,
    borderColor: colorIncorrecto,
    borderWidth: 0.7
  });
  page.drawCircle({
    x: xIncorrecta + radio * 0.68,
    y: centroY,
    size: 1.05,
    color: colorIncorrecto
  });
  page.drawLine({
    start: { x: xIncorrecta - radio - 1.1, y: centroY - radio - 1 },
    end: { x: xIncorrecta + radio + 1.1, y: centroY + radio + 1 },
    color: colorIncorrecto,
    thickness: 0.65,
    opacity: 0.82
  });
  page.drawText('Incorrecta', { x: x + 61, y, size, font: fuente, color: colorIncorrecto });

  return { x, y, width: Math.max(92, 61 + fuente.widthOfTextAtSize('Incorrecta', size)), height: size + 2 };
}

function dibujarBordePagina(
  page: PDFPage,
  margen: number,
  color: ReturnType<typeof rgb>,
  acento: ReturnType<typeof rgb>
) {
  const inset = margen + 3.5;
  const xMin = inset;
  const xMax = ANCHO_CARTA - inset;
  const yMin = inset;
  const yMax = ALTO_CARTA - inset;
  page.drawRectangle({
    x: xMin,
    y: yMin,
    width: xMax - xMin,
    height: yMax - yMin,
    borderColor: color,
    borderWidth: 0.55,
    borderOpacity: 0.46
  });

  // Remates cromáticos centrados en los cuatro lados: dan jerarquía al marco
  // sin acercarse a las marcas de registro de las esquinas ni invadir el OMR.
  const separacionEsquina = 30;
  const segmentos = [
    [{ x: xMin + separacionEsquina, y: yMax }, { x: xMax - separacionEsquina, y: yMax }],
    [{ x: xMin + separacionEsquina, y: yMin }, { x: xMax - separacionEsquina, y: yMin }],
    [{ x: xMin, y: yMin + separacionEsquina }, { x: xMin, y: yMax - separacionEsquina }],
    [{ x: xMax, y: yMin + separacionEsquina }, { x: xMax, y: yMax - separacionEsquina }]
  ] as const;
  for (const [inicio, fin] of segmentos) {
    page.drawLine({
      start: inicio,
      end: fin,
      color: acento,
      thickness: 0.9,
      opacity: 0.68,
      lineCap: LineCapStyle.Round
    });
  }
}

function dibujarLineaPunteada(
  page: PDFPage,
  inicio: { x: number; y: number },
  fin: { x: number; y: number },
  color: ReturnType<typeof rgb>,
  grosor = 0.55,
  opacidad = 0.62
) {
  const dx = fin.x - inicio.x;
  const dy = fin.y - inicio.y;
  const longitud = Math.hypot(dx, dy);
  if (longitud <= 0) return;
  const ux = dx / longitud;
  const uy = dy / longitud;
  const guion = 3;
  const separacion = 2;
  for (let recorrido = 0; recorrido < longitud; recorrido += guion + separacion) {
    const tramo = Math.min(guion, longitud - recorrido);
    page.drawLine({
      start: { x: inicio.x + ux * recorrido, y: inicio.y + uy * recorrido },
      end: { x: inicio.x + ux * (recorrido + tramo), y: inicio.y + uy * (recorrido + tramo) },
      color,
      thickness: grosor,
      opacity: opacidad
    });
  }
}

function dibujarCajaPunteada(
  page: PDFPage,
  caja: RectBox,
  color: ReturnType<typeof rgb>,
  incluirBordeSuperior = true
) {
  const x2 = caja.x + caja.width;
  const y2 = caja.y + caja.height;
  if (incluirBordeSuperior) {
    dibujarLineaPunteada(page, { x: caja.x, y: y2 }, { x: x2, y: y2 }, color);
  }
  dibujarLineaPunteada(page, { x: x2, y: y2 }, { x: x2, y: caja.y }, color);
  dibujarLineaPunteada(page, { x: x2, y: caja.y }, { x: caja.x, y: caja.y }, color);
  dibujarLineaPunteada(page, { x: caja.x, y: caja.y }, { x: caja.x, y: y2 }, color);
}

async function embedFuenteEcofont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const configurada = String(process.env.EXAMEN_FONT_ECOFONT_PATH ?? '').trim();
  const cwd = process.cwd();
  const candidatos = [
    ...(configurada ? [configurada] : []),
    path.resolve(cwd, 'apps', 'backend', 'assets', 'fonts', FUENTE_ECOFONT_ARCHIVO),
    path.resolve(cwd, 'assets', 'fonts', FUENTE_ECOFONT_ARCHIVO),
    path.resolve(cwd, '..', 'assets', 'fonts', FUENTE_ECOFONT_ARCHIVO),
    path.resolve(cwd, '..', 'apps', 'backend', 'assets', 'fonts', FUENTE_ECOFONT_ARCHIVO),
    path.resolve(cwd, '..', '..', 'apps', 'backend', 'assets', 'fonts', FUENTE_ECOFONT_ARCHIVO)
  ];

  for (const candidato of candidatos) {
    try {
      const buffer = await fs.readFile(candidato);
      return await pdfDoc.embedFont(buffer, { subset: true });
    } catch {
      // La salida sigue siendo funcional si una instalación no trae el asset.
    }
  }
  throw new Error(`No se pudo cargar la fuente obligatoria ${FUENTE_ECOFONT_ARCHIVO}`);
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
    // Ecofont Vera Sans solo se distribuye aquí en variante regular. Todas
    // las funciones tipográficas apuntan deliberadamente al mismo recurso:
    // el énfasis enriquecido conserva tamaño, color y subrayado, pero nunca
    // introduce Helvetica, Courier u otra familia en el PDF.
    const fuente = await embedFuenteEcofont(pdfDoc);
    const fuenteBold = fuente;
    const fuenteItalica = fuente;
    const fuenteMono = fuente;

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
    const colorFondoPagina = rgb(0.95, 0.98, 1);
    const colorTinta = rgb(...PDF_VISUAL_BASELINE_RGB.primary);
    // El área de lectura permanece blanca: los colores decorativos se quedan
    // fuera del ROI para que la conversión a escala de grises no fabrique tinta.
    const colorPanelOmr = rgb(1, 1, 1);
    const colorBordeOmr = rgb(0.58, 0.67, 0.73);
    // Colores funcionales diferenciados: conservan contraste al imprimir en
    // color y siguen siendo distinguibles por luminancia en escala de grises.
    const colorIconoAlumno = rgb(0.04, 0.43, 0.72);
    const colorIconoGrupo = rgb(0.05, 0.50, 0.38);
    const colorIconoDocente = rgb(0.08, 0.34, 0.56);
    const colorIconoIndicaciones = rgb(0.42, 0.25, 0.70);
    const coloresPregunta = [
      { fondo: rgb(0.9, 0.955, 0.985), acento: rgb(0.05, 0.4, 0.66) },
      { fondo: rgb(0.94, 0.93, 0.985), acento: rgb(0.28, 0.23, 0.62) },
      { fondo: rgb(0.9, 0.97, 0.94), acento: rgb(0.04, 0.4, 0.34) },
      { fondo: rgb(0.995, 0.95, 0.86), acento: rgb(0.66, 0.34, 0.03) }
    ];
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
      // La banda de captura necesita aire propio: con tres puntos el ultimo
      // metadato quedaba visualmente pegado a la regla superior de Nombre.
      camposGapTop: 5,
      campoRowGap: 4,
      // La linea del campo queda claramente debajo del glifo, no pegada a la
      // etiqueta ni confundida con una regla de fondo al rasterizar. Un
      // descenso adicional evita que los descendentes de Ecofont parezcan
      // atravesados por la regla en fotografías de baja resolución.
      campoLineOffsetY: -5
    });

    const fontScale = Math.min(1.3, Math.max(0.9, Number(examen.layout.fontScale ?? 1) || 1));
    const lineSpacing = Math.min(1.6, Math.max(0.9, Number(examen.layout.lineSpacing ?? 1) || 1));
    // La retícula 3+2 libera suficiente ancho para subir ligeramente la
    // tipografía sin perder el objetivo de 20--25 reactivos en dos páginas.
    // La plantilla canónica horizontal conserva la escala tipográfica completa;
    // el ancho liberado por la geometría única evita reducir la legibilidad.
    const escalaPerfilDenso = 1;
    const sizeTitulo = 17 * fontScale;
    // Tipografia de lectura humana. Estos valores recuperan la escala legible
    // del generador original y mantienen fontScale/lineSpacing configurables;
    // el OMR se conserva como columna secundaria, no como sustituto del texto.
    const sizeMeta = 9.3 * fontScale;
    const sizePregunta = 10.4 * fontScale * escalaPerfilDenso;
    const sizeOpcion = 8.8 * fontScale * escalaPerfilDenso;
    const sizeCodigoInline = 8.4 * fontScale * escalaPerfilDenso;
    const sizeCodigoBloque = 8.3 * fontScale * escalaPerfilDenso;

      const lineaPregunta = Math.max(
      (perfilOmr.orientacion === 'horizontal' ? 10.4 : 13.2) * fontScale,
      sizePregunta * 1.18
    ) * lineSpacing;
    const lineaOpcion = Math.max(
      (perfilOmr.orientacion === 'horizontal' ? 8.8 : 11.4) * fontScale,
      sizeOpcion * 1.18
    ) * lineSpacing;
    const lineaCodigoBloque = Math.max(
      (perfilOmr.orientacion === 'horizontal' ? 8.6 : 10.8) * fontScale,
      sizeCodigoBloque * 1.18
    ) * lineSpacing;
    // Separacion corta pero visible: el ritmo lo aporta la linea divisoria y
    // el bloque numerado, no un hueco vertical que robe reactivos legibles.
    const separacionPregunta = perfilOmr.orientacion === 'horizontal'
      ? 0.6 * lineSpacing
      : 1.2 * lineSpacing;
    // El fondo del reactivo se extiende una línea por encima de su caja
    // tipográfica. Un margen inferior corto conserva la separación imprimible
    // y entrega el resto del hueco directamente al área de reactivos.
    const separacionCabeceraContenido = Math.max(9, lineaPregunta - 1);
    // Holgura compartida por el planificador y el renderer entre tarjetas de
    // opciones. Mantener un unico valor evita que el plan reserve menos alto
    // del que finalmente consume una opcion de varias lineas.
    // En la retícula 3+2, 1 pt separa las dos filas sin convertir cada
    // reactivo corto en una reserva vertical innecesaria. La holgura de las
    // líneas y el fondo único del reactivo siguen evitando contactos visuales.
    const separacionTarjetaOpcion = perfilOmr.orientacion === 'horizontal' ? 1 : 3;
    const omrTotalLetras = 5;
    const omrRadio = perfilOmr.burbujaRadio;
    const omrPasoY = perfilOmr.burbujaPasoY;
    const omrEsquemaHorizontal = perfilOmr.orientacion === 'horizontal';
    const omrPasoX = perfilOmr.burbujaPasoX ?? 0;
    const omrMargenHorizontal = 4.5;
    const omrEtiquetaGap = 4;
    // El panel horizontal conserva el diámetro OMR canónico, pero reduce el
    // aire que no aporta señal: la cabecera/fiduciales siguen separados y las
    // etiquetas quedan dentro de la reserva inferior. La caja numérica reducida
    // deja una holgura visual de 1.6 pt antes del primer círculo, sin aumentar
    // la altura del panel ni cambiar el centro o el paso de las burbujas.
    const omrMargenSuperior = omrEsquemaHorizontal ? 8.6 : 9;
    // La etiqueta de cada burbuja conserva una zona blanca propia; la reserva
    // se coordina con el desplazamiento real de las letras bajo los círculos.
    const omrSeparacionEtiquetaBorde = omrEsquemaHorizontal ? 2.4 : 0;
    // La reserva inferior debe ser mayor que el desplazamiento de la etiqueta:
    // si ambos valores coinciden, la caja tipográfica termina exactamente sobre
    // el borde del panel y el raster puede mostrar la letra tocando la línea.
    // La reserva adicional de 2.4 pt (~0.85 mm) mantiene la separación visible
    // sin alterar el diámetro, paso ni la posición de las burbujas.
    const omrMargenInferior = omrEsquemaHorizontal ? 4.8 + omrSeparacionEtiquetaBorde : 1.5;
    // Separación positiva, subpunto y visible a 300 DPI, entre paneles OMR
    // consecutivos. El valor evita contactos sin desperdiciar la reserva
    // inferior cuando una continuación empieza debajo de los fiduciales.
    const separacionPanelOmr = omrEsquemaHorizontal ? 0.45 : 1;
    // El perfil compacto coloca las cinco opciones en una fila controlada.
    // Cada círculo mantiene separación física de su vecino y el panel queda
    // aislado del texto para que el ROI sea inequívoco en una fotografía.
    const anchoColRespuesta = perfilOmr.cajaOmrAncho;
    const fiducialSizeMinimo = perfilOmr.fiducialSize;
    const fiducialMarginMinimo = Math.max(1.2, perfilOmr.fiducialMargin);
    const fiducialQuietZoneMinima = perfilOmr.fiducialQuietZone;
    const separacionBurbujaQuietZoneMinima =
      2 * (fiducialSizeMinimo / 2 + fiducialQuietZoneMinima) + fiducialMarginMinimo;
    const anchoOmrMinimoSeguro =
      (omrTotalLetras - 1) * omrPasoX + 2 * (omrRadio + separacionBurbujaQuietZoneMinima);
    if (!Number.isFinite(anchoColRespuesta) || anchoColRespuesta < anchoOmrMinimoSeguro) {
      throw new Error(`Perfil OMR canónico inválido: ancho de caja ${String(anchoColRespuesta)}pt`);
    }
    // Reservar solo la separación estrictamente necesaria libera 2 pt de
    // ancho para el texto sin acercarlo al panel OMR ni cambiar su geometría.
    const gutterRespuesta = 6;
    // El panel y su halo blanco deben quedar dentro del borde imprimible.
    // Antes se alineaban con el margen nominal y cruzaban el marco interior.
    const safeRight = ANCHO_CARTA - margen - 7;
    const xColRespuesta = safeRight - anchoColRespuesta;
    const xDerechaTexto = xColRespuesta - gutterRespuesta;

    if (omrEsquemaHorizontal && omrPasoX <= 0) {
      throw new Error('Perfil OMR denso invalido: falta el paso horizontal de las burbujas');
    }

    const xNumeroPregunta = margen;
    // Compactar únicamente el gutter entre la insignia y el texto. Se
    // conserva una separación física de 2.5 pt para evitar contacto visual,
    // mientras el ancho recuperado queda disponible para el reactivo.
    const anchoInsigniaPregunta = 17;
    const xTextoPregunta = margen + 19.5;
    const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

    const instruccionesDefault =
      'Lea detenidamente cada reactivo, razone antes de responder y marque una sola respuesta dentro del círculo. Si cambia, borre por completo la marca anterior.';

    const defaultInstitucion = 'Centro Universitario Hidalguense';
    const defaultLema = 'Sapientia est nostra fortis';

    // Si el examen proporciona una cabecera, la identidad institucional es
    // parte de la plantilla canónica por defecto. Solo se omite cuando el
    // llamador lo solicita explícitamente, evitando que una muestra o
    // generación real pierda escuela, motto, materia y docente por olvidar un
    // booleano auxiliar.
    const mostrarMarcaInstitucional = examen.encabezado
      ? examen.encabezado.mostrarMarcaInstitucional !== false
      : false;
    const institucion = mostrarMarcaInstitucional
      ? String(examen.encabezado?.institucion ?? process.env.EXAMEN_INSTITUCION ?? defaultInstitucion).trim()
      : '';
    const lema = mostrarMarcaInstitucional
      ? String(examen.encabezado?.lema ?? process.env.EXAMEN_LEMA ?? defaultLema).trim()
      : '';
    const materia = mostrarMarcaInstitucional ? String(examen.encabezado?.materia ?? '').trim() : '';
    const docente = mostrarMarcaInstitucional ? String(examen.encabezado?.docente ?? '').trim() : '';
    // La plantilla canónica integra título, identidad institucional y metadatos
    // directamente sobre el fondo geométrico; no crea una caja central independiente.
    const tituloCabecera = examen.titulo;
    const mostrarInstrucciones = examen.encabezado?.mostrarInstrucciones !== false;
    const instrucciones = String(examen.encabezado?.instrucciones ?? '').trim() || instruccionesDefault;
    // La cabecera central tiene un ancho finito entre los dos logos y el QR.
    // Estimar las lineas antes de crear las paginas permite hacerla mas alta
    // solo para contenido largo, sin penalizar la densidad de examenes normales.
    const qrRectXEstimado = ANCHO_CARTA - margen - 4 - perfilOmr.qrSize - perfilOmr.qrPadding * 2;
    const separacionMarcadorQrEstimado = perfilOmr.marcaCuadradoSize + perfilOmr.marcaCuadradoQuietZone + 4;
    // Ampliar la reserva lateral aprovecha el aire de la cabecera sin tocar
    // la columna QR ni el bloque de captura inferior.
    const logoSlotSize = 76;
    const logoDerechoXEstimado = qrRectXEstimado - 6 - logoSlotSize - 4;
    const xTextoHeaderEstimado = margen + logoSlotSize + 23;
    const anchoHeaderCentralEstimado = Math.max(200, logoDerechoXEstimado - 4 - 5 - xTextoHeaderEstimado);
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
      estimarLineasCabecera(institucion, fuenteBold, 14.8 * fontScale) - 1
    ) + Math.max(
      0,
      estimarLineasCabecera(tituloCabecera, fuenteBold, sizeTitulo) - 1
    ) + Math.max(
      0,
      estimarLineasCabecera(lema, fuenteItalica, 10.2 * fontScale) - 1
    ) + Math.max(
      0,
      lineasMetaEstimadas - 1
    );
    // Las indicaciones viven en la banda funcional inferior de la cabecera.
    // Medirlas con el ancho real disponible permite ampliar únicamente las
    // cabeceras excepcionales, evitando tanto el recorte contra el QR como
    // reservar espacio vertical innecesario en exámenes normales.
    const tamIndicacionesEstimado = Math.max(7.5, 6.4 * fontScale);
    const anchoIndicacionesEstimado = Math.max(
      120,
      xDerechaTexto - (margen + 14) - fuenteBold.widthOfTextAtSize('Indicaciones:', tamIndicacionesEstimado) - 5
    );
    const lineasIndicacionesEstimadas = mostrarInstrucciones
      ? partirEnLineas({
        texto: instrucciones,
        maxWidth: anchoIndicacionesEstimado,
        font: fuente,
        size: tamIndicacionesEstimado
      }).length
      : 0;
    // Reservar una fila independiente para los ejemplos evita que una
    // indicación larga comparta renglón con la leyenda visual.
    const espacioEjemplosIndicaciones = mostrarInstrucciones ? 10 : 0;
    // La reserva QR incluye ahora su leyenda dentro de la tarjeta; dejar un
    // margen estructural evita que un perfil personalizado ligeramente mayor
    // salga de la cabecera y termine recortado al rasterizar.
    // La leyenda ocupa la zona de silencio superior del contenedor QR; no
    // reservar una franja adicional evita que el QR robe altura al examen.
    const altoQrTarjetaEstimado = perfilOmr.qrSize + perfilOmr.qrPadding * 2;
    // La primera cabecera debe reservar también las dos filas de la zona de
    // calificación bajo el QR. Sin esta reserva, una cabecera corta podía
    // activar el bloque con altura insuficiente y dejar la segunda fila fuera
    // del marco al validar el layout.
    // Incluye el descenso de la regla inferior y su grosor, no solo las
    // alturas tipográficas de las dos etiquetas.
    const altoZonaCalificacionEstimado = Math.max(6.4, 6.4 * fontScale) + 30;
    // Reducir la reserva base recupera el espacio inferior visible sin tocar
    // logos, QR ni tamaños tipográficos; las cabeceras largas conservan su
    // colchón adicional mediante la rama de 96 pt.
    const baseEncabezadoCompacto = lineasExtraCabecera <= 2 && lineasIndicacionesEstimadas <= 2 ? 87 : 93;
    const altoEncabezadoPrimeraMinimo = Math.max(
      // La fila inferior puede ocupar varias líneas; reservar el interlineado
      // efectivo más un colchón evita que la última línea caiga fuera del
      // header cuando la tipografía sube a 7.5 pt o el texto se envuelve.
      baseEncabezadoCompacto + lineasExtraCabecera * 15 + (
        lineasIndicacionesEstimadas > 0
          ? (lineasIndicacionesEstimadas + 2) * 12 + espacioEjemplosIndicaciones
          : 0
      ),
      // La tarjeta QR se posiciona con una reserva simétrica respecto al
      // fiducial superior derecho. La cabecera debe absorber esa reserva para
      // que el QR quede completamente dentro, aun con el logo ampliado.
      altoQrTarjetaEstimado + separacionMarcadorQrEstimado + altoZonaCalificacionEstimado
    );
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
    const logosOmitidos: string[] = [];
    if (!logoIzquierda) logosOmitidos.push('izquierdo');
    if (!logoDerecha) logosOmitidos.push('derecho');

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
    // El cursor de render nunca puede avanzar hacia arriba por un redondeo:
    // `Math.min` conserva exactamente la regla aplicada al final de cada
    // reactivo y evita que el planificador reserve una fila que luego no cabe.
    const ajustarCursorRender = (y: number) => Math.min(y, snapToGrid(y));

    const markerSpec: MarkerSpecOmr = {
      family: 'solid_square_4pt_v1',
      sizeMm: Number((perfilOmr.fiducialSize / MM_A_PUNTOS).toFixed(2)),
      quietZoneMm: Number((perfilOmr.fiducialQuietZone / MM_A_PUNTOS).toFixed(2))
    };
    const letrasOmr = Array.from({ length: omrTotalLetras }, (_valor, idx) => String.fromCharCode(65 + idx));
    const etiquetaAnchoMaxOmr = Math.max(...letrasOmr.map((letra) => fuente.widthOfTextAtSize(letra, 6.8)));
    const diametroBurbujaOmr = omrRadio * 2;
    const pasoBurbujaX = 0;
    const blockSpec: BlockSpecOmr = {
      preguntasPorBloque: perfilOmr.preguntasPorBloque ?? 10,
      opcionesPorPregunta: perfilOmr.opcionesPorPregunta ?? 5,
      bubbleDiameterMm: Number((diametroBurbujaOmr / MM_A_PUNTOS).toFixed(2)),
      orientation: omrEsquemaHorizontal ? 'horizontal' : 'vertical',
      bubblePitchXmm: Number((omrPasoX / MM_A_PUNTOS).toFixed(2)),
      bubblePitchYmm: Number((omrPasoY / MM_A_PUNTOS).toFixed(2)),
      labelToBubbleMm: Number((perfilOmr.labelToBubbleMm ?? 5).toFixed(2)),
      bubbleStrokePt: Number((perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke).toFixed(2))
    };
    const engineHints: EngineHintsOmr = {
      preferredEngine: 'cv',
      enableClahe: true,
      adaptiveThreshold: true,
      conservativeDecision: true,
      // El mapa conserva coordenadas PDF, pero el detector debe poder usar QR
      // y fiduciales para rectificar fotografías con perspectiva. Forzar una
      // escala simple degrada precisamente ese caso de uso.
      forceSimpleScale: false,
      // La escala global queda como respaldo explícito si la captura no aporta
      // una geometría confiable; no debe ser la ruta nominal de la plantilla.
      useMapCoordinatesStrict: false
    };

    const paginasMeta: ResultadoGeneracionPdf['paginas'] = [];
    const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
    const paginasOmr: PaginaOmr[] = [];
    const lineHeightViolations: Array<{ pagina: number; preguntaId: string; lineHeight: number; min: number }> = [];
    let minLineHeightApplied = Number.POSITIVE_INFINITY;

    // Las indicaciones forman parte del encabezado en la plantilla v4; no
    // reservar una caja independiente que consuma una franja completa.
    const indicacionesPendientes = false;
    const maxWidthIndicaciones = Math.max(120, xDerechaTexto - (margen + 10));

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
      // El fondo teñido ocupa toda la hoja para eliminar zonas blancas
      // accidentales; las tarjetas QR y OMR se pintan después en blanco para
      // conservar contraste y robustez de detección.
      page.drawRectangle({
        x: 0,
        y: 0,
        width: ANCHO_CARTA,
        height: ALTO_CARTA,
        color: colorFondoPagina
      });
      let qrTextoPagina = examen.generarTextoQrPagina(numeroPagina);

      let preguntasDel = 0;
      let preguntasAl = 0;
      const mapaPagina: PaginaOmr['preguntas'] = [];
      const headerTextBlocks: Array<{ x: number; y: number; width: number; height: number; id: string }> = [];
      const continuationTextBlocks: Array<{ x: number; y: number; width: number; height: number; id: string }> = [];
      const headerSlotBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const headerIconBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const headerFieldBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const questionBlockBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const questionBackgroundBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const questionPromptBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const omrPanelBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
      const collisionBoxes: Array<{ pagina: number; a: string; b: string }> = [];
      let rectIndicaciones: RectBox | undefined;
      let rectContinuacion: RectBox | undefined;

      const yTop = ALTO_CARTA - margen;
      const yTopContinuacionSeguro = yTop
        - perfilOmr.marcaCuadradoSize
        - perfilOmr.marcaCuadradoQuietZone
        - 6;
      const esPrimera = numeroPagina === 1;
      const altoEncabezado = esPrimera ? Math.max(headerHeightFirst, altoEncabezadoPrimeraMinimo) : headerHeightOther;
      const xCaja = margen + 4;
      const wCaja = ANCHO_CARTA - 2 * margen - 8;
      const yCaja = yTop - altoEncabezado;

      // El cuerpo conserva el fondo cromático y sus adornos, pero una veladura
      // blanca muy ligera reduce la cobertura continua sobre el papel. La
      // cabecera de la primera página queda fuera de esta zona y no cambia.
      const rectCuerpoAhorro: RectBox = {
        x: xCaja + 1,
        y: margen + 1,
        width: Math.max(1, wCaja - 2),
        height: Math.max(1, (esPrimera ? yCaja - 1.2 : yTop - 1.2) - (margen + 1))
      };
      page.drawRectangle({
        ...rectCuerpoAhorro,
        color: rgb(1, 1, 1),
        opacity: 0.34,
        borderWidth: 0
      });
      dibujarOrnamentoPunteadoCuerpo(page, rectCuerpoAhorro, colorAcento);

      // El texto se dibuja desde la linea base hacia arriba; dejar solo 8 pt
      // despues del encabezado permite que el primer glifo invada su borde.
      let yFinHeaderPrimera = yCaja - separacionCabeceraContenido;
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
        dibujarPatronPunteadoEncabezado(
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
        // conserva el mismo fondo cromático de toda la cabecera. El blanco
        // semitransparente anterior ocultaba el patrón y dejaba una isla
        // blanca visible debajo de las indicaciones.
        page.drawRectangle({
          x: xCaja + 1,
          y: yCaja + 7,
          width: wCaja - 2,
          height: 42,
          color: colorSeccion,
          opacity: 0.58
        });
        page.drawRectangle({
          x: xCaja + 1,
          y: yCaja + 7,
          width: 3.5,
          height: 42,
          color: colorAcento,
          opacity: 0.88
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

      // El marco decorativo debe quedar debajo de los fiduciales. Dibujarlo
      // despues podia atravesar su quiet zone y convertir el borde en una
      // falsa prolongacion del cuadrado durante la rectificacion CV.
      dibujarBordePagina(page, margen, colorLinea, colorAcento);
      agregarMarcasRegistro(page, margen, perfilOmr);
      let qrInfo = await agregarQr(
        pdfDoc,
        page,
        qrTextoPagina,
        margen,
        perfilOmr
      );
      const { x: xQr, y: yQr, padding: qrPadding, qrSize, cardX, cardY, cardW, cardH } = qrInfo;
      let usarZonaCalificacion = false;
      // La zona de calificación debe quedar debajo del QR y a la derecha de
      // la línea de grupo; iniciar solo 6 pt antes de la tarjeta evita que su
      // etiqueta se confunda con el renglón manuscrito.
      const xLimiteZonaCalificacion = Math.max(xCaja + 8, cardX - 6);
      // La sección compacta requiere solo dos filas bajo el QR. El umbral
      // reducido conserva ese bloque aun cuando la cabecera se comprime.
      if (esPrimera && cardY - yCaja - 2 >= 23) {
        // El espacio libre bajo la tarjeta QR se convierte en zona de
        // calificación. Cubrir el patrón complejo anterior evita que el
        // mandala se confunda con texto; encima solo se dibuja una retícula
        // de puntos tenue. La tarjeta y su quiet zone siguen blancas.
        const xZonaCalificacionInicio = Math.max(xCaja + 1, xLimiteZonaCalificacion);
        const zonaCalificacion: RectBox = {
          x: xZonaCalificacionInicio,
          y: yCaja + 1,
          width: Math.max(1, xCaja + wCaja - 1 - xZonaCalificacionInicio),
          height: cardY - yCaja - 2
        };
        usarZonaCalificacion = true;
        page.drawRectangle({
          ...zonaCalificacion,
          color: colorSeccion,
          opacity: 0.72,
          borderWidth: 0.65,
          borderColor: colorLinea
        });
        dibujarPatronBloqueCaptura(page, zonaCalificacion, colorAcento, []);
      }
      const rectHeader: RectBox = { x: xCaja, y: yCaja, width: wCaja, height: altoEncabezado };
      const rectQr: RectBox = {
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH
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
        // La coordenada persistida es el vértice exterior del marcador. Tanto
        // las líneas como los cuadrados abren hacia el interior de la hoja.
        tl: { x: margen, y: ALTO_CARTA - margen },
        tr: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
        bl: { x: margen, y: margen },
        br: { x: ANCHO_CARTA - margen, y: margen }
      };

      const folioQr = examen.folioNormalizado;

      // No se dibuja una caja de separación en páginas de continuación. La
      // identificación ya está en el QR/folio y eliminar la banda superior
      // recupera espacio útil sin alterar la reserva física del QR.
      const limiteContenidoContinuacion = Number.POSITIVE_INFINITY;

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
        // Logotipos ligeramente mayores, manteniendo una reserva explícita
        // para que nunca invadan el texto central ni el QR.
        const logoSlotWidth = logoSlotSize;
        const logoSlotHeight = logoSlotSize;
        const xTextoHeader = logoSlotLeftX + logoSlotWidth + 4;
        const qrSlotLeft = rectQr.x - 6;
        const logoDerechoSlotWidth = logoSlotWidth;
        const logoDerechoSlotX = qrSlotLeft - logoDerechoSlotWidth - 4;
        const xMaxEnc = logoDerechoSlotX - 4;
        // El ancho tipografico no debe consumir todo el slot central: un
        // encabezado largo necesita aire antes del logo derecho y antes del
        // borde del panel. El inset tambien evita que el rasterizador haga
        // parecer que el ultimo glifo invade la reserva vecina.
        const headerTextInset = 5;
        const xTextoHeaderInner = xTextoHeader + headerTextInset;
        const xMaxHeaderInner = xMaxEnc - headerTextInset;
        // Los datos que debe llenar la persona ocupan una banda propia y
        // continua. Antes estaban confinados al panel central y dejaban una
        // franja vacía bajo el logo izquierdo; además, una etiqueta larga
        // podía quedar recortada al calcular la línea desde xTextoHeader.
        const xDatosLeft = xCaja + 14;
        const xDatosRight = rectQr.x - 12;
        const maxWidthEnc = Math.max(200, xMaxHeaderInner - xTextoHeaderInner);
        const xCentroHeader = xTextoHeaderInner + maxWidthEnc / 2;
        const innerTop = yTop - PLANTILLA_PX.headerPadTop;
        const innerBottom = yCaja + PLANTILLA_PX.headerPadBottom;
        const xTextoCentrado = (texto: string, font: PDFFont, size: number) => {
          const ancho = font.widthOfTextAtSize(texto, size);
          const xObjetivo = xCentroHeader - ancho / 2;
          return Math.max(xTextoHeaderInner, Math.min(xMaxHeaderInner - ancho, xObjetivo));
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
        let sizeInst = 14.2 * fontScale;
        let sizeTit = sizeTitulo;
        let sizeLem = 10 * fontScale;
        let sizeMetaEsc = sizeMeta;
        let sizeCampo = 9.6 * fontScale;
        let metaLineGap: number = PLANTILLA_PX.metaLine;
        let yInsti = innerTop - sizeInst;
        let yTitulo = yInsti;
        let yLema = yTitulo;
        let yMeta = yLema;
        let yMetaUltima = yMeta;

        for (let i = 0; i < 8; i += 1) {
          sizeInst = 14.8 * fontScale * escala;
          sizeTit = sizeTitulo * escala;
          sizeLem = 10.2 * fontScale * escala;
          sizeMetaEsc = sizeMeta * escala;
          sizeCampo = 10.6 * fontScale * escala;
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
          yMetaUltima = yMetaUlt;
          const yNombreCalculado = yMetaUlt - (sizeCampo + 1 + PLANTILLA_PX.camposGapTop * escala);
           // Los campos de captura comparten una sola línea: el grupo conserva
           // una reserva corta para cuatro letras manuscritas y el resto queda
           // disponible para el nombre del alumno.
          const yLimiteSuperiorCampos = yMetaUlt - 10 - 4;
          // En la cabecera institucional las indicaciones ya tienen una
          // banda propia debajo de los campos. No desplazar nombre/grupo
          // hacia el borde inferior al aumentar el texto: la altura extra de
          // la cabecera debe absorber las líneas adicionales. La reserva se
          // conserva para la variante sin identidad institucional, donde la
          // banda de indicaciones comparte el panel funcional.
          const reservaIndicacionesCampos = mostrarMarcaInstitucional
            ? 0
            : Math.max(0, lineasIndicacionesEstimadas - 1)
              * (Math.max(7.5, 6.1 * fontScale) + 1.2);
          yNombre = Math.min(
            yNombreCalculado,
            yLimiteSuperiorCampos - sizeCampo - 1 - reservaIndicacionesCampos
          );
           yGrupo = yNombre;

           if (yGrupo >= innerBottom + 1) {
             break;
           }
           escala = Math.max(0.78, escala - 0.06);
         }

         // Anclar la fila de captura a la banda inferior de la cabecera deja
         // libre la zona institucional superior. La reserva usa el número
         // estimado de líneas de indicaciones.
         const lineGapIndicacionesEstimado = Math.max(7.5, 6.4 * fontScale) + 1.2;
         // La fila de instrucciones necesita una separación completa aun
         // cuando no se dibuja la identidad institucional.
         const separacionDatosIndicaciones = 17;
         const yCamposInferior = yCaja
           + 1
           + Math.max(0, lineasIndicacionesEstimadas - 1) * lineGapIndicacionesEstimado
           + espacioEjemplosIndicaciones
           + separacionDatosIndicaciones;
         yNombre = Math.min(yNombre, yCamposInferior);
         yGrupo = yNombre;

         // En perfiles con tipografía ampliada puede no existir separación
         // vertical suficiente entre la fila de captura y la zona bajo el QR.
         // En ese caso se usa el respaldo de una sola fila para no superponer
         // la etiqueta de calificación con la línea de grupo.
         // Separar la regla inferior del panel central del ultimo metadato evita
        // que el texto de Docente parezca atravesado al rasterizar a 300 DPI.
        const panelCentralBottom = mostrarMarcaInstitucional ? yMetaUltima - 10 : yCaja + 50;
        const logoY = innerTop - logoSlotHeight - 2;
        // La identidad institucional se compone directamente sobre el fondo
        // geométrico. No dibujar una caja central independiente evita que el
        // encabezado vuelva a parecer fragmentado o genere bordes falsos.
        // La fila de indicaciones ocupa una línea propia debajo de los campos
        // de captura institucionales. Extender la banda unos puntos evita
        // que el texto quede partido entre fondo y margen inferior.
        const fieldBandBottom = yGrupo - (mostrarMarcaInstitucional ? 17 : 6);
        const fieldBandTopBase = Math.min(panelCentralBottom - 1, logoY - 7);
        const etiquetaNombre = 'Nombre del alumno:';
        const etiquetaGrupo = 'Grupo:';
        const anchoEtiquetaNombre = fuenteBold.widthOfTextAtSize(etiquetaNombre, sizeCampo);
        const anchoEtiquetaGrupo = fuenteBold.widthOfTextAtSize(etiquetaGrupo, sizeCampo);
        const iconoCapturaX = xDatosLeft;
         const xEtiquetasCaptura = xDatosLeft + 14;
         const xLineaNombre = xEtiquetasCaptura + anchoEtiquetaNombre + 8;
         const anchoCampoGrupo = 42;
         const xLineaGrupoFin = xDatosRight;
         const xLineaGrupo = xLineaGrupoFin - anchoCampoGrupo;
         const xEtiquetasGrupo = xLineaGrupo - anchoEtiquetaGrupo - 8;
         const xIconoGrupo = xEtiquetasGrupo - 14;
         const xAuxiliarFallback = xLineaNombre + 48;
         // En la variante sin espacio bajo el QR, la información auxiliar
         // comparte la fila como respaldo; se acorta solo la línea manuscrita
         // del nombre para que todos los campos permanezcan dentro del marco.
         const xLineaNombreFin = usarZonaCalificacion
           ? xIconoGrupo - 8
           : Math.min(xIconoGrupo - 8, xAuxiliarFallback - 8);
         if (xLineaNombreFin <= xLineaNombre + 30) {
           throw new Error('Layout invalido: no queda espacio suficiente para el nombre y el grupo en una sola linea');
         }
        if (fieldBandTopBase > fieldBandBottom) {
          // No usar un relleno continuo: la textura punteada conserva la
          // estética de la cabecera y reduce tinta en la zona manuscrita.
          const rectPatronCaptura: RectBox = {
            x: xDatosLeft - 6,
            y: fieldBandBottom,
            width: Math.max(120, xDatosRight - xDatosLeft + 12),
            height: fieldBandTopBase - fieldBandBottom
          };
          const exclusionesPatronCaptura: RectBox[] = [
            // Las etiquetas pueden convivir con una textura tenue; las
            // líneas de escritura no. Así el bloque completo deja de verse
            // plano sin sacrificar la zona donde se escribe a mano.
            {
              x: xLineaNombre - 2,
              y: yNombre + PLANTILLA_PX.campoLineOffsetY - 2.6,
              width: xLineaNombreFin - xLineaNombre + 4,
              height: 4.4
            },
            {
              x: xLineaGrupo - 2,
              y: yGrupo + PLANTILLA_PX.campoLineOffsetY - 2.6,
              width: xLineaGrupoFin - xLineaGrupo + 4,
              height: 4.4
            },
          ];
          dibujarPatronBloqueCaptura(page, rectPatronCaptura, colorAcento, exclusionesPatronCaptura);
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
          id: string,
          negrita = false,
          cursiva = false
        ) => {
          lineas.forEach((linea, indice) => {
            const yLinea = yInicial - indice * lineGap;
            const xLinea = xTextoCentrado(linea, font, size);
            const inclinacion = cursiva ? { ySkew: degrees(10) } : {};
            page.drawText(linea, { x: xLinea, y: yLinea, size, font, color, ...inclinacion });
            if (negrita) {
              // Ecofont solo dispone de regular; el segundo trazo desplazado
              // aporta peso visual sin introducir otra familia tipográfica.
              page.drawText(linea, { x: xLinea + 0.22, y: yLinea, size, font, color, ...inclinacion });
            }
            headerTextBlocks.push({
              id: `${id}-${indice + 1}`,
              x: xLinea,
              y: yLinea,
              width: font.widthOfTextAtSize(linea, size),
              height: size + 1
            });
          });
        };

        if (mostrarMarcaInstitucional) {
          dibujarLineasCabecera(instiLineas, yInsti, sizeInst + 1.2, fuenteBold, sizeInst, colorInstitucion, 'institucion', true);
          dibujarLineasCabecera(lemLineas, yLema, sizeLem + 1.1, fuenteItalica, sizeLem, colorPrimario, 'lema', false, true);
        }

        // El título sí es funcional para identificar el examen, pero no
        // reintroduce la identidad institucional retirada de la plantilla.
        dibujarLineasCabecera(titLineas, yTitulo, sizeTit + 1.2, fuenteBold, sizeTit, colorPrimario, 'titulo', true);

        if (mostrarMarcaInstitucional) metaLineas.forEach((linea, indice) => {
          if (!linea) return;
          const yLinea = yMeta - indice * metaLineGap;
          const esMateria = linea.startsWith('Materia:');
          const fuenteMeta = esMateria ? fuenteBold : fuente;
          const xMeta = xTextoCentrado(linea, fuenteMeta, sizeMetaEsc);
          page.drawText(linea, {
            x: xMeta,
            y: yLinea,
            size: sizeMetaEsc,
            font: fuenteMeta,
            color: colorGris
          });
          if (esMateria) {
            // Ecofont solo se embebe en regular; este segundo trazo compacto
            // aplica negrita visual sin cambiar de familia tipográfica.
            page.drawText(linea, {
              x: xMeta + 0.22,
              y: yLinea,
              size: sizeMetaEsc,
              font: fuenteMeta,
              color: colorGris
            });
          }
          headerTextBlocks.push({
            id: `meta-${indice + 1}`,
            x: xMeta,
            y: yLinea,
            width: fuenteMeta.widthOfTextAtSize(linea, sizeMetaEsc),
            height: sizeMetaEsc + 1
          });
        });

        headerIconBoxes.push({ id: 'icono-alumno', ...dibujarIconoPersona(page, iconoCapturaX, yNombre + 0.4, colorIconoAlumno) });
        page.drawText(etiquetaNombre, { x: xEtiquetasCaptura, y: yNombre, size: sizeCampo, font: fuenteBold, color: colorPrimario });
        headerTextBlocks.push({
          id: 'nombre-etiqueta',
          x: xEtiquetasCaptura,
          y: yNombre,
          width: fuenteBold.widthOfTextAtSize(etiquetaNombre, sizeCampo),
          height: sizeCampo + 1
        });
        page.drawLine({
          start: { x: xLineaNombre, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          end: { x: xLineaNombreFin, y: yNombre + PLANTILLA_PX.campoLineOffsetY },
          color: colorLinea,
          thickness: 0.8
        });
        headerFieldBoxes.push({
          id: 'nombre-linea',
          x: xLineaNombre,
          y: yNombre + PLANTILLA_PX.campoLineOffsetY - 0.4,
          width: Math.max(0, xLineaNombreFin - xLineaNombre),
          height: 0.8
        });
         headerIconBoxes.push({ id: 'icono-grupo', ...dibujarIconoGrupo(page, xIconoGrupo, yGrupo + 0.4, colorIconoGrupo) });
         page.drawText(etiquetaGrupo, { x: xEtiquetasGrupo, y: yGrupo, size: sizeCampo, font: fuenteBold, color: colorPrimario });
         headerTextBlocks.push({
           id: 'grupo-etiqueta',
           x: xEtiquetasGrupo,
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

        if (mostrarMarcaInstitucional && docente) {
          const indiceDocente = metaLineas.findIndex((linea) => linea.startsWith('Docente:'));
          if (indiceDocente >= 0) {
            const lineaDocente = metaLineas[indiceDocente] ?? '';
            const xDocente = xTextoCentrado(lineaDocente, fuente, sizeMetaEsc);
            headerIconBoxes.push({
              id: 'icono-docente',
              ...dibujarIconoDocente(page, xDocente - 16, yMeta - indiceDocente * metaLineGap + 0.8, colorIconoDocente)
            });
          }
        }

        // La zona bajo el QR concentra el conteo de reactivos y la
        // calificación. Mantenerlos aquí elimina una fila saturada a la
        // izquierda y aprovecha un espacio que antes solo tenía decoración.
        if (usarZonaCalificacion) {
        const sizeCampoAux = Math.max(6.4, 6.4 * fontScale);
        const xZonaCalificacion = xLimiteZonaCalificacion;
        const xZonaCalificacionFin = xCaja + wCaja - 8;
        // Dos filas compactas conservan ambos campos bajo el QR y recuperan
        // el espacio horizontal que antes se desperdiciaba dentro de su tarjeta.
        // Anclar las dos filas a la base de la cabecera deja libre la franja
        // superior para nombre y grupo. El marco conserva toda la reserva
        // vertical bajo el QR, pero el contenido ya no queda flotando cerca
        // de su borde superior.
        const yCalificacionZona = yCaja + 5.5;
        const yReactivosZonaCalificacion = yCalificacionZona + 11.5;
        const etiquetaReactivos = 'Reactivos:';
        const textoConteoReactivos = `/ ${examen.totalPreguntas}`;
        const anchoEtiquetaReactivos = fuenteBold.widthOfTextAtSize(etiquetaReactivos, sizeCampoAux);
        const xLineaReactivos = xZonaCalificacion + anchoEtiquetaReactivos + 3;
        const anchoConteoReactivos = fuente.widthOfTextAtSize(textoConteoReactivos, sizeCampoAux);
        const xConteoReactivos = Math.min(xZonaCalificacionFin - anchoConteoReactivos, xLineaReactivos + 23);
        const xLineaReactivosFin = xConteoReactivos - 3;
        const etiquetaCalificacion = 'Calificación (0-5):';
        const anchoEtiquetaCalificacion = fuenteBold.widthOfTextAtSize(etiquetaCalificacion, sizeCampoAux);
        // La regla continúa a la derecha de la etiqueta, como un campo de
        // captura convencional; antes quedaba debajo del texto y parecía
        // tacharlo al rasterizar la cabecera.
        const xLineaCalificacion = xZonaCalificacion + anchoEtiquetaCalificacion + 3;
        const xLineaCalificacionFin = xZonaCalificacionFin;
        if (
          xLineaReactivosFin <= xLineaReactivos
          || xConteoReactivos + anchoConteoReactivos > xZonaCalificacionFin
          || xLineaCalificacionFin <= xLineaCalificacion
        ) {
          throw new Error('Layout invalido: la zona de calificacion no tiene espacio suficiente');
        }
        page.drawText(etiquetaReactivos, {
          x: xZonaCalificacion,
          y: yReactivosZonaCalificacion,
          size: sizeCampoAux,
          font: fuenteBold,
          color: colorPrimario
        });
        headerTextBlocks.push({
          id: 'reactivos-etiqueta',
          x: xZonaCalificacion,
          y: yReactivosZonaCalificacion,
          width: anchoEtiquetaReactivos,
          height: sizeCampoAux + 1
        });
        page.drawLine({
          start: { x: xLineaReactivos, y: yReactivosZonaCalificacion - 2.8 },
          end: { x: xLineaReactivosFin, y: yReactivosZonaCalificacion - 2.8 },
          color: colorLinea,
          thickness: 0.8
        });
        headerFieldBoxes.push({
          id: 'reactivos-linea',
          x: xLineaReactivos,
          y: yReactivosZonaCalificacion - 3.2,
          width: Math.max(0, xLineaReactivosFin - xLineaReactivos),
          height: 0.8
        });
        page.drawText(textoConteoReactivos, {
          x: xConteoReactivos,
          y: yReactivosZonaCalificacion,
          size: sizeCampoAux,
          font: fuente,
          color: colorGris
        });
        headerTextBlocks.push({
          id: 'conteo-reactivos',
          x: xConteoReactivos,
          y: yReactivosZonaCalificacion,
          width: anchoConteoReactivos,
          height: sizeCampoAux + 1
        });
        page.drawText(etiquetaCalificacion, {
          x: xZonaCalificacion,
          y: yCalificacionZona,
          size: sizeCampoAux,
          font: fuenteBold,
          color: colorPrimario
        });
        headerTextBlocks.push({
          id: 'calificacion-etiqueta',
          x: xZonaCalificacion,
          y: yCalificacionZona,
          width: anchoEtiquetaCalificacion,
          height: sizeCampoAux + 1
        });
        page.drawLine({
          start: { x: xLineaCalificacion, y: yCalificacionZona - 3.2 },
          end: { x: xLineaCalificacionFin, y: yCalificacionZona - 3.2 },
          color: colorLinea,
          thickness: 0.8
        });
        headerFieldBoxes.push({
          id: 'calificacion-linea',
          x: xLineaCalificacion,
          y: yCalificacionZona - 3.2,
          width: Math.max(0, xLineaCalificacionFin - xLineaCalificacion),
          height: 0.8
        });
        } else {
          // Cabeceras compactas sin espacio bajo el QR conservan los campos
          // en la fila izquierda; así el contenido sigue disponible en todos
          // los perfiles sin forzar texto fuera del encabezado.
           const sizeCampoAux = Math.max(4, 4.2 * fontScale);
           const etiquetaReactivos = 'Reactivos:';
           const xEtiquetaReactivos = xAuxiliarFallback;
          const anchoEtiquetaReactivos = fuenteBold.widthOfTextAtSize(etiquetaReactivos, sizeCampoAux);
          const xLineaReactivos = xEtiquetaReactivos + anchoEtiquetaReactivos + 4;
           const xLineaReactivosFin = Math.min(xDatosRight, xLineaReactivos + 12);
          const textoConteoReactivos = `/ ${examen.totalPreguntas} reactivos`;
          const anchoTextoConteoReactivos = fuente.widthOfTextAtSize(textoConteoReactivos, sizeCampoAux);
          const xConteoReactivos = xLineaReactivosFin + 4;
           const xEtiquetaCalificacion = xConteoReactivos + anchoTextoConteoReactivos + 6;
          const etiquetaCalificacion = 'Calificación (0-5):';
          const anchoEtiquetaCalificacion = fuenteBold.widthOfTextAtSize(etiquetaCalificacion, sizeCampoAux);
           const xLineaCalificacion = xEtiquetaCalificacion;
           const xLineaCalificacionFin = Math.min(xIconoGrupo - 8, xLineaCalificacion + 24);
          page.drawText(etiquetaReactivos, { x: xEtiquetaReactivos, y: yGrupo, size: sizeCampoAux, font: fuenteBold, color: colorPrimario });
          headerTextBlocks.push({ id: 'reactivos-etiqueta', x: xEtiquetaReactivos, y: yGrupo, width: anchoEtiquetaReactivos, height: sizeCampoAux + 1 });
          page.drawLine({ start: { x: xLineaReactivos, y: yGrupo + PLANTILLA_PX.campoLineOffsetY }, end: { x: xLineaReactivosFin, y: yGrupo + PLANTILLA_PX.campoLineOffsetY }, color: colorLinea, thickness: 0.8 });
          headerFieldBoxes.push({ id: 'reactivos-linea', x: xLineaReactivos, y: yGrupo + PLANTILLA_PX.campoLineOffsetY - 0.4, width: Math.max(0, xLineaReactivosFin - xLineaReactivos), height: 0.8 });
          page.drawText(textoConteoReactivos, { x: xConteoReactivos, y: yGrupo, size: sizeCampoAux, font: fuente, color: colorGris });
          headerTextBlocks.push({ id: 'conteo-reactivos', x: xConteoReactivos, y: yGrupo, width: anchoTextoConteoReactivos, height: sizeCampoAux + 1 });
          page.drawText(etiquetaCalificacion, { x: xEtiquetaCalificacion, y: yGrupo, size: sizeCampoAux, font: fuenteBold, color: colorPrimario });
          headerTextBlocks.push({ id: 'calificacion-etiqueta', x: xEtiquetaCalificacion, y: yGrupo, width: anchoEtiquetaCalificacion, height: sizeCampoAux + 1 });
          page.drawLine({ start: { x: xLineaCalificacion, y: yGrupo + PLANTILLA_PX.campoLineOffsetY }, end: { x: xLineaCalificacionFin, y: yGrupo + PLANTILLA_PX.campoLineOffsetY }, color: colorLinea, thickness: 0.8 });
          headerFieldBoxes.push({ id: 'calificacion-linea', x: xLineaCalificacion, y: yGrupo + PLANTILLA_PX.campoLineOffsetY - 0.4, width: Math.max(0, xLineaCalificacionFin - xLineaCalificacion), height: 0.8 });
        }
        if (mostrarInstrucciones && instrucciones.length > 0) {
          // La etiqueta y el texto comparten una banda horizontal. El texto
          // se envuelve usando el ancho restante después de la etiqueta; el
          // cálculo anterior medía el ancho total y luego recortaba la primera
          // línea contra el QR en cabeceras largas.
          const etiquetaIndicaciones = 'Indicaciones:';
          // La fila inferior tiene ancho y altura propios para mostrar las
          // instrucciones completas también en la cabecera institucional.
          // Ya no se sustituye el texto por una leyenda breve: el alumno debe
          // recibir todas las reglas de marcado en la misma hoja.
          const textoIndicacionesHeader = instrucciones;
          const xIndicacionesBase = xDatosLeft;
          const xIndicacionesHeader = xIndicacionesBase + 14;
          const tamIndicacionesHeader = Math.max(7.5, 6.4 * fontScale);
          const anchoEtiquetaIndicaciones = fuenteBold.widthOfTextAtSize(etiquetaIndicaciones, tamIndicacionesHeader);
          const xTextoIndicacionesHeader = xIndicacionesHeader + anchoEtiquetaIndicaciones + 5;
          const xDerechaIndicaciones = usarZonaCalificacion
            ? Math.min(xDatosRight, xLimiteZonaCalificacion - 6)
            : xDatosRight;
          const anchoIndicacionesHeader = xDerechaIndicaciones - xTextoIndicacionesHeader - 4;
          if (anchoIndicacionesHeader < 50) {
            throw new Error('Layout invalido: la cabecera no tiene ancho suficiente para las indicaciones');
          }
          const lineGapIndicacionesHeader = tamIndicacionesHeader + 1.2;
          const lineasIndicacionesHeader = partirEnLineas({
            texto: textoIndicacionesHeader,
            maxWidth: anchoIndicacionesHeader,
            font: fuente,
            size: tamIndicacionesHeader
          });
          // Normalizar las líneas físicas antes de posicionarlas evita que un
          // subenvolvimiento de una línea larga se dibuje sobre la siguiente.
          const lineasFisicasIndicaciones = lineasIndicacionesHeader.flatMap((linea, indice) => {
            const xLineaIndicaciones = indice === 0 ? xTextoIndicacionesHeader : xIndicacionesHeader;
            const anchoLineaDisponible = indice === 0
              ? anchoIndicacionesHeader
              : xDerechaIndicaciones - xIndicacionesHeader - 4;
            const lineasFisicas = indice === 0
              ? [linea]
              : partirEnLineas({
                texto: linea,
                maxWidth: anchoLineaDisponible,
                font: fuente,
                size: tamIndicacionesHeader
              });
            return lineasFisicas.map((lineaFisica, subIndice) => ({
              texto: lineaFisica,
              x: subIndice === 0 ? xLineaIndicaciones : xIndicacionesHeader
            }));
          });
          // La última línea textual queda encima de una fila propia para la
          // leyenda, y esa fila sí se apoya en el límite inferior del marco.
          const yIndicacionesHeader = yCaja
            + 1
            + espacioEjemplosIndicaciones
            + Math.max(0, lineasFisicasIndicaciones.length - 1) * lineGapIndicacionesHeader;
          headerIconBoxes.push({
            id: 'icono-indicaciones',
            ...dibujarIconoIndicaciones(page, xIndicacionesBase, yIndicacionesHeader + 0.2, colorIconoIndicaciones)
          });
          page.drawText(etiquetaIndicaciones, {
            x: xIndicacionesHeader,
            y: yIndicacionesHeader,
            size: tamIndicacionesHeader,
            font: fuenteBold,
            color: colorAcento
          });
          headerTextBlocks.push({
            id: 'indicaciones-etiqueta',
            x: xIndicacionesHeader,
            y: yIndicacionesHeader,
            width: anchoEtiquetaIndicaciones,
            height: tamIndicacionesHeader + 1
          });
          lineasFisicasIndicaciones.forEach(({ texto, x }, indice) => {
              const yLinea = yIndicacionesHeader - indice * lineGapIndicacionesHeader;
              page.drawText(texto, {
                x,
                y: yLinea,
                size: tamIndicacionesHeader,
                font: fuente,
                color: colorTinta
              });
              headerTextBlocks.push({
                id: `indicaciones-${indice + 1}`,
                x,
                y: yLinea,
                width: fuente.widthOfTextAtSize(texto, tamIndicacionesHeader),
                height: tamIndicacionesHeader + 1
              });
          });
          const yUltimaIndicacion = yCaja + 1;
          const anchoEjemplosMarca = 100;
          const xEjemplosMarca = xDerechaIndicaciones - anchoEjemplosMarca;
          const rectEjemplosMarca = dibujarEjemplosMarca(
            page,
            xEjemplosMarca,
            yUltimaIndicacion,
            fuente,
            5.4
          );
          headerTextBlocks.push({
            id: 'ejemplos-marca',
            ...rectEjemplosMarca
          });
        }

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
          } else {
            logosOmitidos.push('derecho');
          }
        }

        yFinHeaderPrimera = Math.min(yCaja - separacionCabeceraContenido, yGrupo - 10);
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
        assertRectContenida(field, rectHeader, `campo ${field.id} de la cabecera de la pagina ${numeroPagina}`);
        if (rectInterseca(field, rectQr)) {
          collisionBoxes.push({ pagina: numeroPagina, a: field.id, b: 'qr' });
        }
        for (const textBlock of headerTextBlocks) {
          if (rectInterseca(field, textBlock)) {
            collisionBoxes.push({ pagina: numeroPagina, a: field.id, b: textBlock.id });
          }
        }
      }
      for (const icon of headerIconBoxes) {
        assertRectContenida(icon, rectHeader, `icono ${icon.id} de la cabecera de la pagina ${numeroPagina}`);
        if (rectInterseca(icon, rectQr)) {
          collisionBoxes.push({ pagina: numeroPagina, a: icon.id, b: 'qr' });
        }
        for (const other of headerIconBoxes) {
          if (other.id !== icon.id && rectInterseca(icon, other)) {
            collisionBoxes.push({ pagina: numeroPagina, a: icon.id, b: other.id });
          }
        }
        for (const textBlock of headerTextBlocks) {
          if (rectInterseca(icon, textBlock)) {
            collisionBoxes.push({ pagina: numeroPagina, a: icon.id, b: textBlock.id });
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
        ? Math.min(yFinHeaderPrimera, yCaja - separacionCabeceraContenido)
        // La primera pregunta de una continuación usa la zona izquierda junto
        // al QR. Su panel permanece debajo del QR, en la columna derecha; así
        // se aprovecha la franja superior sin superponer reservas.
         : !omrEsquemaHorizontal
           ? Math.min(yTop - 8, rectQr.y + 8, limiteContenidoContinuacion)
           : Math.min(yTopContinuacionSeguro, limiteContenidoContinuacion);
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
      const separacionColumnaImagen = 8;
      const calcularLayoutImagen = (emb: LogoEmbed | undefined, anchoDisponible: number) => {
        if (!emb) return undefined;
        const maxW = Math.min(maxImagenPreguntaAncho, anchoDisponible * 0.42);
        const escala = Math.min(1, maxW / emb.width, maxImagenPreguntaAlto / emb.height);
        const width = emb.width * escala;
        const height = emb.height * escala;
        const anchoTexto = anchoDisponible - width - separacionColumnaImagen;
        // La columna lateral solo se usa si mantiene una medida de lectura
        // razonable; en anchos estrechos la imagen vuelve debajo del texto.
        return {
          width,
          height,
          anchoTexto,
          lateral: anchoTexto >= Math.max(180, anchoDisponible * 0.48)
        };
      };

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
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion) + 3;
        if (omrEsquemaHorizontal && totalOpciones === 5) {
          const indicePrincipal = ordenOpciones.reduce((mejor, indiceOpcion) => {
            const actual = String(pregunta.opciones[indiceOpcion]?.texto ?? '').length;
            const anterior = String(pregunta.opciones[mejor]?.texto ?? '').length;
            return actual > anterior ? indiceOpcion : mejor;
          }, ordenOpciones[0] ?? 0);
          const longitudPrincipal = String(pregunta.opciones[indicePrincipal]?.texto ?? '').length;
           // Mantener el orden natural A-B-C-D-E para opciones ricas. Solo una
           // respuesta excepcionalmente extensa merece ocupar una fila propia;
           // con textos normales, promover la opción más larga desordena la
           // lectura y hace parecer que los fondos están desalineados.
           if (longitudPrincipal >= 90) {
            const lineasPrincipal = envolverTextoMixto({
              texto: String(pregunta.opciones[indicePrincipal]?.texto ?? ''),
              maxWidth: Math.max(80, anchoOpcionesTotal - 6 - prefixWidth),
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
            const restantes = ordenOpciones
              .filter((indiceOpcion) => indiceOpcion !== indicePrincipal)
              .map((indiceOpcion, indice) => ({
                indiceOpcion,
                letra: String.fromCharCode(65 + ordenOpciones.indexOf(indiceOpcion)),
                indice
              }));
            const gutter = 4;
            const anchoRestante = (anchoOpcionesTotal - gutter * 3) / 4;
            const lineasRestantes = restantes.map((item) => envolverTextoMixto({
              texto: String(pregunta.opciones[item.indiceOpcion]?.texto ?? ''),
              maxWidth: Math.max(20, anchoRestante - prefixWidth),
              fuente,
              fuenteBold,
              fuenteItalica,
              fuenteMono,
              sizeTexto: sizeOpcion,
              sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
              sizeCodigoBloque,
              lineHeightTexto: lineaOpcion,
              lineHeightCodigo: lineaCodigoBloque
            }));
            const altoPrincipal = Math.max(sizeOpcion + 3, lineasPrincipal.reduce((total, linea) => total + linea.lineHeight, 0) + 2);
            const altoRestantes = Math.max(
              sizeOpcion + 3,
              ...lineasRestantes.map((lineas) => lineas.reduce((total, linea) => total + linea.lineHeight, 0) + 2)
            );
            return {
              columnas: 4,
              porColumna: 1,
              gutterCols: gutter,
              colWidth: anchoRestante,
              alturas: [altoRestantes],
              alturaGrid: altoPrincipal + separacionTarjetaOpcion + altoRestantes + separacionTarjetaOpcion,
              opcionPrincipal: {
                indiceOpcion: indicePrincipal,
                letra: String.fromCharCode(65 + ordenOpciones.indexOf(indicePrincipal)),
                lineas: lineasPrincipal,
                alto: altoPrincipal
              },
              opcionesRestantes: restantes.map((item, indice) => ({
                ...item,
                lineas: lineasRestantes[indice] ?? [],
                alto: altoRestantes
              }))
            };
          }
        }
        // Cinco opciones se presentan en tres columnas (3+2). Cada opción
        // conserva su propia tarjeta, con altura compartida por fila para que
        // los fondos queden alineados incluso cuando una respuesta se envuelve.
        const candidatos = totalOpciones >= 5
          ? (omrEsquemaHorizontal ? [3] : [2])
          : [1, 2];
        return candidatos
          .map((columnas) => {
            // Cada reactivo conserva como mínimo dos pistas verticales. Con
            // cinco opciones la retícula 3+2 ya las produce; con menos
            // opciones se reserva la segunda pista para evitar bloques
            // comprimidos y mantener un ritmo visual estable.
            const porColumna = Math.max(2, Math.ceil(totalOpciones / columnas));
            const gutterCols = columnas === 3 ? 6 : 8;
            const colWidth = totalOpciones > 1
              ? (anchoOpcionesTotal - gutterCols * (columnas - 1)) / columnas
              : anchoOpcionesTotal;
            // Distribución por filas, no por columnas: con cinco opciones la
            // retícula queda A|B, C|D y E centrada. Esto evita que una columna
            // termine dos filas antes que la otra y conserva el orden natural
            // de lectura.
            const cols = Array.from({ length: columnas }, () => [] as number[]);
            ordenOpciones.forEach((indiceOpcion, indice) => {
              cols[indice % columnas]?.push(indiceOpcion);
            });
            const alturasPorColumna = cols.map((col) => col.map((indiceOpcion) => {
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
              const altoTexto = lineas.reduce((acc, linea) => acc + linea.lineHeight, 0);
              return Math.max(sizeOpcion + 3, altoTexto + 2);
            }));
            const alturas = alturasPorColumna.map((col) => col.reduce(
              (total, altoFila) => total + altoFila + separacionTarjetaOpcion,
              0
            ));
            // Ambas columnas comparten la misma retícula horizontal. El alto de
            // cada pista es el máximo de sus dos celdas; así los fondos de A-D,
            // B-E, etc. terminan exactamente en el mismo eje.
            const alturaGrid = Array.from({ length: porColumna }, (_valor, indiceFila) => Math.max(
              sizeOpcion + 3,
              ...alturasPorColumna.map((col) => col[indiceFila] ?? 0)
            )).reduce((total, altoFila) => total + altoFila + separacionTarjetaOpcion, 0);

            return { columnas, porColumna, gutterCols, colWidth, alturas, alturaGrid };
          })
          .sort((a, b) => {
            const alturaA = a.alturaGrid;
            const alturaB = b.alturaGrid;
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
        const emb = imagenesPregunta.get(pregunta.id);
        const layoutImagen = calcularLayoutImagen(emb, anchoTextoPreguntaActual);
        const anchoEnunciado = layoutImagen?.lateral
          ? layoutImagen.anchoTexto
          : anchoTextoPreguntaActual;
        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoEnunciado,
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

        if (emb) {
          if (layoutImagen?.lateral) {
            alto = Math.max(alto, layoutImagen.height) + separacionImagenOpciones;
          } else {
            alto += (layoutImagen?.height ?? Math.min(maxImagenPreguntaAlto, emb.height)) + separacionImagenOpciones;
          }
        }

        const layoutOpciones = obtenerLayoutOpciones(pregunta, limiteDerecho);
        // La retícula comparte la altura de cada fila entre columnas. Usar la
        // columna más alta subestima el bloque cuando una opción vecina se
        // envuelve a más líneas y deja que el plan difiera del dibujo real.
        const altoOpciones = layoutOpciones.alturaGrid;
        const altoOmrMin = omrEsquemaHorizontal
          // En el esquema horizontal el panel OMR se coloca en la misma
          // banda vertical que la pregunta. Reservar además `omrHeaderGap`
          // y el margen de seguridad del flujo duplicaba parte de esa banda
          // y provocaba una página extra en exámenes de 25 reactivos.
          ? Math.max(22, omrRadio * 2 + omrMargenSuperior + omrMargenInferior)
          : perfilOmr.omrHeaderGap + 10 + (omrTotalLetras - 1) * omrPasoY + omrRadio + omrMargenInferior + 2;
        // En continuaciones el panel de la primera pregunta vive en la
        // columna derecha, debajo del QR. Medirlo como una segunda fila bajo
        // las opciones inflaba artificialmente la altura y dejaba páginas
        // finales subutilizadas.
        if (omrEsquemaHorizontal) {
          // El panel OMR comparte la banda vertical del reactivo; no se suma a
          // la línea del enunciado como si estuviera debajo de las opciones.
          // La fórmula anterior reservaba `lineasEnunciado + max(opciones,
          // panel)`, sobreestimando cada reactivo compacto y provocando páginas
          // adicionales aun cuando el texto y el panel cabían en la misma
          // banda. La reserva correcta es el máximo entre la altura completa
          // del contenido y la altura mínima del panel.
          alto += altoOpciones;
          alto = Math.max(alto, altoOmrMin);
        } else {
          // En el perfil vertical el panel sí queda debajo de las opciones;
          // conservar la suma evita que las cinco burbujas salgan de la hoja.
          alto += Math.max(altoOpciones, altoOmrMin);
        }
        // El render ajusta el cursor a la retícula después de cada bloque y
        // conserva la línea divisoria. La reserva adicional cubre ese ajuste
        // y la diferencia entre la altura tipográfica estimada y la posición
        // final de las opciones, evitando planificar contenido que luego no
        // alcanza el margen inferior seguro. La holgura queda acotada para
        // conservar diez reactivos legibles en una hoja Letter cuando el
        // contenido es corto; el ajuste de retícula ya cubre el redondeo.
        // La composición rica dibuja tarjetas de opción y el cursor final se
        // redondea a la retícula. Esta reserva adicional mantiene paridad
        // entre el plan y el render real, evitando que una hoja final quede
        // con un solo reactivo por acumulación de redondeos.
        // La reserva adicional cubre el ajuste de retícula sin alterar la
        // geometría validada de la primera hoja. El panel lateral de una
        // continuación se verifica al renderizar y no se usa para mover
        // preguntas de páginas ya calibradas.
        // La posicion final se ajusta a una reticula de impresion despues de
        // dibujar el bloque. Esta holgura de 2 pt evita que el planificador
        // acepte un ultimo reactivo por una fraccion de punto que el renderer
        // real ya no puede colocar sobre el margen seguro.
        alto += separacionPregunta + (examen.totalPreguntas > 20 ? 0 : 1) + 2;
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
        1,
        Number.parseInt(String(process.env.EXAMEN_MAX_PREGUNTAS_POR_PAGINA ?? '25'), 10) || 25
      );
      // El objetivo editorial es maximizar la capacidad de cada página del
      // par dúplex. La capacidad física decide el corte; `totalPaginas` no
      // puede forzar un reparto equilibrado que expulse reactivos a una hoja
      // adicional. Si las dos caras no bastan, el bucle abre otra página real.
      const topePaginaActual = maxPreguntasPorPagina;
      // En páginas densas el espacio entre reactivos es mínimo. Si una página
      // corta solo contiene hasta cuatro reactivos, el sobrante se distribuye
      // para no dejar una mitad inferior inútil.
      // En una hoja corta el sobrante se reparte entre pocos reactivos para
      // evitar un bloque comprimido arriba y una zona blanca desproporcionada
      // abajo. Las páginas densas siguen limitadas a una separación mínima.
      const maxSeparacionExtraPagina = 60;
      // En el perfil vertical cuatro reactivos son la unidad editorial de las
      // continuaciones cortas. Este límite deja el contenido cerca del borde
      // inferior seguro sin abrir un hueco tan grande que rompa la paridad.
      const maxSeparacionVerticalCorta = 50;
      // La holgura tipográfica de cada bloque ya mantiene aisladas las
      // tarjetas OMR. La planificación añade solo 2 pt para conservar la
      // capacidad física y evitar que una fracción de punto abra otra hoja.
      const separacionCompactaPlan = 2;
      // La planificación usa una holgura mínima para no reducir la capacidad
      // física. Una vez fijado el corte, el sobrante real puede repartirse con
      // una holgura mayor, evitando una gran zona blanca al pie de la hoja.
      const maxSeparacionCompacta = 18;
      const planPagina: Array<{ indice: number; altura: number }> = [];
      let yPlanPagina = cursorY;
      const recalcularPlanPagina = () => {
        let yBase = cursorY;
        for (const item of planPagina) yBase = ajustarCursorRender(yBase - item.altura);
        const separacionExtraPlan = planPagina.length > 1
          ? Math.min(
            planPagina.length <= 4
              ? (omrEsquemaHorizontal ? maxSeparacionExtraPagina : maxSeparacionVerticalCorta)
              : separacionCompactaPlan,
            Math.max(0, (yBase - alturaDisponibleMin) / (planPagina.length - 1) - GRID_STEP)
          )
          : 0;
        let yRender = cursorY;
        for (let indice = 0; indice < planPagina.length; indice += 1) {
          const item = planPagina[indice]!;
          yRender = ajustarCursorRender(yRender - item.altura - (indice < planPagina.length - 1 ? separacionExtraPlan : 0));
        }
        return { yBase, yRender };
      };
      while (indicePregunta + planPagina.length < preguntasOrdenadas.length && planPagina.length < topePaginaActual) {
        const preguntaPlan = preguntasOrdenadas[indicePregunta + planPagina.length];
        if (!preguntaPlan) break;
        const limiteDerechoPlan = !esPrimera && planPagina.length === 0 ? xDerechaTextoContinuacion : xDerechaTexto;
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
        yPlanPagina = ajustarCursorRender(yPlanPagina - alturaPlan);
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
      // Si el corte natural dejaria uno, dos o tres reactivos en una pagina
      // adicional, probar colas crecientes del plan actual. Mover solo el
      // ultimo reactivo no siempre cabe porque la primera pregunta de una
      // continuación tiene una reserva lateral para el QR; probar una cola
      // mayor evita conservar una hoja casi vacía por una falsa dicotomía.
      if (!esPrimera && !omrEsquemaHorizontal && planPagina.length > 2) {
        const restantesTrasPlan = preguntasOrdenadas.length - (indicePregunta + planPagina.length);
        if (restantesTrasPlan > 0 && restantesTrasPlan <= Math.max(minPreguntasPorPagina, planPagina.length)) {
           const yInicioNuevaContinuacion = snapToGrid(
         Math.min(yTop - 8, limiteContenidoContinuacion)
           );
          const maxReactivosParaMover = Math.min(planPagina.length - 2, 5);
          let movimientoElegido = 0;
          // No mover nada ya es una solución válida. Solo se redistribuye si
          // la nueva partición mejora realmente el equilibrio; antes se movía
          // un reactivo siempre que cupiera en la hoja siguiente, incluso
          // cuando convertía un reparto 4/4 en 3/5.
          let mejorDiferencia = Math.abs(planPagina.length - restantesTrasPlan);
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
      const bloqueVerticalUniforme = planPagina.length > 0 && Math.max(...planPagina.map((item) => item.altura)) <= 130;
      const separacionExtraPagina = planPagina.length > 1
        ? omrEsquemaHorizontal
          ? Math.min(planPagina.length <= 4 ? maxSeparacionExtraPagina : maxSeparacionCompacta, espacioLibrePagina / (planPagina.length - 1))
          : bloqueVerticalUniforme
            // Mantener la misma separación que simuló el planificador. La
            // separación vertical fija de 45 pt dejaba huecos enormes y,
            // además, hacía que el renderer dibujara menos filas que las
            // reservadas por el plan.
            ? Math.min(
              planPagina.length <= 4
                ? (omrEsquemaHorizontal ? maxSeparacionExtraPagina : maxSeparacionVerticalCorta)
                : separacionCompactaPlan,
              Math.max(0, espacioLibrePagina / (planPagina.length - 1) - GRID_STEP)
            )
            : 0
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
        if (process.env.DEBUG_PDF_BALANCE === '1') {
          console.error(`[pdf-render] pagina=${numeroPagina} pregunta=${numero} y=${cursorY.toFixed(2)} h=${alturaNecesaria.toFixed(2)} safe=${alturaDisponibleMin.toFixed(2)} continuacion=${esPrimeraPreguntaContinuacion}`);
        }
        if (cursorY - alturaNecesaria < alturaDisponibleMin) break;

        if (!preguntasDel) preguntasDel = numero;
        preguntasAl = numero;

        const estiloPregunta = coloresPregunta[(numero - 1) % coloresPregunta.length]!;
        // El reactivo completo es la unidad visual: un fondo tenue alternado
        // contiene enunciado, imagen y respuestas. El OMR permanece fuera de
        // esta tarjeta, con fondo blanco para proteger su lectura.
        // Los bbox de texto parten de la linea base; reservar el interlineado
        // superior evita que los glifos del enunciado queden sobre blanco.
        const reservaSuperiorFondo = Math.max(2, lineaPregunta);
        const altoFondoPregunta = Math.max(
          1,
          alturaNecesaria - separacionPregunta - (examen.totalPreguntas > 20 ? 0 : 1)
        );
        const fondoPregunta = {
          x: xTextoPregunta - 4,
          y: yPreguntaTop - altoFondoPregunta,
          width: Math.max(20, limiteDerechoPregunta - xTextoPregunta + 4),
          height: altoFondoPregunta + reservaSuperiorFondo
        };
        dibujarPatronPunteadoReactivo(page, fondoPregunta, estiloPregunta.acento);
        // Filete superior muy tenue: da una lectura editorial de tarjeta y
        // separa el reactivo anterior sin invadir texto, imágenes ni OMR.
        page.drawLine({
          start: { x: fondoPregunta.x + 2.2, y: fondoPregunta.y + fondoPregunta.height - 0.55 },
          end: { x: fondoPregunta.x + fondoPregunta.width, y: fondoPregunta.y + fondoPregunta.height - 0.55 },
          color: estiloPregunta.acento,
          thickness: 0.65,
          opacity: 0.42
        });
        page.drawRectangle({
          x: fondoPregunta.x,
          y: fondoPregunta.y,
          width: 2.2,
          height: fondoPregunta.height,
          color: estiloPregunta.acento,
          opacity: 0.88
        });
        const textoNumero = String(numero);
        const wNum = anchoInsigniaPregunta;
        const xNum = xNumeroPregunta;
        // En la primera pregunta de una continuación horizontal el texto
        // empieza debajo de la zona segura superior, pero el fiducial de la
        // esquina ocupa todavía parte de esa banda. Bajar solo la insignia
        // evita que la cubra sin desplazar el bloque tipográfico completo.
        const yNum = cursorY - 1 - (esPrimeraPreguntaContinuacion && omrEsquemaHorizontal ? 9 : 0);
        const sizeNum = textoNumero.length >= 3 ? 8 : 9;
        const numWidth = fuenteBold.widthOfTextAtSize(textoNumero, sizeNum);
        // El número queda como texto independiente, sin borde ni relleno;
        // así se elimina una masa sólida innecesaria y no compite con el OMR.
        page.drawText(textoNumero, {
          x: xNum + (wNum - numWidth) / 2,
          y: yNum + 3.2,
          size: sizeNum,
          font: fuenteBold,
          color: estiloPregunta.acento
        });
        const emb = imagenesPregunta.get(pregunta.id);
        const layoutImagen = calcularLayoutImagen(emb, anchoTextoPreguntaActual);
        const anchoEnunciado = layoutImagen?.lateral
          ? layoutImagen.anchoTexto
          : anchoTextoPreguntaActual;
        const lineasEnunciado = envolverTextoMixto({
          texto: quitarPrefijoReactivo(pregunta.enunciado, numero),
          maxWidth: anchoEnunciado,
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
        const altoEnunciado = lineasEnunciado.reduce((total, linea) => total + linea.lineHeight, 0);
        const interlineadoUltimoEnunciado = lineasEnunciado[lineasEnunciado.length - 1]?.lineHeight ?? lineaPregunta;
        const separacionPreguntaRespuesta = Math.max(2.5, sizePregunta * 0.3);
        const cajaPregunta: RectBox = {
          x: xTextoPregunta - 2.5,
          // El borde inferior se calcula desde la última línea real del
          // enunciado, no desde la base de la primera opción. Así queda en la
          // franja libre entre ambos bloques y no atraviesa sus glifos.
          y: yPreguntaTop - altoEnunciado + interlineadoUltimoEnunciado - separacionPreguntaRespuesta,
          width: Math.max(30, anchoEnunciado + 2.5),
          height: Math.max(
            4,
            altoEnunciado - interlineadoUltimoEnunciado + separacionPreguntaRespuesta + 2.2
          )
        };
        assertRectDentroPagina(cajaPregunta, `caja de pregunta ${numero}`);
        page.drawRectangle({
          ...cajaPregunta,
          color: rgb(1, 1, 1),
          // El enunciado necesita una superficie claramente distinta de las
          // opciones; la opacidad alta mantiene legible el texto sin cubrirlo.
          opacity: 0.84,
          borderWidth: 0
        });
        // El borde superior se omite deliberadamente: no hay una banda libre
        // entre reactivos consecutivos y colocarla allí podría atravesar el
        // último renglón de la pregunta anterior. Los laterales y el borde
        // inferior delimitan el enunciado sin cruzar ningún glifo.
        dibujarCajaPunteada(page, cajaPregunta, estiloPregunta.acento, false);
        questionPromptBoxes.push({ id: `caja-pregunta-${numero}`, ...cajaPregunta });
        const minLocalEnunciado = Math.max(
          (omrEsquemaHorizontal ? 10.1 : 12.8) * fontScale,
          sizePregunta * 1.18
        ) * lineSpacing;
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
          reforzarPeso: true,
          registrarRuns: (run) => textRunsPregunta.push(run)
        });

        if (emb) {
          const w = layoutImagen?.width ?? emb.width;
          const h = layoutImagen?.height ?? emb.height;
          const x = layoutImagen?.lateral
            ? xTextoPregunta + layoutImagen.anchoTexto + separacionColumnaImagen
            : xTextoPregunta;
          const y = layoutImagen?.lateral
            ? yPreguntaTop - h
            : cursorY - h;
          imagenPregunta = { x, y, width: w, height: h };
          page.drawImage(emb.image, imagenPregunta);
          cursorY = layoutImagen?.lateral
            ? Math.min(cursorY, yPreguntaTop - h) - separacionImagenOpciones
            : cursorY - h - separacionImagenOpciones;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const layoutOpciones = obtenerLayoutOpciones(pregunta, limiteDerechoPregunta);
        const { columnas, porColumna, gutterCols, colWidth } = layoutOpciones;
        const anchoOpcionesTotal = Math.max(80, limiteDerechoPregunta - xTextoPregunta);
        const xCols = Array.from({ length: columnas }, (_valor, idx) => xTextoPregunta + idx * (colWidth + gutterCols));
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion) + 3;

        const yInicioOpciones = cursorY;
        // Las respuestas reciben una banda propia, ligeramente diferenciada
        // del enunciado. Se dibuja antes del texto y no cambia la geometría,
        // por lo que no reduce capacidad ni altera el ROI OMR.
        const fondoRespuestas: RectBox = {
          x: xTextoPregunta - 2.5,
          y: yInicioOpciones - layoutOpciones.alturaGrid - 0.8,
          width: Math.max(30, anchoOpcionesTotal + 2.5),
          height: layoutOpciones.alturaGrid + 2.2
        };
        page.drawRectangle({
          ...fondoRespuestas,
          color: rgb(1, 1, 1),
          opacity: 0.28,
          borderWidth: 0
        });

        const opcionesOmr: Array<{ letra: string; x: number; y: number }> = [];
        let yFinOpciones = yInicioOpciones;

        const opcionesCompactas = 'compacto' in layoutOpciones && layoutOpciones.compacto === true;
        const opcionesAnchas = 'opcionPrincipal' in layoutOpciones;
        const dibujarEtiquetaInciso = (etiqueta: string, x: number, y: number) => {
          const estiloEtiqueta = {
            size: Math.min(sizeOpcion, 8.2),
            font: fuenteBold,
            color: colorPrimario
          } as const;
          dibujarTextoConPesoVisual(page, etiqueta, { x, y, ...estiloEtiqueta }, true);
        };
        if (opcionesCompactas) {
          const lineasFlujo: LineaSegmentos[] = 'lineasFlujo' in layoutOpciones
            ? (layoutOpciones as { lineasFlujo: LineaSegmentos[] }).lineasFlujo
            : [];
          const altoFlujo = lineasFlujo.reduce((total: number, linea: LineaSegmentos) => total + linea.lineHeight, 0) + 2;
          dibujarLineasMixtas({
            page,
            lineas: lineasFlujo,
            x: xTextoPregunta,
            y: yInicioOpciones,
            colorTexto: colorTinta,
            registrarRuns: (run) => textRunsPregunta.push(run)
          });
          yFinOpciones = yInicioOpciones - altoFlujo - separacionTarjetaOpcion;
        } else if (opcionesAnchas) {
          const principal = layoutOpciones.opcionPrincipal;
          const restantes = layoutOpciones.opcionesRestantes;
          const dibujarTarjetaAncha = (
            xCol: number,
            yLocal: number,
            anchoTarjeta: number,
            item: { indiceOpcion: number; letra: string },
            lineas: LineaSegmentos[],
            altoFila: number
          ) => {
            const yTexto = yLocal - Math.max(0, (altoFila - (lineas.reduce((total, linea) => total + linea.lineHeight, 0))) / 2);
            const etiqueta = `${item.letra})`;
            dibujarEtiquetaInciso(etiqueta, xCol, yTexto);
            dibujarLineasMixtas({
              page,
              lineas,
              x: xCol + prefixWidth,
              y: yTexto,
              colorTexto: colorTinta,
              registrarRuns: (run) => textRunsPregunta.push(run)
            });
          };
          dibujarTarjetaAncha(
            xTextoPregunta,
            yInicioOpciones,
            anchoOpcionesTotal,
            principal,
            principal.lineas,
            principal.alto
          );
          const yFilaRestantes = yInicioOpciones - principal.alto - separacionTarjetaOpcion;
          for (let indice = 0; indice < restantes.length; indice += 1) {
            const item = restantes[indice]!;
            dibujarTarjetaAncha(
              xTextoPregunta + indice * (layoutOpciones.colWidth + layoutOpciones.gutterCols),
              yFilaRestantes,
              layoutOpciones.colWidth,
              item,
              item.lineas,
              item.alto
            );
          }
          yFinOpciones = yFilaRestantes - layoutOpciones.alturas[0]! - separacionTarjetaOpcion;
        } else {
        const itemsCols = Array.from({ length: columnas }, () => [] as Array<{ indiceOpcion: number; letra: string }>);
        ordenOpciones.forEach((indiceOpcion, indice) => {
          itemsCols[indice % columnas]?.push({
            indiceOpcion,
            letra: String.fromCharCode(65 + indice)
          });
        });

        const opcionesRender = itemsCols.map((items) => items.map((item) => {
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
          const minLocalOpcion = Math.max(
            (omrEsquemaHorizontal ? 8.5 : 11) * fontScale,
            sizeOpcion * 1.18
          ) * lineSpacing;
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
          const altoTextoOpcion = lineasOpcion.reduce((acc, linea) => acc + linea.lineHeight, 0);
          const altoFilaOpcion = Math.max(sizeOpcion + 3, altoTextoOpcion + 2);
          return { item, lineasOpcion, altoFilaOpcion };
        }));
        const alturasFilas = Array.from({ length: porColumna }, (_valor, indiceFila) => Math.max(
          sizeOpcion + 3,
          ...opcionesRender.map((col) => col[indiceFila]?.altoFilaOpcion ?? 0)
        ));
        let yFilaGrid = yInicioOpciones;

        const dibujarItem = (
          xCol: number,
          yLocal: number,
          altoFilaCompartida: number,
          indiceFila: number,
          render: { item: { indiceOpcion: number; letra: string }; lineasOpcion: LineaSegmentos[]; altoFilaOpcion: number }
        ) => {
          const { item, lineasOpcion, altoFilaOpcion } = render;
          const yTexto = yLocal - Math.max(0, (altoFilaCompartida - altoFilaOpcion) / 2);
          // El fondo alternado ya fue dibujado para todo el reactivo; no se
          // generan tarjetas independientes para cada respuesta.
          dibujarEtiquetaInciso(`${item.letra})`, xCol, yTexto);
          const yFinal = dibujarLineasMixtas({
            page,
            lineas: lineasOpcion,
            x: xCol + prefixWidth,
            y: yTexto,
            colorTexto: colorTinta,
            registrarRuns: (run) => textRunsPregunta.push(run)
          });
          // Reservar una holgura explicita evita que las tarjetas consecutivas
          // se toquen cuando una opcion ocupa varias lineas. El planificador
          // usa la misma altura de texto y conserva el ritmo vertical.
          return yFinal - separacionTarjetaOpcion;
        };

        for (let indiceFila = 0; indiceFila < porColumna; indiceFila += 1) {
          const altoFilaCompartida = alturasFilas[indiceFila] ?? 0;
          const celdasFila = opcionesRender.filter((col) => Boolean(col[indiceFila]));
          for (let idxCol = 0; idxCol < opcionesRender.length; idxCol += 1) {
            const render = opcionesRender[idxCol]?.[indiceFila];
            if (!render) continue;
            const xCelda = celdasFila.length === 1
              ? xTextoPregunta + (anchoOpcionesTotal - colWidth) / 2
              : (xCols[idxCol] ?? xTextoPregunta);
            dibujarItem(
              xCelda,
              yFilaGrid,
              altoFilaCompartida,
              indiceFila,
              render
            );
          }
          yFilaGrid -= altoFilaCompartida + separacionTarjetaOpcion;
        }
        yFinOpciones = yFilaGrid;
        }
        const letras = letrasOmr;
        // En una continuación, el primer reactivo usa el ancho izquierdo para
        // no invadir el QR. Su panel OMR, sin embargo, cabe en la columna
        // derecha justo debajo del QR. Colocarlo allí evita añadir una altura
        // artificial debajo de las opciones y mejora el reparto entre páginas.
        const panelOmrLateralContinuacion = esPrimeraPreguntaContinuacion;
        const yPrimeraBurbujaLateral = rectQr.y - 8 - omrRadio - omrMargenSuperior;
        const yPrimeraBurbujaBase = panelOmrLateralContinuacion
          ? yPrimeraBurbujaLateral
          // El panel normal comparte la franja de opciones, pero no debe
          // colgar por debajo del margen seguro cuando el último reactivo de
          // la hoja queda cerca del pie. Subirlo 6 pt mantiene asociación
          // visual, sin alterar radio, paso ni quiet zones.
          : yInicioOpciones - perfilOmr.omrHeaderGap - 4;
        const pasoBurbujaVertical = omrPasoY;
        const topBase = yPrimeraBurbujaBase + omrRadio + omrMargenSuperior;
        const panelAnterior = omrEsquemaHorizontal
          ? omrPanelBoxes[omrPanelBoxes.length - 1]
          : undefined;
        // Cada panel conserva una separación mínima respecto al anterior. La
        // corrección se calcula con la geometría efectiva, por lo que también
        // cubre continuaciones, textos de distinta altura y redondeos de la
        // retícula sin recurrir a desplazamientos fijos.
        const desplazamientoPanelPorColision = panelAnterior
          ? Math.max(0, topBase - (panelAnterior.y - separacionPanelOmr))
          : 0;
        let yPrimeraBurbuja = yPrimeraBurbujaBase - desplazamientoPanelPorColision;
        // El cálculo tipográfico puede dejar el último panel horizontal unos
        // puntos por debajo del margen seguro porque su etiqueta inferior
        // tiene una reserva propia. Subir únicamente el panel conserva el
        // texto y evita que la impresora recorte la fila OMR.
        const bottomCalculado = yPrimeraBurbuja - omrRadio - omrMargenInferior;
        if (bottomCalculado < alturaDisponibleMin) {
          yPrimeraBurbuja += alturaDisponibleMin - bottomCalculado;
        }
        const top = yPrimeraBurbuja + omrRadio + omrMargenSuperior;
        const bottom = omrEsquemaHorizontal
          ? yPrimeraBurbuja - omrRadio - omrMargenInferior
          : yPrimeraBurbuja - (letras.length - 1) * pasoBurbujaVertical - omrRadio - omrMargenInferior;
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
          borderColor: colorBordeOmr,
          color: colorPanelOmr
        });
        assertRectDentroPagina(
          panelRect,
          `omr-pregunta-${numero}`
        );
        if (panelRect.y < alturaDisponibleMin) {
          throw new Error(
            `Layout invalido: el panel OMR ${numero} invade la zona segura inferior de la pagina ${numeroPagina}`
          );
        }

        const hTag = perfilOmr.omrTagHeight;
        const wTag = perfilOmr.omrTagWidth;
        // El fiducial superior izquierdo ocupa la esquina del panel. Separar
        // la etiqueta del borde evita que el cuadrado se lea como un símbolo
        // pegado al número del reactivo al rasterizar a baja resolución.
        const xTag = xPanel + 10;
        // El borde superior del panel es una reserva real: colocar aquí la
        // insignia deja la holgura completa de la banda antes de la burbuja,
        // incluso si sus proyecciones horizontales coinciden.
        const yTag = omrEsquemaHorizontal ? top - hTag : yPrimeraBurbuja + omrRadio + 3;
        const cajaNumeroOmr: RectBox = { x: xTag, y: yTag, width: wTag, height: hTag };
        assertRectContenida(cajaNumeroOmr, panelRect, `insignia numerica OMR de la pregunta ${numero}`);
        // No se dibuja una franja de color dentro del panel: en una captura
        // móvil podría contaminar la referencia de blanco del detector.
        if (this.perfilLayout.usarEtiquetaOmrSolida) {
          page.drawRectangle({ x: xTag, y: yTag, width: wTag, height: hTag, color: colorPrimario, opacity: 0.9 });
          for (const punto of [
            { x: xTag + 2.1, y: yTag + 2.1 },
            { x: xTag + wTag - 2.1, y: yTag + hTag - 2.1 }
          ]) {
            page.drawCircle({ x: punto.x, y: punto.y, size: 0.3, color: rgb(1, 1, 1), opacity: 0.18 });
          }
          const anchoNumero = fuenteBold.widthOfTextAtSize(String(numero), perfilOmr.omrTagFontSize);
          page.drawText(String(numero), {
            x: xTag + Math.max(0.8, (wTag - anchoNumero) / 2),
            y: yTag + Math.max(0.4, (hTag - perfilOmr.omrTagFontSize) / 2),
            size: perfilOmr.omrTagFontSize,
            font: fuenteBold,
            color: rgb(1, 1, 1)
          });
          page.drawText(String(numero), {
            x: xTag + Math.max(0.8, (wTag - anchoNumero) / 2) + 0.18,
            y: yTag + Math.max(0.4, (hTag - perfilOmr.omrTagFontSize) / 2),
            size: perfilOmr.omrTagFontSize,
            font: fuenteBold,
            color: rgb(1, 1, 1)
          });
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
          const anchoNumero = fuenteBold.widthOfTextAtSize(String(numero), perfilOmr.omrTagFontSize);
          page.drawText(String(numero), {
            x: xTag + Math.max(0.8, (wTag - anchoNumero) / 2),
            y: yTag + Math.max(0.4, (hTag - perfilOmr.omrTagFontSize) / 2),
            size: perfilOmr.omrTagFontSize,
            font: fuenteBold,
            color: colorPrimario
          });
          page.drawText(String(numero), {
            x: xTag + Math.max(0.8, (wTag - anchoNumero) / 2) + 0.18,
            y: yTag + Math.max(0.4, (hTag - perfilOmr.omrTagFontSize) / 2),
            size: perfilOmr.omrTagFontSize,
            font: fuenteBold,
            color: colorPrimario
          });
        }

        // No se imprime una etiqueta auxiliar dentro del ROI OMR. La leyenda
        // `RESP.` competía con la primera fila de burbujas al rasterizar y no
        // aporta información necesaria para detectar ni calificar respuestas.

        const etiquetaAnchoMax = etiquetaAnchoMaxOmr;
        const diametroBurbuja = diametroBurbujaOmr;
        const etiquetaGapBurbuja = omrEsquemaHorizontal ? 1.2 : omrEtiquetaGap;
        // Mantener las letras separadas del círculo y del borde inferior sin
        // aumentar la caja OMR: el panel debe seguir siendo compacto y la
        // etiqueta debe conservar una reserva visible al rasterizar.
        const etiquetaOmrOffsetVertical = omrEsquemaHorizontal ? 4.8 : 8.5;
        const xBurbujaBase = omrEsquemaHorizontal
          ? xPanel + (anchoColRespuesta - (letras.length - 1) * omrPasoX) / 2
          : xPanel + Math.max(
              omrMargenHorizontal + etiquetaAnchoMax + etiquetaGapBurbuja + omrRadio,
              anchoColRespuesta * 0.48
            );
        const cajasBurbujas: RectBox[] = [];
        for (let idx = 0; idx < letras.length; idx += 1) {
          const letra = letras[idx];
          const xBurbuja = omrEsquemaHorizontal
            ? xBurbujaBase + idx * omrPasoX
            : xBurbujaBase;
          const yBurbuja = omrEsquemaHorizontal
            ? yPrimeraBurbuja
            : yPrimeraBurbuja - idx * pasoBurbujaVertical;
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
          if (rectInterseca(cajaNumeroOmr, cajaBurbuja)) {
            throw new Error(`Layout invalido: la insignia numerica invade la burbuja ${letra} de la pregunta ${numero}`);
          }
          assertRectContenida(cajaBurbuja, panelRect, `burbuja ${letra} de la pregunta ${numero}`);
          const cajaEtiqueta: RectBox = omrEsquemaHorizontal
            ? {
                x: xBurbuja - etiquetaAncho / 2,
                y: yBurbuja - omrRadio - etiquetaOmrOffsetVertical,
                width: etiquetaAncho,
                height: 6.8 + 1
              }
            : {
                x: xBurbuja - omrRadio - etiquetaGapBurbuja - etiquetaAncho,
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
            x: omrEsquemaHorizontal ? xBurbuja - etiquetaAncho / 2 : xBurbuja - omrRadio - etiquetaGapBurbuja - etiquetaAncho,
            y: omrEsquemaHorizontal ? yBurbuja - omrRadio - etiquetaOmrOffsetVertical : yBurbuja - 2.4,
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
          if (rectInterseca(cajaNumeroOmr, cajaFid)) {
            throw new Error(`Layout invalido: la insignia numerica invade la quiet zone del fiducial ${indiceFid + 1} de la pregunta ${numero}`);
          }
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
        for (const previo of omrPanelBoxes) {
          if (omrEsquemaHorizontal && previo.id !== `omr-${numero}` && rectInterseca(previo, panelOuterRect)) {
            collisionBoxes.push({ pagina: numeroPagina, a: previo.id, b: `omr-${numero}` });
          }
        }
        if (collisionBoxes.length > 0) {
          const detalle = collisionBoxes.map((colision) => `${colision.a}<->${colision.b}`).join(', ');
          throw new Error(`Layout invalido: colisiones en la pregunta ${numero} de la pagina ${numeroPagina}: ${detalle}`);
        }

        // En el perfil compacto el panel OMR ocupa una banda vertical real
        // aunque viva en la columna derecha. El cursor debe respetar su borde
        // inferior para que dos cuadros consecutivos nunca se solapen; el
        // planificador reserva esta misma altura mediante `altoOmrMin`.
        // La excepción vertical del primer reactivo de continuación mantiene
        // su anclaje independiente bajo el QR, tal como exige ese layout.
        cursorY = omrEsquemaHorizontal
          ? yFinOpciones
          : Math.min(yFinOpciones, bottom - 2);
        const hayOtraPreguntaPlaneada = mapaPagina.length < planPagina.length;
        cursorY -= separacionPregunta + (hayOtraPreguntaPlaneada ? separacionExtraPagina : 0);
        // La retícula nunca debe redondear hacia arriba sobre el panel OMR
        // anterior: en ese caso el siguiente bloque podría invadirlo.
        cursorY = Math.min(cursorY, snapToGrid(cursorY));
        page.drawLine({
          // La regla queda debajo de la siguiente línea base; con una
          // separación compacta no debe atravesar los ascendentes del próximo
          // enunciado.
          start: { x: xTextoPregunta, y: cursorY - 3.2 },
          end: { x: limiteDerechoPregunta, y: cursorY - 3.2 },
          color: estiloPregunta.acento,
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
        questionBackgroundBoxes.push({ id: `fondo-pregunta-${numero}`, ...fondoPregunta });

        mapaPagina.push({
          numeroPregunta: numero,
          idPregunta: pregunta.id,
          bboxPregunta,
          opciones: opcionesOmr,
          textRuns: textRunsPregunta,
          imagen: imagenPregunta,
          imagenDisposicion: imagenPregunta
            ? (layoutImagen?.lateral ? 'lateral' : 'inferior')
            : undefined,
          imageRenderStatus: estadoImagenPregunta.get(pregunta.id),
          cajaOmr: panelRect,
          perfilOmr: {
            radio: omrRadio,
            pasoY: omrPasoY,
            pasoX: omrPasoX || pasoBurbujaX,
            cajaAncho: anchoColRespuesta,
            orientacion: perfilOmr.orientacion,
            etiquetaBordeInferiorGap: omrMargenInferior - etiquetaOmrOffsetVertical
          },
          fiduciales: {
            leftTop: { x: xFid, y: yFidTop },
            leftBottom: { x: xFid, y: yFidBottom },
            rightTop: { x: xFidRight, y: yFidTop },
            rightBottom: { x: xFidRight, y: yFidBottom }
          }
        });
      }

      if (mapaPagina.length !== planPagina.length) {
        throw new Error(
          `Layout invalido: el plan de la pagina ${numeroPagina} reserva ${planPagina.length} reactivos ` +
            `pero el renderer dibujo ${mapaPagina.length}`
        );
      }

      if (mapaPagina.length === 0 && indicePregunta < totalPreguntas) {
        throw new Error(
          `Layout invalido: el reactivo ${String(indicePregunta + 1)} no cabe en una pagina ` +
            `con el tamano de letra minimo legible (${fontScale.toFixed(2)}x).`
        );
      }

      // El QR debe describir la pagina fisica ya renderizada, no todo el
      // examen. Codificar todas las preguntas aumentaba la version del QR,
      // reducia los pixeles por modulo y hacia mas fragil la lectura movil.
      // Se redibuja sobre la reserva ya calculada para conservar el layout.
      const questionIdsPagina = mapaPagina.map((pregunta) => pregunta.idPregunta);
      const qrTextoPaginaFinal = examen.generarTextoQrPagina(numeroPagina, questionIdsPagina);
      if (qrTextoPaginaFinal !== qrTextoPagina) {
        qrTextoPagina = qrTextoPaginaFinal;
        qrInfo = await agregarQr(pdfDoc, page, qrTextoPagina, margen, perfilOmr);
      }

      // Dibujar la leyenda después de la actualización final del QR. En una
      // página densa el QR se regenera con sus preguntas reales; hacerlo antes
      // dejaría la leyenda cubierta por la segunda tarjeta blanca.
      {
        const anchoReservaQr = cardW;
        const leyendaQr = `${folioQr} · P${numeroPagina}`;
        const anchoLeyendaDisponible = Math.max(24, anchoReservaQr - 4);
        let sizeLeyendaQr = 5.4;
        while (
          sizeLeyendaQr > 4.2 &&
          fuenteBold.widthOfTextAtSize(leyendaQr, sizeLeyendaQr) > anchoLeyendaDisponible
        ) {
          sizeLeyendaQr = Math.max(4.2, sizeLeyendaQr - 0.2);
        }
        const anchoLeyendaQr = fuenteBold.widthOfTextAtSize(leyendaQr, sizeLeyendaQr);
        const xLeyendaQr = rectQr.x + Math.max(2, (anchoReservaQr - anchoLeyendaQr) / 2);
        page.drawRectangle({
          x: cardX + 1,
          y: cardY + cardH - qrPadding - Math.min(7, Math.max(1, qrPadding - 0.8)),
          width: Math.max(1, cardW - 2),
          height: Math.min(7, Math.max(1, qrPadding - 0.8)),
          color: rgb(0.96, 0.98, 1),
          opacity: 0.96
        });
        page.drawText(leyendaQr, {
          x: xLeyendaQr,
          y: cardY + cardH - qrPadding + 0.5,
          size: sizeLeyendaQr,
          font: fuenteBold,
          color: colorPrimario
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

      paginasMeta.push({ numero: numeroPagina, qrTexto: qrTextoPagina, preguntasDel, preguntasAl, tipoPagina: 'examen' });
      paginasOmr.push({
        numeroPagina,
        tipoPagina: 'examen',
        duplex: {
          hoja: Math.ceil(numeroPagina / 2),
          lado: numeroPagina % 2 === 1 ? 'frente' : 'reverso',
          indiceEnHoja: numeroPagina % 2 === 1 ? 1 : 2
        },
        templateVersion: perfilOmr.version,
        markerSpec,
        engineHints,
        qr: {
          texto: qrTextoPagina,
          x: xQr,
          y: yQr,
          size: qrSize,
          padding: qrPadding,
          marginModules: qrInfo.marginModules,
          matrixModules: qrInfo.matrixModules
        },
        marcasPagina,
        preguntas: mapaPagina,
        layoutDebug: {
          layoutTemplateVersion: TEMPLATE_VERSION_CANONICA,
          header: { x: rectHeader.x, y: rectHeader.y, width: rectHeader.width, height: rectHeader.height },
          continuationBand: rectContinuacion,
          continuationTextBlocks,
          qr: { x: rectQr.x, y: rectQr.y, width: rectQr.width, height: rectQr.height },
          instructions: rectIndicaciones,
          headerSlots: headerSlotBoxes,
          headerIconBoxes,
          headerTextBlocks,
          headerFieldBoxes,
          lineHeightViolations: lineHeightViolations
            .filter((v) => v.pagina === numeroPagina)
            .map((v) => ({ preguntaId: v.preguntaId, lineHeight: v.lineHeight, min: v.min })),
          contentStartY: cursorYInicio,
          contentEndY: cursorY,
          questionBlockBoxes,
          questionBackgroundBoxes,
          questionPromptBoxes,
          omrPanelBoxes,
          collisionBoxes
        }
      });

      numeroPagina += 1;
    }

    // No se agregan hojas o caras en blanco. La última hoja física puede tener
    // solo frente cuando el contenido real termina en una página impar.
    if (paginasOmr.length !== paginasMeta.length || metricasPaginas.length !== paginasMeta.length) {
      throw new Error('Layout invalido: la salida PDF no conserva correspondencia entre paginas, mapa OMR y metricas');
    }

    const pdfBytes = Buffer.from(await pdfDoc.save());
    const preguntasRestantes = Math.max(0, totalPreguntas - indicePregunta);

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
        imagenesFallidas,
        logosOmitidos
      },
      mapaOmr: {
        margenMm,
        templateVersion: perfilOmr.version,
        markerSpec,
        blockSpec,
        engineHints,
        impresion: {
          modo: 'duplex',
          volteo: 'borde-largo',
          paginasPorHoja: 2
        },
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
          burbujaPasoX: perfilOmr.burbujaPasoX,
          orientacion: perfilOmr.orientacion,
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


