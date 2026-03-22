/** Seccion de plantillas y generacion de examenes (orquestacion UI + handlers). */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
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

type ProgresoLoteGeneracion = {
  loteId: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'iniciando' | 'generando' | 'completado';
};

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
  const confirm = useConfirmDialog();
  /**
   * Texto base orientado a impresión física/OMR.
   * Se reestablece al salir de modo edición para mantener consistencia UX.
   */
  const INSTRUCCIONES_DEFAULT =
    'Por favor conteste las siguientes preguntas referentes al parcial. ' +
    'Rellene un solo círculo por pregunta y evite marcas fuera del área. ' +
    'Ejemplo correcto: círculo completamente lleno (●). ' +
    'Ejemplos incorrectos: círculo a medias (◐), tachado (✗) o dos círculos marcados en la misma pregunta.';
  const TECNICO_VERSIONES_DEFAULT = 1;
  const TECNICO_FAMILIA_OMR_DEFAULT = 'S50_5A_ID5_VR6';
  const TECNICO_PREFILL_DEFAULT = 'none' as const;
  const TECNICO_MODO_VERSION_DEFAULT = 'single' as const;

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'parcial' | 'global'>('parcial');
  const [periodoId, setPeriodoId] = useState('');
  const [numeroPaginas, setNumeroPaginas] = useState(2);
  const [reactivosObjetivo, setReactivosObjetivo] = useState(20);
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
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
  const [descargandoLoteId, setDescargandoLoteId] = useState<string | null>(null);
  const [regenerandoLoteId, setRegenerandoLoteId] = useState<string | null>(null);
  const [eliminandoLoteId, setEliminandoLoteId] = useState<string | null>(null);
  const [progresoLoteGeneracion, setProgresoLoteGeneracion] = useState<ProgresoLoteGeneracion | null>(null);
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
    setProgresoLoteGeneracion(null);
    void cargarExamenesGenerados();
  }, [plantillaId, cargarExamenesGenerados]);

  const { descargarPdfExamen, descargarPdfLote, descargarPdfLotePorId, regenerarPdfExamen, eliminarExamenGenerado } = usePlantillasGeneradosActions({
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

  const descargarPaquete = useCallback(
    async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || descargandoLoteId === lote) return;
      try {
        setDescargandoLoteId(lote);
        await descargarPdfLotePorId(lote);
      } finally {
        setDescargandoLoteId(null);
      }
    },
    [descargandoLoteId, descargarPdfLotePorId]
  );

  const regenerarPaquete = useCallback(
    async (loteId: string, examenesLote: ExamenGeneradoResumen[]) => {
      const lote = String(loteId || '').trim();
      const lista = Array.isArray(examenesLote) ? examenesLote : [];
      if (!lote || regenerandoLoteId === lote || lista.length === 0) return;
      if (!puedeRegenerarExamenes) {
        avisarSinPermiso('No tienes permiso para regenerar examenes.');
        return;
      }
      const ok = await confirm({
        title: 'Regenerar paquete',
        message: `Se regenerarán todos los exámenes del paquete ${lote}.`,
        details: ['Úsalo solo si necesitas una nueva versión completa del paquete.'],
        confirmLabel: 'Sí, regenerar paquete',
        tone: 'warning'
      });
      if (!ok) return;
      try {
        setRegenerandoLoteId(lote);
        setMensajeGeneracion('');
        for (const examen of lista) {
          await enviarConPermiso(
            'examenes:regenerar',
            `/examenes/generados/${encodeURIComponent(examen._id)}/regenerar`,
            { forzar: true },
            'No tienes permiso para regenerar examenes.'
          );
        }
        emitToast({ level: 'ok', title: 'Paquete', message: `Paquete ${lote} regenerado`, durationMs: 2200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo regenerar el paquete');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo regenerar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setRegenerandoLoteId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      confirm,
      enviarConPermiso,
      puedeRegenerarExamenes,
      regenerandoLoteId,
      setMensajeGeneracion
    ]
  );

  const eliminarPaquete = useCallback(
    async (loteId: string, examenesLote: ExamenGeneradoResumen[]) => {
      const lote = String(loteId || '').trim();
      const lista = Array.isArray(examenesLote) ? examenesLote : [];
      if (!lote || eliminandoLoteId === lote || lista.length === 0) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para eliminar examenes.');
        return;
      }
      const ok = await confirm({
        title: 'Eliminar paquete',
        message: `El paquete ${lote} se ocultará del listado activo.`,
        details: ['Los datos se conservarán para auditoría y trazabilidad.'],
        confirmLabel: 'Sí, ocultar paquete',
        tone: 'warning'
      });
      if (!ok) return;
      try {
        setEliminandoLoteId(lote);
        setMensajeGeneracion('');
        for (const examen of lista) {
          await enviarConPermiso(
            'examenes:archivar',
            `/examenes/generados/${encodeURIComponent(examen._id)}/archivar`,
            {},
            'No tienes permiso para eliminar examenes.'
          );
        }
        emitToast({ level: 'ok', title: 'Paquete', message: `Paquete ${lote} eliminado`, durationMs: 2200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo eliminar el paquete');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo eliminar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setEliminandoLoteId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      confirm,
      eliminandoLoteId,
      enviarConPermiso,
      puedeArchivarExamenes,
      setMensajeGeneracion
    ]
  );
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
    setTemasSeleccionados(Array.isArray(plantilla.temas) ? plantilla.temas : []);
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
    setTemasSeleccionados([]);
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
        defaultVersionCount: TECNICO_VERSIONES_DEFAULT,
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
          sheetFamilyCode: TECNICO_FAMILIA_OMR_DEFAULT,
          prefillMode: TECNICO_PREFILL_DEFAULT,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          versionMode: TECNICO_MODO_VERSION_DEFAULT,
          ignoreUnusedTrailingQuestions: true,
          captureMode: 'pdf_and_mobile'
        },
        instrucciones: INSTRUCCIONES_DEFAULT
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
    const ok = await confirm({
      title: 'Eliminar plantilla',
      message: `La plantilla "${String(plantilla.titulo || '').trim()}" se eliminará junto con sus dependencias.`,
      details: ['Se quitarán exámenes y calificaciones relacionadas.'],
      confirmLabel: 'Sí, eliminar plantilla',
      tone: 'danger'
    });
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
        instrucciones: INSTRUCCIONES_DEFAULT,
        numeroPaginas: Math.max(1, Math.floor(numeroPaginas)),
        reactivosObjetivo: Math.max(1, Math.floor(reactivosObjetivo)),
        defaultVersionCount: TECNICO_VERSIONES_DEFAULT,
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
          sheetFamilyCode: TECNICO_FAMILIA_OMR_DEFAULT,
          prefillMode: TECNICO_PREFILL_DEFAULT,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          versionMode: TECNICO_MODO_VERSION_DEFAULT,
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
      const payload = await enviarConPermiso<{
        examenGenerado?: ExamenGeneradoResumen;
        generatedAssessment?: { _id: string; folio: string; generationSeed?: string; previewFingerprint?: string };
        advertencias?: string[];
      }>(
        'examenes:generar',
        `/assessments/templates/${encodeURIComponent(plantillaId)}/generate`,
        {
          prefillMode: TECNICO_PREFILL_DEFAULT,
          versionCount: TECNICO_VERSIONES_DEFAULT,
          sheetFamilyCode: TECNICO_FAMILIA_OMR_DEFAULT
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
    enviarConPermiso,
    plantillaId,
    puedeGenerarExamenes
  ]);

  const generarExamenesLote = useCallback(async () => {
    const ok = await confirm({
      title: 'Generar paquete masivo',
      message: 'Se generarán exámenes para todos los alumnos activos de la materia seleccionada.',
      details: ['Asegúrate de que plantilla, alumnos y banco estén listos antes de continuar.'],
      confirmLabel: 'Sí, generar paquete',
      tone: 'default'
    });
    if (!ok) return;
    const loteCliente =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().split('-')[0].toUpperCase()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

    const totalEsperadoInicial = Array.isArray(alumnos)
      ? alumnos.filter(
          (alumno) =>
            (alumno as unknown as { activo?: unknown })?.activo !== false &&
            String((alumno as unknown as { periodoId?: unknown })?.periodoId ?? '') ===
              String((plantillaSeleccionada as unknown as { periodoId?: unknown })?.periodoId ?? '')
        ).length
      : 0;

    setProgresoLoteGeneracion({
      loteId: loteCliente,
      totalEsperado: totalEsperadoInicial,
      generados: 0,
      porcentaje: 0,
      completado: false,
      estado: 'iniciando'
    });

    let sondeoActivo = true;
    const consultarProgreso = async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || !sondeoActivo) return;
      try {
        const progreso = await clienteApi.obtener<ProgresoLoteGeneracion>(
          `/examenes/generados/lote/${encodeURIComponent(lote)}/progreso?plantillaId=${encodeURIComponent(plantillaId)}`
        );
        if (!sondeoActivo) return;
        setProgresoLoteGeneracion((anterior) => ({
          loteId: String(progreso?.loteId || lote),
          totalEsperado: Number(progreso?.totalEsperado ?? anterior?.totalEsperado ?? totalEsperadoInicial ?? 0),
          generados: Number(progreso?.generados ?? 0),
          porcentaje: Number(progreso?.porcentaje ?? 0),
          completado: Boolean(progreso?.completado),
          estado:
            (progreso?.estado as ProgresoLoteGeneracion['estado'] | undefined) ??
            (Number(progreso?.generados ?? 0) > 0 ? 'generando' : 'iniciando')
        }));
      } catch {
        // no-op: el sondeo puede arrancar antes de que exista el primer examen del lote.
      }
    };

    const timerSondeo = globalThis.setInterval(() => {
      void consultarProgreso(loteCliente);
    }, 1200);
    void consultarProgreso(loteCliente);

    try {
      const inicio = Date.now();
      if (!puedeGenerarExamenes) {
        avisarSinPermiso('No tienes permiso para generar examenes.');
        return;
      }
      setGenerandoLote(true);
      setMensajeGeneracion('');
      const payload = await enviarConPermiso<{
        loteId?: string;
        totalAlumnos?: number;
        examenesGenerados?: Array<{ _id: string; folio: string; generadoEn?: string }>;
        lotePdfUrl?: string;
      }>(
        'examenes:generar',
        '/examenes/generados/lote',
        {
          plantillaId,
          confirmarMasivo: true,
          loteId: loteCliente
        },
        'No tienes permiso para generar examenes.',
        {
        timeoutMs: 120_000
        }
      );
      const totalAlumnos = Number(payload?.totalAlumnos ?? 0);
      const totalGenerados = Array.isArray(payload?.examenesGenerados) ? payload.examenesGenerados.length : 0;
      const loteUrl = String(payload?.lotePdfUrl ?? '').trim();
      const loteRespuesta = String(payload?.loteId ?? loteCliente).trim() || loteCliente;
      await consultarProgreso(loteRespuesta);
      setProgresoLoteGeneracion({
        loteId: loteRespuesta,
        totalEsperado: totalAlumnos > 0 ? totalAlumnos : totalEsperadoInicial,
        generados: totalGenerados,
        porcentaje: totalAlumnos > 0 ? Math.min(100, Math.round((totalGenerados / totalAlumnos) * 100)) : 100,
        completado: true,
        estado: 'completado'
      });
      setLotePdfUrl(loteUrl || null);
      setMensajeGeneracion(
        `Generación de paquete lista. Alumnos: ${totalAlumnos}. Exámenes generados: ${totalGenerados}.`
      );
      emitToast({ level: 'ok', title: 'Examenes', message: 'Generación masiva completada', durationMs: 2200 });
      registrarAccionDocente('generar_examenes_lote', true, Date.now() - inicio);
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
      sondeoActivo = false;
      globalThis.clearInterval(timerSondeo);
      setGenerandoLote(false);
    }
  }, [
    alumnos,
    avisarSinPermiso,
    cargarExamenesGenerados,
    confirm,
    enviarConPermiso,
    plantillaSeleccionada,
    plantillaId,
    puedeGenerarExamenes,
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
          periodoId={periodoId}
          setPeriodoId={setPeriodoId}
          periodos={periodos}
          bloqueoEdicion={bloqueoEdicion}
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
        eliminarExamenGenerado={eliminarExamenGenerado}
        regenerandoExamenId={regenerandoExamenId}
        puedeArchivarExamenes={puedeArchivarExamenes}
        descargandoLoteId={descargandoLoteId}
        regenerandoLoteId={regenerandoLoteId}
        eliminandoLoteId={eliminandoLoteId}
        onDescargarPaquete={descargarPaquete}
        onRegenerarPaquete={regenerarPaquete}
        onEliminarPaquete={eliminarPaquete}
        progresoLoteGeneracion={progresoLoteGeneracion}
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
