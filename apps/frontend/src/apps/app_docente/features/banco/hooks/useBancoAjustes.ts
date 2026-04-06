/**
 * useBancoAjustes
 *
 * Responsabilidad: Hook de orquestacion de estado/efectos para el feature docente.
 * Limites: Mantener dependencia unidireccional: hooks -> services -> clienteApi.
 */
import { useMemo, useState } from 'react';
import { estimarPaginasParaPreguntas, normalizarNombreTema, type TemaBanco } from '../../../SeccionBanco.helpers';
import type { Pregunta } from '../../../tipos';
import { obtenerVersionPregunta } from '../../../utilidades';

export function useBancoAjustes(temasBanco: TemaBanco[], preguntasMateria: Pregunta[], paginasEstimadasBackendPorTema: Map<string, number>) {
  const [ajusteTemaId, setAjusteTemaId] = useState<string | null>(null);
  const [ajustePaginasObjetivo, setAjustePaginasObjetivo] = useState<number>(1);
  const [ajusteAccion, setAjusteAccion] = useState<'mover' | 'quitar'>('mover');
  const [ajusteTemaDestinoId, setAjusteTemaDestinoId] = useState<string>('');
  const [ajusteSeleccion, setAjusteSeleccion] = useState<Set<string>>(new Set());
  const [moviendoTema, setMoviendoTema] = useState(false);

  const [sinTemaDestinoId, setSinTemaDestinoId] = useState<string>('');
  const [sinTemaSeleccion, setSinTemaSeleccion] = useState<Set<string>>(new Set());
  const [moviendoSinTema, setMoviendoSinTema] = useState(false);

  const conteoPorTema = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1);
    }
    return mapa;
  }, [preguntasMateria]);

  const paginasPorTema = useMemo(() => {
    const grupos = new Map<string, Pregunta[]>();
    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      const key = nombre.toLowerCase();
      const arr = grupos.get(key);
      if (arr) arr.push(pregunta);
      else grupos.set(key, [pregunta]);
    }
    const mapa = new Map<string, number>();
    for (const [key, preguntasTema] of grupos.entries()) {
      const backend = paginasEstimadasBackendPorTema.get(key);
      if (typeof backend === 'number' && Number.isFinite(backend)) mapa.set(key, backend);
      else mapa.set(key, estimarPaginasParaPreguntas(preguntasTema));
    }
    return mapa;
  }, [preguntasMateria, paginasEstimadasBackendPorTema]);

  const preguntasPorTemaId = useMemo(() => {
    const mapa = new Map<string, Pregunta[]>();
    const porNombre = new Map<string, string>();
    for (const t of temasBanco) porNombre.set(normalizarNombreTema(t.nombre).toLowerCase(), t._id);
    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      const id = porNombre.get(nombre.toLowerCase());
      if (!id) continue;
      const arr = mapa.get(id);
      if (arr) arr.push(pregunta);
      else mapa.set(id, [pregunta]);
    }
    return mapa;
  }, [preguntasMateria, temasBanco]);

  function estimarAltoPregunta(pregunta: Pregunta): number {
    const version = obtenerVersionPregunta(pregunta);
    const enunciado = String(version?.enunciado ?? '').trim();
    const opciones = Array.isArray(version?.opciones) ? version.opciones : [];
    const base = Math.max(40, Math.ceil(enunciado.length / 35) * 9 + opciones.length * 8);
    const imagen = String(version?.imagenUrl ?? '').trim() ? 45 : 0;
    return base + imagen;
  }

  function sugerirPreguntasARecortar(preguntasTema: Pregunta[], paginasObjetivo: number): string[] {
    const objetivo = Math.max(1, Math.floor(Number(paginasObjetivo) || 1));
    const orden = [...(Array.isArray(preguntasTema) ? preguntasTema : [])];
    const seleccion: string[] = [];
    while (orden.length > 0 && estimarPaginasParaPreguntas(orden) > objetivo) {
      const quitada = orden.pop();
      if (!quitada?._id) break;
      seleccion.push(quitada._id);
    }
    return seleccion;
  }

  return {
    ajusteTemaId,
    setAjusteTemaId,
    ajustePaginasObjetivo,
    setAjustePaginasObjetivo,
    ajusteAccion,
    setAjusteAccion,
    ajusteTemaDestinoId,
    setAjusteTemaDestinoId,
    ajusteSeleccion,
    setAjusteSeleccion,
    moviendoTema,
    setMoviendoTema,
    sinTemaDestinoId,
    setSinTemaDestinoId,
    sinTemaSeleccion,
    setSinTemaSeleccion,
    moviendoSinTema,
    setMoviendoSinTema,
    conteoPorTema,
    paginasPorTema,
    preguntasPorTemaId,
    estimarAltoPregunta,
    sugerirPreguntasARecortar
  };
}
