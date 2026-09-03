/**
 * Instantanea local 1:1 de EvaluaPro.
 *
 * Responsabilidad: transportar la base SQLite canonica y los artefactos
 * generados por el docente en un unico archivo cifrado y autenticado.
 * Limites: no incluye .env, logs, cache WebView2, binarios ni datos del portal.
 */
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { configuracion } from '../../../configuracion';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { prisma, conectarSqlite, desconectarSqlite } from '../../../infraestructura/baseDatos/sqlite';
import { compararContrasena } from '../../modulo_autenticacion/servicioHash';
import { verificarCredencialGoogle } from '../../modulo_autenticacion/servicioGoogle';

export const INSTANTANEA_LOCAL_FORMATO = 'evaluapro-local-snapshot';
export const INSTANTANEA_LOCAL_VERSION = 1;
export const MAX_CONTENIDO_LOCAL_BYTES = 45 * 1024 * 1024;
// El sobre JSON usa Base64; se reserva margen para esa expansión.
export const MAX_INSTANTANEA_LOCAL_BYTES = 65 * 1024 * 1024;

const ALGORITMO = 'aes-256-gcm';
const KDF = { nombre: 'scrypt', N: 32_768, r: 8, p: 1, longitud: 32 } as const;
const MAX_ARCHIVOS = 500;
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii');

export type MetodoDesbloqueoInstantanea = 'contrasena' | 'google';

type ArchivoInstantanea = {
  ruta: string;
  tamano: number;
  sha256: string;
  contenidoBase64: string;
};

type ContenidoInstantanea = {
  formato: typeof INSTANTANEA_LOCAL_FORMATO;
  version: typeof INSTANTANEA_LOCAL_VERSION;
  creadoEn: string;
  propietario: { correoHash: string; docenteId: string };
  origen: { rutaArtefactos: string };
  baseDatos: { nombre: string; tamano: number; sha256: string; contenidoBase64: string };
  archivos: ArchivoInstantanea[];
};

type SobreClave = {
  metodo: MetodoDesbloqueoInstantanea;
  salt?: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type SobreInstantanea = {
  formato: typeof INSTANTANEA_LOCAL_FORMATO;
  version: typeof INSTANTANEA_LOCAL_VERSION;
  propietarioHash: string;
  creadoEn: string;
  kdf: typeof KDF;
  payload: { iv: string; authTag: string; ciphertext: string };
  claves: SobreClave[];
};

export type ResultadoInstantaneaLocal = {
  archivo: Buffer;
  checksumSha256: string;
  exportadoEn: string;
  conteos: { baseDatosBytes: number; archivos: number; archivosBytes: number };
  metodos: MetodoDesbloqueoInstantanea[];
};

type ContextoDocente = { id: string; correo: string; hashContrasena: string | null; googleSub: string | null };

function errorCredencial() {
  return new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial no corresponde a la cuenta docente', 401);
}

function normalizarCorreo(correo: string) {
  return correo.trim().toLowerCase();
}

function sha256Buffer(valor: Buffer) {
  return createHash('sha256').update(valor).digest('hex');
}

function sha256Texto(valor: string) {
  return sha256Buffer(Buffer.from(valor, 'utf8'));
}

function decodificarBase64(valor: unknown, permitirVacio = false): Buffer | null {
  if (typeof valor !== 'string' || (!permitirVacio && valor.length === 0) || valor.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(valor)) return null;
  const bytes = Buffer.from(valor, 'base64');
  const canonico = bytes.toString('base64').replace(/=+$/, '');
  const recibido = valor.replace(/=+$/, '');
  return canonico === recibido ? bytes : null;
}

function esSha256(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[a-f0-9]{64}$/i.test(valor);
}

function resolverRutaBaseDatos(): string {
  const valor = String(process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!valor.startsWith('file:')) throw new ErrorAplicacion('SYNC_SQLITE_NO_CONFIGURADO', 'La base SQLite local no está configurada', 503);
  return path.resolve(decodeURIComponent(valor.slice(5)));
}

function resolverRutaArtefactos(rutaBaseDatos: string) {
  return path.join(path.dirname(rutaBaseDatos), 'examenes');
}

function rutaRelativaSegura(ruta: string) {
  const normalizada = path.posix.normalize(ruta.replace(/\\/g, '/'));
  return normalizada !== '.' && normalizada !== '..' && !normalizada.startsWith('../') && !path.posix.isAbsolute(normalizada);
}

async function listarArchivos(dir: string, prefijo = ''): Promise<string[]> {
  let entradas;
  try {
    entradas = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw error;
  }
  const resultado: string[] = [];
  for (const entrada of entradas) {
    const relativa = prefijo ? path.join(prefijo, entrada.name) : entrada.name;
    if (entrada.isDirectory()) resultado.push(...(await listarArchivos(path.join(dir, entrada.name), relativa)));
    else if (entrada.isFile()) resultado.push(relativa);
  }
  return resultado;
}

function derivarClavePassword(contrasena: string, salt: Buffer) {
  return scryptSync(contrasena, salt, KDF.longitud, { N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 128 * 1024 * 1024 });
}

function derivarClaveGoogle(googleSub: string) {
  const secreto = String(configuracion.respaldoCifradoSecreto || '').trim();
  if (!secreto || (configuracion.entorno === 'production' && !String(process.env.EVALUAPRO_BACKUP_CIFRADO_SECRETO || '').trim())) {
    throw new ErrorAplicacion('SYNC_GOOGLE_NO_CONFIGURADO', 'La sincronización con Google requiere EVALUAPRO_BACKUP_CIFRADO_SECRETO compartido entre equipos', 503);
  }
  return scryptSync(secreto, `EvaluaPro:local-snapshot:google:${googleSub}`, KDF.longitud, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function cifrarGcm(plain: Buffer, clave: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), ciphertext };
}

function descifrarGcm(cifrado: { iv: Buffer; authTag: Buffer; ciphertext: Buffer }, clave: Buffer, aad: Buffer) {
  try {
    const decipher = createDecipheriv(ALGORITMO, clave, cifrado.iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(cifrado.authTag);
    return Buffer.concat([decipher.update(cifrado.ciphertext), decipher.final()]);
  } catch {
    throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea no pudo autenticarse; puede estar corrupta o alterada', 400);
  }
}

function envolverClave(contentKey: Buffer, clave: Buffer, metodo: MetodoDesbloqueoInstantanea, salt?: Buffer): SobreClave {
  const cifrado = cifrarGcm(contentKey, clave, Buffer.from(`EvaluaPro:${INSTANTANEA_LOCAL_FORMATO}:key:${metodo}`, 'utf8'));
  return {
    metodo,
    ...(salt ? { salt: salt.toString('base64') } : {}),
    iv: cifrado.iv.toString('base64'),
    authTag: cifrado.authTag.toString('base64'),
    ciphertext: cifrado.ciphertext.toString('base64')
  };
}

function desenvolverClave(sobre: SobreClave, clave: Buffer) {
  return descifrarGcm(
    { iv: Buffer.from(sobre.iv, 'base64'), authTag: Buffer.from(sobre.authTag, 'base64'), ciphertext: Buffer.from(sobre.ciphertext, 'base64') },
    clave,
    Buffer.from(`EvaluaPro:${INSTANTANEA_LOCAL_FORMATO}:key:${sobre.metodo}`, 'utf8')
  );
}

async function obtenerContextoDocente(docenteId: string): Promise<ContextoDocente> {
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { id: true, correo: true, hashContrasena: true, googleSub: true } });
  if (!docente) throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'No se encontró la cuenta docente', 404);
  return docente;
}

async function validarCredencialExportacion(contexto: ContextoDocente, metodo: MetodoDesbloqueoInstantanea, credencial?: string) {
  if (metodo === 'contrasena') {
    if (!credencial || !contexto.hashContrasena || !(await compararContrasena(credencial, contexto.hashContrasena))) throw errorCredencial();
    return;
  }
  if (!contexto.googleSub || !credencial) throw errorCredencial();
  const perfil = await verificarCredencialGoogle(credencial);
  if (perfil.sub !== contexto.googleSub || normalizarCorreo(perfil.correo) !== normalizarCorreo(contexto.correo)) throw errorCredencial();
  derivarClaveGoogle(contexto.googleSub);
}

async function crearCopiaSqlite(): Promise<{ ruta: string; contenido: Buffer }> {
  const rutaBaseDatos = resolverRutaBaseDatos();
  await fs.access(rutaBaseDatos);
  const rutaTemporal = path.join(path.dirname(rutaBaseDatos), `.evaluapro-snapshot-${randomBytes(12).toString('hex')}.db`);
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${rutaTemporal.replace(/'/g, "''")}'`);
    return { ruta: rutaBaseDatos, contenido: await fs.readFile(rutaTemporal) };
  } finally {
    await fs.rm(rutaTemporal, { force: true }).catch(() => undefined);
  }
}

export async function exportarInstantaneaLocal(params: { docenteId: string; metodo: MetodoDesbloqueoInstantanea; credencial?: string }): Promise<ResultadoInstantaneaLocal> {
  const contexto = await obtenerContextoDocente(params.docenteId);
  await validarCredencialExportacion(contexto, params.metodo, params.credencial);
  const copia = await crearCopiaSqlite();
  if (!copia.contenido.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La copia local no tiene formato SQLite válido', 500);
  if (copia.contenido.length > MAX_CONTENIDO_LOCAL_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La SQLite supera el límite permitido para la instantánea', 413);

  const rutas = await listarArchivos(resolverRutaArtefactos(copia.ruta));
  if (rutas.length > MAX_ARCHIVOS) throw new ErrorAplicacion('SYNC_DEMASIADOS_ARCHIVOS', 'La instantánea contiene demasiados archivos', 413);
  const archivos: ArchivoInstantanea[] = [];
  let archivosBytes = 0;
  for (const relativa of rutas) {
    const bytes = await fs.readFile(path.join(resolverRutaArtefactos(copia.ruta), relativa));
    archivosBytes += bytes.length;
    if (archivosBytes + copia.contenido.length > MAX_CONTENIDO_LOCAL_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido', 413);
    archivos.push({ ruta: relativa.replace(/\\/g, '/'), tamano: bytes.length, sha256: sha256Buffer(bytes), contenidoBase64: bytes.toString('base64') });
  }

  const creadoEn = new Date().toISOString();
  const contenido: ContenidoInstantanea = {
    formato: INSTANTANEA_LOCAL_FORMATO,
    version: INSTANTANEA_LOCAL_VERSION,
    creadoEn,
    propietario: { correoHash: sha256Texto(normalizarCorreo(contexto.correo)), docenteId: contexto.id },
    origen: { rutaArtefactos: resolverRutaArtefactos(copia.ruta) },
    baseDatos: { nombre: 'evaluapro.db', tamano: copia.contenido.length, sha256: sha256Buffer(copia.contenido), contenidoBase64: copia.contenido.toString('base64') },
    archivos
  };
  const contentKey = randomBytes(32);
  const payload = cifrarGcm(gzipSync(Buffer.from(JSON.stringify(contenido), 'utf8')), contentKey, Buffer.from(`${INSTANTANEA_LOCAL_FORMATO}:payload:v${INSTANTANEA_LOCAL_VERSION}`, 'utf8'));
  const claves: SobreClave[] = [];
  if (params.metodo === 'contrasena') {
    const salt = randomBytes(16);
    claves.push(envolverClave(contentKey, derivarClavePassword(String(params.credencial), salt), 'contrasena', salt));
  } else {
    claves.push(envolverClave(contentKey, derivarClaveGoogle(String(contexto.googleSub)), 'google'));
  }
  const sobre: SobreInstantanea = {
    formato: INSTANTANEA_LOCAL_FORMATO,
    version: INSTANTANEA_LOCAL_VERSION,
    propietarioHash: contenido.propietario.correoHash,
    creadoEn,
    kdf: KDF,
    payload: { iv: payload.iv.toString('base64'), authTag: payload.authTag.toString('base64'), ciphertext: payload.ciphertext.toString('base64') },
    claves
  };
  const archivo = Buffer.from(JSON.stringify(sobre), 'utf8');
  return { archivo, checksumSha256: sha256Buffer(archivo), exportadoEn: creadoEn, conteos: { baseDatosBytes: copia.contenido.length, archivos: archivos.length, archivosBytes }, metodos: claves.map((item) => item.metodo) };
}

function parsearSobre(archivo: Buffer): SobreInstantanea {
  if (archivo.length === 0 || archivo.length > MAX_INSTANTANEA_LOCAL_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido', 413);
  let sobre: SobreInstantanea;
  try { sobre = JSON.parse(archivo.toString('utf8')) as SobreInstantanea; } catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El archivo no es una instantánea EvaluaPro válida', 400); }
  if (!sobre || typeof sobre !== 'object' || sobre.formato !== INSTANTANEA_LOCAL_FORMATO || sobre.version !== INSTANTANEA_LOCAL_VERSION || !Array.isArray(sobre.claves) || sobre.claves.length === 0 || sobre.claves.length > 2 || sobre.kdf?.nombre !== KDF.nombre || Number(sobre.kdf.N) !== KDF.N || Number(sobre.kdf.r) !== KDF.r || Number(sobre.kdf.p) !== KDF.p) throw new ErrorAplicacion('SYNC_INSTANTANEA_VERSION', 'La versión de la instantánea no es compatible', 400);
  const payloadIv = decodificarBase64(sobre.payload?.iv);
  const payloadTag = decodificarBase64(sobre.payload?.authTag);
  const payloadCiphertext = decodificarBase64(sobre.payload?.ciphertext);
  if (!payloadIv || payloadIv.length !== 12 || !payloadTag || payloadTag.length !== 16 || !payloadCiphertext || payloadCiphertext.length === 0 || !esSha256(sobre.propietarioHash)) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea está incompleta o tiene metadatos inválidos', 400);
  const metodos = new Set<string>();
  for (const clave of sobre.claves) {
    if (!clave || (clave.metodo !== 'contrasena' && clave.metodo !== 'google') || metodos.has(clave.metodo)) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea contiene envolturas de clave inválidas', 400);
    metodos.add(clave.metodo);
    const iv = decodificarBase64(clave.iv);
    const authTag = decodificarBase64(clave.authTag);
    const ciphertext = decodificarBase64(clave.ciphertext);
    if (!iv || iv.length !== 12 || !authTag || authTag.length !== 16 || !ciphertext || ciphertext.length === 0) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea contiene una clave cifrada inválida', 400);
    if (clave.metodo === 'contrasena') {
      const salt = decodificarBase64(clave.salt);
      if (!salt || salt.length !== 16) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea tiene una sal de contraseña inválida', 400);
    }
  }
  return sobre;
}

async function abrirInstantanea(archivo: Buffer, contexto: ContextoDocente, metodo: MetodoDesbloqueoInstantanea, credencial?: string): Promise<{ contenido: ContenidoInstantanea; checksumSha256: string }> {
  const sobre = parsearSobre(archivo);
  const claveSobre = sobre.claves.find((item) => item.metodo === metodo);
  if (!claveSobre) throw errorCredencial();
  let claveCuenta: Buffer;
  if (metodo === 'contrasena') {
    if (!credencial || !contexto.hashContrasena || !(await compararContrasena(credencial, contexto.hashContrasena))) throw errorCredencial();
    const salt = Buffer.from(String(claveSobre.salt || ''), 'base64');
    if (salt.length !== 16) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La instantánea tiene una sal de cifrado inválida', 400);
    claveCuenta = derivarClavePassword(credencial, salt);
  } else {
    if (!contexto.googleSub || !credencial) throw errorCredencial();
    const perfil = await verificarCredencialGoogle(credencial);
    if (perfil.sub !== contexto.googleSub || normalizarCorreo(perfil.correo) !== normalizarCorreo(contexto.correo)) throw errorCredencial();
    claveCuenta = derivarClaveGoogle(contexto.googleSub);
  }
  const contentKey = desenvolverClave(claveSobre, claveCuenta);
  let plain: Buffer;
  try {
    plain = gunzipSync(descifrarGcm({ iv: Buffer.from(sobre.payload.iv, 'base64'), authTag: Buffer.from(sobre.payload.authTag, 'base64'), ciphertext: Buffer.from(sobre.payload.ciphertext, 'base64') }, contentKey, Buffer.from(`${INSTANTANEA_LOCAL_FORMATO}:payload:v${INSTANTANEA_LOCAL_VERSION}`, 'utf8')));
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El contenido comprimido de la instantánea no es válido', 400);
  }
  if (plain.length > MAX_CONTENIDO_LOCAL_BYTES * 2) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'El contenido descomprimido supera el límite permitido', 413);
  let contenido: ContenidoInstantanea;
  try { contenido = JSON.parse(plain.toString('utf8')) as ContenidoInstantanea; } catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El contenido de la instantánea no es válido', 400); }
  if (!contenido || typeof contenido !== 'object' || contenido.formato !== INSTANTANEA_LOCAL_FORMATO || contenido.version !== INSTANTANEA_LOCAL_VERSION || !contenido.propietario || typeof contenido.propietario.docenteId !== 'string' || contenido.propietario.docenteId.length === 0 || typeof contenido.propietario.correoHash !== 'string' || !esSha256(contenido.propietario.correoHash) || !contenido.origen || typeof contenido.origen.rutaArtefactos !== 'string' || contenido.origen.rutaArtefactos.length === 0 || !contenido.baseDatos || contenido.baseDatos.nombre !== 'evaluapro.db' || typeof contenido.baseDatos.tamano !== 'number' || !Number.isSafeInteger(contenido.baseDatos.tamano) || contenido.baseDatos.tamano <= 0 || !esSha256(contenido.baseDatos.sha256) || !Array.isArray(contenido.archivos)) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El contenido de la instantánea no tiene una estructura válida', 400);
  if (contenido.propietario.correoHash !== sha256Texto(normalizarCorreo(contexto.correo)) || sobre.propietarioHash !== contenido.propietario.correoHash) throw new ErrorAplicacion('SYNC_PROPIETARIO_INVALIDO', 'La instantánea no corresponde a la cuenta docente autenticada', 403);
  if (contenido.propietario.docenteId !== contexto.id) throw new ErrorAplicacion('SYNC_PROPIETARIO_INVALIDO', 'La instantánea no corresponde a la cuenta docente autenticada', 403);
  const baseDatos = decodificarBase64(contenido.baseDatos.contenidoBase64);
  if (!baseDatos) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La base SQLite de la instantánea está dañada', 400);
  if (baseDatos.length !== contenido.baseDatos.tamano || sha256Buffer(baseDatos) !== contenido.baseDatos.sha256 || !baseDatos.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La base SQLite de la instantánea está dañada', 400);
  if (!Array.isArray(contenido.archivos) || contenido.archivos.length > MAX_ARCHIVOS) throw new ErrorAplicacion('SYNC_DEMASIADOS_ARCHIVOS', 'La instantánea contiene demasiados archivos', 413);
  let archivosBytes = 0;
  for (const archivoItem of contenido.archivos) {
    if (!archivoItem || typeof archivoItem.ruta !== 'string' || !rutaRelativaSegura(archivoItem.ruta) || !Number.isSafeInteger(archivoItem.tamano) || archivoItem.tamano < 0 || !esSha256(archivoItem.sha256)) throw new ErrorAplicacion('SYNC_RUTA_INVALIDA', 'La instantánea contiene metadatos de archivo inválidos', 400);
    const bytes = decodificarBase64(archivoItem.contenidoBase64, true);
    if (!bytes) throw new ErrorAplicacion('SYNC_ARCHIVO_INVALIDO', 'Un archivo de la instantánea tiene contenido Base64 inválido', 400);
    if (bytes.length !== archivoItem.tamano || sha256Buffer(bytes) !== archivoItem.sha256) throw new ErrorAplicacion('SYNC_ARCHIVO_INVALIDO', 'Un archivo de la instantánea está dañado', 400);
    archivosBytes += bytes.length;
    if (baseDatos.length + archivosBytes > MAX_CONTENIDO_LOCAL_BYTES) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite permitido', 413);
  }
  return { contenido, checksumSha256: sha256Buffer(archivo) };
}

async function validarIntegridadSqlite(ruta: string, docenteIdEsperado: string, correoEsperado: string) {
  const cliente = new PrismaClient({ datasources: { db: { url: `file:${ruta.replace(/\\/g, '/')}` } } });
  try {
    const resultado = await cliente.$queryRawUnsafe<Array<{ integrity_check: string }>>('PRAGMA integrity_check');
    if (String(resultado?.[0]?.integrity_check || '').toLowerCase() !== 'ok') throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La base SQLite no pasó la comprobación de integridad', 400);
    const docentes = await cliente.$queryRawUnsafe<Array<{ id: string; correo: string }>>('SELECT id, correo FROM docentes');
    if (docentes.length === 0) throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'La instantánea no contiene una cuenta docente', 400);
    if (!docentes.some((docente) => String(docente.id || '') === docenteIdEsperado && normalizarCorreo(String(docente.correo || '')) === normalizarCorreo(correoEsperado))) throw new ErrorAplicacion('SYNC_PROPIETARIO_INVALIDO', 'La base SQLite no corresponde a la cuenta docente autenticada', 403);
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('SYNC_SQLITE_INVALIDO', 'No se pudo comprobar la integridad de la base SQLite', 400);
  } finally { await cliente.$disconnect(); }
}

async function prepararContenido(contenido: ContenidoInstantanea, correoEsperado: string) {
  const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-local-snapshot-'));
  const rutaDb = path.join(temporal, 'evaluapro.db');
  const rutaExamenes = path.join(temporal, 'examenes');
  try {
    await fs.mkdir(rutaExamenes, { recursive: true });
    await fs.writeFile(rutaDb, Buffer.from(contenido.baseDatos.contenidoBase64, 'base64'), { flag: 'wx' });
    for (const archivo of contenido.archivos) {
      const destino = path.join(rutaExamenes, archivo.ruta);
      if (!rutaRelativaSegura(path.relative(rutaExamenes, destino))) throw new ErrorAplicacion('SYNC_RUTA_INVALIDA', 'La instantánea contiene una ruta de archivo inválida', 400);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, Buffer.from(archivo.contenidoBase64, 'base64'), { flag: 'wx' });
    }
    await validarIntegridadSqlite(rutaDb, contenido.propietario.docenteId, correoEsperado);
    return { temporal, rutaDb, rutaExamenes };
  } catch (error) {
    await fs.rm(temporal, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function conteos(contenido: ContenidoInstantanea) {
  return { baseDatosBytes: contenido.baseDatos.tamano, archivos: contenido.archivos.length, archivosBytes: contenido.archivos.reduce((suma, item) => suma + item.tamano, 0) };
}

export async function importarInstantaneaLocal(params: { docenteId: string; archivo: Buffer; metodo: MetodoDesbloqueoInstantanea; credencial?: string; dryRun: boolean; verificarAntesDeReemplazar?: () => Promise<void> }) {
  const contexto = await obtenerContextoDocente(params.docenteId);
  const abierta = await abrirInstantanea(params.archivo, contexto, params.metodo, params.credencial);
  const preparado = await prepararContenido(abierta.contenido, contexto.correo);
  if (params.dryRun) {
    await fs.rm(preparado.temporal, { recursive: true, force: true });
    return { mensaje: 'Instantánea válida', checksumSha256: abierta.checksumSha256, conteos: conteos(abierta.contenido) };
  }

  try {
    await params.verificarAntesDeReemplazar?.();
  } catch (error) {
    await fs.rm(preparado.temporal, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  const rutaDb = resolverRutaBaseDatos();
  const rutaExamenes = resolverRutaArtefactos(rutaDb);
  const respaldoRaiz = path.join(path.dirname(rutaDb), 'backups', 'sincronizacion-local', new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-'));
  const respaldoExamenes = path.join(respaldoRaiz, 'examenes');
  let dbRespaldada = false;
  let examenesRespaldados = false;
  try {
    await fs.mkdir(respaldoRaiz, { recursive: true });
    await desconectarSqlite();
    await fs.mkdir(path.dirname(rutaDb), { recursive: true });
    try { await fs.rename(rutaDb, path.join(respaldoRaiz, 'evaluapro.db')); dbRespaldada = true; } catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; }
    try { await fs.rename(rutaExamenes, respaldoExamenes); examenesRespaldados = true; } catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; }
    await fs.rename(preparado.rutaDb, rutaDb);
    await fs.rename(preparado.rutaExamenes, rutaExamenes);
    await conectarSqlite();
    const columnas = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info('examenes_generados')");
    if (columnas.some((columna) => columna.name === 'rutaPdf')) {
      const origen = path.normalize(abierta.contenido.origen.rutaArtefactos);
      await prisma.$executeRawUnsafe('UPDATE examenes_generados SET rutaPdf = REPLACE(rutaPdf, ?, ?) WHERE rutaPdf LIKE ?', origen, path.normalize(rutaExamenes), `${origen}%`);
    }
    await fs.rm(preparado.temporal, { recursive: true, force: true });
    return { mensaje: 'Instantánea importada 1:1. Cierra y vuelve a iniciar sesión para recargar la cuenta.', checksumSha256: abierta.checksumSha256, requiereReinicioSesion: true, respaldo: respaldoRaiz, conteos: conteos(abierta.contenido) };
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
