/**
 * rutasEvaluaciones
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { validarQueryRobusto } from '../../compartido/robustez/utilitariosControlador.js';
import { requerirPermiso } from '../modulo_autenticacion/index.js';
import {
  crearEvidenciaEvaluacion,
  crearPoliticaCalificacion,
  actualizarEvidenciaEvaluacion,
  archivarEvidenciaEvaluacion,
  guardarComponenteExamenV2,
  guardarConfiguracionPeriodo,
  guardarEvidenciaEvaluacionesV2,
  guardarPoliticaEvaluacionesV2,
  listarEvidenciasEvaluacion,
  listarPoliticasCalificacion,
  listarAuditoriaPoliticaCalificacion,
  obtenerPoliticaCalificacion,
  archivarPoliticaCalificacion,
  obtenerEvidenciaEvaluacion,
  restaurarEvidenciaEvaluacion,
  obtenerContextoEvaluacionesV2,
  obtenerConfiguracionPeriodo,
  obtenerResumenEvaluacionAlumno,
  obtenerResumenEvaluacionesV2,
  upsertComponenteExamen
} from './controladorEvaluaciones.js';
import {
  esquemaComponenteExamen,
  esquemaConfigurarPeriodo,
  esquemaCrearEvidencia,
  esquemaCrearPolitica,
  esquemaActualizarEvidencia,
  esquemaArchivarEvidencia,
  esquemaArchivarPolitica,
  esquemaRestaurarEvidencia,
  esquemaInicializarEncuadre,
  esquemaListarEvidenciasEvaluacion,
  esquemaListarAuditoriaPolitica
} from './validacionesEvaluaciones.js';
import {
  inicializarEncuadre,
  obtenerEstadoEncuadre
} from './controladorEncuadre.js';

const router = Router();

router.get('/politicas', requerirPermiso('evaluaciones:leer'), listarPoliticasCalificacion);
router.get('/politicas/:codigo/auditoria', requerirPermiso('evaluaciones:leer'), validarQueryRobusto(esquemaListarAuditoriaPolitica), listarAuditoriaPoliticaCalificacion);
router.post(
  '/politicas',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearPolitica, { strict: true }),
  crearPoliticaCalificacion
);
router.get('/politicas/:codigo', requerirPermiso('evaluaciones:leer'), obtenerPoliticaCalificacion);
router.put(
  '/politicas/:codigo',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearPolitica, { strict: true }),
  crearPoliticaCalificacion
);
router.delete(
  '/politicas/:codigo',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaArchivarPolitica, { strict: true }),
  archivarPoliticaCalificacion
);
router.post(
  '/politicas/:codigo/archivar',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaArchivarPolitica, { strict: true }),
  archivarPoliticaCalificacion
);
router.get('/configuracion-periodo', requerirPermiso('evaluaciones:leer'), obtenerConfiguracionPeriodo);
router.post(
  '/configuracion-periodo',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaConfigurarPeriodo, { strict: true }),
  guardarConfiguracionPeriodo
);
router.get('/evidencias', requerirPermiso('evaluaciones:leer'), validarQueryRobusto(esquemaListarEvidenciasEvaluacion), listarEvidenciasEvaluacion);
router.get('/evidencias/:evidenciaId', requerirPermiso('evaluaciones:leer'), obtenerEvidenciaEvaluacion);
router.put(
  '/evidencias/:evidenciaId',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaActualizarEvidencia, { strict: true }),
  actualizarEvidenciaEvaluacion
);
router.post(
  '/evidencias/:evidenciaId/archivar',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaArchivarEvidencia, { strict: true }),
  archivarEvidenciaEvaluacion
);
router.post(
  '/evidencias/:evidenciaId/restaurar',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaRestaurarEvidencia, { strict: true }),
  restaurarEvidenciaEvaluacion
);
router.post(
  '/evidencias',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearEvidencia, { strict: true }),
  crearEvidenciaEvaluacion
);
router.post(
  '/examenes/componentes',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaComponenteExamen, { strict: true }),
  upsertComponenteExamen
);
router.get('/alumnos/:alumnoId/resumen', requerirPermiso('evaluaciones:leer'), obtenerResumenEvaluacionAlumno);

router.get('/v2/contexto', requerirPermiso('evaluaciones:leer'), obtenerContextoEvaluacionesV2);
router.post(
  '/v2/politica',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaConfigurarPeriodo, { strict: true }),
  guardarPoliticaEvaluacionesV2
);
router.post(
  '/v2/evidencias',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearEvidencia, { strict: true }),
  guardarEvidenciaEvaluacionesV2
);
router.post(
  '/v2/examenes/componentes',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaComponenteExamen, { strict: true }),
  guardarComponenteExamenV2
);
router.get('/v2/alumnos/:alumnoId/resumen', requerirPermiso('evaluaciones:leer'), obtenerResumenEvaluacionesV2);

// --- Encuadre Académico CUH ---
router.post(
  '/encuadre/inicializar',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaInicializarEncuadre, { strict: true }),
  inicializarEncuadre
);
router.get('/encuadre/estado/:periodoId', requerirPermiso('evaluaciones:leer'), obtenerEstadoEncuadre);

export default router;
