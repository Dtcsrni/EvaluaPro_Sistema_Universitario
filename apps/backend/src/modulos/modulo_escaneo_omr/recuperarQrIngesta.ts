import { extraerResumenQrExamen } from '../modulo_generacion_pdf/index.js';
import type { analizarOmr as AnalizarOmr } from './servicioOmr.js';

type ResultadoOmr = Awaited<ReturnType<typeof AnalizarOmr>>;

export type ExamenRecuperacionQr = {
  id: string;
  folio: string;
  paginas: unknown;
  mapaOmr: unknown;
};

type PaginaMapaQr = {
  numeroPagina?: unknown;
  tipoPagina?: unknown;
  qr?: { texto?: unknown };
  [key: string]: unknown;
};
type CandidatoLote = {
  examenId: string;
  folio: string;
  numeroPagina: number;
  raw: string;
  paginaMapa: PaginaMapaQr;
  margenMm: number;
};

function leerJson<T>(valor: unknown, fallback: T): T {
  if (typeof valor !== 'string') return (valor as T) ?? fallback;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return fallback;
  }
}

function claveGeometriaQr(pagina: PaginaMapaQr, margenMm: number, templateVersion: unknown) {
  const qr = pagina.qr as Record<string, unknown> | undefined;
  const marcas = pagina['marcasPagina'] as Record<string, unknown> | undefined;
  if (!qr || ![qr.x, qr.y, qr.size].every((valor) => Number.isFinite(Number(valor)))) return null;
  return JSON.stringify({
    templateVersion,
    margenMm,
    qr: {
      x: qr.x,
      y: qr.y,
      size: qr.size,
      marginModules: qr.marginModules,
      matrixModules: qr.matrixModules,
      errorCorrectionLevel: qr.errorCorrectionLevel
    },
    marcasPagina: marcas
  });
}

/**
 * Busca la página en las geometrías QR del lote. Los payloads esperados se
 * decodifican desde la captura original y solo se aceptan tras validar firma,
 * identidad, página y coincidencia byte a byte con el PDF de referencia.
 */
export async function recuperarQrIngestaPorGeometria(args: {
  imagenBase64: string;
  examenes: ExamenRecuperacionQr[];
  qrsRegistrados: ReadonlyMap<string, ReadonlySet<string>>;
  analizar: typeof AnalizarOmr;
}): Promise<{ qr: NonNullable<ReturnType<typeof extraerResumenQrExamen>>; examenId: string; numeroPagina: number; fuenteDeteccion?: string } | null> {
  if (!args.imagenBase64 || args.examenes.length === 0) return null;

  const grupos = new Map<string, { candidatos: CandidatoLote[]; qrEsperados: Set<string>; geometria: PaginaMapaQr; margenMm: number }>();
  const candidatosPorPayload = new Map<string, CandidatoLote[]>();
  for (const examen of args.examenes) {
    const paginasExamen = leerJson<Array<{ numero?: unknown; qrTexto?: unknown }>>(examen.paginas, []);
    const mapa = leerJson<{ margenMm?: unknown; templateVersion?: unknown; paginas?: PaginaMapaQr[] }>(examen.mapaOmr, {});
    if (Number(mapa.templateVersion) !== 4) continue;
    const margenMm = Number.isFinite(Number(mapa.margenMm)) ? Number(mapa.margenMm) : 10;
    for (const paginaExamen of paginasExamen) {
      const numeroPagina = Number(paginaExamen.numero);
      const raw = String(paginaExamen.qrTexto ?? '').trim();
      if (!Number.isInteger(numeroPagina) || numeroPagina < 1 || !raw) continue;
      const key = `${examen.id.toUpperCase()}:${numeroPagina}`;
      if (!args.qrsRegistrados.get(key)?.has(raw)) continue;
      const paginaMapa = mapa.paginas?.find((pagina) => Number(pagina.numeroPagina) === numeroPagina);
      const textoMapa = String(paginaMapa?.qr?.texto ?? '').trim();
      if (!paginaMapa || paginaMapa.tipoPagina === 'reverso-vacio' || textoMapa !== raw) continue;
      const geometryKey = claveGeometriaQr(paginaMapa, margenMm, mapa.templateVersion);
      if (!geometryKey) continue;
      const candidate: CandidatoLote = { examenId: examen.id, folio: examen.folio, numeroPagina, raw, paginaMapa, margenMm };
      const group = grupos.get(geometryKey) ?? { candidatos: [], qrEsperados: new Set<string>(), geometria: paginaMapa, margenMm };
      group.candidatos.push(candidate);
      group.qrEsperados.add(raw);
      grupos.set(geometryKey, group);
      candidatosPorPayload.set(raw, [...(candidatosPorPayload.get(raw) ?? []), candidate]);
    }
  }

  if (grupos.size === 0) return null;
  for (const group of grupos.values()) {
    let resultado: ResultadoOmr;
    try {
      const mapaQr = { ...group.geometria, preguntas: [] } as Parameters<typeof AnalizarOmr>[1];
      resultado = await args.analizar(
        args.imagenBase64,
        mapaQr,
        [...group.qrEsperados],
        group.margenMm,
        {
          folio: group.candidatos[0]!.folio,
          numeroPagina: group.candidatos[0]!.numeroPagina,
          templateVersionDetectada: 4
        }
      );
    } catch {
      continue;
    }
    const qr = extraerResumenQrExamen(String(resultado.qrTexto ?? '').trim());
    if (!qr || qr.payloadSignatureValid !== true) continue;
    const matches = candidatosPorPayload.get(qr.raw) ?? [];
    if (
      matches.length !== 1 ||
      qr.folio.toUpperCase() !== matches[0]!.folio.toUpperCase() ||
      qr.numeroPagina !== matches[0]!.numeroPagina ||
      (qr.examId && qr.examId.toUpperCase() !== matches[0]!.examenId.toUpperCase())
    ) continue;
    return {
      qr,
      examenId: matches[0]!.examenId,
      numeroPagina: matches[0]!.numeroPagina,
      fuenteDeteccion: resultado.qrFuenteDeteccion
    };
  }
  return null;
}
