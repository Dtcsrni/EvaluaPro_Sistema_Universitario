#!/usr/bin/env node
/**
 * ai-session-start
 *
 * Responsabilidad: imprimir los recordatorios repo-locales que deben aparecer
 * al iniciar o reanudar una sesion Codex en este workspace.
 * Limites: no modifica estado; solo emite texto explicito para Caveman y Serena.
 */

const lines = [
  'SESSION: Caveman=conciso; Serena=activar antes de codigo; handoff=JSON compacto, sin secretos.'
];

for (const line of lines) {
  process.stdout.write(`${line}\n`);
}
