/**
 * useRecordatorioPaseLista
 *
 * Responsabilidad: Hook transversal para la alerta del pase de lista de hoy.
 * Limites: Mantener estado derivado predecible y efectos idempotentes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clienteApi } from '../clienteApiDocente';
import type { Docente, Periodo } from '../tipos';

type Params = {
  docente: Docente | null;
  permisosUI: { asistencias?: { leer?: boolean } };
  periodos: Periodo[];
};

export function useRecordatorioPaseLista({ docente, permisosUI, periodos }: Params) {
  const [recordatorioPaseLista, setRecordatorioPaseLista] = useState(false);
  const recordatorioCerradoRef = useRef(false);

  const verificarRecordatorioPaseLista = useCallback(() => {
    if (!docente || !permisosUI.asistencias?.leer || periodos.length === 0 || recordatorioCerradoRef.current) {
      setRecordatorioPaseLista(false);
      return;
    }
    const hoyStr = new Date().toISOString().slice(0, 10);
    clienteApi
      .obtener<{ sesiones: Array<{ fecha: string }> }>(`/asistencias/sesiones?periodoId=${periodos[0]._id}`)
      .then((data) => {
        const tieneHoy = (data.sesiones ?? []).some((s) => s.fecha.startsWith(hoyStr));
        setRecordatorioPaseLista(!tieneHoy);
      })
      .catch(() => {
        setRecordatorioPaseLista(false);
      });
  }, [docente, periodos, permisosUI.asistencias]);

  const cerrarRecordatorioPaseLista = useCallback(() => {
    recordatorioCerradoRef.current = true;
    setRecordatorioPaseLista(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    verificarRecordatorioPaseLista();
  }, [periodos, verificarRecordatorioPaseLista]);

  return {
    recordatorioPaseLista,
    cerrarRecordatorioPaseLista
  };
}
