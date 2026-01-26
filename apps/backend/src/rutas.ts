/**
 * Registro central de rutas del API docente.
 *
 * Convenciones:
 * - Las rutas publicas se montan antes del middleware de autenticacion.
 * - A partir de `requerirDocente`, todo requiere JWT (Bearer) de docente.
 *
 * Nota: El orden de `router.use(...)` es parte del contrato de seguridad.
 */
import { Router } from 'express';
import rutasSalud from './compartido/salud/rutasSalud';
import rutasAutenticacion from './modulos/modulo_autenticacion/rutasAutenticacion';
import { requerirDocente } from './modulos/modulo_autenticacion/middlewareAutenticacion';
import rutasAlumnos from './modulos/modulo_alumnos/rutasAlumnos';
import rutasPeriodos from './modulos/modulo_alumnos/rutasPeriodos';
import rutasBancoPreguntas from './modulos/modulo_banco_preguntas/rutasBancoPreguntas';
import rutasGeneracionPdf from './modulos/modulo_generacion_pdf/rutasGeneracionPdf';
import rutasVinculacionEntrega from './modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega';
import rutasEscaneoOmr from './modulos/modulo_escaneo_omr/rutasEscaneoOmr';
import rutasCalificaciones from './modulos/modulo_calificacion/rutasCalificaciones';
import rutasAnaliticas from './modulos/modulo_analiticas/rutasAnaliticas';
import rutasSincronizacionNube from './modulos/modulo_sincronizacion_nube/rutasSincronizacionNube';
import rutasAdminDocentes from './modulos/modulo_admin_docentes/rutasAdminDocentes';

export function crearRouterApi() {
  const router = Router();

  // Endpoints sin autenticacion (usados por health checks y login).
  router.use('/salud', rutasSalud);
  router.use('/autenticacion', rutasAutenticacion);

  // A partir de aqui: todas las rutas requieren sesion de docente.
  router.use(requerirDocente);
  router.use('/alumnos', rutasAlumnos);
  router.use('/periodos', rutasPeriodos);
  router.use('/banco-preguntas', rutasBancoPreguntas);
  router.use('/examenes', rutasGeneracionPdf);
  router.use('/entregas', rutasVinculacionEntrega);
  router.use('/omr', rutasEscaneoOmr);
  router.use('/calificaciones', rutasCalificaciones);
  router.use('/analiticas', rutasAnaliticas);
  router.use('/sincronizaciones', rutasSincronizacionNube);
  router.use('/admin', rutasAdminDocentes);

  return router;
}
