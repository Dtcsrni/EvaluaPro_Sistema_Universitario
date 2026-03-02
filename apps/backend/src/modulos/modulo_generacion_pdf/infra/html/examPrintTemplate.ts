import type { ExamenPdf } from '../../domain/examenPdf';
import type { PageToken } from './examLayoutTokens';
import { LAYOUT_TEMPLATE_V9 } from '../../domain/layoutTemplateV9';

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
    segment.replace(/\b([a-zA-Z_]\w*(?:\[[^\]\n]{1,20}\])+)\b/g, '<code class="q-code-inline">$1</code>')
  );
  output = transformOutsideTags(output, (segment) =>
    segment.replace(/\b([a-zA-Z_][\w\[\]\(\)]*\s*(?:=|==|!=|<=|>=|<|>|:=)\s*[^,;\n]{1,40})/g, '<span class="q-code-frag">$1</span>')
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
      background: #ffffff;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body.print-profile-epson-l1250 .page-shell {
      background: #ffffff;
      border-color: #b8bec8;
    }
    body.print-profile-epson-l1250 .staple-zone {
      border-color: rgba(55, 65, 81, 0.4);
      background: #ffffff;
    }
    body.print-profile-epson-l1250 .staple-zone::after {
      color: rgba(55, 65, 81, 0.62);
    }
    body.print-profile-epson-l1250 .header-shell {
      background: #ffffff;
      background-image:
        repeating-linear-gradient(60deg, rgba(31,41,55,0.045) 0 1px, transparent 1px 18px),
        repeating-linear-gradient(-60deg, rgba(31,41,55,0.045) 0 1px, transparent 1px 18px),
        repeating-linear-gradient(0deg, rgba(31,41,55,0.03) 0 1px, transparent 1px 18px);
      border-color: #8e99a9;
    }
    body.print-profile-epson-l1250 .header-band {
      background: linear-gradient(90deg, #2563eb 0%, #0284c7 24%, #16a34a 50%, #7c3aed 76%, #2563eb 100%);
      box-shadow: 0 0 0.5px rgba(30, 64, 175, 0.9), 0 0 4px rgba(2, 132, 199, 0.35);
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
      color: #1f2937;
    }
    body.print-profile-epson-l1250 .footer-exam,
    body.print-profile-epson-l1250 .footer-id,
    body.print-profile-epson-l1250 .footer-subject,
    body.print-profile-epson-l1250 .footer-page-badge {
      color: #1f2937;
    }
    body.print-profile-epson-l1250 .footer-page-badge {
      border-color: #4b5563;
      background: #ffffff;
    }
    body.print-profile-epson-l1250 .footer-id {
      border-color: #4b5563;
      background: #ffffff;
      color: #1f2937;
    }
    body.print-profile-epson-l1250 .tone-danger,
    body.print-profile-epson-l1250 .tone-success,
    body.print-profile-epson-l1250 .tone-focus,
    body.print-profile-epson-l1250 .tone-label,
    body.print-profile-epson-l1250 .tone-important,
    body.print-profile-epson-l1250 .tone-warning,
    body.print-profile-epson-l1250 .tone-note,
    body.print-profile-epson-l1250 .tone-key {
      color: #1f2937 !important;
    }
    body.print-profile-epson-l1250 .q-math-inline,
    body.print-profile-epson-l1250 .q-math-line,
    body.print-profile-epson-l1250 .q-code-inline,
    body.print-profile-epson-l1250 .q-code-frag,
    body.print-profile-epson-l1250 .q-tech-type,
    body.print-profile-epson-l1250 .q-tech-kw,
    body.print-profile-epson-l1250 .q-tech-lit,
    body.print-profile-epson-l1250 .q-pseudo-kw {
      color: #111827 !important;
      background: transparent !important;
      border-color: #374151 !important;
    }
    body.print-profile-epson-l1250 .capture-box,
    body.print-profile-epson-l1250 .qr-box {
      border-color: #374151;
      background: #ffffff;
    }
    body.print-profile-epson-l1250 .question-number {
      background: #ffffff;
      background-image:
        repeating-linear-gradient(60deg, rgba(31,41,55,0.08) 0 1px, transparent 1px 12px),
        repeating-linear-gradient(-60deg, rgba(31,41,55,0.08) 0 1px, transparent 1px 12px),
        repeating-linear-gradient(0deg, rgba(31,41,55,0.05) 0 1px, transparent 1px 12px);
      border-color: #334155;
      color: #1f2937;
    }
    body.print-profile-epson-l1250 .question-image {
      background: #ffffff;
      background-image: none;
      border: none;
    }
    body.print-profile-epson-l1250 .omr-id {
      background: #111827;
      background-image: none;
      color: #ffffff;
    }
    body.print-profile-epson-l1250 .omr-frame {
      background: #ffffff;
      background-image:
        radial-gradient(circle, rgba(17,24,39,0.12) 0.6px, transparent 0.8px);
      background-size: 8px 8px;
      border-color: #111827;
      border-width: 2px;
    }
    body.print-profile-epson-l1250 .bubble {
      border-color: #111827;
      border-width: 2px;
      background: #ffffff;
    }
    `
    : '';
  const css = `
    @page { size: Letter; margin: 0; }
    :root {
      --edu-navy: #16324f;
      --edu-blue: #0a84ff;
      --edu-blue-soft: #3b82f6;
      --edu-cyan: #06b6d4;
      --edu-violet: #6366f1;
      --edu-emerald: #14b8a6;
      --edu-bg-soft: #eef6ff;
      --edu-bg-quiet: #f4f9ff;
      --edu-border: #9db8d8;
      --edu-border-strong: #2f5f9a;
      --edu-text: #1e293b;
      --edu-text-muted: #475569;
      --edu-surface: #ffffff;
      --edu-ink-soft: #64748b;
      --tone-danger: #b42318;
      --tone-success: #157347;
      --tone-focus: #7c3aed;
      --tone-important: #0a67d8;
      --tone-warning: #b54708;
      --tone-note: #0369a1;
      --tone-key: #7c3aed;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      color: var(--edu-text);
      background: #eef2f7;
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
      border: 1px dashed rgba(71, 85, 105, 0.38);
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.9);
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
      color: rgba(51, 65, 85, 0.55);
    }
    .page-shell {
      position: absolute;
      inset: 32px;
      border: 1px solid #d6dee8;
      background: #ffffff;
    }
    .header-shell {
      position: absolute;
      border: 1px solid var(--edu-border);
      background-color: var(--edu-bg-soft);
      background-image:
        repeating-linear-gradient(60deg, rgba(10, 132, 255, 0.055) 0 1px, transparent 1px 18px),
        repeating-linear-gradient(-60deg, rgba(99, 102, 241, 0.05) 0 1px, transparent 1px 18px),
        repeating-linear-gradient(0deg, rgba(6, 182, 212, 0.04) 0 1px, transparent 1px 18px),
        linear-gradient(90deg, rgba(10, 132, 255, 0.06), rgba(99, 102, 241, 0.05), rgba(6, 182, 212, 0.04));
      background-size: 18px 18px, 18px 18px, 18px 18px, auto;
      background-position: 0 0, 0 0;
    }
    .header-shell > * { position: absolute; z-index: 1; }
    .header-band {
      left: 2px;
      right: 2px;
      top: 2px;
      height: 4px;
      background: linear-gradient(90deg, #2563eb 0%, #0ea5e9 24%, #22c55e 50%, #a855f7 76%, #2563eb 100%);
      background-size: 220% 100%;
      box-shadow: 0 0 0.5px rgba(37, 99, 235, 0.9), 0 0 6px rgba(14, 165, 233, 0.45);
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
      background: linear-gradient(90deg, rgba(255,255,255,0.72), rgba(255,255,255,0.12), rgba(255,255,255,0.72));
      opacity: 0.85;
    }
    .header-logo { object-fit: contain; object-position: center; background: transparent; }
    .header-logo-left { left: 8px; top: 50%; transform: translateY(-50%); width: 78px; height: 78px; }
    .header-logo-right { right: 136px; top: 50%; transform: translateY(-50%); width: 78px; height: 78px; }
    .logo-placeholder { border: 1px dashed var(--edu-border); background: transparent; }
    .title-box { position: absolute; width: 376px; text-align: center; }
    .institution { font-size: 16px; line-height: 19px; font-weight: 800; color: #0a67d8; letter-spacing: 0.12px; }
    .exam-title { margin-top: 2px; font-size: 18px; line-height: 21px; font-weight: 800; letter-spacing: 0.16px; color: #1f3b63; }
    .motto { margin-top: 2px; font-size: 9.6px; line-height: 11px; font-style: italic; color: var(--edu-ink-soft); }
    .meta { margin-top: 0; font-size: 10.6px; line-height: 12px; color: var(--edu-text-muted); font-weight: 650; letter-spacing: 0.06px; text-align: center; }
    .meta-slot { position: absolute; margin-top: 0; }
    .meta-secondary { position: absolute; margin-top: 0; }
    .qr-box { position: absolute; border: 1px solid var(--edu-border); background: #ffffff; padding: 10px; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .capture-row { position: absolute; display: flex; align-items: center; gap: 10px; }
    .capture-row-inline { gap: 8px; }
    .capture-label { font-size: 10px; line-height: 13px; font-weight: 700; min-width: 110px; flex: 0 0 110px; color: #2a4262; }
    .capture-label-group { min-width: 44px; flex: 0 0 44px; text-align: right; }
    .capture-box {
      border: 1.6px solid var(--edu-border-strong);
      background: #ffffff;
      height: 26px;
    }
    .capture-box-name { flex: 0 0 auto; }
    .capture-box-group { flex: 0 0 auto; }
    .question-block { position: absolute; }
    .question-number {
      position: absolute;
      border: 1.8px solid #3a5fa3;
      background-color: #eaf4ff;
      background-image:
        repeating-linear-gradient(60deg, rgba(10,132,255,0.06) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(-60deg, rgba(99,102,241,0.055) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(0deg, rgba(6,182,212,0.045) 0 1px, transparent 1px 14px),
        linear-gradient(180deg, rgba(255,255,255,0.95), rgba(10,132,255,0.09), rgba(99,102,241,0.08));
      font-size: 17px;
      line-height: 20px;
      font-weight: 800;
      text-align: center;
      padding-top: 1px;
      color: #194675;
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
    .q-math-inline { color: #1d4ed8; font-weight: 760; letter-spacing: 0.02px; }
    .q-math-line { color: #1d4ed8; font-weight: 760; }
    .q-code-inline {
      font-family: Consolas, 'Courier New', monospace;
      background: rgba(15, 23, 42, 0.06);
      border: 1px solid rgba(15, 23, 42, 0.18);
      border-radius: 3px;
      padding: 0 2px;
      color: #0f172a;
      font-weight: 650;
    }
    .q-code-frag {
      font-family: Consolas, 'Courier New', monospace;
      color: #0f3a66;
      background: rgba(14, 116, 144, 0.08);
      border-radius: 3px;
      padding: 0 2px;
      font-weight: 650;
    }
    .q-tech-type {
      color: #0f4da8;
      font-weight: 800;
      font-style: italic;
      letter-spacing: 0.02px;
    }
    .q-tech-kw {
      color: #5b21b6;
      font-weight: 800;
      font-style: italic;
      letter-spacing: 0.02px;
    }
    .q-tech-lit {
      color: #0369a1;
      font-weight: 760;
      font-style: italic;
    }
    .q-pseudo-kw { color: #7c3aed; font-weight: 800; letter-spacing: 0.02px; }
    .question-image {
      margin: 2px 0 0 0;
      border: none;
      background-color: #ffffff;
      background-image: none;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 0 0 auto;
    }
    .question-image img { width: 100%; height: calc(100% - 10px); object-fit: contain; display: block; }
    .question-image-caption { display: block; margin: 0; padding: 0 2px; font-size: 8px; line-height: 10px; font-weight: 600; color: #365b88; text-align: center; background: rgba(255,255,255,0.92); border-top: none; }
    .question-options { display: grid; gap: 8px; margin-top: 3px; }
    .options-double { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .options-single { grid-template-columns: minmax(0, 1fr); }
    .option-item { font-size: 11.2px; line-height: 13.2px; margin-bottom: 1px; break-inside: avoid; font-weight: 520; color: #233249; }
    .option-prefix { font-weight: 750; color: #1f5f9f; }
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
      background-color: var(--edu-navy);
      background-image: linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0));
      color: white;
      font-size: 10px;
      line-height: 14px;
      font-weight: 800;
      text-align: center;
      z-index: 2;
    }
    .omr-label { position: absolute; top: 0; left: 28px; font-size: 10px; line-height: 12px; font-weight: 760; letter-spacing: 0.45px; color: #274a74; }
    .omr-frame {
      position: absolute;
      inset: 0;
      border: 1.8px solid #244b74;
      background-color: #f4f9ff;
      background-image:
        radial-gradient(circle, rgba(10,132,255,0.12) 0.65px, transparent 0.9px);
      background-size: 8px 8px;
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
    .bubble { position: absolute; left: ${OMR.bubbleColumnX}px; width: ${OMR.bubbleRadiusPx * 2}px; height: ${OMR.bubbleRadiusPx * 2}px; border: 1.8px solid #244b74; border-radius: 50%; background: #ffffff; display: inline-block; }
    .choice { position: absolute; left: ${OMR.labelColumnX}px; font-size: 10px; line-height: 12px; font-weight: 720; color: #244b74; }
    .footer {
      position: absolute;
      left: 56px;
      right: 56px;
      bottom: 32px;
      height: 28px;
      border-top: 1px solid #d7e0ea;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      padding: 0 8px;
      font-size: 9.6px;
      letter-spacing: 0.16px;
      color: #4a678f;
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
      color: #334e72;
    }
    .footer-id {
      flex: 0 0 auto;
      max-width: 170px;
      font-size: 8.8px;
      font-weight: 760;
      color: #2f557f;
      letter-spacing: 0.12px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #9eb9dd;
      background: linear-gradient(90deg, rgba(10,132,255,0.1), rgba(99,102,241,0.08));
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
      color: #48658f;
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
      border: 1px solid #5f8fc9;
      background: linear-gradient(90deg, rgba(10,132,255,0.2), rgba(99,102,241,0.16));
      font-size: 9.8px;
      font-weight: 800;
      letter-spacing: 0.22px;
      color: #154475;
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
      color: #223f60;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #b7c8db;
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
