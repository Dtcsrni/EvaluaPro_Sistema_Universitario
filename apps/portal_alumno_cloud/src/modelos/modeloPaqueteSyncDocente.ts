/**
 * Paquetes de sincronizacion asincrona entre equipos (docente).
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const PaqueteSyncDocente = buildCompatModel('paqueteSyncDocente', {
  jsonFields: ['conteos']
});
