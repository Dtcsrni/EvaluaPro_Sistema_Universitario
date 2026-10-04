import type { Response } from 'express';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { esquemaListarImportacionesReactivos, esquemaListarReactivos } from './validacionesBancoPreguntas.js';
import { esquemaReactivosBatchJson, parsearArchivoReactivos, validarReactivosBatch } from './reactivosContrato.js';
import { crearPlantillaXlsxReactivos, parsearXlsxReactivos } from './reactivosXlsx.js';
import {
  confirmarReactivos,
  listarReactivos,
  marcarReactivoParaRevision,
  obtenerReactivo,
  obtenerCalibracionReactivo,
  obtenerImportacionReactivos,
  listarVersionesReactivo,
  previsualizarReactivos,
  publicarReactivo,
  listarImportacionesReactivos,
  retirarReactivo
} from './servicioReactivos.js';
import { registrarCalibracionReactivo } from './servicioCalibracionReactivos.js';

export async function listarReactivosControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarReactivos.safeParse(req.query);
  if (!filtros.success) {
    throw new ErrorAplicacion('QUERY_INVALIDA', 'Los filtros de reactivos no cumplen el contrato', 400, filtros.error.flatten());
  }
  res.json(await listarReactivos({ docenteId, ...filtros.data }));
}

export async function obtenerReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await obtenerReactivo(docenteId, String(req.params.reactivoId ?? '').trim()));
}

async function cargaDesdeRequest(req: SolicitudDocente) {
  if (req.file) {
    const batch = req.file.originalname.toLowerCase().endsWith('.xlsx')
      ? await parsearXlsxReactivos(req.file.buffer)
      : parsearArchivoReactivos(req.file.buffer, req.file.originalname);
    return { batch };
  }

  const cuerpo = req.body as Record<string, unknown>;
  const candidato = typeof cuerpo?.payload === 'string'
    ? JSON.parse(cuerpo.payload)
    : (cuerpo?.payload && typeof cuerpo.payload === 'object' ? cuerpo.payload : cuerpo);
  const batch = validarReactivosBatch(candidato);
  return { batch };
}

export function obtenerEsquemaReactivos(req: SolicitudDocente, res: Response) {
  const version = String(req.query?.version ?? '1').trim();
  if (version !== '1') {
    throw new ErrorAplicacion('REACTIVOS_SCHEMA_NO_SOPORTADO', `No existe el contrato de reactivos v${version}`, 404);
  }
  res.json(esquemaReactivosBatchJson);
}

export async function descargarPlantillaXlsxReactivos(_req: SolicitudDocente, res: Response) {
  const contenido = await crearPlantillaXlsxReactivos();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-reactivos-v1.xlsx"');
  res.setHeader('Content-Length', contenido.length);
  res.send(contenido);
}

export async function previsualizarImportacionReactivos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  let carga: Awaited<ReturnType<typeof cargaDesdeRequest>>;
  try {
    carga = await cargaDesdeRequest(req);
  } catch (error) {
    if (error instanceof SyntaxError) throw new ErrorAplicacion('REACTIVOS_JSON_INVALIDO', 'El payload JSON no es válido', 400);
    throw error;
  }
  const resultado = await previsualizarReactivos({ docenteId, batch: carga.batch });
  res.json({
    importId: resultado.importId,
    inputSha256: resultado.inputSha256,
    planHash: resultado.planHash,
    estado: resultado.estado,
    summary: resultado.summary,
    payload: carga.batch,
    rows: resultado.plan.rows.map((row) => ({
      line: row.linea,
      externalKey: row.externalKey,
      operation: row.operation,
      status: row.status,
      reactivoId: row.reactivoId,
      contentHash: row.contentHash,
      detail: row.detalle,
      resolvedPeriod: { id: resultado.target.periodo.id, name: resultado.target.periodo.nombre },
      resolvedTopics: resultado.target.temas
    }))
  });
}

export async function confirmarImportacionReactivos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { planHash: string; payload: unknown };
  const resultado = await confirmarReactivos({
    docenteId,
    importId: String(req.params.importId ?? '').trim(),
    planHash: String(body?.planHash ?? '').trim(),
    batch: body?.payload === undefined ? undefined : validarReactivosBatch(body.payload)
  });
  res.json(resultado);
}

export async function obtenerImportacionReactivosControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await obtenerImportacionReactivos(docenteId, String(req.params.importId ?? '').trim()));
}

export async function listarImportacionesReactivosControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarImportacionesReactivos.safeParse(req.query);
  if (!filtros.success) {
    throw new ErrorAplicacion('QUERY_INVALIDA', 'Los filtros de importaciones no cumplen el contrato', 400, filtros.error.flatten());
  }
  res.json(await listarImportacionesReactivos(docenteId, filtros.data.limite, filtros.data.cursor));
}

export async function publicarReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await publicarReactivo(docenteId, String(req.params.reactivoId ?? '').trim()));
}

export async function revisarReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await marcarReactivoParaRevision(docenteId, String(req.params.reactivoId ?? '').trim()));
}

export async function retirarReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await retirarReactivo(docenteId, String(req.params.reactivoId ?? '').trim()));
}

export async function listarVersionesReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await listarVersionesReactivo(docenteId, String(req.params.reactivoId ?? '').trim()));
}

export async function obtenerCalibracionReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await obtenerCalibracionReactivo(docenteId, String(req.params.reactivoId ?? '').trim()));
}

export async function registrarCalibracionReactivoControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as {
    reactivoVersionId: string;
    cohorteKey: string;
    calificacionIds: string[];
  };
  const resultado = await registrarCalibracionReactivo({
    docenteId,
    reactivoId: String(req.params.reactivoId ?? '').trim(),
    reactivoVersionId: body.reactivoVersionId,
    cohorteKey: body.cohorteKey,
    calificacionIds: body.calificacionIds
  });
  res.status(201).json(resultado);
}
