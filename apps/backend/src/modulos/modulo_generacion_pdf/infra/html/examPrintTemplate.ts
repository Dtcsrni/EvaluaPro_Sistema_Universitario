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

function renderHeader(page: PageToken, examen: ExamenPdf, logos: { izquierda?: string; derecha?: string }): string {
  if (!page.headerBox || page.numeroPagina !== 1) return '';
  const qrLeft = Math.max(0, page.qrBox.x - page.headerBox.x);
  const qrTop = Math.max(0, page.qrBox.y - page.headerBox.y);
  const carrera = 'Ingeniería en sistemas computacionales';
  const textLeft = 98;
  const textMaxWidth = Math.max(420, qrLeft - textLeft - 10);
  const captureLabelWidth = 110;
  const captureGroupLabelWidth = 44;
  const captureGroupWidth = 58;
  const captureNameWidth = Math.max(
    220,
    textMaxWidth - captureLabelWidth - captureGroupLabelWidth - captureGroupWidth - 24
  );
  const desiredMetaTop = 80;
  const desiredCareerTop = 96;
  const desiredCaptureTop = 112;
  const captureBoxHeight = 24;
  const maxCaptureTop = Math.max(0, page.headerBox.height - captureBoxHeight - 4);
  const captureTop = Math.min(desiredCaptureTop, maxCaptureTop);
  const careerTop = Math.min(desiredCareerTop, Math.max(0, captureTop - 18));
  const metaTop = Math.min(desiredMetaTop, Math.max(0, careerTop - 18));
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
      <div class="title-box" style="left:${textLeft}px;top:8px;width:${textMaxWidth}px;">
        <div class="institution">${escapeHtml(examen.encabezado?.institucion ?? 'Centro Universitario Hidalguense')}</div>
        <div class="exam-title">${escapeHtml(examen.titulo)}</div>
        <div class="motto">${escapeHtml(examen.encabezado?.lema ?? 'La sabiduria es nuestra fuerza')}</div>
      </div>
      <div class="meta meta-slot" style="left:${textLeft}px;top:${metaTop}px;width:${textMaxWidth}px;">Materia: ${escapeHtml(examen.encabezado?.materia ?? '')} | Docente: ${escapeHtml(examen.encabezado?.docente ?? '')}</div>
      <div class="meta meta-career" style="left:${textLeft}px;top:${careerTop}px;width:${textMaxWidth}px;">Carrera: ${escapeHtml(carrera)}</div>
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
      const bubbleTop = OMR.headerBandHeightPx + 8 + optionIndex * OMR.bubbleStepYPx;
      const labelTop = bubbleTop + 1;
      return `<span class="bubble" style="top:${bubbleTop}px;"></span><span class="choice" style="top:${labelTop}px;">${option.letra}</span>`;
    })
    .join('');
  return `
    <section class="question-block" style="left:${question.box.x}px;top:${question.box.y}px;width:${question.box.width}px;height:${question.box.height}px;">
      <div class="question-number" style="left:${question.numberBox.x - question.box.x}px;top:${question.numberBox.y - question.box.y}px;width:${question.numberBox.width}px;height:${question.numberBox.height}px;">${question.numero}</div>
      <div class="question-text" style="left:${question.textBox.x - question.box.x}px;top:${question.textBox.y - question.box.y}px;width:${question.textBox.width}px;height:${question.textBox.height}px;">
        <div class="question-row">
          <div class="${contentClass}">
            <div class="question-stem">${question.stemHtml}</div>
            <div class="question-options ${optionColumns}">
              ${optionGroups.map((group) => `<div class="option-column">${group.map((option) => `<div class="option-item"><span class="option-prefix">${option.letra})</span> <span>${option.texto}</span></div>`).join('')}</div>`).join('')}
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
    body.print-profile-epson-l1250 .header-shell {
      background: #ffffff;
      background-image:
        repeating-linear-gradient(60deg, rgba(31,41,55,0.09) 0 1px, transparent 1px 16px),
        repeating-linear-gradient(-60deg, rgba(31,41,55,0.09) 0 1px, transparent 1px 16px),
        repeating-linear-gradient(0deg, rgba(31,41,55,0.06) 0 1px, transparent 1px 16px);
      border-color: #8e99a9;
    }
    body.print-profile-epson-l1250 .header-band {
      background: linear-gradient(90deg, #374151, #4b5563, #374151);
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
      background-image:
        repeating-linear-gradient(60deg, rgba(31,41,55,0.08) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(-60deg, rgba(31,41,55,0.08) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(0deg, rgba(31,41,55,0.05) 0 1px, transparent 1px 14px);
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
        repeating-linear-gradient(60deg, rgba(10, 132, 255, 0.1) 0 1px, transparent 1px 16px),
        repeating-linear-gradient(-60deg, rgba(99, 102, 241, 0.09) 0 1px, transparent 1px 16px),
        repeating-linear-gradient(0deg, rgba(6, 182, 212, 0.07) 0 1px, transparent 1px 16px),
        linear-gradient(90deg, rgba(10, 132, 255, 0.11), rgba(99, 102, 241, 0.09), rgba(6, 182, 212, 0.08));
      background-size: 16px 16px, 16px 16px, 16px 16px, auto;
      background-position: 0 0, 0 0;
    }
    .header-band { position: absolute; left: 0; top: 10px; width: 100%; height: 2px; background: linear-gradient(90deg, var(--edu-blue), var(--edu-violet), var(--edu-cyan), var(--edu-blue)); }
    .header-logo { position: absolute; object-fit: contain; background: transparent; }
    .header-logo-left { left: 8px; top: 10px; width: 72px; height: 72px; }
    .header-logo-right { left: 572px; top: 10px; width: 72px; height: 72px; }
    .logo-placeholder { border: 1px dashed var(--edu-border); background: transparent; }
    .title-box { position: absolute; width: 376px; }
    .institution { font-size: 17px; line-height: 21px; font-weight: 800; color: #0a67d8; letter-spacing: 0.15px; }
    .exam-title { margin-top: 3px; font-size: 21px; line-height: 25px; font-weight: 800; letter-spacing: 0.2px; color: #1f3b63; }
    .motto { margin-top: 4px; font-size: 11px; line-height: 13px; font-style: italic; color: var(--edu-ink-soft); }
    .meta { margin-top: 0; font-size: 12px; line-height: 15px; color: var(--edu-text-muted); font-weight: 650; letter-spacing: 0.1px; }
    .meta-slot { position: absolute; margin-top: 0; }
    .meta-career { position: absolute; margin-top: 0; }
    .qr-box { position: absolute; border: 1px solid var(--edu-border); background: #ffffff; padding: 10px; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .capture-row { position: absolute; display: flex; align-items: center; gap: 10px; overflow: hidden; }
    .capture-row-inline { gap: 8px; }
    .capture-label { font-size: 11px; line-height: 14px; font-weight: 700; min-width: 110px; flex: 0 0 110px; color: #2a4262; }
    .capture-label-group { min-width: 44px; flex: 0 0 44px; text-align: right; }
    .capture-box {
      border: 1.6px solid var(--edu-border-strong);
      background: #ffffff;
      height: 24px;
    }
    .capture-box-name { flex: 0 0 auto; }
    .capture-box-group { flex: 0 0 auto; }
    .question-block { position: absolute; }
    .question-number {
      position: absolute;
      border: 1.8px solid #3a5fa3;
      background-color: #eaf4ff;
      background-image:
        repeating-linear-gradient(60deg, rgba(10,132,255,0.11) 0 1px, transparent 1px 12px),
        repeating-linear-gradient(-60deg, rgba(99,102,241,0.1) 0 1px, transparent 1px 12px),
        repeating-linear-gradient(0deg, rgba(6,182,212,0.08) 0 1px, transparent 1px 12px),
        linear-gradient(180deg, rgba(255,255,255,0.93), rgba(10,132,255,0.14), rgba(99,102,241,0.12));
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
    .question-content.has-image { max-width: calc(100% - 162px); }
    .question-stem { font-size: 13px; line-height: 16.6px; font-weight: 680; letter-spacing: 0.05px; }
    .question-stem p { margin: 0 0 3px 0; }
    .question-stem ul { margin: 3px 0 3px 18px; padding: 0; }
    .question-stem li { margin: 0 0 2px 0; }
    .question-stem code, .q-code { font-family: Consolas, 'Courier New', monospace; }
    .question-image {
      margin: 2px 0 0 0;
      border: none;
      background-color: var(--edu-bg-quiet);
      background-image:
        repeating-linear-gradient(60deg, rgba(10,132,255,0.1) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(-60deg, rgba(99,102,241,0.09) 0 1px, transparent 1px 14px),
        repeating-linear-gradient(0deg, rgba(6,182,212,0.07) 0 1px, transparent 1px 14px);
      background-size: 14px 14px, 14px 14px, 14px 14px;
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
    .fid { position: absolute; width: 6px; height: 6px; background: #000000; }
    .fid-tl { left: 2px; top: 2px; }
    .fid-tr { right: 2px; top: 2px; }
    .fid-bl { left: 2px; bottom: 2px; }
    .fid-br { right: 2px; bottom: 2px; }
    .bubble { position: absolute; left: 12px; width: 14px; height: 14px; border: 1.8px solid #244b74; border-radius: 50%; background: #ffffff; display: inline-block; }
    .choice { position: absolute; left: 33px; font-size: 10px; line-height: 12px; font-weight: 720; color: #244b74; }
    .footer { position: absolute; left: 32px; right: 32px; bottom: 32px; height: 44px; border-top: 1px solid #d7e0ea; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 6px 4px; font-size: 11px; letter-spacing: 0.2px; color: #4a678f; }
    .corner { position: absolute; width: 12px; height: 12px; background: #000; }
    .corner.tl { left: 4px; top: 4px; }
    .corner.tr { right: 4px; top: 4px; }
    .corner.bl { left: 4px; bottom: 4px; }
    .corner.br { right: 4px; bottom: 4px; }
    ${printerProfileCss}
  `;

  const pagesHtml = pages
    .map((page) => {
      let html = `<section class="page"><div class="page-shell"></div><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>`;
      html += renderHeader(page, examen, logos).replace(`{{QR:${page.numeroPagina}}}`, qrDataUrls[page.numeroPagina] ?? '');
      html += page.preguntas.map((_q, idx) => renderQuestion(page, idx)).join('');
      html += `<footer class="footer"><span>${escapeHtml(examen.folio)}</span><span>Pagina ${page.numeroPagina}</span></footer>`;
      html += '</section>';
      return html;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body class="${bodyClass}">${pagesHtml}</body></html>`;
}
