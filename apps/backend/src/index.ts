/**
 * Punto de entrada del backend docente.
 * Inicializa configuracion, base de datos y servidor HTTP.
 */
import { crearApp } from './app';
import { configuracion } from './configuracion';
import { conectarSqlite } from './infraestructura/baseDatos/sqlite';
/**
 * Punto de entrada del backend docente.
 * Inicializa configuracion, base de datos y servidor HTTP.
 */
import { crearApp } from './app';
import { configuracion } from './configuracion';
import { conectarSqlite } from './infraestructura/baseDatos/sqlite';
import { logError, log } from './infraestructura/logging/logger';
import { seedAdminDocente } from './modulos/modulo_autenticacion/seedAdmin';
import { ErrorOmrCvNoDisponible, ejecutarSmokeTestOmrCv } from './modulos/modulo_escaneo_omr/infra/omrCvEngine';

import { seedFamiliasOmrV1 } from './modulos/modulo_omr_v1/seedOmrV1';
import { iniciarSchedulerCobranzaAutomatica } from './modulos/modulo_comercial_core/schedulerCobranza';
import { iniciarSchedulerRetencionExamenes } from './modulos/modulo_generacion_pdf/schedulerRetencionExamenes';

async function iniciar() {
  await conectarSqlite();
  await seedAdminDocente();
  
  // await seedFamiliasOmrV1();
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
