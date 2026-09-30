/**
 * Rutas de escaneo OMR.
 */
import { Router } from 'express';
import multer from 'multer';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { analizarImagen, prevalidarLoteCapturas } from './controladorEscaneoOmr.js';
import { crearJobOmr, finalizarJobOmr, listarJobsOmr, obtenerJobOmr, resolverHojaOmr } from './controladorJobsOmr.js';
import { crearIngestaPdfOmr, descargarManifiestoIngestaPdfOmr, descargarOriginalIngestaPdfOmr, descargarPaqueteIngestaPdfOmr, obtenerIngestaPdfOmr, prevalidarReferenciaIngestaPdfOmr, previsualizarPaginaIngestaPdfOmr, previsualizarReferenciaIngestaPdfOmr, recuperarIngestaPdfOmrPorClave, resolverPaginaIngestaPdfOmr, reintentarIngestaPdfOmr } from './controladorIngestaPdfOmr.js';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { esquemaAnalizarOmr, esquemaCrearIngestaPdfOmr, esquemaCrearJobOmr, esquemaPrevalidarLoteOmr, esquemaPrevalidarReferenciaIngestaOmr, esquemaResolverJobOmr, esquemaResolverPaginaIngestaOmr, esquemaReintentarIngestaOmr } from './validacionesOmr.js';
import { esquemaBodyVacioOpcional } from '../modulo_generacion_pdf/validacionesExamenes.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import { MAX_JOB_BYTES, MAX_PDF_BYTES } from './limitesIngestaPdfOmr.js';

const router = Router();
// Un campo puede contener hasta 100 IDs de 200 caracteres UTF-8 más el JSON
// envolvente; 82 KiB cubren el máximo del contrato sin ampliar el límite de PDF.
const MAX_ASSESSMENT_IDS_FIELD_BYTES = 82 * 1024;

export function crearCargadorArchivosPdfOmr(maxJobBytes = MAX_JOB_BYTES, tempRoot = os.tmpdir()) {
  const bytesPorSolicitud = new WeakMap<import('express').Request, number>();
  const almacenamiento: multer.StorageEngine = {
    _handleFile(req, file, callback) {
      void (async () => {
        const directory = await fs.mkdtemp(path.join(tempRoot, 'evaluapro-omr-upload-'));
        const filename = `${randomUUID()}.pdf`;
        const filePath = path.join(directory, filename);
        let size = 0;
        const limiteTotal = new Transform({
          transform(chunk: Buffer, _encoding, done) {
            const nextSize = (bytesPorSolicitud.get(req) ?? 0) + chunk.length;
            if (nextSize > maxJobBytes) {
              done(new ErrorAplicacion('OMR_PDF_TAMANO_INVALIDO', 'El ingreso admite hasta 250 MiB en total por job', 413));
              return;
            }
            bytesPorSolicitud.set(req, nextSize);
            size += chunk.length;
            done(null, chunk);
          }
        });

        try {
          await pipeline(file.stream, limiteTotal, createWriteStream(filePath, { flags: 'wx' }));
          callback(null, { destination: directory, filename, path: filePath, size });
        } catch (error) {
          await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
          callback(error as Error);
        }
      })().catch((error: unknown) => callback(error as Error));
    },
    _removeFile(_req, file, callback) {
      void fs.rm(path.dirname(file.path), { recursive: true, force: true }).then(() => callback(null), callback);
    }
  };
  const cargaPdfOmr = multer({
    storage: almacenamiento,
    limits: { files: 11, fileSize: MAX_PDF_BYTES, fields: 2, fieldSize: MAX_ASSESSMENT_IDS_FIELD_BYTES },
    fileFilter: (_req, file, callback) => {
      const filenameIsPdf = path.extname(file.originalname).toLowerCase() === '.pdf';
      callback(null, file.mimetype === 'application/pdf' && filenameIsPdf);
    }
  });

  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    cargaPdfOmr.fields([{ name: 'archivos', maxCount: 10 }, { name: 'referencia', maxCount: 1 }])(req, res, (error?: unknown) => {
      if (!error) return next();
      void limpiarCargaTemporal(req).finally(() => {
        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
            next(new ErrorAplicacion('OMR_PDF_CANTIDAD_INVALIDA', 'El ingreso admite hasta 10 archivos PDF por job', 413));
            return;
          }
          if (error.code === 'LIMIT_FILE_SIZE') {
            next(new ErrorAplicacion('OMR_PDF_TAMANO_INVALIDO', 'El ingreso admite hasta 120 MiB por archivo PDF', 413));
            return;
          }
          next(new ErrorAplicacion('OMR_PDF_ENTRADA_INVALIDA', 'La carga multipart de PDF no cumple el formato admitido', 400));
          return;
        }
        next(error);
      });
    });
  };
}

async function limpiarCargaTemporal(req: import('express').Request) {
  const files = normalizarArchivosCargados(req);
  await Promise.all(files.map((file) => fs.rm(path.dirname(file.path), { recursive: true, force: true }).catch(() => undefined)));
}

function normalizarArchivosCargados(req: import('express').Request) {
  if (Array.isArray(req.files)) return req.files;
  if (!req.files || typeof req.files !== 'object') return [];
  return Object.values(req.files).flat();
}

const cargarArchivosPdf = crearCargadorArchivosPdfOmr();

function validarIngestaPdf(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  validarCuerpo(esquemaCrearIngestaPdfOmr, { strict: true })(req, res, (error?: unknown) => {
    if (!error) return next();
    void limpiarCargaTemporal(req).finally(() => next(error));
  });
}

function limpiarCargaSiFalla(err: unknown, req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  void limpiarCargaTemporal(req).finally(() => next(err));
}

router.post('/analizar', requerirPermiso('omr:analizar'), validarCuerpo(esquemaAnalizarOmr, { strict: true }), analizarImagen);
router.post(
  '/ingestas/prevalidar-referencia',
  requerirPermiso('omr:analizar'),
  cargarArchivosPdf,
  limpiarCargaSiFalla,
  validarCuerpo(esquemaPrevalidarReferenciaIngestaOmr, { strict: true }),
  prevalidarReferenciaIngestaPdfOmr
);
router.post('/ingestas', requerirPermiso('omr:analizar'), cargarArchivosPdf, limpiarCargaSiFalla, validarIngestaPdf, crearIngestaPdfOmr);
router.get('/ingestas/por-clave/:clientRequestId', requerirPermiso('omr:analizar'), recuperarIngestaPdfOmrPorClave);
router.post('/ingestas/:jobId/reintentar', requerirPermiso('omr:analizar'), validarCuerpo(esquemaReintentarIngestaOmr, { strict: true }), reintentarIngestaPdfOmr);
router.get('/ingestas/:jobId', requerirPermiso('omr:analizar'), obtenerIngestaPdfOmr);
router.get('/ingestas/:jobId/paginas/:pageIndex/preview', requerirPermiso('omr:analizar'), previsualizarPaginaIngestaPdfOmr);
router.get('/ingestas/:jobId/paginas/:pageIndex/reference-preview', requerirPermiso('omr:analizar'), previsualizarReferenciaIngestaPdfOmr);
router.post('/ingestas/:jobId/paginas/:pageIndex/resolver', requerirPermiso('omr:analizar'), validarCuerpo(esquemaResolverPaginaIngestaOmr, { strict: true }), resolverPaginaIngestaPdfOmr);
router.get('/ingestas/:jobId/originales/:fileId', requerirPermiso('omr:analizar'), descargarOriginalIngestaPdfOmr);
router.get('/ingestas/:jobId/manifiesto', requerirPermiso('omr:analizar'), descargarManifiestoIngestaPdfOmr);
router.get('/ingestas/:jobId/paquetes/:packageId', requerirPermiso('omr:analizar'), descargarPaqueteIngestaPdfOmr);
router.post(
  '/prevalidar-lote',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaPrevalidarLoteOmr, { strict: true }),
  prevalidarLoteCapturas
);
router.post('/jobs', requerirPermiso('omr:analizar'), validarCuerpo(esquemaCrearJobOmr, { strict: true }), crearJobOmr);
router.get('/jobs', requerirPermiso('omr:analizar'), listarJobsOmr);
router.get('/jobs/:jobId', requerirPermiso('omr:analizar'), obtenerJobOmr);
router.post(
  '/jobs/:jobId/exceptions/:sheetSerial/resolve',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaResolverJobOmr, { strict: true }),
  resolverHojaOmr
);
router.post(
  '/jobs/:jobId/finalize',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  finalizarJobOmr
);

export default router;
