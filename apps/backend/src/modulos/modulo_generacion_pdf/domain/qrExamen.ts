/**
 * qrExamen
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { configuracion } from '../../../configuracion.js';
import type { MapaVariante, OmrTemplateId, PreguntaBase, TemplateVersion } from '../shared/tiposPdf.js';

type QrPayloadPagina = {
  folio: string;
  numeroPagina: number;
  templateVersion: TemplateVersion;
  templateId?: OmrTemplateId;
  /** Omite metadata redundante cuando el mapa/manifiesto ya identifica el examen. */
  compacto?: boolean;
  examId?: string;
  totalPreguntas?: number;
  preguntaDesde?: number;
  preguntaHasta?: number;
  mapaVariante?: MapaVariante;
  preguntas?: PreguntaBase[];
  questionIdsPagina?: string[];
};

export type ResumenQrExamen = {
  folio: string;
  numeroPagina: number;
  templateVersion?: TemplateVersion;
  templateId?: OmrTemplateId;
  keyId?: string;
  examId?: string;
  totalPreguntas?: number;
  preguntaDesde?: number;
  preguntaHasta?: number;
  variantHash?: string;
  answerKeyHash?: string;
  /** Clave visible de la página, para reconstrucción local si falta el manifiesto. */
  pageAnswerKey?: string;
  payloadSignature?: string;
  payloadSignatureMode?: 'hmac-v1' | 'unsupported' | 'none';
  payloadSignatureValid?: boolean;
  qrPayloadMode?: 'self-contained' | 'manifest-bound';
  validatedAgainstManifest?: boolean;
  questionRefs?: string[];
  optionOrders?: string[];
  raw: string;
};

function hashCorto(valor: string, length = 12) {
  return createHash('sha256').update(valor).digest('hex').slice(0, length).toUpperCase();
}
function resolverSecretoQrPorKeyId(keyId: string | undefined) {
  const normalizedKeyId = String(keyId ?? '').trim();
  if (!normalizedKeyId) return null;
  return (
    configuracion.omrQrHmacSecrets[normalizedKeyId] ??
    configuracion.omrQrHmacSecrets[normalizedKeyId.toLowerCase()] ??
    configuracion.omrQrHmacSecrets[normalizedKeyId.toUpperCase()] ??
    null
  );
}

function hmacCorto(valor: string, length = 24, keyId = configuracion.omrQrHmacKeyId) {
  const secret = resolverSecretoQrPorKeyId(keyId) ?? configuracion.omrQrHmacSecret;
  return createHmac('sha256', secret).update(valor).digest('hex').slice(0, length).toUpperCase();
}

function hmacQrCorto(valor: string, keyId = configuracion.omrQrHmacKeyId) {
  const secret = resolverSecretoQrPorKeyId(keyId) ?? configuracion.omrQrHmacSecret;
  return createHmac('sha256', secret).update(valor).digest().subarray(0, 12).toString('base64url');
}

function compararSeguroToken(esperado: string, recibido: string) {
  const a = Buffer.from(String(esperado ?? '').trim(), 'utf8');
  const b = Buffer.from(String(recibido ?? '').trim(), 'utf8');
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function normalizarToken(valor: string | undefined) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

const LONGITUD_MAXIMA_QR_LEGACY_COMPACTO = 120;

function codificarPayloadQrCompacto(campos: {
  keyId: string;
  variantHash: string;
  answerKeyHash: string;
  pageAnswerKey: string;
}) {
  const keyId = Buffer.from(campos.keyId, 'ascii');
  const variantHash = Buffer.from(campos.variantHash, 'hex');
  const answerKeyHash = Buffer.from(campos.answerKeyHash, 'hex');
  const pageAnswerKey = campos.pageAnswerKey.toUpperCase();
  const pageKeyBytes = Buffer.alloc(Math.ceil(pageAnswerKey.length * 3 / 8));
  for (let indiceLetra = 0; indiceLetra < pageAnswerKey.length; indiceLetra += 1) {
    const codigo = pageAnswerKey.charCodeAt(indiceLetra) - 65;
    const indiceBit = indiceLetra * 3;
    for (let bit = 0; bit < 3; bit += 1) {
      if ((codigo & (1 << (2 - bit))) === 0) continue;
      const posicion = indiceBit + bit;
      pageKeyBytes[Math.floor(posicion / 8)] |= 1 << (7 - (posicion % 8));
    }
  }
  return Buffer.concat([
    Buffer.from([1, keyId.length]),
    keyId,
    variantHash,
    answerKeyHash,
    Buffer.from([pageAnswerKey.length]),
    pageKeyBytes
  ]).toString('base64url');
}

function decodificarPayloadQrCompacto(valor: string) {
  try {
    const texto = String(valor ?? '');
    if (!/^[A-Z0-9_-]+$/i.test(texto)) return null;
    const datos = Buffer.from(texto, 'base64url');
    if (datos.length < 1 + 1 + 6 + 6 + 1) return null;
    let offset = 0;
    if (datos[offset++] !== 1) return null;
    const keyIdLength = datos[offset++] ?? 0;
    if (keyIdLength < 1 || keyIdLength > 32 || offset + keyIdLength + 6 + 6 + 1 > datos.length) return null;
    const keyId = datos.subarray(offset, offset + keyIdLength).toString('ascii');
    offset += keyIdLength;
    const variantHash = datos.subarray(offset, offset + 6).toString('hex').toUpperCase();
    offset += 6;
    const answerKeyHash = datos.subarray(offset, offset + 6).toString('hex').toUpperCase();
    offset += 6;
    const pageKeyLength = datos[offset++] ?? 0;
    if (pageKeyLength < 1 || pageKeyLength > 26) return null;
    const pageKeyByteLength = Math.ceil(pageKeyLength * 3 / 8);
    if (offset + pageKeyByteLength !== datos.length) return null;
    const pageKeyBytes = datos.subarray(offset, offset + pageKeyByteLength);
    let pageAnswerKey = '';
    for (let indiceLetra = 0; indiceLetra < pageKeyLength; indiceLetra += 1) {
      const indiceBit = indiceLetra * 3;
      const indiceByte = Math.floor(indiceBit / 8);
      const offsetEnByte = indiceBit % 8;
      let codigo: number;
      if (offsetEnByte <= 5) {
        codigo = (pageKeyBytes[indiceByte]! >> (5 - offsetEnByte)) & 0x07;
      } else {
        codigo = ((pageKeyBytes[indiceByte]! << (offsetEnByte - 5)) | (pageKeyBytes[indiceByte + 1]! >> (13 - offsetEnByte))) & 0x07;
      }
      if (codigo > 4) return null;
      pageAnswerKey += String.fromCharCode(65 + codigo);
    }
    const bitsUsadosUltimoByte = (pageKeyLength * 3) % 8;
    if (bitsUsadosUltimoByte > 0) {
      const bitsDeRelleno = 8 - bitsUsadosUltimoByte;
      if ((pageKeyBytes[pageKeyBytes.length - 1]! & ((1 << bitsDeRelleno) - 1)) !== 0) return null;
    }
    if (!/^[A-Z0-9_-]{1,32}$/i.test(keyId)) return null;
    if (pageAnswerKey.length !== pageKeyLength) return null;
    return { keyId, variantHash, answerKeyHash, pageAnswerKey };
  } catch {
    return null;
  }
}

export function construirFirmaVariante(mapaVariante?: MapaVariante) {
  const ordenPreguntas = Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante.ordenPreguntas : [];
  const bloques = ordenPreguntas.map((idPregunta) => {
    const ordenOpciones = Array.isArray(mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta])
      ? mapaVariante!.ordenOpcionesPorPregunta![idPregunta]!
      : [];
    return `${idPregunta}:${ordenOpciones.join('.')}`;
  });
  return hashCorto(`${ordenPreguntas.join('|')}__${bloques.join('|')}`);
}

function resolverLetraCorrecta(
  pregunta: PreguntaBase | undefined,
  ordenOpciones: number[] | undefined
): string {
  const opciones = Array.isArray(pregunta?.opciones) ? pregunta!.opciones : [];
  const orden = Array.isArray(ordenOpciones) && ordenOpciones.length > 0 ? ordenOpciones : [0, 1, 2, 3, 4];
  const indiceCorrecto = opciones.findIndex((opcion) => opcion?.esCorrecta === true);
  if (indiceCorrecto < 0) return 'X';
  const posicionVisible = orden.findIndex((indice) => Number(indice) === indiceCorrecto);
  if (posicionVisible < 0 || posicionVisible > 25) return 'X';
  return String.fromCharCode(65 + posicionVisible);
}

export function construirFirmaClave(preguntas: PreguntaBase[] | undefined, mapaVariante?: MapaVariante) {
  const preguntasSeguras = Array.isArray(preguntas) ? preguntas : [];
  const porId = new Map(preguntasSeguras.map((pregunta) => [pregunta.id, pregunta]));
  const ordenPreguntas = Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante!.ordenPreguntas : [];
  const clave = ordenPreguntas.map((idPregunta) =>
    `${idPregunta}:${resolverLetraCorrecta(porId.get(idPregunta), mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta])}`
  );
  return hashCorto(clave.join('|'));
}

function construirClaveVisiblePagina(
  preguntas: PreguntaBase[] | undefined,
  mapaVariante: MapaVariante | undefined,
  questionIdsPagina: string[] | undefined
) {
  const ids = Array.isArray(questionIdsPagina) ? questionIdsPagina : [];
  const porId = new Map((Array.isArray(preguntas) ? preguntas : []).map((pregunta) => [pregunta.id, pregunta]));
  return ids
    .map((idPregunta) => resolverLetraCorrecta(porId.get(idPregunta), mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta]))
    .join('');
}

export function construirTextoQrExamenPagina(payload: QrPayloadPagina): string {
  const folio = normalizarToken(payload.folio);
  const numeroPagina = Math.max(1, Number(payload.numeroPagina) || 1);
  const templateVersion = payload.templateVersion;
  const templateId = payload.templateId ?? 'omr-canonical-v4';
  const identidad = `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersion}`;
  if (payload.compacto && templateVersion === 4 && templateId === 'omr-canonical-v4') {
    return `${identidad}:S:${hmacQrCorto(identidad)}`;
  }
  const examId = normalizarToken(payload.examId);
  const variantHash = construirFirmaVariante(payload.mapaVariante);
  const answerKeyHash = construirFirmaClave(payload.preguntas, payload.mapaVariante);
  const pageAnswerKey = construirClaveVisiblePagina(payload.preguntas, payload.mapaVariante, payload.questionIdsPagina);
  const keyId = normalizarToken(configuracion.omrQrHmacKeyId).slice(0, 20);
  const totalPreguntas = Math.max(0, Number(payload.totalPreguntas) || 0);
  const preguntaDesde = Math.max(0, Number(payload.preguntaDesde) || 0);
  const preguntaHasta = Math.max(0, Number(payload.preguntaHasta) || 0);
  const esPlantillaInline = templateId === 'omr-inline-exam-v1';

  const segmentos = [
    `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersion}`,
    esPlantillaInline ? `TI:${templateId}` : '',
    (payload.compacto && !esPlantillaInline) ? '' : examId ? `ID:${examId}` : '',
    keyId ? `KI:${keyId}` : '',
    !esPlantillaInline && totalPreguntas > 0 ? `TQ:${totalPreguntas}` : '',
    !esPlantillaInline && preguntaDesde > 0 ? `QD:${preguntaDesde}` : '',
    !esPlantillaInline && preguntaHasta >= preguntaDesde && preguntaHasta > 0 ? `QH:${preguntaHasta}` : '',
    !esPlantillaInline && variantHash ? `VH:${variantHash}` : '',
    !esPlantillaInline && answerKeyHash ? `AK:${answerKeyHash}` : '',
    !esPlantillaInline && pageAnswerKey ? `K:${pageAnswerKey}` : ''
  ].filter(Boolean);

  const textoLegacy = `${segmentos.join(':')}:SG:H1${hmacCorto(segmentos.join(':'), 24, keyId)}`;
  // La forma histórica es legible y se conserva para payloads pequeños. Para
  // páginas reales de 12-15 reactivos, la forma compacta evita que etiquetas
  // redundantes eleven el símbolo a 57 módulos; todo el contenido sigue
  // dentro del HMAC y el parser mantiene los mismos campos semánticos.
  if (
    payload.compacto &&
    templateId === 'omr-canonical-v4' &&
    textoLegacy.length > LONGITUD_MAXIMA_QR_LEGACY_COMPACTO &&
    keyId &&
    variantHash &&
    answerKeyHash &&
    /^[A-E]{1,26}$/.test(pageAnswerKey)
  ) {
    const compacto = codificarPayloadQrCompacto({ keyId, variantHash, answerKeyHash, pageAnswerKey });
    const segmentosCompactos = [
      `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersion}`,
      `C:${compacto}`
    ];
    return `${segmentosCompactos.join(':')}:SG:H1${hmacCorto(segmentosCompactos.join(':'), 24, keyId)}`;
  }
  return textoLegacy;
}

function resolverFirmaPayload(
  firma: string | undefined,
  segmentosFirmados: string,
  keyId?: string
): Pick<ResumenQrExamen, 'payloadSignature' | 'payloadSignatureMode' | 'payloadSignatureValid' | 'keyId'> {
  const token = String(firma ?? '').trim().toUpperCase();
  if (!token) {
    return {
      payloadSignature: undefined,
      payloadSignatureMode: 'none',
      payloadSignatureValid: undefined,
      keyId: undefined
    };
  }

  if (/^H1[A-Z0-9]{24}$/i.test(token)) {
    const secret = resolverSecretoQrPorKeyId(keyId);
    if (!secret) {
      return {
        payloadSignature: token,
        payloadSignatureMode: 'hmac-v1',
        payloadSignatureValid: false,
        keyId
      };
    }
    const esperada = `H1${createHmac('sha256', secret).update(segmentosFirmados).digest('hex').slice(0, 24).toUpperCase()}`;
    return {
      payloadSignature: token,
      payloadSignatureMode: 'hmac-v1',
      payloadSignatureValid: compararSeguroToken(esperada, token),
      keyId
    };
  }

  return {
    payloadSignature: token,
    payloadSignatureMode: 'unsupported',
    payloadSignatureValid: false,
    keyId
  };
}

function resolverFirmaQrCorto(firma: string | undefined, identidadFirmada: string) {
  const token = String(firma ?? '').trim();
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) {
    return {
      payloadSignature: token ? `S${token}` : undefined,
      payloadSignatureMode: token ? 'unsupported' as const : 'none' as const,
      payloadSignatureValid: token ? false : undefined,
      keyId: undefined
    };
  }
  const recibida = Buffer.from(token, 'base64url');
  if (recibida.length !== 12) {
    return {
      payloadSignature: `S${token}`,
      payloadSignatureMode: 'unsupported' as const,
      payloadSignatureValid: false,
      keyId: undefined
    };
  }

  const candidatos = [
    [configuracion.omrQrHmacKeyId, resolverSecretoQrPorKeyId(configuracion.omrQrHmacKeyId) ?? configuracion.omrQrHmacSecret] as const,
    ...Object.entries(configuracion.omrQrHmacSecrets)
  ];
  const secretosVistos = new Set<string>();
  for (const [keyId, secret] of candidatos) {
    if (!secret || secretosVistos.has(secret)) continue;
    secretosVistos.add(secret);
    const esperada = createHmac('sha256', secret).update(identidadFirmada).digest().subarray(0, 12);
    if (timingSafeEqual(esperada, recibida)) {
      return {
        payloadSignature: `S${token}`,
        payloadSignatureMode: 'hmac-v1' as const,
        payloadSignatureValid: true,
        keyId
      };
    }
  }
  return {
    payloadSignature: `S${token}`,
    payloadSignatureMode: 'hmac-v1' as const,
    payloadSignatureValid: false,
    keyId: undefined
  };
}

export function extraerResumenQrExamen(textoQr?: string): ResumenQrExamen | null {
  const limpio = String(textoQr ?? '').trim();
  const match = /^EXAMEN:([A-Z0-9_-]+):P(\d+):TV(\d+)(?::(.*))?$/i.exec(limpio);
  if (!match) return null;
  const folio = String(match[1] ?? '').toUpperCase();
  const numeroPagina = Number(match[2] ?? 0);
  const templateVersionRaw = Number(match[3] ?? 0);
  if (templateVersionRaw !== 4) return null;
  const templateVersion: TemplateVersion = 4;
  const resto = String(match[4] ?? '').trim();
  const campos = new Map<string, string>();
  if (resto) {
    const partes = resto.split(':');
    for (let i = 0; i < partes.length - 1; i += 2) {
      const clave = String(partes[i] ?? '').trim().toUpperCase();
      const valor = String(partes[i + 1] ?? '').trim();
      if (!clave) continue;
      campos.set(clave, valor);
    }
  }
  const templateIdRaw = campos.get('TI');
  if (templateIdRaw && templateIdRaw !== 'omr-inline-exam-v1') return null;
  const templateId: OmrTemplateId = templateIdRaw === 'omr-inline-exam-v1'
    ? 'omr-inline-exam-v1'
    : 'omr-canonical-v4';
  const totalPreguntas = Number(campos.get('TQ') ?? 0);
  const preguntaDesde = Number(campos.get('QD') ?? 0);
  const preguntaHasta = Number(campos.get('QH') ?? 0);
  const compacto = campos.get('C');
  const firmaCorta = campos.get('S');
  if (firmaCorta && campos.size !== 1) return null;
  const camposCompactos = compacto ? decodificarPayloadQrCompacto(compacto) : null;
  if (compacto && !camposCompactos) return null;
  if (compacto && ['KI', 'VH', 'AK', 'K'].some((clave) => campos.has(clave))) return null;
  if (camposCompactos) {
    campos.set('KI', camposCompactos.keyId);
    campos.set('VH', camposCompactos.variantHash);
    campos.set('AK', camposCompactos.answerKeyHash);
    campos.set('K', camposCompactos.pageAnswerKey);
  }
  const segmentosFirmados = [
    `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersionRaw || 0}`,
    templateIdRaw ? `TI:${templateIdRaw}` : '',
    compacto ? `C:${compacto}` : campos.get('ID') ? `ID:${campos.get('ID')}` : '',
    compacto ? '' : campos.get('KI') ? `KI:${campos.get('KI')}` : '',
    compacto ? '' : Number.isFinite(totalPreguntas) && totalPreguntas > 0 ? `TQ:${totalPreguntas}` : '',
    compacto ? '' : Number.isFinite(preguntaDesde) && preguntaDesde > 0 ? `QD:${preguntaDesde}` : '',
    compacto ? '' : Number.isFinite(preguntaHasta) && preguntaHasta > 0 ? `QH:${preguntaHasta}` : '',
    compacto ? '' : campos.get('VH') ? `VH:${campos.get('VH')}` : '',
    compacto ? '' : campos.get('AK') ? `AK:${campos.get('AK')}` : '',
    compacto ? '' : campos.get('K') ? `K:${campos.get('K')}` : '',
    compacto ? '' : campos.get('QV') ? `QV:${campos.get('QV')}` : '',
    compacto ? '' : campos.get('OV') ? `OV:${campos.get('OV')}` : ''
  ].filter(Boolean).join(':');
  const firmaPayload = firmaCorta
    ? resolverFirmaQrCorto(firmaCorta, `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersionRaw || 0}`)
    : resolverFirmaPayload(campos.get('SG'), segmentosFirmados, campos.get('KI'));
  return {
    folio,
    numeroPagina,
    templateVersion,
    templateId,
    keyId: firmaPayload.keyId ?? (campos.get('KI') || undefined),
    examId: campos.get('ID') || undefined,
    totalPreguntas: Number.isFinite(totalPreguntas) && totalPreguntas > 0 ? totalPreguntas : undefined,
    preguntaDesde: Number.isFinite(preguntaDesde) && preguntaDesde > 0 ? preguntaDesde : undefined,
    preguntaHasta: Number.isFinite(preguntaHasta) && preguntaHasta > 0 ? preguntaHasta : undefined,
    variantHash: campos.get('VH') || undefined,
    answerKeyHash: campos.get('AK') || undefined,
    pageAnswerKey: /^[A-E]{1,26}$/i.test(String(campos.get('K') ?? '')) ? campos.get('K')!.toUpperCase() : undefined,
    payloadSignature: firmaPayload.payloadSignature,
    payloadSignatureMode: firmaPayload.payloadSignatureMode,
    payloadSignatureValid: firmaPayload.payloadSignatureValid,
    qrPayloadMode: firmaCorta || templateId === 'omr-inline-exam-v1' ? 'manifest-bound' : 'self-contained',
    questionRefs: campos.get('QV') ? campos.get('QV')!.split('.').filter(Boolean) : undefined,
    optionOrders: campos.get('OV') ? campos.get('OV')!.split('.').filter(Boolean) : undefined,
    raw: limpio
  };
}
