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
import rutasSalud, { obtenerVersionInfo } from './compartido/salud/rutasSalud.js';
import rutasAutenticacion from './modulos/modulo_autenticacion/rutasAutenticacion.js';
import { requerirDocente } from './modulos/modulo_autenticacion/middlewareAutenticacion.js';
import rutasAlumnos from './modulos/modulo_alumnos/rutasAlumnos.js';
import rutasPeriodos from './modulos/modulo_alumnos/rutasPeriodos.js';
import rutasBancoPreguntas from './modulos/modulo_banco_preguntas/rutasBancoPreguntas.js';
import rutasGeneracionPdf from './modulos/modulo_generacion_pdf/rutasGeneracionPdf.js';
import rutasVinculacionEntrega from './modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega.js';
import rutasEscaneoOmr from './modulos/modulo_escaneo_omr/rutasEscaneoOmr.js';
import rutasCalificaciones from './modulos/modulo_calificacion/rutasCalificaciones.js';
import rutasAnaliticas from './modulos/modulo_analiticas/rutasAnaliticas.js';
import rutasSincronizacionNube from './modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.js';
import rutasAdminDocentes from './modulos/modulo_admin_docentes/rutasAdminDocentes.js';
import rutasPapelera from './modulos/modulo_papelera/rutasPapelera.js';
import rutasEvaluaciones from './modulos/modulo_evaluaciones/rutasEvaluaciones.js';
import rutasEvaluacionesPublicas from './modulos/modulo_evaluaciones/rutasEvaluacionesPublicas.js';
import rutasIntegracionesClassroomPublicas from './modulos/modulo_integraciones_classroom/rutasIntegracionesClassroomPublicas.js';
import rutasIntegracionesClassroom from './modulos/modulo_integraciones_classroom/rutasIntegracionesClassroom.js';
import rutasCompliance from './modulos/modulo_compliance/rutasCompliance.js';
import rutasComercial from './modulos/modulo_comercial/rutasComercial.js';
import rutasAdminNegocio from './modulos/modulo_comercial_core/rutasAdminNegocio.js';
import rutasComercialPublico from './modulos/modulo_comercial_core/rutasComercialPublico.js';
import rutasRecuperacionExamenes from './modulos/modulo_recuperacion_examenes/rutasRecuperacionExamenes.js';
import rutasAsistencias from './modulos/modulo_asistencias/rutasAsistencias.js';
import rutasTemarios from './modulos/modulo_temarios/rutasTemarios.js';
import rutasHidratacionCursos from './modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.js';
import rutasListasInstitucionales from './modulos/modulo_listas_institucionales/rutasListasInstitucionales.js';
import { exportarMetricasPrometheus } from './compartido/observabilidad/metrics.js';
import { requerirLeaseEscritura } from './modulos/modulo_sincronizacion_nube/middlewareLeaseSincronizacion.js';

export function crearRouterApi() {
  const router = Router();

  // Endpoints sin autenticacion (usados por health checks y login).
  router.use('/salud', rutasSalud);
  router.get('/version', (_req, res) => {
    const info = obtenerVersionInfo();
    res.json({
      name: info.app.name,
      version: info.app.version,
      displayVersion: info.app.displayVersion,
      omr: info.omr,
      build: {
        commit: String(process.env.GITHUB_SHA || '').trim() || 'local',
        generatedAt: info.system.generatedAt
      }
    });
  });
  router.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(exportarMetricasPrometheus());
  });
  router.use('/autenticacion', rutasAutenticacion);
  router.use('/integraciones/classroom', rutasIntegracionesClassroomPublicas);
  router.use('/comercial-publico', rutasComercialPublico);
  router.use('/evaluaciones-publicas', rutasEvaluacionesPublicas);

  // A partir de aqui: todas las rutas requieren sesion de docente.
  router.use(requerirDocente);
  // Si se configura OneDrive, toda escritura requiere el lease del equipo.
  router.use(requerirLeaseEscritura);
  router.use('/alumnos', rutasAlumnos);
  router.use('/periodos', rutasPeriodos);
  router.use('/banco-preguntas', rutasBancoPreguntas);
  router.use('/examenes', rutasGeneracionPdf);
  router.use('/entregas', rutasVinculacionEntrega);
  router.use('/omr', rutasEscaneoOmr);
  router.use('/calificaciones', rutasCalificaciones);
  router.use('/analiticas', rutasAnaliticas);
  router.use('/sincronizaciones', rutasSincronizacionNube);
  router.use('/evaluaciones', rutasEvaluaciones);
  router.use('/integraciones/classroom', rutasIntegracionesClassroom);
  router.use('/compliance', rutasCompliance);
  router.use('/comercial', rutasComercial);
  router.use('/admin-negocio', rutasAdminNegocio);
  router.use('/recuperacion', rutasRecuperacionExamenes);
  router.use('/asistencias', rutasAsistencias);
  router.use('/temarios', rutasTemarios);
  router.use('/hidratacion-cursos', rutasHidratacionCursos);
  router.use('/listas-institucionales', rutasListasInstitucionales);
  router.use('/papelera', rutasPapelera);
  router.use('/admin', rutasAdminDocentes);

  return router;
}
