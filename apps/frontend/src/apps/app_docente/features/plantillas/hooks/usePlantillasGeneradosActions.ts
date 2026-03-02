/**
 * usePlantillasGeneradosActions
 *
 * Responsabilidad: Encapsular acciones de examenes generados (descargar, regenerar, eliminar).
 * Limites: No renderiza UI; solo coordina efectos y estado externo.
 */
import { useCallback } from 'react';
import { accionToastSesionParaError } from '../../../../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../../../../servicios_api/clienteApi';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { clienteApi } from '../../../clienteApiDocente';
import { mensajeDeError } from '../../../utilidades';
import type { EnviarConPermiso } from '../../../tipos';

export type ExamenGeneradoResumen = {
  _id: string;
  folio: string;
  loteId?: string;
  plantillaId: string;
  alumnoId?: string | null;
  estado?: string;
  generadoEn?: string;
  descargadoEn?: string;
  paginas?: Array<{ numero: number; qrTexto?: string; preguntasDel?: number; preguntasAl?: number }>;
};

type Params = {
  avisarSinPermiso: (mensaje: string) => void;
  puedeDescargarExamenes: boolean;
  puedeRegenerarExamenes: boolean;
  puedeArchivarExamenes: boolean;
  descargandoExamenId: string | null;
  regenerandoExamenId: string | null;
  archivandoExamenId: string | null;
  setDescargandoExamenId: (value: string | null) => void;
  setRegenerandoExamenId: (value: string | null) => void;
  setArchivandoExamenId: (value: string | null) => void;
  setMensajeGeneracion: (value: string) => void;
  cargarExamenesGenerados: () => Promise<void>;
  enviarConPermiso: EnviarConPermiso;
  lotePdfUrl: string | null;
};

export function usePlantillasGeneradosActions({
  avisarSinPermiso,
  puedeDescargarExamenes,
  puedeRegenerarExamenes,
  puedeArchivarExamenes,
  descargandoExamenId,
  regenerandoExamenId,
  archivandoExamenId,
  setDescargandoExamenId,
  setRegenerandoExamenId,
  setArchivandoExamenId,
  setMensajeGeneracion,
  cargarExamenesGenerados,
  enviarConPermiso,
  lotePdfUrl
}: Params) {
  const descargarPdfExamen = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (descargandoExamenId === examen._id) return;
      if (!puedeDescargarExamenes) {
        avisarSinPermiso('No tienes permiso para descargar examenes.');
        return;
      }
      const token = obtenerTokenDocente();
      if (!token) {
        setMensajeGeneracion('Sesion no valida. Vuelve a iniciar sesion.');
        return;
      }

      const intentar = async (t: string) =>
        fetch(`${clienteApi.baseApi}/examenes/generados/${encodeURIComponent(examen._id)}/pdf`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${t}` }
        });

      try {
        setDescargandoExamenId(examen._id);
        setMensajeGeneracion('');

        let resp = await intentar(token);
        if (resp.status === 401) {
          const nuevo = await clienteApi.intentarRefrescarToken();
          if (nuevo) resp = await intentar(nuevo);
        }

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
        const nombreDesdeHeader = match
          ? decodeURIComponent(String(match[1] || match[2] || match[3] || '').trim().replace(/^"|"$/g, ''))
          : '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreDesdeHeader || `examen_${String(examen.folio || 'examen')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        emitToast({ level: 'ok', title: 'PDF', message: 'Descarga iniciada', durationMs: 1800 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo descargar el PDF');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo descargar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setDescargandoExamenId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      descargandoExamenId,
      puedeDescargarExamenes,
      setDescargandoExamenId,
      setMensajeGeneracion
    ]
  );

  const regenerarPdfExamen = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (regenerandoExamenId === examen._id) return;
      if (!puedeRegenerarExamenes) {
        avisarSinPermiso('No tienes permiso para regenerar examenes.');
        return;
      }
      try {
        setMensajeGeneracion('');
        setRegenerandoExamenId(examen._id);

        const yaDescargado = Boolean(String(examen.descargadoEn || '').trim());

        let forzar = false;
        if (yaDescargado) {
          const ok = globalThis.confirm(
            'Este examen ya fue descargado. Regenerarlo puede cambiar el PDF (y tu copia descargada).\n\n¿Deseas continuar?'
          );
          if (!ok) return;
          forzar = true;
        }

        await enviarConPermiso(
          'examenes:regenerar',
          `/examenes/generados/${encodeURIComponent(examen._id)}/regenerar`,
          { ...(forzar ? { forzar: true } : {}) },
          'No tienes permiso para regenerar examenes.'
        );

        emitToast({ level: 'ok', title: 'Examen', message: 'PDF regenerado', durationMs: 2000 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo regenerar el PDF');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo regenerar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setRegenerandoExamenId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      enviarConPermiso,
      puedeRegenerarExamenes,
      regenerandoExamenId,
      setMensajeGeneracion,
      setRegenerandoExamenId
    ]
  );

  const descargarPdfLote = useCallback(async () => {
    if (!lotePdfUrl) return;
    if (!puedeDescargarExamenes) {
      avisarSinPermiso('No tienes permiso para descargar examenes.');
      return;
    }
    const token = obtenerTokenDocente();
    if (!token) {
      setMensajeGeneracion('Sesion no valida. Vuelve a iniciar sesion.');
      return;
    }
    try {
      const resp = await fetch(`${clienteApi.baseApi}${lotePdfUrl}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const cd = resp.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
      const nombreDesdeHeader = match
        ? decodeURIComponent(String(match[1] || match[2] || match[3] || '').trim().replace(/^"|"$/g, ''))
        : '';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreDesdeHeader || `paquete_examenes.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo descargar el PDF de lote');
      setMensajeGeneracion(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo descargar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    }
  }, [avisarSinPermiso, lotePdfUrl, puedeDescargarExamenes, setMensajeGeneracion]);

  const descargarPdfLotePorId = useCallback(
    async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote) return;
      if (!puedeDescargarExamenes) {
        avisarSinPermiso('No tienes permiso para descargar examenes.');
        return;
      }
      const token = obtenerTokenDocente();
      if (!token) {
        setMensajeGeneracion('Sesion no valida. Vuelve a iniciar sesion.');
        return;
      }
      try {
        const resp = await fetch(`${clienteApi.baseApi}/examenes/generados/lote/${encodeURIComponent(lote)}/pdf`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
        const nombreDesdeHeader = match
          ? decodeURIComponent(String(match[1] || match[2] || match[3] || '').trim().replace(/^"|"$/g, ''))
          : '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreDesdeHeader || `paquete_examenes_${lote}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo descargar el PDF del paquete');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo descargar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      }
    },
    [avisarSinPermiso, puedeDescargarExamenes, setMensajeGeneracion]
  );

  const eliminarExamenGenerado = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (archivandoExamenId === examen._id) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para eliminar examenes.');
        return;
      }
      try {
        setMensajeGeneracion('');
        setArchivandoExamenId(examen._id);

        const ok = globalThis.confirm(
          `¿Eliminar el examen generado (folio: ${String(examen.folio || '').trim() || 'sin folio'})?\n\nSe ocultará del listado activo, pero no se borrarán sus datos.`
        );
        if (!ok) return;

        await enviarConPermiso(
          'examenes:archivar',
          `/examenes/generados/${encodeURIComponent(examen._id)}/archivar`,
          {},
          'No tienes permiso para eliminar examenes.'
        );

        emitToast({ level: 'ok', title: 'Examen', message: 'Examen eliminado', durationMs: 2000 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo eliminar el examen');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo eliminar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setArchivandoExamenId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      enviarConPermiso,
      puedeArchivarExamenes,
      archivandoExamenId,
      setArchivandoExamenId,
      setMensajeGeneracion
    ]
  );

  return {
    descargarPdfExamen,
    descargarPdfLote,
    descargarPdfLotePorId,
    regenerarPdfExamen,
    eliminarExamenGenerado
  };
}
