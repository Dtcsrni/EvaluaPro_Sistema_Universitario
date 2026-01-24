import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';

type EntradaImagen = { archivo: string; pagina: number };

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const imagenes: EntradaImagen[] = [];
  let folio = '';
  let paginaActual = 1;
  let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mern_app';

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
  }

  return { folio: folio.trim().toUpperCase(), imagenes, mongoUri };
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
  const png = await sharp(buffer).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function main() {
  const { folio, imagenes, mongoUri } = parseArgs(process.argv);
  if (!folio || imagenes.length === 0) {
    console.log(
      'Uso: npx tsx apps/backend/scripts/omr-run.ts --folio FOLIO --pagina 1 --imagen ruta1 --pagina 2 --imagen ruta2'
    );
    process.exit(1);
  }

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

  for (const entrada of imagenes) {
    const mapaPagina = paginas.find((p) => p.numeroPagina === entrada.pagina);
    if (!mapaPagina) {
      console.error(`No hay mapa OMR para pagina ${entrada.pagina}`);
      continue;
    }
    const imagenBase64 = await leerComoDataUrl(entrada.archivo);
    const resultado = await analizarOmr(imagenBase64, mapaPagina as never, [folio, `EXAMEN:${folio}:P${entrada.pagina}`], 10);

    const respondidas = resultado.respuestasDetectadas.filter((r) => r.opcion).length;
    console.log(`\nArchivo: ${entrada.archivo}`);
    console.log(`Pagina: ${entrada.pagina}`);
    console.log(`QR: ${resultado.qrTexto ?? '-'}`);
    if (resultado.advertencias.length) {
      console.log(`Advertencias: ${resultado.advertencias.join(' | ')}`);
    }
    console.log(`Respondidas: ${respondidas}/${resultado.respuestasDetectadas.length}`);
    resultado.respuestasDetectadas.forEach((r) => {
      console.log(`  P${r.numeroPregunta}: ${r.opcion ?? '-'} (${Math.round(r.confianza * 100)}%)`);
    });
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
