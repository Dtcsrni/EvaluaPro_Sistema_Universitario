import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import {
  INSTANTANEA_LOCAL_FORMATO,
  derivarClaveGoogle,
  derivarClavePassword,
  desenvolverClave,
  envolverClave,
  obtenerContextoDocente,
  resolverRutaArtefactos,
  resolverRutaBaseDatos,
  validarCredencialExportacion,
  validarIntegridadSqlite,
  type ContextoDocente,
  type MetodoDesbloqueoInstantanea,
  type SobreClave
} from './instantaneaLocal.js';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion.js';
import { prisma, conectarSqlite, desconectarSqlite } from '../../../infraestructura/baseDatos/sqlite.js';
import { compararContrasena, verificarCredencialGoogle } from '../../modulo_autenticacion/index.js';

export const INSTANTANEA_LOCAL_STREAM_MAGIC = Buffer.from('EPSNAP2\0', 'ascii');
export const MAX_CONTENIDO_LOCAL_STREAM_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_ARCHIVOS_LOCAL_STREAM = 500;
const ALGORITMO = 'aes-256-gcm';
const KDF = { nombre: 'scrypt', N: 32_768, r: 8, p: 1, longitud: 32 } as const;
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii');
const MAX_MANIFIESTO_BYTES = 1024 * 1024;
const TAMANO_CHUNK = 1024 * 1024;

type Entrada = { ruta: string; tamano: number; sha256: string; rutaOrigen: string };
type Manifiesto = {
  formato: typeof INSTANTANEA_LOCAL_FORMATO;
  version: 2;
  creadoEn: string;
  propietario: { correoHash: string; docenteId: string };
  origen: { rutaArtefactos: string };
  baseDatos: { nombre: 'evaluapro.db'; tamano: number; sha256: string };
  archivos: Array<{ ruta: string; tamano: number; sha256: string }>;
};
type Cabecera = {
  formato: typeof INSTANTANEA_LOCAL_FORMATO;
  version: 2;
  propietarioHash: string;
  creadoEn: string;
  kdf: { nombre: 'scrypt'; N: number; r: number; p: number };
  payload: { iv: string };
  claves: SobreClave[];
};
type DatosImportacion = { docenteId: string; rutaArchivo: string; metodo: MetodoDesbloqueoInstantanea; credencial?: string; dryRun: boolean; verificarAntesDeReemplazar?: () => Promise<void> };

function sha256Texto(valor: string) { return createHash('sha256').update(valor.trim().toLowerCase(), 'utf8').digest('hex'); }
function esSha256(valor: unknown): valor is string { return typeof valor === 'string' && /^[a-f0-9]{64}$/i.test(valor); }
function rutaRelativaSegura(valor: string) {
  const normalizada = path.posix.normalize(valor.replace(/\\/g, '/'));
  return normalizada !== '.' && normalizada !== '..' && !normalizada.startsWith('../') && !path.posix.isAbsolute(normalizada) && !/^[a-z]:/i.test(normalizada) && !normalizada.includes('\0');
}

async function sha256Archivo(ruta: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(ruta)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function listarArchivos(dir: string, prefijo = ''): Promise<string[]> {
  let entradas;
  try { entradas = await fs.readdir(dir, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return []; throw error; }
  const resultado: string[] = [];
  for (const entrada of entradas) {
    const relativa = prefijo ? path.join(prefijo, entrada.name) : entrada.name;
    if (entrada.isDirectory()) resultado.push(...await listarArchivos(path.join(dir, entrada.name), relativa));
    else if (entrada.isFile()) resultado.push(relativa);
  }
  return resultado.sort((a, b) => a.localeCompare(b));
}

async function* contenidoComprimible(manifiesto: Manifiesto, rutaDb: string, archivos: Entrada[]) {
  const manifiestoBytes = Buffer.from(JSON.stringify(manifiesto), 'utf8');
  if (manifiestoBytes.length > MAX_MANIFIESTO_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El manifiesto de la instantánea supera el tamaño permitido', 413);
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(manifiestoBytes.length);
  yield longitud;
  yield manifiestoBytes;
  for (const entrada of [{ ruta: 'evaluapro.db', rutaOrigen: rutaDb, tamano: manifiesto.baseDatos.tamano, sha256: manifiesto.baseDatos.sha256 }, ...archivos]) {
    const hash = createHash('sha256');
    let leidos = 0;
    for await (const chunk of createReadStream(entrada.rutaOrigen)) {
      const bytes = chunk as Buffer;
      leidos += bytes.length;
      hash.update(bytes);
      yield bytes;
    }
    if (leidos !== entrada.tamano || hash.digest('hex') !== entrada.sha256) throw new ErrorAplicacion('SYNC_ARCHIVO_CAMBIO', 'Un archivo cambió mientras se generaba la instantánea; vuelve a intentarlo', 409);
  }
}

export type ResultadoInstantaneaLocalStreaming = {
  rutaArchivo: string;
  checksumSha256: string;
  exportadoEn: string;
  tamanoArchivo: number;
  conteos: { baseDatosBytes: number; archivos: number; archivosBytes: number };
  metodos: MetodoDesbloqueoInstantanea[];
  limpiar: () => Promise<void>;
};

export async function exportarInstantaneaLocalStreaming(params: { docenteId: string; metodo: MetodoDesbloqueoInstantanea; credencial?: string }): Promise<ResultadoInstantaneaLocalStreaming> {
  const contexto = await obtenerContextoDocente(params.docenteId);
  await validarCredencialExportacion(contexto, params.metodo, params.credencial);
  const rutaBaseDatos = resolverRutaBaseDatos();
  await fs.access(rutaBaseDatos);
  const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-local-snapshot-stream-'));
  const rutaDb = path.join(temporal, 'evaluapro.db');
  const rutaSalida = path.join(temporal, 'evaluapro.ep-snapshot');
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${rutaDb.replace(/'/g, "''")}'`);
    const dbHandle = await fs.open(rutaDb, 'r');
    try {
      const firma = Buffer.alloc(SQLITE_HEADER.length);
      const { bytesRead } = await dbHandle.read(firma, 0, firma.length, 0);
      if (bytesRead !== firma.length || !firma.equals(SQLITE_HEADER)) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La copia local no tiene formato SQLite válido', 500);
    } finally { await dbHandle.close(); }
    const dbStat = await fs.stat(rutaDb);
    const dbHash = await sha256Archivo(rutaDb);
    const rutaArtefactos = resolverRutaArtefactos(rutaBaseDatos);
    const rutas = await listarArchivos(rutaArtefactos);
    if (rutas.length > MAX_ARCHIVOS_LOCAL_STREAM) throw new ErrorAplicacion('SYNC_DEMASIADOS_ARCHIVOS', 'La instantánea contiene demasiados archivos', 413);
    const archivos: Entrada[] = [];
    let archivosBytes = 0;
    for (const relativa of rutas) {
      if (!rutaRelativaSegura(relativa)) throw new ErrorAplicacion('SYNC_RUTA_INVALIDA', 'La instantánea contiene una ruta de archivo inválida', 400);
      const absoluta = path.join(rutaArtefactos, relativa);
      const stat = await fs.stat(absoluta);
      archivosBytes += stat.size;
      if (dbStat.size + archivosBytes > MAX_CONTENIDO_LOCAL_STREAM_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido de 2 GiB', 413);
      archivos.push({ ruta: relativa.replace(/\\/g, '/'), rutaOrigen: absoluta, tamano: stat.size, sha256: await sha256Archivo(absoluta) });
    }
    if (dbStat.size <= 0 || dbStat.size + archivosBytes > MAX_CONTENIDO_LOCAL_STREAM_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido de 2 GiB', 413);

    const creadoEn = new Date().toISOString();
    const propietarioHash = sha256Texto(contexto.correo);
    const manifiesto: Manifiesto = {
      formato: INSTANTANEA_LOCAL_FORMATO,
      version: 2,
      creadoEn,
      propietario: { correoHash: propietarioHash, docenteId: contexto.id },
      origen: { rutaArtefactos },
      baseDatos: { nombre: 'evaluapro.db', tamano: dbStat.size, sha256: dbHash },
      archivos: archivos.map(({ ruta, tamano, sha256 }) => ({ ruta, tamano, sha256 }))
    };
    const contentKey = randomBytes(32);
    const claves: SobreClave[] = [];
    if (params.metodo === 'contrasena') {
      const salt = randomBytes(16);
      claves.push(envolverClave(contentKey, derivarClavePassword(String(params.credencial), salt), 'contrasena', salt));
    } else {
      if (!contexto.googleSub) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La cuenta Google no está vinculada', 401);
      claves.push(envolverClave(contentKey, derivarClaveGoogle(contexto.googleSub), 'google'));
    }
    const iv = randomBytes(12);
    const cabecera: Cabecera = { formato: INSTANTANEA_LOCAL_FORMATO, version: 2, propietarioHash, creadoEn, kdf: { nombre: KDF.nombre, N: KDF.N, r: KDF.r, p: KDF.p }, payload: { iv: iv.toString('base64') }, claves };
    const cabeceraBytes = Buffer.from(JSON.stringify(cabecera), 'utf8');
    if (cabeceraBytes.length > 64 * 1024) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de la instantánea supera el tamaño permitido', 500);
    const longitudCabecera = Buffer.alloc(4);
    longitudCabecera.writeUInt32BE(cabeceraBytes.length);
    const prefijo = Buffer.concat([INSTANTANEA_LOCAL_STREAM_MAGIC, longitudCabecera, cabeceraBytes]);
    const cipher = createCipheriv(ALGORITMO, contentKey, iv);
    cipher.setAAD(prefijo);
    await fs.writeFile(rutaSalida, prefijo, { flag: 'wx' });
    await pipeline(
      Readable.from(contenidoComprimible(manifiesto, rutaDb, archivos)),
      createGzip(),
      cipher,
      createWriteStream(rutaSalida, { flags: 'a' })
    );
    await fs.appendFile(rutaSalida, cipher.getAuthTag());
    const tamanoArchivo = (await fs.stat(rutaSalida)).size;
    if (tamanoArchivo > MAX_CONTENIDO_LOCAL_STREAM_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'El archivo cifrado supera el límite de 2 GiB', 413);
    return {
      rutaArchivo: rutaSalida,
      checksumSha256: await sha256Archivo(rutaSalida),
      exportadoEn: creadoEn,
      tamanoArchivo,
      conteos: { baseDatosBytes: dbStat.size, archivos: archivos.length, archivosBytes },
      metodos: [params.metodo],
      limpiar: () => fs.rm(temporal, { recursive: true, force: true })
    };
  } catch (error) {
    await fs.rm(temporal, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

class LectorFlujo {
  private readonly iterador: AsyncIterator<Buffer>;
  private pendiente: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private terminado = false;

  constructor(flujo: AsyncIterable<Buffer | Uint8Array>) {
    this.iterador = (async function* () { for await (const parte of flujo) yield Buffer.from(parte); })()[Symbol.asyncIterator]();
  }

  private async llenar(minimo: number) {
    while (this.pendiente.length < minimo && !this.terminado) {
      const siguiente = await this.iterador.next();
      this.terminado = siguiente.done === true;
      if (!siguiente.done) this.pendiente = this.pendiente.length ? Buffer.concat([this.pendiente, siguiente.value]) : siguiente.value;
    }
  }

  async leerExacto(longitud: number) {
    if (!Number.isSafeInteger(longitud) || longitud < 0 || longitud > MAX_MANIFIESTO_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'Longitud de metadatos inválida', 400);
    await this.llenar(longitud);
    if (this.pendiente.length < longitud) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El contenido de la instantánea está incompleto', 400);
    const resultado = this.pendiente.subarray(0, longitud);
    this.pendiente = this.pendiente.subarray(longitud);
    return resultado;
  }

  async copiarExacto(longitud: number, destino: string, esperado: { tamano: number; sha256: string }) {
    if (!Number.isSafeInteger(longitud) || longitud < 0 || longitud !== esperado.tamano) throw new ErrorAplicacion('SYNC_ARCHIVO_INVALIDO', 'El tamaño de un archivo de la instantánea no es válido', 400);
    const salida = createWriteStream(destino, { flags: 'wx' });
    const hash = createHash('sha256');
    let restante = longitud;
    try {
      while (restante > 0) {
        if (this.pendiente.length === 0) await this.llenar(1);
        if (this.pendiente.length === 0) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El contenido de la instantánea está incompleto', 400);
        const tamano = Math.min(restante, this.pendiente.length, TAMANO_CHUNK);
        const chunk = this.pendiente.subarray(0, tamano);
        this.pendiente = this.pendiente.subarray(tamano);
        hash.update(chunk);
        if (!salida.write(chunk)) await once(salida, 'drain');
        restante -= tamano;
      }
      const finalizado = once(salida, 'finish');
      salida.end();
      await finalizado;
    } catch (error) {
      salida.destroy();
      await fs.rm(destino, { force: true }).catch(() => undefined);
      throw error;
    }
    if (hash.digest('hex') !== esperado.sha256) {
      await fs.rm(destino, { force: true });
      throw new ErrorAplicacion('SYNC_ARCHIVO_INVALIDO', 'Un archivo de la instantánea está dañado', 400);
    }
  }

  async confirmarFin() {
    await this.llenar(1);
    if (this.pendiente.length !== 0 || !this.terminado) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea contiene datos adicionales no válidos', 400);
  }
}

async function leerPrefijo(rutaArchivo: string) {
  const handle = await fs.open(rutaArchivo, 'r');
  try {
    const inicial = Buffer.alloc(12);
    let leidos = 0;
    while (leidos < inicial.length) {
      const resultado = await handle.read(inicial, leidos, inicial.length - leidos, leidos);
      if (resultado.bytesRead === 0) return null;
      leidos += resultado.bytesRead;
    }
    if (!inicial.subarray(0, 8).equals(INSTANTANEA_LOCAL_STREAM_MAGIC)) return null;
    const longitud = inicial.readUInt32BE(8);
    if (longitud < 2 || longitud > 64 * 1024) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de la instantánea no es válida', 400);
    const json = Buffer.alloc(longitud);
    let leidosJson = 0;
    while (leidosJson < longitud) {
      const resultado = await handle.read(json, leidosJson, longitud - leidosJson, 12 + leidosJson);
      if (resultado.bytesRead === 0) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de la instantánea está incompleta', 400);
      leidosJson += resultado.bytesRead;
    }
    let cabecera: Cabecera;
    try { cabecera = JSON.parse(json.toString('utf8')) as Cabecera; } catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de la instantánea no es válida', 400); }
    const prefijo = Buffer.concat([inicial, json]);
    return { cabecera, prefijo, inicioCifrado: prefijo.length };
  } finally { await handle.close(); }
}

function validarManifiesto(valor: unknown): asserts valor is Manifiesto {
  const m = valor as Manifiesto;
  if (!m || typeof m !== 'object' || m.formato !== INSTANTANEA_LOCAL_FORMATO || m.version !== 2 || typeof m.creadoEn !== 'string' || !m.propietario || typeof m.propietario.docenteId !== 'string' || !esSha256(m.propietario.correoHash) || !m.origen || typeof m.origen.rutaArtefactos !== 'string' || !m.baseDatos || m.baseDatos.nombre !== 'evaluapro.db' || !Number.isSafeInteger(m.baseDatos.tamano) || m.baseDatos.tamano <= 0 || !esSha256(m.baseDatos.sha256) || !Array.isArray(m.archivos) || m.archivos.length > MAX_ARCHIVOS_LOCAL_STREAM) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El manifiesto de la instantánea no tiene una estructura válida', 400);
  let total = m.baseDatos.tamano;
  for (const archivo of m.archivos) {
    if (!archivo || typeof archivo.ruta !== 'string' || !rutaRelativaSegura(archivo.ruta) || !Number.isSafeInteger(archivo.tamano) || archivo.tamano < 0 || !esSha256(archivo.sha256)) throw new ErrorAplicacion('SYNC_RUTA_INVALIDA', 'La instantánea contiene una ruta o metadatos inválidos', 400);
    total += archivo.tamano;
    if (!Number.isSafeInteger(total) || total > MAX_CONTENIDO_LOCAL_STREAM_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido de 2 GiB', 413);
  }
}

async function comprobarCredencial(contexto: ContextoDocente, metodo: MetodoDesbloqueoInstantanea, credencial?: string) {
  if (!credencial) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial no corresponde a la cuenta docente', 401);
  if (metodo === 'contrasena') {
    if (!contexto.hashContrasena || !(await compararContrasena(credencial, contexto.hashContrasena))) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial no corresponde a la cuenta docente', 401);
    return;
  }
  if (!contexto.googleSub) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial no corresponde a la cuenta docente', 401);
  const perfil = await verificarCredencialGoogle(credencial);
  if (perfil.sub !== contexto.googleSub || perfil.correo.trim().toLowerCase() !== contexto.correo.trim().toLowerCase()) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial no corresponde a la cuenta docente', 401);
}

function desenvolverClaveV2(cabecera: Cabecera, contexto: ContextoDocente, metodo: MetodoDesbloqueoInstantanea, credencial: string) {
  const sobre = cabecera.claves.find((clave) => clave.metodo === metodo);
  if (!sobre) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La instantánea no ofrece ese método de desbloqueo', 401);
  if (metodo === 'contrasena') {
    const salt = Buffer.from(String(sobre.salt || ''), 'base64');
    if (salt.length !== 16) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea contiene una sal inválida', 400);
    return desenvolverClave(sobre, derivarClavePassword(credencial, salt));
  }
  if (!contexto.googleSub) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La cuenta Google no está vinculada', 401);
  return desenvolverClave(sobre, derivarClaveGoogle(contexto.googleSub));
}

async function prepararContenidoV2(rutaArchivo: string, contexto: ContextoDocente, metodo: MetodoDesbloqueoInstantanea, credencial: string) {
  const cabeceraInfo = await leerPrefijo(rutaArchivo);
  if (!cabeceraInfo) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El archivo no tiene el formato streaming EvaluaPro', 400);
  const { cabecera, prefijo, inicioCifrado } = cabeceraInfo;
  const stat = await fs.stat(rutaArchivo);
  if (stat.size < inicioCifrado + 16 || stat.size > MAX_CONTENIDO_LOCAL_STREAM_BYTES + 2 * 1024 * 1024) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido', 413);
  if (cabecera.formato !== INSTANTANEA_LOCAL_FORMATO || cabecera.version !== 2 || cabecera.kdf?.nombre !== KDF.nombre || cabecera.kdf.N !== KDF.N || cabecera.kdf.r !== KDF.r || cabecera.kdf.p !== KDF.p || !esSha256(cabecera.propietarioHash) || !Array.isArray(cabecera.claves) || cabecera.claves.length < 1 || cabecera.claves.length > 2) throw new ErrorAplicacion('SYNC_INSTANTANEA_VERSION', 'La versión de la instantánea no es compatible', 400);
  const iv = Buffer.from(cabecera.payload?.iv || '', 'base64');
  if (iv.length !== 12) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea contiene un nonce inválido', 400);
  await comprobarCredencial(contexto, metodo, credencial);
  const contentKey = desenvolverClaveV2(cabecera, contexto, metodo, credencial);
  const tagHandle = await fs.open(rutaArchivo, 'r');
  const authTag = Buffer.alloc(16);
  try {
    const lectura = await tagHandle.read(authTag, 0, authTag.length, stat.size - authTag.length);
    if (lectura.bytesRead !== authTag.length) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea está incompleta', 400);
  } finally { await tagHandle.close(); }
  const decipher = createDecipheriv(ALGORITMO, contentKey, iv);
  decipher.setAAD(prefijo);
  decipher.setAuthTag(authTag);
  const comprimido = new PassThrough();
  void pipeline(createReadStream(rutaArchivo, { start: inicioCifrado, end: stat.size - 17 }), decipher, createGunzip(), comprimido)
    .catch((error: unknown) => comprimido.destroy(error instanceof Error ? error : new Error('No se pudo validar la instantánea')));
  const lector = new LectorFlujo(comprimido);
  const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-local-snapshot-stream-import-'));
  const rutaDb = path.join(temporal, 'evaluapro.db');
  const rutaExamenes = path.join(temporal, 'examenes');
  try {
    const longitudManifiesto = (await lector.leerExacto(4)).readUInt32BE(0);
    if (longitudManifiesto < 2 || longitudManifiesto > MAX_MANIFIESTO_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El manifiesto de la instantánea supera el tamaño permitido', 400);
    let manifiesto: Manifiesto;
    try { manifiesto = JSON.parse((await lector.leerExacto(longitudManifiesto)).toString('utf8')) as Manifiesto; }
    catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El manifiesto de la instantánea no es válido', 400); }
    validarManifiesto(manifiesto);
    const correoHash = sha256Texto(contexto.correo);
    if (manifiesto.propietario.correoHash !== correoHash || cabecera.propietarioHash !== correoHash || manifiesto.propietario.docenteId !== contexto.id) throw new ErrorAplicacion('SYNC_PROPIETARIO_INVALIDO', 'La instantánea no corresponde a la cuenta docente autenticada', 403);
    await fs.mkdir(rutaExamenes, { recursive: true });
    if (manifiesto.baseDatos.tamano < SQLITE_HEADER.length) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La base SQLite de la instantánea está incompleta', 400);
    await lector.copiarExacto(manifiesto.baseDatos.tamano, rutaDb, manifiesto.baseDatos);
    const dbHandle = await fs.open(rutaDb, 'r');
    try {
      const firma = Buffer.alloc(SQLITE_HEADER.length);
      const lectura = await dbHandle.read(firma, 0, firma.length, 0);
      if (lectura.bytesRead !== firma.length || !firma.equals(SQLITE_HEADER)) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La base SQLite de la instantánea está dañada', 400);
    } finally { await dbHandle.close(); }
    for (const archivo of manifiesto.archivos) {
      const destino = path.join(rutaExamenes, archivo.ruta);
      if (!rutaRelativaSegura(path.relative(rutaExamenes, destino))) throw new ErrorAplicacion('SYNC_RUTA_INVALIDA', 'La instantánea contiene una ruta inválida', 400);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await lector.copiarExacto(archivo.tamano, destino, archivo);
    }
    await lector.confirmarFin();
    await validarIntegridadSqlite(rutaDb, manifiesto.propietario.docenteId, contexto.correo);
    return { cabecera, prefijo, manifiesto, temporal, rutaDb, rutaExamenes, checksumSha256: await sha256Archivo(rutaArchivo) };
  } catch (error) {
    await fs.rm(temporal, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function aplicarReemplazo(params: { preparado: { temporal: string; rutaDb: string; rutaExamenes: string }; manifiesto: Manifiesto; checksumSha256: string; verificarAntesDeReemplazar?: () => Promise<void> }) {
  const { preparado, manifiesto } = params;
  const rutaDb = resolverRutaBaseDatos();
  const rutaExamenes = resolverRutaArtefactos(rutaDb);
  const respaldoRaiz = path.join(path.dirname(rutaDb), 'backups', 'sincronizacion-local', new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-'));
  const respaldoExamenes = path.join(respaldoRaiz, 'examenes');
  let dbRespaldada = false;
  let examenesRespaldados = false;
  try {
    await params.verificarAntesDeReemplazar?.();
    await fs.mkdir(respaldoRaiz, { recursive: true });
    await desconectarSqlite();
    try { await fs.rename(rutaDb, path.join(respaldoRaiz, 'evaluapro.db')); dbRespaldada = true; } catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; }
    try { await fs.rename(rutaExamenes, respaldoExamenes); examenesRespaldados = true; } catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; }
    await fs.rename(preparado.rutaDb, rutaDb);
    await fs.rename(preparado.rutaExamenes, rutaExamenes);
    await conectarSqlite();
    const columnas = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info('examenes_generados')");
    if (columnas.some((columna) => columna.name === 'rutaPdf')) {
      const origen = path.normalize(manifiesto.origen.rutaArtefactos);
      await prisma.$executeRawUnsafe('UPDATE examenes_generados SET rutaPdf = REPLACE(rutaPdf, ?, ?) WHERE rutaPdf LIKE ?', origen, path.normalize(rutaExamenes), `${origen}%`);
    }
    await fs.rm(preparado.temporal, { recursive: true, force: true });
    return { mensaje: 'Instantánea importada 1:1. Cierra y vuelve a iniciar sesión para recargar la cuenta.', checksumSha256: params.checksumSha256, requiereReinicioSesion: true, respaldo: respaldoRaiz, conteos: { baseDatosBytes: manifiesto.baseDatos.tamano, archivos: manifiesto.archivos.length, archivosBytes: manifiesto.archivos.reduce((suma, archivo) => suma + archivo.tamano, 0) } };
  } catch (error) {
    await desconectarSqlite().catch(() => undefined);
    await fs.rm(rutaDb, { force: true }).catch(() => undefined);
    await fs.rm(rutaExamenes, { recursive: true, force: true }).catch(() => undefined);
    if (dbRespaldada) await fs.rename(path.join(respaldoRaiz, 'evaluapro.db'), rutaDb).catch(() => undefined);
    if (examenesRespaldados) await fs.rename(respaldoExamenes, rutaExamenes).catch(() => undefined);
    await conectarSqlite().catch(() => undefined);
    await fs.rm(preparado.temporal, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function importarInstantaneaLocalDesdeArchivo(params: DatosImportacion) {
  const prefijo = await leerPrefijo(params.rutaArchivo);
  if (!prefijo) {
    const stat = await fs.stat(params.rutaArchivo);
    if (stat.size > 65 * 1024 * 1024) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea v1 supera el límite de 65 MiB', 413);
    const { importarInstantaneaLocal } = await import('./instantaneaLocal.js');
    return importarInstantaneaLocal({ docenteId: params.docenteId, archivo: await fs.readFile(params.rutaArchivo), metodo: params.metodo, credencial: params.credencial, dryRun: params.dryRun, verificarAntesDeReemplazar: params.verificarAntesDeReemplazar });
  }
  const contexto = await obtenerContextoDocente(params.docenteId);
  const preparado = await prepararContenidoV2(params.rutaArchivo, contexto, params.metodo, params.credencial || '');
  if (params.dryRun) {
    await fs.rm(preparado.temporal, { recursive: true, force: true });
    return { mensaje: 'Instantánea válida', checksumSha256: preparado.checksumSha256, conteos: { baseDatosBytes: preparado.manifiesto.baseDatos.tamano, archivos: preparado.manifiesto.archivos.length, archivosBytes: preparado.manifiesto.archivos.reduce((suma, archivo) => suma + archivo.tamano, 0) } };
  }
  return aplicarReemplazo({ preparado, manifiesto: preparado.manifiesto, checksumSha256: preparado.checksumSha256, verificarAntesDeReemplazar: params.verificarAntesDeReemplazar });
}
