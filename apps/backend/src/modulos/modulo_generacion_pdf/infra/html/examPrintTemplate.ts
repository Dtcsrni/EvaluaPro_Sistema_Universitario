import type { ExamenPdf } from '../../domain/examenPdf';
import type { PageToken } from './examLayoutTokens';
import { LAYOUT_TEMPLATE_V9 } from '../../domain/layoutTemplateV9';

const OMR = LAYOUT_TEMPLATE_V9.omr;

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader(page: PageToken, examen: ExamenPdf, logos: { izquierda?: string; derecha?: string }): string {
  if (!page.headerBox || page.numeroPagina !== 1) return '';
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
      <div class="title-box" style="left:${page.headerBox.x + 98}px;top:${page.headerBox.y + 14}px;">
        <div class="institution">${escapeHtml(examen.encabezado?.institucion ?? 'Centro Universitario Hidalguense')}</div>
        <div class="exam-title">${escapeHtml(examen.titulo)}</div>
        <div class="motto">${escapeHtml(examen.encabezado?.lema ?? 'La sabiduria es nuestra fuerza')}</div>
      </div>
      <div class="meta meta-slot" style="left:${page.headerBox.x + 98}px;top:${page.headerBox.y + 92}px;width:376px;">Materia: ${escapeHtml(examen.encabezado?.materia ?? '')} | Docente: ${escapeHtml(examen.encabezado?.docente ?? '')}</div>
      ${rightLogo}
      <div class="qr-box" style="left:${page.qrBox.x}px;top:${page.qrBox.y}px;width:${page.qrBox.width}px;height:${page.qrBox.height}px;">
        <img src="{{QR:${page.numeroPagina}}}" alt="QR pagina ${page.numeroPagina}" />
      </div>
      <div class="capture-row capture-row-name" style="left:${page.headerBox.x + 98}px;top:${page.headerBox.y + 114}px;">
        <span class="capture-label">Nombre del alumno</span>
        <div class="capture-box capture-box-name"></div>
      </div>
      <div class="capture-row capture-row-group" style="left:${page.headerBox.x + 98}px;top:${page.headerBox.y + 142}px;">
        <span class="capture-label">Grupo</span>
        <div class="capture-box capture-box-group"></div>
      </div>
    </section>`;
}

function renderQuestion(page: PageToken, index: number): string {
  const question = page.preguntas[index]!;
  const optionColumns = question.optionColumns === 1 ? 'options-single' : 'options-double';
  const optionGroups = question.optionColumns === 1
    ? [question.opciones]
    : [question.opciones.slice(0, Math.ceil(question.opciones.length / 2)), question.opciones.slice(Math.ceil(question.opciones.length / 2))];
  const imageHtml = question.imageBox && question.image?.dataUrl
    ? `<div class="question-image" style="width:${question.imageBox.width}px;height:${question.imageBox.height}px;"><img src="${question.image.dataUrl}" alt="Imagen de la pregunta ${question.numero}" /></div>`
    : '';
  const omrMarks = question.opciones
    .map((option, optionIndex) => {
      const bubbleTop = OMR.headerBandHeightPx + 8 + optionIndex * OMR.bubbleStepYPx;
      const choiceTop = bubbleTop + Math.max(0, OMR.bubbleRadiusPx - 6);
      return `<div class="omr-mark" style="top:${bubbleTop}px;"><span class="bubble"></span><span class="choice" style="top:${choiceTop}px;">${option.letra}</span></div>`;
    })
    .join('');
  return `
    <section class="question-block" style="left:${question.box.x}px;top:${question.box.y}px;width:${question.box.width}px;height:${question.box.height}px;">
      <div class="question-number" style="left:${question.numberBox.x - question.box.x}px;top:${question.numberBox.y - question.box.y}px;width:${question.numberBox.width}px;height:${question.numberBox.height}px;">${question.numero}</div>
      <div class="question-text" style="left:${question.textBox.x - question.box.x}px;top:${question.textBox.y - question.box.y}px;width:${question.textBox.width}px;height:${question.textBox.height}px;">
        <div class="question-stem">${question.stemHtml}</div>
        ${imageHtml}
        <div class="question-options ${optionColumns}">
          ${optionGroups.map((group) => `<div class="option-column">${group.map((option) => `<div class="option-item"><span class="option-prefix">${option.letra})</span> <span>${option.texto}</span></div>`).join('')}</div>`).join('')}
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
  const css = `
    @page { size: Letter; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f3f4f6; }
    .page { position: relative; width: 816px; height: 1056px; background: #ffffff; page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .page-shell { position: absolute; inset: 32px; border: 1px solid #d7e0ea; }
    .header-shell { position: absolute; border: 1px solid #8ea4bc; background: #dfe9f3; }
    .header-band { position: absolute; left: 0; top: 10px; width: 100%; height: 2px; background: #536b86; }
    .header-logo { position: absolute; object-fit: contain; }
    .header-logo-left { left: 48px; top: 48px; width: 62px; height: 62px; }
    .header-logo-right { left: 584px; top: 48px; width: 72px; height: 72px; }
    .logo-placeholder { border: 1px dashed #8ea4bc; background: rgba(255,255,255,0.5); }
    .title-box { position: absolute; width: 376px; }
    .institution { font-size: 18px; line-height: 22px; font-weight: 800; color: #0f6fb2; }
    .exam-title { margin-top: 4px; font-size: 22px; line-height: 26px; font-weight: 800; }
    .motto { margin-top: 8px; font-size: 12px; line-height: 15px; font-style: italic; color: #4b5563; }
    .meta { margin-top: 4px; font-size: 10px; line-height: 12px; color: #4b5563; }
    .meta-slot { position: absolute; margin-top: 0; }
    .qr-box { position: absolute; border: 1px solid #b2bfd0; background: #ffffff; padding: 10px; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .capture-row { position: absolute; display: flex; align-items: center; gap: 10px; }
    .capture-row-name { width: 500px; }
    .capture-row-group { width: 176px; }
    .capture-label { font-size: 12px; line-height: 16px; font-weight: 800; min-width: 106px; }
    .capture-box { border: 2px solid #465b76; background: #ffffff; height: 24px; }
    .capture-box-name { flex: 1; }
    .capture-box-group { width: 64px; }
    .question-block { position: absolute; }
    .question-number { position: absolute; border: 2px solid #465b76; background: #ebf2fb; font-size: 18px; line-height: 20px; font-weight: 800; text-align: center; padding-top: 1px; }
    .question-text { position: absolute; padding-right: 12px; }
    .question-stem { font-size: 14px; line-height: 18px; font-weight: 800; }
    .question-stem p { margin: 0 0 3px 0; }
    .question-stem ul { margin: 3px 0 3px 18px; padding: 0; }
    .question-stem li { margin: 0 0 2px 0; }
    .question-stem code, .q-code { font-family: Consolas, 'Courier New', monospace; }
    .question-image { margin-top: 8px; margin-bottom: 8px; border: 1px solid #c7d2e0; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .question-image img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .question-options { display: grid; gap: 12px; margin-top: 6px; }
    .options-double { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .options-single { grid-template-columns: minmax(0, 1fr); }
    .option-item { font-size: 12px; line-height: 14px; margin-bottom: 2px; break-inside: avoid; }
    .option-prefix { font-weight: 800; }
    .omr-panel { position: absolute; }
    .omr-id { position: absolute; left: 2px; top: 0; width: 18px; height: 14px; border-radius: 10px; background: #0f172a; color: white; font-size: 10px; line-height: 14px; font-weight: 800; text-align: center; z-index: 2; }
    .omr-label { position: absolute; top: 0; left: 28px; font-size: 10px; line-height: 12px; font-weight: 800; letter-spacing: 0.4px; }
    .omr-frame { position: absolute; inset: 0; border: 2px solid #111827; background: #f8fbff; }
    .fid { position: absolute; width: 6px; height: 6px; background: #000000; }
    .fid-tl { left: 2px; top: 2px; }
    .fid-tr { right: 2px; top: 2px; }
    .fid-bl { left: 2px; bottom: 2px; }
    .fid-br { right: 2px; bottom: 2px; }
    .omr-mark { position: absolute; left: 0; right: 0; height: 14px; }
    .bubble { position: absolute; left: 12px; top: 0; width: 14px; height: 14px; border: 2px solid #111827; border-radius: 50%; background: #ffffff; display: inline-block; }
    .choice { position: absolute; left: 31px; font-size: 10px; line-height: 12px; font-weight: 700; }
    .footer { position: absolute; left: 32px; right: 32px; bottom: 32px; height: 44px; border-top: 1px solid #d7e0ea; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 6px 4px; font-size: 12px; color: #4b5563; }
    .corner { position: absolute; width: 12px; height: 12px; background: #000; }
    .corner.tl { left: 4px; top: 4px; }
    .corner.tr { right: 4px; top: 4px; }
    .corner.bl { left: 4px; bottom: 4px; }
    .corner.br { right: 4px; bottom: 4px; }
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

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body>${pagesHtml}</body></html>`;
}
