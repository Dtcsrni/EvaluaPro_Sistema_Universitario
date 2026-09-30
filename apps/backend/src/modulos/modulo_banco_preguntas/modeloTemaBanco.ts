/**
 * modeloTemaBanco
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const TemaBanco = buildCompatModel('temaBanco', {});
