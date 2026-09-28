import { createHash, randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';

type FamiliaPolitica = 'lisc_encuadre' | 'sv_excel_contract';
type PoliticaDocente = {
  id: string;
  docenteId: string;
  codigo: string;
  familia: FamiliaPolitica;
  version: number;
  nombre: string;
  descripcion: string | null;
  parametros: Record<string, unknown>;
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type EntradaPolitica = {
  codigo: string;
  familia: FamiliaPolitica;
  nombre: string;
  descripcion?: string;
  parametros?: Record<string, unknown>;
  clientRequestId: string;
};

function serializarEstable(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarEstable).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entradas.map(([clave, item]) => `${JSON.stringify(clave)}:${serializarEstable(item)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function hashSolicitud(accion: string, payload: unknown): string {
  return createHash('sha256').update(serializarEstable({ accion, payload })).digest('hex');
}

function leerConfiguracion(configuracion: unknown): Record<string, unknown> {
  if (typeof configuracion !== 'string') return {};
  try {
    const parsed = JSON.parse(configuracion);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapearPoliticaCalificacion(row: Record<string, any>): PoliticaDocente {
  const configuracion = leerConfiguracion(row.configuracion);
  return {
    id: String(row.id),
    docenteId: String(row.docenteId),
    codigo: String(row.codigo ?? configuracion.codigo ?? ''),
    familia: String(row.familia ?? configuracion.familia ?? 'lisc_encuadre') as FamiliaPolitica,
    version: Number(row.version ?? configuracion.version ?? 1),
    nombre: String(row.nombre ?? ''),
    descripcion: typeof row.descripcion === 'string' ? row.descripcion : typeof configuracion.descripcion === 'string' ? configuracion.descripcion : null,
    parametros: (configuracion.parametros && typeof configuracion.parametros === 'object' ? configuracion.parametros : {}) as Record<string, unknown>,
    activa: row.activa !== false && configuracion.activa !== false,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt ?? Date.now())),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt ?? Date.now()))
  };
}

async function consultarFilaPorRequestId(tx: any, docenteId: string, clientRequestId: string) {
  const rows = await tx.$queryRawUnsafe(
    'SELECT requestHash, despues FROM auditoria_politicas_calificacion WHERE docenteId = ? AND clientRequestId = ? LIMIT 1',
    docenteId,
    clientRequestId
  ) as Array<{ requestHash: string; despues: string }>;
  return rows[0] ?? null;
}

async function ejecutarMutacionIdempotente<T>(params: {
  docenteId: string;
  accion: string;
  codigo: string;
  clientRequestId: string;
  payload: unknown;
  motivo?: string;
  mutar(tx: any): Promise<{ resultado: T; version: number; antes: unknown; despues: unknown }>;
}): Promise<T> {
  const requestHash = hashSolicitud(params.accion, params.payload);
  try {
    return await (prisma as any).$transaction(async (tx: any) => {
      const existente = await consultarFilaPorRequestId(tx, params.docenteId, params.clientRequestId);
      if (existente) {
        if (existente.requestHash !== requestHash) {
          throw new ErrorAplicacion('POLITICA_IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otra acción o payload', 409);
        }
        return JSON.parse(existente.despues) as T;
      }

      const { resultado, version, antes, despues } = await params.mutar(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO auditoria_politicas_calificacion
          (id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        params.docenteId,
        params.codigo,
        version,
        params.accion,
        params.motivo ?? null,
        params.clientRequestId,
        requestHash,
        antes === null ? null : JSON.stringify(antes),
        JSON.stringify(despues),
        new Date()
      );
      return resultado;
    });
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    if (String((error as { code?: unknown })?.code ?? '').includes('P2002') || /unique constraint/i.test(String(error))) {
      const existente = await consultarFilaPorRequestId(prisma as any, params.docenteId, params.clientRequestId);
      if (existente) {
        if (existente.requestHash === requestHash) return JSON.parse(existente.despues) as T;
        throw new ErrorAplicacion('POLITICA_IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otra acción o payload', 409);
      }
      throw new ErrorAplicacion('POLITICA_CONFLICTO', 'La política cambió en otra solicitud; vuelve a consultar la versión vigente', 409);
    }
    throw error;
  }
}

async function buscarVersiones(tx: any, docenteId: string, codigo: string): Promise<PoliticaDocente[]> {
  const rows = await tx.politicaCalificacion.findMany({
    where: { docenteId, codigo },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
  });
  return rows.map(mapearPoliticaCalificacion);
}

export async function listarPoliticasDocente(docenteId: string, opciones: { incluirArchivadas?: boolean; incluirVersiones?: boolean } = {}) {
  const filas = await (prisma as any).politicaCalificacion.findMany({
    where: { docenteId, codigo: { not: null } },
    orderBy: [{ codigo: 'asc' }, { version: 'desc' }]
  });
  const politicas = filas.map(mapearPoliticaCalificacion) as PoliticaDocente[];
  const porCodigo = new Map<string, PoliticaDocente[]>();
  for (const politica of politicas) {
    const versiones = porCodigo.get(politica.codigo) ?? [];
    versiones.push(politica);
    porCodigo.set(politica.codigo, versiones);
  }
  const salida: PoliticaDocente[] = [];
  for (const versiones of porCodigo.values()) {
    const vigente = versiones[0];
    if (!opciones.incluirArchivadas && !vigente.activa) continue;
    salida.push(...(opciones.incluirVersiones ? versiones : [vigente]));
  }
  return salida.sort((a, b) => a.codigo.localeCompare(b.codigo) || b.version - a.version);
}

export async function obtenerPoliticaDocente(docenteId: string, codigo: string, version?: number) {
  const versiones = await buscarVersiones(prisma as any, docenteId, codigo);
  const politica = version ? versiones.find((item) => item.version === version) : versiones[0];
  if (!politica) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'Política no encontrada', 404);
  return politica;
}

export async function crearPoliticaDocente(docenteId: string, payload: EntradaPolitica): Promise<PoliticaDocente> {
  return ejecutarMutacionIdempotente({
    docenteId, codigo: payload.codigo, accion: 'crear', clientRequestId: payload.clientRequestId, payload,
    async mutar(tx) {
      const versiones = await buscarVersiones(tx, docenteId, payload.codigo);
      if (versiones.length) throw new ErrorAplicacion('POLITICA_DUPLICADA', 'Ya existe una política con ese código', 409);
      const ahora = new Date();
      const configuracion = { codigo: payload.codigo, familia: payload.familia, version: 1, descripcion: payload.descripcion ?? null, parametros: payload.parametros ?? {}, activa: true };
      const row = await tx.politicaCalificacion.create({
        data: { id: randomUUID(), docenteId, codigo: payload.codigo, familia: payload.familia, version: 1, descripcion: payload.descripcion ?? null, activa: true, nombre: payload.nombre, configuracion: JSON.stringify(configuracion), createdAt: ahora, updatedAt: ahora }
      });
      const politica = mapearPoliticaCalificacion(row);
      return { resultado: politica, version: 1, antes: null, despues: politica };
    }
  });
}

export async function versionarPoliticaDocente(docenteId: string, codigo: string, payload: EntradaPolitica): Promise<PoliticaDocente> {
  if (payload.codigo !== codigo) throw new ErrorAplicacion('DATOS_INVALIDOS', 'El código de ruta y cuerpo debe coincidir', 400);
  return ejecutarMutacionIdempotente({
    docenteId, codigo, accion: 'versionar', clientRequestId: payload.clientRequestId, payload,
    async mutar(tx) {
      const versiones = await buscarVersiones(tx, docenteId, codigo);
      const anterior = versiones[0];
      if (!anterior) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'Política no encontrada', 404);
      if (payload.familia !== anterior.familia) throw new ErrorAplicacion('DATOS_INVALIDOS', 'La familia de cálculo no cambia entre versiones', 400);
      const version = anterior.version + 1;
      const ahora = new Date();
      const configuracion = { codigo, familia: payload.familia, version, descripcion: payload.descripcion ?? null, parametros: payload.parametros ?? {}, activa: true };
      const row = await tx.politicaCalificacion.create({
        data: { id: randomUUID(), docenteId, codigo, familia: payload.familia, version, descripcion: payload.descripcion ?? null, activa: true, nombre: payload.nombre, configuracion: JSON.stringify(configuracion), createdAt: ahora, updatedAt: ahora }
      });
      const politica = mapearPoliticaCalificacion(row);
      return { resultado: politica, version, antes: anterior, despues: politica };
    }
  });
}

export async function archivarPoliticaDocente(docenteId: string, codigo: string, payload: { clientRequestId: string; motivo: string }): Promise<PoliticaDocente> {
  return ejecutarMutacionIdempotente({
    docenteId, codigo, accion: 'archivar', clientRequestId: payload.clientRequestId, payload, motivo: payload.motivo,
    async mutar(tx) {
      const versiones = await buscarVersiones(tx, docenteId, codigo);
      const anterior = versiones[0];
      if (!anterior) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'Política no encontrada', 404);
      if (!anterior.activa) throw new ErrorAplicacion('POLITICA_ARCHIVADA', 'La política ya está archivada', 409);
      const version = anterior.version + 1;
      const ahora = new Date();
      const configuracion = { codigo, familia: anterior.familia, version, descripcion: anterior.descripcion, parametros: anterior.parametros, activa: false, motivoArchivo: payload.motivo };
      const row = await tx.politicaCalificacion.create({
        data: { id: randomUUID(), docenteId, codigo, familia: anterior.familia, version, descripcion: anterior.descripcion, activa: false, nombre: anterior.nombre, configuracion: JSON.stringify(configuracion), createdAt: ahora, updatedAt: ahora }
      });
      const politica = mapearPoliticaCalificacion(row);
      return { resultado: politica, version, antes: anterior, despues: politica };
    }
  });
}

export async function listarAuditoriaPolitica(docenteId: string, codigo: string, opciones: { limite?: number; cursor?: string } = {}) {
  const limite = Math.max(1, Math.min(100, Math.trunc(opciones.limite ?? 50)));
  let cursor: { createdAt: string; id: string } | null = null;
  if (opciones.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(opciones.cursor, 'base64url').toString('utf8'));
      if (!cursor?.createdAt || !cursor?.id) throw new Error('cursor incompleto');
    } catch {
      throw new ErrorAplicacion('CURSOR_INVALIDO', 'Cursor de auditoría inválido', 400);
    }
  }
  const condiciones = cursor
    ? ' AND (julianday(createdAt) < julianday(?) OR (julianday(createdAt) = julianday(?) AND id < ?))'
    : '';
  const parametros = cursor
    ? [docenteId, codigo, cursor.createdAt, cursor.createdAt, cursor.id, limite + 1]
    : [docenteId, codigo, limite + 1];
  const filas = await (prisma as any).$queryRawUnsafe(
    `SELECT id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt
       FROM auditoria_politicas_calificacion WHERE docenteId = ? AND codigo = ?${condiciones}
       ORDER BY createdAt DESC, id DESC LIMIT ?`,
    ...parametros
  ) as Array<Record<string, any>>;
  const haySiguiente = filas.length > limite;
  const pagina = filas.slice(0, limite).map((fila) => ({
    id: String(fila.id),
    docenteId: String(fila.docenteId),
    codigo: String(fila.codigo),
    version: Number(fila.version),
    accion: String(fila.accion),
    motivo: typeof fila.motivo === 'string' ? fila.motivo : null,
    clientRequestId: String(fila.clientRequestId),
    requestHash: String(fila.requestHash),
    antes: fila.antes ? JSON.parse(fila.antes) : null,
    despues: JSON.parse(fila.despues),
    createdAt: fila.createdAt as Date | string
  }));
  const ultimo = pagina[pagina.length - 1];
  return {
    eventos: pagina,
    nextCursor: haySiguiente && ultimo ? Buffer.from(JSON.stringify({ createdAt: new Date(String(ultimo.createdAt)).toISOString(), id: ultimo.id })).toString('base64url') : null
  };
}
