/**
 * rutasEvaluaciones
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { esquemaBodyVacioOpcional } from '../modulo_alumnos/validacionesPeriodos';
import {
  actualizarMapeoAlumnosCursoController,
  importarAlumnosClassroomController,
  desconectarOauthClassroomController,
  ejecutarImportacionClassroom,
  iniciarOauthClassroom,
  listarActividadesClassroomController,
  listarCursosClassroomController,
  listarHistorialSyncClassroomController,
  listarMapeosClassroom,
  obtenerAlumnosCursoClassroomController,
  obtenerEstadoClassroomController,
  previewImportacionClassroom
} from '../modulo_integraciones_classroom/controladorIntegracionesClassroom';
import {
  crearEvidenciaEvaluacion,
  crearPoliticaCalificacion,
  guardarComponenteExamenV2,
  guardarConfiguracionPeriodo,
  guardarEvidenciaEvaluacionesV2,
  guardarPoliticaEvaluacionesV2,
  listarEvidenciasEvaluacion,
  listarPoliticasCalificacion,
  obtenerContextoEvaluacionesV2,
  obtenerConfiguracionPeriodo,
  obtenerResumenEvaluacionAlumno,
  obtenerResumenEvaluacionesV2,
  upsertComponenteExamen
} from './controladorEvaluaciones';
import {
  esquemaComponenteExamen,
  esquemaConfigurarPeriodo,
  esquemaCrearEvidencia,
  esquemaCrearPolitica,
  esquemaInicializarEncuadre
} from './validacionesEvaluaciones';
import {
  esquemaActualizarMapeoAlumnosCurso,
  esquemaImportarAlumnosClassroom,
  esquemaEjecutarImportacionClassroom,
  esquemaPreviewImportacionClassroom
} from '../modulo_integraciones_classroom/validacionesClassroom';
import {
  inicializarEncuadre,
  obtenerEstadoEncuadre
} from './controladorEncuadre';

const router = Router();

router.get('/politicas', requerirPermiso('evaluaciones:leer'), listarPoliticasCalificacion);
router.post(
  '/politicas',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearPolitica, { strict: true }),
  crearPoliticaCalificacion
);
router.get('/configuracion-periodo', requerirPermiso('evaluaciones:leer'), obtenerConfiguracionPeriodo);
router.post(
  '/configuracion-periodo',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaConfigurarPeriodo, { strict: true }),
  guardarConfiguracionPeriodo
);
router.get('/evidencias', requerirPermiso('evaluaciones:leer'), listarEvidenciasEvaluacion);
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
router.get('/v2/classroom/estado', requerirPermiso('classroom:pull'), obtenerEstadoClassroomController);
router.get('/v2/classroom/oauth/iniciar', requerirPermiso('classroom:conectar'), iniciarOauthClassroom);
router.post(
  '/v2/classroom/oauth/desconectar',
  requerirPermiso('classroom:conectar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  desconectarOauthClassroomController
);
router.get('/v2/classroom/cursos', requerirPermiso('classroom:pull'), listarCursosClassroomController);
router.get('/v2/classroom/cursos/:courseId/actividades', requerirPermiso('classroom:pull'), listarActividadesClassroomController);
router.get('/v2/classroom/cursos/:courseId/alumnos', requerirPermiso('classroom:pull'), obtenerAlumnosCursoClassroomController);
router.post(
  '/v2/classroom/cursos/:courseId/importar-alumnos',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaImportarAlumnosClassroom, { strict: true }),
  importarAlumnosClassroomController
);
router.put(
  '/v2/classroom/cursos/:courseId/mapeo-alumnos',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaActualizarMapeoAlumnosCurso, { strict: true }),
  actualizarMapeoAlumnosCursoController
);
router.get('/v2/classroom/importaciones/historial', requerirPermiso('classroom:pull'), listarHistorialSyncClassroomController);
router.post(
  '/v2/classroom/importaciones/preview',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaPreviewImportacionClassroom, { strict: true }),
  previewImportacionClassroom
);
router.post(
  '/v2/classroom/importaciones/ejecutar',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaEjecutarImportacionClassroom, { strict: true }),
  ejecutarImportacionClassroom
);
router.get('/v2/classroom/mapeos', requerirPermiso('classroom:pull'), listarMapeosClassroom);

// --- Encuadre Académico CUH ---
router.post(
  '/encuadre/inicializar',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaInicializarEncuadre, { strict: true }),
  inicializarEncuadre
);
router.get('/encuadre/estado/:periodoId', requerirPermiso('evaluaciones:leer'), obtenerEstadoEncuadre);

export default router;
