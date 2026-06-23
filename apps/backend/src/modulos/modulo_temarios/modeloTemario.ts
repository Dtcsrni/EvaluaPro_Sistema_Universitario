/**
 * modeloTemario
 *
 * Responsabilidad: Definición de modelos compatibles con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Temario = buildCompatModel('temario', {
  columns: [
    'id',
    'periodoId',
    'nombre',
    'textoOriginal',
    'totalNodos',
    'porcentajeAvance',
    'createdAt',
    'updatedAt'
  ]
});

export const TemaNode = buildCompatModel('temarioNodo', {
  columns: [
    'id',
    'temarioId',
    'numero',
    'nivel',
    'titulo',
    'estado',
    'sesionAsistenciaId',
    'notas',
    'cubiertaEn',
    'createdAt',
    'updatedAt'
  ]
});
