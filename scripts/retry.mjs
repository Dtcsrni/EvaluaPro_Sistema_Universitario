#!/usr/bin/env node
/*
 * Ejecuta un comando con reintentos.
 *
 * Motivacion:
 * - En Windows, algunos runners (p. ej. Vitest con workers/forks) pueden fallar de forma
 *   intermitente por condiciones del entorno (terminal, IO, locks temporales).
 * - Este wrapper NO oculta fallos reales: si falla de forma consistente, termina en error.
 *
 * Uso:
 * - node scripts/retry.mjs --attempts 3 --delay-ms 750 --name frontend --command "npm --prefix apps/frontend run test -- --pool=forks --reporter=verbose"
 * - node scripts/retry.mjs --attempts 3 --delay-ms 750 --name backend -- npm --prefix apps/backend run test
 * - node scripts/retry.mjs --attempts 5 --delay-ms 1000 --fallback-command "..." --command "..."
 */

import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const out = {
    attempts: 3,
    delayMs: 750,
    name: 'command',
    cwd: undefined,
    command: undefined,
    fallbackCommand: undefined,
    commandArgs: []
  };

  const rest = [];
  let sawDoubleDash = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      sawDoubleDash = true;
      rest.push(...argv.slice(i + 1));
      break;
    }

    if (arg === '--attempts') {
      out.attempts = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--delay-ms') {
      out.delayMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--name') {
      out.name = String(argv[i + 1] ?? 'command');
      i += 1;
      continue;
    }

    if (arg === '--cwd') {
      out.cwd = String(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--command') {
      out.command = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }

    if (arg === '--fallback-command') {
      out.fallbackCommand = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }

    // Compat: si el usuario pasa args sin flags, los tratamos como comando.
    if (!sawDoubleDash) rest.push(arg);
  }

  if (!out.command && rest.length > 0) {
    // Interpreta `rest` como tokens de comando y los ejecuta via shell.
    // Ojo: el quoting perfecto cross-platform es dificil; preferimos `--command`.
    out.command = rest.map(quoteForShell).join(' ');
  }

  return out;
}

function quoteForShell(value) {
  const s = String(value);
  if (s.length === 0) return '""';

  // Caso comun: sin espacios ni comillas, no requiere quoting.
  if (!/[\s"]/u.test(s)) return s;

  // Windows/cmd y *nix: usamos comillas dobles y escapamos comillas internas.
  // Para nuestros usos (npm/vitest), suele ser suficiente.
  return `"${s.replaceAll('"', '\\"')}"`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(baseDelayMs, attempt) {
  // Backoff simple (lineal) + jitter, para evitar colisiones de locks/IO.
  const base = Math.max(0, Number(baseDelayMs) || 0);
  const multiplier = Math.max(1, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return base * multiplier + jitter;
}

async function runOnce({ command, name, attempt, attempts, cwd }) {
  return new Promise((resolve) => {
    const label = `[retry:${name}]`;
    // eslint-disable-next-line no-console
    console.log(`${label} intento ${attempt}/${attempts}: ${command}`);

    const child = spawn(command, {
      stdio: 'inherit',
      shell: true,
      cwd
    });

    child.on('close', (code, signal) => {
      if (signal) {
        // eslint-disable-next-line no-console
        console.log(`${label} terminado por señal: ${signal}`);
        resolve({ code: 128, signal });
        return;
      }
      resolve({ code: typeof code === 'number' ? code : 1 });
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!Number.isFinite(opts.attempts) || opts.attempts < 1) {
    // eslint-disable-next-line no-console
    console.error('scripts/retry.mjs: --attempts debe ser >= 1');
    process.exit(2);
  }

  if (!Number.isFinite(opts.delayMs) || opts.delayMs < 0) {
    // eslint-disable-next-line no-console
    console.error('scripts/retry.mjs: --delay-ms debe ser >= 0');
    process.exit(2);
  }

  if (!opts.command || String(opts.command).trim().length === 0) {
    // eslint-disable-next-line no-console
    console.error('scripts/retry.mjs: falta comando. Usa --command "..." o agrega args despues de --');
    process.exit(2);
  }

  const primaryCommand = String(opts.command);
  const fallbackCommand = opts.fallbackCommand && String(opts.fallbackCommand).trim().length > 0 ? String(opts.fallbackCommand) : undefined;

  for (let attempt = 1; attempt <= opts.attempts; attempt += 1) {
    const useFallback = Boolean(fallbackCommand && attempt > 1);
    const command = useFallback ? fallbackCommand : primaryCommand;

    const { code } = await runOnce({
      command,
      name: opts.name,
      attempt,
      attempts: opts.attempts,
      cwd: opts.cwd
    });

    if (code === 0) {
      // eslint-disable-next-line no-console
      console.log(`[retry:${opts.name}] ok`);
      process.exit(0);
    }

    if (attempt < opts.attempts) {
      const waitMs = backoffDelayMs(opts.delayMs, attempt);
      // eslint-disable-next-line no-console
      console.warn(
        `[retry:${opts.name}] fallo (code=${code}); reintentando en ${waitMs}ms...${useFallback ? ' (fallback activo)' : ''}`
      );
      await sleep(waitMs);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[retry:${opts.name}] fallo final (code=${code})`);
      process.exit(code || 1);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[retry] error inesperado:', err);
  process.exit(1);
});
