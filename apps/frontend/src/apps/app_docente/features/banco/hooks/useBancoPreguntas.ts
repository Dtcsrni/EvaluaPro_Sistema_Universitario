/**
 * useBancoPreguntas
 *
 * Responsabilidad: Hook de orquestacion de estado/efectos para el feature docente.
 * Limites: Mantener dependencia unidireccional: hooks -> services -> clienteApi.
 */
import { useMemo, useState } from 'react';
import { estimarPaginasParaPreguntas, normalizarNombreTema } from '../../../SeccionBanco.helpers';
import type { Pregunta } from '../../../tipos';

export function useBancoPreguntas(preguntas: Pregunta[], periodoId: string, tema: string) {
  const [enunciado, setEnunciado] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [opciones, setOpciones] = useState([
    { texto: '', esCorrecta: true },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false }
  ]);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editEnunciado, setEditEnunciado] = useState('');
  const [editImagenUrl, setEditImagenUrl] = useState('');
  const [editTema, setEditTema] = useState('');
  const [editOpciones, setEditOpciones] = useState([
    { texto: '', esCorrecta: true },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false }
  ]);
  const [editando, setEditando] = useState(false);
  const [archivandoPreguntaId, setArchivandoPreguntaId] = useState<string | null>(null);

  const preguntasMateria = useMemo(() => {
    const lista = Array.isArray(preguntas) ? preguntas : [];
    const filtradas = periodoId ? lista.filter((p) => p.periodoId === periodoId) : [];
    return [...filtradas].sort((a, b) => {
      const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (porFecha !== 0) return porFecha;
      return String(b._id).localeCompare(String(a._id));
    });
  }, [preguntas, periodoId]);

  const preguntasTemaActual = useMemo(() => {
    const nombre = normalizarNombreTema(tema);
    if (!nombre) return [];
    return preguntasMateria.filter((p) => normalizarNombreTema(p.tema) === nombre);
  }, [preguntasMateria, tema]);

  const preguntasSinTema = useMemo(() => {
    const lista = Array.isArray(preguntasMateria) ? preguntasMateria : [];
    return lista.filter((p) => !normalizarNombreTema(p.tema));
  }, [preguntasMateria]);

  const paginasTemaActual = useMemo(() => {
    if (!tema.trim()) return 0;
    return preguntasTemaActual.length ? estimarPaginasParaPreguntas(preguntasTemaActual) : 0;
  }, [preguntasTemaActual, tema]);

  return {
    enunciado,
    setEnunciado,
    imagenUrl,
    setImagenUrl,
    opciones,
    setOpciones,
    mensaje,
    setMensaje,
    guardando,
    setGuardando,
    editandoId,
    setEditandoId,
    editEnunciado,
    setEditEnunciado,
    editImagenUrl,
    setEditImagenUrl,
    editTema,
    setEditTema,
    editOpciones,
    setEditOpciones,
    editando,
    setEditando,
    archivandoPreguntaId,
    setArchivandoPreguntaId,
    preguntasMateria,
    preguntasTemaActual,
    preguntasSinTema,
    paginasTemaActual
  };
}
