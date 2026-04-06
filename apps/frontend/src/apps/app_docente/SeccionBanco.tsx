/**
 * Seccion de banco de preguntas.
 *
 * Responsabilidad:
 * - Gestion de preguntas (crear/editar/archivar)
 * - Gestion de temas por periodo
 * - Ajustes masivos de reactivos por tema
 *
 * Nota de mantenimiento:
 * La UI esta fragmentada en components/features; este archivo concentra
 * la orquestacion de estado hasta completar la extraccion total a hooks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { estimarPaginasParaPreguntas, normalizarNombreTema, type TemaBanco } from './SeccionBanco.helpers';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type { EnviarConPermiso, Periodo, PermisosUI, Pregunta } from './tipos';
import {
  esMensajeError,  mensajeDeError,
  obtenerVersionPregunta
} from './utilidades';
import { BancoFormularioPregunta } from './features/banco/components/BancoFormularioPregunta';
import { BancoGestionTemas } from './features/banco/components/BancoGestionTemas';
import { BancoListadoPreguntas } from './features/banco/components/BancoListadoPreguntas';
import { estimarAltoPregunta, sugerirPreguntasARecortar } from './features/banco/hooks/estimadoresBanco';
export function SeccionBanco({
  preguntas,
  periodos,
  permisos,
  enviarConPermiso,
  avisarSinPermiso,
  onRefrescar,
  onRefrescarPlantillas,
  paginasEstimadasBackendPorTema
}: {
  preguntas: Pregunta[];
  periodos: Periodo[];
  permisos: PermisosUI;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
  onRefrescar: () => void;
  onRefrescarPlantillas: () => void;
  paginasEstimadasBackendPorTema: Map<string, number>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [tema, setTema] = useState('');
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
  const puedeLeer = permisos.banco.leer;
  const puedeGestionar = permisos.banco.gestionar;
  const puedeArchivar = permisos.banco.archivar;
  const bloqueoEdicion = !puedeGestionar;

  const [ajusteTemaId, setAjusteTemaId] = useState<string | null>(null);
  const [ajustePaginasObjetivo, setAjustePaginasObjetivo] = useState<number>(1);
  const [ajusteAccion, setAjusteAccion] = useState<'mover' | 'quitar'>('mover');
  const [ajusteTemaDestinoId, setAjusteTemaDestinoId] = useState<string>('');
  const [ajusteSeleccion, setAjusteSeleccion] = useState<Set<string>>(new Set());
  const [moviendoTema, setMoviendoTema] = useState(false);

  const [sinTemaDestinoId, setSinTemaDestinoId] = useState<string>('');
  const [sinTemaSeleccion, setSinTemaSeleccion] = useState<Set<string>>(new Set());
  const [moviendoSinTema, setMoviendoSinTema] = useState(false);
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (periodoId) return;
    if (!Array.isArray(periodos) || periodos.length === 0) return;
    setPeriodoId(periodos[0]._id);
  }, [periodoId, periodos]);

  useEffect(() => {
    setTema('');
  }, [periodoId, puedeLeer]);

  const refrescarTemas = useCallback(async () => {
    if (!periodoId) {
      setTemasBanco([]);
      return;
    }
    if (!puedeLeer) {
      setTemasBanco([]);
      return;
    }
    try {
      setCargandoTemas(true);
      const payload = await clienteApi.obtener<{ temas: TemaBanco[] }>(
        `/banco-preguntas/temas?periodoId=${encodeURIComponent(periodoId)}`
      );
      setTemasBanco(Array.isArray(payload.temas) ? payload.temas : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar temas');
      setMensaje(msg);
    } finally {
      setCargandoTemas(false);
    }
  }, [periodoId, puedeLeer]);

  useEffect(() => {
    void refrescarTemas();
  }, [refrescarTemas]);

  // UX: cuando ya existe al menos 1 tema, colapsa la seccion automaticamente.
  useEffect(() => {
    const len = Array.isArray(temasBanco) ? temasBanco.length : 0;
    const prev = temasPrevLenRef.current;

    // Si la materia cambia o se queda sin temas, abre para guiar.
    if (len === 0) setTemasAbierto(true);
    // Si pasamos de 0 -> 1+ (primer tema creado), colapsa.
    if (prev === 0 && len > 0) setTemasAbierto(false);

    temasPrevLenRef.current = len;
  }, [temasBanco]);

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
      if (arr) {
        arr.push(pregunta);
      } else {
        grupos.set(key, [pregunta]);
      }
    }

    const mapa = new Map<string, number>();
    for (const [key, preguntasTema] of grupos.entries()) {
      const backend = paginasEstimadasBackendPorTema.get(key);
      if (typeof backend === 'number' && Number.isFinite(backend)) {
        mapa.set(key, backend);
      } else {
        mapa.set(key, estimarPaginasParaPreguntas(preguntasTema));
      }
    }
    return mapa;
  }, [preguntasMateria, paginasEstimadasBackendPorTema]);

  const paginasTemaActual = useMemo(() => {
    if (!tema.trim()) return 0;
    return preguntasTemaActual.length ? estimarPaginasParaPreguntas(preguntasTemaActual) : 0;
  }, [preguntasTemaActual, tema]);

  const preguntasPorTemaId = useMemo(() => {
    const mapa = new Map<string, Pregunta[]>();
    const temas = Array.isArray(temasBanco) ? temasBanco : [];
    const porNombre = new Map<string, string>();
    for (const t of temas) porNombre.set(normalizarNombreTema(t.nombre).toLowerCase(), t._id);

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

  function abrirAjusteTema(t: TemaBanco) {
    const id = t._id;
    const key = normalizarNombreTema(t.nombre).toLowerCase();
    const actuales = paginasPorTema.get(key) ?? 1;
    const hayDestinos = temasBanco.some((x) => x._id !== t._id);
    setAjusteTemaId(id);
    setAjustePaginasObjetivo(Math.max(1, Number(actuales || 1)));
    setAjusteSeleccion(new Set());
    setAjusteAccion(hayDestinos ? 'mover' : 'quitar');
    setAjusteTemaDestinoId('');
  }

  function cerrarAjusteTema() {
    setAjusteTemaId(null);
    setAjusteSeleccion(new Set());
    setAjusteAccion('mover');
    setAjusteTemaDestinoId('');
  }

  async function aplicarAjusteTema() {
    if (!periodoId) return;
    if (!ajusteTemaId) return;
    const ids = Array.from(ajusteSeleccion);
    if (ids.length === 0) return;

    if (ajusteAccion === 'mover' && !ajusteTemaDestinoId) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar el banco.');
      return;
    }
    try {
      setMoviendoTema(true);
      setMensaje('');

      if (ajusteAccion === 'mover') {
        await enviarConPermiso(
          'banco:gestionar',
          '/banco-preguntas/mover-tema',
          {
            periodoId,
            temaIdDestino: ajusteTemaDestinoId,
            preguntasIds: ids
          },
          'No tienes permiso para mover preguntas.'
        );
        emitToast({ level: 'ok', title: 'Banco', message: `Movidas ${ids.length} preguntas`, durationMs: 2200 });
      } else {
        await enviarConPermiso(
          'banco:gestionar',
          '/banco-preguntas/quitar-tema',
          {
            periodoId,
            preguntasIds: ids
          },
          'No tienes permiso para quitar tema.'
        );
        emitToast({ level: 'ok', title: 'Banco', message: `Quitado el tema a ${ids.length} preguntas`, durationMs: 2400 });
      }

      cerrarAjusteTema();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, ajusteAccion === 'mover' ? 'No se pudieron mover las preguntas' : 'No se pudo quitar el tema');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: ajusteAccion === 'mover' ? 'No se pudo mover' : 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    } finally {
      setMoviendoTema(false);
    }
  }

  async function asignarSinTemaATema() {
    if (!periodoId) return;
    if (!sinTemaDestinoId) return;
    const ids = Array.from(sinTemaSeleccion);
    if (ids.length === 0) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar el banco.');
      return;
    }
    try {
      setMoviendoSinTema(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        '/banco-preguntas/mover-tema',
        {
          periodoId,
          temaIdDestino: sinTemaDestinoId,
          preguntasIds: ids
        },
        'No tienes permiso para mover preguntas.'
      );
      emitToast({ level: 'ok', title: 'Banco', message: `Asignadas ${ids.length} preguntas`, durationMs: 2200 });
      setSinTemaSeleccion(new Set());
      await Promise.resolve().then(() => onRefrescar());
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron asignar las preguntas');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo asignar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setMoviendoSinTema(false);
    }
  }

  const temaPorDefecto = useMemo(() => {
    const lista = Array.isArray(temasBanco) ? temasBanco : [];
    if (lista.length === 0) return '';
    const masReciente = lista.reduce((acc, item) => {
      if (!acc) return item;
      const cmp = String(item.createdAt || '').localeCompare(String(acc.createdAt || ''));
      if (cmp > 0) return item;
      if (cmp < 0) return acc;
      return String(item._id).localeCompare(String(acc._id)) > 0 ? item : acc;
    }, null as TemaBanco | null);
    return masReciente?.nombre ?? '';
  }, [temasBanco]);

  useEffect(() => {
    if (!periodoId) return;
    if (tema.trim()) return;
    if (!temaPorDefecto.trim()) return;
    setTema(temaPorDefecto);
  }, [periodoId, tema, temaPorDefecto]);

  const puedeGuardar = Boolean(
    periodoId &&
      enunciado.trim() &&
      tema.trim() &&
      opciones.every((opcion) => opcion.texto.trim()) &&
      opciones.some((opcion) => opcion.esCorrecta)
  );

  const puedeGuardarEdicion = Boolean(
    editandoId && editEnunciado.trim() && editTema.trim() && editOpciones.every((o) => o.texto.trim())
  );

  function iniciarEdicion(pregunta: Pregunta) {
    const version = obtenerVersionPregunta(pregunta);
    setEditandoId(pregunta._id);
    setEditEnunciado(version?.enunciado ?? '');
    setEditImagenUrl(String(version?.imagenUrl ?? ''));
    setEditTema(String(pregunta.tema ?? '').trim());
    const opcionesActuales = Array.isArray(version?.opciones) ? version?.opciones : [];
    const base = opcionesActuales.length === 5 ? opcionesActuales : editOpciones;
    setEditOpciones(base.map((o) => ({ texto: String(o.texto ?? ''), esCorrecta: Boolean(o.esCorrecta) })));
  }

  function cargarImagenArchivo(file: File | null, setter: (value: string) => void) {
    if (!file) return;
    const maxBytes = 1024 * 1024 * 1.5;
    if (file.size > maxBytes) {
      emitToast({
        level: 'warn',
        title: 'Imagen grande',
        message: 'La imagen supera 1.5MB. Usa una mas ligera para evitar PDFs pesados.',
        durationMs: 4200
      });
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas');
        ctx.drawImage(img, 0, 0, w, h);

        const calidad = 0.8;
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', calidad);
        } catch {
          dataUrl = '';
        }
        if (!dataUrl || dataUrl.startsWith('data:image/png')) {
          dataUrl = canvas.toDataURL('image/jpeg', calidad);
        }
        if (dataUrl) setter(dataUrl);
      } catch {
        emitToast({ level: 'error', title: 'Imagen', message: 'No se pudo comprimir la imagen.', durationMs: 3200 });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      emitToast({ level: 'error', title: 'Imagen', message: 'No se pudo leer la imagen.', durationMs: 3200 });
    };
    img.src = objectUrl;
  }

  async function crearTemaBanco() {
    if (!periodoId) return;
    const nombre = temaNuevo.trim();
    if (!nombre) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar temas.');
      return;
    }
    try {
      setCreandoTema(true);
      setMensaje('');
      await enviarConPermiso('banco:gestionar', '/banco-preguntas/temas', { periodoId, nombre }, 'No tienes permiso para crear temas.');
      setTemaNuevo('');
      await refrescarTemas();
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema creado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo crear', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setCreandoTema(false);
    }
  }

  function iniciarEdicionTema(item: TemaBanco) {
    setTemaEditandoId(item._id);
    setTemaEditandoNombre(item.nombre);
  }

  function cancelarEdicionTema() {
    setTemaEditandoId(null);
    setTemaEditandoNombre('');
  }

  async function guardarEdicionTema() {
    if (!temaEditandoId) return;
    const nombre = temaEditandoNombre.trim();
    if (!nombre) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para editar temas.');
      return;
    }
    try {
      setGuardandoTema(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        `/banco-preguntas/temas/${temaEditandoId}/actualizar`,
        { nombre },
        'No tienes permiso para editar temas.'
      );
      cancelarEdicionTema();
      await Promise.all([refrescarTemas(), Promise.resolve().then(() => onRefrescar()), Promise.resolve().then(() => onRefrescarPlantillas())]);
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema actualizado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo actualizar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setGuardandoTema(false);
    }
  }

  async function archivarTemaBanco(item: TemaBanco) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para archivar temas.');
      return;
    }
    const ok = await confirm({
      title: 'Archivar tema',
      message: `El tema "${item.nombre}" dejará de estar disponible para trabajo activo.`,
      details: ['Se removerá de plantillas y preguntas relacionadas.'],
      confirmLabel: 'Sí, archivar tema',
      tone: 'warning'
    });
    if (!ok) return;
    try {
      setArchivandoTemaId(item._id);
      setMensaje('');
      await enviarConPermiso(
        'banco:archivar',
        `/banco-preguntas/temas/${item._id}/archivar`,
        {},
        'No tienes permiso para archivar temas.'
      );
      if (tema.trim().toLowerCase() === item.nombre.trim().toLowerCase()) setTema('');
      if (editTema.trim().toLowerCase() === item.nombre.trim().toLowerCase()) setEditTema('');
      await Promise.all([refrescarTemas(), Promise.resolve().then(() => onRefrescar()), Promise.resolve().then(() => onRefrescarPlantillas())]);
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema archivado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo archivar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setArchivandoTemaId(null);
    }
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditEnunciado('');
    setEditImagenUrl('');
    setEditTema('');
    setEditOpciones([
      { texto: '', esCorrecta: true },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false }
    ]);
  }

  async function guardar() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para crear preguntas.');
        return;
      }
      setGuardando(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        '/banco-preguntas',
        {
          periodoId,
          enunciado: enunciado.trim(),
          imagenUrl: imagenUrl.trim() ? imagenUrl.trim() : undefined,
          tema: tema.trim(),
          opciones: opciones.map((item) => ({ ...item, texto: item.texto.trim() }))
        },
        'No tienes permiso para crear preguntas.'
      );
      setMensaje('Pregunta guardada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta guardada', durationMs: 2200 });
      registrarAccionDocente('crear_pregunta', true, Date.now() - inicio);
      setEnunciado('');
      setImagenUrl('');
      setTema('');
      setOpciones([
        { texto: '', esCorrecta: true },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false }
      ]);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo guardar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo guardar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_pregunta', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para editar preguntas.');
        return;
      }
      setEditando(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        `/banco-preguntas/${editandoId}/actualizar`,
        {
          enunciado: editEnunciado.trim(),
          imagenUrl: editImagenUrl.trim() ? editImagenUrl.trim() : null,
          tema: editTema.trim(),
          opciones: editOpciones.map((o) => ({ ...o, texto: o.texto.trim() }))
        },
        'No tienes permiso para editar preguntas.'
      );
      setMensaje('Pregunta actualizada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_pregunta', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_pregunta', false);
    } finally {
      setEditando(false);
    }
  }

  async function archivarPregunta(preguntaId: string) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para eliminar preguntas.');
      return;
    }
    const ok = await confirm({
      title: 'Eliminar pregunta',
      message: 'La pregunta se eliminará de forma permanente.',
      details: ['También se quitará de plantillas que la referencien.'],
      confirmLabel: 'Sí, eliminar pregunta',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      const inicio = Date.now();
      setArchivandoPreguntaId(preguntaId);
      setMensaje('');
      await enviarConPermiso(
        'banco:archivar',
        `/banco-preguntas/${preguntaId}/eliminar`,
        {},
        'No tienes permiso para eliminar preguntas.'
      );
      setMensaje('Pregunta eliminada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta eliminada', durationMs: 2200 });
      registrarAccionDocente('eliminar_pregunta', true, Date.now() - inicio);
      if (editandoId === preguntaId) cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_pregunta', false);
    } finally {
      setArchivandoPreguntaId(null);
    }
  }

  return (
    <div className="panel banco-panel">
      <BancoFormularioPregunta
        periodoId={periodoId}
        setPeriodoId={setPeriodoId}
        periodos={periodos}
        bloqueoEdicion={bloqueoEdicion}
        enunciado={enunciado}
        setEnunciado={setEnunciado}
        imagenUrl={imagenUrl}
        setImagenUrl={setImagenUrl}
        cargarImagenArchivo={cargarImagenArchivo}
        tema={tema}
        setTema={setTema}
        temasBanco={temasBanco}
        cargandoTemas={cargandoTemas}
        preguntasTemaActualCantidad={preguntasTemaActual.length}
        paginasTemaActual={paginasTemaActual}
        preguntasMateriaCantidad={preguntasMateria.length}
        temasBancoCantidad={temasBanco.length}
        preguntasSinTemaCantidad={preguntasSinTema.length}
        opciones={opciones}
        setOpciones={setOpciones}
        puedeGuardar={puedeGuardar}
        guardando={guardando}
        guardar={guardar}
        mensaje={mensaje}
        esMensajeError={esMensajeError}
        editandoId={editandoId}
        editEnunciado={editEnunciado}
        setEditEnunciado={setEditEnunciado}
        editImagenUrl={editImagenUrl}
        setEditImagenUrl={setEditImagenUrl}
        editTema={editTema}
        setEditTema={setEditTema}
        editOpciones={editOpciones}
        setEditOpciones={setEditOpciones}
        puedeGuardarEdicion={puedeGuardarEdicion}
        editando={editando}
        guardarEdicion={guardarEdicion}
        cancelarEdicion={cancelarEdicion}
      />

      <div className="banco-panel__split">
        <BancoGestionTemas
          periodoId={periodoId}
          temasAbierto={temasAbierto}
          setTemasAbierto={setTemasAbierto}
          temasBanco={temasBanco}
          temaNuevo={temaNuevo}
          setTemaNuevo={setTemaNuevo}
          creandoTema={creandoTema}
          bloqueoEdicion={bloqueoEdicion}
          crearTemaBanco={crearTemaBanco}
          cargandoTemas={cargandoTemas}
          conteoPorTema={conteoPorTema}
          paginasPorTema={paginasPorTema}
          paginasEstimadasBackendPorTema={paginasEstimadasBackendPorTema}
          temaEditandoId={temaEditandoId}
          temaEditandoNombre={temaEditandoNombre}
          setTemaEditandoNombre={setTemaEditandoNombre}
          guardandoTema={guardandoTema}
          iniciarEdicionTema={iniciarEdicionTema}
          guardarEdicionTema={guardarEdicionTema}
          cancelarEdicionTema={cancelarEdicionTema}
          abrirAjusteTema={abrirAjusteTema}
          temaEditando={puedeGestionar}
          archivandoTemaId={archivandoTemaId}
          archivarTemaBanco={archivarTemaBanco}
          ajusteProps={{
            ajusteTemaId,
            ajustePaginasObjetivo,
            setAjustePaginasObjetivo,
            ajusteAccion,
            setAjusteAccion,
            ajusteTemaDestinoId,
            setAjusteTemaDestinoId,
            ajusteSeleccion,
            setAjusteSeleccion,
            preguntasPorTemaId,
            sugerirPreguntasARecortar,
            estimarAltoPregunta,
            cerrarAjusteTema,
            aplicarAjusteTema,
            moviendoTema,
            sinTemaDestinoId,
            setSinTemaDestinoId,
            preguntasSinTema,
            sinTemaSeleccion,
            setSinTemaSeleccion,
            moviendoSinTema,
            asignarSinTemaATema
          }}
        />

        <BancoListadoPreguntas
          periodoId={periodoId}
          preguntasMateria={preguntasMateria}
          bloqueoEdicion={bloqueoEdicion}
          archivandoPreguntaId={archivandoPreguntaId}
          puedeArchivar={puedeArchivar}
          iniciarEdicion={iniciarEdicion}
          archivarPregunta={archivarPregunta}
        />
      </div>
    </div>
  );
}
