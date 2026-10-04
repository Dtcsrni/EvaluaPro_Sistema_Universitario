import type { EstadoRespuestaOmr } from './estadoRespuesta.js';

export type CandidataRespuestaOmr = {
  opcion: 'A' | 'B' | 'C' | 'D' | 'E';
  score: number;
  fillRatioCore: number;
  estadoMarca: 'no_marcada' | 'parcial' | 'marcada' | 'tachada';
};

export type RespuestaRevisionOmr = {
  numeroPregunta: number;
  opcion: string | null;
  opcionDetectada: string | null;
  confianza: number;
  estadoRespuesta?: EstadoRespuestaOmr | 'manual_review';
  flags: string[];
  candidatas: CandidataRespuestaOmr[];
};

const OPCIONES = new Set(['A', 'B', 'C', 'D', 'E']);
const ESTADOS_RESPUESTA = new Set(['respondida', 'sin_marca', 'ambigua', 'doble_marca', 'tachada', 'manual_review']);
const ESTADOS_MARCA = new Set(['no_marcada', 'parcial', 'marcada', 'tachada']);
const FLAGS = new Set(['doble_marca', 'bajo_contraste', 'fuera_roi', 'parcial_detectada', 'tachada_detectada']);

function numeroFinito(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function proyectarRespuestaParaRevisionOmr(value: unknown): RespuestaRevisionOmr {
  const respuesta = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const opcion = OPCIONES.has(String(respuesta.opcion ?? '').toUpperCase())
    ? String(respuesta.opcion).toUpperCase()
    : null;
  const estadoRaw = String(respuesta.estadoRespuesta ?? '');
  const estadoRespuesta = ESTADOS_RESPUESTA.has(estadoRaw)
    ? estadoRaw as RespuestaRevisionOmr['estadoRespuesta']
    : undefined;
  const flags = Array.isArray(respuesta.flags)
    ? [...new Set(respuesta.flags.map(String).filter((flag) => FLAGS.has(flag)))].sort()
    : [];
  const scores = Array.isArray(respuesta.scoresPorOpcion)
    ? respuesta.scoresPorOpcion
    : Array.isArray(respuesta.candidatas) ? respuesta.candidatas : [];
  const candidatas = scores
    .filter((score): score is Record<string, unknown> => Boolean(score && typeof score === 'object'))
    .filter((score) => OPCIONES.has(String(score.opcion ?? '').toUpperCase()))
    .map((score) => ({
      opcion: String(score.opcion).toUpperCase() as CandidataRespuestaOmr['opcion'],
      score: Math.max(0, Math.min(1, numeroFinito(score.score))),
      fillRatioCore: Math.max(0, Math.min(1, numeroFinito(score.fillRatioCore))),
      estadoMarca: ESTADOS_MARCA.has(String(score.estadoMarca))
        ? String(score.estadoMarca) as CandidataRespuestaOmr['estadoMarca']
        : 'no_marcada' as const
    }))
    .sort((a, b) => b.score - a.score || a.opcion.localeCompare(b.opcion))
    .slice(0, 3);

  return {
    numeroPregunta: Math.max(0, Math.trunc(numeroFinito(respuesta.numeroPregunta))),
    opcion,
    opcionDetectada: OPCIONES.has(String(respuesta.opcionDetectada ?? '').toUpperCase())
      ? String(respuesta.opcionDetectada).toUpperCase()
      : respuesta.opcionDetectada === null ? null : opcion,
    confianza: Math.max(0, Math.min(1, numeroFinito(respuesta.confianza))),
    ...(estadoRespuesta ? { estadoRespuesta } : {}),
    flags,
    candidatas
  };
}
