import { createHash, randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';

type MutacionAuditable<T> = {
  docenteId: string;
  codigo: string;
  accion: 'crear' | 'versionar' | 'archivar';
  motivo?: string;
  clientRequestId: string;
  payload: unknown;
  mutar(tx: any): Promise<{ resultado: T; version: number; antes: unknown; despues: unknown }>;
};

function serializarCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entradas.map(([clave, item]) => `${JSON.stringify(clave)}:${serializarCanonico(item)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function hashSolicitud(accion: string, payload: unknown): string {
  return createHash('sha256').update(serializarCanonico({ accion, payload })).digest('hex');
}

async function consultarPorRequestId(db: any, docenteId: string, clientRequestId: string) {
  const filas = await db.$queryRawUnsafe(
    'SELECT requestHash, despues FROM auditoria_politicas_calificacion WHERE docenteId = ? AND clientRequestId = ? LIMIT 1',
    docenteId,
    clientRequestId
  ) as Array<{ requestHash: string; despues: string }>;
  return filas[0] ?? null;
}

export async function ejecutarMutacionPoliticaAuditable<T>(params: MutacionAuditable<T>): Promise<{ resultado: T; repetida: boolean }> {
  const requestHash = hashSolicitud(params.accion, params.payload);
  try {
    return await (prisma as any).$transaction(async (tx: any) => {
      const existente = await consultarPorRequestId(tx, params.docenteId, params.clientRequestId);
      if (existente) {
        if (existente.requestHash !== requestHash) {
          throw new ErrorAplicacion('IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otra acción o contenido', 409);
        }
        return { resultado: JSON.parse(existente.despues) as T, repetida: true };
      }

      const cambio = await params.mutar(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO auditoria_politicas_calificacion
          (id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        params.docenteId,
        params.codigo,
        cambio.version,
        params.accion,
        params.motivo ?? null,
        params.clientRequestId,
        requestHash,
        cambio.antes === null ? null : JSON.stringify(cambio.antes),
        JSON.stringify(cambio.despues),
        new Date()
      );
      return { resultado: cambio.resultado, repetida: false };
    });
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    const esConflictoUnico = String((error as { code?: unknown })?.code ?? '').includes('P2002')
      || /unique constraint/i.test(String(error));
    if (!esConflictoUnico) throw error;

    const existente = await consultarPorRequestId(prisma as any, params.docenteId, params.clientRequestId);
    if (existente) {
      if (existente.requestHash !== requestHash) {
        throw new ErrorAplicacion('IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otra acción o contenido', 409);
      }
      return { resultado: JSON.parse(existente.despues) as T, repetida: true };
    }
    throw new ErrorAplicacion('POLITICA_VERSION_CONFLICTO', 'La política cambió en otra solicitud; consulta la versión vigente', 409);
  }
}

export async function listarAuditoriaPoliticaCalificacion(
  docenteId: string,
  codigo: string,
  opciones: { limite?: number; cursor?: string } = {}
) {
  const limite = Math.max(1, Math.min(100, Math.trunc(opciones.limite ?? 50)));
  let cursor: { version: number; id: string } | null = null;
  if (opciones.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(opciones.cursor, 'base64url').toString('utf8'));
      if (!Number.isInteger(cursor?.version) || !cursor?.id) throw new Error('cursor incompleto');
    } catch {
      throw new ErrorAplicacion('CURSOR_INVALIDO', 'Cursor de auditoría inválido', 400);
    }
  }

  const condicionCursor = cursor ? ' AND (version < ? OR (version = ? AND id < ?))' : '';
  const parametros = cursor
    ? [docenteId, codigo, cursor.version, cursor.version, cursor.id, limite + 1]
    : [docenteId, codigo, limite + 1];
  const filas = await (prisma as any).$queryRawUnsafe(
    `SELECT id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt
       FROM auditoria_politicas_calificacion WHERE docenteId = ? AND codigo = ?${condicionCursor}
       ORDER BY version DESC, id DESC LIMIT ?`,
    ...parametros
  ) as Array<Record<string, unknown>>;
  const haySiguiente = filas.length > limite;
  const eventos = filas.slice(0, limite).map((fila) => ({
    id: String(fila.id),
    docenteId: String(fila.docenteId),
    codigo: String(fila.codigo),
    version: Number(fila.version),
    accion: String(fila.accion),
    motivo: typeof fila.motivo === 'string' ? fila.motivo : null,
    clientRequestId: String(fila.clientRequestId),
    requestHash: String(fila.requestHash),
    antes: fila.antes ? JSON.parse(String(fila.antes)) : null,
    despues: JSON.parse(String(fila.despues)),
    createdAt: fila.createdAt
  }));
  const ultimo = eventos[eventos.length - 1];
  return {
    eventos,
    nextCursor: haySiguiente && ultimo
      ? Buffer.from(JSON.stringify({ version: ultimo.version, id: ultimo.id })).toString('base64url')
      : null
  };
}
