/**
 * Conexion a MongoDB con Mongoose.
 *
 * Decisiones:
 * - Si no hay URI configurada, no se conecta (permite correr ciertas pruebas
 *   o comandos sin Mongo local/externo).
 * - `strictQuery` ayuda a evitar queries con campos no esperados.
 * - En caso de error, se loguea y se aborta el arranque (fail-fast).
 */
import mongoose from 'mongoose';
import { configuracion } from '../../configuracion';
import { log, logError } from '../logging/logger';

export async function conectarBaseDatos(): Promise<void> {
  if (!configuracion.mongoUri) {
    log('warn', 'MONGODB_URI no esta definido; se omite la conexion a MongoDB');
    return;
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(configuracion.mongoUri);
    log('ok', 'Conexion a MongoDB exitosa');
  } catch (error) {
    logError('Fallo la conexion a MongoDB', error);
    throw error;
  }
}
