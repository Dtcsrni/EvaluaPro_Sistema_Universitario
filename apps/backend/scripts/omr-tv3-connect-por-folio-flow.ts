/**
 * omr-tv3-connect-por-folio-flow
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import mongoose, { Types } from 'mongoose';
import { Docente } from '../src/modulos/modulo_autenticacion/modeloDocente';
import { Periodo } from '../src/modulos/modulo_alumnos/modeloPeriodo';
import { ExamenPlantilla } from '../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import { guardarPdfExamen } from '../src/infraestructura/archivos/almacenLocal';

process.env.EXAMEN_MEZCLAR_PREGUNTAS_OPCIONES = '0';

type Letter = 'A' | 'B' | 'C' | 'D' | 'E';

type CanonicalBankRow = {
  numeroPregunta: number;
  prompt: string;
  options: Record<Letter, string>;
  correctOption: Letter;
};

type CanonicalReport = {
  canonicalVisibleBank?: CanonicalBankRow[];
};

type ParsedArgs = {
  mongoUri: string;
  docenteId: string;
  periodoId: string;
  plantillaId: string;
  sourceDir: string;
  reportPath: string;
  outputReport: string;
  archiveExisting: boolean;
  loteId?: string;
};

type PreguntaPdf = {
  id: string;
  enunciado: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    mongoUri: 'mongodb://127.0.0.1:27017/evaluapro_prod',
    docenteId: '',
    periodoId: '',
    plantillaId: '',
    sourceDir: '../../omr_samples_tv3/images/Por Folio',
    reportPath: '../../reports/qa/latest/por_folio_analysis_from_zero.json',
    outputReport: '../../reports/qa/latest/omr/por-folio-flow-connection.json',
    archiveExisting: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--mongo-uri' && next) {
      out.mongoUri = next;
      i += 1;
    } else if (arg === '--docente-id' && next) {
      out.docenteId = next;
      i += 1;
    } else if (arg === '--periodo-id' && next) {
      out.periodoId = next;
      i += 1;
    } else if (arg === '--plantilla-id' && next) {
      out.plantillaId = next;
      i += 1;
    } else if (arg === '--source-dir' && next) {
      out.sourceDir = next;
      i += 1;
    } else if (arg === '--report' && next) {
      out.reportPath = next;
      i += 1;
    } else if (arg === '--output-report' && next) {
      out.outputReport = next;
      i += 1;
    } else if (arg === '--lote-id' && next) {
      out.loteId = next.toUpperCase();
      i += 1;
    } else if (arg === '--keep-existing') {
      out.archiveExisting = false;
    } else if (arg === '--archive-existing') {
      out.archiveExisting = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  if (!out.docenteId) throw new Error('--docente-id es requerido');
  if (!out.periodoId) throw new Error('--periodo-id es requerido');
  if (!out.plantillaId) throw new Error('--plantilla-id es requerido');
  return out;
}

function printHelp() {
  console.log(
    'Uso: tsx scripts/omr-tv3-connect-por-folio-flow.ts --docente-id <id> --periodo-id <id> --plantilla-id <id> [--mongo-uri <uri>] [--source-dir <dir>] [--report <json>] [--output-report <json>] [--lote-id <id>] [--keep-existing]'
  );
}

function resolveFromCwd(value: string) {
  return path.resolve(process.cwd(), value);
}

function sanitizeFileName(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildLoteId(explicit?: string) {
  if (explicit) return sanitizeFileName(explicit).slice(0, 16).toUpperCase();
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(
    now.getUTCHours()
  ).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;
  return `PF${stamp}`.slice(0, 16).toUpperCase();
}

async function readCanonicalBank(reportPath: string) {
  const raw = await fs.readFile(reportPath, 'utf8');
  const parsed = JSON.parse(raw) as CanonicalReport;
  const bank = Array.isArray(parsed.canonicalVisibleBank) ? parsed.canonicalVisibleBank.slice() : [];
  if (bank.length === 0) {
    throw new Error(`El reporte ${reportPath} no contiene canonicalVisibleBank`);
  }
  return bank.sort((a, b) => a.numeroPregunta - b.numeroPregunta);
}

async function readFolios(sourceDir: string) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const folios = entries
    .filter((entry) => entry.isDirectory() && /^[A-F0-9]{8}$/i.test(entry.name))
    .map((entry) => entry.name.toUpperCase())
    .sort((a, b) => a.localeCompare(b));
  if (folios.length === 0) {
    throw new Error(`No se detectaron folios en ${sourceDir}`);
  }
  return folios;
}

function buildPreguntasPdf(bank: CanonicalBankRow[], preguntasIds: string[]): PreguntaPdf[] {
  if (bank.length !== preguntasIds.length) {
    throw new Error(`El reporte canónico tiene ${bank.length} preguntas y la plantilla ${preguntasIds.length}`);
  }

  return bank.map((row, index) => ({
    id: preguntasIds[index]!,
    enunciado: row.prompt,
    opciones: (['A', 'B', 'C', 'D', 'E'] as const).map((letter) => ({
      texto: row.options[letter],
      esCorrecta: row.correctOption === letter
    }))
  }));
}

function buildIdentityVariant(preguntas: PreguntaPdf[]) {
  return {
    ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
    ordenOpcionesPorPregunta: Object.fromEntries(preguntas.map((pregunta) => [pregunta.id, [0, 1, 2, 3, 4]]))
  };
}

function buildHeader(periodoNombre: string, docenteNombre: string) {
  return {
    institucion: 'Centro Universitario Hidalguense',
    lema: 'La sabiduría es nuestra fuerza',
    materia: periodoNombre,
    docente: `I.S.C. ${docenteNombre}`.trim(),
    instrucciones:
      'Instrucción: rellena un solo círculo por pregunta. Correcto: círculo completamente lleno (+). Incorrecto: medio relleno (O), techado (/) o dos opciones marcadas.'
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = resolveFromCwd(args.sourceDir);
  const reportPath = resolveFromCwd(args.reportPath);
  const outputReport = resolveFromCwd(args.outputReport);
  const loteId = buildLoteId(args.loteId);

  const [folios, bank] = await Promise.all([readFolios(sourceDir), readCanonicalBank(reportPath)]);

  await mongoose.connect(args.mongoUri);
  try {
    const [docente, periodo, plantilla] = await Promise.all([
      Docente.findById(args.docenteId).lean(),
      Periodo.findById(args.periodoId).lean(),
      ExamenPlantilla.findById(args.plantillaId).lean()
    ]);

    if (!docente) throw new Error(`Docente no encontrado: ${args.docenteId}`);
    if (!periodo) throw new Error(`Periodo no encontrado: ${args.periodoId}`);
    if (!plantilla) throw new Error(`Plantilla no encontrada: ${args.plantillaId}`);
    if (String(plantilla.docenteId) !== args.docenteId) throw new Error('La plantilla no pertenece al docente especificado');
    if (String(plantilla.periodoId ?? '') !== args.periodoId) throw new Error('La plantilla no pertenece al periodo especificado');

    const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds.map((item) => String(item)) : [];
    if (preguntasIds.length === 0) throw new Error('La plantilla no tiene preguntasIds');

    const activeFolioCollisions = await ExamenGenerado.find({
      folio: { $in: folios },
      archivadoEn: { $exists: false },
      _id: { $nin: [] }
    })
      .select({ _id: 1, folio: 1, plantillaId: 1, docenteId: 1 })
      .lean();
    if (activeFolioCollisions.length > 0) {
      throw new Error(
        `Ya existen folios activos en examenesGenerados: ${activeFolioCollisions.map((item) => `${String(item.folio)}:${String(item._id)}`).join(', ')}`
      );
    }

    let archivedExisting = 0;
    if (args.archiveExisting) {
      const archiveResult = await ExamenGenerado.updateMany(
        { plantillaId: new Types.ObjectId(args.plantillaId), archivadoEn: { $exists: false } },
        { $set: { archivadoEn: new Date(), updatedAt: new Date() } }
      );
      archivedExisting = Number(archiveResult.modifiedCount ?? 0);
    }

    const preguntas = buildPreguntasPdf(bank, preguntasIds);
    const mapaVariante = buildIdentityVariant(preguntas);
    const encabezado = buildHeader(String(periodo.nombre ?? '').trim(), String(docente.nombreCompleto ?? '').trim());

    const created: Array<{ examenId: string; folio: string; rutaPdf: string; pageRanges: string[] }> = [];
    for (const folio of folios) {
      const generatedId = new Types.ObjectId();
      const resultado = await generarPdfExamen({
        titulo: 'Primer Parcial',
        folio,
        examId: folio,
        preguntas,
        mapaVariante,
        tipoExamen: (String(plantilla.tipo ?? 'parcial') === 'global' ? 'global' : 'parcial') as 'parcial' | 'global',
        totalPaginas: Number(plantilla.numeroPaginas ?? 2),
        margenMm: Number((plantilla as { configuracionPdf?: { margenMm?: unknown } }).configuracionPdf?.margenMm ?? 10),
        encabezado,
        templateVersion: 3
      });

      const nombreArchivo = `${sanitizeFileName(`evaluapro_porfolio_${folio}_${loteId}`) || folio}.pdf`;
      const rutaPdf = await guardarPdfExamen(nombreArchivo, Buffer.from(resultado.pdfBytes));

      const examen = await ExamenGenerado.create({
        _id: generatedId,
        docenteId: new Types.ObjectId(args.docenteId),
        periodoId: new Types.ObjectId(args.periodoId),
        plantillaId: new Types.ObjectId(args.plantillaId),
        loteId,
        folio,
        estado: 'generado',
        preguntasIds: preguntasIds.map((id) => new Types.ObjectId(id)),
        mapaVariante,
        paginas: resultado.paginas,
        mapaOmr: resultado.mapaOmr,
        rutaPdf
      });

      created.push({
        examenId: String(examen._id),
        folio,
        rutaPdf,
        pageRanges: (Array.isArray(resultado.paginas) ? resultado.paginas : []).map(
          (pagina) => `P${Number(pagina.numero ?? 0)}:${Number(pagina.preguntasDel ?? 0)}-${Number(pagina.preguntasAl ?? 0)}`
        )
      });
    }

    await fs.mkdir(path.dirname(outputReport), { recursive: true });
    await fs.writeFile(
      outputReport,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mongoUri: args.mongoUri,
          docenteId: args.docenteId,
          periodoId: args.periodoId,
          plantillaId: args.plantillaId,
          loteId,
          sourceDir: path.relative(process.cwd(), sourceDir).replace(/\\/g, '/'),
          reportPath: path.relative(process.cwd(), reportPath).replace(/\\/g, '/'),
          totalFolios: folios.length,
          archivedExisting,
          created
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          loteId,
          totalFolios: folios.length,
          archivedExisting,
          created
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
