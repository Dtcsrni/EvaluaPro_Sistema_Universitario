import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { configuracion } from '../../../configuracion';
import type { MapaVariante, PreguntaBase, TemplateVersion } from '../shared/tiposPdf';

type QrPayloadPagina = {
  folio: string;
  numeroPagina: number;
  templateVersion: TemplateVersion;
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
  keyId?: string;
  examId?: string;
  totalPreguntas?: number;
  preguntaDesde?: number;
  preguntaHasta?: number;
  variantHash?: string;
  answerKeyHash?: string;
  payloadSignature?: string;
  payloadSignatureMode?: 'hmac-v1' | 'legacy-hash' | 'none';
  payloadSignatureValid?: boolean;
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

function construirReferenciasPregunta(questionIdsPagina: string[] | undefined) {
  const ids = Array.isArray(questionIdsPagina) ? questionIdsPagina : [];
  return ids.map((idPregunta) => hashCorto(String(idPregunta), 6));
}

function construirOrdenesOpcionesPagina(mapaVariante: MapaVariante | undefined, questionIdsPagina: string[] | undefined) {
  const ids = Array.isArray(questionIdsPagina) ? questionIdsPagina : [];
  return ids.map((idPregunta) => {
    const ordenOpciones = Array.isArray(mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta])
      ? mapaVariante!.ordenOpcionesPorPregunta![idPregunta]!
      : [0, 1, 2, 3, 4];
    return ordenOpciones.map((indice) => String(Math.max(0, Number(indice) || 0))).join('');
  });
}

export function construirTextoQrExamenPagina(payload: QrPayloadPagina): string {
  const folio = normalizarToken(payload.folio);
  const numeroPagina = Math.max(1, Number(payload.numeroPagina) || 1);
  const templateVersion = payload.templateVersion;
  const examId = normalizarToken(payload.examId);
  const variantHash = construirFirmaVariante(payload.mapaVariante);
  const answerKeyHash = construirFirmaClave(payload.preguntas, payload.mapaVariante);
  const questionRefs = construirReferenciasPregunta(payload.questionIdsPagina);
  const optionOrders = construirOrdenesOpcionesPagina(payload.mapaVariante, payload.questionIdsPagina);
  const keyId = normalizarToken(configuracion.omrQrHmacKeyId).slice(0, 20);
  const totalPreguntas = Math.max(0, Number(payload.totalPreguntas) || 0);
  const preguntaDesde = Math.max(0, Number(payload.preguntaDesde) || 0);
  const preguntaHasta = Math.max(0, Number(payload.preguntaHasta) || 0);

  const segmentos = [
    `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersion}`,
    examId ? `ID:${examId}` : '',
    keyId ? `KI:${keyId}` : '',
    totalPreguntas > 0 ? `TQ:${totalPreguntas}` : '',
    preguntaDesde > 0 ? `QD:${preguntaDesde}` : '',
    preguntaHasta >= preguntaDesde && preguntaHasta > 0 ? `QH:${preguntaHasta}` : '',
    variantHash ? `VH:${variantHash}` : '',
    answerKeyHash ? `AK:${answerKeyHash}` : '',
    questionRefs.length > 0 ? `QV:${questionRefs.join('.')}` : '',
    optionOrders.length > 0 ? `OV:${optionOrders.join('.')}` : ''
  ].filter(Boolean);

  const firmaPayload = `H1${hmacCorto(segmentos.join(':'), 24, keyId)}`;
  segmentos.push(`SG:${firmaPayload}`);
  return segmentos.join(':');
}

function resolverFirmaPayload(
  firma: string | undefined,
  segmentosFirmados: string,
  keyId?: string
): Pick<ResumenQrExamen, 'payloadSignature' | 'payloadSignatureMode' | 'payloadSignatureValid'> {
  const token = String(firma ?? '').trim().toUpperCase();
  if (!token) {
    return {
      payloadSignature: undefined,
      payloadSignatureMode: 'none',
      payloadSignatureValid: undefined
    };
  }

  if (/^H1[A-Z0-9]{24}$/i.test(token)) {
    const secret = resolverSecretoQrPorKeyId(keyId);
    if (!secret) {
      return {
        payloadSignature: token,
        payloadSignatureMode: 'hmac-v1',
        payloadSignatureValid: false
      };
    }
    const esperada = `H1${createHmac('sha256', secret).update(segmentosFirmados).digest('hex').slice(0, 24).toUpperCase()}`;
    return {
      payloadSignature: token,
      payloadSignatureMode: 'hmac-v1',
      payloadSignatureValid: compararSeguroToken(esperada, token)
    };
  }

  const esperadaLegacy = hashCorto(segmentosFirmados, 16);
  return {
    payloadSignature: token,
    payloadSignatureMode: 'legacy-hash',
    payloadSignatureValid: compararSeguroToken(esperadaLegacy, token)
  };
}

export function extraerResumenQrExamen(textoQr?: string): ResumenQrExamen | null {
  const limpio = String(textoQr ?? '').trim();
  const match = /^EXAMEN:([A-Z0-9_-]+):P(\d+):TV(\d+)(?::(.*))?$/i.exec(limpio);
  if (!match) return null;
  const folio = String(match[1] ?? '').toUpperCase();
  const numeroPagina = Number(match[2] ?? 0);
  const templateVersionRaw = Number(match[3] ?? 0);
  const templateVersion =
    templateVersionRaw === 1 || templateVersionRaw === 3 || templateVersionRaw === 4
      ? (templateVersionRaw as TemplateVersion)
      : undefined;
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
  const totalPreguntas = Number(campos.get('TQ') ?? 0);
  const preguntaDesde = Number(campos.get('QD') ?? 0);
  const preguntaHasta = Number(campos.get('QH') ?? 0);
  const segmentosFirmados = [
    `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersionRaw || 0}`,
    campos.get('ID') ? `ID:${campos.get('ID')}` : '',
    campos.get('KI') ? `KI:${campos.get('KI')}` : '',
    Number.isFinite(totalPreguntas) && totalPreguntas > 0 ? `TQ:${totalPreguntas}` : '',
    Number.isFinite(preguntaDesde) && preguntaDesde > 0 ? `QD:${preguntaDesde}` : '',
    Number.isFinite(preguntaHasta) && preguntaHasta > 0 ? `QH:${preguntaHasta}` : '',
    campos.get('VH') ? `VH:${campos.get('VH')}` : '',
    campos.get('AK') ? `AK:${campos.get('AK')}` : '',
    campos.get('QV') ? `QV:${campos.get('QV')}` : '',
    campos.get('OV') ? `OV:${campos.get('OV')}` : ''
  ].filter(Boolean).join(':');
  const firmaPayload = resolverFirmaPayload(campos.get('SG'), segmentosFirmados, campos.get('KI'));
  return {
    folio,
    numeroPagina,
    templateVersion,
    keyId: campos.get('KI') || undefined,
    examId: campos.get('ID') || undefined,
    totalPreguntas: Number.isFinite(totalPreguntas) && totalPreguntas > 0 ? totalPreguntas : undefined,
    preguntaDesde: Number.isFinite(preguntaDesde) && preguntaDesde > 0 ? preguntaDesde : undefined,
    preguntaHasta: Number.isFinite(preguntaHasta) && preguntaHasta > 0 ? preguntaHasta : undefined,
    variantHash: campos.get('VH') || undefined,
    answerKeyHash: campos.get('AK') || undefined,
    payloadSignature: firmaPayload.payloadSignature,
    payloadSignatureMode: firmaPayload.payloadSignatureMode,
    payloadSignatureValid: firmaPayload.payloadSignatureValid,
    questionRefs: campos.get('QV') ? campos.get('QV')!.split('.').filter(Boolean) : undefined,
    optionOrders: campos.get('OV') ? campos.get('OV')!.split('.').filter(Boolean) : undefined,
    raw: limpio
  };
}

export function construirQrExamenLegacy(folio: string, numeroPagina: number, templateVersion: TemplateVersion) {
  return `EXAMEN:${normalizarToken(folio)}:P${Math.max(1, Number(numeroPagina) || 1)}:TV${templateVersion}`;
}
