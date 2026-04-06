/**
 * omr-validate
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';

type EntradaImagen = { archivo: string; pagina: number };

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const imagenes: EntradaImagen[] = [];
  let folio = '';
  let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evaluapro';
  let answersRaw = '';
  let paginaActual = 1;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--folio' && args[i + 1]) {
      folio = args[i + 1];
      i += 1;
      continue;
    }
    if ((arg === '--pagina' || arg === '-p') && args[i + 1]) {
      paginaActual = Math.max(1, Number(args[i + 1]) || 1);
      i += 1;
      continue;
    }
    if ((arg === '--imagen' || arg === '-i') && args[i + 1]) {
      imagenes.push({ archivo: args[i + 1], pagina: paginaActual });
      i += 1;
      continue;
    }
    if (arg === '--mongo' && args[i + 1]) {
      mongoUri = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--answers' && args[i + 1]) {
      answersRaw = args[i + 1];
      i += 1;
      continue;
    }
  }

  return { folio: folio.trim().toUpperCase(), imagenes, mongoUri, answersRaw };
}

function parseAnswers(raw: string) {
  const mapa = new Map<number, string>();
  const tokens = String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const match = /^(\d+)\s*([a-eA-E])$/.exec(token.replace(/\s+/g, ''));
    if (!match) continue;
    mapa.set(Number(match[1]), match[2].toUpperCase());
  }
  return mapa;
}

async function leerComoDataUrl(archivo: string) {
  const ext = path.extname(archivo).toLowerCase();
  const buffer = await fs.readFile(archivo);
  if (ext === '.png') {
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function main() {
  const { folio, imagenes, mongoUri, answersRaw } = parseArgs(process.argv);
  if (!folio || imagenes.length === 0 || !answersRaw) {
    console.log(
      'Uso: npx tsx apps/backend/scripts/omr-validate.ts --folio FOLIO --answers "1c,2a,..." --pagina 1 --imagen ruta1 --pagina 2 --imagen ruta2'
    );
    process.exit(1);
  }

  const answers = parseAnswers(answersRaw);
  await mongoose.connect(mongoUri);
  const examen = await ExamenGenerado.findOne({ folio }).lean();
  if (!examen) {
    console.error(`No se encontro examen para folio ${folio}`);
    process.exit(1);
  }

  const paginas = (examen.mapaOmr as { paginas?: Array<{ numeroPagina: number }> } | undefined)?.paginas ?? [];
  if (!paginas.length) {
    console.error('El examen no tiene mapa OMR');
    process.exit(1);
  }

  const resultados: Array<{ numero: number; detectada: string | null; esperada: string | null; pagina: number }> = [];

  for (const entrada of imagenes) {
    const mapaPagina = paginas.find((p) => p.numeroPagina === entrada.pagina);
    if (!mapaPagina) {
      console.error(`No hay mapa OMR para pagina ${entrada.pagina}`);
      continue;
    }
    const imagenBase64 = await leerComoDataUrl(entrada.archivo);
    const resultado = await analizarOmr(imagenBase64, mapaPagina as never, [folio, `EXAMEN:${folio}:P${entrada.pagina}`], 10);
    for (const r of resultado.respuestasDetectadas) {
      resultados.push({
        numero: r.numeroPregunta,
        detectada: r.opcion ? String(r.opcion).toUpperCase() : null,
        esperada: answers.get(r.numeroPregunta) ?? null,
        pagina: entrada.pagina
      });
    }
  }

  resultados.sort((a, b) => a.numero - b.numero);
  let correctas = 0;
  let detectadas = 0;
  const total = resultados.length;
  const detalle = resultados.map((r) => {
    if (r.detectada) detectadas += 1;
    const ok = r.detectada && r.esperada && r.detectada === r.esperada;
    if (ok) correctas += 1;
    return { ...r, ok };
  });

  console.log(`Folio: ${folio}`);
  console.log(`Total reactivos: ${total}`);
  console.log(`Detectadas: ${detectadas}`);
  console.log(`Aciertos vs marcadas: ${correctas}`);
  console.log(`Precision: ${total ? (correctas / total).toFixed(4) : '0'}`);
  console.log(`Deteccion: ${total ? (detectadas / total).toFixed(4) : '0'}`);
  for (const d of detalle) {
    console.log(
      `P${d.numero} (Pag ${d.pagina}): esperado ${d.esperada ?? '-'} / detectado ${d.detectada ?? '-'}${d.ok ? ' ✅' : ''}`
    );
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
