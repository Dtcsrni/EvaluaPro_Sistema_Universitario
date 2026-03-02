import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import type { PaginaOmr, PreguntaBase } from '../modulo_generacion_pdf/shared/tiposPdf';
import { guardarArchivoExamen, guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import type { OmrSheetFamilyDescriptor } from './contratosOmrV1';
import { OMR_RUNTIME_VERSION_V1 } from './contratosOmrV1';
import type { AnswerKeyEntryV1, SheetBindingV1, VersionAssessmentV1 } from './workflowOmrV1';
import { slugOmrV1 } from './workflowOmrV1';

type PlantillaOmrV1 = {
  titulo?: string;
  numeroPaginas?: number;
  bookletConfig?: {
    targetPages?: number;
  };
};

export type SheetInstanceV1 = {
  sheetSerial: string;
  familyCode: string;
  familyRevision: number;
  pageIndex: number;
  versionCode: string;
  studentBinding?: { alumnoId?: string | null; studentId?: string | null; studentName?: string | null };
  qrPayload: string;
  expectedQuestionCount: number;
  expectedChoiceCount: number;
  expectedIdDigits: number;
  artifactPath?: string;
};

type StudentPacketV1 = {
  alumnoId?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  sheetSerial: string;
  versionCode: string;
  fileName: string;
  pdfBytes: Buffer;
  artifactPath?: string;
};

type VersionSetSummaryV1 = {
  versionCode: string;
  questionCount: number;
  answerKey: AnswerKeyEntryV1[];
};

type RenderBundleV1 = {
  bookletPdfBytes: Buffer;
  omrSheetPdfBytes: Buffer;
  sheetInstances: SheetInstanceV1[];
  studentPackets: StudentPacketV1[];
  versionSet: VersionSetSummaryV1[];
  manifestBytes: Buffer;
  answerKeyBytes: Buffer;
  mapaOmrV1: {
    omrRuntimeVersion: 1;
    sheetFamilyCode: string;
    sheetFamilyRevision: number;
    paginas: PaginaOmr[];
  };
  bookletDiagnostics: {
    pagesEstimated: number;
    questionsPerPage: number[];
    imageHeavyQuestions: Array<{ id: string; numero: number }>;
    layoutWarnings: string[];
  };
  omrDiagnostics: {
    anchorFootprintRatio: number;
    qrFootprintRatio: number;
    bubbleSpacingScore: number;
  };
};

const LETTER_W = 612;
const LETTER_H = 792;
const MM_A_PT = 72 / 25.4;

function mm(mmValue: number) {
  return mmValue * MM_A_PT;
}

function acotarTexto(value: string, max = 140) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function qrPayload(sheetSerial: string, familyCode: string, revision: number, pageIndex: number, versionPolicy: string) {
  return `OMR1:${sheetSerial}:${familyCode}:${revision}:${pageIndex}:${versionPolicy}`;
}

async function mergePdfBuffers(buffers: Buffer[]) {
  const pdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const src = await PDFDocument.load(buffer);
    const copied = await pdf.copyPages(src, src.getPageIndices());
    copied.forEach((page) => pdf.addPage(page));
  }
  return Buffer.from(await pdf.save());
}

async function generarBookletPdfVersion(args: {
  plantilla: PlantillaOmrV1;
  preguntas: PreguntaBase[];
  targetPages: number;
  versionCode: string;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const usableWidth = LETTER_W - mm(20) * 2;
  const imageHeavyQuestions: Array<{ id: string; numero: number }> = [];
  const questionsPerPage: number[] = [];
  const layoutWarnings: string[] = [];
  const approxPerPage = Math.max(6, Math.ceil(args.preguntas.length / Math.max(1, args.targetPages)));
  const bloques = chunk(args.preguntas, approxPerPage);

  for (let pageIdx = 0; pageIdx < bloques.length; pageIdx += 1) {
    const page = pdf.addPage([LETTER_W, LETTER_H]);
    let y = LETTER_H - mm(18);
    page.drawRectangle({
      x: mm(14),
      y: LETTER_H - mm(34),
      width: LETTER_W - mm(28),
      height: mm(20),
      color: rgb(0.93, 0.96, 0.99),
      borderColor: rgb(0.63, 0.72, 0.82),
      borderWidth: 1
    });
    page.drawText(String(args.plantilla.titulo ?? 'Evaluacion'), {
      x: mm(20),
      y,
      size: 20,
      font: bold,
      color: rgb(0.09, 0.16, 0.28)
    });
    page.drawText(`Version ${args.versionCode}`, {
      x: LETTER_W - mm(44),
      y: y + 2,
      size: 11,
      font: bold,
      color: rgb(0.2, 0.34, 0.49)
    });
    y -= 20;
    page.drawText(`Cuadernillo V1 · Pagina ${pageIdx + 1}`, {
      x: mm(20),
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.41, 0.5)
    });
    y -= 26;
    const preguntasPagina = bloques[pageIdx] ?? [];
    questionsPerPage.push(preguntasPagina.length);
    for (let idx = 0; idx < preguntasPagina.length; idx += 1) {
      const pregunta = preguntasPagina[idx]!;
      const numero = pageIdx * approxPerPage + idx + 1;
      const enunciado = acotarTexto(pregunta.enunciado, 220);
      page.drawText(`${numero}. ${enunciado}`, {
        x: mm(20),
        y,
        size: 11.2,
        font: bold,
        color: rgb(0.08, 0.1, 0.16),
        maxWidth: usableWidth
      });
      y -= 16;
      if (pregunta.imagenUrl) {
        imageHeavyQuestions.push({ id: pregunta.id, numero });
        page.drawRectangle({
          x: mm(24),
          y: y - 6,
          width: usableWidth - mm(4),
          height: 16,
          color: rgb(0.99, 0.95, 0.89),
          borderColor: rgb(0.81, 0.69, 0.46),
          borderWidth: 0.6
        });
        page.drawText('[Reactivo con imagen: revisar layout academico antes de imprimir]', {
          x: mm(26),
          y,
          size: 9.2,
          font: mono,
          color: rgb(0.36, 0.2, 0.07),
          maxWidth: usableWidth - mm(6)
        });
        y -= 20;
      }
      for (let op = 0; op < pregunta.opciones.length; op += 1) {
        const opcion = pregunta.opciones[op]!;
        const letra = String.fromCharCode(65 + op);
        page.drawText(`${letra}) ${acotarTexto(opcion.texto, 110)}`, {
          x: mm(26),
          y,
          size: 10.1,
          font,
          color: rgb(0.18, 0.22, 0.29),
          maxWidth: usableWidth - mm(6)
        });
        y -= 12;
      }
      y -= 8;
      if (y < mm(30)) {
        layoutWarnings.push(`El cuadernillo quedó denso en la pagina ${pageIdx + 1} de la version ${args.versionCode}.`);
        break;
      }
    }
  }

  return {
    pdfBytes: Buffer.from(await pdf.save()),
    diagnostics: {
      pagesEstimated: bloques.length,
      questionsPerPage,
      imageHeavyQuestions,
      layoutWarnings
    }
  };
}

async function generarBookletPdf(args: {
  plantilla: PlantillaOmrV1;
  versions: VersionAssessmentV1[];
  targetPages: number;
}) {
  const versionPdfs = [];
  const diagnostics = {
    pagesEstimated: 0,
    questionsPerPage: [] as number[],
    imageHeavyQuestions: [] as Array<{ id: string; numero: number }>,
    layoutWarnings: [] as string[]
  };
  for (const version of args.versions) {
    const versionPdf = await generarBookletPdfVersion({
      plantilla: args.plantilla,
      preguntas: version.preguntas,
      targetPages: args.targetPages,
      versionCode: version.versionCode
    });
    versionPdfs.push(versionPdf.pdfBytes);
    diagnostics.pagesEstimated += versionPdf.diagnostics.pagesEstimated;
    diagnostics.questionsPerPage.push(...versionPdf.diagnostics.questionsPerPage);
    diagnostics.imageHeavyQuestions.push(...versionPdf.diagnostics.imageHeavyQuestions);
    diagnostics.layoutWarnings.push(...versionPdf.diagnostics.layoutWarnings);
  }
  return {
    pdfBytes: await mergePdfBuffers(versionPdfs),
    diagnostics
  };
}

async function generarHojaOmrPdf(args: {
  family: OmrSheetFamilyDescriptor;
  folio: string;
  questionCount: number;
  versionCount: number;
  bindings: Array<SheetBindingV1 & { serialBase: string }>;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: PaginaOmr[] = [];
  const instances: SheetInstanceV1[] = [];
  const perPage = args.family.geometryDefaults.questionsPerPage;
  const totalPages = Math.max(1, Math.ceil(args.questionCount / perPage));

  for (const binding of args.bindings) {
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      const page = pdf.addPage([LETTER_W, LETTER_H]);
      const qr = qrPayload(binding.serialBase, args.family.familyCode, 1, pageIndex, args.versionCount > 1 ? 'multi' : 'single');
      instances.push({
        sheetSerial: binding.serialBase,
        familyCode: args.family.familyCode,
        familyRevision: 1,
        pageIndex,
        versionCode: String(binding.versionCode ?? 'A'),
        studentBinding: {
          alumnoId: binding.alumnoId ?? null,
          studentId: binding.studentId ?? null,
          studentName: binding.studentName ?? null
        },
        qrPayload: qr,
        expectedQuestionCount: Math.min(perPage, args.questionCount - (pageIndex - 1) * perPage),
        expectedChoiceCount: args.family.choiceCountMax,
        expectedIdDigits: args.family.studentIdDigits
      });

      const g = args.family.geometryDefaults;
      const margin = g.outerMarginPt;
      const anchorSize = g.anchorSizePt;
      const qrX = LETTER_W - margin - g.qrSizePt;
      const qrY = LETTER_H - margin - g.qrSizePt;
      const squares = [
        { x: margin, y: LETTER_H - margin - anchorSize },
        { x: LETTER_W - margin - anchorSize, y: LETTER_H - margin - anchorSize },
        { x: margin, y: margin },
        { x: LETTER_W - margin - anchorSize, y: margin }
      ];
      page.drawRectangle({
        x: margin + 12,
        y: LETTER_H - margin - 104,
        width: 212,
        height: 92,
        color: rgb(0.94, 0.97, 0.98),
        borderColor: rgb(0.72, 0.78, 0.84),
        borderWidth: 0.8
      });
      page.drawRectangle({
        x: margin + 236,
        y: LETTER_H - margin - 104,
        width: 152,
        height: 92,
        color: rgb(0.95, 0.98, 0.94),
        borderColor: rgb(0.74, 0.83, 0.75),
        borderWidth: 0.8
      });
      for (const sq of squares) {
        page.drawRectangle({ x: sq.x, y: sq.y, width: anchorSize, height: anchorSize, color: rgb(0, 0, 0) });
      }
      page.drawRectangle({
        x: qrX - g.qrPaddingPt,
        y: qrY - g.qrPaddingPt,
        width: g.qrSizePt + g.qrPaddingPt * 2,
        height: g.qrSizePt + g.qrPaddingPt * 2,
        borderColor: rgb(0.75, 0.78, 0.84),
        borderWidth: 1,
        color: rgb(1, 1, 1)
      });
      const qrImage = await pdf.embedPng(
        await QRCode.toBuffer(qr, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: Math.max(220, Math.round(g.qrSizePt * 4))
        })
      );
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: g.qrSizePt,
        height: g.qrSizePt
      });
      page.drawText('Hoja OMR V1', {
        x: margin + 16,
        y: LETTER_H - margin - 12,
        size: 16,
        font: bold,
        color: rgb(0.08, 0.12, 0.18)
      });
      page.drawText(`${args.family.displayName} · Hoja ${pageIndex}/${totalPages}`, {
        x: margin + 16,
        y: LETTER_H - margin - 28,
        size: 10,
        font,
        color: rgb(0.34, 0.4, 0.49)
      });
      page.drawText(`Serie: ${binding.serialBase}`, {
        x: margin + 16,
        y: LETTER_H - margin - 44,
        size: 9.5,
        font: bold,
        color: rgb(0.15, 0.18, 0.23)
      });
      page.drawText(`Alumno: ${binding.studentName ?? 'Hoja generica'}`, {
        x: margin + 16,
        y: LETTER_H - margin - 60,
        size: 9,
        font,
        color: rgb(0.22, 0.27, 0.34)
      });
      page.drawText(`ID esperado: ${binding.studentId ?? 'Captura manual / burbujeado'}`, {
        x: margin + 16,
        y: LETTER_H - margin - 74,
        size: 9,
        font,
        color: rgb(0.22, 0.27, 0.34)
      });
      page.drawText(`Version esperada: ${binding.versionCode ?? 'A'}`, {
        x: margin + 250,
        y: LETTER_H - margin - 44,
        size: 10,
        font: bold,
        color: rgb(0.16, 0.29, 0.18)
      });
      page.drawText('Rellena solo una burbuja por pregunta.', {
        x: margin + 250,
        y: LETTER_H - margin - 60,
        size: 9,
        font,
        color: rgb(0.22, 0.27, 0.34)
      });
      page.drawText('Usa lapiz/pluma oscura. Evita taches y sombras.', {
        x: margin + 250,
        y: LETTER_H - margin - 74,
        size: 9,
        font,
        color: rgb(0.22, 0.27, 0.34)
      });
      let metaY = LETTER_H - margin - 122;
      if (args.family.studentIdDigits > 0) {
        page.drawRectangle({
          x: margin + 12,
          y: metaY - 92,
          width: 172,
          height: 104,
          color: rgb(0.96, 0.98, 0.99),
          borderColor: rgb(0.79, 0.83, 0.88),
          borderWidth: 0.6
        });
        page.drawText('ID estudiante', { x: margin + 16, y: metaY + 12, size: 9, font: bold, color: rgb(0.14, 0.18, 0.24) });
        for (let digit = 0; digit < args.family.studentIdDigits; digit += 1) {
          const columnX = margin + 24 + digit * 24;
          page.drawText(String(digit + 1), { x: columnX + 1, y: metaY, size: 7, font, color: rgb(0.35, 0.39, 0.46) });
          for (let value = 0; value <= 9; value += 1) {
            const cy = metaY - value * 9;
            page.drawCircle({
              x: columnX,
              y: cy,
              size: 3.2,
              borderWidth: 0.8,
              borderColor: rgb(0.15, 0.18, 0.23)
            });
            page.drawText(String(value), { x: columnX + 6, y: cy - 2.5, size: 6.4, font, color: rgb(0.2, 0.23, 0.29) });
          }
        }
        metaY -= 102;
      }
      if (args.versionCount > 1) {
        page.drawRectangle({
          x: margin + 196,
          y: metaY - 10,
          width: 192,
          height: 28,
          color: rgb(0.96, 0.98, 0.95),
          borderColor: rgb(0.8, 0.86, 0.81),
          borderWidth: 0.6
        });
        page.drawText('Version', { x: margin + 204, y: metaY + 4, size: 9, font: bold, color: rgb(0.14, 0.18, 0.24) });
        for (let versionIndex = 0; versionIndex < Math.min(args.family.versionBubbleCount, args.versionCount); versionIndex += 1) {
          const cx = margin + 256 + versionIndex * 22;
          const cy = metaY + 5;
          page.drawCircle({
            x: cx,
            y: cy,
            size: 3.4,
            borderWidth: 0.9,
            borderColor: rgb(0.15, 0.18, 0.23)
          });
          page.drawText(String.fromCharCode(65 + versionIndex), {
            x: cx + 6,
            y: cy - 2.5,
            size: 7.4,
            font,
            color: rgb(0.2, 0.23, 0.29)
          });
        }
      }

      let y = LETTER_H - g.answersTop;
      const pageQuestions: PaginaOmr['preguntas'] = [];
      const startQuestion = (pageIndex - 1) * perPage + 1;
      const endQuestion = Math.min(args.questionCount, pageIndex * perPage);
      for (let numeroPregunta = startQuestion; numeroPregunta <= endQuestion; numeroPregunta += 1) {
        page.drawRectangle({
          x: margin + 8,
          y: y - 3,
          width: LETTER_W - margin * 2 - 16,
          height: g.bubbleDiameterPt + 8,
          color: numeroPregunta % 2 === 0 ? rgb(0.985, 0.989, 0.994) : rgb(1, 1, 1)
        });
        page.drawText(String(numeroPregunta).padStart(2, '0'), {
          x: margin + 12,
          y: y + 2,
          size: 10,
          font: bold,
          color: rgb(0.08, 0.1, 0.16)
        });
        const options: Array<{ letra: string; x: number; y: number }> = [];
        for (let op = 0; op < args.family.choiceCountMax; op += 1) {
          const cx = margin + 54 + op * g.bubblePitchXpt;
          const cy = y + g.bubbleRadiusPt;
          page.drawCircle({
            x: cx,
            y: cy,
            size: g.bubbleRadiusPt,
            borderWidth: 1.2,
            borderColor: rgb(0.1, 0.12, 0.18)
          });
          page.drawText(String.fromCharCode(65 + op), {
            x: cx + g.bubbleRadiusPt + 4,
            y: cy - 3,
            size: 9,
            font,
            color: rgb(0.16, 0.18, 0.22)
          });
          options.push({ letra: String.fromCharCode(65 + op), x: cx, y: cy });
        }
        pageQuestions.push({
          numeroPregunta,
          idPregunta: `Q-${numeroPregunta}`,
          opciones: options,
          cajaOmr: { x: margin + 46, y: y - 2, width: g.bubblePitchXpt * args.family.choiceCountMax + 34, height: g.bubbleDiameterPt + 6 },
          perfilOmr: { radio: g.bubbleRadiusPt, pasoY: g.bubblePitchYpt, cajaAncho: g.bubblePitchXpt * args.family.choiceCountMax + 34 },
          fiduciales: {
            leftTop: { x: margin + 46, y: y + g.bubbleDiameterPt + 1 },
            leftBottom: { x: margin + 46, y: y - 2 },
            rightTop: { x: margin + 46 + g.bubblePitchXpt * args.family.choiceCountMax + 34, y: y + g.bubbleDiameterPt + 1 },
            rightBottom: { x: margin + 46 + g.bubblePitchXpt * args.family.choiceCountMax + 34, y: y - 2 }
          }
        });
        y -= g.bubblePitchYpt;
      }
      const lastSlot = Math.min(args.family.questionCapacity, pageIndex * perPage);
      for (let numeroPregunta = endQuestion + 1; numeroPregunta <= lastSlot; numeroPregunta += 1) {
        page.drawText(String(numeroPregunta).padStart(2, '0'), {
          x: margin + 12,
          y: y + 2,
          size: 10,
          font: bold,
          color: rgb(0.55, 0.58, 0.63)
        });
        page.drawText('IGNORADA', {
          x: margin + 54,
          y: y + 2,
          size: 8,
          font,
          color: rgb(0.55, 0.58, 0.63)
        });
        y -= g.bubblePitchYpt;
      }

      paginas.push({
        numeroPagina: pageIndex,
        qr: { texto: qr, x: qrX, y: qrY, size: g.qrSizePt, padding: g.qrPaddingPt },
        marcasPagina: {
          tipo: 'cuadrados',
          size: anchorSize,
          quietZone: g.anchorQuietZonePt,
          tl: { x: margin, y: LETTER_H - margin - anchorSize },
          tr: { x: LETTER_W - margin - anchorSize, y: LETTER_H - margin - anchorSize },
          bl: { x: margin, y: margin },
          br: { x: LETTER_W - margin - anchorSize, y: margin }
        },
        preguntas: pageQuestions
      });
    }
  }

  const anchorArea = 4 * args.family.geometryDefaults.anchorSizePt * args.family.geometryDefaults.anchorSizePt;
  const qrArea = args.family.geometryDefaults.qrSizePt * args.family.geometryDefaults.qrSizePt;
  const pageArea = LETTER_W * LETTER_H;

  return {
    pdfBytes: Buffer.from(await pdf.save()),
    pages: paginas.slice(0, totalPages),
    instances,
    diagnostics: {
      anchorFootprintRatio: Number((anchorArea / pageArea).toFixed(4)),
      qrFootprintRatio: Number((qrArea / pageArea).toFixed(4)),
      bubbleSpacingScore: Number(
        Math.min(1, (args.family.geometryDefaults.bubblePitchXpt + args.family.geometryDefaults.bubblePitchYpt) / mm(16.5)).toFixed(4)
      )
    }
  };
}

async function generarStudentPackets(args: {
  bookletPdfBytes: Buffer;
  omrSheetPdfBytes: Buffer;
  sheetInstances: SheetInstanceV1[];
  bindings: Array<SheetBindingV1 & { serialBase: string }>;
}) {
  if (args.bindings.length === 1 && !args.bindings[0]?.studentId && !args.bindings[0]?.alumnoId) return [] as StudentPacketV1[];
  const omrSource = await PDFDocument.load(args.omrSheetPdfBytes);
  const bookletSource = await PDFDocument.load(args.bookletPdfBytes);
  const packets: StudentPacketV1[] = [];
  for (const binding of args.bindings) {
    const packet = await PDFDocument.create();
    const bookletPages = await packet.copyPages(bookletSource, bookletSource.getPageIndices());
    bookletPages.forEach((page) => packet.addPage(page));
    const pagesForBinding = args.sheetInstances
      .filter((instance) => instance.sheetSerial === binding.serialBase)
      .map((instance) => Math.max(0, Number(instance.pageIndex) - 1));
    const omrPages = await packet.copyPages(omrSource, pagesForBinding);
    omrPages.forEach((page) => packet.addPage(page));
    const fileName = `${slugOmrV1(binding.studentName || binding.studentId || binding.serialBase)}_${binding.versionCode || 'A'}_packet_v1.pdf`;
    packets.push({
      alumnoId: binding.alumnoId ?? null,
      studentId: binding.studentId ?? null,
      studentName: binding.studentName ?? null,
      sheetSerial: binding.serialBase,
      versionCode: String(binding.versionCode ?? 'A'),
      fileName,
      pdfBytes: Buffer.from(await packet.save())
    });
  }
  return packets;
}

function manifestBundle(args: {
  folio: string;
  family: OmrSheetFamilyDescriptor;
  versionSet: VersionSetSummaryV1[];
  sheetInstances: SheetInstanceV1[];
  studentPackets: StudentPacketV1[];
}) {
  return {
    omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
    folio: args.folio,
    familyCode: args.family.familyCode,
    familyRevision: 1,
    versionSet: args.versionSet.map((item) => ({ versionCode: item.versionCode, questionCount: item.questionCount })),
    sheetInstances: args.sheetInstances.map((item) => ({
      sheetSerial: item.sheetSerial,
      pageIndex: item.pageIndex,
      versionCode: item.versionCode,
      expectedQuestionCount: item.expectedQuestionCount,
      studentBinding: item.studentBinding ?? null
    })),
    studentPackets: args.studentPackets.map((item) => ({
      alumnoId: item.alumnoId ?? null,
      studentId: item.studentId ?? null,
      studentName: item.studentName ?? null,
      sheetSerial: item.sheetSerial,
      versionCode: item.versionCode,
      fileName: item.fileName
    }))
  };
}

export async function generarBundleAssessmentOmrV1(args: {
  plantilla: PlantillaOmrV1;
  versions: VersionAssessmentV1[];
  family: OmrSheetFamilyDescriptor;
  folio: string;
  versionCount: number;
  bindings: Array<SheetBindingV1 & { serialBase: string }>;
}) : Promise<RenderBundleV1> {
  const targetPages = Math.max(1, Number(args.plantilla.bookletConfig?.targetPages ?? args.plantilla.numeroPaginas ?? 1));
  const booklet = await generarBookletPdf({ plantilla: args.plantilla, versions: args.versions, targetPages });
  const maxQuestionCount = Math.max(0, ...args.versions.map((version) => version.preguntas.length));
  const omr = await generarHojaOmrPdf({
    family: args.family,
    folio: args.folio,
    questionCount: maxQuestionCount,
    versionCount: args.versionCount,
    bindings: args.bindings
  });
  const studentPackets = await generarStudentPackets({
    bookletPdfBytes: booklet.pdfBytes,
    omrSheetPdfBytes: omr.pdfBytes,
    sheetInstances: omr.instances,
    bindings: args.bindings
  });
  const versionSet = args.versions.map((version) => ({
    versionCode: version.versionCode,
    questionCount: version.preguntas.length,
    answerKey: version.answerKey
  }));
  const manifest = manifestBundle({
    folio: args.folio,
    family: args.family,
    versionSet,
    sheetInstances: omr.instances,
    studentPackets
  });

  return {
    bookletPdfBytes: booklet.pdfBytes,
    omrSheetPdfBytes: omr.pdfBytes,
    sheetInstances: omr.instances,
    studentPackets,
    versionSet,
    manifestBytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    answerKeyBytes: Buffer.from(
      `${JSON.stringify(Object.fromEntries(versionSet.map((item) => [item.versionCode, item.answerKey])), null, 2)}\n`,
      'utf8'
    ),
    mapaOmrV1: {
      omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
      sheetFamilyCode: args.family.familyCode,
      sheetFamilyRevision: 1,
      paginas: omr.pages
    },
    bookletDiagnostics: booklet.diagnostics,
    omrDiagnostics: omr.diagnostics
  };
}

export async function persistirArtifactsAssessmentOmrV1(args: {
  folio: string;
  bookletPdfBytes: Buffer;
  omrSheetPdfBytes: Buffer;
  studentPackets: StudentPacketV1[];
  manifestBytes: Buffer;
  answerKeyBytes: Buffer;
}) {
  const base = slugOmrV1(args.folio || 'assessment-v1') || 'assessment-v1';
  const bookletPath = await guardarPdfExamen(`${base}_booklet_v1.pdf`, args.bookletPdfBytes);
  const omrSheetPath = await guardarPdfExamen(`${base}_omr_sheet_v1.pdf`, args.omrSheetPdfBytes);
  const manifestPath = await guardarArchivoExamen(`${base}_manifest_v1.json`, args.manifestBytes);
  const answerKeyPath = await guardarArchivoExamen(`${base}_answer_key_v1.json`, args.answerKeyBytes);

  const packetArtifacts: Array<{
    alumnoId?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    sheetSerial: string;
    versionCode: string;
    path: string;
    fileName: string;
  }> = [];
  for (const packet of args.studentPackets) {
    const packetPath = await guardarPdfExamen(packet.fileName, packet.pdfBytes);
    packetArtifacts.push({
      alumnoId: packet.alumnoId ?? null,
      studentId: packet.studentId ?? null,
      studentName: packet.studentName ?? null,
      sheetSerial: packet.sheetSerial,
      versionCode: packet.versionCode,
      path: packetPath,
      fileName: packet.fileName
    });
  }

  let studentPacketZipPath: string | null = null;
  if (args.studentPackets.length > 0) {
    const zip = new JSZip();
    for (const packet of args.studentPackets) {
      zip.file(packet.fileName, packet.pdfBytes);
    }
    zip.file(`${base}_manifest_v1.json`, args.manifestBytes);
    const zipBuffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
    studentPacketZipPath = await guardarArchivoExamen(`${base}_student_packets_v1.zip`, zipBuffer);
  }

  return {
    bookletPath,
    omrSheetPath,
    manifestPath,
    answerKeyPath,
    studentPacketZipPath,
    studentPacketArtifacts: packetArtifacts
  };
}
