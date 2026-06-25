#!/usr/bin/env node
/**
 * install-git-hooks
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { execSync } from 'node:child_process';

execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
process.stdout.write('[git-hooks] core.hooksPath configurado a .githooks\n');
