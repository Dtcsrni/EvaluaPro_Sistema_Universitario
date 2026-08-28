/**
 * Hook para encapsular el estado de previsualización de plantillas (JSON y PDF)
 * y el cálculo derivado de páginas estimadas por tema.
 */
import { useMemo, useState } from 'react';
import type { Plantilla, PreviewPlantilla } from '../tipos';

export function usePlantillasPreviewState(plantillas: Plantilla[]) {
  const [previewPorPlantillaId, setPreviewPorPlantillaId] = useState<Record<string, PreviewPlantilla>>({});
  const [cargandoPreviewPlantillaId, setCargandoPreviewPlantillaId] = useState<string | null>(null);
  const [plantillaPreviewId, setPlantillaPreviewId] = useState<string | null>(null);
  const [previewPdfUrlPorPlantillaId, setPreviewPdfUrlPorPlantillaId] = useState<
    Record<string, { booklet?: string; omrSheet?: string }>
  >({});
  const [cargandoPreviewPdfPlantillaId, setCargandoPreviewPdfPlantillaId] = useState<string | null>(null);

  const paginasEstimadasBackendPorTema = useMemo(() => {
    const mapa = new Map<string, number>();
    const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
    for (const plantilla of listaPlantillas) {
      const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
        ? (((plantilla as unknown as { temas?: unknown[] }).temas ?? []) as unknown[])
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
        : [];
      if (temas.length !== 1) continue;
      const preview = previewPorPlantillaId[plantilla._id];
      if (!preview) continue;
      const paginas = Number(preview.bookletPreview?.pagesEstimated ?? 0);
      if (!Number.isFinite(paginas) || paginas <= 0) continue;
      const key = String(temas[0] ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
      mapa.set(key, Math.floor(paginas));
    }
    return mapa;
  }, [plantillas, previewPorPlantillaId]);

  return {
    previewPorPlantillaId,
    setPreviewPorPlantillaId,
    cargandoPreviewPlantillaId,
    setCargandoPreviewPlantillaId,
    plantillaPreviewId,
    setPlantillaPreviewId,
    previewPdfUrlPorPlantillaId,
    setPreviewPdfUrlPorPlantillaId,
    cargandoPreviewPdfPlantillaId,
    setCargandoPreviewPdfPlantillaId,
    paginasEstimadasBackendPorTema
  };
}
