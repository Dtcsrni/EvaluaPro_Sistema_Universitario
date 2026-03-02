import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  ejecutarPullClassroom,
  iniciarOauthClassroom,
  listarMapeosClassroom,
  mapearClassroomEvidencia
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
import { esquemaMapearClassroom, esquemaPullClassroom } from '../modulo_integraciones_classroom/validacionesClassroom';

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
router.get('/v2/classroom/oauth/iniciar', requerirPermiso('classroom:conectar'), iniciarOauthClassroom);
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
