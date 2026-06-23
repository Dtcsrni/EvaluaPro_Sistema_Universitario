/**
 * modeloTemaBanco
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const TemaBanco = buildCompatModel('temaBanco', {});
