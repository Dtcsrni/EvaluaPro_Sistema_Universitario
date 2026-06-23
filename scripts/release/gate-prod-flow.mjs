#!/usr/bin/env node
/**
 * gate-prod-flow
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * gate-prod-flow
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const PASOS_MANUALES = [
  { id: 'autenticacion', campo: 'autenticacionValida', nombre: 'Autenticacion docente valida' },
  { id: 'periodo', campo: 'periodoGestionado', nombre: 'Creacion/seleccion de periodo operativo' },
  { id: 'alumno', campo: 'alumnoGestionado', nombre: 'Alta/seleccion de alumno' },
  { id: 'reactivos_plantilla', campo: 'reactivosYPlantilla', nombre: 'Seleccion/creacion de reactivos y plantilla' },
  { id: 'generacion_examen', campo: 'examenGenerado', nombre: 'Generacion de examen' },
  { id: 'vinculacion_entrega', campo: 'entregaVinculada', nombre: 'Vinculacion de entrega' },
  { id: 'calificacion', campo: 'calificacionCompleta', nombre: 'Calificacion completa' }
];

const AYUDA = `
Uso:
  npm run release:gate:prod-flow -- --version=1.0.0 --periodo-id=<id> --manual=docs/release/manual/prod-flow.json

Opciones:
  --version=<semver>          Version candidata (requerido)
  --periodo-id=<id>           Periodo evaluado en produccion (requerido)
  --manual=<ruta.json>        Evidencia manual pasos 1..7 (requerido)
  --api-base=<url>            Base API (default: env RELEASE_GATE_API_BASE o http://localhost:3000/api)
  --token=<jwt>               Token docente (default: env RELEASE_GATE_DOCENTE_TOKEN)
  --docente-id=<valor>        Identificador docente para hash (default: manual.docenteId o env RELEASE_GATE_DOCENTE_ID)
  --commit=<sha>              Commit (default: env GITHUB_SHA o "local")
  --ci-green=<n>              Corridas verdes consecutivas (default: env RELEASE_GATE_CI_GREEN o 0)
`;

function arg(nombre, fallback = '') {
  const prefijo = `--${nombre}=`;
  const valor = process.argv.find((x) => x.startsWith(prefijo));
  return valor ? valor.slice(prefijo.length).trim() : fallback;
}

function normalizarBaseApi(valor) {
  const base = String(valor || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return base.endsWith('/api') ? base : `${base}/api`;
}

function hashHex(valor) {
  const input = typeof valor === 'string' || Buffer.isBuffer(valor) ? valor : String(valor);
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function leerVersionMetadata() {
  const metaPath = path.resolve(process.cwd(), 'config', 'app-version.json');
  try {
    const texto = await fs.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(texto);
    return {
      version: String(parsed?.version || '').trim(),
      displayVersion: String(parsed?.displayVersion || parsed?.version || '').trim()
    };
  } catch {
    return { version: '', displayVersion: '' };
  }
}

function resolveWindowsEvidencePath() {
  const explicit = arg('windows-evidence', process.env.RELEASE_GATE_WINDOWS_EVIDENCE || '').trim();
  if (explicit) {
    return path.resolve(process.cwd(), explicit);
  }
  const evidencesRoot = path.resolve(process.cwd(), 'docs', 'release', 'evidencias');
  if (!fsSync.existsSync(evidencesRoot)) return '';
  const matches = [];
  for (const dirent of fsSync.readdirSync(evidencesRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const candidate = path.join(evidencesRoot, dirent.name, 'windows-release-smoke-2026-03-20.md');
    if (fsSync.existsSync(candidate)) {
      const stats = fsSync.statSync(candidate);
      matches.push({ candidate, mtimeMs: stats.mtimeMs });
    }
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.candidate || '';
}

async function cargarManual(ruta) {
  const texto = await fs.readFile(ruta, 'utf8');
  return JSON.parse(texto);
}

function extraerMetricasLista(metricsText) {
  return String(metricsText)
    .split(/\r?\n/)
    .filter((line) => line.includes('evaluapro_lista_export_'))
    .join('\n');
}

async function getTexto(url, token) {
  const inicio = Date.now();
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const texto = await resp.text();
  return {
    ok: resp.ok,
    status: resp.status,
    requestId: resp.headers.get('x-request-id') || '',
    body: texto,
    duracionMs: Date.now() - inicio
  };
}

async function getBinario(url, token) {
  const inicio = Date.now();
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const ab = await resp.arrayBuffer();
  return {
    ok: resp.ok,
    status: resp.status,
    requestId: resp.headers.get('x-request-id') || '',
    body: Buffer.from(ab),
    duracionMs: Date.now() - inicio
  };
}

async function run() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(AYUDA);
    return;
  }

  const version = arg('version');
  const periodoId = arg('periodo-id');
  const manualPath = arg('manual');
  const apiBase = normalizarBaseApi(arg('api-base', process.env.RELEASE_GATE_API_BASE || 'http://localhost:3000/api'));
  const token = arg('token', process.env.RELEASE_GATE_DOCENTE_TOKEN || '');
  const commit = arg('commit', process.env.GITHUB_SHA || 'local');
  const ciGreen = Number(arg('ci-green', process.env.RELEASE_GATE_CI_GREEN || '0'));
  const versionMeta = await leerVersionMetadata();

  if (!version) throw new Error('Falta --version');
  if (!periodoId) throw new Error('Falta --periodo-id');
  if (!manualPath) throw new Error('Falta --manual');
  if (!apiBase) throw new Error('Falta --api-base o RELEASE_GATE_API_BASE');
  if (!token) throw new Error('Falta --token o RELEASE_GATE_DOCENTE_TOKEN');

  const manual = await cargarManual(path.resolve(process.cwd(), manualPath));
  const salt = String(process.env.RELEASE_GATE_DOCENTE_HASH_SALT || 'release-gate-salt');
  const docenteRaw = arg('docente-id', String(manual.docenteId || process.env.RELEASE_GATE_DOCENTE_ID || '')).trim();
  if (!docenteRaw) throw new Error('Falta docenteId manual o --docente-id/RELEASE_GATE_DOCENTE_ID');
  const docenteIdHash = hashHex(`${docenteRaw}|${salt}`);

  const inicioGlobal = Date.now();
  const pasos = [];

  for (const paso of PASOS_MANUALES) {
    const ok = Boolean(manual[paso.campo]);
    pasos.push({
      id: paso.id,
      nombre: paso.nombre,
      resultado: ok ? 'ok' : 'fallo',
      fuente: 'manual',
      detalle: ok ? 'Validado por docente humano en produccion' : `Fallo manual en campo ${paso.campo}`
    });
  }

  const urlCsv = `${apiBase}/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(periodoId)}`;
  const urlDocx = `${apiBase}/analiticas/lista-academica-docx?periodoId=${encodeURIComponent(periodoId)}`;
  const urlFirma = `${apiBase}/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(periodoId)}`;
  const urlMetrics = `${apiBase}/metrics`;

  const csvResp = await getTexto(urlCsv, token);
  const docxResp = await getBinario(urlDocx, token);
  const firmaResp = await getTexto(urlFirma, token);
  const metricsResp = await getTexto(urlMetrics, token);

  const exportOk = csvResp.ok && docxResp.ok && firmaResp.ok;
  pasos.push({
    id: 'exportacion_csv_docx_firma',
    nombre: 'Exportacion de CSV/DOCX/firma',
    resultado: exportOk ? 'ok' : 'fallo',
    fuente: 'automatica',
    requestId: firmaResp.requestId || csvResp.requestId || docxResp.requestId,
    detalle: `csv=${csvResp.status}, docx=${docxResp.status}, firma=${firmaResp.status}`,
    duracionMs: csvResp.duracionMs + docxResp.duracionMs + firmaResp.duracionMs
  });

  let integridadOk = false;
  let integridad = {};
  if (exportOk) {
    const manifiesto = JSON.parse(firmaResp.body);
    const csvHash = hashHex(Buffer.from(csvResp.body, 'utf8'));
    const docxHash = hashHex(docxResp.body);
    const csvItem = Array.isArray(manifiesto.archivos) ? manifiesto.archivos.find((x) => x?.nombre === 'lista-academica.csv') : null;
    const docxItem = Array.isArray(manifiesto.archivos) ? manifiesto.archivos.find((x) => x?.nombre === 'lista-academica.docx') : null;
    integridadOk = Boolean(
      csvItem &&
      docxItem &&
      String(csvItem.sha256 || '') === csvHash &&
      String(docxItem.sha256 || '') === docxHash &&
      Number(docxItem.bytes || 0) === docxResp.body.byteLength
    );
    integridad = {
      algoritmo: manifiesto.algoritmo,
      csv: {
        hashCalculado: csvHash,
        hashManifiesto: csvItem ? csvItem.sha256 : null,
        bytesCalculados: Buffer.byteLength(csvResp.body, 'utf8'),
        bytesManifiesto: csvItem ? csvItem.bytes : null
      },
      docx: {
        hashCalculado: docxHash,
        hashManifiesto: docxItem ? docxItem.sha256 : null,
        bytesCalculados: docxResp.body.byteLength,
        bytesManifiesto: docxItem ? docxItem.bytes : null
      }
    };
  }

  pasos.push({
    id: 'integridad_sha256',
    nombre: 'Verificacion de integridad SHA-256',
    resultado: integridadOk ? 'ok' : 'fallo',
    fuente: 'automatica',
    requestId: firmaResp.requestId,
    detalle: integridadOk ? 'Hashes y bytes coinciden con manifiesto' : 'Mismatch de hash/bytes contra manifiesto'
  });

  const metricasTexto = metricsResp.ok ? extraerMetricasLista(metricsResp.body) : '';
  const metricasOk = metricsResp.ok && metricasTexto.includes('evaluapro_lista_export_csv_total') && metricasTexto.includes('evaluapro_lista_export_docx_total') && metricasTexto.includes('evaluapro_lista_export_firma_total');
  pasos.push({
    id: 'metricas_exportacion',
    nombre: 'Confirmacion de metricas de exportacion',
    resultado: metricasOk ? 'ok' : 'fallo',
    fuente: 'automatica',
    requestId: metricsResp.requestId,
    detalle: metricasOk ? 'Metricas de exportacion presentes en /api/metrics' : `status=${metricsResp.status}`
  });

  const resultado = pasos.every((p) => p.resultado === 'ok') ? 'ok' : 'fallo';
  const duracionMs = Date.now() - inicioGlobal;
  const ejecutadoEn = new Date().toISOString();

  const salidaDir = path.resolve(process.cwd(), `docs/release/evidencias/${version}`);
  await fs.mkdir(salidaDir, { recursive: true });

  const manifest = {
    version: versionMeta.version || version,
    displayVersion: versionMeta.displayVersion || versionMeta.version || version,
    commit,
    ciConsecutivoVerde: Number.isFinite(ciGreen) ? ciGreen : 0,
    evidenciaWindows: {
      path: (() => {
        const evidencePath = resolveWindowsEvidencePath();
        return evidencePath ? path.relative(process.cwd(), evidencePath).replace(/\\/g, '/') : '';
      })()
    },
    gateHumanoProduccion: {
      version: versionMeta.version || version,
      displayVersion: versionMeta.displayVersion || versionMeta.version || version,
      ejecutadoEn,
      entorno: 'production',
      docenteIdHash,
      periodoId,
      ventana: {
        startedAt: String(manual.windowStartedAt || ''),
        endedAt: String(manual.windowEndedAt || '')
      },
      operador: {
        nombre: String(manual.operatorName || ''),
        observaciones: String(manual.notes || '')
      },
      resultado,
      duracionMs,
      pasos
    },
    artefactos: {
      timeline: `docs/release/evidencias/${version}/timeline.md`,
      metricas: `docs/release/evidencias/${version}/metrics_snapshot.txt`,
      integridad: `docs/release/evidencias/${version}/integridad_sha256.json`
    }
  };

  const timeline = [
    `# Timeline Gate Estable ${versionMeta.version || version}`,
    '',
    `- Etiqueta visible GUI: ${versionMeta.displayVersion || versionMeta.version || version}`,
    `- Ejecutado en: ${ejecutadoEn}`,
    `- Commit: ${commit}`,
    `- Periodo: ${periodoId}`,
    `- Resultado: ${resultado.toUpperCase()}`,
    `- Duracion total (ms): ${duracionMs}`,
    '',
    '## Pasos',
    ...pasos.map((p, i) => `${i + 1}. [${p.resultado.toUpperCase()}] ${p.nombre} (${p.fuente})${p.requestId ? ` requestId=${p.requestId}` : ''}${p.detalle ? ` - ${p.detalle}` : ''}`)
  ].join('\n');

  await fs.writeFile(path.join(salidaDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(salidaDir, 'timeline.md'), `${timeline}\n`, 'utf8');
  await fs.writeFile(path.join(salidaDir, 'metrics_snapshot.txt'), `${metricasTexto}\n`, 'utf8');
  await fs.writeFile(path.join(salidaDir, 'integridad_sha256.json'), `${JSON.stringify(integridad, null, 2)}\n`, 'utf8');

  const eventoRelease = {
    timestamp: ejecutadoEn,
    event: resultado === 'ok' ? 'release.gate.prod_flow.success' : 'release.gate.prod_flow.failure',
    version,
    requestId: firmaResp.requestId || csvResp.requestId || metricsResp.requestId || '',
    docenteId: docenteIdHash,
    periodoId,
    duracionMs,
    resultado
  };
  process.stdout.write(`${JSON.stringify(eventoRelease)}\n`);
  process.stdout.write(`[release-gate] Evidencia escrita en ${salidaDir}\n`);

  if (resultado !== 'ok') process.exit(1);
}

run().catch((error) => {
  process.stderr.write(`[release-gate] Error: ${String(error?.message || error)}\n`);
  process.exit(1);
});
