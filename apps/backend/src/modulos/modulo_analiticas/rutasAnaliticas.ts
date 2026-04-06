/**
 * Rutas de analiticas y banderas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  crearBandera,
  exportarCsv,
  exportarCsvCalificaciones,
  exportarXlsxCalificaciones,
  exportarListaAcademicaCsv,
  exportarListaAcademicaDocx,
  exportarListaAcademicaFirma,
  listarBanderas,
  registrarEventosUso
} from './controladorAnaliticas';
import { esquemaCrearBandera, esquemaExportarCsv } from './validacionesAnaliticas';
import { esquemaRegistrarEventosUso } from './validacionesEventosUso';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

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

export default router;
