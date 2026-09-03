/**
 * useSesionDocente
 *
 * Responsabilidad: Hook transversal del shell docente.
 * Limites: Mantener estado derivado predecible y efectos idempotentes.
 */
import { useCallback, useEffect, useState } from 'react';
import { limpiarTokenDocente, obtenerTokenDocente } from '../../../servicios_api/clienteApi';
import { ErrorRemoto, onSesionInvalidada } from '../../../servicios_api/clienteComun';
import { clienteApi } from '../clienteApiDocente';
import type { Docente } from '../tipos';
import { obtenerSesionDocenteId } from '../utilidades';

type SetDocente = (value: Docente | null) => void;

type Params = {
  setDocente: SetDocente;
  onCerrarSesion: () => void;
  montadoRef: { current: boolean };
};

export function useSesionDocente({ setDocente, onCerrarSesion, montadoRef }: Params) {
  const [sesionComprobada, setSesionComprobada] = useState(false);

  useEffect(() => {
    return onSesionInvalidada((tipo) => {
      if (tipo !== 'docente') return;
      onCerrarSesion();
    });
  }, [onCerrarSesion]);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        if (!obtenerTokenDocente()) {
          await clienteApi.intentarRefrescarToken();
        }
        if (!activo || !obtenerTokenDocente()) return;

        const payload = await clienteApi.obtener<{ docente: Docente }>('/autenticacion/perfil');
        if (!activo) return;
        setDocente(payload.docente);
      } catch (error) {
        if (!activo) return;
        // Solo descarta una sesión persistida cuando la API confirma que ya
        // no es válida; un fallo de red o un 5xx no debe cerrar la sesión.
        // El cliente ya intentó renovar el token cuando recibió 401.
        if (error instanceof ErrorRemoto && error.detalle?.status === 401) {
          limpiarTokenDocente();
        }
        setDocente(null);
      } finally {
        if (activo) setSesionComprobada(true);
      }
    })();

    return () => {
      activo = false;
    };
  }, [setDocente]);

  const refrescarPerfil = useCallback(async () => {
    if (!obtenerTokenDocente()) return;
    try {
      const payload = await clienteApi.obtener<{ docente: Docente }>('/autenticacion/perfil');
      if (montadoRef.current) setDocente(payload.docente);
    } catch {
      // No interrumpir la sesión si falla el refresh.
    }
  }, [montadoRef, setDocente]);

  useEffect(() => {
    // Reducido: refresco cada 15 minutos para evitar 429
    const intervaloMs = 15 * 60 * 1000;
    const id = window.setInterval(() => {
      void refrescarPerfil();
    }, intervaloMs);
    return () => window.clearInterval(id);
  }, [refrescarPerfil]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refrescarPerfil();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refrescarPerfil]);

  useEffect(() => {
    if (!obtenerTokenDocente()) return;
    obtenerSesionDocenteId();
  }, []);

  return { sesionComprobada };
}
