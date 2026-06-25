/**
 * modeloAsistencia
 *
 * Responsabilidad: Definiciones de modelos compatibles con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const SesionAsistencia = buildCompatModel('asistenciaSesion', {});
export const RegistroAsistencia = buildCompatModel('asistenciaRegistro', {});
export const ReglaAsistencia = buildCompatModel('asistenciaRegla', {});
export const ExcepcionAsistencia = buildCompatModel('asistenciaExcepcion', {});
