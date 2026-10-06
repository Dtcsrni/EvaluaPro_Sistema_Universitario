const TTL_PREVIEW_ARCHIVADO_MS = 10 * 60 * 1000;
const MAX_PREVIEWS_ARCHIVADOS = 32;

export type PreviewArchivadoValidado = {
  docenteId: string;
  periodoId: string;
  plantillaId: string;
  bookletConfig: Record<string, unknown>;
  blueprintJson: string;
  mapaVariante: {
    ordenPreguntas: string[];
    ordenOpcionesPorPregunta: Record<string, number[]>;
  };
};

type EntradaPreviewArchivado = PreviewArchivadoValidado & { expiraEn: number };

const previewsPorClave = new Map<string, EntradaPreviewArchivado>();

function construirClave(params: Pick<PreviewArchivadoValidado, 'docenteId' | 'periodoId' | 'plantillaId'>) {
  return `${params.docenteId}:${params.periodoId}:${params.plantillaId}`;
}

export function guardarPreviewArchivadoValidado(params: PreviewArchivadoValidado) {
  const clave = construirClave(params);
  previewsPorClave.delete(clave);
  previewsPorClave.set(clave, { ...params, expiraEn: Date.now() + TTL_PREVIEW_ARCHIVADO_MS });
  while (previewsPorClave.size > MAX_PREVIEWS_ARCHIVADOS) {
    const primeraClave = previewsPorClave.keys().next().value;
    if (typeof primeraClave !== 'string') break;
    previewsPorClave.delete(primeraClave);
  }
}

export function obtenerPreviewArchivadoValidado(
  params: Pick<PreviewArchivadoValidado, 'docenteId' | 'periodoId' | 'plantillaId'>
) {
  const clave = construirClave(params);
  const preview = previewsPorClave.get(clave);
  if (!preview) return undefined;
  if (Date.now() >= preview.expiraEn) {
    previewsPorClave.delete(clave);
    return undefined;
  }
  return {
    docenteId: preview.docenteId,
    periodoId: preview.periodoId,
    plantillaId: preview.plantillaId,
    bookletConfig: JSON.parse(JSON.stringify(preview.bookletConfig)) as Record<string, unknown>,
    blueprintJson: preview.blueprintJson,
    mapaVariante: JSON.parse(JSON.stringify(preview.mapaVariante)) as PreviewArchivadoValidado['mapaVariante']
  } satisfies PreviewArchivadoValidado;
}

export function limpiarPreviewsArchivadosParaTest() {
  previewsPorClave.clear();
}
