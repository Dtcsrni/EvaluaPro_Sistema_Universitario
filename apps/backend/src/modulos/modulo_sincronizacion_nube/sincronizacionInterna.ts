/**
 * sincronizacionInterna
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { gzipSync } from 'zlib';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';

export const MAX_BASE64_CHARS = 60_000_000; // ~45MB binario aprox
const RESPALDO_CIFRADO_FORMATO = 'evaluapro-sync-encrypted';
const RESPALDO_CIFRADO_VERSION = 1;
const RESPALDO_CIFRADO_ALGORITMO = 'aes-256-gcm';

export type PaqueteSincronizacionV2 = {
  schemaVersion: 2;
  exportadoEn: string;
  docenteId: string;
  docenteCorreo?: string;
  periodoId?: string;
  desde?: string;
  conteos: Record<string, number>;
  periodos: unknown[];
  alumnos: unknown[];
  bancoPreguntas: unknown[];
  plantillas: unknown[];
  examenes: Array<Record<string, unknown>>;
  entregas: unknown[];
  calificaciones: unknown[];
  banderas: unknown[];
  pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string; pdfSha256?: string }>;
};

type RegistroPlano = Record<string, unknown>;
type ModelQueryLike = {
  select: (fields: string) => ModelQueryLike;
  lean: () => Promise<RegistroPlano | null>;
};

export type ModelLike = {
  findById: (id: unknown) => ModelQueryLike;
  findOneAndUpdate: (filtro: RegistroPlano, update: RegistroPlano, options: RegistroPlano) => unknown;
};

type RespuestaDetectadaSync = {
  numeroPregunta: number;
  opcion: string | null;
  confianza?: number;
};

type ComparativaRespuestaSync = {
  numeroPregunta: number;
  correcta: string | null;
  detectada: string | null;
  coincide: boolean;
  confianza?: number;
};

export function generarCodigoSimple() {
  // 8 hex chars (A-F0-9) en mayusculas: simple de dictar y transcribir.
  return randomBytes(4).toString('hex').toUpperCase();
}

export function comprimirBase64(buffer: Buffer) {
  return gzipSync(buffer).toString('base64');
}

export function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256HexBuffer(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

export function normalizarCorreo(valor: unknown): string {
  if (!valor) return '';
  return String(valor).trim().toLowerCase();
}

function obtenerClaveRespaldo(docenteCorreo: string): Buffer {
  const secreto = String(configuracion.respaldoCifradoSecreto || '').trim();
  const propietario = normalizarCorreo(docenteCorreo);
  if (!secreto || !propietario) {
    throw new ErrorAplicacion(
      'SYNC_CIFRADO_NO_CONFIGURADO',
      'No se puede cifrar o descifrar el respaldo: falta identificar al propietario',
      503
    );
  }
  return scryptSync(secreto, `EvaluaPro:backup:${propietario}`, 32, { N: 16_384, r: 8, p: 1 });
}

/**
 * Cifra el gzip del respaldo con autenticación AEAD. El propietario se usa
 * como contexto de derivación y AAD; no se guarda el correo dentro del sobre.
 */
export function cifrarRespaldo(gzipBytes: Buffer, docenteCorreo: string): Buffer {
  const propietario = normalizarCorreo(docenteCorreo);
  const clave = obtenerClaveRespaldo(propietario);
  const iv = randomBytes(12);
  const aad = Buffer.from(`EvaluaPro:${RESPALDO_CIFRADO_FORMATO}:v${RESPALDO_CIFRADO_VERSION}:${propietario}`, 'utf8');
  const cipher = createCipheriv(RESPALDO_CIFRADO_ALGORITMO, clave, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(gzipBytes), cipher.final()]);
  const sobre = {
    formato: RESPALDO_CIFRADO_FORMATO,
    version: RESPALDO_CIFRADO_VERSION,
    algoritmo: RESPALDO_CIFRADO_ALGORITMO,
    propietarioHash: sha256Hex(propietario),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
  return Buffer.from(JSON.stringify(sobre), 'utf8');
}

/**
 * Descifra sobres nuevos y conserva importación de gzip plano legado para
 * permitir migrar respaldos anteriores de forma explícita y auditable.
 */
export function descifrarRespaldo(payload: Buffer, docenteCorreo: string): { gzipBytes: Buffer; cifrado: boolean } {
  let sobre: {
    formato?: unknown;
    version?: unknown;
    algoritmo?: unknown;
    propietarioHash?: unknown;
    iv?: unknown;
    authTag?: unknown;
    ciphertext?: unknown;
  };
  try {
    sobre = JSON.parse(payload.toString('utf8')) as typeof sobre;
  } catch {
    return { gzipBytes: payload, cifrado: false };
  }
  if (sobre?.formato !== RESPALDO_CIFRADO_FORMATO) {
    return { gzipBytes: payload, cifrado: false };
  }
  const propietario = normalizarCorreo(docenteCorreo);
  if (Number(sobre.version) !== RESPALDO_CIFRADO_VERSION || sobre.algoritmo !== RESPALDO_CIFRADO_ALGORITMO) {
    throw new ErrorAplicacion('SYNC_CIFRADO_VERSION', 'Version de cifrado de respaldo no soportada', 400);
  }
  if (String(sobre.propietarioHash || '').toLowerCase() !== sha256Hex(propietario).toLowerCase()) {
    throw new ErrorAplicacion('SYNC_CIFRADO_PROPIETARIO', 'El respaldo no corresponde al propietario autenticado', 403);
  }
  try {
    const iv = Buffer.from(String(sobre.iv || ''), 'base64');
    const authTag = Buffer.from(String(sobre.authTag || ''), 'base64');
    const ciphertext = Buffer.from(String(sobre.ciphertext || ''), 'base64');
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) throw new Error('sobre incompleto');
    const aad = Buffer.from(`EvaluaPro:${RESPALDO_CIFRADO_FORMATO}:v${RESPALDO_CIFRADO_VERSION}:${propietario}`, 'utf8');
    const decipher = createDecipheriv(RESPALDO_CIFRADO_ALGORITMO, obtenerClaveRespaldo(propietario), iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    return { gzipBytes: Buffer.concat([decipher.update(ciphertext), decipher.final()]), cifrado: true };
  } catch {
    throw new ErrorAplicacion('SYNC_CIFRADO_INVALIDO', 'El respaldo no pudo autenticarse; puede estar corrupto o alterado', 400);
  }
}

export function obtenerCampo(doc: unknown, campo: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  return (doc as RegistroPlano)[campo];
}

function obtenerId(doc: unknown): unknown {
  return obtenerCampo(doc, '_id');
}

export { obtenerId };

export function obtenerIdTexto(doc: unknown): string {
  return String(obtenerId(doc) ?? '').trim();
}

function aFecha(valor: unknown): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

export async function upsertLwwPorUpdatedAt({
  modelName,
  Model,
  docs
}: {
  modelName: string;
  Model: ModelLike;
  docs: Array<Record<string, unknown>>;
}) {
  let aplicados = 0;
  let omitidos = 0;

  for (const doc of docs) {
    const id = obtenerCampo(doc, '_id');
    if (!id) continue;

    const incomingUpdatedAt = aFecha(obtenerCampo(doc, 'updatedAt') ?? obtenerCampo(doc, 'createdAt'));
    const existente = await Model.findById(id).select('updatedAt').lean();
    const existenteUpdatedAt = aFecha(existente ? obtenerCampo(existente, 'updatedAt') : null);
    if (existenteUpdatedAt && (!incomingUpdatedAt || existenteUpdatedAt >= incomingUpdatedAt)) {
      omitidos += 1;
      continue;
    }

    const camposActualizables = { ...doc };
    delete camposActualizables._id;

    await Model.findOneAndUpdate(
      { _id: id },
      { $set: camposActualizables, $setOnInsert: { _id: id } },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        // Preserva updatedAt/createdAt del paquete para que LWW por updatedAt
        // sea consistente entre equipos y entre importaciones fuera de orden.
        timestamps: false
      }
    );
    aplicados += 1;
  }

  return { modelName, aplicados, omitidos, recibidos: docs.length };
}

export function parsearFechaIso(valor?: string): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function obtenerLetraCorrecta(opciones: Array<{ esCorrecta: boolean }>, orden: number[]) {
  const indiceCorrecto = opciones.findIndex((opcion) => opcion.esCorrecta);
  if (indiceCorrecto < 0) return null;
  const posicion = orden.findIndex((indice) => indice === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

export function construirComparativaRespuestas(
  examen: Record<string, unknown> | undefined,
  preguntasDb: Array<Record<string, unknown>>,
  respuestasDetectadas: RespuestaDetectadaSync[]
): ComparativaRespuestaSync[] {
  if (!examen) return [];
  const mapaVariante = (examen.mapaVariante ?? {}) as {
    ordenPreguntas?: string[];
    ordenOpcionesPorPregunta?: Record<string, number[]>;
  };
  const ordenPreguntas = Array.isArray(mapaVariante.ordenPreguntas)
    ? mapaVariante.ordenPreguntas.map((item) => String(item))
    : [];
  if (!ordenPreguntas.length) return [];

  const mapaPreguntas = new Map<string, Record<string, unknown>>(
    preguntasDb.map((pregunta) => [String(pregunta._id), pregunta])
  );
  const respuestasPorNumero = new Map<number, RespuestaDetectadaSync>(
    (Array.isArray(respuestasDetectadas) ? respuestasDetectadas : []).map((respuesta) => [
      Number(respuesta.numeroPregunta),
      {
        numeroPregunta: Number(respuesta.numeroPregunta),
        opcion: typeof respuesta.opcion === 'string' ? respuesta.opcion.toUpperCase() : null,
        ...(typeof respuesta.confianza === 'number' ? { confianza: respuesta.confianza } : {})
      }
    ])
  );

  const comparativa: ComparativaRespuestaSync[] = [];
  ordenPreguntas.forEach((idPregunta, idx) => {
    const numeroPregunta = idx + 1;
    const pregunta = mapaPreguntas.get(idPregunta);
    const detectada = respuestasPorNumero.get(numeroPregunta);

    let correcta: string | null = null;
    if (pregunta) {
      const versiones = Array.isArray(pregunta.versiones) ? (pregunta.versiones as Array<Record<string, unknown>>) : [];
      const versionActual = Number(pregunta.versionActual ?? 0);
      const version = versiones.find((item) => Number(item.numeroVersion ?? 0) === versionActual) ?? versiones[0];
      const opciones = Array.isArray(version?.opciones) ? (version!.opciones as Array<{ esCorrecta: boolean }>) : [];
      const ordenOpcionesCrudo =
        mapaVariante.ordenOpcionesPorPregunta && Array.isArray(mapaVariante.ordenOpcionesPorPregunta[idPregunta])
          ? mapaVariante.ordenOpcionesPorPregunta[idPregunta]
          : [0, 1, 2, 3, 4];
      const ordenOpciones = ordenOpcionesCrudo.map((valor) => Number(valor)).filter((valor) => Number.isInteger(valor) && valor >= 0);
      correcta = obtenerLetraCorrecta(opciones, ordenOpciones);
    }

    const opcionDetectada = detectada?.opcion ?? null;
    comparativa.push({
      numeroPregunta,
      correcta,
      detectada: opcionDetectada,
      coincide: Boolean(correcta && opcionDetectada && correcta === opcionDetectada),
      ...(typeof detectada?.confianza === 'number' ? { confianza: detectada.confianza } : {})
    });
  });

  return comparativa;
}

export function crearErrorServidorSincronizacionNoConfigurado(codigo: 'SYNC_SERVIDOR_NO_CONFIG' | 'PORTAL_NO_CONFIG') {
  return new ErrorAplicacion(
    codigo,
    'Servidor de sincronizacion no configurado. Define PORTAL_ALUMNO_URL y PORTAL_ALUMNO_API_KEY.',
    503
  );
}

export function normalizarErrorServidorSincronizacion(error: unknown) {
  if (error instanceof ErrorAplicacion) return error;
  return new ErrorAplicacion(
    'SYNC_SERVIDOR_INALCANZABLE',
    'No se pudo conectar al servidor de sincronizacion. Verifica PORTAL_ALUMNO_URL y que el portal este en linea.',
    502,
    {
      causa: error instanceof Error ? error.message : String(error)
    }
  );
}
