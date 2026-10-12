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
import { rutasAutenticacion, requerirDocente } from './modulos/modulo_autenticacion/composition.js';
import { rutasAlumnos, rutasPeriodos } from './modulos/modulo_alumnos/composition.js';
import { rutasBancoPreguntas } from './modulos/modulo_banco_preguntas/composition.js';
import { rutasGeneracionPdf } from './modulos/modulo_generacion_pdf/composition.js';
import { rutasVinculacionEntrega } from './modulos/modulo_vinculacion_entrega/composition.js';
import { rutasEscaneoOmr } from './modulos/modulo_escaneo_omr/composition.js';
import { rutasCalificaciones } from './modulos/modulo_calificacion/composition.js';
import { rutasAnaliticas } from './modulos/modulo_analiticas/composition.js';
import { rutasSincronizacionNube, requerirLeaseEscritura } from './modulos/modulo_sincronizacion_nube/composition.js';
import { rutasAdminDocentes } from './modulos/modulo_admin_docentes/composition.js';
import { rutasPapelera } from './modulos/modulo_papelera/composition.js';
import { rutasEvaluaciones, rutasEvaluacionesPublicas } from './modulos/modulo_evaluaciones/composition.js';
import { rutasEvaluacionesClassroom, rutasIntegracionesClassroomPublicas, rutasIntegracionesClassroom } from './modulos/modulo_integraciones_classroom/composition.js';
import { rutasCompliance } from './modulos/modulo_compliance/composition.js';
import { rutasComercial } from './modulos/modulo_comercial/composition.js';
import { rutasAdminNegocio, rutasComercialPublico } from './modulos/modulo_comercial_core/composition.js';
import { rutasRecuperacionExamenes } from './modulos/modulo_recuperacion_examenes/composition.js';
import { rutasAsistencias } from './modulos/modulo_asistencias/composition.js';
import { rutasTemarios } from './modulos/modulo_temarios/composition.js';
import { rutasHidratacionCursos } from './modulos/modulo_hidratacion_cursos/composition.js';
import { rutasListasInstitucionales } from './modulos/modulo_listas_institucionales/composition.js';
import { exportarMetricasPrometheus } from './compartido/observabilidad/metrics.js';
import { obtenerPreflight } from './compartido/preflight/controladorPreflight.js';

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
  router.get('/preflight', requerirDocente, obtenerPreflight);

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
  router.use('/evaluaciones', rutasEvaluacionesClassroom);
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
