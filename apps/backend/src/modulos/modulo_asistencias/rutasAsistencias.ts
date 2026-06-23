/**
 * Rutas del módulo de asistencias.
 *
 * Prefijo montado en: /asistencias
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  crearSesion,
  listarSesiones,
  eliminarSesion,
  guardarRegistros,
  obtenerRegistrosSesion,
  obtenerResumen,
  verificarDerechoExamen,
  crearOActualizarRegla,
  listarReglas,
  eliminarRegla,
  crearExcepcion,
  eliminarExcepcion,
  listarExcepciones
} from './controladorAsistencias';
import {
  esquemaCrearSesion,
  esquemaGuardarRegistros,
  esquemaCrearRegla,
  esquemaCrearExcepcion
} from './validacionesAsistencias';

const router = Router();

// ─── Sesiones ─────────────────────────────────────────────────────────────────
router.get('/sesiones', requerirPermiso('asistencias:leer'), listarSesiones);
router.post(
  '/sesiones',
  requerirPermiso('asistencias:gestionar'),
  validarCuerpo(esquemaCrearSesion, { strict: true }),
  crearSesion
);
router.post(
  '/sesiones/:sesionId/eliminar',
  requerirPermiso('asistencias:gestionar'),
  eliminarSesion
);

// ─── Registros (pase de lista) ────────────────────────────────────────────────
router.get(
  '/sesiones/:sesionId/registros',
  requerirPermiso('asistencias:leer'),
  obtenerRegistrosSesion
);
router.post(
  '/sesiones/:sesionId/registros',
  requerirPermiso('asistencias:gestionar'),
  validarCuerpo(esquemaGuardarRegistros, { strict: true }),
  guardarRegistros
);

// ─── Resumen global ───────────────────────────────────────────────────────────
router.get('/resumen', requerirPermiso('asistencias:leer'), obtenerResumen);

// ─── Derecho a examen ─────────────────────────────────────────────────────────
router.get(
  '/derecho-examen/:alumnoId',
  requerirPermiso('asistencias:leer'),
  verificarDerechoExamen
);

// ─── Reglas ───────────────────────────────────────────────────────────────────
router.get('/reglas', requerirPermiso('asistencias:leer'), listarReglas);
router.post(
  '/reglas',
  requerirPermiso('asistencias:gestionar'),
  validarCuerpo(esquemaCrearRegla, { strict: true }),
  crearOActualizarRegla
);
router.post('/reglas/:reglaId/eliminar', requerirPermiso('asistencias:gestionar'), eliminarRegla);

// ─── Excepciones ─────────────────────────────────────────────────────────────
router.get('/excepciones', requerirPermiso('asistencias:leer'), listarExcepciones);
router.post(
  '/excepciones',
  requerirPermiso('asistencias:gestionar'),
  validarCuerpo(esquemaCrearExcepcion, { strict: true }),
  crearExcepcion
);
router.post(
  '/excepciones/:excepcionId/eliminar',
  requerirPermiso('asistencias:gestionar'),
  eliminarExcepcion
);

export default router;
