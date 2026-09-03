/**
 * Lease de escritura para sincronizacion entre equipos.
 *
 * La SQLite permanece local. La carpeta configurada (por ejemplo, una carpeta
 * local de OneDrive) contiene solo snapshots cifrados y metadatos de control.
 * La implementacion de carpeta es adecuada para el piloto; un proveedor con
 * escritura condicional debe sustituirla cuando se requiera coordinacion
 * distribuida fuerte.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { configuracion } from '../../../configuracion';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { prisma } from '../../../infraestructura/baseDatos/sqlite';
import { obtenerConfiguracionSincronizacion } from './preferenciasSincronizacion';
import {
  exportarInstantaneaLocal,
  importarInstantaneaLocal,
  MAX_INSTANTANEA_LOCAL_BYTES,
  type MetodoDesbloqueoInstantanea,
  type ResultadoInstantaneaLocal
} from './instantaneaLocal';

const VERSION_LEASE = 1 as const;
const NOMBRE_LEASE = '.evaluapro.lease.json';
const NOMBRE_MANIFIESTO = 'evaluapro.manifest.json';
const PREFIJO_SNAPSHOT = 'evaluapro-snapshot-';
const SUFIJO_SNAPSHOT = '.ep-snapshot';
const REINTENTOS_LECTURA_LEASE = 5;
const ESPERA_LECTURA_LEASE_MS = 20;
const REINTENTOS_LECTURA_SNAPSHOT = 6;
const ESPERA_LECTURA_SNAPSHOT_MS = 400;

type ContextoDocente = { id: string; correo: string };

export type LeaseSincronizacion = {
  version: typeof VERSION_LEASE;
  propietarioHash: string;
  equipoId: string;
  leaseId: string;
  adquiridoEn: string;
  ultimoHeartbeatEn: string;
  expiraEn: string;
};

type ManifiestoSincronizacion = {
  formato: 'evaluapro-cloud-manifest';
  version: 1;
  archivo: string;
  checksumSha256: string;
  exportadoEn: string;
  publicadoEn: string;
  leaseId: string;
  equipoId: string;
  conteos: ResultadoInstantaneaLocal['conteos'];
};

export type EstadoLeaseSincronizacion = {
  configurado: boolean;
  directorio?: string;
  origen?: 'docente' | 'entorno';
  proveedor: 'carpeta-sincronizada';
  ttlMs: number;
  modo: 'escritura' | 'solo_lectura' | 'disponible';
  lease?: {
    leaseId: string;
    equipoId: string;
    adquiridoEn: string;
    ultimoHeartbeatEn: string;
    expiraEn: string;
    propio: boolean;
  };
  snapshot?: {
    archivo: string;
    checksumSha256: string;
    exportadoEn: string;
    publicadoEn: string;
    conteos: ResultadoInstantaneaLocal['conteos'];
  };
};

function hashCorreo(correo: string) {
  return createHash('sha256').update(correo.trim().toLowerCase(), 'utf8').digest('hex');
}

function errorNoConfigurado() {
  return new ErrorAplicacion(
    'SYNC_CLOUD_NO_CONFIGURADO',
    'Selecciona la carpeta local que OneDrive sincroniza para activar la sincronización coordinada',
    503
  );
}

function exigirEquipoId(equipoId: string) {
  const valor = String(equipoId || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(valor)) {
    throw new ErrorAplicacion('SYNC_EQUIPO_INVALIDO', 'El identificador del equipo no es válido', 400);
  }
  return valor;
}

function exigirLeaseId(leaseId: string) {
  const valor = String(leaseId || '').trim();
  if (!/^[A-Za-z0-9-]{16,128}$/.test(valor)) {
    throw new ErrorAplicacion('SYNC_LEASE_INVALIDO', 'El identificador del lease no es válido', 400);
  }
  return valor;
}

async function obtenerContextoDocente(docenteId: string): Promise<ContextoDocente> {
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { id: true, correo: true } });
  if (!docente) throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'No se encontró la cuenta docente', 404);
  return docente;
}

function resolverDirectorioDocente(correo: string, raizNube: string) {
  return path.join(raizNube, hashCorreo(correo));
}

function resolverRutaLease(correo: string, raizNube: string) {
  return path.join(resolverDirectorioDocente(correo, raizNube), NOMBRE_LEASE);
}

async function leerJson<T>(ruta: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(ruta, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw new ErrorAplicacion('SYNC_LEASE_INVALIDO', 'Los metadatos de sincronización no son válidos', 409);
  }
}

function leaseVigente(lease: LeaseSincronizacion, ahora = Date.now()) {
  const expira = Date.parse(lease.expiraEn);
  return Number.isFinite(expira) && expira > ahora;
}

function vistaLease(lease: LeaseSincronizacion, equipoId: string) {
  return {
    leaseId: lease.leaseId,
    equipoId: lease.equipoId,
    adquiridoEn: lease.adquiridoEn,
    ultimoHeartbeatEn: lease.ultimoHeartbeatEn,
    expiraEn: lease.expiraEn,
    propio: lease.equipoId === equipoId
  };
}

async function escribirAtomico(ruta: string, contenido: string) {
  const temporal = `${ruta}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporal, contenido, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporal, ruta);
  } finally {
    await fs.rm(temporal, { force: true }).catch(() => undefined);
  }
}

async function escribirAtomicoBuffer(ruta: string, contenido: Buffer) {
  const temporal = `${ruta}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporal, contenido, { flag: 'wx' });
    await fs.rename(temporal, ruta);
  } finally {
    await fs.rm(temporal, { force: true }).catch(() => undefined);
  }
}

async function escribirLeaseSiCoincide(ruta: string, esperado: LeaseSincronizacion, renovado: LeaseSincronizacion) {
  const retirado = `${ruta}.${randomUUID()}.cas`;
  try {
    await fs.rename(ruta, retirado);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new ErrorAplicacion('SYNC_LEASE_REQUERIDO', 'El lease ya no está disponible; vuelve a adquirir el control de edición', 423);
    }
    throw error;
  }

  const actual = await leerJson<LeaseSincronizacion>(retirado);
  const coincide = actual?.leaseId === esperado.leaseId
    && actual.equipoId === esperado.equipoId
    && actual.propietarioHash === esperado.propietarioHash;
  if (!coincide) {
    const contenido = await fs.readFile(retirado, 'utf8').catch(() => undefined);
    if (contenido !== undefined) {
      await fs.writeFile(ruta, contenido, { encoding: 'utf8', flag: 'wx' }).catch((restoreError) => {
        if ((restoreError as NodeJS.ErrnoException)?.code !== 'EEXIST') throw restoreError;
      });
    }
    await fs.rm(retirado, { force: true });
    throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'Otro equipo adquirió el control durante la renovación', 423, actual?.expiraEn ? { expiraEn: actual.expiraEn } : undefined);
  }

  try {
    await fs.writeFile(ruta, JSON.stringify(renovado, null, 2), { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'Otro equipo adquirió el control durante la renovación', 423);
    }
    const contenido = await fs.readFile(retirado, 'utf8').catch(() => undefined);
    if (contenido !== undefined) {
      await fs.writeFile(ruta, contenido, { encoding: 'utf8', flag: 'wx' }).catch((restoreError) => {
        if ((restoreError as NodeJS.ErrnoException)?.code !== 'EEXIST') throw restoreError;
      });
    }
    throw error;
  } finally {
    await fs.rm(retirado, { force: true });
  }
}

async function leerLease(correo: string, raizNube: string) {
  const ruta = resolverRutaLease(correo, raizNube);
  for (let intento = 0; intento <= REINTENTOS_LECTURA_LEASE; intento += 1) {
    try {
      const lease = await leerJson<LeaseSincronizacion>(ruta);
      if (!lease) return null;
      if (lease.version !== VERSION_LEASE || !lease.leaseId || !lease.equipoId || !lease.propietarioHash) {
        throw new ErrorAplicacion('SYNC_LEASE_INVALIDO', 'El lease remoto no tiene un formato válido', 409);
      }
      return lease;
    } catch (error) {
      const puedeSerEscrituraEnCurso = error instanceof ErrorAplicacion && error.codigo === 'SYNC_LEASE_INVALIDO' && intento < REINTENTOS_LECTURA_LEASE;
      if (!puedeSerEscrituraEnCurso) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, ESPERA_LECTURA_LEASE_MS));
    }
  }
  return null;
}

async function exigirLeaseActivo(docenteId: string, equipoIdRaw: string, leaseIdRaw?: string) {
  const equipoId = exigirEquipoId(equipoIdRaw);
  const contexto = await obtenerContextoDocente(docenteId);
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado || !configuracionDocente.directorio) throw errorNoConfigurado();
  const raizNube = path.resolve(configuracionDocente.directorio);
  const lease = await leerLease(contexto.correo, raizNube);
  if (!lease || !leaseVigente(lease)) {
    throw new ErrorAplicacion('SYNC_LEASE_REQUERIDO', 'Debes adquirir el control de edición antes de modificar o publicar datos', 423);
  }
  if (lease.propietarioHash !== hashCorreo(contexto.correo)) {
    throw new ErrorAplicacion('SYNC_LEASE_INVALIDO', 'El lease no corresponde a la cuenta docente', 409);
  }
  if (lease.equipoId !== equipoId || (leaseIdRaw && lease.leaseId !== exigirLeaseId(leaseIdRaw))) {
    throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'Otro equipo posee actualmente el control de edición', 423, { expiraEn: lease.expiraEn });
  }
  return { contexto, lease, equipoId, raizNube };
}

export async function obtenerEstadoLease(docenteId: string, equipoIdRaw: string): Promise<EstadoLeaseSincronizacion> {
  const equipoId = exigirEquipoId(equipoIdRaw);
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado || !configuracionDocente.directorio) {
    return { configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: configuracion.sincronizacionLeaseTtlMs, modo: 'disponible' };
  }
  const contexto = await obtenerContextoDocente(docenteId);
  const raizNube = path.resolve(configuracionDocente.directorio);
  const directorio = resolverDirectorioDocente(contexto.correo, raizNube);
  const lease = await leerLease(contexto.correo, raizNube);
  const manifiesto = await leerJson<ManifiestoSincronizacion>(path.join(directorio, NOMBRE_MANIFIESTO));
  const vigente = Boolean(lease && leaseVigente(lease));
  return {
    configurado: true,
    directorio: raizNube,
    origen: configuracionDocente.origen,
    proveedor: 'carpeta-sincronizada',
    ttlMs: configuracion.sincronizacionLeaseTtlMs,
    modo: vigente ? (lease?.equipoId === equipoId ? 'escritura' : 'solo_lectura') : 'disponible',
    ...(lease && vigente ? { lease: vistaLease(lease, equipoId) } : {}),
    ...(manifiesto?.formato === 'evaluapro-cloud-manifest' && manifiesto.version === 1 ? {
      snapshot: {
        archivo: manifiesto.archivo,
        checksumSha256: manifiesto.checksumSha256,
        exportadoEn: manifiesto.exportadoEn,
        publicadoEn: manifiesto.publicadoEn,
        conteos: manifiesto.conteos
      }
    } : {})
  };
}

export async function adquirirLease(docenteId: string, equipoIdRaw: string) {
  const equipoId = exigirEquipoId(equipoIdRaw);
  const contexto = await obtenerContextoDocente(docenteId);
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado || !configuracionDocente.directorio) throw errorNoConfigurado();
  const raizNube = path.resolve(configuracionDocente.directorio);
  const directorio = resolverDirectorioDocente(contexto.correo, raizNube);
  const ruta = path.join(directorio, NOMBRE_LEASE);
  await fs.mkdir(directorio, { recursive: true });
  const actual = await leerLease(contexto.correo, raizNube);
  if (actual && leaseVigente(actual)) {
    if (actual.equipoId !== equipoId) {
      throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'Otro equipo posee actualmente el control de edición', 423, { expiraEn: actual.expiraEn, adquiridoEn: actual.adquiridoEn });
    }
    const ahora = new Date();
    const renovado: LeaseSincronizacion = { ...actual, ultimoHeartbeatEn: ahora.toISOString(), expiraEn: new Date(ahora.getTime() + configuracion.sincronizacionLeaseTtlMs).toISOString() };
    await escribirLeaseSiCoincide(ruta, actual, renovado);
    return { mensaje: 'Control de edición renovado', lease: vistaLease(renovado, equipoId), ttlMs: configuracion.sincronizacionLeaseTtlMs };
  }
  if (actual) {
    await fs.rename(ruta, path.join(directorio, `.evaluapro.lease.expirado-${Date.now()}-${randomUUID()}.json`)).catch(() => undefined);
  }
  const ahora = new Date();
  const nuevo: LeaseSincronizacion = {
    version: VERSION_LEASE,
    propietarioHash: hashCorreo(contexto.correo),
    equipoId,
    leaseId: randomUUID(),
    adquiridoEn: ahora.toISOString(),
    ultimoHeartbeatEn: ahora.toISOString(),
    expiraEn: new Date(ahora.getTime() + configuracion.sincronizacionLeaseTtlMs).toISOString()
  };
  try {
    const handle = await fs.open(ruta, 'wx');
    try { await handle.writeFile(JSON.stringify(nuevo, null, 2), 'utf8'); } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      const conflicto = await leerLease(contexto.correo, raizNube);
      throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'Otro equipo adquirió el control durante la solicitud', 423, conflicto ? { expiraEn: conflicto.expiraEn, adquiridoEn: conflicto.adquiridoEn } : undefined);
    }
    throw error;
  }
  return { mensaje: 'Control de edición adquirido', lease: vistaLease(nuevo, equipoId), ttlMs: configuracion.sincronizacionLeaseTtlMs };
}

export async function renovarLease(docenteId: string, equipoIdRaw: string, leaseIdRaw: string) {
  const { contexto, lease, equipoId, raizNube } = await exigirLeaseActivo(docenteId, equipoIdRaw, leaseIdRaw);
  const ahora = new Date();
  const renovado: LeaseSincronizacion = { ...lease, ultimoHeartbeatEn: ahora.toISOString(), expiraEn: new Date(ahora.getTime() + configuracion.sincronizacionLeaseTtlMs).toISOString() };
  await escribirLeaseSiCoincide(resolverRutaLease(contexto.correo, raizNube), lease, renovado);
  return { mensaje: 'Lease renovado', lease: vistaLease(renovado, equipoId), ttlMs: configuracion.sincronizacionLeaseTtlMs };
}

export async function liberarLease(docenteId: string, equipoIdRaw: string, leaseIdRaw: string) {
  const equipoId = exigirEquipoId(equipoIdRaw);
  const leaseId = exigirLeaseId(leaseIdRaw);
  const contexto = await obtenerContextoDocente(docenteId);
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado || !configuracionDocente.directorio) throw errorNoConfigurado();
  const raizNube = path.resolve(configuracionDocente.directorio);
  const ruta = resolverRutaLease(contexto.correo, raizNube);
  const lease = await leerLease(contexto.correo, raizNube);
  if (!lease || !leaseVigente(lease)) return { mensaje: 'Control de edición ya liberado', liberado: true };
  if (lease.equipoId !== equipoId || lease.leaseId !== leaseId) throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'El control pertenece a otro equipo', 423);

  // No borrar directamente: el lease puede haber expirado y sido reemplazado
  // por otro equipo entre la lectura anterior y esta operación. Al moverlo a
  // una ruta temporal, cualquier lease nuevo queda en su propia ruta y nunca
  // puede ser eliminado por una liberación antigua.
  const retirada = `${ruta}.${randomUUID()}.release`;
  await fs.rename(ruta, retirada).catch((error) => {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return;
    throw error;
  });
  const retiradaActual = await leerJson<LeaseSincronizacion>(retirada);
  if (retiradaActual?.leaseId === lease.leaseId && retiradaActual.equipoId === equipoId && retiradaActual.propietarioHash === lease.propietarioHash) {
    await fs.rm(retirada, { force: true });
    return { mensaje: 'Control de edición liberado', liberado: true };
  }

  // Si el contenido cambió durante la retirada, no descartarlo: restaura el
  // metadato únicamente si la ruta sigue libre. Si otro equipo ya escribió,
  // se conserva su lease y se archiva el metadato retirado.
  const contenidoRetirado = await fs.readFile(retirada, 'utf8').catch(() => undefined);
  if (contenidoRetirado !== undefined) {
    try {
      await fs.writeFile(ruta, contenidoRetirado, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
    }
  }
  await fs.rm(retirada, { force: true });
  throw new ErrorAplicacion('SYNC_LEASE_OCUPADO', 'El control pertenece a otro equipo', 423);
}

export async function publicarInstantaneaNube(params: { docenteId: string; equipoId: string; leaseId: string; metodo: MetodoDesbloqueoInstantanea; credencial?: string }) {
  const { contexto, equipoId, raizNube } = await exigirLeaseActivo(params.docenteId, params.equipoId, params.leaseId);
  const resultado = await exportarInstantaneaLocal({ docenteId: params.docenteId, metodo: params.metodo, credencial: params.credencial });
  const directorio = resolverDirectorioDocente(contexto.correo, raizNube);
  await fs.mkdir(directorio, { recursive: true });
  const archivo = `${PREFIJO_SNAPSHOT}${resultado.checksumSha256}${SUFIJO_SNAPSHOT}`;
  await escribirAtomicoBuffer(path.join(directorio, archivo), resultado.archivo);
  // El snapshot se escribe antes del manifiesto para que una pérdida de lease
  // deje, como máximo, un archivo huérfano y nunca una publicación confirmada.
  const leaseAntesDelManifiesto = await exigirLeaseActivo(params.docenteId, params.equipoId, params.leaseId);
  const publicadoEn = new Date().toISOString();
  const manifiesto: ManifiestoSincronizacion = {
    formato: 'evaluapro-cloud-manifest',
    version: 1,
    archivo,
    checksumSha256: resultado.checksumSha256,
    exportadoEn: resultado.exportadoEn,
    publicadoEn,
    leaseId: leaseAntesDelManifiesto.lease.leaseId,
    equipoId,
    conteos: resultado.conteos
  };
  await escribirAtomico(path.join(directorio, NOMBRE_MANIFIESTO), JSON.stringify(manifiesto, null, 2));
  let leaseLiberado = true;
  try {
    await liberarLease(params.docenteId, params.equipoId, params.leaseId);
  } catch {
    // La publicación ya está confirmada. Se informa el bloqueo residual para
    // que la interfaz pueda refrescar el estado y ofrecer liberación manual.
    leaseLiberado = false;
  }
  return {
    mensaje: leaseLiberado
      ? 'Instantánea publicada en la nube y control de edición liberado'
      : 'Instantánea publicada, pero el control no se liberó; vuelve a intentarlo manualmente',
    checksumSha256: resultado.checksumSha256,
    publicadoEn,
    conteos: resultado.conteos,
    leaseLiberado
  };
}

async function leerSnapshotNube(correo: string, raizNube: string) {
  const directorio = resolverDirectorioDocente(correo, raizNube);
  const manifiesto = await leerJson<ManifiestoSincronizacion>(path.join(directorio, NOMBRE_MANIFIESTO));
  if (!manifiesto || manifiesto.formato !== 'evaluapro-cloud-manifest' || manifiesto.version !== 1 || !/^[a-z0-9-]+\.ep-snapshot$/.test(manifiesto.archivo)) {
    throw new ErrorAplicacion('SYNC_SNAPSHOT_NO_DISPONIBLE', 'No hay una instantánea válida publicada en la nube', 404);
  }
  const rutaArchivo = path.join(directorio, manifiesto.archivo);
  for (let intento = 0; intento < REINTENTOS_LECTURA_SNAPSHOT; intento += 1) {
    try {
      const archivo = await fs.readFile(rutaArchivo);
      if (archivo.length > MAX_INSTANTANEA_LOCAL_BYTES) {
        throw new ErrorAplicacion('SYNC_SNAPSHOT_CORRUPTO', 'La instantánea publicada supera el tamaño permitido', 409);
      }
      if (createHash('sha256').update(archivo).digest('hex') === manifiesto.checksumSha256) return { archivo, manifiesto };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }
    if (intento + 1 < REINTENTOS_LECTURA_SNAPSHOT) {
      await new Promise<void>((resolve) => setTimeout(resolve, ESPERA_LECTURA_SNAPSHOT_MS));
    }
  }
  throw new ErrorAplicacion('SYNC_SNAPSHOT_CORRUPTO', 'La instantánea publicada no coincide con su checksum; espera a que OneDrive termine de sincronizarla', 409);
}

export async function descargarInstantaneaNube(docenteId: string) {
  const contexto = await obtenerContextoDocente(docenteId);
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado || !configuracionDocente.directorio) throw errorNoConfigurado();
  const { archivo, manifiesto } = await leerSnapshotNube(contexto.correo, path.resolve(configuracionDocente.directorio));
  return { archivo, nombreArchivo: manifiesto.archivo, checksumSha256: manifiesto.checksumSha256, exportadoEn: manifiesto.exportadoEn, publicadoEn: manifiesto.publicadoEn, conteos: manifiesto.conteos };
}

export async function importarInstantaneaNube(params: { docenteId: string; equipoId: string; leaseId: string; metodo: MetodoDesbloqueoInstantanea; credencial?: string; dryRun: boolean }) {
  const { raizNube } = await exigirLeaseActivo(params.docenteId, params.equipoId, params.leaseId);
  const contexto = await obtenerContextoDocente(params.docenteId);
  const remota = await leerSnapshotNube(contexto.correo, raizNube);
  const resultado = await importarInstantaneaLocal({
    docenteId: params.docenteId,
    archivo: remota.archivo,
    metodo: params.metodo,
    credencial: params.credencial,
    dryRun: params.dryRun,
    verificarAntesDeReemplazar: params.dryRun ? undefined : async () => {
      await exigirLeaseActivo(params.docenteId, params.equipoId, params.leaseId);
    }
  });
  if (!params.dryRun) await liberarLease(params.docenteId, params.equipoId, params.leaseId);
  return { ...resultado, origen: 'nube', archivo: remota.manifiesto.archivo };
}

export async function verificarLeaseEscritura(docenteId: string, equipoIdRaw: string) {
  const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
  if (!configuracionDocente.configurado) return;
  await exigirLeaseActivo(docenteId, equipoIdRaw);
}
