/** Seccion de plantillas y generacion de examenes (orquestacion UI + handlers). */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { clienteApi } from './clienteApiDocente';
import { GuiaGeneracionExamenesVisual } from './features/plantillas/components/GuiaGeneracionExamenesVisual';
import { GuiaHistorialLotesVisual } from './features/plantillas/components/GuiaHistorialLotesVisual';
import { PlantillasConsolaGeneracion } from './features/plantillas/components/PlantillasConsolaGeneracion';
import { PlantillasHistorialLotes } from './features/plantillas/components/PlantillasHistorialLotes';
import { PlantillasFormulario } from './features/plantillas/components/PlantillasFormulario';
import { PlantillasListado } from './features/plantillas/components/PlantillasListado';
import { PlantillasOmrWorkflow, type ArchivoOmrLote, type TrabajoOmrResumen } from './features/plantillas/components/PlantillasOmrWorkflow';
import { sincronizarResumenTrabajoOmr } from './features/plantillas/estadoTrabajoOmr';
import { cargarTodasLasPaginasArchivadas } from './features/plantillas/archivoOmr';
import { guardarTabPlantillas, PLANTILLAS_TAB_STORAGE_KEY, type TabPlantillas } from './features/plantillas/tabPlantillasState';
import { crearClaveLoteGeneracion, guardarLotePendiente, leerLotePendiente, validarResumenLoteGenerado } from './features/plantillas/loteGeneracionSesion';
import { confirmarClientRequestIdPlantilla, obtenerClientRequestIdPlantilla } from './features/plantillas/mutacionIdempotente';
import {
  usePlantillasGeneradosActions,
  type ExamenGeneradoResumen
} from './features/plantillas/hooks/usePlantillasGeneradosActions';
import { usePlantillasOmrActions } from './features/plantillas/hooks/usePlantillasOmrActions';
import {
  usePlantillasPreviewActions,
  type PreviewPdfPage,
  type PreviewPdfUrls
} from './features/plantillas/hooks/usePlantillasPreviewActions';
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
  PreviewPlantilla,
  Docente
} from './tipos';
import { idCortoMateria, mensajeDeError } from './utilidades';

type ProgresoLoteGeneracion = {
  loteId: string;
  claveRecuperacion?: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'iniciando' | 'generando' | 'completado' | 'fallido' | 'archivado';
};

type LotePdfArchivadoResumen = {
  loteId: string;
  plantillaId: string;
  totalExamenes: number;
  totalPaginas: number;
  archivado: true;
  archivadoEn: string;
};

export function existeTituloPlantillaDuplicadoPorPeriodo(
  plantillas: Plantilla[],
  tituloCandidato: string,
  periodoId: string,
  excluirId?: string
): boolean {
  const candidato = String(tituloCandidato || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!candidato) return false;
  const periodoCandidato = String(periodoId || '').trim();
  return (Array.isArray(plantillas) ? plantillas : []).some((plantilla) => {
    if (excluirId && plantilla._id === excluirId) return false;
    if (String(plantilla.periodoId || '').trim() !== periodoCandidato) return false;
    return String(plantilla.titulo || '').trim().replace(/\s+/g, ' ').toLowerCase() === candidato;
  });
}

function leerTabPlantillasInicial(): TabPlantillas {
  if (typeof window === 'undefined') return 'diseno';
  try {
    const tab = window.sessionStorage.getItem(PLANTILLAS_TAB_STORAGE_KEY);
    return tab === 'generacion' || tab === 'historial' || tab === 'diseno' ? tab : 'diseno';
  } catch {
    return 'diseno';
  }
}

export function SeccionPlantillas({
  plantillas,
  periodos,
  preguntas,
  alumnos,
  permisos,
  preferenciasPdf,
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
  preferenciasPdf?: Docente['preferenciasPdf'];
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
  previewPorPlantillaId: Record<string, PreviewPlantilla>;
  setPreviewPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPlantilla>>>;
  cargandoPreviewPlantillaId: string | null;
  setCargandoPreviewPlantillaId: Dispatch<SetStateAction<string | null>>;
  plantillaPreviewId: string | null;
  setPlantillaPreviewId: Dispatch<SetStateAction<string | null>>;
  previewPdfUrlPorPlantillaId: Record<string, PreviewPdfUrls>;
  setPreviewPdfUrlPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPdfUrls>>>;
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

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'parcial' | 'global'>('parcial');
  const [periodoId, setPeriodoId] = useState('');
  const [numeroPaginas, setNumeroPaginas] = useState(2);
  const [reactivosObjetivo, setReactivosObjetivo] = useState(20);
  const [logoIzquierda, setLogoIzquierda] = useState(preferenciasPdf?.logos?.izquierdaPath ?? '');
  const [logoDerecha, setLogoDerecha] = useState(preferenciasPdf?.logos?.derechaPath ?? '');
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  const [examTemplateId, setExamTemplateId] = useState<'omr-canonical-v4' | 'omr-inline-exam-v1'>('omr-canonical-v4');
  const [mensaje, setMensaje] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [mensajeGeneracion, setMensajeGeneracion] = useState('');
  const [lotePdfUrl, setLotePdfUrl] = useState<string | null>(null);
  // ultimoGenerado
  const [, setUltimoGenerado] = useState<ExamenGeneradoResumen | null>(null);
  const [assessmentDetalle, setAssessmentDetalle] = useState<GeneratedAssessmentDetalle | null>(null);
  const [examenesArchivadosOmr, setExamenesArchivadosOmr] = useState<ExamenGeneradoResumen[]>([]);
  const [periodosArchivadosOmr, setPeriodosArchivadosOmr] = useState<Periodo[]>([]);
  const [cargandoLotesArchivadosOmr, setCargandoLotesArchivadosOmr] = useState(false);
  const [archivoOmrCargado, setArchivoOmrCargado] = useState(false);
  const [errorArchivoOmr, setErrorArchivoOmr] = useState('');
  const [cargandoAssessmentId, setCargandoAssessmentId] = useState<string | null>(null);
  const [procesandoOmr, setProcesandoOmr] = useState(false);
  const [jobOmr, setJobOmr] = useState<OmrJobDetalle | null>(null);
  const [trabajosOmr, setTrabajosOmr] = useState<TrabajoOmrResumen[]>([]);
  const [cursorTrabajosOmr, setCursorTrabajosOmr] = useState<string | null>(null);
  const [cargandoTrabajosOmr, setCargandoTrabajosOmr] = useState(false);
  const [historialTrabajosOmrCargado, setHistorialTrabajosOmrCargado] = useState(false);
  const [errorTrabajosOmr, setErrorTrabajosOmr] = useState('');
  const setJobOmrYResumen = useCallback((job: OmrJobDetalle | null) => {
    setJobOmr(job);
    if (job) setTrabajosOmr((trabajos) => sincronizarResumenTrabajoOmr(trabajos, job));
  }, []);
  const [examenesGenerados, setExamenesGenerados] = useState<ExamenGeneradoResumen[]>([]);
  const [lotesArchivados, setLotesArchivados] = useState<LotePdfArchivadoResumen[]>([]);
  const [cursorLotesArchivados, setCursorLotesArchivados] = useState<string | null>(null);
  const [cargandoLotesArchivados, setCargandoLotesArchivados] = useState(false);
  const [restaurandoLoteId, setRestaurandoLoteId] = useState<string | null>(null);
  const [cargandoExamenesGenerados, setCargandoExamenesGenerados] = useState(false);
  const [descargandoExamenId, setDescargandoExamenId] = useState<string | null>(null);
  const [regenerandoExamenId, setRegenerandoExamenId] = useState<string | null>(null);
  const [archivandoExamenId, setArchivandoExamenId] = useState<string | null>(null);
  const [descargandoLoteId, setDescargandoLoteId] = useState<string | null>(null);
  const [regenerandoLoteId, setRegenerandoLoteId] = useState<string | null>(null);
  const [eliminandoLoteId, setEliminandoLoteId] = useState<string | null>(null);
  const requestIdsCicloLote = useRef(new Map<string, string>());
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
  const [tabActiva, setTabActiva] = useState<TabPlantillas>(leerTabPlantillasInicial);
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

  useEffect(() => {
    try {
      guardarTabPlantillas(tabActiva);
    } catch {
      // La navegación sigue funcionando aunque el almacenamiento no esté disponible.
    }
  }, [tabActiva]);

  useEffect(() => {
    setMensaje('');
  }, [periodoId]);

  // Estado solo de presentación para vista ampliada del preview PDF.
  const [pdfFullscreen, setPdfFullscreen] = useState<{ url: string; pages: PreviewPdfPage[] } | null>(null);
  const pdfFullscreenUrl = pdfFullscreen?.url ?? null;
  const pdfFullscreenPages = pdfFullscreen?.pages ?? [];

  const abrirPdfFullscreen = useCallback((url: string, pages: PreviewPdfPage[] = []) => {
    const u = String(url || '').trim();
    if (!u || pages.length === 0) return;
    setPdfFullscreen({ url: u, pages });
    emitToast({ level: 'info', title: 'Vista previa', message: 'PDF abierto en pantalla completa', durationMs: 1800 });
  }, []);

  const cerrarPdfFullscreen = useCallback(() => {
    setPdfFullscreen(null);
    emitToast({ level: 'info', title: 'Vista previa', message: 'Pantalla completa cerrada', durationMs: 1600 });
  }, []);

  const plantillaSeleccionada = useMemo(() => {
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaId) ?? null;
  }, [plantillas, plantillaId]);

  const plantillaEditando = useMemo(() => {
    if (!plantillaEditandoId) return null;
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaEditandoId) ?? null;
  }, [plantillas, plantillaEditandoId]);

  const edicionPlantillaModificada = useMemo(() => {
    if (!modoEdicion || !plantillaEditando) return false;
    const temasActuales = Array.isArray(temasSeleccionados) ? temasSeleccionados : [];
    const temasOriginales = Array.isArray(plantillaEditando.temas) ? plantillaEditando.temas : [];
    const mismoContenido = temasActuales.length === temasOriginales.length &&
      temasActuales.every((tema, indice) => tema === temasOriginales[indice]);
    const paginasOriginales = Number(plantillaEditando.numeroPaginas ?? plantillaEditando.bookletConfig?.targetPages ?? 1);
    const reactivosOriginales = Number(plantillaEditando.reactivosObjetivo ?? 20);
    const logoIzquierdaOriginal = String(plantillaEditando.bookletConfig?.logos?.izquierdaPath ?? '');
    const logoDerechaOriginal = String(plantillaEditando.bookletConfig?.logos?.derechaPath ?? '');
    return titulo.trim() !== String(plantillaEditando.titulo || '').trim() ||
      tipo !== plantillaEditando.tipo ||
      periodoId !== String(plantillaEditando.periodoId || '') ||
      numeroPaginas !== paginasOriginales ||
      reactivosObjetivo !== reactivosOriginales ||
      !mismoContenido ||
      logoIzquierda !== logoIzquierdaOriginal ||
      logoDerecha !== logoDerechaOriginal ||
      examTemplateId !== String(plantillaEditando.omrConfig?.examTemplateId ?? 'omr-canonical-v4');
  }, [
    examTemplateId,
    logoDerecha,
    logoIzquierda,
    modoEdicion,
    numeroPaginas,
    periodoId,
    plantillaEditando,
    reactivosObjetivo,
    temasSeleccionados,
    tipo,
    titulo
  ]);

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
      setLotesArchivados([]);
      setCursorLotesArchivados(null);
      return;
    }
    if (!puedeLeerExamenes) {
      setExamenesGenerados([]);
      setLotesArchivados([]);
      setCursorLotesArchivados(null);
      return;
    }
    setCargandoExamenesGenerados(true);
    setCargandoLotesArchivados(true);
    setCursorLotesArchivados(null);
    const [examenesResult, lotesResult] = await Promise.allSettled([
        clienteApi.obtener<{ examenes: ExamenGeneradoResumen[] }>(
          `/examenes/generados?plantillaId=${encodeURIComponent(plantillaId)}&limite=50`
        ),
        clienteApi.obtener<{ lotes: LotePdfArchivadoResumen[]; nextCursor?: string | null }>(
          `/examenes/generados/lotes?plantillaId=${encodeURIComponent(plantillaId)}&archivado=true&limite=100`
        )
    ]);
    if (examenesResult.status === 'fulfilled') {
      setExamenesGenerados(Array.isArray(examenesResult.value.examenes) ? examenesResult.value.examenes : []);
    } else {
      setMensajeGeneracion(mensajeDeError(examenesResult.reason, 'No se pudo cargar el historial de exámenes'));
    }
    if (lotesResult.status === 'fulfilled') {
      setLotesArchivados(Array.isArray(lotesResult.value.lotes) ? lotesResult.value.lotes : []);
      setCursorLotesArchivados(lotesResult.value.nextCursor ?? null);
    } else {
      setLotesArchivados([]);
      setMensajeGeneracion(mensajeDeError(lotesResult.reason, 'No se pudo cargar el archivo de paquetes'));
    }
    setCargandoExamenesGenerados(false);
    setCargandoLotesArchivados(false);
  }, [plantillaId, puedeLeerExamenes]);

  const cargarArchivoOmr = useCallback(async () => {
    if (!puedeLeerExamenes) return;
    setCargandoLotesArchivadosOmr(true);
    setErrorArchivoOmr('');
    try {
      const periodosArchivados = await clienteApi.obtener<{ periodos: Periodo[] }>('/periodos?activo=false');
      setPeriodosArchivadosOmr(Array.isArray(periodosArchivados.periodos) ? periodosArchivados.periodos : []);
      const acumulados = await cargarTodasLasPaginasArchivadas<ExamenGeneradoResumen>(async (cursor) => {
        const query = new URLSearchParams({ archivado: 'true', limite: '200' });
        if (cursor) query.set('cursor', cursor);
        return clienteApi.obtener<{ examenes: ExamenGeneradoResumen[]; nextCursor?: string | null }>(
          `/examenes/generados?${query.toString()}`
        );
      });
      setExamenesArchivadosOmr(acumulados.filter((examen) => Boolean(examen.loteId) && examen.origenGeneracion === 'lote'));
      setArchivoOmrCargado(true);
    } catch (error) {
      setExamenesArchivadosOmr([]);
      setErrorArchivoOmr(mensajeDeError(error, 'No se pudieron cargar los lotes archivados para OMR'));
      setArchivoOmrCargado(true);
    } finally {
      setCargandoLotesArchivadosOmr(false);
    }
  }, [puedeLeerExamenes]);

  const reintentarCargaArchivoOmr = useCallback(() => {
    if (cargandoLotesArchivadosOmr || !puedeLeerExamenes) return;
    setArchivoOmrCargado(false);
    void cargarArchivoOmr();
  }, [cargarArchivoOmr, cargandoLotesArchivadosOmr, puedeLeerExamenes]);

  const lotesArchivadosOmr = useMemo<ArchivoOmrLote[]>(() => {
    const agrupados = new Map<string, { assessmentId: string; periodoId: string; cantidad: number }>();
    for (const examen of examenesArchivadosOmr) {
      const loteId = String(examen.loteId ?? '').trim();
      if (!loteId) continue;
      const lote = agrupados.get(loteId);
      if (lote) lote.cantidad += 1;
      else agrupados.set(loteId, {
        assessmentId: examen._id,
        periodoId: String(examen.periodoId ?? ''),
        cantidad: 1
      });
    }
    return Array.from(agrupados.entries()).map(([loteId, lote]) => {
      const periodo = [...periodos, ...periodosArchivadosOmr].find((item) => item._id === lote.periodoId);
      return {
        assessmentId: lote.assessmentId,
        loteId,
        etiqueta: `${periodo?.nombre ?? 'Materia archivada'} · Lote ${loteId}`,
        cantidad: lote.cantidad
      };
    }).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  }, [examenesArchivadosOmr, periodos, periodosArchivadosOmr]);

  useEffect(() => {
    if (tabActiva === 'historial' && !assessmentDetalle && !archivoOmrCargado && !cargandoLotesArchivadosOmr) {
      void cargarArchivoOmr();
    }
  }, [tabActiva, assessmentDetalle, archivoOmrCargado, cargandoLotesArchivadosOmr, cargarArchivoOmr]);

  const cargarTrabajosOmr = useCallback(async (cursor?: string | null, agregar = false) => {
    if (!puedeAnalizarOmr || cargandoTrabajosOmr) return;
    setCargandoTrabajosOmr(true);
    setErrorTrabajosOmr('');
    try {
      const query = new URLSearchParams({ limite: '20' });
      if (cursor) query.set('cursor', cursor);
      const pagina = await clienteApi.obtener<{ jobs?: TrabajoOmrResumen[]; nextCursor?: string | null }>(`/omr/jobs?${query}`);
      setTrabajosOmr((actuales) => {
        const combinados = agregar ? [...actuales, ...(pagina.jobs ?? [])] : (pagina.jobs ?? []);
        return Array.from(new Map(combinados.map((trabajo) => [trabajo.jobId, trabajo])).values());
      });
      setCursorTrabajosOmr(pagina.nextCursor || null);
    } catch (error) {
      setErrorTrabajosOmr(mensajeDeError(error, 'No se pudo cargar el historial de trabajos OMR.'));
    } finally {
      setHistorialTrabajosOmrCargado(true);
      setCargandoTrabajosOmr(false);
    }
  }, [cargandoTrabajosOmr, puedeAnalizarOmr]);

  useEffect(() => {
    if (tabActiva === 'historial' && puedeAnalizarOmr && !historialTrabajosOmrCargado && !cargandoTrabajosOmr) {
      void cargarTrabajosOmr();
    }
  }, [tabActiva, puedeAnalizarOmr, historialTrabajosOmrCargado, cargandoTrabajosOmr, cargarTrabajosOmr]);

  const abrirTrabajoOmr = useCallback(async (trabajo: TrabajoOmrResumen) => {
    if (!puedeAnalizarOmr) return;
    setCargandoAssessmentId(trabajo.assessmentId);
    setMensajeGeneracion('');
    try {
      const assessment = await clienteApi.obtener<GeneratedAssessmentDetalle>(`/examenes/generados/${encodeURIComponent(trabajo.assessmentId)}`);
      let trabajoDetalle: OmrJobDetalle;
      if (trabajo.workflow === 'pdf_ingesta') {
        const detalle = await clienteApi.obtener<{ job: OmrJobDetalle; candidateExams?: OmrJobDetalle['candidateExams'] }>(`/omr/ingestas/${encodeURIComponent(trabajo.jobId)}`);
        trabajoDetalle = { ...detalle.job, candidateExams: detalle.candidateExams ?? [] };
      } else {
        const detalle = await clienteApi.obtener<{ job: OmrJobDetalle }>(`/omr/jobs/${encodeURIComponent(trabajo.jobId)}`);
        trabajoDetalle = detalle.job;
      }
      setAssessmentDetalle(assessment);
      setJobOmrYResumen(trabajoDetalle);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo reabrir el trabajo OMR.');
      setMensajeGeneracion(msg);
      emitToast({ level: 'error', title: 'Historial OMR', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setCargandoAssessmentId(null);
    }
  }, [puedeAnalizarOmr, setJobOmrYResumen]);

  const cargarMasLotesArchivados = useCallback(async () => {
    if (!plantillaId || !cursorLotesArchivados || cargandoLotesArchivados) return;
    setCargandoLotesArchivados(true);
    try {
      const query = new URLSearchParams({
        plantillaId,
        archivado: 'true',
        limite: '100',
        cursor: cursorLotesArchivados
      });
      const payload = await clienteApi.obtener<{ lotes: LotePdfArchivadoResumen[]; nextCursor?: string | null }>(
        `/examenes/generados/lotes?${query.toString()}`
      );
      setLotesArchivados((actuales) => {
        const porId = new Map(actuales.map((lote) => [lote.loteId, lote]));
        for (const lote of payload.lotes ?? []) porId.set(lote.loteId, lote);
        return Array.from(porId.values());
      });
      setCursorLotesArchivados(payload.nextCursor ?? null);
    } catch (error) {
      setMensajeGeneracion(mensajeDeError(error, 'No se pudo cargar más paquetes archivados'));
    } finally {
      setCargandoLotesArchivados(false);
    }
  }, [cargandoLotesArchivados, cursorLotesArchivados, plantillaId]);

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
        await enviarConPermiso(
          'examenes:archivar',
          `/examenes/generados/lote/${encodeURIComponent(lote)}/archivar`,
          { clientRequestId: requestIdsCicloLote.current.get(`archivar:${lote}`) ?? (() => {
            const id = crypto.randomUUID();
            requestIdsCicloLote.current.set(`archivar:${lote}`, id);
            return id;
          })() },
          'No tienes permiso para archivar este lote.'
        );
        requestIdsCicloLote.current.delete(`archivar:${lote}`);
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
  const restaurarPaquete = useCallback(
    async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || restaurandoLoteId === lote) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para restaurar lotes archivados.');
        return;
      }
      const ok = await confirm({
        title: 'Restaurar paquete',
        message: `El paquete ${lote} volverá al historial activo.`,
        details: ['Se comprobará el hash y la integridad del PDF antes de restaurarlo.'],
        confirmLabel: 'Sí, restaurar paquete',
        tone: 'warning'
      });
      if (!ok) return;
      try {
        setRestaurandoLoteId(lote);
        await enviarConPermiso(
          'examenes:archivar',
          `/examenes/generados/lote/${encodeURIComponent(lote)}/restaurar`,
          { clientRequestId: requestIdsCicloLote.current.get(`restaurar:${lote}`) ?? (() => {
            const id = crypto.randomUUID();
            requestIdsCicloLote.current.set(`restaurar:${lote}`, id);
            return id;
          })() },
          'No tienes permiso para restaurar lotes archivados.'
        );
        requestIdsCicloLote.current.delete(`restaurar:${lote}`);
        emitToast({ level: 'ok', title: 'Paquete', message: `Paquete ${lote} restaurado`, durationMs: 2200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo restaurar el paquete');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo restaurar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setRestaurandoLoteId(null);
      }
    },
    [avisarSinPermiso, cargarExamenesGenerados, confirm, enviarConPermiso, puedeArchivarExamenes, restaurandoLoteId, setMensajeGeneracion]
  );
  const { cargarPreviewPdfPlantilla, cerrarPreviewPdfPlantilla } =
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
  async function previsualizarPdfEdicion() {
    if (!plantillaEditandoId) return;
    await cargarPreviewPdfPlantilla(plantillaEditandoId, 'booklet');
  }
  const { cargarAssessmentDetalle, descargarArtifact, obtenerPreviewPaginaOmr, obtenerPreviewReferenciaOmr, prevalidarReferenciaOmr, crearJobOmr, reintentarIngestaPdfOmr, resolverHojaOmr, finalizarJobOmr } = usePlantillasOmrActions({
    avisarSinPermiso,
    puedeDescargarExamenes,
    puedeAnalizarOmr,
    setCargandoAssessmentId,
    setAssessmentDetalle,
    setProcesandoOmr,
    setJobOmr: setJobOmrYResumen,
    setMensajeGeneracion
  });

  const seleccionarLoteArchivadoOmr = useCallback(async (assessmentId: string) => {
    await cargarAssessmentDetalle(assessmentId);
  }, [cargarAssessmentDetalle]);

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
    if (totalDisponiblePorTemas <= 0) return;
    setReactivosObjetivo((actual) => Math.min(200, totalDisponiblePorTemas, Math.max(1, actual)));
  }, [totalDisponiblePorTemas]);

  function seleccionarLogo(lado: 'izquierda' | 'derecha', archivo?: File) {
    if (!archivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setMensaje('La imagen debe ser PNG, JPG o WebP.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setMensaje('La imagen no puede superar 2 MB.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const dataUrl = String(lector.result ?? '');
      if (!dataUrl.startsWith('data:image/')) {
        setMensaje('No se pudo leer la imagen seleccionada.');
        return;
      }
      if (lado === 'izquierda') setLogoIzquierda(dataUrl);
      else setLogoDerecha(dataUrl);
      setMensaje('');
    };
    lector.onerror = () => setMensaje('No se pudo leer la imagen seleccionada.');
    lector.readAsDataURL(archivo);
  }

  const puedeCrear = Boolean(
    titulo.trim() &&
      periodoId &&
      temasSeleccionados.length > 0 &&
      numeroPaginas > 0 &&
      reactivosObjetivo > 0
  );
  const puedeGenerar = Boolean(plantillaId) && puedeGenerarExamenes;
  const existeTituloPlantillaDuplicado = (tituloCandidato: string, excluirId?: string) => {
    return existeTituloPlantillaDuplicadoPorPeriodo(plantillas, tituloCandidato, periodoId, excluirId);
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
      emitToast({ level: 'info', title: 'Plantillas', message: 'Actualizando el catálogo…', durationMs: 1800 });
      await Promise.resolve(onRefrescar());
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Catálogo actualizado', durationMs: 2200 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar el catálogo');
      emitToast({ level: 'error', title: 'Plantillas', message: msg, durationMs: 5200 });
    } finally {
      setRefrescandoPlantillas(false);
    }
  }

  function limpiarFiltroPlantillas() {
    setFiltroPlantillas('');
    emitToast({ level: 'info', title: 'Filtro', message: 'Filtro de plantillas eliminado', durationMs: 1800 });
  }

  function iniciarEdicion(plantilla: Plantilla) {
    setModoEdicion(true);
    setPlantillaEditandoId(plantilla._id);
    setTitulo(String(plantilla.titulo || ''));
    setTipo(plantilla.tipo);
    setPeriodoId(String(plantilla.periodoId || ''));
    setNumeroPaginas(Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 1));
    setReactivosObjetivo(Number(plantilla.reactivosObjetivo ?? 20));
    setLogoIzquierda(String(plantilla.bookletConfig?.logos?.izquierdaPath ?? preferenciasPdf?.logos?.izquierdaPath ?? ''));
    setLogoDerecha(String(plantilla.bookletConfig?.logos?.derechaPath ?? preferenciasPdf?.logos?.derechaPath ?? ''));
    setTemasSeleccionados(Array.isArray(plantilla.temas) ? plantilla.temas : []);
    setExamTemplateId(plantilla.omrConfig?.examTemplateId ?? 'omr-canonical-v4');
    setMensaje('');
    emitToast({ level: 'info', title: 'Plantillas', message: `Editando “${String(plantilla.titulo || '').trim()}”`, durationMs: 2200 });
  }

  function cancelarEdicion() {
    setModoEdicion(false);
    setPlantillaEditandoId(null);
    setTitulo('');
    setTipo('parcial');
    setPeriodoId('');
    setNumeroPaginas(2);
    setReactivosObjetivo(20);
    setLogoIzquierda(preferenciasPdf?.logos?.izquierdaPath ?? '');
    setLogoDerecha(preferenciasPdf?.logos?.derechaPath ?? '');
    setTemasSeleccionados([]);
    setExamTemplateId('omr-canonical-v4');
    setMensaje('');
    emitToast({ level: 'info', title: 'Plantillas', message: 'Edición cancelada', durationMs: 1800 });
  }

  function cambiarTab(tab: TabPlantillas) {
    if (tab === tabActiva) return;
    const etiquetas: Record<TabPlantillas, string> = {
      diseno: 'Diseño de exámenes',
      generacion: 'Generación de paquete PDF/OMR',
      historial: 'Historial de lotes'
    };
    setTabActiva(tab);
    emitToast({ level: 'info', title: 'Sección', message: `Mostrando ${etiquetas[tab]}`, durationMs: 1800 });
  }

  async function guardarEdicion(): Promise<boolean> {
    if (!plantillaEditandoId || guardandoPlantilla) return false;
    try {
      const inicio = Date.now();
      if (!puedeGestionarPlantillas) {
        avisarSinPermiso('No tienes permiso para editar plantillas.');
        return false;
      }
      setGuardandoPlantilla(true);
      setMensaje('');

      if (existeTituloPlantillaDuplicado(titulo, plantillaEditandoId)) {
        const msgDup = 'Ya existe una plantilla activa con ese nombre.';
        setMensaje(msgDup);
        emitToast({ level: 'warn', title: 'Plantillas', message: msgDup, durationMs: 4200 });
        return false;
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
          densityMode: 'compact',
          autoFitPages: true,
          allowImages: true,
          imageBudgetPolicy: 'balanced',
          headerStyle: 'compact',
          logos: {
            izquierdaPath: logoIzquierda || undefined,
            derechaPath: logoDerecha || undefined
          },
          fontScale: 1,
          lineSpacing: 1.1,
          separateCoverPage: false
        },
        configuracionPdf: { margenMm: 8, layout: 'parcial' },
        omrConfig: {
          examTemplateId,
          sheetFamilyCode: TECNICO_FAMILIA_OMR_DEFAULT,
          prefillMode: TECNICO_PREFILL_DEFAULT,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
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
      const clientRequestId = obtenerClientRequestIdPlantilla('actualizar', plantillaEditandoId, payload);
      payload.clientRequestId = clientRequestId;

      await enviarConPermiso(
        'plantillas:gestionar',
        `/examenes/plantillas/${encodeURIComponent(plantillaEditandoId)}`,
        payload,
        'No tienes permiso para editar plantillas.'
      );
      confirmarClientRequestIdPlantilla('actualizar', plantillaEditandoId, clientRequestId);
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_plantilla', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
      return true;
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
      return false;
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function actualizarPdfEdicion() {
    const id = plantillaEditandoId;
    if (!id) return;
    const actualizado = await guardarEdicion();
    if (actualizado) await cargarPreviewPdfPlantilla(id, 'booklet');
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
      const clientRequestId = obtenerClientRequestIdPlantilla('eliminar', plantilla._id, {});
      await enviarConPermiso(
        'plantillas:archivar',
        `/examenes/plantillas/${encodeURIComponent(plantilla._id)}/eliminar`,
        { clientRequestId },
        'No tienes permiso para eliminar plantillas.'
      );
      confirmarClientRequestIdPlantilla('eliminar', plantilla._id, clientRequestId);
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
          densityMode: 'compact',
          autoFitPages: true,
          allowImages: true,
          imageBudgetPolicy: 'balanced',
          headerStyle: 'compact',
          logos: {
            izquierdaPath: logoIzquierda || undefined,
            derechaPath: logoDerecha || undefined
          },
          fontScale: 1,
          lineSpacing: 1.1,
          separateCoverPage: false
        },
        configuracionPdf: { margenMm: 8, layout: 'parcial' },
        omrConfig: {
          examTemplateId,
          sheetFamilyCode: TECNICO_FAMILIA_OMR_DEFAULT,
          prefillMode: TECNICO_PREFILL_DEFAULT,
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          ignoreUnusedTrailingQuestions: true,
          captureMode: 'pdf_and_mobile'
        }
      };
      const periodoIdNorm = String(periodoId || '').trim();
      if (periodoIdNorm) payload.periodoId = periodoIdNorm;
      if (temasSeleccionados.length > 0) payload.temas = temasSeleccionados;
      const clientRequestId = obtenerClientRequestIdPlantilla('crear', null, payload);
      payload.clientRequestId = clientRequestId;

      await enviarConPermiso(
        'plantillas:gestionar',
        '/examenes/plantillas',
        payload,
        'No tienes permiso para crear plantillas.'
      );
      confirmarClientRequestIdPlantilla('crear', null, clientRequestId);
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
        '/examenes/generados',
        { plantillaId },
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

  const generarExamenesLote = useCallback(async (opciones?: { tipoExamen?: 'extraordinario'; alumnoIds?: string[] }) => {
    const tipoExamen = opciones?.tipoExamen;
    const alumnosSolicitados = opciones?.alumnoIds ?? [];
    const alumnoIds = tipoExamen === 'extraordinario' ? [...new Set(alumnosSolicitados)].sort() : undefined;
    if (tipoExamen === 'extraordinario' && (!alumnoIds?.length || alumnoIds.length !== alumnosSolicitados.length)) {
      setMensajeGeneracion('Selecciona uno o más alumnos distintos para generar el extraordinario.');
      return;
    }
    const claveRecuperacion = crearClaveLoteGeneracion(plantillaId, tipoExamen, alumnoIds);
    const lotePendiente = leerLotePendiente(claveRecuperacion) ??
      (progresoLoteGeneracion?.estado === 'fallido' && progresoLoteGeneracion.claveRecuperacion === claveRecuperacion
        ? progresoLoteGeneracion.loteId
        : null);
    const cantidadAlumnos = tipoExamen === 'extraordinario'
      ? alumnoIds?.length ?? 0
      : Array.isArray(alumnos)
        ? alumnos.filter(
            (alumno) =>
              (alumno as unknown as { activo?: unknown })?.activo !== false &&
              String((alumno as unknown as { periodoId?: unknown })?.periodoId ?? '') ===
                String((plantillaSeleccionada as unknown as { periodoId?: unknown })?.periodoId ?? '')
          ).length
        : 0;
    const ok = await confirm({
      title: lotePendiente
        ? tipoExamen === 'extraordinario' ? 'Reanudar extraordinarios' : 'Reanudar paquete incompleto'
        : tipoExamen === 'extraordinario' ? 'Generar exámenes extraordinarios' : 'Generar paquete masivo',
      message: lotePendiente
        ? 'Se reanudará el mismo lote, conservando los exámenes ya generados y verificados.'
        : tipoExamen === 'extraordinario'
          ? `Se generarán exámenes extraordinarios únicamente para los ${cantidadAlumnos} alumnos seleccionados. Sus calificaciones quedarán separadas de parciales y globales.`
          : 'Se generarán exámenes para todos los alumnos activos de la materia seleccionada.',
      details: ['Asegúrate de que plantilla, alumnos y banco estén listos antes de continuar.'],
      confirmLabel: lotePendiente
        ? 'Sí, reanudar lote'
        : tipoExamen === 'extraordinario' ? 'Sí, generar extraordinarios' : 'Sí, generar paquete',
      tone: 'default'
    });
    if (!ok) return;
    const loteCliente = lotePendiente ?? (
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().split('-')[0].toUpperCase()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
    );
    guardarLotePendiente(claveRecuperacion, loteCliente);

    const totalEsperadoInicial = tipoExamen === 'extraordinario'
      ? cantidadAlumnos
      : Array.isArray(alumnos)
      ? alumnos.filter(
          (alumno) =>
            (alumno as unknown as { activo?: unknown })?.activo !== false &&
            String((alumno as unknown as { periodoId?: unknown })?.periodoId ?? '') ===
              String((plantillaSeleccionada as unknown as { periodoId?: unknown })?.periodoId ?? '')
        ).length
      : 0;

    setProgresoLoteGeneracion({
      loteId: loteCliente,
      claveRecuperacion,
      totalEsperado: totalEsperadoInicial,
      generados: 0,
      porcentaje: 0,
      completado: false,
      estado: lotePendiente ? 'generando' : 'iniciando'
    });

    let sondeoActivo = true;
    let sondeoEnCurso = false;
    const consultarProgreso = async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || !sondeoActivo || sondeoEnCurso) return;
      sondeoEnCurso = true;
      try {
        const progreso = await clienteApi.obtener<ProgresoLoteGeneracion>(
          `/examenes/generados/lote/${encodeURIComponent(lote)}/progreso?plantillaId=${encodeURIComponent(plantillaId)}`
        );
        if (!sondeoActivo) return;
        setProgresoLoteGeneracion((anterior) => ({
          loteId: String(progreso?.loteId || lote),
          claveRecuperacion: anterior?.claveRecuperacion ?? claveRecuperacion,
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
      } finally {
        sondeoEnCurso = false;
      }
    };

    const timerSondeo = globalThis.setInterval(() => {
      void consultarProgreso(loteCliente);
    }, 5000);

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
        totalPaginas?: number;
        paginasPorExamen?: number;
        pdfSha256?: string;
        examenesGenerados?: Array<{ _id: string; folio: string; generadoEn?: string }>;
        lotePdfUrl?: string;
      }>(
        'examenes:generar',
        '/examenes/generados/lote',
        {
          plantillaId,
          confirmarMasivo: true,
          loteId: loteCliente,
          ...(tipoExamen === 'extraordinario' ? { tipoExamen, alumnoIds } : {})
        },
        'No tienes permiso para generar examenes.',
        {
          timeoutMs: 900_000
        }
      );
      const totalAlumnos = Number(payload?.totalAlumnos ?? 0);
      const totalGenerados = Array.isArray(payload?.examenesGenerados) ? payload.examenesGenerados.length : 0;
      const loteUrl = String(payload?.lotePdfUrl ?? '').trim();
      const loteRespuesta = String(payload?.loteId ?? loteCliente).trim() || loteCliente;
      if (loteRespuesta.toUpperCase() !== loteCliente.toUpperCase()) {
        throw new Error('El servidor respondió con otro identificador de lote. No se marcará como listo.');
      }
      validarResumenLoteGenerado(payload ?? {}, totalAlumnos, Number(plantillaSeleccionada?.numeroPaginas ?? 0));
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
      guardarLotePendiente(claveRecuperacion, null);
      setMensajeGeneracion(
        `Generación de paquete lista. Alumnos: ${totalAlumnos}. Exámenes generados: ${totalGenerados}.`
      );
      emitToast({ level: 'ok', title: 'Examenes', message: 'Generación masiva completada', durationMs: 2200 });
      registrarAccionDocente('generar_examenes_lote', true, Date.now() - inicio);
      await cargarExamenesGenerados();
    } catch (error) {
      setProgresoLoteGeneracion((anterior) => anterior ? { ...anterior, completado: false, estado: 'fallido' } : null);
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
    progresoLoteGeneracion,
    setMensajeGeneracion,
  ]);

  const formularioPlantilla = (
    <PlantillasFormulario
      modoEdicion={modoEdicion}
      plantillaEditando={plantillaEditando}
      examTemplateId={examTemplateId}
      setExamTemplateId={setExamTemplateId}
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
      numeroPaginas={numeroPaginas}
      setNumeroPaginas={setNumeroPaginas}
      reactivosObjetivo={reactivosObjetivo}
      setReactivosObjetivo={setReactivosObjetivo}
      logoIzquierda={logoIzquierda}
      logoDerecha={logoDerecha}
      seleccionarLogo={seleccionarLogo}
      creando={creando}
      puedeCrear={puedeCrear}
      crear={crear}
      guardandoPlantilla={guardandoPlantilla}
      previsualizarPdf={previsualizarPdfEdicion}
      previsualizandoPdf={cargandoPreviewPdfPlantillaId === plantillaEditandoId && Boolean(plantillaEditandoId)}
      guardarEdicion={guardarEdicion}
      actualizarPdf={actualizarPdfEdicion}
      edicionPlantillaModificada={edicionPlantillaModificada}
      cancelarEdicion={cancelarEdicion}
      mensaje={mensaje}
    />
  );

  return (
    <div className="panel plantillas-shell">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head plantillas-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb plantillas-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill plantillas-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Motor de Maquetación OMR Activo</span>
              </span>
              {filtroPlantillas.trim() ? (
                <span className="banco-counter-tag">Filtro: {filtroPlantillas.trim()}</span>
              ) : (
                <span className="banco-counter-tag">{resumenPlantillas.total} plantillas</span>
              )}
            </div>
            <h2 className="banco-panel__title eyebrow">Diseño de Exámenes</h2>
            <p className="nota">Configura estructura, temas y genera paquetes impresos en PDF con códigos QR y hojas OMR.</p>
          </div>
        </div>

        {/* Header Actions & Mini-KPIs */}
        <div className="plantillas-header-right">
          <div className="plantillas-header-actions">
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
            {filtroPlantillas.trim() && (
              <Boton
                type="button"
                variante="secundario"
                onClick={limpiarFiltroPlantillas}
                data-tooltip="Quita el filtro de búsqueda."
              >
                Limpiar filtro
              </Boton>
            )}
          </div>

          <div className="banco-header-kpis" aria-live="polite">
            <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Total de plantillas configuradas">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.total}</span>
              <span className="banco-mini-kpi__lbl">Plantillas</span>
            </div>

            <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Plantillas con unidades temáticas asignadas">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                </svg>
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.conTemas}</span>
              <span className="banco-mini-kpi__lbl">Con temas</span>
            </div>

            <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Total de temas vinculados en plantillas">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.totalTemasSeleccionados}</span>
              <span className="banco-mini-kpi__lbl">Temas vinc.</span>
            </div>

            <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Estado del filtro de búsqueda">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <span className="banco-mini-kpi__num banco-mini-kpi__num--sm">
                {filtroPlantillas.trim() ? 'Activo' : 'Todos'}
              </span>
              <span className="banco-mini-kpi__lbl">Filtro</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Glass Tab Navigation Bar */}
      <div className="plantillas-tabs-bar anim-fade-in" role="tablist" aria-label="Etapas de diseño y generación de exámenes">
        <button
          type="button"
          role="tab"
          aria-selected={tabActiva === 'diseno'}
          className={`plantillas-tab-btn ${tabActiva === 'diseno' ? 'plantillas-tab-btn--active' : ''}`}
          onClick={() => cambiarTab('diseno')}
        >
          <span className="plantillas-tab-btn__icon">📐</span>
          <span className="plantillas-tab-btn__label">Diseñar Exámenes</span>
          <span className="plantillas-tab-btn__count">{totalPlantillasTodas}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tabActiva === 'generacion'}
          className={`plantillas-tab-btn ${tabActiva === 'generacion' ? 'plantillas-tab-btn--active' : ''}`}
          onClick={() => cambiarTab('generacion')}
        >
          <span className="plantillas-tab-btn__icon"><Icono nombre="publicar" size={18} /></span>
          <span className="plantillas-tab-btn__label">Generar Paquete PDF/OMR</span>
          {generandoLote && <span className="plantillas-tab-btn__badge pulse">En progreso</span>}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tabActiva === 'historial'}
          className={`plantillas-tab-btn ${tabActiva === 'historial' ? 'plantillas-tab-btn--active' : ''}`}
          onClick={() => cambiarTab('historial')}
        >
          <span className="plantillas-tab-btn__icon"><Icono nombre="recargar" size={18} /></span>
          <span className="plantillas-tab-btn__label">Historial de Lotes</span>
          <span className="plantillas-tab-btn__count">{examenesGenerados.length}</span>
        </button>
      </div>

      {/* ── PESTAÑA 1: DISEÑAR EXÁMENES ── */}
      {tabActiva === 'diseno' && (
        <div className="plantillas-diseno-tab anim-fade-in" role="tabpanel" aria-label="Diseñar Exámenes">
          <section className="plantillas-studio-intro" aria-labelledby="plantillas-studio-title">
            <div>
              <span className="plantillas-studio-kicker">ESTUDIO DE CONSTRUCCIÓN</span>
              <h3 id="plantillas-studio-title">Construye tu examen paso a paso</h3>
              <p>Define los datos, asigna preguntas por tema y revisa el PDF antes de generar el paquete.</p>
            </div>
            <ol className="plantillas-studio-steps" aria-label="Flujo de diseño">
              <li className="is-active"><span>1</span><b>Datos</b></li>
              <li><span>2</span><b>Temas</b></li>
              <li><span>3</span><b>Formato</b></li>
              <li><span>4</span><b>Vista previa</b></li>
            </ol>
          </section>

          {!modoEdicion && formularioPlantilla}

          <PlantillasListado
            totalPlantillasTodas={totalPlantillasTodas}
            totalPlantillas={totalPlantillas}
            filtroPlantillas={filtroPlantillas}
            setFiltroPlantillas={setFiltroPlantillas}
            plantillasFiltradas={plantillasFiltradas}
            periodos={periodos}
            plantillaEditandoId={plantillaEditandoId}
            editorInline={modoEdicion ? formularioPlantilla : null}
            previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
            puedePrevisualizarPlantillas={puedePrevisualizarPlantillas}
            cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
            cargarPreviewPdfPlantilla={cargarPreviewPdfPlantilla}
            cerrarPreviewPdfPlantilla={cerrarPreviewPdfPlantilla}
            abrirPdfFullscreen={abrirPdfFullscreen}
            pdfFullscreenUrl={pdfFullscreenUrl}
            pdfFullscreenPages={pdfFullscreenPages}
            cerrarPdfFullscreen={cerrarPdfFullscreen}
            iniciarEdicion={iniciarEdicion}
            puedeGestionarPlantillas={puedeGestionarPlantillas}
            archivandoPlantillaId={archivandoPlantillaId}
            archivarPlantilla={archivarPlantilla}
            puedeArchivarPlantillas={puedeArchivarPlantillas}
            formatearFechaHora={formatearFechaHora}
          />
        </div>
      )}

      {/* ── PESTAÑA 2: GENERAR PAQUETE PDF/OMR ── */}
      {tabActiva === 'generacion' && (
        <div className="anim-fade-in" role="tabpanel" aria-label="Generar Paquete PDF/OMR">
          <GuiaGeneracionExamenesVisual />

          <PlantillasConsolaGeneracion
            plantillaId={plantillaId}
            setPlantillaId={setPlantillaId}
            plantillas={plantillas}
            alumnos={alumnos}
            generando={generando}
            puedeGenerar={puedeGenerar}
            onGenerarExamen={generarExamen}
            generandoLote={generandoLote}
            plantillaSeleccionada={plantillaSeleccionada}
            periodos={periodos}
            puedeGenerarExamenes={puedeGenerarExamenes}
            onGenerarExamenesLote={generarExamenesLote}
            mensajeGeneracion={mensajeGeneracion}
            lotePdfUrl={lotePdfUrl}
            descargarPdfLote={descargarPdfLote}
            progresoLoteGeneracion={progresoLoteGeneracion}
            onIrAHistorial={() => cambiarTab('historial')}
          />
        </div>
      )}

      {/* ── PESTAÑA 3: HISTORIAL DE LOTES ── */}
      {tabActiva === 'historial' && (
        <div className="anim-fade-in" role="tabpanel" aria-label="Historial de Lotes">
          <GuiaHistorialLotesVisual />

          <PlantillasHistorialLotes
            cargandoExamenesGenerados={cargandoExamenesGenerados}
            examenesGenerados={examenesGenerados}
            alumnosPorId={alumnosPorId}
            formatearFechaHora={formatearFechaHora}
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
            lotesArchivados={lotesArchivados}
            cantidadLotesOmrArchivados={lotesArchivadosOmr.length}
            cargandoLotesArchivados={cargandoLotesArchivados}
            hayMasLotesArchivados={Boolean(cursorLotesArchivados)}
            onCargarMasLotesArchivados={cargarMasLotesArchivados}
            restaurandoLoteId={restaurandoLoteId}
            onRestaurarPaquete={restaurarPaquete}
          />

          <PlantillasOmrWorkflow
            assessmentDetalle={assessmentDetalle}
            trabajosOmr={trabajosOmr}
            cargandoTrabajosOmr={cargandoTrabajosOmr}
            errorTrabajosOmr={errorTrabajosOmr}
            hayMasTrabajosOmr={Boolean(cursorTrabajosOmr)}
            onReintentarTrabajosOmr={() => void cargarTrabajosOmr()}
            onCargarMasTrabajosOmr={() => void cargarTrabajosOmr(cursorTrabajosOmr, true)}
            onAbrirTrabajoOmr={abrirTrabajoOmr}
            lotesArchivadosOmr={lotesArchivadosOmr}
            cargandoLotesArchivadosOmr={cargandoLotesArchivadosOmr}
            errorCargaLotesArchivadosOmr={errorArchivoOmr}
            puedeLeerLotesArchivadosOmr={puedeLeerExamenes}
            onReintentarCargaLotesArchivadosOmr={reintentarCargaArchivoOmr}
            onSeleccionarLoteArchivado={seleccionarLoteArchivadoOmr}
            prevalidarReferenciaOmr={prevalidarReferenciaOmr}
            jobOmr={jobOmr}
            cargandoAssessmentId={cargandoAssessmentId}
            procesandoOmr={procesandoOmr}
            descargarArtifact={descargarArtifact}
            obtenerPreviewPaginaOmr={obtenerPreviewPaginaOmr}
            obtenerPreviewReferenciaOmr={obtenerPreviewReferenciaOmr}
            crearJobOmr={crearJobOmr}
            onReintentarIngestaPdf={reintentarIngestaPdfOmr}
            resolverHojaOmr={resolverHojaOmr}
            finalizarJobOmr={finalizarJobOmr}
          />
        </div>
      )}
    </div>
  );
}
