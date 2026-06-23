#!/usr/bin/env node
/**
 * ai-session-start
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-session-start
 *
 * Responsabilidad: imprimir los recordatorios repo-locales que deben aparecer
 * al iniciar o reanudar una sesion Codex en este workspace.
 * Limites: no modifica estado; solo emite texto explicito para Caveman y Serena.
 */

const lines = [
  'SESSION START REMINDER',
  '',
  '1. Caveman: responder breve, directo y sin relleno. Desactivar solo con stop caveman o normal mode.',
  '2. Serena: activar el proyecto actual antes de leer o editar codigo.',
  '3. Politica de tokens: acotar consultas con relative_path, preferir simbolos y mantener max_answer_chars bajo.'
];

for (const line of lines) {
  process.stdout.write(`${line}\n`);
}