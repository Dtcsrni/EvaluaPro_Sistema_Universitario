import { useCallback, useEffect, useRef, useState } from 'react';
import { clienteApi } from '../clienteApiDocente';

export type ExamenEntregadoManual = {
  _id: string;
  folio: string;
  alumnoId?: string | null;
  plantillaId?: string;
  tipoExamen?: string;
  plantillaTitulo?: string;
  estado?: string;
  periodoId?: string;
  generadoEn?: string;
  entregadoEn?: string;
};

const LIMITE_EXAMENES_MANUAL = 200;

function filtrarExamenesEntregados(lista: ExamenEntregadoManual[]) {
  return lista
    .filter((item) => ['entregado', 'calificado'].includes(String(item?.estado ?? '').toLowerCase()))
    .sort((a, b) => {
      const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
      const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
      return bTime - aTime;
    });
}

export function useExamenesEntregadosManual() {
  const [alumnoManualId, setAlumnoManualId] = useState('');
  const [examenesManual, setExamenesManual] = useState<ExamenEntregadoManual[]>([]);
  const [cargandoExamenesManual, setCargandoExamenesManual] = useState(false);
  const [errorCargaExamenesManual, setErrorCargaExamenesManual] = useState(false);
  const [cursorExamenesManual, setCursorExamenesManual] = useState<string | null>(null);
  const [hayMasExamenesManual, setHayMasExamenesManual] = useState(false);
  const [cargandoMasExamenesManual, setCargandoMasExamenesManual] = useState(false);
  const [errorCargaMasExamenesManual, setErrorCargaMasExamenesManual] = useState(false);
  const [mensajeCargaMasExamenesManual, setMensajeCargaMasExamenesManual] = useState('');
  const [intentoCargaExamenesManual, setIntentoCargaExamenesManual] = useState(0);
  const solicitudManualRef = useRef(0);

  const seleccionarAlumnoManual = useCallback((valor: string) => {
    if (valor === alumnoManualId) return;
    solicitudManualRef.current += 1;
    setAlumnoManualId(valor);
    setCargandoExamenesManual(Boolean(valor));
    setErrorCargaExamenesManual(false);
    setCursorExamenesManual(null);
    setHayMasExamenesManual(false);
    setCargandoMasExamenesManual(false);
    setErrorCargaMasExamenesManual(false);
    setMensajeCargaMasExamenesManual('');
    setExamenesManual([]);
  }, [alumnoManualId]);

  const reintentarCargaExamenesManual = useCallback(() => {
    if (!alumnoManualId) return;
    setCargandoExamenesManual(true);
    setErrorCargaExamenesManual(false);
    setIntentoCargaExamenesManual((intento) => intento + 1);
  }, [alumnoManualId]);

  useEffect(() => {
    if (!alumnoManualId) {
      setCargandoExamenesManual(false);
      setErrorCargaExamenesManual(false);
      setCursorExamenesManual(null);
      setHayMasExamenesManual(false);
      setCargandoMasExamenesManual(false);
      setErrorCargaMasExamenesManual(false);
      setMensajeCargaMasExamenesManual('');
      return;
    }
    const solicitud = ++solicitudManualRef.current;
    setCargandoExamenesManual(true);
    setErrorCargaExamenesManual(false);
    setCursorExamenesManual(null);
    setHayMasExamenesManual(false);
    setErrorCargaMasExamenesManual(false);
    setMensajeCargaMasExamenesManual('');
    let cancelado = false;
    void clienteApi
      .obtener<{ examenes?: ExamenEntregadoManual[]; nextCursor?: string | null }>(
        `/examenes/generados?alumnoId=${encodeURIComponent(alumnoManualId)}&limite=${LIMITE_EXAMENES_MANUAL}`
      )
      .then((payload) => {
        if (cancelado || solicitud !== solicitudManualRef.current) return;
        const entregados = filtrarExamenesEntregados(Array.isArray(payload?.examenes) ? payload.examenes : []);
        setExamenesManual(entregados);
        const siguienteCursor = String(payload?.nextCursor ?? '').trim() || null;
        setCursorExamenesManual(siguienteCursor);
        setHayMasExamenesManual(Boolean(siguienteCursor));
      })
      .catch(() => {
        if (cancelado || solicitud !== solicitudManualRef.current) return;
        setExamenesManual([]);
        setErrorCargaExamenesManual(true);
      })
      .finally(() => {
        if (!cancelado && solicitud === solicitudManualRef.current) setCargandoExamenesManual(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alumnoManualId, intentoCargaExamenesManual]);

  const cargarMasExamenesManual = useCallback(async () => {
    const cursorSolicitado = cursorExamenesManual;
    if (!alumnoManualId || !cursorSolicitado || cargandoMasExamenesManual) return;
    const alumnoIdSolicitado = alumnoManualId;
    const solicitud = solicitudManualRef.current;
    setCargandoMasExamenesManual(true);
    setErrorCargaMasExamenesManual(false);
    setMensajeCargaMasExamenesManual('');
    try {
      const payload = await clienteApi.obtener<{
        examenes?: ExamenEntregadoManual[];
        nextCursor?: string | null;
      }>(`/examenes/generados?alumnoId=${encodeURIComponent(alumnoIdSolicitado)}&limite=${LIMITE_EXAMENES_MANUAL}&cursor=${encodeURIComponent(cursorSolicitado)}`);
      if (solicitud !== solicitudManualRef.current) return;

      const nuevos = filtrarExamenesEntregados(Array.isArray(payload?.examenes) ? payload.examenes : []);
      setExamenesManual((actuales) => {
        const porId = new Map<string, ExamenEntregadoManual>(actuales.map((examen) => [examen._id, examen]));
        nuevos.forEach((examen) => porId.set(examen._id, examen));
        return filtrarExamenesEntregados(Array.from(porId.values()));
      });
      const siguienteCursor = String(payload?.nextCursor ?? '').trim() || null;
      setCursorExamenesManual(siguienteCursor);
      setHayMasExamenesManual(Boolean(siguienteCursor));
      setMensajeCargaMasExamenesManual(nuevos.length === 1
        ? 'Se cargó 1 examen más.'
        : `Se cargaron ${nuevos.length} exámenes más.`);
    } catch {
      if (solicitud !== solicitudManualRef.current) return;
      setErrorCargaMasExamenesManual(true);
    } finally {
      if (solicitud === solicitudManualRef.current) setCargandoMasExamenesManual(false);
    }
  }, [alumnoManualId, cargandoMasExamenesManual, cursorExamenesManual]);

  return {
    alumnoManualId,
    seleccionarAlumnoManual,
    examenesManual,
    cargandoExamenesManual,
    errorCargaExamenesManual,
    reintentarCargaExamenesManual,
    hayMasExamenesManual,
    cargandoMasExamenesManual,
    errorCargaMasExamenesManual,
    mensajeCargaMasExamenesManual,
    cargarMasExamenesManual
  };
}
