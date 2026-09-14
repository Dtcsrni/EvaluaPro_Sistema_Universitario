#!/usr/bin/env node
/**
 * Runner ESM estable para auditorías OMR TypeScript.
 *
 * Compila únicamente el grafo requerido por omr-visual-qa.ts en un directorio
 * temporal y lo ejecuta con Node nativo. Esto evita que la QA dependa del
 * directorio temporal interno de tsx, que puede fallar en Windows cuando
 * uv_os_get_passwd devuelve ENOMEM.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(backendDirectory, '..', '..');
const typescriptEntrypoint = path.join(repositoryDirectory, 'node_modules', 'typescript', 'bin', 'tsc');

function resolverEntrada(argv) {
  const argumentos = [...argv];
  const indice = argumentos.indexOf('--script');
  if (indice === -1) {
    return {
      sourceScript: path.join(scriptDirectory, 'omr-visual-qa.ts'),
      runtimeArguments: argumentos
    };
  }
  const relativePath = argumentos[indice + 1];
  if (!relativePath || relativePath.startsWith('-')) {
    throw new Error('Uso: --script <ruta-relativa-al-backend> [argumentos]');
  }
  argumentos.splice(indice, 2);
  return {
    sourceScript: path.resolve(backendDirectory, relativePath),
    runtimeArguments: argumentos
  };
}

function ejecutar(programa, argumentos, entorno = process.env) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(process.execPath, [programa, ...argumentos], {
      cwd: backendDirectory,
      stdio: 'inherit',
      windowsHide: true,
      env: entorno
    });
    proceso.on('error', reject);
    proceso.on('close', (codigo, señal) => resolve({ codigo: codigo ?? 1, señal }));
  });
}

async function main() {
  const entrada = resolverEntrada(process.argv.slice(2));
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-visual-'));
  const outputDirectory = path.join(temporaryDirectory, 'dist');
  const configPath = path.join(temporaryDirectory, 'tsconfig.json');
  const dependencyLink = path.join(temporaryDirectory, 'node_modules');

  try {
    await fs.symlink(path.join(repositoryDirectory, 'node_modules'), dependencyLink, 'junction');
    await fs.writeFile(configPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        rootDir: backendDirectory,
        outDir: outputDirectory,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        sourceMap: false,
        declaration: false,
        noEmitOnError: true
      },
      files: [
        entrada.sourceScript,
        path.join(backendDirectory, 'src', 'compartido', 'tipos', 'jsqr.d.ts')
      ]
    }, null, 2));

    const compilación = await ejecutar(typescriptEntrypoint, ['--project', configPath, '--pretty', 'false']);
    if (compilación.codigo !== 0) {
      process.exitCode = compilación.codigo;
      return;
    }

    const relativeCompiledScript = path.relative(backendDirectory, entrada.sourceScript).replace(/\.tsx?$/i, '.js');
    const compiledScript = path.join(outputDirectory, relativeCompiledScript);
    const ejecución = await ejecutar(compiledScript, entrada.runtimeArguments, {
      ...process.env,
      NODE_ENV: 'test'
    });
    process.exitCode = ejecución.codigo;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[omr-visual-qa] ERROR: ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
