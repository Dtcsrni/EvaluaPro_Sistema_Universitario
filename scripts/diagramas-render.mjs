/**
 * diagramas-render
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldCheck = args.has('--check');

if (!shouldWrite && !shouldCheck) {
  console.error('Uso: node scripts/diagramas-render.mjs --write | --check');
  process.exit(2);
}

// Permite desactivar el check en casos excepcionales (p.ej. entorno CI sin Chromium).
if (shouldCheck && process.env.DIAGRAMAS_RENDER_CHECK === '0') {
  console.log('[diagramas:render] skip (DIAGRAMAS_RENDER_CHECK=0)');
  process.exit(0);
}

const srcDir = path.join(rootDir, 'docs', 'diagramas', 'src');
const outDir = path.join(rootDir, 'docs', 'diagramas', 'rendered');
const mermaidConfigPath = path.join(rootDir, 'docs', 'diagramas', 'mermaid.config.json');
const puppeteerConfigPath = path.join(rootDir, 'docs', 'diagramas', 'puppeteer.config.json');

function normalizarSaltosLinea(texto) {
  return texto.replace(/\r\n/g, '\n');
}

function normalizarSvg(texto) {
  const fuentes = [];
  const conMarcadores = normalizarSaltosLinea(texto).replace(/@font-face\s*\{[^{}]*\}/g, (regla) => {
    fuentes.push(regla.trim().replace(/\s+/g, ' '));
    return `\u0000EVAL_FONT_FACE_${fuentes.length - 1}\u0000`;
  });
  const claveFuente = (regla) => ['font-family', 'font-style', 'font-weight']
    .map((propiedad) => regla.match(new RegExp(`${propiedad}:\\s*([^;]+)`))?.[1]?.trim() ?? '')
    .join('|');
  const fuentesOrdenadas = [...fuentes].sort((a, b) =>
    claveFuente(a).localeCompare(claveFuente(b)) || a.localeCompare(b)
  );
  return conMarcadores.replace(/\u0000EVAL_FONT_FACE_(\d+)\u0000/g, (_marcador, indice) => fuentesOrdenadas[Number(indice)]);
}

function rutaRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
      continue;
    }
    files.push(full);
  }
  return files;
}

function getMmdcPath() {
  const binName = process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
  return path.join(rootDir, 'node_modules', '.bin', binName);
}

function runMmdc({ inputPath, outputPath }) {
  return new Promise((resolve, reject) => {
    const mmdcPath = getMmdcPath();

    const isWindows = process.platform === 'win32';

    const env = { ...process.env };
    // Soporte opcional para fijar Chrome/Chromium si el entorno lo requiere.
    // Puppeteer respeta PUPPETEER_EXECUTABLE_PATH.
    if (env.MMDC_CHROMIUM_PATH && !env.PUPPETEER_EXECUTABLE_PATH) {
      env.PUPPETEER_EXECUTABLE_PATH = env.MMDC_CHROMIUM_PATH;
    }

    const includePuppeteerConfig = process.env.DIAGRAMAS_PUPPETEER_CONFIG !== '0';
    const puppeteerArg = includePuppeteerConfig ? ` -p "${puppeteerConfigPath}"` : '';

    const child = isWindows
      ? spawn(`"${mmdcPath}" -i "${inputPath}" -o "${outputPath}" -c "${mermaidConfigPath}"${puppeteerArg}`, {
          cwd: rootDir,
          stdio: 'pipe',
          shell: true,
          env,
          windowsHide: true
        })
      : spawn(
          mmdcPath,
          [
            '-i',
            inputPath,
            '-o',
            outputPath,
            '-c',
            mermaidConfigPath,
            ...(includePuppeteerConfig ? ['-p', puppeteerConfigPath] : [])
          ],
          {
          cwd: rootDir,
          stdio: 'pipe',
          shell: false,
          env
          }
        );

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });

    child.on('error', (err) => {
      reject(
        new Error(
          `[diagramas:render] no se pudo ejecutar mmdc (¿corriste npm install?): ${err.message}`
        )
      );
    });

    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(
        new Error(
          `[diagramas:render] mmdc fallo (exit ${code}) para ${rutaRel(inputPath)}\n${stderr}`.trimEnd()
        )
      );
    });
  });
}

async function renderAll({ mode }) {
  const all = await walkFiles(srcDir);
  const mmdFiles = all.filter((f) => f.toLowerCase().endsWith('.mmd'));
  if (mmdFiles.length === 0) {
    console.error('[diagramas:render] no se encontraron .mmd en docs/diagramas/src');
    process.exit(2);
  }

  let tmpDir = null;
  if (mode === 'check') {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diagramas-render-'));
  }

  try {
    for (const srcPath of mmdFiles) {
      const relFromSrc = path.relative(srcDir, srcPath);
      const relSvg = relFromSrc.replace(/\.mmd$/i, '.svg');

      const expectedOutPath = path.join(outDir, relSvg);
      const actualOutPath = mode === 'check' ? path.join(tmpDir, relSvg) : expectedOutPath;

      await fs.mkdir(path.dirname(actualOutPath), { recursive: true });
      if (mode !== 'check') await fs.mkdir(path.dirname(expectedOutPath), { recursive: true });

      await runMmdc({ inputPath: srcPath, outputPath: actualOutPath });

      if (mode === 'write') {
        const rendered = normalizarSvg(await fs.readFile(actualOutPath, 'utf8'));
        await fs.writeFile(actualOutPath, rendered, 'utf8');
        console.log(`[diagramas:render] escrito: ${rutaRel(expectedOutPath)}`);
        continue;
      }

      // mode === 'check'
      let existing = null;
      try {
        existing = normalizarSvg(await fs.readFile(expectedOutPath, 'utf8'));
      } catch {
        existing = null;
      }
      const rendered = normalizarSvg(await fs.readFile(actualOutPath, 'utf8'));

      if (existing !== rendered) {
        console.error(`[diagramas:render] desactualizado: ${rutaRel(expectedOutPath)}`);
        console.error('[diagramas:render] corre: npm run diagramas:render');
        process.exitCode = 1;
      }
    }
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

await renderAll({ mode: shouldWrite ? 'write' : 'check' });

if (shouldCheck && process.exitCode !== 1) {
  console.log('[diagramas:render] ok');
}
