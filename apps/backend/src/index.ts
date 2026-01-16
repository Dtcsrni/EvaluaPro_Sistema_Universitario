/**
 * Punto de entrada del backend docente.
 * Inicializa configuracion, base de datos y servidor HTTP.
 */
import { crearApp } from './app';
import { configuracion } from './configuracion';
import { conectarBaseDatos } from './infraestructura/baseDatos/mongoose';
import { logError, log } from './infraestructura/logging/logger';
import { seedAdminDocente } from './modulos/modulo_autenticacion/seedAdmin';

async function iniciar() {
  await conectarBaseDatos();
  await seedAdminDocente();

  const app = crearApp();
  app.listen(configuracion.puerto, () => {
    log('ok', 'API docente escuchando', { puerto: configuracion.puerto });
  });
}

iniciar().catch((error) => {
  logError('Error al iniciar el servidor', error);
  process.exit(1);
});
