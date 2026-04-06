/**
 * useBancoTemas
 *
 * Responsabilidad: Hook de orquestacion de estado/efectos para el feature docente.
 * Limites: Mantener dependencia unidireccional: hooks -> services -> clienteApi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { obtenerTemasBanco } from '../../../services/bancoApi';
import { normalizarNombreTema, type TemaBanco } from '../../../SeccionBanco.helpers';
import type { Periodo } from '../../../tipos';

export function useBancoTemas(periodos: Periodo[], periodoId: string, setPeriodoId: (value: string) => void, puedeLeer: boolean) {
  const [temasBanco, setTemasBanco] = useState<TemaBanco[]>([]);
  const [cargandoTemas, setCargandoTemas] = useState(false);
  const [temaNuevo, setTemaNuevo] = useState('');
  const [creandoTema, setCreandoTema] = useState(false);
  const [temaEditandoId, setTemaEditandoId] = useState<string | null>(null);
  const [temaEditandoNombre, setTemaEditandoNombre] = useState('');
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [archivandoTemaId, setArchivandoTemaId] = useState<string | null>(null);
  const [temasAbierto, setTemasAbierto] = useState(true);
  const temasPrevLenRef = useRef(0);

  useEffect(() => {
    if (periodoId) return;
    if (!Array.isArray(periodos) || periodos.length === 0) return;
    setPeriodoId(periodos[0]._id);
  }, [periodoId, periodos, setPeriodoId]);

  const refrescarTemas = useCallback(async () => {
    if (!periodoId || !puedeLeer) {
      setTemasBanco([]);
      return;
    }
    try {
      setCargandoTemas(true);
      setTemasBanco(await obtenerTemasBanco(periodoId));
    } finally {
      setCargandoTemas(false);
    }
  }, [periodoId, puedeLeer]);

  useEffect(() => {
    void refrescarTemas();
  }, [refrescarTemas]);

  useEffect(() => {
    const len = Array.isArray(temasBanco) ? temasBanco.length : 0;
    const prev = temasPrevLenRef.current;
    if (len === 0) setTemasAbierto(true);
    if (prev === 0 && len > 0) setTemasAbierto(false);
    temasPrevLenRef.current = len;
  }, [temasBanco]);

  const temaPorDefecto = useMemo(() => {
    const lista = Array.isArray(temasBanco) ? temasBanco : [];
    if (lista.length === 0) return '';
    const masReciente = lista.reduce((acc, item) => {
      if (!acc) return item;
      const cmp = String(item.createdAt || '').localeCompare(String(acc.createdAt || ''));
      return cmp > 0 ? item : acc;
    }, lista[0]);
    return normalizarNombreTema(masReciente?.nombre ?? '');
  }, [temasBanco]);

  return {
    temasBanco,
    setTemasBanco,
    cargandoTemas,
    temaNuevo,
    setTemaNuevo,
    creandoTema,
    setCreandoTema,
    temaEditandoId,
    setTemaEditandoId,
    temaEditandoNombre,
    setTemaEditandoNombre,
    guardandoTema,
    setGuardandoTema,
    archivandoTemaId,
    setArchivandoTemaId,
    temasAbierto,
    setTemasAbierto,
    temaPorDefecto,
    refrescarTemas
  };
}
