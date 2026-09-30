/**
 * modeloSesionDocente
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const SesionDocente = buildCompatModel('sesionDocente', {});
