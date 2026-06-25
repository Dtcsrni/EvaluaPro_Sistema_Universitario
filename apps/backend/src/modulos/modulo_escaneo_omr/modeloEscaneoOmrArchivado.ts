/**
 * modeloEscaneoOmrArchivado
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const EscaneoOmrArchivado = buildCompatModel('escaneoOmrArchivado', {
  jsonFields: ['motivosRevision']
});
