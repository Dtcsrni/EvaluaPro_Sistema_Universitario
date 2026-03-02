import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clienteApi } from '../clienteApiDocente';
import type { RegistroSincronizacion } from '../tipos';
import { mensajeDeError } from '../utilidades';
import {
  calcularTotalesPorEstado,
  filtrarHistorialSincronizacion,
  formatearFechaSincronizacion,
  normalizarEstadoSincronizacion,
  ordenarSincronizacionesRecientes
} from '../sincronizacionUtils';

export function useEstadoSincronizacion({
  ultimaActualizacionDatos,
  limite = 12,
  autoRefreshMs = 45_000
}: {
  ultimaActualizacionDatos: number | null;
  limite?: number;
  autoRefreshMs?: number;
}) {
  const [sincronizaciones, setSincronizaciones] = useState<RegistroSincronizacion[]>([]);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filtroHistorial, setFiltroHistorial] = useState('');
  const montadoRef = useRef(true);

  const fechaActualizacion = useMemo(() => {
    if (!ultimaActualizacionDatos) return '-';
    return formatearFechaSincronizacion(ultimaActualizacionDatos);
  }, [ultimaActualizacionDatos]);

  const ordenadas = useMemo(() => ordenarSincronizacionesRecientes(sincronizaciones), [sincronizaciones]);
  const historialFiltrado = useMemo(() => filtrarHistorialSincronizacion(ordenadas, filtroHistorial), [filtroHistorial, ordenadas]);
  const sincronizacionReciente = ordenadas[0];
  const estadoReciente = useMemo(
    () => normalizarEstadoSincronizacion(sincronizacionReciente?.estado),
    [sincronizacionReciente?.estado]
  );
  const totalesEstado = useMemo(() => calcularTotalesPorEstado(ordenadas), [ordenadas]);

  const refrescarEstado = useCallback(() => {
    setCargandoEstado(true);
    setErrorEstado('');

    clienteApi
      .obtener<{ sincronizaciones?: RegistroSincronizacion[] }>(`/sincronizaciones?limite=${limite}`)
      .then((payload) => {
        if (!montadoRef.current) return;
        const lista = Array.isArray(payload.sincronizaciones) ? payload.sincronizaciones : [];
        setSincronizaciones(lista);
      })
      .catch((error) => {
        if (!montadoRef.current) return;
        setSincronizaciones([]);
        setErrorEstado(mensajeDeError(error, 'No se pudo obtener el estado de sincronización'));
      })
      .finally(() => {
        if (!montadoRef.current) return;
        setCargandoEstado(false);
      });
  }, [limite]);

  useEffect(() => {
    montadoRef.current = true;
    const id = window.setTimeout(() => {
      void refrescarEstado();
    }, 0);

    return () => {
      window.clearTimeout(id);
      montadoRef.current = false;
    };
  }, [refrescarEstado]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (!montadoRef.current) return;
      refrescarEstado();
    }, autoRefreshMs);

    return () => {
      window.clearInterval(id);
    };
  }, [autoRefresh, autoRefreshMs, refrescarEstado]);

  return {
    sincronizaciones,
    ordenadas,
    historialFiltrado,
    sincronizacionReciente,
    estadoReciente,
    totalesEstado,
    fechaActualizacion,
    cargandoEstado,
    errorEstado,
    autoRefresh,
    filtroHistorial,
    setAutoRefresh,
    setFiltroHistorial,
    refrescarEstado
  };
}