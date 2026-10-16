/**
 * Punto de entrada del backend docente.
 * Inicializa configuracion, base de datos y servidor HTTP.
 */
import { crearApp } from './app.js';
import { configuracion } from './configuracion.js';
import { conectarSqlite } from './infraestructura/baseDatos/sqlite.js';
import { logError, log } from './infraestructura/logging/logger.js';
import { seedAdminDocente } from './modulos/modulo_autenticacion/composition.js';
import { ErrorOmrCvNoDisponible, ejecutarSmokeTestOmrCv, recuperarIngestasPdfOmrInterrumpidas } from './modulos/modulo_escaneo_omr/composition.js';

import { iniciarSchedulerCobranzaAutomatica } from './modulos/modulo_comercial_core/composition.js';
import { iniciarSchedulerRetencionExamenes } from './modulos/modulo_generacion_pdf/composition.js';
import { recuperarJobsImportacionClassroom } from './modulos/modulo_integraciones_classroom/composition.js';

async function iniciar() {
  await conectarSqlite();
  const jobsClassroomRecuperados = await recuperarJobsImportacionClassroom();
  if (jobsClassroomRecuperados > 0) {
    log('warn', 'Se reanudan importaciones Classroom pendientes', { cantidad: jobsClassroomRecuperados });
  }
  const ingestasRecuperadas = await recuperarIngestasPdfOmrInterrumpidas();
  if (ingestasRecuperadas > 0) {
    log('warn', 'Se recuperaron ingestas OMR interrumpidas', { cantidad: ingestasRecuperadas });
  }
  await seedAdminDocente();
  
  const smokeCv = await ejecutarSmokeTestOmrCv();
  if (smokeCv.enabled && !smokeCv.cvDisponible) {
    throw new ErrorOmrCvNoDisponible(
      `OMR CV smoke test falló y el servidor no puede iniciar sin backend CV: ${smokeCv.motivo ?? 'causa desconocida'}`
    );
  }

  log('info', 'OMR CV smoke test ejecutado', {
    backend: smokeCv.backend,
    enabled: smokeCv.enabled,
    cvDisponible: smokeCv.cvDisponible,
    motivo: smokeCv.motivo
  });

  const app = crearApp();
  iniciarSchedulerCobranzaAutomatica();
  iniciarSchedulerRetencionExamenes();
  app.listen(configuracion.puerto, () => {
    log('ok', 'API docente escuchando', { puerto: configuracion.puerto });
  });
}

iniciar().catch((error) => {
  logError('Error al iniciar el servidor', error);
  process.exit(1);
});
