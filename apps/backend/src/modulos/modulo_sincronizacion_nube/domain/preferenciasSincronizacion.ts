/** Preferencia local de la carpeta que el cliente de nube sincroniza. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { configuracion } from '../../../configuracion';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { prisma } from '../../../infraestructura/baseDatos/sqlite';

const VERSION_PREFERENCIAS = 1 as const;
const NOMBRE_PREFERENCIAS = 'sincronizacion-preferencias.json';

type PreferenciasPersistidas = {
  version: typeof VERSION_PREFERENCIAS;
  docentes: Record<string, { directorio: string; actualizadoEn: string }>;
};

export type ConfiguracionSincronizacionDocente = {
  configurado: boolean;
  directorio?: string;
  origen?: 'docente' | 'entorno';
  proveedor: 'carpeta-sincronizada';
  ttlMs: number;
};

function hashCorreo(correo: string) {
  return createHash('sha256').update(correo.trim().toLowerCase(), 'utf8').digest('hex');
}

function resolverRutaBaseDatos() {
  const valor = String(process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (valor.startsWith('file:')) return path.resolve(decodeURIComponent(valor.slice(5)));
  const dataDir = process.env.NODE_ENV === 'production'
    ? path.resolve(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EvaluaPro', 'data')
    : path.resolve(process.cwd(), 'data');
  return path.join(dataDir, 'evaluapro.db');
}

function resolverRutaPreferencias() {
  return path.join(path.dirname(resolverRutaBaseDatos()), NOMBRE_PREFERENCIAS);
}

async function leerPreferencias(): Promise<PreferenciasPersistidas> {
  try {
    const contenido = JSON.parse(await fs.readFile(resolverRutaPreferencias(), 'utf8')) as Partial<PreferenciasPersistidas>;
    if (contenido.version !== VERSION_PREFERENCIAS || !contenido.docentes || typeof contenido.docentes !== 'object') {
      throw new ErrorAplicacion('SYNC_CONFIG_INVALIDA', 'La configuración local de sincronización no es válida', 409);
    }
    return contenido as PreferenciasPersistidas;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { version: VERSION_PREFERENCIAS, docentes: {} };
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('SYNC_CONFIG_INVALIDA', 'La configuración local de sincronización no es válida', 409);
  }
}

async function guardarPreferencias(preferencias: PreferenciasPersistidas) {
  const ruta = resolverRutaPreferencias();
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporal, JSON.stringify(preferencias, null, 2), { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporal, ruta);
  } finally {
    await fs.rm(temporal, { force: true }).catch(() => undefined);
  }
}

function validarDirectorio(directorioRaw: string) {
  const directorio = String(directorioRaw || '').trim();
  if (!path.isAbsolute(directorio)) {
    throw new ErrorAplicacion('SYNC_CONFIG_RUTA_INVALIDA', 'Selecciona una carpeta con una ruta absoluta', 400);
  }
  const normalizado = path.resolve(directorio);
  const raiz = path.parse(normalizado).root;
  if (normalizado === raiz) {
    throw new ErrorAplicacion('SYNC_CONFIG_RUTA_INVALIDA', 'No se puede usar la raíz del disco como carpeta de sincronización', 400);
  }
  const rutaBaseDatos = path.resolve(resolverRutaBaseDatos());
  const directorioBaseDatos = path.dirname(rutaBaseDatos);
  if (normalizado === directorioBaseDatos || normalizado.startsWith(`${directorioBaseDatos}${path.sep}`)) {
    throw new ErrorAplicacion('SYNC_CONFIG_RUTA_INVALIDA', 'La carpeta de sincronización debe estar fuera del almacenamiento local de EvaluaPro', 400);
  }
  return normalizado;
}

async function existeLeaseVigente(directorio: string, correo: string) {
  const ruta = path.join(directorio, hashCorreo(correo), '.evaluapro.lease.json');
  try {
    const lease = JSON.parse(await fs.readFile(ruta, 'utf8')) as { expiraEn?: string };
    const expira = Date.parse(String(lease.expiraEn || ''));
    return Number.isFinite(expira) && expira > Date.now();
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
    throw new ErrorAplicacion('SYNC_CONFIG_INVALIDA', 'No se pudo comprobar el control de edición de la carpeta actual', 409);
  }
}

export async function obtenerConfiguracionSincronizacion(docenteId: string): Promise<ConfiguracionSincronizacionDocente> {
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { correo: true } });
  if (!docente) throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'No se encontró la cuenta docente', 404);
  const preferencias = await leerPreferencias();
  const preferencia = preferencias.docentes[hashCorreo(docente.correo)];
  const directorioPreferencia = preferencia?.directorio ? validarDirectorio(preferencia.directorio) : undefined;
  const directorioEntornoRaw = String(configuracion.sincronizacionNubeDirectorio || '').trim();
  const directorioEntorno = directorioEntornoRaw ? validarDirectorio(directorioEntornoRaw) : undefined;
  const directorio = directorioPreferencia || directorioEntorno;
  return {
    configurado: Boolean(directorio),
    ...(directorio ? { directorio } : {}),
    ...(preferencia ? { origen: 'docente' as const } : directorio ? { origen: 'entorno' as const } : {}),
    proveedor: 'carpeta-sincronizada',
    ttlMs: configuracion.sincronizacionLeaseTtlMs
  };
}

export async function configurarDirectorioSincronizacion(docenteId: string, directorioRaw: string) {
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { correo: true } });
  if (!docente) throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'No se encontró la cuenta docente', 404);
  const directorio = validarDirectorio(directorioRaw);
  const preferencias = await leerPreferencias();
  const clave = hashCorreo(docente.correo);
  const actual = preferencias.docentes[clave]?.directorio;
  if (actual && path.resolve(actual) !== directorio && await existeLeaseVigente(path.resolve(actual), docente.correo)) {
    throw new ErrorAplicacion('SYNC_CONFIG_LEASE_ACTIVO', 'Libera el control de edición antes de cambiar la carpeta sincronizada', 423);
  }
  await fs.mkdir(directorio, { recursive: true });
  const estadisticas = await fs.stat(directorio);
  if (!estadisticas.isDirectory()) {
    throw new ErrorAplicacion('SYNC_CONFIG_RUTA_INVALIDA', 'La ruta seleccionada no es una carpeta', 400);
  }
  const rutaReal = path.resolve(await fs.realpath(directorio));
  const baseDatosReal = path.resolve(await fs.realpath(path.dirname(resolverRutaBaseDatos())));
  const comparar = (ruta: string) => process.platform === 'win32' ? ruta.toLowerCase() : ruta;
  const rutaRealComparacion = comparar(rutaReal);
  const baseDatosRealComparacion = comparar(baseDatosReal);
  if (rutaRealComparacion === baseDatosRealComparacion || rutaRealComparacion.startsWith(`${baseDatosRealComparacion}${path.sep}`)) {
    throw new ErrorAplicacion('SYNC_CONFIG_RUTA_INVALIDA', 'La carpeta de sincronización debe estar fuera del almacenamiento local de EvaluaPro', 400);
  }
  preferencias.docentes[clave] = { directorio: rutaReal, actualizadoEn: new Date().toISOString() };
  await guardarPreferencias(preferencias);
  return obtenerConfiguracionSincronizacion(docenteId);
}
