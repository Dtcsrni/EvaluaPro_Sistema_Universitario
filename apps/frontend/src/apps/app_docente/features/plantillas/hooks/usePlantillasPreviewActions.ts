/**
 * usePlantillasPreviewActions
 *
 * Responsabilidad: Encapsular acciones de previsualizacion JSON/PDF de plantillas.
 * Limites: No renderiza UI; solo coordina permisos, IO y estado externo.
 */
import { useCallback } from 'react';
import { accionToastSesionParaError } from '../../../../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../../../../servicios_api/clienteApi';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { clienteApi } from '../../../clienteApiDocente';
import type { PreviewPlantilla } from '../../../tipos';
import { mensajeDeError } from '../../../utilidades';
import type { Dispatch, SetStateAction } from 'react';

type PreviewPdfUrls = { booklet?: string; omrSheet?: string };

type Params = {
  puedePrevisualizarPlantillas: boolean;
  avisarSinPermiso: (mensaje: string) => void;
  previewPorPlantillaId: Record<string, PreviewPlantilla>;
  cargandoPreviewPlantillaId: string | null;
  cargandoPreviewPdfPlantillaId: string | null;
  setPreviewPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPlantilla>>>;
  setCargandoPreviewPlantillaId: Dispatch<SetStateAction<string | null>>;
  setPlantillaPreviewId: Dispatch<SetStateAction<string | null>>;
  setPreviewPdfUrlPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPdfUrls>>>;
  setCargandoPreviewPdfPlantillaId: Dispatch<SetStateAction<string | null>>;
};

export function usePlantillasPreviewActions({
  puedePrevisualizarPlantillas,
  avisarSinPermiso,
  previewPorPlantillaId,
  cargandoPreviewPlantillaId,
  cargandoPreviewPdfPlantillaId,
  setPreviewPorPlantillaId,
  setCargandoPreviewPlantillaId,
  setPlantillaPreviewId,
  setPreviewPdfUrlPorPlantillaId,
  setCargandoPreviewPdfPlantillaId
}: Params) {
  const cargarPreviewPlantilla = useCallback(
    async (id: string) => {
      if (cargandoPreviewPlantillaId === id) return;
      if (!puedePrevisualizarPlantillas) {
        avisarSinPermiso('No tienes permiso para previsualizar plantillas.');
        return;
      }
      try {
        setCargandoPreviewPlantillaId(id);
        const payload = await clienteApi.obtener<PreviewPlantilla>(
          `/assessments/templates/${encodeURIComponent(id)}/preview`
        );
        setPreviewPorPlantillaId((prev) => ({ ...prev, [id]: payload }));
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo generar la previsualizacion de la plantilla');
        emitToast({
          level: 'error',
          title: 'Previsualizacion',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setCargandoPreviewPlantillaId(null);
      }
    },
    [
      avisarSinPermiso,
      cargandoPreviewPlantillaId,
      puedePrevisualizarPlantillas,
      setCargandoPreviewPlantillaId,
      setPreviewPorPlantillaId
    ]
  );

  const togglePreviewPlantilla = useCallback(
    async (id: string) => {
      if (cargandoPreviewPlantillaId === id) return;
      setPlantillaPreviewId((prev) => (prev === id ? null : id));
      if (!previewPorPlantillaId[id]) {
        await cargarPreviewPlantilla(id);
      }
    },
    [cargandoPreviewPlantillaId, cargarPreviewPlantilla, previewPorPlantillaId, setPlantillaPreviewId]
  );

  const cargarPreviewPdfPlantilla = useCallback(
    async (id: string, kind: keyof PreviewPdfUrls = 'booklet') => {
      if (cargandoPreviewPdfPlantillaId === id) return;
      if (!puedePrevisualizarPlantillas) {
        avisarSinPermiso('No tienes permiso para previsualizar plantillas.');
        return;
      }
      const token = obtenerTokenDocente();
      if (!token) {
        emitToast({ level: 'error', title: 'Sesion no valida', message: 'Vuelve a iniciar sesion.', durationMs: 4200 });
        return;
      }

      const path =
        kind === 'omrSheet'
          ? `/assessments/templates/${encodeURIComponent(id)}/preview/omr-sheet.pdf`
          : `/assessments/templates/${encodeURIComponent(id)}/preview/booklet.pdf`;
      const preview = previewPorPlantillaId[id];
      const params = new URLSearchParams();
      if (preview?.proposedGenerationSeed) params.set('generationSeed', preview.proposedGenerationSeed);
      const pathConQuery = params.size > 0 ? `${path}?${params.toString()}` : path;

      const intentar = async (t: string) =>
        fetch(`${clienteApi.baseApi}${pathConQuery}`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${t}` }
        });

      try {
        setCargandoPreviewPdfPlantillaId(id);
        let resp = await intentar(token);
        if (resp.status === 401) {
          const nuevo = await clienteApi.intentarRefrescarToken();
          if (nuevo) resp = await intentar(nuevo);
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrlPorPlantillaId((prev) => {
          const anterior = prev[id]?.[kind];
          if (anterior) URL.revokeObjectURL(anterior);
          return { ...prev, [id]: { ...prev[id], [kind]: url } };
        });
      } catch (error) {
        const msg = mensajeDeError(error, `No se pudo generar el PDF de ${kind === 'omrSheet' ? 'hoja OMR' : 'cuadernillo'}`);
        emitToast({
          level: 'error',
          title: kind === 'omrSheet' ? 'Hoja OMR' : 'Cuadernillo',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setCargandoPreviewPdfPlantillaId(null);
      }
    },
    [
      avisarSinPermiso,
      cargandoPreviewPdfPlantillaId,
      previewPorPlantillaId,
      puedePrevisualizarPlantillas,
      setCargandoPreviewPdfPlantillaId,
      setPreviewPdfUrlPorPlantillaId
    ]
  );

  const cerrarPreviewPdfPlantilla = useCallback(
    (id: string, kind?: keyof PreviewPdfUrls) => {
      setPreviewPdfUrlPorPlantillaId((prev) => {
        const actual = prev[id];
        if (!actual) return prev;
        const copia = { ...prev };
        if (!kind) {
          if (actual.booklet) URL.revokeObjectURL(actual.booklet);
          if (actual.omrSheet) URL.revokeObjectURL(actual.omrSheet);
          delete copia[id];
          return copia;
        }
        if (actual[kind]) URL.revokeObjectURL(actual[kind]!);
        const siguiente = { ...actual };
        delete siguiente[kind];
        if (!siguiente.booklet && !siguiente.omrSheet) delete copia[id];
        else copia[id] = siguiente;
        return copia;
      });
    },
    [setPreviewPdfUrlPorPlantillaId]
  );

  return { cargarPreviewPlantilla, togglePreviewPlantilla, cargarPreviewPdfPlantilla, cerrarPreviewPdfPlantilla };
}
