import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { normalizarEnunciadoBanco } from './normalizarEnunciadoBanco.js';
import {
  contentHashReactivo,
  planHashReactivos,
  sha256Texto,
  serializarCanonico,
  type ReactivoBatchItem,
  type ReactivosBatch
} from './reactivosContrato.js';

type FilaPlan = {
  linea: number;
  externalKey: string;
  operation: 'create' | 'noOp' | 'newVersion' | 'conflict';
  status: 'valid' | 'conflict';
  reactivoId: string | null;
  contentHash: string;
  legacyContentHash: string;
  expectedVersion: number | null;
  currentVersion: number | null;
  detalle: Record<string, unknown>;
};

type PlanImportacion = {
  schemaVersion: 1;
  batchId: string;
  target: ReactivosBatch['target'];
  rows: FilaPlan[];
};

function normalizarContenido(valor: string): string {
  const fuente = String(valor ?? '').replace(/<!--[^]*?-->|<\s*(?:script|style)[^>]*>[^]*?<\s*\/(?:script|style)\s*>/gi, '');
  return fuente.replace(/<[^>]*>/g, (tag) => {
    if (/^<\s*br\s*\/?\s*>$/i.test(tag)) return '<br>';
    if (/^<\s*(strong|b|em|i|u|sub|sup)\s*>$/i.test(tag)) return tag.toLowerCase();
    if (/^<\s*\/\s*(strong|b|em|i|u|sub|sup)\s*>$/i.test(tag)) return tag.toLowerCase();
    if (/^<\s*span\b/i.test(tag) && /data-latex\s*=\s*["'][^"']*["']/i.test(tag)) return tag.replace(/\s+/g, ' ').trim();
    return '';
  });
}

async function imagenDesdeMetadata(metadataJson: string, docenteId: string): Promise<string | null> {
  try {
    const metadata = JSON.parse(metadataJson || '{}') as { imageDataUrl?: unknown; imageAssetSha256?: unknown };
    if (typeof metadata.imageDataUrl === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(metadata.imageDataUrl)) return metadata.imageDataUrl;
    if (typeof metadata.imageAssetSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(metadata.imageAssetSha256)) return null;
    const asset = await prisma.reactivoAsset.findUnique({ where: { docenteId_sha256: { docenteId, sha256: metadata.imageAssetSha256 } } });
    if (!asset) return null;
    const datos = JSON.parse(asset.metadataJson || '{}') as { dataUrl?: unknown };
    return typeof datos.dataUrl === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(datos.dataUrl) ? datos.dataUrl : null;
  } catch {
    return null;
  }
}

function detalleFila(item: ReactivoBatchItem, operation: FilaPlan['operation'], extra: Record<string, unknown> = {}) {
  return {
    format: item.format,
    itemId: item.itemId,
    expectedVersion: item.expectedVersion,
    metadata: item.metadata,
    provenance: item.provenance,
    temaId: item.temaId,
    ...extra,
    operation
  };
}

async function validarTarget(docenteId: string, target: ReactivosBatch['target']) {
  const periodo = await prisma.periodo.findFirst({
    where: { id: target.periodoId, docenteId, activo: true },
    select: { id: true, nombre: true }
  });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'La materia objetivo no existe o está archivada', 404);

  const temas = await prisma.temaBanco.findMany({
    where: { id: { in: target.temaIds }, docenteId, periodoId: target.periodoId, activo: true },
    select: { id: true, nombre: true }
  });
  if (temas.length !== target.temaIds.length) {
    const encontrados = new Set(temas.map((tema) => tema.id));
    const faltantes = target.temaIds.filter((id) => !encontrados.has(id));
    throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Uno o más temas objetivo no existen o están archivados', 404, { faltantes });
  }
  const nombresPorId = new Map(temas.map((tema) => [tema.id, tema.nombre]));
  return {
    periodo,
    temas: target.temaIds.map((id) => ({ id, nombre: nombresPorId.get(id) ?? id }))
  };
}

async function obtenerActual(docenteId: string, item: ReactivoBatchItem) {
  if (item.itemId) {
    const byId = await prisma.reactivo.findFirst({ where: { id: item.itemId, docenteId }, include: { asignaciones: { select: { temaId: true } } } });
    if (!byId) return { reactivo: null, reason: 'ITEM_NO_ENCONTRADO' as const };
    if (byId.externalKey !== item.externalKey) return { reactivo: byId, reason: 'EXTERNAL_KEY_NO_COINCIDE' as const };
    return { reactivo: byId, reason: null };
  }
  const byKey = await prisma.reactivo.findFirst({ where: { docenteId, externalKey: item.externalKey }, include: { asignaciones: { select: { temaId: true } } } });
  return { reactivo: byKey, reason: null };
}

export async function construirPlanReactivos(params: { docenteId: string; batch: ReactivosBatch }) {
  const target = await validarTarget(params.docenteId, params.batch.target);
  const rows: FilaPlan[] = [];

  for (const [index, item] of params.batch.items.entries()) {
    const temaId = item.temaId ?? params.batch.target.temaIds[0]!;
    const legacyHash = contentHashReactivo(item);
    const hash = contentHashReactivo(item, temaId);
    const actual = await obtenerActual(params.docenteId, item);
    const reactivo = actual.reactivo;
    let operation: FilaPlan['operation'] = 'create';
    let status: FilaPlan['status'] = 'valid';
    let detalle: Record<string, unknown> = {};
    let currentVersion: number | null = reactivo?.versionActual ?? null;

    if (actual.reason) {
      operation = 'conflict';
      status = 'conflict';
      detalle = { codigo: actual.reason };
    } else if (reactivo) {
      const version = await prisma.reactivoVersion.findFirst({
        where: { reactivoId: reactivo.id, numeroVersion: reactivo.versionActual },
        select: { id: true, numeroVersion: true, contentHash: true }
      });
      currentVersion = version?.numeroVersion ?? reactivo.versionActual;
      const temasActuales = (reactivo.asignaciones ?? []).map((asignacion) => asignacion.temaId).sort();
      const temaSinCambio = temasActuales.length === 1 && temasActuales[0] === temaId;
      if ((version?.contentHash === hash || version?.contentHash === legacyHash) && temaSinCambio) {
        operation = 'noOp';
        detalle = { codigo: 'CONTENIDO_SIN_CAMBIOS' };
      } else if (!item.itemId) {
        operation = 'conflict';
        status = 'conflict';
        detalle = { codigo: 'EXTERNAL_KEY_CONFLICT', mensaje: 'El externalKey ya existe con contenido diferente' };
      } else if (item.expectedVersion !== reactivo.versionActual) {
        operation = 'conflict';
        status = 'conflict';
        detalle = { codigo: 'VERSION_CONFLICT', expectedVersion: item.expectedVersion, currentVersion: reactivo.versionActual };
      } else {
        operation = 'newVersion';
        const mismoContenidoConTemaAnterior = temasActuales.length === 1
          && version?.contentHash === contentHashReactivo(item, temasActuales[0]);
        detalle = {
          codigo: (version?.contentHash === legacyHash || mismoContenidoConTemaAnterior) && !temaSinCambio ? 'TEMA_CAMBIO' : 'NUEVA_VERSION',
          nextVersion: reactivo.versionActual + 1
        };
      }
    }

    rows.push({
      linea: index + 1,
      externalKey: item.externalKey,
      operation,
      status,
      reactivoId: reactivo?.id ?? null,
      contentHash: hash,
      legacyContentHash: legacyHash,
      expectedVersion: item.expectedVersion,
      currentVersion,
      detalle: detalleFila({ ...item, temaId }, operation, detalle)
    });
  }

  const plan: PlanImportacion = {
    schemaVersion: 1,
    batchId: params.batch.batchId,
    target: params.batch.target,
    rows
  };
  const planHash = planHashReactivos(plan);
  return {
    plan,
    planHash,
    target,
    summary: {
      create: rows.filter((row) => row.operation === 'create').length,
      noOp: rows.filter((row) => row.operation === 'noOp').length,
      newVersion: rows.filter((row) => row.operation === 'newVersion').length,
      conflict: rows.filter((row) => row.operation === 'conflict').length,
      error: 0
    }
  };
}

export async function previsualizarReactivos(params: { docenteId: string; batch: ReactivosBatch }) {
  const resultado = await construirPlanReactivos({ docenteId: params.docenteId, batch: params.batch });
  const inputSha256 = sha256Texto(serializarCanonico(params.batch));
  return {
    importId: `imp-${sha256Texto(`${params.docenteId}\n${inputSha256}`).slice(0, 32)}`,
    inputSha256,
    planHash: resultado.planHash,
    estado: 'preview',
    plan: resultado.plan,
    target: resultado.target,
    summary: resultado.summary
  };
}

function resumenDesdeFilas(filas: Array<{ operacion: string; estado: string }>) {
  return {
    create: filas.filter((fila) => fila.operacion === 'create').length,
    noOp: filas.filter((fila) => fila.operacion === 'noOp').length,
    newVersion: filas.filter((fila) => fila.operacion === 'newVersion').length,
    conflict: filas.filter((fila) => fila.operacion === 'conflict' || fila.estado === 'conflict').length,
    error: filas.filter((fila) => fila.estado === 'error').length,
    quarantined: filas.filter((fila) => fila.operacion === 'quarantine' || fila.estado === 'quarantined').length
  };
}

export async function registrarCuarentenaReactivos(params: {
  docenteId: string;
  periodoId: string;
  inputSha256: string;
  batchId: string;
  nombreArchivo: string;
  tipoDocumento: string;
  rows: Array<{ linea: number; externalKey: string; detalle: Record<string, unknown> }>;
}) {
  if (!/^[a-f0-9]{64}$/i.test(params.inputSha256)) {
    throw new ErrorAplicacion('HASH_IMPORTACION_INVALIDO', 'El hash del documento no es válido', 400);
  }
  if (params.rows.length === 0) {
    return { importId: null, quarantined: 0, existente: false };
  }

  const buscarExistente = async () => prisma.reactivoImportacion.findUnique({
    where: { docenteId_inputSha256: { docenteId: params.docenteId, inputSha256: params.inputSha256 } },
    include: { filas: true }
  });
  const existente = await buscarExistente();
  if (existente) {
    return {
      importId: existente.id,
      quarantined: existente.filas.filter((fila) => fila.operacion === 'quarantine' || fila.estado === 'quarantined').length,
      existente: true
    };
  }

  const payload = {
    contract: 'evaluapro.reactivos.docx-quarantine',
    schemaVersion: 0,
    batchId: params.batchId,
    target: { periodoId: params.periodoId },
    source: { kind: 'imported', filename: params.nombreArchivo, documentType: params.tipoDocumento, sha256: params.inputSha256 },
    items: params.rows.map((row) => ({ externalKey: row.externalKey, ...row.detalle }))
  };
  const plan = {
    schemaVersion: 0,
    batchId: params.batchId,
    target: payload.target,
    rows: params.rows.map((row) => ({
      linea: row.linea,
      externalKey: row.externalKey,
      operation: 'quarantine',
      status: 'quarantined',
      detalle: row.detalle
    }))
  };
  const planHash = planHashReactivos(plan);
  try {
    const created = await prisma.reactivoImportacion.create({
      data: {
        docenteId: params.docenteId,
        batchId: params.batchId,
        schemaVersion: 0,
        inputSha256: params.inputSha256,
        planHash,
        payloadJson: serializarCanonico(payload),
        planJson: serializarCanonico(plan),
        estado: 'quarantined',
        filas: {
          create: params.rows.map((row) => ({
            linea: row.linea,
            externalKey: row.externalKey,
            operacion: 'quarantine',
            estado: 'quarantined',
            detalleJson: serializarCanonico(row.detalle)
          }))
        }
      },
      include: { filas: true }
    });
    return { importId: created.id, quarantined: created.filas.length, existente: false };
  } catch (error) {
    // La restricción única docente+hash arbitra dos cargas concurrentes del
    // mismo documento; recuperar el ganador vuelve idempotente la segunda.
    const recuperada = await buscarExistente();
    if (recuperada) {
      return {
        importId: recuperada.id,
        quarantined: recuperada.filas.filter((fila) => fila.operacion === 'quarantine' || fila.estado === 'quarantined').length,
        existente: true
      };
    }
    throw error;
  }
}

function parsearObjeto(valor: string | null | undefined): Record<string, unknown> {
  if (!valor) return {};
  try { return JSON.parse(valor) as Record<string, unknown>; } catch { return {}; }
}

export async function confirmarReactivos(params: { docenteId: string; importId: string; planHash: string; batch?: ReactivosBatch }) {
  const previa = await prisma.reactivoImportacion.findFirst({ where: { id: params.importId, docenteId: params.docenteId }, include: { filas: true } });
  if (previa && previa.estado !== 'confirmed') {
    throw new ErrorAplicacion('IMPORTACION_NO_CONFIRMABLE', 'La importación requiere resolución manual y no puede confirmarse como lote canónico', 409, { estado: previa.estado });
  }
  if (!params.batch) throw new ErrorAplicacion('REACTIVOS_PAYLOAD_REQUERIDO', 'Envía el mismo lote validado para volver a calcular y confirmar el plan', 400);
  const batch = params.batch;
  const inputSha256 = sha256Texto(serializarCanonico(batch));
  const importId = `imp-${sha256Texto(`${params.docenteId}\n${inputSha256}`).slice(0, 32)}`;
  if (params.importId !== importId) throw new ErrorAplicacion('IMPORTACION_NO_ENCONTRADA', 'El identificador no corresponde al lote confirmado', 404);

  const existente = previa ?? await prisma.reactivoImportacion.findFirst({ where: { id: importId, docenteId: params.docenteId }, include: { filas: true } });
  if (existente?.estado === 'confirmed') {
    return {
      importId: existente.id,
      estado: existente.estado,
      summary: resumenDesdeFilas(existente.filas),
      reactivoIds: existente.filas.map((fila) => fila.reactivoId).filter(Boolean),
      draftReactivoIds: []
    };
  }

  const { plan, planHash, summary } = await construirPlanReactivos({ docenteId: params.docenteId, batch });
  const conflictos = plan.rows.filter((row) => row.status === 'conflict');
  if (conflictos.length > 0) {
    const codigo = typeof conflictos[0]?.detalle.codigo === 'string' ? conflictos[0].detalle.codigo : 'IMPORTACION_CONFLICTOS';
    throw new ErrorAplicacion(codigo, 'El banco cambió desde el preview y el lote ahora contiene conflictos', 409, { filas: conflictos });
  }
  if (planHash !== params.planHash) throw new ErrorAplicacion('PLAN_HASH_INVALIDO', 'El banco cambió desde el preview; vuelve a validarlo antes de confirmar', 409);

  try {
  const resultado = await prisma.$transaction(async (tx) => {
    const importacion = await tx.reactivoImportacion.create({
      data: {
        id: importId,
        docenteId: params.docenteId,
        batchId: batch.batchId,
        schemaVersion: 1,
        inputSha256,
        planHash,
        payloadJson: serializarCanonico(batch),
        planJson: serializarCanonico(plan),
        estado: 'preview',
        filas: { create: plan.rows.map((row) => ({
          linea: row.linea,
          externalKey: row.externalKey,
          operacion: row.operation,
          estado: row.status,
          contentHash: row.contentHash,
          reactivoId: row.reactivoId,
          detalleJson: serializarCanonico(row.detalle)
        })) }
      },
      include: { filas: true }
    });
    const reactivoIds: string[] = [];
    const draftReactivoIds: string[] = [];
    const periodoVigente = await tx.periodo.findFirst({ where: { id: batch.target.periodoId, docenteId: params.docenteId, activo: true }, select: { id: true } });
    const temasVigentes = await tx.temaBanco.findMany({ where: { id: { in: batch.target.temaIds }, periodoId: batch.target.periodoId, docenteId: params.docenteId, activo: true }, select: { id: true } });
    if (!periodoVigente || temasVigentes.length !== batch.target.temaIds.length) {
      throw new ErrorAplicacion('TARGET_CAMBIO', 'La materia o alguno de sus temas cambió desde el preview', 409);
    }
    for (const [index, item] of batch.items.entries()) {
      const row = plan.rows[index];
      if (row.operation === 'noOp') {
        const actual = row.reactivoId
          ? await tx.reactivo.findFirst({ where: { id: row.reactivoId, docenteId: params.docenteId } })
          : null;
        const version = actual
          ? await tx.reactivoVersion.findFirst({ where: { reactivoId: actual.id, numeroVersion: actual.versionActual }, select: { contentHash: true } })
          : null;
        const asignaciones = actual
          ? await tx.reactivoAsignacion.findMany({ where: { reactivoId: actual.id }, select: { temaId: true } })
          : [];
        const temaEsperado = String(row.detalle.temaId ?? batch.target.temaIds[0] ?? '');
        const asignacionSinCambio = asignaciones.length === 1 && asignaciones[0]?.temaId === temaEsperado;
        if (!actual || (version?.contentHash !== row.contentHash && version?.contentHash !== row.legacyContentHash) || !asignacionSinCambio) {
          throw new ErrorAplicacion('IMPORTACION_CAMBIO', `La fila ${row.linea} dejó de ser no-op después del preview`, 409, { linea: row.linea });
        }
        reactivoIds.push(row.reactivoId!);
        continue;
      }

      let reactivo = row.reactivoId
        ? await tx.reactivo.findFirst({ where: { id: row.reactivoId, docenteId: params.docenteId } })
        : null;
      if (row.operation === 'create') {
        const existente = await tx.reactivo.findFirst({ where: { docenteId: params.docenteId, externalKey: item.externalKey }, select: { id: true } });
        if (existente) throw new ErrorAplicacion('EXTERNAL_KEY_CONFLICT', `El externalKey de la fila ${row.linea} apareció después del preview`, 409, { linea: row.linea });
        reactivo = await tx.reactivo.create({ data: { docenteId: params.docenteId, externalKey: item.externalKey, estado: 'draft', versionActual: 1 } });
      } else if (!reactivo || reactivo.versionActual !== item.expectedVersion) {
        throw new ErrorAplicacion('VERSION_CONFLICT', `La fila ${row.linea} cambió mientras se confirmaba`, 409, { linea: row.linea });
      }

      const numeroVersion = row.operation === 'create' ? 1 : reactivo.versionActual + 1;
      const stem = normalizarEnunciadoBanco(normalizarContenido(item.stem.value));
      const metadataVersion: Record<string, unknown> = { ...item.metadata };
      const imageDataUrl = typeof item.metadata.imageDataUrl === 'string' ? item.metadata.imageDataUrl : null;
      if (imageDataUrl) {
        const [, mediaType, base64] = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i) ?? [];
        if (!mediaType || !base64) throw new ErrorAplicacion('REACTIVO_ASSET_INVALIDO', `La imagen de la fila ${row.linea} no es válida`, 400, { linea: row.linea });
        const sha256 = createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
        await tx.reactivoAsset.upsert({
          where: { docenteId_sha256: { docenteId: params.docenteId, sha256 } },
          create: {
            docenteId: params.docenteId,
            sha256,
            mediaType: mediaType.toLowerCase(),
            metadataJson: serializarCanonico({ dataUrl: imageDataUrl })
          },
          update: { mediaType: mediaType.toLowerCase(), metadataJson: serializarCanonico({ dataUrl: imageDataUrl }) }
        });
        delete metadataVersion.imageDataUrl;
        metadataVersion.imageAssetSha256 = sha256;
      }
      const version = await tx.reactivoVersion.create({
        data: {
          reactivoId: reactivo.id,
          numeroVersion,
          formato: item.format,
          enunciado: stem,
          metadataJson: serializarCanonico(metadataVersion),
          procedenciaJson: serializarCanonico(item.provenance),
          contentHash: row.contentHash,
          opciones: { create: item.options.map((option) => ({ clave: option.key, texto: normalizarContenido(option.value), esCorrecta: option.isCorrect })) }
        }
      });
      void version;
      await tx.reactivoAsignacion.deleteMany({ where: { reactivoId: reactivo.id } });
      const temaId = String(row.detalle.temaId ?? item.temaId ?? batch.target.temaIds[0] ?? '');
      if (!temaId || !batch.target.temaIds.includes(temaId)) {
        throw new ErrorAplicacion('TEMA_REACTIVO_INVALIDO', `La fila ${row.linea} no tiene un tema canónico válido`, 409, { linea: row.linea });
      }
      await tx.reactivoAsignacion.create({ data: { reactivoId: reactivo.id, periodoId: batch.target.periodoId, temaId } });
      await tx.reactivo.update({ where: { id: reactivo.id }, data: { versionActual: numeroVersion, estado: 'draft' } });
      await tx.reactivoImportacionFila.update({ where: { id: importacion.filas[index].id }, data: { reactivoId: reactivo.id, estado: 'applied' } });
      reactivoIds.push(reactivo.id);
      draftReactivoIds.push(reactivo.id);
    }
    await tx.reactivoImportacion.update({ where: { id: importacion.id }, data: { estado: 'confirmed', confirmadoEn: new Date() } });
    return { reactivoIds, draftReactivoIds, filas: importacion.filas };
  });

  return { importId, estado: 'confirmed', summary, reactivoIds: resultado.reactivoIds, draftReactivoIds: resultado.draftReactivoIds };
  } catch (error) {
    // Dos confirmaciones concurrentes del mismo preview compiten por la clave
    // única docente+hash; la segunda devuelve el resultado confirmado ganador.
    const confirmada = await prisma.reactivoImportacion.findFirst({ where: { id: importId, docenteId: params.docenteId }, include: { filas: true } });
    if (confirmada?.estado === 'confirmed' && confirmada.planHash === planHash) {
      return {
        importId,
        estado: confirmada.estado,
        summary: resumenDesdeFilas(confirmada.filas),
        reactivoIds: confirmada.filas.map((fila) => fila.reactivoId).filter(Boolean),
        draftReactivoIds: []
      };
    }
    throw error;
  }
}

export async function obtenerImportacionReactivos(docenteId: string, importId: string) {
  const importacion = await prisma.reactivoImportacion.findFirst({ where: { id: importId, docenteId }, include: { filas: true } });
  if (!importacion) throw new ErrorAplicacion('IMPORTACION_NO_ENCONTRADA', 'Importación no encontrada', 404);
  return {
    importId: importacion.id,
    batchId: importacion.batchId,
    estado: importacion.estado,
    inputSha256: importacion.inputSha256,
    planHash: importacion.planHash,
    summary: resumenDesdeFilas(importacion.filas),
    rows: importacion.filas.map((fila) => ({ ...fila, detalle: parsearObjeto(fila.detalleJson) }))
  };
}

export async function listarImportacionesReactivos(docenteId: string, limite = 30, cursor?: string) {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 100);
  if (cursor) {
    const cursorVisible = await prisma.reactivoImportacion.findFirst({
      where: { id: cursor, docenteId }, select: { id: true }
    });
    if (!cursorVisible) throw new ErrorAplicacion('CURSOR_INVALIDO', 'El cursor de importaciones no existe para este docente.', 400);
  }

  const importacionesLeidas = await prisma.reactivoImportacion.findMany({
    where: { docenteId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limiteSeguro + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });
  const haySiguiente = importacionesLeidas.length > limiteSeguro;
  const importaciones = importacionesLeidas.slice(0, limiteSeguro);
  const importacionIds = importaciones.map((item) => item.id);
  const filasAgrupadas = importacionIds.length === 0 ? [] : await prisma.reactivoImportacionFila.groupBy({
    by: ['importacionId', 'operacion', 'estado'],
    where: { importacionId: { in: importacionIds } },
    _count: { _all: true }
  });
  const resumenes = new Map(importacionIds.map((id) => [id, {
    create: 0, noOp: 0, newVersion: 0, conflict: 0, error: 0, quarantined: 0
  }]));
  for (const grupo of filasAgrupadas) {
    const resumen = resumenes.get(grupo.importacionId);
    if (!resumen) continue;
    const total = grupo._count._all;
    if (grupo.operacion === 'create') resumen.create += total;
    if (grupo.operacion === 'noOp') resumen.noOp += total;
    if (grupo.operacion === 'newVersion') resumen.newVersion += total;
    if (grupo.operacion === 'conflict' || grupo.estado === 'conflict') resumen.conflict += total;
    if (grupo.estado === 'error') resumen.error += total;
    if (grupo.operacion === 'quarantine' || grupo.estado === 'quarantined') resumen.quarantined += total;
  }
  return {
    nextCursor: haySiguiente && importaciones.length > 0 ? importaciones[importaciones.length - 1]!.id : null,
    importaciones: importaciones.map((importacion) => {
      const payload = parsearObjeto(importacion.payloadJson);
      const target = parsearObjeto(JSON.stringify(payload.target ?? {}));
      return {
        importId: importacion.id,
        batchId: importacion.batchId,
        periodoId: typeof target.periodoId === 'string' ? target.periodoId : null,
        estado: importacion.estado,
        inputSha256: importacion.inputSha256,
        createdAt: importacion.createdAt,
        confirmadoEn: importacion.confirmadoEn,
        summary: resumenes.get(importacion.id)
      };
    })
  };
}

function presentarVersionReactivo(version: {
  id: string;
  numeroVersion: number;
  formato: string;
  enunciado: string;
  metadataJson: string;
  procedenciaJson: string;
  contentHash: string;
  createdAt: Date;
  opciones: Array<{ id: string; clave: string; texto: string; esCorrecta: boolean }>;
}) {
  return {
    id: version.id,
    numeroVersion: version.numeroVersion,
    formato: version.formato,
    enunciado: version.enunciado,
    metadata: parsearObjeto(version.metadataJson),
    procedencia: parsearObjeto(version.procedenciaJson),
    contentHash: version.contentHash,
    createdAt: version.createdAt,
    opciones: version.opciones
      .slice()
      .sort((a, b) => a.clave.localeCompare(b.clave))
      .map(({ id, clave, texto, esCorrecta }) => ({ id, clave, texto, esCorrecta }))
  };
}

function codificarCursorReactivo(cursor: { id: string; updatedAt: Date }): string {
  return Buffer.from(JSON.stringify({ id: cursor.id, updatedAt: cursor.updatedAt.toISOString() }), 'utf8').toString('base64url');
}

function decodificarCursorReactivo(token: string): { id: string; updatedAt: Date } {
  try {
    const contenido = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { id?: unknown; updatedAt?: unknown };
    const id = typeof contenido.id === 'string' ? contenido.id : '';
    const updatedAt = typeof contenido.updatedAt === 'string' ? new Date(contenido.updatedAt) : new Date(NaN);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !Number.isFinite(updatedAt.getTime())) {
      throw new Error('invalid cursor');
    }
    return { id, updatedAt };
  } catch {
    throw new ErrorAplicacion('REACTIVO_CURSOR_INVALIDO', 'El cursor de reactivos no es válido', 400);
  }
}

export async function listarReactivos(params: {
  docenteId: string;
  periodoId?: string;
  temaId?: string;
  estado?: 'draft' | 'review' | 'published' | 'retired';
  limite?: number;
  cursor?: string;
}) {
  const limite = Math.min(Math.max(Math.trunc(params.limite ?? 30), 1), 100);
  const where: Prisma.ReactivoWhereInput = { docenteId: params.docenteId };
  if (params.estado) where.estado = params.estado;
  if (params.periodoId || params.temaId) {
    where.asignaciones = {
      some: {
        ...(params.periodoId ? { periodoId: params.periodoId } : {}),
        ...(params.temaId ? { temaId: params.temaId } : {})
      }
    };
  }
  if (params.cursor) {
    const cursor = decodificarCursorReactivo(params.cursor);
    where.AND = [{
      OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { gt: cursor.id } }
      ]
    }];
  }

  const filas = await prisma.reactivo.findMany({
    where,
    select: {
      id: true,
      externalKey: true,
      estado: true,
      versionActual: true,
      legacyPreguntaId: true,
      archivadoEn: true,
      createdAt: true,
      updatedAt: true,
      asignaciones: { select: { periodoId: true, temaId: true } }
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: limite + 1
  });
  const hayMas = filas.length > limite;
  const pagina = filas.slice(0, limite);
  const versiones = pagina.length
    ? await prisma.reactivoVersion.findMany({
      where: { OR: pagina.map(({ id, versionActual }) => ({ reactivoId: id, numeroVersion: versionActual })) },
      include: { opciones: true }
    })
    : [];
  const versionPorReactivo = new Map(versiones.map((version) => [version.reactivoId, version]));

  return {
    reactivos: pagina.map((reactivo) => {
      const version = versionPorReactivo.get(reactivo.id);
      return {
        ...reactivo,
        version: version ? presentarVersionReactivo(version) : null,
        asignaciones: reactivo.asignaciones
      };
    }),
    nextCursor: hayMas && pagina.length
      ? codificarCursorReactivo({ id: pagina[pagina.length - 1]!.id, updatedAt: pagina[pagina.length - 1]!.updatedAt })
      : null
  };
}

export async function obtenerReactivo(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({
    where: { id: reactivoId, docenteId },
    select: {
      id: true,
      externalKey: true,
      estado: true,
      versionActual: true,
      legacyPreguntaId: true,
      archivadoEn: true,
      createdAt: true,
      updatedAt: true,
      asignaciones: { select: { periodoId: true, temaId: true } }
    }
  });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  const version = await prisma.reactivoVersion.findFirst({
    where: { reactivoId, numeroVersion: reactivo.versionActual },
    include: { opciones: true }
  });
  if (!version) throw new ErrorAplicacion('REACTIVO_SIN_VERSION', 'El reactivo no tiene una versión actual válida', 409);
  const presentada = presentarVersionReactivo(version);
  const imagenDataUrl = await imagenDesdeMetadata(version.metadataJson, docenteId);
  return {
    reactivo: {
      ...reactivo,
      version: presentada,
      ...(imagenDataUrl ? { imagenDataUrl } : {}),
      asignaciones: reactivo.asignaciones
    }
  };
}

export async function publicarReactivo(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({ where: { id: reactivoId, docenteId } });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  if (reactivo.estado === 'draft') throw new ErrorAplicacion('REACTIVO_NO_REVISADO', 'El reactivo debe pasar por revisión antes de publicarse', 409);
  if (reactivo.estado === 'retired') throw new ErrorAplicacion('REACTIVO_RETIRADO', 'Un reactivo retirado no puede publicarse', 409);
  if (reactivo.estado === 'published') {
    if (!reactivo.legacyPreguntaId) {
      throw new ErrorAplicacion('REACTIVO_PUBLICADO_INCONSISTENTE', 'El reactivo publicado no tiene una referencia legada recuperable', 409);
    }
    const legado = await prisma.bancoPregunta.findFirst({
      where: { id: reactivo.legacyPreguntaId, docenteId },
      select: { id: true, activo: true }
    });
    if (!legado?.activo) {
      throw new ErrorAplicacion('REACTIVO_PUBLICADO_INCONSISTENTE', 'La representación publicada del reactivo no está disponible', 409);
    }
    return { reactivo, legacyPreguntaId: legado.id };
  }
  const version = await prisma.reactivoVersion.findFirst({ where: { reactivoId, numeroVersion: reactivo.versionActual }, include: { opciones: true } });
  if (!version) throw new ErrorAplicacion('REACTIVO_SIN_VERSION', 'El reactivo no tiene una versión válida', 409);
  const asignacion = await prisma.reactivoAsignacion.findFirst({ where: { reactivoId } });
  if (!asignacion) throw new ErrorAplicacion('REACTIVO_SIN_ASIGNACION', 'El reactivo no tiene materia y tema asignados', 409);
  const tema = await prisma.temaBanco.findFirst({ where: { id: asignacion.temaId, docenteId, periodoId: asignacion.periodoId, activo: true } });
  if (!tema) throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'El tema asignado ya no existe o está archivado', 409);
  const imagenUrl = await imagenDesdeMetadata(version.metadataJson, docenteId);

  const resultado = await prisma.$transaction(async (tx) => {
    const reservado = await tx.reactivo.updateMany({
      where: { id: reactivoId, docenteId, estado: 'review', versionActual: reactivo.versionActual },
      data: { estado: 'published' }
    });
    if (reservado.count === 0) {
      const vigente = await tx.reactivo.findFirst({ where: { id: reactivoId, docenteId } });
      if (vigente?.estado === 'published' && vigente.legacyPreguntaId) {
        const legadoVigente = await tx.bancoPregunta.findFirst({
          where: { id: vigente.legacyPreguntaId, docenteId, activo: true },
          select: { id: true }
        });
        if (legadoVigente) return { actualizado: vigente, legacyId: legadoVigente.id };
      }
      throw new ErrorAplicacion('REACTIVO_ESTADO_CAMBIO', 'El reactivo cambió mientras se publicaba; consulta su estado vigente', 409);
    }

    let legacyId = reactivo.legacyPreguntaId;
    if (!legacyId) {
      const legacy = await tx.bancoPregunta.create({ data: { docenteId, periodoId: asignacion.periodoId, tema: tema.nombre, activo: true, versionActual: 1, recoverySource: JSON.stringify({ origen: 'reactivo_canonico', reactivoId }) } });
      const legacyVersion = await tx.versionPregunta.create({ data: { preguntaId: legacy.id, numeroVersion: 1, enunciado: version.enunciado, imagenUrl } });
      await tx.opcionPregunta.createMany({ data: version.opciones.map((option) => ({ versionPreguntaId: legacyVersion.id, texto: option.texto, esCorrecta: option.esCorrecta })) });
      legacyId = legacy.id;
    } else {
      const legacy = await tx.bancoPregunta.findFirst({ where: { id: legacyId, docenteId }, include: { versiones: true } });
      if (!legacy) throw new ErrorAplicacion('BANCO_LEGADO_NO_ENCONTRADO', 'No se encontró la representación compatible del reactivo', 409);
      const numero = Math.max(legacy.versionActual, ...(legacy.versiones.map((item) => item.numeroVersion))) + 1;
      const legacyVersion = await tx.versionPregunta.create({ data: { preguntaId: legacy.id, numeroVersion: numero, enunciado: version.enunciado, imagenUrl } });
      await tx.opcionPregunta.createMany({ data: version.opciones.map((option) => ({ versionPreguntaId: legacyVersion.id, texto: option.texto, esCorrecta: option.esCorrecta })) });
      await tx.bancoPregunta.update({ where: { id: legacy.id }, data: { versionActual: numero, tema: tema.nombre, periodoId: asignacion.periodoId, activo: true, archivadoEn: null } });
    }
    const actualizado = await tx.reactivo.update({ where: { id: reactivoId }, data: { estado: 'published', legacyPreguntaId: legacyId } });
    return { actualizado, legacyId };
  });
  return { reactivo: resultado.actualizado, legacyPreguntaId: resultado.legacyId };
}

export async function marcarReactivoParaRevision(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({ where: { id: reactivoId, docenteId } });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  if (reactivo.estado === 'retired') throw new ErrorAplicacion('REACTIVO_RETIRADO', 'Un reactivo retirado no puede volver a revisión', 409);
  if (reactivo.estado === 'published') return { reactivo };
  return { reactivo: await prisma.reactivo.update({ where: { id: reactivoId }, data: { estado: 'review' } }) };
}

export async function retirarReactivo(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({ where: { id: reactivoId, docenteId } });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  if (reactivo.estado === 'retired') return { reactivo };
  const archivadoEn = new Date();
  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.reactivo.update({ where: { id: reactivoId }, data: { estado: 'retired', archivadoEn } });
    if (reactivo.legacyPreguntaId) {
      await tx.bancoPregunta.updateMany({
        where: { id: reactivo.legacyPreguntaId, docenteId },
        data: { activo: false, archivadoEn }
      });
    }
    return { reactivo: actualizado };
  });
}

export async function listarVersionesReactivo(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({ where: { id: reactivoId, docenteId } });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  const versiones = await prisma.reactivoVersion.findMany({ where: { reactivoId }, include: { opciones: true }, orderBy: { numeroVersion: 'desc' } });
  return { reactivo, versiones };
}

export async function obtenerCalibracionReactivo(docenteId: string, reactivoId: string) {
  const reactivo = await prisma.reactivo.findFirst({ where: { id: reactivoId, docenteId }, include: { versiones: true } });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  const calibraciones = await prisma.reactivoCalibracion.findMany({ where: { reactivoId }, orderBy: { updatedAt: 'desc' } });
  return {
    reactivoId,
    versionActual: reactivo.versionActual,
    estado: calibraciones.length > 0 ? calibraciones[0].estadoEvidencia : 'sin_evidencia',
    calibraciones: calibraciones.map((calibracion) => ({
      ...calibracion,
      distractores: parsearObjeto(calibracion.distractoresJson),
      intervalo: parsearObjeto(calibracion.intervaloJson),
      version: reactivo.versiones.find((version) => version.id === calibracion.reactivoVersionId)?.numeroVersion ?? null
    }))
  };
}
