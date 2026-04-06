/**
 * omr-validate-api
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const BASE_API = process.env.API_BASE || 'http://localhost:4000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const MAX_BASE64 = Number(process.env.OMR_MAX_BASE64 || 1_900_000);

function parseArgs(argv) {
  const args = argv.slice(2);
  const imagenes = [];
  let folio = '';
  let paginaActual = 1;
  let answersRaw = '';

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
    if (arg === '--answers' && args[i + 1]) {
      answersRaw = args[i + 1];
      i += 1;
      continue;
    }
  }

  return { folio: String(folio || '').trim().toUpperCase(), imagenes, answersRaw };
}

function parseAnswers(raw) {
  const mapa = new Map();
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

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Configura EMAIL y PASSWORD en el entorno para autenticarte.');
  }
  const res = await fetch(`${BASE_API}/autenticacion/ingresar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: EMAIL, contrasena: PASSWORD })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login fallo (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.token;
}

async function compressImage(buffer) {
  let width = 1600;
  let quality = 70;
  for (let i = 0; i < 6; i += 1) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    const base64Size = Math.ceil(out.length * 4 / 3);
    if (base64Size <= MAX_BASE64) return out;
    width = Math.max(900, width - 150);
    quality = Math.max(45, quality - 8);
  }
  return sharp(buffer)
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 45, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const { folio, imagenes, answersRaw } = parseArgs(process.argv);
  if (!folio || imagenes.length === 0 || !answersRaw) {
    console.log(
      'Uso: node apps/backend/scripts/omr-validate-api.js --folio FOLIO --answers "1c,2a,..." --pagina 1 --imagen ruta1 --pagina 2 --imagen ruta2'
    );
    process.exit(1);
  }

  const answers = parseAnswers(answersRaw);
  const token = await login();

  const resultados = [];
  for (const entrada of imagenes) {
    const buffer = await fs.readFile(entrada.archivo);
    const comprimida = await compressImage(buffer);
    const imagenBase64 = `data:image/jpeg;base64,${comprimida.toString('base64')}`;
    const res = await fetch(`${BASE_API}/omr/analizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        folio,
        numeroPagina: entrada.pagina,
        imagenBase64
      })
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`OMR fallo ${path.basename(entrada.archivo)}: ${res.status} ${text}`);
      continue;
    }
    const omr = await res.json();
    const respuestas = omr?.resultado?.respuestasDetectadas || [];
    for (const r of respuestas) {
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
  for (const r of resultados) {
    if (r.detectada) detectadas += 1;
    if (r.detectada && r.esperada && r.detectada === r.esperada) correctas += 1;
  }

  console.log(`Folio: ${folio}`);
  console.log(`Total reactivos: ${total}`);
  console.log(`Detectadas: ${detectadas}`);
  console.log(`Aciertos vs marcadas: ${correctas}`);
  console.log(`Precision: ${total ? (correctas / total).toFixed(4) : '0'}`);
  console.log(`Deteccion: ${total ? (detectadas / total).toFixed(4) : '0'}`);
  for (const r of resultados) {
    const ok = r.detectada && r.esperada && r.detectada === r.esperada;
    console.log(
      `P${r.numero} (Pag ${r.pagina}): esperado ${r.esperada ?? '-'} / detectado ${r.detectada ?? '-'}${ok ? ' ✅' : ''}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

