import type { ExamenPdf } from '../../domain/examenPdf';
import { LAYOUT_TEMPLATE_V9, pxAPuntos, roundGrid } from '../../domain/layoutTemplateV9';
import { LAYOUT_TEMPLATE_V10, pxAPuntosV10, roundGridV10 } from '../../domain/layoutTemplateV10';
import type {
  BlockSpecOmr,
  EngineHintsOmr,
  MarkerSpecOmr,
  PaginaOmr,
  PerfilLayoutImpresion,
  PerfilPlantillaOmr,
  ResultadoGeneracionPdf
} from '../../shared/tiposPdf';
import { resolverImagenPregunta, type ImagenPreguntaResuelta } from './examImageResolver';

export type HeaderSlot = { id: string; x: number; y: number; width: number; height: number };
export type RectPx = { x: number; y: number; width: number; height: number };
export type OpcionToken = { letra: string; texto: string };
export type QuestionToken = {
  id: string;
  numero: number;
  stemHtml: string;
  stemText: string;
  image?: ImagenPreguntaResuelta;
  imageBox?: RectPx;
  opciones: OpcionToken[];
  box: RectPx;
  numberBox: RectPx;
  textBox: RectPx;
  omrBox: RectPx;
  optionColumns: number;
  lineHeightStem: number;
  lineHeightOption: number;
};

export type PageToken = {
  numeroPagina: number;
  qrTexto: string;
  pageShell: RectPx;
  headerBox?: RectPx;
  headerSlots: HeaderSlot[];
  footerBox: RectPx;
  contentBox: RectPx;
  qrBox: RectPx;
  preguntas: QuestionToken[];
};

export type LayoutBuildResult = {
  pages: PageToken[];
  mapaOmr: ResultadoGeneracionPdf['mapaOmr'];
  paginas: ResultadoGeneracionPdf['paginas'];
  metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'];
  metricasLayout: NonNullable<ResultadoGeneracionPdf['metricasLayout']>;
  renderDiagnostics: NonNullable<ResultadoGeneracionPdf['renderDiagnostics']>;
  preguntasRestantes: number;
};

type LayoutTemplateProfile = typeof LAYOUT_TEMPLATE_V9 | typeof LAYOUT_TEMPLATE_V10;

function resolverLayoutTemplate(templateVersion: number): LayoutTemplateProfile {
  return templateVersion === 4 ? LAYOUT_TEMPLATE_V10 : LAYOUT_TEMPLATE_V9;
}

function resolverConvertidores(templateVersion: number) {
  if (templateVersion === 4) {
    return {
      aPuntos: pxAPuntosV10,
      ajustarGrid: roundGridV10
    };
  }
  return {
    aPuntos: pxAPuntos,
    ajustarGrid: roundGrid
  };
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function aplicarReglasFormatoPregunta(value: string): string {
  let text = String(value ?? '');

  text = text.replace(/\[\[(bi|b|i):([\s\S]*?)\]\]/g, (_m, tipo: 'bi' | 'b' | 'i', contenido: string) => {
    const clean = String(contenido ?? '').trim();
    if (!clean) return '';
    if (tipo === 'b') return `**${clean}**`;
    if (tipo === 'i') return `*${clean}*`;
    return `***${clean}***`;
  });

  text = text.replace(
    /^(\s*)(Importante|Nota|Advertencia|Instruccion|Instrucción|Observacion|Observación|Clave)(\s*:\s*)/gim,
    (_m, ws: string, etiqueta: string) => `${ws}**${etiqueta}:** `
  );

  text = text.replace(
    /\b(excepto|nunca|siempre|únicamente|unicamente|solo|sólo|correcta|incorrecta|verdadero|falso)\b/gi,
    (_m) => `**${_m.toUpperCase()}**`
  );

  return text;
}

function markdownBasicoAHtml(value: string): string {
  const blocks: string[] = [];
  const putBlock = (htmlBlock: string) => {
    const token = `@@BLOCK_${blocks.length}@@`;
    blocks.push(htmlBlock);
    return token;
  };

  let source = aplicarReglasFormatoPregunta(value ?? '');

  source = source.replace(/```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const language = String(lang ?? '').trim();
    const codeEscaped = escapeHtml(String(code ?? '').trim());
    return putBlock(`<pre class="q-code-block"><code class="q-code${language ? ` lang-${language.toLowerCase()}` : ''}">${codeEscaped}</code></pre>`);
  });

  source = source.replace(/\$\$([\s\S]*?)\$\$/g, (_m, expr: string) => {
    const expression = escapeHtml(String(expr ?? '').trim());
    return putBlock(`<div class="q-math-block"><span class="q-math-expr">${expression}</span></div>`);
  });

  let html = escapeHtml(source);
  html = html.replace(/`([^`]+)`/g, '<code class="q-code-inline">$1</code>');
  html = html.replace(/\$(?!\$)([^$\n]+?)\$/g, '<span class="q-math-inline">$1</span>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\r\n?/g, '\n');
  html = html
    .split('\n')
    .map((linea) => {
      const trim = linea.trim();
      if (!trim) return '<div class="q-spacer"></div>';
      if (/^@@BLOCK_\d+@@$/.test(trim)) return trim;
      if (/^(?:-|\*)\s+/.test(trim)) return `<li>${trim.replace(/^(?:-|\*)\s+/, '')}</li>`;
      if (/^\d+\.\s+/.test(trim)) return `<li>${trim.replace(/^\d+\.\s+/, '')}</li>`;
      if (/^(algoritmo|inicio|fin|para|mientras|si|sino|entonces|hacer|finsi|finpara|finmientras|retornar|leer|escribir)\b/i.test(trim)) {
        const pseudo = trim.replace(
          /^(algoritmo|inicio|fin|para|mientras|si|sino|entonces|hacer|finsi|finpara|finmientras|retornar|leer|escribir)\b/i,
          '<span class="q-pseudo-kw">$1</span>'
        );
        return `<p class="q-pseudo-line">${pseudo}</p>`;
      }
      if (/([=+\-*/^<>]|≤|≥|≈|≠|√|∑|∫)/.test(trim) && /\d|[a-zA-Z]/.test(trim)) {
        return `<p class="q-math-line">${trim}</p>`;
      }
      return `<p>${trim}</p>`;
    })
    .join('');
  html = html.replace(/(?:<li>.*?<\/li>)+/g, (chunk) => `<ul>${chunk}</ul>`);
  html = html.replace(/@@BLOCK_(\d+)@@/g, (_m, idx: string) => blocks[Number(idx)] ?? '');
  return html;
}

function stripMarkdown(value: string): string {
  return String(value ?? '')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateLines(text: string, charsPerLine: number): number {
  const plain = stripMarkdown(text);
  if (!plain) return 1;
  const lines = plain.split('\n');
  let total = 0;
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) {
      total += 1;
      continue;
    }
    total += Math.max(1, Math.ceil(clean.length / Math.max(16, charsPerLine)));
  }
  return total;
}

function chunkOptions(opciones: OpcionToken[], columns: number): OpcionToken[][] {
  if (columns <= 1) return [opciones];
  const midpoint = Math.ceil(opciones.length / 2);
  return [opciones.slice(0, midpoint), opciones.slice(midpoint)];
}

function buildMarkerSpec(perfilOmr: PerfilPlantillaOmr): MarkerSpecOmr {
  return {
    family: 'aruco_4x4_50',
    sizeMm: Number((perfilOmr.fiducialSize / (72 / 25.4)).toFixed(3)),
    quietZoneMm: Number(((perfilOmr.marcaCuadradoQuietZone ?? 2) / (72 / 25.4)).toFixed(3)),
    ids: { tl: 0, tr: 1, bl: 2, br: 3 }
  };
}

function buildBlockSpec(perfilOmr: PerfilPlantillaOmr): BlockSpecOmr {
  return {
    preguntasPorBloque: perfilOmr.preguntasPorBloque ?? 10,
    opcionesPorPregunta: perfilOmr.opcionesPorPregunta ?? 5,
    bubbleDiameterMm: Number((((perfilOmr.burbujaRadio ?? 6) * 2) / (72 / 25.4)).toFixed(3)),
    bubblePitchYmm: Number(((perfilOmr.burbujaPasoY ?? 8) / (72 / 25.4)).toFixed(3)),
    labelToBubbleMm: Number((perfilOmr.labelToBubbleMm ?? 1.6).toFixed(3)),
    bubbleStrokePt: perfilOmr.bubbleStrokePt ?? 1
  };
}

function buildEngineHints(): EngineHintsOmr {
  return {
    preferredEngine: 'cv',
    enableClahe: true,
    adaptiveThreshold: true,
    conservativeDecision: true
  };
}

function buildCornerMarks(pageWidthPx: number, pageHeightPx: number, aPuntos: (px: number) => number) {
  const mmAPx = pageWidthPx / 612;
  const margenMm = 10;
  const s = 14;
  const inset = Math.max(12, Math.round((72 / 25.4) * margenMm * mmAPx));
  return {
    tipo: 'cuadrados' as const,
    size: aPuntos(s),
    quietZone: aPuntos(3),
    tl: { x: aPuntos(inset), y: aPuntos(inset) },
    tr: { x: aPuntos(pageWidthPx - inset - s), y: aPuntos(inset) },
    bl: { x: aPuntos(inset), y: aPuntos(pageHeightPx - inset - s) },
    br: { x: aPuntos(pageWidthPx - inset - s), y: aPuntos(pageHeightPx - inset - s) }
  };
}

function intersects(a: RectPx, b: RectPx): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export async function buildExamLayoutTokens({
  examen,
  perfilOmr,
  perfilLayout
}: {
  examen: ExamenPdf;
  perfilOmr: PerfilPlantillaOmr;
  perfilLayout: PerfilLayoutImpresion;
}): Promise<LayoutBuildResult> {
  const tpl = resolverLayoutTemplate(examen.layout.templateVersion);
  const { aPuntos, ajustarGrid } = resolverConvertidores(examen.layout.templateVersion);
  const pageShell: RectPx = {
    x: tpl.pageMarginPx,
    y: tpl.pageMarginPx,
    width: tpl.pageWidthPx - tpl.pageMarginPx * 2,
    height: tpl.pageHeightPx - tpl.pageMarginPx * 2
  };

  const contentWidth = pageShell.width;
  const headerFirstHeight = tpl.firstHeaderHeightPx;
  const headerOtherHeight = tpl.otherHeaderHeightPx;
  const footerHeight = tpl.footerHeightPx;
  const contentLeft = pageShell.x;
  const contentRight = pageShell.x + pageShell.width;
  const questionColumnWidth = contentWidth - tpl.omrColumnWidthPx - tpl.contentGapPx;
  const maxImageWidthPx = 166;
  const maxImageHeightPx = 70;
  const preguntasPorBloque = Math.max(1, perfilOmr.preguntasPorBloque ?? (examen.layout.templateVersion === 4 ? 8 : 10));

  const resolvedImages = await Promise.all(examen.preguntas.map((p) => resolverImagenPregunta(p.imagenUrl)));

  let imagesRequested = 0;
  let imagesRendered = 0;
  let imagesFailed = 0;
  for (const image of resolvedImages) {
    if (image.status === 'none') continue;
    imagesRequested += 1;
    if (image.status === 'ok' || image.status === 'fallback') imagesRendered += 1;
    if (image.status === 'error') imagesFailed += 1;
  }

  const preguntasOrdenadas = examen.mapaVariante.ordenPreguntas
    .map((id) => examen.preguntas.find((pregunta) => pregunta.id === id))
    .filter((pregunta): pregunta is ExamenPdf['preguntas'][number] => Boolean(pregunta));

  const pages: PageToken[] = [];
  const paginasMeta: ResultadoGeneracionPdf['paginas'] = [];
  const paginasOmr: PaginaOmr[] = [];
  const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
  const collisionsDetected: Array<{ pagina: number; a: string; b: string }> = [];
  const lineHeightViolations: Array<{ preguntaId: string; lineHeight: number; min: number }> = [];

  let questionIndex = 0;
  let pageNumber = 1;

  while (questionIndex < preguntasOrdenadas.length && pageNumber <= examen.layout.totalPaginas) {
    const firstPage = pageNumber === 1;
    const headerHeight = firstPage ? headerFirstHeight : headerOtherHeight;
    const footerBox: RectPx = {
      x: pageShell.x,
      y: tpl.pageHeightPx - tpl.pageMarginPx - footerHeight,
      width: pageShell.width,
      height: footerHeight
    };
    const headerBox = { x: pageShell.x, y: pageShell.y, width: pageShell.width, height: headerHeight };
    const contentBox: RectPx = {
      x: contentLeft,
      y: pageShell.y + headerHeight + tpl.minimumQuestionGapPx,
      width: pageShell.width,
      height: footerBox.y - (pageShell.y + headerHeight + tpl.minimumQuestionGapPx)
    };
    const qrBox = firstPage
      ? {
          x: pageShell.x + tpl.header.qrBox.x,
          y: pageShell.y + tpl.header.qrBox.y,
          width: tpl.header.qrBox.width,
          height: tpl.header.qrBox.height
        }
      : {
          x: pageShell.x + pageShell.width - 90,
          y: pageShell.y,
          width: 72,
          height: 72
        };

    const headerSlots: HeaderSlot[] = [];
    if (firstPage) {
      headerSlots.push(
        { id: 'logo-izquierdo-box', x: pageShell.x + tpl.header.leftLogoBox.x, y: pageShell.y + tpl.header.leftLogoBox.y, width: tpl.header.leftLogoBox.width, height: tpl.header.leftLogoBox.height },
        { id: 'titulo-box', x: pageShell.x + tpl.header.titleBox.x, y: pageShell.y + tpl.header.titleBox.y, width: tpl.header.titleBox.width, height: tpl.header.titleBox.height },
        { id: 'logo-derecho-box', x: pageShell.x + tpl.header.rightLogoBox.x, y: pageShell.y + tpl.header.rightLogoBox.y, width: tpl.header.rightLogoBox.width, height: tpl.header.rightLogoBox.height },
        { id: 'qr-box', x: qrBox.x, y: qrBox.y, width: qrBox.width, height: qrBox.height },
        { id: 'meta-box', x: pageShell.x + tpl.header.metaBox.x, y: pageShell.y + tpl.header.metaBox.y, width: tpl.header.metaBox.width, height: tpl.header.metaBox.height },
        { id: 'student-box', x: pageShell.x + tpl.header.studentBox.x, y: pageShell.y + tpl.header.studentBox.y, width: tpl.header.studentBox.width, height: tpl.header.studentBox.height },
        { id: 'group-box', x: pageShell.x + tpl.header.studentBox.x, y: pageShell.y + tpl.header.groupBox.y, width: tpl.header.groupBox.width, height: tpl.header.groupBox.height }
      );
    }

    const questionTokens: QuestionToken[] = [];
    let cursorY = contentBox.y;
    while (questionIndex < preguntasOrdenadas.length) {
      const pregunta = preguntasOrdenadas[questionIndex];
      const preguntaOriginal = examen.preguntas.find((item) => item.id === pregunta.id)!;
      const image = resolvedImages[examen.preguntas.findIndex((item) => item.id === pregunta.id)] ?? { status: 'none' as const };
      const optionColumns: 1 | 2 = 2;
      const opcionesOrdenadas = (examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? []).map((idx, optionIndex) => ({
        letra: String.fromCharCode(65 + optionIndex),
        texto: pregunta.opciones[idx]?.texto ?? ''
      }));
      while (opcionesOrdenadas.length < 5) {
        opcionesOrdenadas.push({ letra: String.fromCharCode(65 + opcionesOrdenadas.length), texto: '' });
      }

      const charsStem = 90;
      const stemLines = estimateLines(pregunta.enunciado, charsStem);
      const optionChunks = chunkOptions(opcionesOrdenadas, optionColumns);
      const optionLines = Math.max(
        ...optionChunks.map((col) => col.reduce((sum, item) => sum + Math.max(1, estimateLines(`${item.letra}) ${item.texto}`, 38)), 0))
      );

      const imageHeight =
        image.status === 'ok'
          ? Math.min(
              maxImageHeightPx,
              ajustarGrid(((image.heightPx ?? maxImageHeightPx) / Math.max(1, image.widthPx ?? maxImageWidthPx)) * maxImageWidthPx, 4)
            )
          : 0;
      const textHeight =
        stemLines * tpl.stemLineHeightPx +
        optionLines * tpl.optionLineHeightPx +
        10;
      const omrHeight = tpl.omr.panelHeightPx;
      const questionHeight = ajustarGrid(Math.max(omrHeight, textHeight) + tpl.questionPaddingPx * 2, 4);

      if (cursorY + questionHeight > contentBox.y + contentBox.height) {
        if (questionTokens.length === 0) {
          cursorY = contentBox.y;
        }
        break;
      }

      const questionBox: RectPx = {
        x: contentBox.x,
        y: cursorY,
        width: contentBox.width,
        height: questionHeight
      };
      const numberBox: RectPx = {
        x: questionBox.x,
        y: questionBox.y + 2,
        width: tpl.questionNumberWidthPx,
        height: tpl.questionNumberHeightPx
      };
      const textBox: RectPx = {
        x: questionBox.x + tpl.questionNumberWidthPx + 8,
        y: questionBox.y,
        width: questionColumnWidth - tpl.questionNumberWidthPx - 8,
        height: questionHeight
      };
      const omrBox: RectPx = {
        x: contentRight - tpl.omr.panelWidthPx,
        y: questionBox.y + Math.max(0, Math.floor((questionHeight - tpl.omr.panelHeightPx) / 2)),
        width: tpl.omr.panelWidthPx,
        height: tpl.omr.panelHeightPx
      };
      const imageBox = imageHeight > 0
        ? {
            x: textBox.x + Math.max(0, textBox.width - maxImageWidthPx),
            y: questionBox.y + 2,
            width: Math.min(textBox.width - 8, maxImageWidthPx),
            height: imageHeight
          }
        : undefined;

      questionTokens.push({
        id: pregunta.id,
        numero: questionIndex + 1,
        stemHtml: markdownBasicoAHtml(preguntaOriginal.enunciado),
        stemText: stripMarkdown(preguntaOriginal.enunciado),
        image: image.status === 'none' ? undefined : image,
        imageBox,
        opciones: opcionesOrdenadas,
        box: questionBox,
        numberBox,
        textBox,
        omrBox,
        optionColumns,
        lineHeightStem: tpl.stemLineHeightPx,
        lineHeightOption: tpl.optionLineHeightPx
      });

      if (tpl.stemLineHeightPx < 12) {
        lineHeightViolations.push({ preguntaId: pregunta.id, lineHeight: tpl.stemLineHeightPx, min: 12 });
      }
      if (tpl.optionLineHeightPx < 10.4) {
        lineHeightViolations.push({ preguntaId: pregunta.id, lineHeight: tpl.optionLineHeightPx, min: 10.4 });
      }

      cursorY += questionHeight + tpl.interQuestionGapPx;
      questionIndex += 1;
      if (questionTokens.length >= preguntasPorBloque) break;
    }

    if (questionTokens.length === 0) {
      throw new Error(`No fue posible acomodar la pregunta ${questionIndex + 1} dentro de la pagina ${pageNumber}`);
    }

    const firstQuestion = questionTokens[0];
    const lastQuestion = questionTokens[questionTokens.length - 1];
    const qrTexto = examen.generarTextoQrPagina(pageNumber, {
      preguntaDesde: firstQuestion?.numero,
      preguntaHasta: lastQuestion?.numero,
      questionIdsPagina: questionTokens.map((question) => question.id)
    });

    const pageToken: PageToken = {
      numeroPagina: pageNumber,
      qrTexto,
      pageShell,
      headerBox,
      headerSlots,
      footerBox,
      contentBox,
      qrBox,
      preguntas: questionTokens
    };
    pages.push(pageToken);

    for (let i = 0; i < questionTokens.length; i += 1) {
      const actual = questionTokens[i]!;
      for (let j = i + 1; j < questionTokens.length; j += 1) {
        const other = questionTokens[j]!;
        if (intersects(actual.box, other.box)) collisionsDetected.push({ pagina: pageNumber, a: actual.id, b: other.id });
      }
    }

    paginasMeta.push({
      numero: pageNumber,
      qrTexto,
      preguntasDel: firstQuestion.numero,
      preguntasAl: lastQuestion.numero
    });

    metricasPaginas.push({
      numero: pageNumber,
      fraccionVacia: Number(Math.max(0, (contentBox.y + contentBox.height - cursorY) / Math.max(1, contentBox.height)).toFixed(4)),
      preguntas: questionTokens.length
    });

    const pageOmrQuestions: PaginaOmr['preguntas'] = questionTokens.map((token) => {
      const omr = tpl.omr;
      const bubbleLeft = token.omrBox.x + omr.bubbleColumnX;
      const bubbleTop = token.omrBox.y + omr.headerBandHeightPx + omr.bubbleTopOffsetPx;
      const fidInset = omr.fiducialInsetPx;
      const fidSize = omr.fiducialSizePx;
      const fidHalf = fidSize / 2;
      const fidLeftCenterX = token.omrBox.x + fidInset + fidHalf;
      const fidRightCenterX = token.omrBox.x + token.omrBox.width - fidInset - fidHalf;
      const fidTopCenterY = token.omrBox.y + fidInset + fidHalf;
      const fidBottomCenterY = token.omrBox.y + token.omrBox.height - fidInset - fidHalf;
      const fidMidCenterY = token.omrBox.y + token.omrBox.height / 2;
      return {
        numeroPregunta: token.numero,
        idPregunta: token.id,
        opciones: token.opciones.map((opcion, idx) => ({
          letra: opcion.letra,
          x: aPuntos(bubbleLeft + omr.bubbleRadiusPx),
          y: aPuntos(bubbleTop + idx * omr.bubbleStepYPx + omr.bubbleRadiusPx)
        })),
        textRuns: [
          {
            tipo: 'texto',
            fuente: 'Helvetica-Bold',
            size: aPuntos(tpl.textFontPx),
            lineHeight: aPuntos(token.lineHeightStem),
            bbox: {
              x: aPuntos(token.textBox.x),
              y: aPuntos(token.textBox.y),
              width: aPuntos(token.textBox.width),
              height: aPuntos(Math.min(token.box.height, token.lineHeightStem * 3))
            }
          }
        ],
        imageRenderStatus: token.image?.status === 'ok' ? 'ok' : token.image?.status === 'error' ? 'error' : undefined,
        bboxPregunta: { x: aPuntos(token.box.x), y: aPuntos(token.box.y), width: aPuntos(token.box.width), height: aPuntos(token.box.height) },
        cajaOmr: { x: aPuntos(token.omrBox.x), y: aPuntos(token.omrBox.y), width: aPuntos(token.omrBox.width), height: aPuntos(token.omrBox.height) },
        perfilOmr: { radio: aPuntos(omr.bubbleRadiusPx), pasoY: aPuntos(omr.bubbleStepYPx), cajaAncho: aPuntos(omr.panelWidthPx) },
        fiduciales: {
          leftTop: { x: aPuntos(fidLeftCenterX), y: aPuntos(fidTopCenterY) },
          leftBottom: { x: aPuntos(fidLeftCenterX), y: aPuntos(fidBottomCenterY) },
          rightTop: { x: aPuntos(fidRightCenterX), y: aPuntos(fidTopCenterY) },
          rightBottom: { x: aPuntos(fidRightCenterX), y: aPuntos(fidBottomCenterY) },
          leftMid: { x: aPuntos(fidLeftCenterX), y: aPuntos(fidMidCenterY) },
          rightMid: { x: aPuntos(fidRightCenterX), y: aPuntos(fidMidCenterY) }
        }
      };
    });

    paginasOmr.push({
      numeroPagina: pageNumber,
      qr: { texto: qrTexto, x: aPuntos(qrBox.x), y: aPuntos(qrBox.y), size: aPuntos(qrBox.width), padding: aPuntos(8) },
      marcasPagina: buildCornerMarks(tpl.pageWidthPx, tpl.pageHeightPx, aPuntos),
      preguntas: pageOmrQuestions,
      layoutDebug: {
        engine: 'playwright-html-v1',
        layoutTemplateVersion: tpl.version,
        pageShell: { x: aPuntos(pageShell.x), y: aPuntos(pageShell.y), width: aPuntos(pageShell.width), height: aPuntos(pageShell.height) },
        header: headerBox ? { x: aPuntos(headerBox.x), y: aPuntos(headerBox.y), width: aPuntos(headerBox.width), height: aPuntos(headerBox.height) } : undefined,
        qr: { x: aPuntos(qrBox.x), y: aPuntos(qrBox.y), width: aPuntos(qrBox.width), height: aPuntos(qrBox.height) },
        headerTextBlocks: headerSlots.map((slot) => ({ id: slot.id, x: aPuntos(slot.x), y: aPuntos(slot.y), width: aPuntos(slot.width), height: aPuntos(slot.height) })),
        lineHeightViolations: lineHeightViolations.filter((item) => questionTokens.some((token) => token.id === item.preguntaId)),
        contentStartY: aPuntos(contentBox.y),
        contentEndY: aPuntos(cursorY),
        headerSlots: headerSlots.map((slot) => ({ id: slot.id, x: aPuntos(slot.x), y: aPuntos(slot.y), width: aPuntos(slot.width), height: aPuntos(slot.height) })),
        contentShell: { x: aPuntos(contentBox.x), y: aPuntos(contentBox.y), width: aPuntos(contentBox.width), height: aPuntos(contentBox.height) },
        footerShell: { x: aPuntos(footerBox.x), y: aPuntos(footerBox.y), width: aPuntos(footerBox.width), height: aPuntos(footerBox.height) },
        questionBlockBoxes: questionTokens.map((token) => ({ id: token.id, x: aPuntos(token.box.x), y: aPuntos(token.box.y), width: aPuntos(token.box.width), height: aPuntos(token.box.height) })),
        omrPanelBoxes: questionTokens.map((token) => ({ id: token.id, x: aPuntos(token.omrBox.x), y: aPuntos(token.omrBox.y), width: aPuntos(token.omrBox.width), height: aPuntos(token.omrBox.height) })),
        collisionBoxes: collisionsDetected.filter((c) => c.pagina === pageNumber)
      }
    });

    pageNumber += 1;
  }

  const preguntasRestantes = Math.max(0, preguntasOrdenadas.length - questionIndex);

  return {
    pages,
    paginas: paginasMeta,
    metricasPaginas,
    metricasLayout: {
      minLineHeightApplied: Math.min(tpl.stemLineHeightPx, tpl.optionLineHeightPx),
      preguntasConFormatoRico: preguntasOrdenadas.length,
      imagenesIntentadas: imagesRequested,
      imagenesRenderizadas: imagesRendered,
      imagenesFallidas: imagesFailed
    },
    renderDiagnostics: {
      preguntasCalculadas: preguntasOrdenadas.length,
      preguntasRenderizadas: pages.reduce((sum, page) => sum + page.preguntas.length, 0),
      pageFillRatios: metricasPaginas.map((page) => Number((1 - page.fraccionVacia).toFixed(4))),
      collisionsDetected,
      imagesRequested,
      imagesRendered,
      imagesFailed
    },
    mapaOmr: {
      margenMm: examen.layout.margenMm,
      templateVersion: examen.layout.templateVersion,
      markerSpec: buildMarkerSpec(perfilOmr),
      blockSpec: buildBlockSpec(perfilOmr),
      engineHints: buildEngineHints(),
      perfilLayout: {
        gridStepPt: aPuntos(tpl.gridPx),
        headerHeightFirst: aPuntos(tpl.firstHeaderHeightPx),
        headerHeightOther: aPuntos(tpl.otherHeaderHeightPx),
        bottomSafePt: aPuntos(tpl.footerHeightPx),
        usarRellenosDecorativos: perfilLayout.usarRellenosDecorativos,
        usarEtiquetaOmrSolida: perfilLayout.usarEtiquetaOmrSolida
      },
      perfil: {
        qrSize: aPuntos(tpl.header.qrBox.width),
        qrPadding: aPuntos(8),
        qrMarginModulos: perfilOmr.qrMarginModulos,
        marcasEsquina: 'cuadrados',
        marcaCuadradoSize: aPuntos(14),
        marcaCuadradoQuietZone: aPuntos(3),
        burbujaRadio: aPuntos(tpl.omr.bubbleRadiusPx),
        burbujaPasoY: aPuntos(tpl.omr.bubbleStepYPx),
        cajaOmrAncho: aPuntos(tpl.omr.panelWidthPx),
        fiducialSize: aPuntos(tpl.omr.fiducialSizePx),
        bubbleStrokePt: aPuntos(tpl.omr.bubbleStrokePx),
        labelToBubbleMm: perfilOmr.labelToBubbleMm,
        preguntasPorBloque,
        opcionesPorPregunta: 5
      },
      paginas: paginasOmr
    },
    preguntasRestantes
  };
}
