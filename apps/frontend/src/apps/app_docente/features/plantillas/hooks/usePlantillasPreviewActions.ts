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

export type PreviewPdfPage = { numero: number; width: number; height: number; dataUrl: string };
type PreviewPdfKind = 'booklet' | 'omrSheet';
export type PreviewPdfUrls = { booklet?: string; omrSheet?: string; bookletPages?: PreviewPdfPage[]; omrSheetPages?: PreviewPdfPage[] };

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
          `/examenes/plantillas/${encodeURIComponent(id)}/previsualizar`
        );
        setPreviewPorPlantillaId((prev) => ({ ...prev, [id]: payload }));
        emitToast({ level: 'ok', title: 'Previsualización', message: 'Boceto actualizado', durationMs: 1800 });
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
    async (id: string, kind: PreviewPdfKind = 'booklet') => {
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

      const intentar = async (t: string) =>
        fetch(`${clienteApi.baseApi}/examenes/plantillas/${encodeURIComponent(id)}/previsualizar/pdf/visual?refresh=${Date.now()}`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${t}` }
        });

      try {
        setCargandoPreviewPdfPlantillaId(id);
        emitToast({ level: 'info', title: 'Previsualización PDF', message: 'Renderizando PDF…', durationMs: 1800 });
        let resp = await intentar(token);
        if (resp.status === 401) {
          const nuevo = await clienteApi.intentarRefrescarToken();
          if (nuevo) resp = await intentar(nuevo);
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const payload = (await resp.json()) as {
          pdfBase64?: string;
          paginas?: PreviewPdfPage[];
        };
        if (!payload.pdfBase64 || !Array.isArray(payload.paginas) || payload.paginas.length === 0) {
          throw new Error('La previsualización visual no contiene páginas renderizadas.');
        }
        const bytes = Uint8Array.from(atob(payload.pdfBase64), (caracter) => caracter.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const pagesKey = kind === 'booklet' ? 'bookletPages' : 'omrSheetPages';
        setPreviewPdfUrlPorPlantillaId((prev) => {
          const anterior = prev[id]?.[kind];
          if (typeof anterior === 'string') URL.revokeObjectURL(anterior);
          return { ...prev, [id]: { ...prev[id], [kind]: url, [pagesKey]: payload.paginas } };
        });
        emitToast({ level: 'ok', title: 'Previsualización PDF', message: 'PDF actualizado', durationMs: 2200 });
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo generar el PDF de previsualizacion');
        emitToast({
          level: 'error',
          title: 'Previsualizacion PDF',
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
      puedePrevisualizarPlantillas,
      setCargandoPreviewPdfPlantillaId,
      setPreviewPdfUrlPorPlantillaId
    ]
  );

  const cerrarPreviewPdfPlantilla = useCallback(
    (id: string, kind?: PreviewPdfKind) => {
      emitToast({ level: 'info', title: 'Previsualización PDF', message: 'PDF cerrado', durationMs: 1600 });
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
        if (typeof actual[kind] === 'string') URL.revokeObjectURL(actual[kind] as string);
        const siguiente = { ...actual };
        delete siguiente[kind];
        delete siguiente[kind === 'booklet' ? 'bookletPages' : 'omrSheetPages'];
        if (!siguiente.booklet && !siguiente.omrSheet) delete copia[id];
        else copia[id] = siguiente;
        return copia;
      });
    },
    [setPreviewPdfUrlPorPlantillaId]
  );

  return { cargarPreviewPlantilla, togglePreviewPlantilla, cargarPreviewPdfPlantilla, cerrarPreviewPdfPlantilla };
}
