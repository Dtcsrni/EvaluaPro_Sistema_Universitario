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
import rutasSalud, { obtenerVersionInfo } from './compartido/salud/rutasSalud';
import rutasAutenticacion from './modulos/modulo_autenticacion/rutasAutenticacion';
import { requerirDocente } from './modulos/modulo_autenticacion/middlewareAutenticacion';
import rutasAlumnos from './modulos/modulo_alumnos/rutasAlumnos';
import rutasPeriodos from './modulos/modulo_alumnos/rutasPeriodos';
import rutasBancoPreguntas from './modulos/modulo_banco_preguntas/rutasBancoPreguntas';
import rutasGeneracionPdf from './modulos/modulo_generacion_pdf/rutasGeneracionPdf';
import rutasVinculacionEntrega from './modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega';
import rutasEscaneoOmr from './modulos/modulo_escaneo_omr/rutasEscaneoOmr';
import rutasOmrV1 from './modulos/modulo_omr_v1/rutasOmrV1';
import rutasAssessmentsV1 from './modulos/modulo_omr_v1/rutasAssessmentsV1';
import rutasCalificaciones from './modulos/modulo_calificacion/rutasCalificaciones';
import rutasAnaliticas from './modulos/modulo_analiticas/rutasAnaliticas';
import rutasSincronizacionNube from './modulos/modulo_sincronizacion_nube/rutasSincronizacionNube';
import rutasAdminDocentes from './modulos/modulo_admin_docentes/rutasAdminDocentes';
import rutasPapelera from './modulos/modulo_papelera/rutasPapelera';
import rutasEvaluaciones from './modulos/modulo_evaluaciones/rutasEvaluaciones';
import rutasEvaluacionesPublicas from './modulos/modulo_evaluaciones/rutasEvaluacionesPublicas';
import rutasIntegracionesClassroomPublicas from './modulos/modulo_integraciones_classroom/rutasIntegracionesClassroomPublicas';
import rutasIntegracionesClassroom from './modulos/modulo_integraciones_classroom/rutasIntegracionesClassroom';
import rutasCompliance from './modulos/modulo_compliance/rutasCompliance';
import rutasComercial from './modulos/modulo_comercial/rutasComercial';
import rutasAdminNegocio from './modulos/modulo_comercial_core/rutasAdminNegocio';
import rutasComercialPublico from './modulos/modulo_comercial_core/rutasComercialPublico';
import rutasRecuperacionExamenes from './modulos/modulo_recuperacion_examenes/rutasRecuperacionExamenes';
import rutasAsistencias from './modulos/modulo_asistencias/rutasAsistencias';
import rutasTemarios from './modulos/modulo_temarios/rutasTemarios';
import rutasHidratacionCursos from './modulos/modulo_hidratacion_cursos/rutasHidratacionCursos';
import rutasListasInstitucionales from './modulos/modulo_listas_institucionales/rutasListasInstitucionales';
import { exportarMetricasPrometheus } from './compartido/observabilidad/metrics';

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
  router.use('/alumnos', rutasAlumnos);
  router.use('/periodos', rutasPeriodos);
  router.use('/banco-preguntas', rutasBancoPreguntas);
  router.use('/examenes', rutasGeneracionPdf);
  router.use('/assessments', rutasAssessmentsV1);
  router.use('/entregas', rutasVinculacionEntrega);
  router.use('/omr', rutasEscaneoOmr);
  router.use('/omr', rutasOmrV1);
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
