import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = {
    yes: false,
    keepVolumes: false,
    keepPdfs: false,
    keepLogs: false,
    keepBuildArtifacts: false,
  };

  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--keep-volumes') args.keepVolumes = true;
    else if (arg === '--keep-pdfs') args.keepPdfs = true;
    else if (arg === '--keep-logs') args.keepLogs = true;
    else if (arg === '--keep-build') args.keepBuildArtifacts = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`\nUso: node scripts/reset-local.mjs [opciones]\n\nLimpia datos locales de desarrollo (Mongo en Docker, PDFs generados, logs y artefactos de build).\n\nOpciones:\n  -y, --yes            No pedir confirmación (DESTRUCTIVO)\n  --keep-volumes       No borrar volúmenes Docker (mantiene la BD)\n  --keep-pdfs          No borrar apps/backend/data/examenes\n  --keep-logs          No borrar logs/\n  --keep-build         No borrar dist/ ni tsbuildinfo\n  -h, --help           Mostrar ayuda\n`);
}

async function confirmOrExit(args) {
  if (args.yes) return;

  if (!process.stdin.isTTY) {
    throw new Error('Sin TTY. Usa --yes para ejecutar en modo no interactivo.');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    // eslint-disable-next-line no-console
    console.log('\nEsto va a eliminar datos LOCALES de desarrollo (destructivo).');
    // eslint-disable-next-line no-console
    console.log('- Docker: docker compose down -v (borra volumen mongo-data)');
    // eslint-disable-next-line no-console
    console.log('- PDFs: apps/backend/data/examenes/*');
    // eslint-disable-next-line no-console
    console.log('- Logs: logs/*');
    // eslint-disable-next-line no-console
    console.log('- Build: apps/frontend/dist, apps/frontend/tsconfig.tsbuildinfo');

    const answer = await rl.question("\nEscribe 'RESET' para continuar: ");
    if (answer.trim() !== 'RESET') {
      // eslint-disable-next-line no-console
      console.log('Cancelado.');
      process.exit(0);
    }
  } finally {
    rl.close();
  }
}

function runDockerComposeDown({ removeVolumes }) {
  const dockerCheck = spawnSync('docker', ['--version'], { stdio: 'ignore' });
  if (dockerCheck.status !== 0) {
    // eslint-disable-next-line no-console
    console.warn('Docker no está disponible. Se omite la limpieza de la base de datos.');
    return;
  }

  const args = ['compose', 'down', '--remove-orphans'];
  if (removeVolumes) args.push('-v');

  // eslint-disable-next-line no-console
  console.log(`Ejecutando: docker ${args.join(' ')}`);

  const result = spawnSync('docker', args, {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`docker compose down falló (exit ${result.status}).`);
  }
}

async function safeRemoveAllChildren(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        await fs.rm(fullPath, { recursive: true, force: true });
      }),
    );
    return entries.length;
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return 0;
    throw error;
  }
}

async function safeRemovePath(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const repoRoot = path.resolve(scriptDir, '..');
  process.chdir(repoRoot);

  await confirmOrExit(args);

  if (!args.keepVolumes) {
    runDockerComposeDown({ removeVolumes: true });
  } else {
    runDockerComposeDown({ removeVolumes: false });
  }

  let removedPdfs = 0;
  if (!args.keepPdfs) {
    const pdfDir = path.join(repoRoot, 'apps', 'backend', 'data', 'examenes');
    removedPdfs = await safeRemoveAllChildren(pdfDir);
  }

  let removedLogs = 0;
  if (!args.keepLogs) {
    const logsDir = path.join(repoRoot, 'logs');
    removedLogs = await safeRemoveAllChildren(logsDir);
  }

  let removedBuild = 0;
  if (!args.keepBuildArtifacts) {
    const distPath = path.join(repoRoot, 'apps', 'frontend', 'dist');
    const tsbuildinfoPath = path.join(repoRoot, 'apps', 'frontend', 'tsconfig.tsbuildinfo');

    if (await safeRemovePath(distPath)) removedBuild += 1;
    if (await safeRemovePath(tsbuildinfoPath)) removedBuild += 1;
  }

  // eslint-disable-next-line no-console
  console.log('\nReset local completado.');
  // eslint-disable-next-line no-console
  console.log(`- PDFs eliminados: ${removedPdfs}`);
  // eslint-disable-next-line no-console
  console.log(`- Entradas en logs eliminadas: ${removedLogs}`);
  // eslint-disable-next-line no-console
  console.log(`- Artefactos de build eliminados: ${removedBuild}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
