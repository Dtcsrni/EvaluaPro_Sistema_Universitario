import { useCallback } from 'react';
import { accionToastSesionParaError } from '../../../../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../../../../servicios_api/clienteApi';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { clienteApi } from '../../../clienteApiDocente';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../../../tipos';
import { mensajeDeError } from '../../../utilidades';

type Params = {
  avisarSinPermiso: (mensaje: string) => void;
  puedeDescargarExamenes: boolean;
  puedeAnalizarOmr: boolean;
  setCargandoAssessmentId: (value: string | null) => void;
  setAssessmentDetalle: (value: GeneratedAssessmentDetalle | null) => void;
  setProcesandoOmr: (value: boolean) => void;
  setJobOmr: (value: OmrJobDetalle | null) => void;
  setMensajeGeneracion: (value: string) => void;
};

async function leerArchivoComoDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

async function descargarArchivoProtegido(url: string, fileName: string) {
  const token = obtenerTokenDocente();
  if (!token) throw new Error('Sesion no valida');
  let response = await fetch(`${clienteApi.baseApi}${url}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) {
    const nuevo = await clienteApi.intentarRefrescarToken();
    if (nuevo) {
      response = await fetch(`${clienteApi.baseApi}${url}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${nuevo}` }
      });
    }
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function usePlantillasOmrV1Actions({
  avisarSinPermiso,
  puedeDescargarExamenes,
  puedeAnalizarOmr,
  setCargandoAssessmentId,
  setAssessmentDetalle,
  setProcesandoOmr,
  setJobOmr,
  setMensajeGeneracion
}: Params) {
  const cargarAssessmentDetalle = useCallback(
    async (assessmentId: string) => {
      try {
        setCargandoAssessmentId(assessmentId);
        const payload = await clienteApi.obtener<GeneratedAssessmentDetalle>(`/assessments/generated/${encodeURIComponent(assessmentId)}`);
        setAssessmentDetalle(payload);
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo cargar el detalle OMR V1');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'OMR V1',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setCargandoAssessmentId(null);
      }
    },
    [setAssessmentDetalle, setCargandoAssessmentId, setMensajeGeneracion]
  );

  const descargarArtifact = useCallback(
    async (url: string | undefined, fileName: string) => {
      if (!puedeDescargarExamenes) {
        avisarSinPermiso('No tienes permiso para descargar artefactos.');
        return;
      }
      const clean = String(url || '').trim();
      if (!clean) return;
      try {
        await descargarArchivoProtegido(clean, fileName);
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo descargar el artefacto');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'Descarga',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      }
    },
    [avisarSinPermiso, puedeDescargarExamenes, setMensajeGeneracion]
  );

  const crearJobOmr = useCallback(
    async (args: { assessmentId: string; files: File[]; sourceType: 'image_batch' | 'camera_capture' | 'pdf' }) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para analizar OMR.');
        return;
      }
      const files = Array.isArray(args.files) ? args.files : [];
      if (files.length === 0) return;
      try {
        setProcesandoOmr(true);
        const capturas = await Promise.all(
          files.map(async (file) => ({
            nombreArchivo: file.name,
            imagenBase64: await leerArchivoComoDataUrl(file)
          }))
        );
        const payload = await clienteApi.enviar<{ job: OmrJobDetalle }>(`/omr/jobs`, {
          generatedAssessmentId: args.assessmentId,
          sourceType: args.sourceType,
          capturas
        });
        setJobOmr(payload.job);
        emitToast({ level: 'ok', title: 'OMR V1', message: 'Capturas procesadas', durationMs: 2200 });
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]
  );

  const resolverHojaOmr = useCallback(
    async (args: {
      jobId: string;
      sheetSerial: string;
      resolutionReason: string;
      finalIdentity?: Record<string, unknown>;
      finalResponses?: Array<{ numeroPregunta: number; opcion: string | null }>;
      overrides?: Record<string, unknown>;
    }) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para revisar OMR.');
        return;
      }
      setProcesandoOmr(true);
      try {
        const payload = await clienteApi.enviar<{ job: OmrJobDetalle }>(
          `/omr/jobs/${encodeURIComponent(args.jobId)}/exceptions/${encodeURIComponent(args.sheetSerial)}/resolve`,
          {
            resolutionReason: args.resolutionReason,
            ...(args.finalIdentity ? { finalIdentity: args.finalIdentity } : {}),
            ...(args.finalResponses ? { finalResponses: args.finalResponses } : {}),
            ...(args.overrides ? { overrides: args.overrides } : {})
          }
        );
        setJobOmr(payload.job);
        emitToast({ level: 'ok', title: 'Revision OMR', message: 'Hoja actualizada', durationMs: 2200 });
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]
  );

  const finalizarJobOmr = useCallback(
    async (jobId: string) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para finalizar jobs OMR.');
        return;
      }
      setProcesandoOmr(true);
      try {
        const payload = await clienteApi.enviar<{ job: OmrJobDetalle }>(`/omr/jobs/${encodeURIComponent(jobId)}/finalize`, {});
        setJobOmr(payload.job);
        emitToast({ level: 'ok', title: 'OMR V1', message: 'Job finalizado', durationMs: 2200 });
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]
  );

  return { cargarAssessmentDetalle, descargarArtifact, crearJobOmr, resolverHojaOmr, finalizarJobOmr };
}
