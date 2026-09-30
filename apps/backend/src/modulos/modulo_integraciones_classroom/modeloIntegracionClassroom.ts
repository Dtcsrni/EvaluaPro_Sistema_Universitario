/**
 * modeloIntegracionClassroom
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const IntegracionClassroom = buildCompatModel('integracionClassroom', {
  jsonFields: ['metadata'],
  columns: ['id', 'docenteId', 'googleSub', 'accessToken', 'refreshToken', 'tokenExpiraEn', 'activo', 'metadata', 'createdAt', 'updatedAt']
});
