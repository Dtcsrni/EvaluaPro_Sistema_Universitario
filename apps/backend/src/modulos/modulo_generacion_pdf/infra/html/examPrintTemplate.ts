import type { ExamenPdf } from '../../domain/examenPdf';
import type { PageToken } from './examLayoutTokens';
import { LAYOUT_TEMPLATE_V9 } from '../../domain/layoutTemplateV9';
import { PDF_VISUAL_BASELINE } from '../pdfVisualBaseline';

const OMR = LAYOUT_TEMPLATE_V9.omr;
const PRINT_PROFILE = String(process.env.EXAM_PRINT_PROFILE ?? process.env.PDF_PRINT_PROFILE ?? '')
  .trim()
  .toLowerCase();
const IS_EPSON_ECOTANK_L1250 = PRINT_PROFILE === 'epson-ecotank-l1250' || (PRINT_PROFILE.includes('epson') && PRINT_PROFILE.includes('l1250'));

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function transformOutsideTags(html: string, transform: (text: string) => string): string {
  return String(html ?? '')
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith('<') ? part : transform(part)))
    .join('');
}

function applyTechnicalFormatting(text: string): string {
  let output = String(text ?? '');
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b(int|integer|float|double|decimal|char|string|str|boolean|bool|byte|short|long|real|void|array|vector|list|tuple|set|map|dict|objeto|registro)\b/gi, '<span class="q-tech-type">$1</span>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b(for|while|if|else|switch|case|break|continue|return|class|struct|public|private|protected|static|const|let|var|new|try|catch|finally|throw|throws|import|from|def|function|lambda)\b/gi, '<span class="q-tech-kw">$1</span>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b(true|false|null|none|undefined|nan|infinito|infinity)\b/gi, '<span class="q-tech-lit">$1</span>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b(para|hasta|si|sino|entonces|mientras|hacer|finsi|finpara|finmientras|algoritmo|inicio|fin|retornar|leer|escribir)\b/gi, '<span class="q-pseudo-kw">$1</span>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b([a-zA-Z_]\w*(?:\[[^]\n]{1,20}\])+)/g, '<code class="q-code-inline">$1</code>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b([a-zA-Z_][\w[\]()]*\s*(?:=|==|!=|<=|>=|<|>|:=)\s*[^,;\n]{1,40})/g, '<span class="q-code-frag">$1</span>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b([a-zA-Z0-9_]+(?:\s*[+\-*/×÷^]\s*[a-zA-Z0-9_]+){1,})\b/g, '<span class="q-math-inline">$1</span>')
  );
  return output;
}

function applySemanticColorToHtml(value: string): string {
  let html = transformOutsideTags(String(value ?? ''), applyTechnicalFormatting);

  html = html.replace(/<strong>(Importante:)<\/strong>/gi, '<strong class="tone-label tone-important">$1</strong>');
  html = html.replace(/<strong>(Advertencia:)<\/strong>/gi, '<strong class="tone-label tone-warning">$1</strong>');
  html = html.replace(/<strong>(Nota:)<\/strong>/gi, '<strong class="tone-label tone-note">$1</strong>');
  html = html.replace(/<strong>(Clave:)<\/strong>/gi, '<strong class="tone-label tone-key">$1</strong>');

  html = html.replace(/\b(NUNCA|EXCEPTO|INCORRECTA|FALSO)\b/gi, '<span class="tone-danger">$1</span>');
  html = html.replace(/\b(SIEMPRE|CORRECTA|VERDADERO)\b/gi, '<span class="tone-success">$1</span>');
  html = html.replace(/\b(UNICA|ÚNICA|UNICAMENTE|ÚNICAMENTE|SOLO|SÓLO)\b/gi, '<span class="tone-focus">$1</span>');

  return html;
}

function applySemanticColorToPlainText(value: string): string {
  let html = escapeHtml(value ?? '');
  html = applyTechnicalFormatting(html);
  html = html.replace(/\b(nunca|excepto|incorrecta|falso)\b/gi, '<span class="tone-danger">$1</span>');
  html = html.replace(/\b(siempre|correcta|verdadero)\b/gi, '<span class="tone-success">$1</span>');
  html = html.replace(/\b(unica|única|unicamente|únicamente|solo|sólo)\b/gi, '<span class="tone-focus">$1</span>');
  return html;
}

function renderQuickOmrInstruction(page: PageToken): string {
  if (page.numeroPagina !== 1) return '';
  const text =
    'Instrucción: rellena un solo círculo por pregunta. Correcto: círculo completamente lleno (●). ' +
    'Incorrecto: medio relleno (◐), tachado (✗) o dos opciones marcadas.';
  const x = page.contentBox.x;
  const y = Math.max(0, page.contentBox.y - 20);
  const width = page.contentBox.width;
  return `<div class="quick-omr-instruction" style="left:${x}px;top:${y}px;width:${width}px;">${escapeHtml(text)}</div>`;
}

function renderHeader(page: PageToken, examen: ExamenPdf, logos: { izquierda?: string; derecha?: string }): string {
  if (!page.headerBox || page.numeroPagina !== 1) return '';
  const qrLeft = Math.max(0, page.qrBox.x - page.headerBox.x);
  const qrTop = Math.max(0, page.qrBox.y - page.headerBox.y);
  const carrera = 'Ingeniería en sistemas computacionales';
  const leftLogoLeft = 8;
  const logoWidth = 78;
  const rightLogoRightInset = 136;
  const rightLogoLeft = page.headerBox.width - rightLogoRightInset - logoWidth;
  const textLeft = leftLogoLeft + logoWidth + 12;
  const textRight = Math.min(rightLogoLeft - 12, qrLeft - 12);
  const textMaxWidth = Math.max(220, textRight - textLeft);
  const captureLabelWidth = 110;
  const captureGroupLabelWidth = 44;
  const captureGapWidth = 6 * 3;
  const captureGroupMinWidth = 48;
  const captureGroupMaxWidth = 72;
  let captureGroupWidth = Math.max(captureGroupMinWidth, Math.min(captureGroupMaxWidth, Math.floor(textMaxWidth * 0.18)));
  const captureFixedWidthBase = captureLabelWidth + captureGroupLabelWidth + captureGapWidth;
  const captureNameMinWidth = 180;
  let captureNameWidth = textMaxWidth - (captureFixedWidthBase + captureGroupWidth);
  if (captureNameWidth < captureNameMinWidth) {
    const deficit = captureNameMinWidth - captureNameWidth;
    captureGroupWidth = Math.max(captureGroupMinWidth, captureGroupWidth - deficit);
    captureNameWidth = textMaxWidth - (captureFixedWidthBase + captureGroupWidth);
  }
  captureNameWidth = Math.max(captureNameMinWidth, captureNameWidth);
  const grupoSugerido = String(examen.encabezado?.alumno?.grupo ?? '').trim();
  const desiredMetaTop = 64;
  const desiredSecondaryMetaTop = 78;
  const desiredCaptureTop = 90;
  const captureBoxHeight = 26;
  const maxCaptureTop = Math.max(0, page.headerBox.height - captureBoxHeight - 4);
  const captureTop = Math.min(desiredCaptureTop, maxCaptureTop);
  const secondaryMetaTop = Math.min(desiredSecondaryMetaTop, Math.max(0, captureTop - 14));
  const metaTop = Math.min(desiredMetaTop, Math.max(0, secondaryMetaTop - 14));
  const leftLogo = logos.izquierda
    ? `<img class="header-logo header-logo-left" src="${logos.izquierda}" alt="logo izquierdo" />`
    : '<div class="header-logo header-logo-left logo-placeholder"></div>';
  const rightLogo = logos.derecha
    ? `<img class="header-logo header-logo-right" src="${logos.derecha}" alt="logo derecho" />`
    : '<div class="header-logo header-logo-right logo-placeholder"></div>';
  return `
    <section class="header-shell" style="left:${page.headerBox.x}px;top:${page.headerBox.y}px;width:${page.headerBox.width}px;height:${page.headerBox.height}px;">
      <div class="header-band"></div>
      ${leftLogo}
      <div class="title-box" style="left:${textLeft}px;top:10px;width:${textMaxWidth}px;">
        <div class="institution">${escapeHtml(examen.encabezado?.institucion ?? 'Centro Universitario Hidalguense')}</div>
        <div class="exam-title">${escapeHtml(examen.titulo)}</div>
        <div class="motto">${escapeHtml(examen.encabezado?.lema ?? 'La sabiduria es nuestra fuerza')}</div>
      </div>
      <div class="meta meta-slot" style="left:${textLeft}px;top:${metaTop}px;width:${textMaxWidth}px;">Materia: ${escapeHtml(examen.encabezado?.materia ?? '')}</div>
      <div class="meta meta-secondary" style="left:${textLeft}px;top:${secondaryMetaTop}px;width:${textMaxWidth}px;">Docente: ${escapeHtml(examen.encabezado?.docente ?? '')} | Carrera: ${escapeHtml(carrera)}${
    grupoSugerido ? ` | Grupo: ${escapeHtml(grupoSugerido)}` : ''
  }</div>
      ${rightLogo}
      <div class="qr-box" style="left:${qrLeft}px;top:${qrTop}px;width:${page.qrBox.width}px;height:${page.qrBox.height}px;">
        <img src="{{QR:${page.numeroPagina}}}" alt="QR pagina ${page.numeroPagina}" />
      </div>
      <div class="capture-row capture-row-inline" style="left:${textLeft}px;top:${captureTop}px;width:${textMaxWidth}px;">
        <span class="capture-label">Nombre del alumno</span>
        <div class="capture-box capture-box-name" style="width:${captureNameWidth}px;flex-basis:${captureNameWidth}px;"></div>
        <span class="capture-label capture-label-group">Grupo</span>
        <div class="capture-box capture-box-group" style="width:${captureGroupWidth}px;flex-basis:${captureGroupWidth}px;"></div>
      </div>
    </section>`;
}

function renderQuestion(page: PageToken, index: number): string {
  const question = page.preguntas[index]!;
  const optionColumns = question.optionColumns === 1 ? 'options-single' : 'options-double';
  const optionGroups = question.optionColumns === 1
    ? [question.opciones]
    : [question.opciones.slice(0, Math.ceil(question.opciones.length / 2)), question.opciones.slice(Math.ceil(question.opciones.length / 2))];
  const withImage = Boolean(question.imageBox && question.image?.dataUrl);
  const contentClass = withImage ? 'question-content has-image' : 'question-content';
  const imageHtml = question.imageBox && question.image?.dataUrl
    ? `<figure class="question-image" style="width:${question.imageBox.width}px;height:${question.imageBox.height}px;"><img src="${question.image.dataUrl}" alt="Imagen de la pregunta ${question.numero}" /><figcaption class="question-image-caption">Figura P${question.numero}</figcaption></figure>`
    : '';
  const omrMarks = question.opciones
    .map((option, optionIndex) => {
      const bubbleTop = OMR.headerBandHeightPx + OMR.bubbleTopOffsetPx + optionIndex * OMR.bubbleStepYPx;
      const labelTop = bubbleTop + Math.max(1, Math.round((OMR.bubbleRadiusPx * 2 - 12) / 2));
      return `<span class="bubble" style="top:${bubbleTop}px;"></span><span class="choice" style="top:${labelTop}px;">${option.letra}</span>`;
    })
    .join('');
  return `
    <section class="question-block" style="left:${question.box.x}px;top:${question.box.y}px;width:${question.box.width}px;height:${question.box.height}px;">
      <div class="question-number" style="left:${question.numberBox.x - question.box.x}px;top:${question.numberBox.y - question.box.y}px;width:${question.numberBox.width}px;height:${question.numberBox.height}px;">${question.numero}</div>
      <div class="question-text" style="left:${question.textBox.x - question.box.x}px;top:${question.textBox.y - question.box.y}px;width:${question.textBox.width}px;height:${question.textBox.height}px;">
        <div class="question-row">
          <div class="${contentClass}">
            <div class="question-stem">${applySemanticColorToHtml(question.stemHtml)}</div>
            <div class="question-options ${optionColumns}">
              ${optionGroups.map((group) => `<div class="option-column">${group.map((option) => `<div class="option-item"><span class="option-prefix">${option.letra})</span> <span>${applySemanticColorToPlainText(option.texto)}</span></div>`).join('')}</div>`).join('')}
            </div>
          </div>
          ${imageHtml}
        </div>
      </div>
      <div class="omr-panel" style="left:${question.omrBox.x - question.box.x}px;top:${question.omrBox.y - question.box.y}px;width:${question.omrBox.width}px;height:${question.omrBox.height}px;">
        <div class="omr-id">#${question.numero}</div>
        <div class="omr-label">RESP</div>
        <div class="omr-frame">
          <span class="fid fid-tl"></span>
          <span class="fid fid-tr"></span>
          <span class="fid fid-bl"></span>
          <span class="fid fid-br"></span>
          <span class="fid fid-lm"></span>
          <span class="fid fid-rm"></span>
          ${omrMarks}
        </div>
      </div>
    </section>`;
}

export function renderExamHtml({
  pages,
  examen,
  qrDataUrls,
  logos
}: {
  pages: PageToken[];
  examen: ExamenPdf;
  qrDataUrls: Record<number, string>;
  logos: { izquierda?: string; derecha?: string };
}): string {
  const bodyClass = IS_EPSON_ECOTANK_L1250 ? 'print-profile-epson-l1250' : '';
  const printerProfileCss = IS_EPSON_ECOTANK_L1250
    ? `
    body.print-profile-epson-l1250 {
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body.print-profile-epson-l1250 .page-shell {
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
    }
    body.print-profile-epson-l1250 .staple-zone {
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    body.print-profile-epson-l1250 .staple-zone::after {
      color: ${PDF_VISUAL_BASELINE.textSoftHex};
    }
    body.print-profile-epson-l1250 .header-shell {
      background: ${PDF_VISUAL_BASELINE.accentSoftHex};
      background-image: none;
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
    }
    body.print-profile-epson-l1250 .header-band {
      background: ${PDF_VISUAL_BASELINE.accentHex};
      box-shadow: none;
    }
    body.print-profile-epson-l1250 .institution,
    body.print-profile-epson-l1250 .exam-title,
    body.print-profile-epson-l1250 .meta,
    body.print-profile-epson-l1250 .motto,
    body.print-profile-epson-l1250 .capture-label,
    body.print-profile-epson-l1250 .footer,
    body.print-profile-epson-l1250 .option-item,
    body.print-profile-epson-l1250 .option-prefix,
    body.print-profile-epson-l1250 .choice,
    body.print-profile-epson-l1250 .omr-label,
    body.print-profile-epson-l1250 .question-image-caption {
      color: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    body.print-profile-epson-l1250 .footer-exam,
    body.print-profile-epson-l1250 .footer-id,
    body.print-profile-epson-l1250 .footer-subject,
    body.print-profile-epson-l1250 .footer-page-badge {
      color: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    body.print-profile-epson-l1250 .footer-page-badge {
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    body.print-profile-epson-l1250 .footer-id {
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      color: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    body.print-profile-epson-l1250 .tone-danger,
    body.print-profile-epson-l1250 .tone-success,
    body.print-profile-epson-l1250 .tone-focus,
    body.print-profile-epson-l1250 .tone-label,
    body.print-profile-epson-l1250 .tone-important,
    body.print-profile-epson-l1250 .tone-warning,
    body.print-profile-epson-l1250 .tone-note,
    body.print-profile-epson-l1250 .tone-key {
      color: ${PDF_VISUAL_BASELINE.primaryHex} !important;
    }
    body.print-profile-epson-l1250 .q-math-inline,
    body.print-profile-epson-l1250 .q-math-line,
    body.print-profile-epson-l1250 .q-code-inline,
    body.print-profile-epson-l1250 .q-code-frag,
    body.print-profile-epson-l1250 .q-tech-type,
    body.print-profile-epson-l1250 .q-tech-kw,
    body.print-profile-epson-l1250 .q-tech-lit,
    body.print-profile-epson-l1250 .q-pseudo-kw {
      color: ${PDF_VISUAL_BASELINE.primaryHex} !important;
      background: transparent !important;
      border-color: ${PDF_VISUAL_BASELINE.lineHex} !important;
    }
    body.print-profile-epson-l1250 .capture-box,
    body.print-profile-epson-l1250 .qr-box {
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    body.print-profile-epson-l1250 .question-number {
      background: ${PDF_VISUAL_BASELINE.accentSoftHex};
      background-image: none;
      border-color: ${PDF_VISUAL_BASELINE.lineHex};
      color: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    body.print-profile-epson-l1250 .question-image {
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      background-image: none;
      border: none;
    }
    body.print-profile-epson-l1250 .omr-id {
      background: ${PDF_VISUAL_BASELINE.primaryHex};
      background-image: none;
      color: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    body.print-profile-epson-l1250 .omr-frame {
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      background-image: none;
      border-color: ${PDF_VISUAL_BASELINE.blackHex};
      border-width: 2px;
    }
    body.print-profile-epson-l1250 .bubble {
      border-color: ${PDF_VISUAL_BASELINE.blackHex};
      border-width: 2px;
      background: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    `
    : '';
  const css = `
    @page { size: Letter; margin: 0; }
    :root {
      --edu-navy: ${PDF_VISUAL_BASELINE.primaryHex};
      --edu-blue: ${PDF_VISUAL_BASELINE.accentHex};
      --edu-blue-soft: ${PDF_VISUAL_BASELINE.accentHex};
      --edu-cyan: ${PDF_VISUAL_BASELINE.accentHex};
      --edu-violet: ${PDF_VISUAL_BASELINE.accentHex};
      --edu-emerald: ${PDF_VISUAL_BASELINE.accentHex};
      --edu-bg-soft: ${PDF_VISUAL_BASELINE.accentSoftHex};
      --edu-bg-quiet: ${PDF_VISUAL_BASELINE.sectionHex};
      --edu-border: ${PDF_VISUAL_BASELINE.lineHex};
      --edu-border-strong: ${PDF_VISUAL_BASELINE.lineHex};
      --edu-text: ${PDF_VISUAL_BASELINE.primaryHex};
      --edu-text-muted: ${PDF_VISUAL_BASELINE.textSoftHex};
      --edu-surface: ${PDF_VISUAL_BASELINE.whiteHex};
      --edu-ink-soft: ${PDF_VISUAL_BASELINE.textSoftHex};
      --tone-danger: ${PDF_VISUAL_BASELINE.primaryHex};
      --tone-success: ${PDF_VISUAL_BASELINE.primaryHex};
      --tone-focus: ${PDF_VISUAL_BASELINE.primaryHex};
      --tone-important: ${PDF_VISUAL_BASELINE.accentHex};
      --tone-warning: ${PDF_VISUAL_BASELINE.primaryHex};
      --tone-note: ${PDF_VISUAL_BASELINE.accentHex};
      --tone-key: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--edu-text);
      background: ${PDF_VISUAL_BASELINE.sectionHex};
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      font-kerning: normal;
    }
    .page { position: relative; width: 816px; height: 1056px; background: var(--edu-surface); page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .staple-zone {
      position: absolute;
      left: 8px;
      top: 8px;
      width: 22px;
      height: 22px;
      border: 1px dashed ${PDF_VISUAL_BASELINE.lineHex};
      border-radius: 5px;
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      z-index: 3;
      pointer-events: none;
    }
    .staple-zone::after {
      content: '⦿';
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 8px;
      line-height: 1;
      color: ${PDF_VISUAL_BASELINE.textSoftHex};
    }
    .page-shell {
      position: absolute;
      inset: 32px;
      border: 1px solid ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.whiteHex};
    }
    .header-shell {
      position: absolute;
      border: 1px solid var(--edu-border);
      background-color: var(--edu-bg-soft);
      background-image: none;
    }
    .header-shell > * { position: absolute; z-index: 1; }
    .header-band {
      left: 2px;
      right: 2px;
      top: 2px;
      height: 4px;
      background: ${PDF_VISUAL_BASELINE.accentHex};
      background-size: auto;
      box-shadow: none;
      opacity: 0.98;
      border-radius: 999px;
    }
    .header-band::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 1px;
      height: 1px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.14), rgba(255,255,255,0.55));
      opacity: 0.85;
    }
    .header-logo { object-fit: contain; object-position: center; background: transparent; }
    .header-logo-left { left: 8px; top: 50%; transform: translateY(-50%); width: 78px; height: 78px; }
    .header-logo-right { right: 136px; top: 50%; transform: translateY(-50%); width: 78px; height: 78px; }
    .logo-placeholder { border: 1px dashed var(--edu-border); background: transparent; }
    .title-box { position: absolute; width: 376px; text-align: center; }
    .institution { font-size: 16px; line-height: 19px; font-weight: 800; color: ${PDF_VISUAL_BASELINE.accentHex}; letter-spacing: 0.12px; }
    .exam-title { margin-top: 2px; font-size: 18px; line-height: 21px; font-weight: 800; letter-spacing: 0.16px; color: ${PDF_VISUAL_BASELINE.primaryHex}; }
    .motto { margin-top: 2px; font-size: 9.6px; line-height: 11px; font-style: italic; color: var(--edu-ink-soft); }
    .meta { margin-top: 0; font-size: 10.6px; line-height: 12px; color: var(--edu-text-muted); font-weight: 650; letter-spacing: 0.06px; text-align: center; }
    .meta-slot { position: absolute; margin-top: 0; }
    .meta-secondary { position: absolute; margin-top: 0; }
    .qr-box { position: absolute; border: 1px solid var(--edu-border); background: ${PDF_VISUAL_BASELINE.whiteHex}; padding: 10px; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .capture-row { position: absolute; display: flex; align-items: center; gap: 10px; }
    .capture-row-inline { gap: 8px; }
    .capture-label { font-size: 10px; line-height: 13px; font-weight: 700; min-width: 110px; flex: 0 0 110px; color: ${PDF_VISUAL_BASELINE.primaryHex}; }
    .capture-label-group { min-width: 44px; flex: 0 0 44px; text-align: right; }
    .capture-box {
      border: 1.6px solid var(--edu-border-strong);
      background: ${PDF_VISUAL_BASELINE.whiteHex};
      height: 26px;
    }
    .capture-box-name { flex: 0 0 auto; }
    .capture-box-group { flex: 0 0 auto; }
    .question-block { position: absolute; }
    .question-number {
      position: absolute;
      border: 1.8px solid ${PDF_VISUAL_BASELINE.lineHex};
      background-color: ${PDF_VISUAL_BASELINE.accentSoftHex};
      background-image: none;
      font-size: 17px;
      line-height: 20px;
      font-weight: 800;
      text-align: center;
      padding-top: 1px;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
    }
    .question-text { position: absolute; padding-right: 12px; }
    .question-row { display: flex; align-items: flex-start; gap: 8px; width: 100%; }
    .question-content { min-width: 0; flex: 1 1 auto; }
    .question-content.has-image { max-width: calc(100% - 176px); }
    .question-stem { font-size: 13px; line-height: 16.6px; font-weight: 680; letter-spacing: 0.05px; }
    .question-stem p { margin: 0 0 3px 0; }
    .question-stem ul { margin: 3px 0 3px 18px; padding: 0; }
    .question-stem li { margin: 0 0 2px 0; }
    .question-stem code, .q-code { font-family: Consolas, 'Courier New', monospace; }
    .q-math-inline { color: ${PDF_VISUAL_BASELINE.accentHex}; font-weight: 760; letter-spacing: 0.02px; }
    .q-math-line { color: ${PDF_VISUAL_BASELINE.accentHex}; font-weight: 760; }
    .q-code-inline {
      font-family: Consolas, 'Courier New', monospace;
      background: rgba(15, 23, 42, 0.06);
      border: 1px solid rgba(15, 23, 42, 0.18);
      border-radius: 3px;
      padding: 0 2px;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      font-weight: 650;
    }
    .q-code-frag {
      font-family: Consolas, 'Courier New', monospace;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      background: rgba(13, 117, 179, 0.08);
      border-radius: 3px;
      padding: 0 2px;
      font-weight: 650;
    }
    .q-tech-type {
      color: ${PDF_VISUAL_BASELINE.accentHex};
      font-weight: 800;
      font-style: italic;
      letter-spacing: 0.02px;
    }
    .q-tech-kw {
      color: ${PDF_VISUAL_BASELINE.accentHex};
      font-weight: 800;
      font-style: italic;
      letter-spacing: 0.02px;
    }
    .q-tech-lit {
      color: ${PDF_VISUAL_BASELINE.accentHex};
      font-weight: 760;
      font-style: italic;
    }
    .q-pseudo-kw { color: ${PDF_VISUAL_BASELINE.accentHex}; font-weight: 800; letter-spacing: 0.02px; }
    .question-image {
      margin: 2px 0 0 0;
      border: none;
      background-color: ${PDF_VISUAL_BASELINE.whiteHex};
      background-image: none;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 0 0 auto;
    }
    .question-image img { width: 100%; height: calc(100% - 10px); object-fit: contain; display: block; }
    .question-image-caption { display: block; margin: 0; padding: 0 2px; font-size: 8px; line-height: 10px; font-weight: 600; color: ${PDF_VISUAL_BASELINE.textSoftHex}; text-align: center; background: rgba(255,255,255,0.92); border-top: none; }
    .question-options { display: grid; gap: 8px; margin-top: 3px; }
    .options-double { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .options-single { grid-template-columns: minmax(0, 1fr); }
    .option-item { font-size: 11.2px; line-height: 13.2px; margin-bottom: 1px; break-inside: avoid; font-weight: 520; color: ${PDF_VISUAL_BASELINE.primaryHex}; }
    .option-prefix { font-weight: 750; color: ${PDF_VISUAL_BASELINE.accentHex}; }
    .tone-label { font-weight: 800; letter-spacing: 0.12px; }
    .tone-danger { color: var(--tone-danger); font-weight: 760; }
    .tone-success { color: var(--tone-success); font-weight: 760; }
    .tone-focus { color: var(--tone-focus); font-weight: 760; }
    .tone-important { color: var(--tone-important); }
    .tone-warning { color: var(--tone-warning); }
    .tone-note { color: var(--tone-note); }
    .tone-key { color: var(--tone-key); }
    .omr-panel { position: absolute; }
    .omr-id {
      position: absolute;
      left: 2px;
      top: 0;
      width: 18px;
      height: 14px;
      border-radius: 10px;
      background-color: ${PDF_VISUAL_BASELINE.primaryHex};
      background-image: none;
      color: white;
      font-size: 10px;
      line-height: 14px;
      font-weight: 800;
      text-align: center;
      z-index: 2;
    }
    .omr-label { position: absolute; top: 0; left: 28px; font-size: 10px; line-height: 12px; font-weight: 760; letter-spacing: 0.45px; color: ${PDF_VISUAL_BASELINE.primaryHex}; }
    .omr-frame {
      position: absolute;
      inset: 0;
      border: 1.8px solid ${PDF_VISUAL_BASELINE.blackHex};
      background-color: ${PDF_VISUAL_BASELINE.whiteHex};
      background-image: none;
    }
    .fid {
      position: absolute;
      width: ${OMR.fiducialSizePx}px;
      height: ${OMR.fiducialSizePx}px;
      background: #000000;
      box-sizing: content-box;
      border: 1px solid #ffffff;
    }
    .fid-tl { left: ${OMR.fiducialInsetPx}px; top: ${OMR.fiducialInsetPx}px; }
    .fid-tr { right: ${OMR.fiducialInsetPx}px; top: ${OMR.fiducialInsetPx}px; }
    .fid-bl { left: ${OMR.fiducialInsetPx}px; bottom: ${OMR.fiducialInsetPx}px; }
    .fid-br { right: ${OMR.fiducialInsetPx}px; bottom: ${OMR.fiducialInsetPx}px; }
    .fid-lm { left: ${OMR.fiducialInsetPx}px; top: calc(50% - ${Math.round(OMR.fiducialSizePx / 2)}px); }
    .fid-rm { right: ${OMR.fiducialInsetPx}px; top: calc(50% - ${Math.round(OMR.fiducialSizePx / 2)}px); }
    .bubble { position: absolute; left: ${OMR.bubbleColumnX}px; width: ${OMR.bubbleRadiusPx * 2}px; height: ${OMR.bubbleRadiusPx * 2}px; border: 1.8px solid ${PDF_VISUAL_BASELINE.blackHex}; border-radius: 50%; background: ${PDF_VISUAL_BASELINE.whiteHex}; display: inline-block; }
    .choice { position: absolute; left: ${OMR.labelColumnX}px; font-size: 10px; line-height: 12px; font-weight: 720; color: ${PDF_VISUAL_BASELINE.primaryHex}; }
    .footer {
      position: absolute;
      left: 56px;
      right: 56px;
      bottom: 32px;
      height: 28px;
      border-top: 1px solid ${PDF_VISUAL_BASELINE.lineHex};
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      padding: 0 8px;
      font-size: 9.6px;
      letter-spacing: 0.16px;
      color: ${PDF_VISUAL_BASELINE.textSoftHex};
    }
    .footer-exam,
    .footer-id,
    .footer-subject {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 620;
    }
    .footer-exam {
      flex: 1 1 auto;
      max-width: calc(100% - 226px);
      color: ${PDF_VISUAL_BASELINE.textSoftHex};
    }
    .footer-id {
      flex: 0 0 auto;
      max-width: 170px;
      font-size: 8.8px;
      font-weight: 760;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      letter-spacing: 0.12px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.accentSoftHex};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
    .footer-subject {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(45%, 280px);
      text-align: center;
      color: ${PDF_VISUAL_BASELINE.textSoftHex};
      font-weight: 700;
      pointer-events: none;
    }
    .footer-page-badge {
      margin-left: auto;
      flex: 0 0 auto;
      min-width: 74px;
      text-align: center;
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid ${PDF_VISUAL_BASELINE.lineHex};
      background: ${PDF_VISUAL_BASELINE.accentSoftHex};
      font-size: 9.8px;
      font-weight: 800;
      letter-spacing: 0.22px;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      line-height: 1.1;
    }
    .corner {
      position: absolute;
      width: 14px;
      height: 14px;
      background: #000;
      box-sizing: content-box;
      border: 3px solid #fff;
      z-index: 0;
      pointer-events: none;
    }
    .corner.tl { left: 38px; top: 38px; }
    .corner.tr { right: 38px; top: 38px; }
    .corner.bl { left: 38px; bottom: 38px; }
    .corner.br { right: 38px; bottom: 38px; }
    .corner.tm { left: calc(50% - 7px); top: 12px; }
    .corner.bm { left: calc(50% - 7px); bottom: 12px; }
    .quick-omr-instruction {
      position: absolute;
      z-index: 8;
      font-size: 8.6px;
      line-height: 10px;
      font-weight: 700;
      letter-spacing: 0.08px;
      text-align: center;
      color: ${PDF_VISUAL_BASELINE.primaryHex};
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid ${PDF_VISUAL_BASELINE.lineHex};
      border-radius: 3px;
      padding: 1px 5px;
      white-space: normal;
      pointer-events: none;
    }
    ${printerProfileCss}
  `;

  const pagesHtml = pages
    .map((page) => {
      let html = `<section class="page"><div class="staple-zone" aria-hidden="true"></div><div class="page-shell"></div><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span><span class="corner tm"></span><span class="corner bm"></span>`;
      html += renderHeader(page, examen, logos).replace(`{{QR:${page.numeroPagina}}}`, qrDataUrls[page.numeroPagina] ?? '');
      html += renderQuickOmrInstruction(page);
      html += page.preguntas.map((_q, idx) => renderQuestion(page, idx)).join('');
      const materiaFooter = escapeHtml(examen.encabezado?.materia ?? 'Materia no especificada');
      const examIdFooter = escapeHtml(String(examen.examId ?? examen.folio).trim().toUpperCase());
      html += `<footer class="footer"><span class="footer-exam">${escapeHtml(examen.titulo)}</span><span class="footer-id">ID: ${examIdFooter}</span><span class="footer-subject">${materiaFooter}</span><span class="footer-page-badge">Página ${page.numeroPagina}</span></footer>`;
      html += '</section>';
      return html;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body class="${bodyClass}">${pagesHtml}</body></html>`;
}
