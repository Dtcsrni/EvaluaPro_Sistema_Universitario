/**
 * modeloAlumno
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Alumno = buildCompatModel('alumno', {});
