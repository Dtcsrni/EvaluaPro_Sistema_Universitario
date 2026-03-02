/** Seccion de plantillas y generacion de examenes (orquestacion UI + handlers). */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { clienteApi } from './clienteApiDocente';
import { PlantillasFormulario } from './features/plantillas/components/PlantillasFormulario';
import { PlantillasGenerados } from './features/plantillas/components/PlantillasGenerados';
import { PlantillasListado } from './features/plantillas/components/PlantillasListado';
import { PlantillasOmrWorkflow } from './features/plantillas/components/PlantillasOmrWorkflow';
import {
  usePlantillasGeneradosActions,
  type ExamenGeneradoResumen
} from './features/plantillas/hooks/usePlantillasGeneradosActions';
import { usePlantillasOmrV1Actions } from './features/plantillas/hooks/usePlantillasOmrV1Actions';
import { usePlantillasPreviewActions } from './features/plantillas/hooks/usePlantillasPreviewActions';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  EnviarConPermiso,
  GeneratedAssessmentDetalle,
  OmrJobDetalle,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewPlantilla
} from './tipos';
import { idCortoMateria, mensajeDeError } from './utilidades';
export function SeccionPlantillas({
  plantillas,
  periodos,
  preguntas,
  alumnos,
  permisos,
  enviarConPermiso,
  avisarSinPermiso,
  previewPorPlantillaId,
  setPreviewPorPlantillaId,
  cargandoPreviewPlantillaId,
  setCargandoPreviewPlantillaId,
  plantillaPreviewId,
  setPlantillaPreviewId,
  previewPdfUrlPorPlantillaId,
  setPreviewPdfUrlPorPlantillaId,
  cargandoPreviewPdfPlantillaId,
  setCargandoPreviewPdfPlantillaId,
  onRefrescar
}: {
  plantillas: Plantilla[];
  periodos: Periodo[];
  preguntas: Pregunta[];
  alumnos: Alumno[];
  permisos: PermisosUI;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
  previewPorPlantillaId: Record<string, PreviewPlantilla>;
  setPreviewPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPlantilla>>>;
  cargandoPreviewPlantillaId: string | null;
  setCargandoPreviewPlantillaId: Dispatch<SetStateAction<string | null>>;
  plantillaPreviewId: string | null;
  setPlantillaPreviewId: Dispatch<SetStateAction<string | null>>;
  previewPdfUrlPorPlantillaId: Record<string, { booklet?: string; omrSheet?: string }>;
  setPreviewPdfUrlPorPlantillaId: Dispatch<SetStateAction<Record<string, { booklet?: string; omrSheet?: string }>>>;
  cargandoPreviewPdfPlantillaId: string | null;
  setCargandoPreviewPdfPlantillaId: Dispatch<SetStateAction<string | null>>;
  onRefrescar: () => void;
}) {
  /**
   * Texto base orientado a impresión física/OMR.
   * Se reestablece al salir de modo edición para mantener consistencia UX.
   */
  const INSTRUCCIONES_DEFAULT =
    'Por favor conteste las siguientes preguntas referentes al parcial. ' +
    'Rellene el círculo de la respuesta más adecuada, evitando salirse del mismo. ' +
    'Cada pregunta vale 10 puntos si está completa y es correcta.';

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'parcial' | 'global'>('parcial');
  const [periodoId, setPeriodoId] = useState('');
  const [numeroPaginas, setNumeroPaginas] = useState(2);
  const [reactivosObjetivo, setReactivosObjetivo] = useState(20);
  const [defaultVersionCount, setDefaultVersionCount] = useState(1);
  const [sheetFamilyCode, setSheetFamilyCode] = useState('S50_5A_ID5_VR6');
  const [prefillMode, setPrefillMode] = useState<'none' | 'roster' | 'per-student'>('none');
  const [versionMode, setVersionMode] = useState<'single' | 'multi_version'>('single');
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  const [instrucciones, setInstrucciones] = useState(INSTRUCCIONES_DEFAULT);
  const [mensaje, setMensaje] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [mensajeGeneracion, setMensajeGeneracion] = useState('');
  const [lotePdfUrl, setLotePdfUrl] = useState<string | null>(null);
  const [ultimoGenerado, setUltimoGenerado] = useState<ExamenGeneradoResumen | null>(null);
  const [assessmentDetalle, setAssessmentDetalle] = useState<GeneratedAssessmentDetalle | null>(null);
  const [cargandoAssessmentId, setCargandoAssessmentId] = useState<string | null>(null);
  const [procesandoOmr, setProcesandoOmr] = useState(false);
  const [jobOmr, setJobOmr] = useState<OmrJobDetalle | null>(null);
  const [examenesGenerados, setExamenesGenerados] = useState<ExamenGeneradoResumen[]>([]);
  const [cargandoExamenesGenerados, setCargandoExamenesGenerados] = useState(false);
  const [descargandoExamenId, setDescargandoExamenId] = useState<string | null>(null);
  const [regenerandoExamenId, setRegenerandoExamenId] = useState<string | null>(null);
  const [archivandoExamenId, setArchivandoExamenId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [generandoLote, setGenerandoLote] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [plantillaEditandoId, setPlantillaEditandoId] = useState<string | null>(null);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [archivandoPlantillaId, setArchivandoPlantillaId] = useState<string | null>(null);
  const [filtroPlantillas, setFiltroPlantillas] = useState('');
  const [refrescandoPlantillas, setRefrescandoPlantillas] = useState(false);
  const puedeLeerExamenes = permisos.examenes.leer;
  const puedeGenerarExamenes = permisos.examenes.generar;
  const puedeArchivarExamenes = permisos.examenes.archivar;
  const puedeRegenerarExamenes = permisos.examenes.regenerar;
  const puedeDescargarExamenes = permisos.examenes.descargar;
  const puedeAnalizarOmr = permisos.omr.analizar;
  const puedeGestionarPlantillas = permisos.plantillas.gestionar;
  const puedeArchivarPlantillas = permisos.plantillas.archivar;
  const puedePrevisualizarPlantillas = permisos.plantillas.previsualizar;
  const bloqueoEdicion = !puedeGestionarPlantillas;

  // Estado solo de presentación para vista ampliada del preview PDF.
  const [pdfFullscreenUrl, setPdfFullscreenUrl] = useState<string | null>(null);

  const abrirPdfFullscreen = useCallback((url: string) => {
    const u = String(url || '').trim();
    if (!u) return;
    setPdfFullscreenUrl(u);
  }, []);

  const cerrarPdfFullscreen = useCallback(() => {
    setPdfFullscreenUrl(null);
  }, []);

  const plantillaSeleccionada = useMemo(() => {
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaId) ?? null;
  }, [plantillas, plantillaId]);

  const plantillaEditando = useMemo(() => {
    if (!plantillaEditandoId) return null;
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaEditandoId) ?? null;
  }, [plantillas, plantillaEditandoId]);

  // Índice local para resolver alumno por id sin búsquedas O(n) repetidas al renderizar listados.
  const alumnosPorId = useMemo(() => {
    const mapa = new Map<string, Alumno>();
    for (const a of Array.isArray(alumnos) ? alumnos : []) {
      mapa.set(a._id, a);
    }
    return mapa;
  }, [alumnos]);

  const formatearFechaHora = useCallback((valor?: string) => {
    const v = String(valor || '').trim();
    if (!v) return '-';
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return v;
    return d.toLocaleString();
  }, []);

  // Carga el historial de generados de la plantilla seleccionada (máx 50 recientes).
  const cargarExamenesGenerados = useCallback(async () => {
    if (!plantillaId) {
      setExamenesGenerados([]);
      return;
    }
    if (!puedeLeerExamenes) {
      setExamenesGenerados([]);
      return;
    }
    try {
      setCargandoExamenesGenerados(true);
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoResumen[] }>(
        `/examenes/generados?plantillaId=${encodeURIComponent(plantillaId)}&limite=50`
      );
      setExamenesGenerados(Array.isArray(payload.examenes) ? payload.examenes : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el listado de examenes generados');
      setMensajeGeneracion(msg);
    } finally {
      setCargandoExamenesGenerados(false);
    }
  }, [plantillaId, puedeLeerExamenes]);

  useEffect(() => {
    setUltimoGenerado(null);
    setLotePdfUrl(null);
    setAssessmentDetalle(null);
    setJobOmr(null);
    void cargarExamenesGenerados();
  }, [plantillaId, cargarExamenesGenerados]);

  const { descargarPdfExamen, descargarPdfLote, regenerarPdfExamen, archivarExamenGenerado } = usePlantillasGeneradosActions({
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
  });
  const { cargarPreviewPlantilla, togglePreviewPlantilla, cargarPreviewPdfPlantilla, cerrarPreviewPdfPlantilla } =
    usePlantillasPreviewActions({
      puedePrevisualizarPlantillas,
      avisarSinPermiso,
      previewPorPlantillaId,
      cargandoPreviewPlantillaId,
      cargandoPreviewPdfPlantillaId,
      setPreviewPorPlantillaId,
      setCargandoPreviewPlantillaId,
      setPlantillaPreviewId,
      setPreviewPdfUrlPorPlantillaId,
      setCargandoPreviewPdfPlantillaId
    });
  const { cargarAssessmentDetalle, descargarArtifact, crearJobOmr, resolverHojaOmr, finalizarJobOmr } = usePlantillasOmrV1Actions({
    avisarSinPermiso,
    puedeDescargarExamenes,
    puedeAnalizarOmr,
    setCargandoAssessmentId,
    setAssessmentDetalle,
    setProcesandoOmr,
    setJobOmr,
    setMensajeGeneracion
  });

  // Catálogo de preguntas filtrado por materia/periodo activo en el formulario.
  const preguntasDisponibles = useMemo(() => {
    if (!periodoId) return [];
    const lista = Array.isArray(preguntas) ? preguntas : [];
    return lista.filter((p) => p.periodoId === periodoId);
  }, [preguntas, periodoId]);

  // Resumen de temas con conteo, para selección multi-tema y validación de cobertura.
  const temasDisponibles = useMemo(() => {
    const mapa = new Map<string, { tema: string; total: number }>();
    for (const pregunta of preguntasDisponibles) {
      const tema = String(pregunta.tema ?? '').trim().replace(/\s+/g, ' ');
      if (!tema) continue;
      const key = tema.toLowerCase();
      const actual = mapa.get(key);
      if (actual) {
        actual.total += 1;
      } else {
        mapa.set(key, { tema, total: 1 });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.tema.localeCompare(b.tema));
  }, [preguntasDisponibles]);

  const totalDisponiblePorTemas = useMemo(() => {
    if (temasSeleccionados.length === 0) return 0;
    const seleccion = new Set(temasSeleccionados.map((t) => t.toLowerCase()));
    return temasDisponibles
      .filter((t) => seleccion.has(t.tema.toLowerCase()))
      .reduce((acc, item) => acc + item.total, 0);
  }, [temasDisponibles, temasSeleccionados]);

  useEffect(() => {
    setTemasSeleccionados([]);
  }, [periodoId]);

  useEffect(() => {
    // Defaults para creacion.
    if (!modoEdicion) {
      setInstrucciones(INSTRUCCIONES_DEFAULT);
    }
  }, [modoEdicion, INSTRUCCIONES_DEFAULT]);

  const puedeCrear = Boolean(
    titulo.trim() &&
      periodoId &&
      temasSeleccionados.length > 0 &&
      numeroPaginas > 0 &&
      reactivosObjetivo > 0
  );
  const puedeGenerar = Boolean(plantillaId) && puedeGenerarExamenes;
  const normalizarTituloPlantillaUi = (valor: string) => String(valor || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const existeTituloPlantillaDuplicado = (tituloCandidato: string, excluirId?: string) => {
    const candidato = normalizarTituloPlantillaUi(tituloCandidato);
    if (!candidato) return false;
    const lista = Array.isArray(plantillas) ? plantillas : [];
    return lista.some((p) => {
      if (excluirId && p._id === excluirId) return false;
      return normalizarTituloPlantillaUi(String(p.titulo || '')) === candidato;
    });
  };

  // Búsqueda local por título/id/temas (case-insensitive) para UX reactiva.
  const plantillasFiltradas = useMemo(() => {
    const q = String(filtroPlantillas || '').trim().toLowerCase();
    const lista = Array.isArray(plantillas) ? plantillas : [];
    const base = q
      ? lista.filter((p) => {
          const t = String(p.titulo || '').toLowerCase();
          const id = String(p._id || '').toLowerCase();
          const temas = (Array.isArray(p.temas) ? p.temas : []).join(' ').toLowerCase();
          return t.includes(q) || id.includes(q) || temas.includes(q);
        })
      : lista;
    return base;
  }, [plantillas, filtroPlantillas]);

  const totalPlantillas = plantillasFiltradas.length;
  const totalPlantillasTodas = Array.isArray(plantillas) ? plantillas.length : 0;
  const resumenPlantillas = useMemo(() => {
    const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
    const total = listaPlantillas.length;
    const conTemas = listaPlantillas.filter((p) => Array.isArray(p.temas) && p.temas.length > 0).length;
    const totalTemasSeleccionados = listaPlantillas.reduce(
      (acc, p) => acc + (Array.isArray(p.temas) ? p.temas.length : 0),
      0
    );
    return { total, conTemas, totalTemasSeleccionados };
  }, [plantillas]);

  async function refrescarPlantillas() {
    if (refrescandoPlantillas) return;
    try {
      setRefrescandoPlantillas(true);
      await Promise.resolve(onRefrescar());
    } finally {
      setRefrescandoPlantillas(false);
    }
  }

  function limpiarFiltroPlantillas() {
    setFiltroPlantillas('');
  }

  function iniciarEdicion(plantilla: Plantilla) {
    setModoEdicion(true);
    setPlantillaEditandoId(plantilla._id);
    setTitulo(String(plantilla.titulo || ''));
    setTipo(plantilla.tipo);
    setPeriodoId(String(plantilla.periodoId || ''));
    setNumeroPaginas(Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 1));
    setReactivosObjetivo(Number(plantilla.reactivosObjetivo ?? 20));
    setDefaultVersionCount(Number(plantilla.defaultVersionCount ?? 1));
    setSheetFamilyCode(String(plantilla.omrConfig?.sheetFamilyCode ?? 'S50_5A_ID5_VR6'));
    setPrefillMode(plantilla.omrConfig?.prefillMode ?? 'none');
    setVersionMode(plantilla.omrConfig?.versionMode ?? 'single');
    setTemasSeleccionados(Array.isArray(plantilla.temas) ? plantilla.temas : []);
    setInstrucciones(String(plantilla.instrucciones || ''));
    setMensaje('');
  }

  function cancelarEdicion() {
    setModoEdicion(false);
    setPlantillaEditandoId(null);
    setTitulo('');
    setTipo('parcial');
    setPeriodoId('');
    setNumeroPaginas(2);
    setReactivosObjetivo(20);
    setDefaultVersionCount(1);
    setSheetFamilyCode('S50_5A_ID5_VR6');
    setPrefillMode('none');
    setVersionMode('single');
    setTemasSeleccionados([]);
    setInstrucciones(INSTRUCCIONES_DEFAULT);
    setMensaje('');
  }

  async function guardarEdicion() {
    if (!plantillaEditandoId || guardandoPlantilla) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionarPlantillas) {
        avisarSinPermiso('No tienes permiso para editar plantillas.');
        return;
      }
      setGuardandoPlantilla(true);
      setMensaje('');

      if (existeTituloPlantillaDuplicado(titulo, plantillaEditandoId)) {
        const msgDup = 'Ya existe una plantilla activa con ese nombre.';
        setMensaje(msgDup);
        emitToast({ level: 'warn', title: 'Plantillas', message: msgDup, durationMs: 4200 });
        return;
      }

      const payload: Record<string, unknown> = {
        titulo: titulo.trim(),
        tipo,
        numeroPaginas: Math.max(1, Math.floor(numeroPaginas)),
        reactivosObjetivo: Math.max(1, Math.floor(reactivosObjetivo)),
        defaultVersionCount: Math.max(1, Math.floor(defaultVersionCount)),
        answerKeyMode: 'digital',
        bookletConfig: {
          targetPages: Math.max(1, Math.floor(numeroPaginas)),
          densityMode: 'balanced',
          allowImages: true,
          imageBudgetPolicy: 'balanced',
          headerStyle: 'compact',
          fontScale: 1,
          lineSpacing: 1.1,
          separateCoverPage: false
        },
        omrConfig: {
          sheetFamilyCode,
          prefillMode,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          versionMode,
          ignoreUnusedTrailingQuestions: true,
          captureMode: 'pdf_and_mobile'
        },
        instrucciones: String(instrucciones || '').trim() || undefined
      };
      if (periodoId) payload.periodoId = periodoId;

      // Solo enviar temas si hay seleccion o si la plantilla ya estaba en modo temas.
      const temasPrevios =
        plantillaEditando && Array.isArray(plantillaEditando.temas) ? plantillaEditando.temas : [];
      const estabaEnTemas = temasPrevios.length > 0;
      if (temasSeleccionados.length > 0 || estabaEnTemas) {
        payload.temas = temasSeleccionados;
      }

      await enviarConPermiso(
        'plantillas:gestionar',
        `/examenes/plantillas/${encodeURIComponent(plantillaEditandoId)}`,
        payload,
        'No tienes permiso para editar plantillas.'
      );
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_plantilla', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la plantilla');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_plantilla', false);
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function archivarPlantilla(plantilla: Plantilla) {
    if (archivandoPlantillaId === plantilla._id) return;
    if (!puedeArchivarPlantillas) {
      avisarSinPermiso('No tienes permiso para eliminar plantillas.');
      return;
    }
    const ok = globalThis.confirm(
      `¿Eliminar la plantilla "${String(plantilla.titulo || '').trim()}"?\n\nSe borrará junto con examenes y calificaciones relacionadas. Confirma para continuar.`
    );
    if (!ok) return;
    try {
      const inicio = Date.now();
      setArchivandoPlantillaId(plantilla._id);
      setMensaje('');
      await enviarConPermiso(
        'plantillas:archivar',
        `/examenes/plantillas/${encodeURIComponent(plantilla._id)}/eliminar`,
        {},
        'No tienes permiso para eliminar plantillas.'
      );
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla eliminada', durationMs: 2200 });
      registrarAccionDocente('eliminar_plantilla', true, Date.now() - inicio);
      if (plantillaId === plantilla._id) setPlantillaId('');
      if (plantillaEditandoId === plantilla._id) cancelarEdicion();
      if (plantillaPreviewId === plantilla._id) setPlantillaPreviewId(null);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar la plantilla');
      setMensaje(msg);

      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_plantilla', false);
    } finally {
      setArchivandoPlantillaId(null);
    }
  }

  async function crear() {
    if (creando) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionarPlantillas) {
        avisarSinPermiso('No tienes permiso para crear plantillas.');
        return;
      }
      setCreando(true);
      setMensaje('');

      if (existeTituloPlantillaDuplicado(titulo)) {
        const msgDup = 'Ya existe una plantilla activa con ese nombre.';
        setMensaje(msgDup);
        emitToast({ level: 'warn', title: 'Plantillas', message: msgDup, durationMs: 4200 });
        return;
      }

      const payload: Record<string, unknown> = {
        tipo,
        titulo: titulo.trim(),
        instrucciones: String(instrucciones || '').trim() || undefined,
        numeroPaginas: Math.max(1, Math.floor(numeroPaginas)),
        reactivosObjetivo: Math.max(1, Math.floor(reactivosObjetivo)),
        defaultVersionCount: Math.max(1, Math.floor(defaultVersionCount)),
        answerKeyMode: 'digital',
        bookletConfig: {
          targetPages: Math.max(1, Math.floor(numeroPaginas)),
          densityMode: 'balanced',
          allowImages: true,
          imageBudgetPolicy: 'balanced',
          headerStyle: 'compact',
          fontScale: 1,
          lineSpacing: 1.1,
          separateCoverPage: false
        },
        omrConfig: {
          sheetFamilyCode,
          prefillMode,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          versionMode,
          ignoreUnusedTrailingQuestions: true,
          captureMode: 'pdf_and_mobile'
        }
      };
      const periodoIdNorm = String(periodoId || '').trim();
      if (periodoIdNorm) payload.periodoId = periodoIdNorm;
      if (temasSeleccionados.length > 0) payload.temas = temasSeleccionados;

      await enviarConPermiso(
        'plantillas:gestionar',
        '/examenes/plantillas',
        payload,
        'No tienes permiso para crear plantillas.'
      );
      setMensaje('Plantilla creada');
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla creada', durationMs: 2200 });
      registrarAccionDocente('crear_plantilla', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo crear',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_plantilla', false);
    } finally {
      setCreando(false);
    }
  }

  const generarExamen = useCallback(async () => {
    try {
      const inicio = Date.now();
      if (!puedeGenerarExamenes) {
        avisarSinPermiso('No tienes permiso para generar examenes.');
        return;
      }
      setGenerando(true);
      setMensajeGeneracion('');
      const previewActual = plantillaId ? previewPorPlantillaId[plantillaId] : undefined;
      const payload = await enviarConPermiso<{
        examenGenerado?: ExamenGeneradoResumen;
        generatedAssessment?: { _id: string; folio: string; generationSeed?: string; previewFingerprint?: string };
        advertencias?: string[];
      }>(
        'examenes:generar',
        `/assessments/templates/${encodeURIComponent(plantillaId)}/generate`,
        {
          ...(previewActual?.proposedGenerationSeed ? { generationSeed: previewActual.proposedGenerationSeed } : {}),
          ...(previewActual?.previewFingerprint ? { previewFingerprint: previewActual.previewFingerprint } : {}),
          prefillMode,
          versionCount: Math.max(1, defaultVersionCount),
          sheetFamilyCode
        },
        'No tienes permiso para generar examenes.'
      );
      const ex =
        payload?.examenGenerado ??
        (payload?.generatedAssessment
          ? ({ _id: payload.generatedAssessment._id, folio: payload.generatedAssessment.folio } as ExamenGeneradoResumen)
          : null);
      const adv = Array.isArray(payload?.advertencias) ? payload.advertencias : [];
      setUltimoGenerado(ex);
      setMensajeGeneracion(ex ? `Examen generado. Folio: ${ex.folio} (ID: ${idCortoMateria(ex._id)})` : 'Examen generado');
      emitToast({
        level: adv.length > 0 ? 'warn' : 'ok',
        title: 'Examen',
        message: adv.length > 0 ? `Examen generado. ${adv.join(' ')}` : 'Examen generado',
        durationMs: adv.length > 0 ? 6000 : 2200
      });
      registrarAccionDocente('generar_examen', true, Date.now() - inicio);
      const generatedAssessmentId = String(payload?.generatedAssessment?._id ?? ex?._id ?? '').trim();
      if (generatedAssessmentId) {
        await cargarAssessmentDetalle(generatedAssessmentId);
      }
      await cargarExamenesGenerados();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar');
      setMensajeGeneracion(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo generar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('generar_examen', false);
    } finally {
      setGenerando(false);
    }
  }, [
    avisarSinPermiso,
    cargarAssessmentDetalle,
    cargarExamenesGenerados,
    defaultVersionCount,
    enviarConPermiso,
    plantillaId,
    puedeGenerarExamenes,
    prefillMode,
    previewPorPlantillaId,
    sheetFamilyCode
  ]);

  const generarExamenesLote = useCallback(async () => {
    const ok = globalThis.confirm('¿Generar examenes para TODOS los alumnos activos de la materia de esta plantilla? Esto puede tardar.');
    if (!ok) return;
    try {
      const inicio = Date.now();
      if (!puedeGenerarExamenes) {
        avisarSinPermiso('No tienes permiso para generar examenes.');
        return;
      }
      setGenerandoLote(true);
      setMensajeGeneracion('');
      const previewActual = plantillaId ? previewPorPlantillaId[plantillaId] : undefined;
      const payload = await enviarConPermiso<{
        examenesGenerados?: Array<{ folio: string }>;
        generatedAssessment?: { _id: string; folio: string };
        advertencias?: string[];
      }>(
        'examenes:generar',
        `/assessments/templates/${encodeURIComponent(plantillaId)}/generate`,
        {
          ...(previewActual?.proposedGenerationSeed ? { generationSeed: previewActual.proposedGenerationSeed } : {}),
          ...(previewActual?.previewFingerprint ? { previewFingerprint: previewActual.previewFingerprint } : {}),
          prefillMode: 'roster',
          versionCount: Math.max(1, defaultVersionCount),
          sheetFamilyCode
        },
        'No tienes permiso para generar examenes.',
        {
        timeoutMs: 120_000
        }
      );
      const generatedAssessmentId = String(payload?.generatedAssessment?._id ?? '').trim();
      const folio = String(payload?.generatedAssessment?.folio ?? '').trim();
      setLotePdfUrl(null);
      setMensajeGeneracion(folio ? `Generación masiva lista. Assessment: ${folio}. Descarga el ZIP de packets desde OMR V1.` : 'Generación masiva lista.');
      emitToast({ level: 'ok', title: 'Examenes', message: 'Generación masiva completada', durationMs: 2200 });
      registrarAccionDocente('generar_examenes_lote', true, Date.now() - inicio);
      if (generatedAssessmentId) {
        await cargarAssessmentDetalle(generatedAssessmentId);
      }
      await cargarExamenesGenerados();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar en lote');
      setMensajeGeneracion(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo generar en lote',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('generar_examenes_lote', false);
    } finally {
      setGenerandoLote(false);
    }
  }, [
    avisarSinPermiso,
    cargarAssessmentDetalle,
    cargarExamenesGenerados,
    defaultVersionCount,
    enviarConPermiso,
    plantillaId,
    puedeGenerarExamenes,
    previewPorPlantillaId,
    sheetFamilyCode
  ]);

  return (
    <div className="panel plantillas-shell">
      <div className="plantillas-header">
        <h2>
          <Icono nombre="plantillas" /> Plantillas
        </h2>
        <div className="plantillas-actions">
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            cargando={refrescandoPlantillas}
            onClick={() => void refrescarPlantillas()}
            data-tooltip="Recarga la lista de plantillas desde el servidor."
          >
            {refrescandoPlantillas ? 'Actualizando…' : 'Actualizar'}
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            disabled={!filtroPlantillas.trim()}
            onClick={limpiarFiltroPlantillas}
            data-tooltip="Quita el filtro de busqueda y muestra todas las plantillas."
          >
            Limpiar filtro
          </Boton>
        </div>
      </div>
      <div className="plantillas-resumen" aria-live="polite">
        <div className="plantillas-resumen__item">
          <span>Plantillas</span>
          <b>{resumenPlantillas.total}</b>
        </div>
        <div className="plantillas-resumen__item">
          <span>Con temas</span>
          <b>{resumenPlantillas.conTemas}</b>
        </div>
        <div className="plantillas-resumen__item">
          <span>Temas vinculados</span>
          <b>{resumenPlantillas.totalTemasSeleccionados}</b>
        </div>
        <div className="plantillas-resumen__item">
          <span>Filtro</span>
          <b>{filtroPlantillas.trim() ? 'Activo' : 'Sin filtro'}</b>
        </div>
      </div>

      <div className="plantillas-grid">
        <PlantillasFormulario
          modoEdicion={modoEdicion}
          plantillaEditando={plantillaEditando}
          titulo={titulo}
          setTitulo={setTitulo}
          tipo={tipo}
          setTipo={setTipo}
          periodoId={periodoId}
          setPeriodoId={setPeriodoId}
          periodos={periodos}
          bloqueoEdicion={bloqueoEdicion}
          numeroPaginas={numeroPaginas}
          setNumeroPaginas={setNumeroPaginas}
          reactivosObjetivo={reactivosObjetivo}
          setReactivosObjetivo={setReactivosObjetivo}
          defaultVersionCount={defaultVersionCount}
          setDefaultVersionCount={setDefaultVersionCount}
          sheetFamilyCode={sheetFamilyCode}
          setSheetFamilyCode={setSheetFamilyCode}
          prefillMode={prefillMode}
          setPrefillMode={setPrefillMode}
          versionMode={versionMode}
          setVersionMode={setVersionMode}
          instrucciones={instrucciones}
          setInstrucciones={setInstrucciones}
          temasDisponibles={temasDisponibles}
          temasSeleccionados={temasSeleccionados}
          setTemasSeleccionados={setTemasSeleccionados}
          totalDisponiblePorTemas={totalDisponiblePorTemas}
          creando={creando}
          puedeCrear={puedeCrear}
          crear={crear}
          guardandoPlantilla={guardandoPlantilla}
          guardarEdicion={guardarEdicion}
          cancelarEdicion={cancelarEdicion}
          mensaje={mensaje}
        />

        <PlantillasListado
          totalPlantillasTodas={totalPlantillasTodas}
          totalPlantillas={totalPlantillas}
          filtroPlantillas={filtroPlantillas}
          setFiltroPlantillas={setFiltroPlantillas}
          plantillasFiltradas={plantillasFiltradas}
          periodos={periodos}
          previewPorPlantillaId={previewPorPlantillaId}
          plantillaPreviewId={plantillaPreviewId}
          previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
          cargandoPreviewPlantillaId={cargandoPreviewPlantillaId}
          cargarPreviewPlantilla={cargarPreviewPlantilla}
          puedePrevisualizarPlantillas={puedePrevisualizarPlantillas}
          cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
          cargarPreviewPdfPlantilla={cargarPreviewPdfPlantilla}
          cerrarPreviewPdfPlantilla={cerrarPreviewPdfPlantilla}
          abrirPdfFullscreen={abrirPdfFullscreen}
          pdfFullscreenUrl={pdfFullscreenUrl}
          cerrarPdfFullscreen={cerrarPdfFullscreen}
          togglePreviewPlantilla={togglePreviewPlantilla}
          iniciarEdicion={iniciarEdicion}
          puedeGestionarPlantillas={puedeGestionarPlantillas}
          archivandoPlantillaId={archivandoPlantillaId}
          archivarPlantilla={archivarPlantilla}
          puedeArchivarPlantillas={puedeArchivarPlantillas}
          formatearFechaHora={formatearFechaHora}
        />
      </div>

      <PlantillasGenerados
        plantillaId={plantillaId}
        setPlantillaId={setPlantillaId}
        plantillas={plantillas}
        alumnos={alumnos}
        generando={generando}
        puedeGenerar={puedeGenerar}
        onGenerarExamen={generarExamen}
        generandoLote={generandoLote}
        plantillaSeleccionada={plantillaSeleccionada}
        puedeGenerarExamenes={puedeGenerarExamenes}
        onGenerarExamenesLote={generarExamenesLote}
        mensajeGeneracion={mensajeGeneracion}
        lotePdfUrl={lotePdfUrl}
        descargarPdfLote={descargarPdfLote}
        ultimoGenerado={ultimoGenerado}
        formatearFechaHora={formatearFechaHora}
        cargandoExamenesGenerados={cargandoExamenesGenerados}
        examenesGenerados={examenesGenerados}
        alumnosPorId={alumnosPorId}
        puedeRegenerarExamenes={puedeRegenerarExamenes}
        descargandoExamenId={descargandoExamenId}
        archivandoExamenId={archivandoExamenId}
        regenerarPdfExamen={regenerarPdfExamen}
        puedeDescargarExamenes={puedeDescargarExamenes}
        descargarPdfExamen={descargarPdfExamen}
        archivarExamenGenerado={archivarExamenGenerado}
        regenerandoExamenId={regenerandoExamenId}
        puedeArchivarExamenes={puedeArchivarExamenes}
      />
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle}
        jobOmr={jobOmr}
        cargandoAssessmentId={cargandoAssessmentId}
        procesandoOmr={procesandoOmr}
        descargarArtifact={descargarArtifact}
        crearJobOmr={crearJobOmr}
        resolverHojaOmr={resolverHojaOmr}
        finalizarJobOmr={finalizarJobOmr}
      />
    </div>
  );
}
