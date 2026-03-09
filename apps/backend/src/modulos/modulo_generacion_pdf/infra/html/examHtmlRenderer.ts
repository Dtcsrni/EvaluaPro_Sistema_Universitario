import QRCode from 'qrcode';
import type { ExamenPdf } from '../../domain/examenPdf';
import type { PerfilLayoutImpresion, PerfilPlantillaOmr, ResultadoGeneracionPdf } from '../../shared/tiposPdf';
import { buildExamLayoutTokens } from './examLayoutTokens';
import { resolverImagenPregunta } from './examImageResolver';
import { renderExamHtml } from './examPrintTemplate';
import { htmlToPdfBuffer } from './examPlaywrightPdf';

export class ExamHtmlRenderer {
  constructor(
    private readonly perfilOmr: PerfilPlantillaOmr,
    private readonly perfilLayout: PerfilLayoutImpresion
  ) {}

  async generarPdf(examen: ExamenPdf): Promise<ResultadoGeneracionPdf> {
    const layout = await buildExamLayoutTokens({
      examen,
      perfilOmr: this.perfilOmr,
      perfilLayout: this.perfilLayout
    });

    const qrDataUrls: Record<number, string> = {};
    for (const page of layout.pages) {
      qrDataUrls[page.numeroPagina] = await QRCode.toDataURL(page.qrTexto, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: Math.round(page.qrBox.width - 20)
      });
    }

    const logoIzquierdaPath =
      String(examen.encabezado?.logos?.izquierdaPath ?? '').trim() || String(process.env.EXAMEN_LOGO_IZQ_PATH ?? '').trim();
    const logoDerechaPath =
      String(examen.encabezado?.logos?.derechaPath ?? '').trim() || String(process.env.EXAMEN_LOGO_DER_PATH ?? '').trim();

    const [logoIzquierdo, logoDerecho] = await Promise.all([
      resolverImagenPregunta(logoIzquierdaPath || undefined, { preserveTransparency: true }),
      resolverImagenPregunta(logoDerechaPath || undefined, { preserveTransparency: true })
    ]);

    const html = renderExamHtml({
      pages: layout.pages,
      examen,
      qrDataUrls,
      logos: {
        izquierda: logoIzquierdo.dataUrl,
        derecha: logoDerecho.dataUrl
      }
    });
    const pdfBytes = await htmlToPdfBuffer(html);
    const layoutTemplateVersion = examen.layout.templateVersion === 4 ? 10 : 9;

    return {
      pdfBytes,
      layoutEngine: 'playwright-html-v1',
      layoutTemplateVersion,
      paginas: layout.paginas,
      metricasPaginas: layout.metricasPaginas,
      metricasLayout: layout.metricasLayout,
      renderDiagnostics: layout.renderDiagnostics,
      mapaOmr: layout.mapaOmr,
      preguntasRestantes: layout.preguntasRestantes
    };
  }
}
