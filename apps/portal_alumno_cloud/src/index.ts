/**
 * Punto de entrada del portal alumno cloud.
 */
import { crearApp } from './app';
import { configuracion } from './configuracion';
import { conectarSqlite } from './infraestructura/baseDatos/sqlite';
import { log, logError } from './infraestructura/logging/logger';

async function iniciar() {
  await conectarSqlite();
  const app = crearApp();

  app.listen(configuracion.puerto, () => {
    log('ok', 'Portal alumno escuchando', { puerto: configuracion.puerto });
  });
}

iniciar().catch((error) => {
  logError('Error al iniciar portal alumno', error);
  process.exit(1);
});
