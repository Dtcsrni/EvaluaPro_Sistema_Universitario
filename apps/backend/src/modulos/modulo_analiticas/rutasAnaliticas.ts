/**
 * Rutas de analiticas y banderas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import {
  crearBandera,
  exportarCsv,
  exportarCsvCalificaciones,
  exportarXlsxCalificaciones,
  exportarListaAcademicaCsv,
  exportarListaAcademicaDocx,
  exportarListaAcademicaFirma,
  consultarListaAcademica,
  guardarCalificacionesManualesParcial2,
  actualizarFaltanteManualParcial2,
  listarBanderas,
  registrarEventosUso
} from './controladorAnaliticas.js';
import { esquemaCrearBandera, esquemaExportarCsv, esquemaGuardarCalificacionesManualesParcial2, esquemaActualizarFaltanteManualParcial2 } from './validacionesAnaliticas.js';
import { esquemaRegistrarEventosUso } from './validacionesEventosUso.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

router.get('/banderas', requerirPermiso('analiticas:leer'), listarBanderas);
router.post('/banderas', requerirPermiso('analiticas:leer'), validarCuerpo(esquemaCrearBandera, { strict: true }), crearBandera);
router.post('/eventos-uso', requerirPermiso('analiticas:leer'), validarCuerpo(esquemaRegistrarEventosUso, { strict: true }), registrarEventosUso);
router.post('/exportar-csv', requerirPermiso('analiticas:leer'), validarCuerpo(esquemaExportarCsv, { strict: true }), exportarCsv);
router.get('/calificaciones-csv', requerirPermiso('analiticas:leer'), exportarCsvCalificaciones);
router.get('/calificaciones-xlsx', requerirPermiso('analiticas:leer'), exportarXlsxCalificaciones);
router.get('/lista-academica-csv', requerirPermiso('analiticas:leer'), exportarListaAcademicaCsv);
router.get('/lista-academica-docx', requerirPermiso('analiticas:leer'), exportarListaAcademicaDocx);
router.get('/lista-academica-firma', requerirPermiso('analiticas:leer'), exportarListaAcademicaFirma);
router.get('/lista-academica', requerirPermiso('analiticas:leer'), consultarListaAcademica);
router.put('/lista-academica/:alumnoId/parcial2', requerirPermiso('evaluaciones:gestionar'), validarCuerpo(esquemaGuardarCalificacionesManualesParcial2, { strict: true }), guardarCalificacionesManualesParcial2);
router.put('/lista-academica/:alumnoId/parcial2/faltantes', requerirPermiso('evaluaciones:gestionar'), validarCuerpo(esquemaActualizarFaltanteManualParcial2, { strict: true }), actualizarFaltanteManualParcial2);

export default router;
