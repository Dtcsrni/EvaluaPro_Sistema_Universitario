/**
 * Rutas Classroom montadas bajo /evaluaciones/v2/classroom por el composition root.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { esquemaBodyVacioOpcional } from '../../compartido/validaciones/esquemasComunes.js';
import { requerirPermiso } from '../modulo_autenticacion/index.js';
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
} from '../modulo_integraciones_classroom/controladorIntegracionesClassroom.js';
import {
  esquemaActualizarMapeoAlumnosCurso,
  esquemaImportarAlumnosClassroom,
  esquemaEjecutarImportacionClassroom,
  esquemaPreviewImportacionClassroom
} from '../modulo_integraciones_classroom/validacionesClassroom.js';

const router = Router();

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

export default router;
