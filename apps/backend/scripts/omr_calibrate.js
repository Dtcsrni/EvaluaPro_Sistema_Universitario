/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const jsQR = require('jsqr');

const BASE_API = process.env.API_BASE || 'http://localhost:4000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SAMPLES_DIR =
  process.env.SAMPLES_DIR ||
  path.resolve(__dirname, '..', '..', '..', 'omr_samples');
const REPORT_PATH =
  process.env.REPORT_PATH ||
  path.join(SAMPLES_DIR, 'omr_calibration_report.json');
const MAX_BASE64 = Number(process.env.OMR_MAX_BASE64 || 1_900_000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function leerQr(buffer) {
  const imagen = sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: true });
  const { data, info } = await imagen.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: 'attemptBoth' });
  return qr?.data;
}

function parseQr(texto) {
  const match = /EXAMEN:([A-Z0-9]+):P(\d+)/i.exec(String(texto || ''));
  if (!match) return null;
  return { folio: match[1].toUpperCase(), pagina: Number(match[2]) };
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} fallo (${res.status}): ${text}`);
  }
  return res.json();
}

function obtenerLetraCorrecta(opciones, orden) {
  const indiceCorrecto = opciones.findIndex((op) => op.esCorrecta);
  if (indiceCorrecto < 0) return null;
  const posicion = orden.findIndex((idx) => idx === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

async function main() {
  const token = await login();
  const archivos = (await fs.readdir(SAMPLES_DIR))
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .filter((f) => !/^crop_/i.test(f))
    .sort();

  const cacheExamen = new Map();
  const cachePreguntas = new Map();
  const comparaciones = [];

  for (const archivo of archivos) {
    const ruta = path.join(SAMPLES_DIR, archivo);
    const buffer = await fs.readFile(ruta);
    const qrTexto = await leerQr(buffer);
    const parsed = parseQr(qrTexto);
    if (!parsed) {
      console.warn(`QR no detectado: ${archivo}`);
      continue;
    }

    const comprimida = await compressImage(buffer);
    const imagenBase64 = `data:image/jpeg;base64,${comprimida.toString('base64')}`;

    const res = await fetch(`${BASE_API}/omr/analizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        folio: parsed.folio,
        numeroPagina: parsed.pagina,
        imagenBase64
      })
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`OMR fallo ${archivo}: ${res.status} ${text}`);
      continue;
    }
    const omr = await res.json();

    let examen = cacheExamen.get(parsed.folio);
    if (!examen) {
      const ex = await fetchJson(`${BASE_API}/examenes/generados/folio/${parsed.folio}`, token);
      examen = ex.examen ?? ex;
      cacheExamen.set(parsed.folio, examen);
    }

    const periodoId = String(examen.periodoId || '');
    let preguntas = cachePreguntas.get(periodoId);
    if (!preguntas) {
      const data = await fetchJson(`${BASE_API}/banco-preguntas?periodoId=${periodoId}`, token);
      preguntas = data.preguntas ?? [];
      cachePreguntas.set(periodoId, preguntas);
    }

    const mapaPreguntas = new Map(preguntas.map((p) => [String(p._id), p]));
    const ordenPreguntas = examen.mapaVariante?.ordenPreguntas ?? [];
    const ordenOpcionesPorPregunta = examen.mapaVariante?.ordenOpcionesPorPregunta ?? {};
    const correctasPorNumero = new Map();
    ordenPreguntas.forEach((id, idx) => {
      const pregunta = mapaPreguntas.get(String(id));
      if (!pregunta) return;
      const version =
        (pregunta.versiones || []).find((v) => v.numeroVersion === pregunta.versionActual) ??
        (pregunta.versiones || [])[0];
      if (!version) return;
      const orden = ordenOpcionesPorPregunta[id] ?? [0, 1, 2, 3, 4];
      const letra = obtenerLetraCorrecta(version.opciones || [], orden);
      correctasPorNumero.set(idx + 1, letra);
    });

    const paginaOmr = (examen.mapaOmr?.paginas || []).find((p) => p.numeroPagina === parsed.pagina);
    const numerosPagina = paginaOmr ? paginaOmr.preguntas.map((p) => p.numeroPregunta) : [];
    const respuestas = omr?.resultado?.respuestasDetectadas || [];
    const respuestasPorNumero = new Map(
      respuestas.map((r) => [r.numeroPregunta, r.opcion ? String(r.opcion).toUpperCase() : null])
    );

    let contestadas = 0;
    let correctas = 0;
    const detalle = numerosPagina.map((n) => {
      const esperada = correctasPorNumero.get(n) ?? null;
      const marcada = respuestasPorNumero.get(n) ?? null;
      if (marcada) contestadas += 1;
      if (marcada && esperada && marcada === esperada) correctas += 1;
      return { numero: n, esperada, marcada };
    });

    comparaciones.push({
      archivo,
      folio: parsed.folio,
      pagina: parsed.pagina,
      alumnoId: omr?.alumnoId ?? null,
      advertencias: omr?.resultado?.advertencias ?? [],
      total: numerosPagina.length,
      contestadas,
      enBlanco: Math.max(0, numerosPagina.length - contestadas),
      correctas,
      precision: numerosPagina.length ? Number((correctas / numerosPagina.length).toFixed(4)) : 0,
      deteccion: numerosPagina.length ? Number((contestadas / numerosPagina.length).toFixed(4)) : 0,
      detalle
    });

    await delay(150);
  }

  const totalReactivos = comparaciones.reduce((acc, c) => acc + (c.total || 0), 0);
  const totalContestadas = comparaciones.reduce((acc, c) => acc + (c.contestadas || 0), 0);
  const totalCorrectas = comparaciones.reduce((acc, c) => acc + (c.correctas || 0), 0);

  const reporte = {
    generadoEn: new Date().toISOString(),
    baseApi: BASE_API,
    imagenes: comparaciones.length,
    folios: Array.from(new Set(comparaciones.map((c) => c.folio))),
    totalReactivos,
    totalContestadas,
    totalCorrectas,
    precisionGlobal: totalReactivos ? Number((totalCorrectas / totalReactivos).toFixed(4)) : 0,
    deteccionGlobal: totalReactivos ? Number((totalContestadas / totalReactivos).toFixed(4)) : 0,
    comparaciones
  };

  await fs.writeFile(REPORT_PATH, JSON.stringify(reporte, null, 2), 'utf8');
  console.log(`Reporte guardado en ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
