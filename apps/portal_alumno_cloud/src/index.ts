/**
 * Punto de entrada del portal alumno cloud.
 */
import { crearApp } from './app.js';
import { configuracion } from './configuracion.js';
import { conectarSqlite } from './infraestructura/baseDatos/sqlite.js';
import { log, logError } from './infraestructura/logging/logger.js';

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
