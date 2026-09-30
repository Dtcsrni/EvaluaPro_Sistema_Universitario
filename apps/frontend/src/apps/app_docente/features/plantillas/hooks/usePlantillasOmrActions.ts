/**
 * usePlantillasOmrActions
 *
 * Responsabilidad: Hook de orquestacion de estado/efectos para el feature docente.
 * Limites: Mantener dependencia unidireccional: hooks -> services -> clienteApi.
 */
import { useCallback } from 'react';
import { accionToastSesionParaError } from '../../../../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../../../../servicios_api/clienteApi';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';
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

async function esperar(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchApiAutenticado(url: string, init: RequestInit = {}) {
  const token = obtenerTokenDocente();
  if (!token) throw new Error('Sesion no valida');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(`${clienteApi.baseApi}${url}`, { ...init, credentials: 'include', headers });
  if (response.status === 401) {
    const refreshed = await clienteApi.intentarRefrescarToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(`${clienteApi.baseApi}${url}`, { ...init, credentials: 'include', headers });
    }
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { mensaje?: string; error?: { mensaje?: string; message?: string } } | null;
    throw new Error(payload?.error?.mensaje || payload?.error?.message || payload?.mensaje || `HTTP ${response.status}`);
  }
  return response;
}
async function leerArchivoComoDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function claveIdempotenciaIngesta(assessmentId: string, files: File[], referencePdf?: File) {
  const fingerprint = [...files, ...(referencePdf ? [referencePdf] : [])].map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|');
  return `evaluapro:omr-ingesta:${assessmentId}:${fingerprint}`;
}

function requestIdIngesta(key: string) {
  const existente = window.sessionStorage.getItem(key);
  if (existente) return existente;
  const nuevo = crypto.randomUUID();
  window.sessionStorage.setItem(key, nuevo);
  return nuevo;
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

export function usePlantillasOmrActions({
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
        const payload = await clienteApi.obtener<GeneratedAssessmentDetalle>(`/examenes/generados/${encodeURIComponent(assessmentId)}`);
        setAssessmentDetalle(payload);
      } catch (error) {
        const msg = mensajeDeError(error, `No se pudo cargar el detalle ${OMR_CANONICAL_DISPLAY_LABEL}`);
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: OMR_CANONICAL_DISPLAY_LABEL,
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

  const obtenerPreviewPaginaOmr = useCallback(
    async (jobId: string, pageIndex: number) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para consultar páginas de una ingesta OMR.');
        throw new Error('Permiso de descarga requerido');
      }
      try {
        const response = await fetchApiAutenticado(`/omr/ingestas/${encodeURIComponent(jobId)}/paginas/${encodeURIComponent(pageIndex)}/preview`);
        return await response.blob();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo cargar la página original');
        emitToast({
          level: 'error',
          title: 'Vista previa OMR',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
        throw error;
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr]
  );

  const obtenerPreviewReferenciaOmr = useCallback(
    async (jobId: string, pageIndex: number, generatedAssessmentId: string, examPage: number) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para consultar páginas de referencia de una ingesta OMR.');
        throw new Error('Permiso de descarga requerido');
      }
      const query = new URLSearchParams({ generatedAssessmentId, examPage: String(examPage) });
      const response = await fetchApiAutenticado(`/omr/ingestas/${encodeURIComponent(jobId)}/paginas/${encodeURIComponent(pageIndex)}/reference-preview?${query}`);
      return await response.blob();
    },
    [avisarSinPermiso, puedeAnalizarOmr]
  );

  const prevalidarReferenciaOmr = useCallback(
    async (args: { assessmentIds: string[]; referencePdf: File }) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para validar referencias OMR.');
        throw new Error('Permiso OMR requerido');
      }
      const ids = [...new Set(args.assessmentIds.map((id) => String(id).trim()).filter(Boolean))];
      if (ids.length === 0) throw new Error('No hay lotes archivados disponibles para cotejar.');
      if (args.referencePdf.type !== 'application/pdf' && !args.referencePdf.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Selecciona un PDF generado como referencia.');
      }
      setProcesandoOmr(true);
      try {
        const form = new FormData();
        form.set('assessmentIds', JSON.stringify(ids));
        form.append('referencia', args.referencePdf, args.referencePdf.name);
        const response = await fetchApiAutenticado('/omr/ingestas/prevalidar-referencia', { method: 'POST', body: form });
        const payload = await response.json().catch(() => null) as {
          reference?: { pages?: number; pagesWithSignedQr?: number };
          candidatesEvaluated?: number;
          matches?: Array<{ assessmentId: string; loteId: string; examCount: number; expectedPages: number; matchedPages: number }>;
          error?: { mensaje?: string; message?: string };
        } | null;
        if (!response.ok || !payload?.reference || !Array.isArray(payload.matches)) {
          throw new Error(payload?.error?.mensaje || payload?.error?.message || 'No se pudo cotejar el PDF de referencia.');
        }
        return payload as {
          reference: { pages: number; pagesWithSignedQr: number };
          candidatesEvaluated: number;
          matches: Array<{ assessmentId: string; loteId: string; examCount: number; expectedPages: number; matchedPages: number }>;
        };
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setProcesandoOmr]
  );

  const crearJobOmr = useCallback(
    async (args: { assessmentId: string; files: File[]; sourceType: 'image_batch' | 'camera_capture' | 'pdf'; referencePdf?: File }) => {
      if (!puedeAnalizarOmr) {
        avisarSinPermiso('No tienes permiso para analizar OMR.');
        return;
      }
      const files = Array.isArray(args.files) ? args.files : [];
      if (files.length === 0) return;
      try {
        setProcesandoOmr(true);
        const contienePdf = files.some((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
        if (contienePdf) {
          if (!files.every((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
            throw new Error('Separa las imágenes y los PDF en jobs distintos.');
          }
          const form = new FormData();
          form.set('generatedAssessmentId', args.assessmentId);
          const storageKey = claveIdempotenciaIngesta(args.assessmentId, files, args.referencePdf);
          form.set('clientRequestId', requestIdIngesta(storageKey));
          files.forEach((file) => form.append('archivos', file, file.name));
          if (args.referencePdf) form.append('referencia', args.referencePdf, args.referencePdf.name);
          const enviado = await fetchApiAutenticado('/omr/ingestas', { method: 'POST', body: form });
          window.sessionStorage.removeItem(storageKey);
          const payload = await enviado.json() as { job: OmrJobDetalle & { packages?: Array<{ id: string; fileName: string; status: string; pageCount: number; course: string; subject: string; partial: string; teacher: string; student: string; group: string; folio: string }> } };
          const leerEstado = async (jobId: string) => {
            const estado = await fetchApiAutenticado(`/omr/ingestas/${encodeURIComponent(jobId)}`);
            const detalle = await estado.json() as { job: OmrJobDetalle; candidateExams?: OmrJobDetalle['candidateExams'] };
            detalle.job.candidateExams = detalle.candidateExams ?? [];
            return detalle.job;
          };
          payload.job = await leerEstado(payload.job.jobId);
          setJobOmr(payload.job);
          const limite = Date.now() + 45 * 60 * 1000;
          while (payload.job.status === 'processing' && Date.now() < limite) {
            await esperar(1500);
            payload.job = await leerEstado(payload.job.jobId);
            setJobOmr(payload.job);
          }
          if (payload.job.status === 'processing') throw new Error('El job sigue procesándose. Puedes volver a consultar su estado.');
          if (payload.job.status === 'failed') throw new Error('El job OMR falló; revisa sus páginas y errores.');
          emitToast({ level: 'ok', title: OMR_CANONICAL_DISPLAY_LABEL, message: `Procesadas ${payload.job.pagesProcessed} páginas; ${payload.job.packages?.length ?? 0} paquetes preparados. No se guardaron calificaciones.`, durationMs: 4200 });
        } else {
          const capturas = await Promise.all(files.map(async (file) => ({ nombreArchivo: file.name, imagenBase64: await leerArchivoComoDataUrl(file) })));
          const payload = await clienteApi.enviar<{ job: OmrJobDetalle }>(`/omr/jobs`, {
            generatedAssessmentId: args.assessmentId,
            sourceType: args.sourceType,
            capturas
          });
          setJobOmr(payload.job);
          emitToast({ level: 'ok', title: OMR_CANONICAL_DISPLAY_LABEL, message: 'Capturas procesadas', durationMs: 2200 });
        }
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo procesar el job OMR');
        emitToast({ level: 'error', title: OMR_CANONICAL_DISPLAY_LABEL, message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]
  );

  const reintentarIngestaPdfOmr = useCallback(async (jobId: string) => {
    if (!puedeAnalizarOmr) {
      avisarSinPermiso('No tienes permiso para analizar OMR.');
      return;
    }
    if (!jobId.trim()) return;
    const storageKey = `evaluapro:omr:reintento:${jobId}`;
    try {
      setProcesandoOmr(true);
      const clientRequestId = window.sessionStorage.getItem(storageKey) || crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, clientRequestId);
      const enviado = await fetchApiAutenticado(`/omr/ingestas/${encodeURIComponent(jobId)}/reintentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientRequestId })
      });
      const respuesta = await enviado.json() as { job: OmrJobDetalle };
      let job = respuesta.job;
      setJobOmr(job);
      const leerEstado = async () => {
        const estado = await fetchApiAutenticado(`/omr/ingestas/${encodeURIComponent(jobId)}`);
        const detalle = await estado.json() as { job: OmrJobDetalle; candidateExams?: OmrJobDetalle['candidateExams'] };
        detalle.job.candidateExams = detalle.candidateExams ?? [];
        return detalle.job;
      };
      const limite = Date.now() + 45 * 60 * 1000;
      while (job.status === 'processing' && Date.now() < limite) {
        await esperar(1500);
        job = await leerEstado();
        setJobOmr(job);
      }
      if (job.status === 'processing') throw new Error('El job sigue procesándose. Puedes volver a consultar su estado.');
      window.sessionStorage.removeItem(storageKey);
      if (job.status === 'failed') throw new Error('El reproceso falló; revisa sus páginas y errores.');
      emitToast({ level: 'ok', title: OMR_CANONICAL_DISPLAY_LABEL, message: `Reprocesadas ${job.pagesProcessed} páginas y preparados ${job.packages?.length ?? 0} paquetes. No se guardaron calificaciones.`, durationMs: 4200 });
    } catch (error) {
      window.sessionStorage.removeItem(storageKey);
      const msg = mensajeDeError(error, 'No se pudo reintentar la ingesta OMR');
      emitToast({ level: 'error', title: OMR_CANONICAL_DISPLAY_LABEL, message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setProcesandoOmr(false);
    }
  }, [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]);

  const resolverHojaOmr = useCallback(
    async (args: {
      jobId: string;
      sheetSerial: string;
      resolutionReason: string;
      ingestionResolution?: { pageIndex: number; generatedAssessmentId?: string; examPage?: number };
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
        const ingestion = args.ingestionResolution;
        const payload = await clienteApi.enviar<{ job: OmrJobDetalle }>(
          ingestion
            ? `/omr/ingestas/${encodeURIComponent(args.jobId)}/paginas/${encodeURIComponent(String(ingestion.pageIndex))}/resolver`
            : `/omr/jobs/${encodeURIComponent(args.jobId)}/exceptions/${encodeURIComponent(args.sheetSerial)}/resolve`,
          ingestion
            ? { ...(ingestion.generatedAssessmentId ? { generatedAssessmentId: ingestion.generatedAssessmentId } : {}), ...(ingestion.examPage ? { examPage: ingestion.examPage } : {}), resolutionReason: args.resolutionReason, ...(args.finalResponses ? { finalResponses: args.finalResponses } : {}) }
            : {
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
        emitToast({ level: 'ok', title: OMR_CANONICAL_DISPLAY_LABEL, message: 'Job finalizado', durationMs: 2200 });
      } finally {
        setProcesandoOmr(false);
      }
    },
    [avisarSinPermiso, puedeAnalizarOmr, setJobOmr, setProcesandoOmr]
  );

  return { cargarAssessmentDetalle, descargarArtifact, obtenerPreviewPaginaOmr, obtenerPreviewReferenciaOmr, prevalidarReferenciaOmr, crearJobOmr, reintentarIngestaPdfOmr, resolverHojaOmr, finalizarJobOmr };
}
