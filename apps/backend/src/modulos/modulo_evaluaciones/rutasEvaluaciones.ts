import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  actualizarMapeoAlumnosCursoController,
  desconectarOauthClassroomController,
  ejecutarPullClassroom,
  ejecutarImportacionClassroom,
  iniciarOauthClassroom,
  listarActividadesClassroomController,
  listarCursosClassroomController,
  listarHistorialSyncClassroomController,
  listarMapeosClassroom,
  mapearClassroomEvidencia
  ,
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
  esquemaCrearPolitica
} from './validacionesEvaluaciones';
import {
  esquemaActualizarMapeoAlumnosCurso,
  esquemaEjecutarImportacionClassroom,
  esquemaMapearClassroom,
  esquemaPreviewImportacionClassroom,
  esquemaPullClassroom
} from '../modulo_integraciones_classroom/validacionesClassroom';

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
router.post('/v2/classroom/oauth/desconectar', requerirPermiso('classroom:conectar'), desconectarOauthClassroomController);
router.get('/v2/classroom/cursos', requerirPermiso('classroom:pull'), listarCursosClassroomController);
router.get('/v2/classroom/cursos/:courseId/actividades', requerirPermiso('classroom:pull'), listarActividadesClassroomController);
router.get('/v2/classroom/cursos/:courseId/alumnos', requerirPermiso('classroom:pull'), obtenerAlumnosCursoClassroomController);
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
router.post(
  '/v2/classroom/mapeos',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaMapearClassroom, { strict: true }),
  mapearClassroomEvidencia
);
router.post(
  '/v2/classroom/pull',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaPullClassroom, { strict: true }),
  ejecutarPullClassroom
);

export default router;
