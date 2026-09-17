/**
 * Modelo de banco de preguntas compatible con Prisma.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const BancoPregunta = buildCompatModel('bancoPregunta', {
  jsonFields: ['recoverySource'],
  defaultInclude: {
    versiones: {
      include: {
        opciones: true
      }
    }
  }
});
