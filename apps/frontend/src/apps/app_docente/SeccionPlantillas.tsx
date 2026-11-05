/** Seccion de plantillas y generacion de examenes (orquestacion UI + handlers). */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError, ErrorRemoto } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { CircleCheck, FileText, ListTree, Search, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { clienteApi } from './clienteApiDocente';
import { GuiaGeneracionExamenesVisual } from './features/plantillas/components/GuiaGeneracionExamenesVisual';
import { GuiaHistorialLotesVisual } from './features/plantillas/components/GuiaHistorialLotesVisual';
import { PlantillasTabNavigation } from './features/plantillas/components/PlantillasTabNavigation';
import { PlantillasConsolaGeneracion } from './features/plantillas/components/PlantillasConsolaGeneracion';
import { PlantillasHistorialLotes } from './features/plantillas/components/PlantillasHistorialLotes';
import { PlantillasFormulario } from './features/plantillas/components/PlantillasFormulario';
import { PlantillasListado } from './features/plantillas/components/PlantillasListado';
import { PlantillasOmrWorkflow, type TrabajoOmrResumen } from './features/plantillas/components/PlantillasOmrWorkflow';
import { sincronizarResumenTrabajoOmr } from './features/plantillas/estadoTrabajoOmr';
import { cargarTodasLasPaginasArchivadas } from './features/plantillas/archivoOmr';
import { cargarExamenesActivosDeLote, describirLote } from './features/plantillas/historialLotes';
import { derivarDisponibilidadPlantilla, resumirLotesArchivadosOmr } from './features/plantillas/datosPlantilla';
import { guardarTabPlantillas, leerTabPlantillasInicial, type TabPlantillas } from './features/plantillas/tabPlantillasState';
import { confirmarLoteEnHistorial, crearClaveLoteGeneracion, guardarLotePendiente, leerLotePendiente, validarLoteListoParaDescarga, type LotePdfArchivadoResumen, type ProgresoLoteGeneracion } from './features/plantillas/loteGeneracionSesion';
import { confirmarClientRequestIdPlantilla, obtenerClientRequestIdPlantilla } from './features/plantillas/mutacionIdempotente';
import {
  usePlantillasGeneradosActions,
  type ExamenGeneradoResumen
} from './features/plantillas/hooks/usePlantillasGeneradosActions';
import { usePlantillasOmrActions } from './features/plantillas/hooks/usePlantillasOmrActions';
import { usePlantillasArchivadasGeneracion } from './features/plantillas/hooks/usePlantillasArchivadasGeneracion';
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
import { mensajeDeError } from './utilidades';

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

export function SeccionPlantillas({
  plantillas,
  periodos,
  periodosArchivados = [],
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
  periodosArchivados?: Periodo[];
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
  const [numeroPaginas, setNumeroPaginas] = useState(preferenciasPdf?.paginasPorTipo?.parcial ?? 2);
  const [reactivosObjetivo, setReactivosObjetivo] = useState(20);
  const [logoIzquierda, setLogoIzquierda] = useState(preferenciasPdf?.logos?.izquierdaPath ?? '');
  const [logoDerecha, setLogoDerecha] = useState(preferenciasPdf?.logos?.derechaPath ?? '');
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  const [examTemplateId, setExamTemplateId] = useState<'omr-canonical-v4' | 'omr-inline-exam-v1'>('omr-canonical-v4');
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);

  const [plantillaId, setPlantillaId] = useState('');
  const [mensajeGeneracion, setTextoMensajeGeneracion] = useState('');
  const [mensajeGeneracionEsError, setMensajeGeneracionEsError] = useState(false);
  const setMensajeGeneracion = useCallback<Dispatch<SetStateAction<string>>>((siguiente) => {
    setTextoMensajeGeneracion(siguiente);
    setMensajeGeneracionEsError(false);
  }, []);
  const mostrarErrorMensajeGeneracion = useCallback((texto: string) => {
    setTextoMensajeGeneracion(texto);
    setMensajeGeneracionEsError(true);
  }, []);
  const notificarRecuperacionSesion = useCallback((error: unknown) => {
    const action = accionToastSesionParaError(error, 'docente');
    if (!action) return;
    emitToast({
      level: 'warn',
      title: 'Recupera tu sesión',
      message: 'Recupera el acceso y vuelve a intentar la operación.',
      action
    });
  }, []);
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
  const [errorExamenesGenerados, setErrorExamenesGenerados] = useState('');
  const [errorLotesArchivados, setErrorLotesArchivados] = useState('');
  const versionConsultaHistorialRef = useRef(0);
  const plantillaConsultaHistorialRef = useRef('');
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
  useEffect(() => {
    if (modoEdicion) return;
    const paginasPredeterminadas = preferenciasPdf?.paginasPorTipo?.[tipo] ?? (tipo === 'global' ? 4 : 2);
    setNumeroPaginas(paginasPredeterminadas);
  }, [modoEdicion, preferenciasPdf?.paginasPorTipo, tipo]);
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
  const plantillasArchivadasGeneracion = usePlantillasArchivadasGeneracion({
    habilitada: tabActiva === 'generacion',
    puedeLeer: permisos.plantillas.leer,
    periodosArchivados,
    setMensaje: setMensajeGeneracion,
    setMensajeError: mostrarErrorMensajeGeneracion
  });
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
    setMensajeEsError(false);
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
    return [...(Array.isArray(plantillas) ? plantillas : []), ...plantillasArchivadasGeneracion].find((p) => p._id === plantillaId) ?? null;
  }, [plantillas, plantillasArchivadasGeneracion, plantillaId]);

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
    const versionConsulta = ++versionConsultaHistorialRef.current;
    if (!plantillaId) {
      setExamenesGenerados([]);
      setLotesArchivados([]);
      setCursorLotesArchivados(null);
      setErrorExamenesGenerados('');
      setErrorLotesArchivados('');
      setCargandoExamenesGenerados(false);
      setCargandoLotesArchivados(false);
      plantillaConsultaHistorialRef.current = '';
      return;
    }
    if (!puedeLeerExamenes) {
      setExamenesGenerados([]);
      setLotesArchivados([]);
      setCursorLotesArchivados(null);
      setErrorExamenesGenerados('');
      setErrorLotesArchivados('');
      setCargandoExamenesGenerados(false);
      setCargandoLotesArchivados(false);
      plantillaConsultaHistorialRef.current = plantillaId;
      return;
    }
    if (plantillaConsultaHistorialRef.current !== plantillaId) {
      plantillaConsultaHistorialRef.current = plantillaId;
      setExamenesGenerados([]);
      setLotesArchivados([]);
    }
    setErrorExamenesGenerados('');
    setErrorLotesArchivados('');
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
    if (versionConsulta !== versionConsultaHistorialRef.current) return;
    if (examenesResult.status === 'fulfilled') {
      setExamenesGenerados(Array.isArray(examenesResult.value.examenes) ? examenesResult.value.examenes : []);
      setErrorExamenesGenerados('');
    } else {
      setErrorExamenesGenerados(mensajeDeError(examenesResult.reason, 'No se pudo cargar el historial de exámenes'));
    }
    if (lotesResult.status === 'fulfilled') {
      setLotesArchivados(Array.isArray(lotesResult.value.lotes) ? lotesResult.value.lotes : []);
      setCursorLotesArchivados(lotesResult.value.nextCursor ?? null);
      setErrorLotesArchivados('');
    } else {
      setLotesArchivados([]);
      setErrorLotesArchivados(mensajeDeError(lotesResult.reason, 'No se pudo cargar el archivo de paquetes'));
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

  const lotesArchivadosOmr = useMemo(
    () => resumirLotesArchivadosOmr(examenesArchivadosOmr, periodos, periodosArchivadosOmr),
    [examenesArchivadosOmr, periodos, periodosArchivadosOmr]
  );

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
      mostrarErrorMensajeGeneracion(msg);
      notificarRecuperacionSesion(error);
    } finally {
      setCargandoAssessmentId(null);
    }
  }, [puedeAnalizarOmr, setJobOmrYResumen, setMensajeGeneracion, mostrarErrorMensajeGeneracion, notificarRecuperacionSesion]);

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
      setErrorLotesArchivados(mensajeDeError(error, 'No se pudo cargar más paquetes archivados'));
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
    return () => { versionConsultaHistorialRef.current += 1; };
  }, [plantillaId, cargarExamenesGenerados]);
  const { descargarPdfExamen, descargarPdfLote, descargarPdfLotePorId, descargarZipLote, descargarZipLotePorId, regenerarPdfExamen, eliminarExamenGenerado } = usePlantillasGeneradosActions({
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
    setMensajeGeneracionError: mostrarErrorMensajeGeneracion,
    cargarExamenesGenerados,
    enviarConPermiso,
    lotePdfUrl
  });
  const descargarPaquete = useCallback(async (loteId: string) => {
    const lote = String(loteId || '').trim(); if (!lote || descargandoLoteId) return;
    setDescargandoLoteId(`${lote}:pdf`);
    try { await descargarPdfLotePorId(lote); } finally { setDescargandoLoteId(null); }
  }, [descargandoLoteId, descargarPdfLotePorId]);
  const descargarZipPaquete = useCallback(async (loteId: string) => {
    const lote = String(loteId || '').trim();
    if (!lote || descargandoLoteId) return;
    setDescargandoLoteId(`${lote}:zip`);
    try { await descargarZipLotePorId(lote); } finally { setDescargandoLoteId(null); }
  }, [descargandoLoteId, descargarZipLotePorId]);
  const regenerarPaquete = useCallback(
    async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || regenerandoLoteId === lote) return;
      if (!puedeRegenerarExamenes) {
        avisarSinPermiso('No tienes permiso para regenerar examenes.');
        return;
      }
      try {
        setRegenerandoLoteId(lote);
        setMensajeGeneracion('Consultando todos los exámenes del paquete…');
        const examenesCompletos = await cargarExamenesActivosDeLote<ExamenGeneradoResumen>(
          lote, plantillaId, (ruta) => clienteApi.obtener<{ examenes: ExamenGeneradoResumen[]; nextCursor?: string | null }>(ruta)
        );
        const descripcion = describirLote(examenesCompletos);
        const ok = await confirm({
          title: 'Regenerar paquete',
          message: `Se regenerará el paquete completo: ${descripcion}.`,
          details: ['Se consultó el historial completo del paquete. Úsalo solo si necesitas una nueva versión de todos sus exámenes.'],
          confirmLabel: 'Sí, regenerar paquete',
          tone: 'warning'
        });
        if (!ok) return;
        setMensajeGeneracion(`Regenerando el paquete completo: ${descripcion}…`);
        for (const examen of examenesCompletos) await enviarConPermiso(
          'examenes:regenerar', `/examenes/generados/${encodeURIComponent(examen._id)}/regenerar`,
          { forzar: true }, 'No tienes permiso para regenerar examenes.'
        );
        emitToast({ level: 'ok', title: 'Paquete regenerado', message: `Se regeneró el paquete completo: ${descripcion}.`, durationMs: 3200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo regenerar el paquete');
        mostrarErrorMensajeGeneracion(msg);
        notificarRecuperacionSesion(error);
      } finally {
        setRegenerandoLoteId(null);
      }
    },
    [
      avisarSinPermiso,
      cargarExamenesGenerados,
      confirm,
      enviarConPermiso,
      plantillaId,
      puedeRegenerarExamenes,
      regenerandoLoteId,
      setMensajeGeneracion,
      mostrarErrorMensajeGeneracion,
      notificarRecuperacionSesion
    ]
  );

  const eliminarPaquete = useCallback(
    async (loteId: string, examenesLote: ExamenGeneradoResumen[]) => {
      const lote = String(loteId || '').trim();
      const lista = Array.isArray(examenesLote) ? examenesLote : [];
      if (!lote || eliminandoLoteId === lote || lista.length === 0) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para archivar este lote.');
        return;
      }
      const ok = await confirm({
        title: 'Archivar lote',
        message: 'El paquete seleccionado dejará de mostrarse en el historial activo.',
        details: ['Los datos se conservarán para auditoría y trazabilidad.'],
        confirmLabel: 'Sí, archivar lote',
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
        emitToast({ level: 'ok', title: 'Paquete archivado', message: 'Se ocultó del historial activo y se conservó para auditoría.', durationMs: 3200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo archivar el paquete');
        mostrarErrorMensajeGeneracion(msg);
        notificarRecuperacionSesion(error);
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
      setMensajeGeneracion,
      mostrarErrorMensajeGeneracion,
      notificarRecuperacionSesion
    ]
  );
  const restaurarPaquete = useCallback(
    async (loteId: string, descripcion = 'paquete archivado') => {
      const lote = String(loteId || '').trim();
      if (!lote || restaurandoLoteId === lote) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para restaurar lotes archivados.');
        return;
      }
      const ok = await confirm({
        title: 'Restaurar paquete',
        message: `El ${descripcion} volverá al historial activo.`,
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
        emitToast({ level: 'ok', title: 'Paquete restaurado', message: 'Volvió al historial activo.', durationMs: 2200 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo restaurar el paquete');
        mostrarErrorMensajeGeneracion(msg);
        notificarRecuperacionSesion(error);
      } finally {
        setRestaurandoLoteId(null);
      }
    },
    [avisarSinPermiso, cargarExamenesGenerados, confirm, enviarConPermiso, puedeArchivarExamenes, restaurandoLoteId, mostrarErrorMensajeGeneracion, notificarRecuperacionSesion]
  );
  const { cargarPreviewPdfPlantilla, cerrarPreviewPdfPlantilla, previsualizarPdfConfirmado } =
    usePlantillasPreviewActions({
      paginasExtraordinarioObjetivo: preferenciasPdf?.paginasPorTipo?.extraordinario ?? 4,
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
  const { cargarAssessmentDetalle, descargarArtifact, descargarDatasetOmr, obtenerPreviewPaginaOmr, obtenerPreviewReferenciaOmr, prevalidarReferenciaOmr, crearJobOmr, reintentarIngestaPdfOmr, resolverHojaOmr, finalizarJobOmr } = usePlantillasOmrActions({
    avisarSinPermiso,
    puedeDescargarExamenes,
    puedeAnalizarOmr,
    setCargandoAssessmentId,
    setAssessmentDetalle,
    setProcesandoOmr,
    setJobOmr: setJobOmrYResumen,
    setMensajeGeneracion,
    setMensajeGeneracionError: mostrarErrorMensajeGeneracion
  });

  const seleccionarLoteArchivadoOmr = useCallback(async (assessmentId: string) => {
    await cargarAssessmentDetalle(assessmentId);
  }, [cargarAssessmentDetalle]);

  // Derivaciones puras para catálogo, cobertura y lotes OMR viven en el feature.
  const { temasDisponibles, totalDisponiblePorTemas } = useMemo(
    () => derivarDisponibilidadPlantilla(preguntas, periodoId, temasSeleccionados),
    [preguntas, periodoId, temasSeleccionados]
  );

  useEffect(() => {
    if (totalDisponiblePorTemas <= 0) return;
    setReactivosObjetivo((actual) => Math.min(200, totalDisponiblePorTemas, Math.max(1, actual)));
  }, [totalDisponiblePorTemas]);

  function seleccionarLogo(lado: 'izquierda' | 'derecha', archivo?: File) {
    if (!archivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setMensaje('La imagen debe ser PNG, JPG o WebP.');
      setMensajeEsError(true);
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setMensaje('La imagen no puede superar 2 MB.');
      setMensajeEsError(true);
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const dataUrl = String(lector.result ?? '');
      if (!dataUrl.startsWith('data:image/')) {
        setMensaje('No se pudo leer la imagen seleccionada.');
        setMensajeEsError(true);
        return;
      }
      if (lado === 'izquierda') setLogoIzquierda(dataUrl);
      else setLogoDerecha(dataUrl);
      setMensaje('');
      setMensajeEsError(false);
    };
    lector.onerror = () => {
      setMensaje('No se pudo leer la imagen seleccionada.');
      setMensajeEsError(true);
    };
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
    setMensajeEsError(false);
  }

  function cancelarEdicion() {
    setModoEdicion(false);
    setPlantillaEditandoId(null);
    setTitulo('');
    setTipo('parcial');
    setPeriodoId('');
    setNumeroPaginas(preferenciasPdf?.paginasPorTipo?.parcial ?? 2);
    setReactivosObjetivo(20);
    setLogoIzquierda(preferenciasPdf?.logos?.izquierdaPath ?? '');
    setLogoDerecha(preferenciasPdf?.logos?.derechaPath ?? '');
    setTemasSeleccionados([]);
    setExamTemplateId('omr-canonical-v4');
    setMensaje('');
    setMensajeEsError(false);
  }

  function cambiarTab(tab: TabPlantillas) {
    if (tab === tabActiva) return;
    setTabActiva(tab);
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
      setMensajeEsError(false);

      if (existeTituloPlantillaDuplicado(titulo, plantillaEditandoId)) {
        const msgDup = 'Ya existe una plantilla activa con ese nombre.';
        setMensaje(msgDup);
        setMensajeEsError(true);
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

      await enviarConPermiso<{ plantilla?: { _id?: string } }>(
        'plantillas:gestionar',
        `/examenes/plantillas/${encodeURIComponent(plantillaEditandoId)}`,
        payload,
        'No tienes permiso para editar plantillas.'
      );
      confirmarClientRequestIdPlantilla('actualizar', plantillaEditandoId, clientRequestId);
      setPlantillaId(plantillaEditandoId);
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_plantilla', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
      return true;
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la plantilla');
      setMensaje(msg);
      setMensajeEsError(true);
      notificarRecuperacionSesion(error);
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
      setMensajeEsError(false);
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
      setMensajeEsError(true);
      notificarRecuperacionSesion(error);
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
      setMensajeEsError(false);

      if (existeTituloPlantillaDuplicado(titulo)) {
        const msgDup = 'Ya existe una plantilla activa con ese nombre.';
        setMensaje(msgDup);
        setMensajeEsError(true);
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

      const respuesta = await enviarConPermiso<{ plantilla?: { _id?: string } }>(
        'plantillas:gestionar',
        '/examenes/plantillas',
        payload,
        'No tienes permiso para crear plantillas.'
      );
      confirmarClientRequestIdPlantilla('crear', null, clientRequestId);
      if (respuesta?.plantilla?._id) setPlantillaId(String(respuesta.plantilla._id));
      setMensaje('Plantilla creada');
      setMensajeEsError(false);
      registrarAccionDocente('crear_plantilla', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear');
      setMensaje(msg);
      setMensajeEsError(true);
      notificarRecuperacionSesion(error);
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
      setMensajeGeneracion(ex ? `Examen generado. Folio: ${ex.folio}` : 'Examen generado');
      if (adv.length > 0) {
        emitToast({
          level: 'warn',
          title: 'Advertencias de generación',
          message: adv.join(' '),
          durationMs: 6000
        });
      }
      registrarAccionDocente('generar_examen', true, Date.now() - inicio);
      const generatedAssessmentId = String(payload?.generatedAssessment?._id ?? ex?._id ?? '').trim();
      if (generatedAssessmentId) {
        await cargarAssessmentDetalle(generatedAssessmentId);
      }
      await cargarExamenesGenerados();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar');
      mostrarErrorMensajeGeneracion(msg);
      notificarRecuperacionSesion(error);
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
    puedeGenerarExamenes,
    setMensajeGeneracion,
    mostrarErrorMensajeGeneracion,
    notificarRecuperacionSesion
  ]);

  const generarExamenesLote = useCallback(async (opciones?: { tipoExamen?: 'extraordinario'; alumnoIds?: string[]; grupo?: string }) => {
    const tipoExamen = opciones?.tipoExamen;
    const alumnosSolicitados = opciones?.alumnoIds ?? [];
    const grupoSolicitado = String(opciones?.grupo ?? '').trim();
    const alumnoIds = tipoExamen === 'extraordinario' ? [...new Set(alumnosSolicitados)].sort() : undefined;
    if (tipoExamen === 'extraordinario' && (!alumnoIds?.length || alumnoIds.length !== alumnosSolicitados.length)) {
      mostrarErrorMensajeGeneracion('Selecciona uno o más alumnos distintos para generar el extraordinario.');
      return;
    }
    const alumnosActivosPeriodo = Array.isArray(alumnos)
      ? alumnos.filter((alumno) => alumno.activo !== false && String(alumno.periodoId ?? '') === String(plantillaSeleccionada?.periodoId ?? ''))
      : [];
    const gruposPeriodo = [...new Set(alumnosActivosPeriodo.map((alumno) => String(alumno.grupo ?? '').trim()).filter(Boolean))];
    const grupoEfectivo = tipoExamen === 'extraordinario'
      ? undefined
      : grupoSolicitado || (gruposPeriodo.length === 1 ? gruposPeriodo[0] : '');
    if (tipoExamen !== 'extraordinario' && (!grupoEfectivo || !gruposPeriodo.includes(grupoEfectivo))) {
      mostrarErrorMensajeGeneracion(gruposPeriodo.length > 1
        ? 'Selecciona un grupo válido antes de generar el lote.'
        : 'No hay un grupo con alumnos activos para la plantilla seleccionada.');
      return;
    }
    const claveRecuperacion = crearClaveLoteGeneracion(plantillaId, tipoExamen, alumnoIds, grupoEfectivo);
    const lotePendiente = leerLotePendiente(claveRecuperacion) ??
      (progresoLoteGeneracion?.estado === 'fallido' && progresoLoteGeneracion.claveRecuperacion === claveRecuperacion
        ? progresoLoteGeneracion.loteId
        : null);
    const cantidadAlumnos = tipoExamen === 'extraordinario'
      ? alumnoIds?.length ?? 0
      : alumnosActivosPeriodo.filter((alumno) => String(alumno.grupo ?? '').trim() === grupoEfectivo).length;
    const ok = await confirm({
      title: lotePendiente
        ? tipoExamen === 'extraordinario' ? 'Reanudar extraordinarios' : 'Reanudar paquete incompleto'
        : tipoExamen === 'extraordinario' ? 'Generar exámenes extraordinarios' : 'Generar paquete masivo',
      message: lotePendiente
        ? 'Se reanudará el mismo lote, conservando los exámenes ya generados y verificados.'
        : tipoExamen === 'extraordinario'
          ? `Se generarán exámenes extraordinarios únicamente para los ${cantidadAlumnos} alumnos seleccionados. Sus calificaciones quedarán separadas de parciales y globales.`
          : `Se generarán ${cantidadAlumnos} exámenes para el grupo ${grupoEfectivo}.`,
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
    setLotePdfUrl(null);

    const totalEsperadoInicial = cantidadAlumnos;

    setProgresoLoteGeneracion({
      loteId: loteCliente,
      claveRecuperacion,
      totalEsperado: totalEsperadoInicial,
      generados: 0,
      porcentaje: 0,
      completado: false,
      estado: 'validando'
    });

    let sondeoActivo = true;
    let sondeoEnCurso = false;
    const consultarProgreso = async (loteId: string) => {
      const lote = String(loteId || '').trim();
      if (!lote || !sondeoActivo || sondeoEnCurso) return;
      sondeoEnCurso = true;
      try {
        const progreso = await clienteApi.obtener<ProgresoLoteGeneracion>(
          `/examenes/generados/lote/${encodeURIComponent(lote)}/progreso?plantillaId=${encodeURIComponent(plantillaId)}&grupo=${encodeURIComponent(grupoEfectivo ?? '')}&totalEsperado=${encodeURIComponent(String(totalEsperadoInicial))}`
        );
        if (!sondeoActivo) return;
        setProgresoLoteGeneracion((anterior) => ({
          loteId: String(progreso?.loteId || lote),
          claveRecuperacion: anterior?.claveRecuperacion ?? claveRecuperacion,
          totalEsperado: Number(progreso?.totalEsperado ?? anterior?.totalEsperado ?? totalEsperadoInicial ?? 0),
          generados: Number(progreso?.generados ?? 0),
          porcentaje: Number(progreso?.porcentaje ?? 0),
          completado: Boolean(progreso?.completado),
          estado: (progreso?.estado as ProgresoLoteGeneracion['estado'] | undefined) ?? (Number(progreso?.generados ?? 0) > 0 ? 'generando' : 'validando')
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
          ...(tipoExamen === 'extraordinario' ? { tipoExamen, alumnoIds } : { grupo: grupoEfectivo })
        },
        'No tienes permiso para generar examenes.',
        {
          timeoutMs: 900_000
        }
      );
      const totalAlumnos = Number(payload?.totalAlumnos ?? 0);
      const loteUrl = String(payload?.lotePdfUrl ?? '').trim();
      const loteRespuesta = String(payload?.loteId ?? loteCliente).trim() || loteCliente;
      sondeoActivo = false;
      globalThis.clearInterval(timerSondeo);
      const paginasMaximasPorExamen = tipoExamen === 'extraordinario' && Boolean(plantillaSeleccionada?.archivadoEn)
        ? 4
        : Number(plantillaSeleccionada?.numeroPaginas ?? 0);
      const queryProgreso = new URLSearchParams({
        plantillaId,
        grupo: grupoEfectivo ?? '',
        totalEsperado: String(totalEsperadoInicial)
      });
      const progresoPersistido = await clienteApi.obtener<ProgresoLoteGeneracion>(
        `/examenes/generados/lote/${encodeURIComponent(loteRespuesta)}/progreso?${queryProgreso.toString()}`
      );
      validarLoteListoParaDescarga(payload ?? {}, progresoPersistido, {
        loteId: loteCliente,
        totalAlumnos: totalEsperadoInicial,
        paginasMaximasPorExamen
      });
      await confirmarLoteEnHistorial({
        loteId: loteRespuesta,
        plantillaId,
        totalExamenes: totalAlumnos,
        totalPaginas: Number(payload?.totalPaginas),
        sha256: String(payload?.pdfSha256 ?? '')
      }, (ruta) => clienteApi.obtener(ruta));
      setProgresoLoteGeneracion({
        loteId: loteRespuesta,
        totalEsperado: totalAlumnos > 0 ? totalAlumnos : totalEsperadoInicial,
        generados: Number(progresoPersistido.generados),
        porcentaje: Number(progresoPersistido.porcentaje),
        completado: true,
        estado: 'completado',
        loteRegistrado: true,
        artefactoVerificado: true,
        pdfSha256: String(progresoPersistido.pdfSha256),
        totalPaginas: Number(progresoPersistido.totalPaginas)
      });
      setLotePdfUrl(loteUrl || null);
      guardarLotePendiente(claveRecuperacion, null);
      setMensajeGeneracion(
        `Generación de paquete lista. Alumnos: ${totalAlumnos}. Exámenes generados: ${Number(progresoPersistido.generados)}.`
      );
      registrarAccionDocente('generar_examenes_lote', true, Date.now() - inicio);
      await cargarExamenesGenerados();
    } catch (error) {
      const errorEnPrevalidacion = error instanceof ErrorRemoto && (error.detalle.detalles as { etapa?: unknown } | undefined)?.etapa === 'prevalidacion';
      if (errorEnPrevalidacion) guardarLotePendiente(claveRecuperacion, null);
      setProgresoLoteGeneracion(errorEnPrevalidacion ? null : (anterior) => anterior ? { ...anterior, completado: false, estado: 'fallido' } : null);
      const msg = mensajeDeError(error, 'No se pudo generar en lote');
      mostrarErrorMensajeGeneracion(`${msg}${errorEnPrevalidacion ? ' No se guardó ningún examen y puedes corregir la plantilla antes de iniciar otro lote.' : ''}`);
      notificarRecuperacionSesion(error);
      registrarAccionDocente('generar_examenes_lote', false);
    } finally {
      sondeoActivo = false;
      globalThis.clearInterval(timerSondeo);
      setGenerandoLote(false);
    }
  }, [alumnos, avisarSinPermiso, cargarExamenesGenerados, confirm, enviarConPermiso, plantillaSeleccionada, plantillaId,
    puedeGenerarExamenes, progresoLoteGeneracion, setMensajeGeneracion, mostrarErrorMensajeGeneracion, notificarRecuperacionSesion]);

  const formularioPlantilla = (
    <PlantillasFormulario
      modoEdicion={modoEdicion}
      plantillaEditando={plantillaEditando}
      tipo={tipo}
      onTipoChange={(siguienteTipo) => {
        setTipo(siguienteTipo);
        setNumeroPaginas(preferenciasPdf?.paginasPorTipo?.[siguienteTipo] ?? (siguienteTipo === 'global' ? 4 : 2));
      }}
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
      mensajeEsError={mensajeEsError}
    />
  );

  return (
    <div className="panel plantillas-shell">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head plantillas-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="icono-seccion-orb banco-panel__icon-orb plantillas-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={FileText} size={24} />
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
              {refrescandoPlantillas ? 'Recargando catálogo…' : 'Recargar catálogo'}
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
                <IconoLucide icon={FileText} size={16} />
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.total}</span>
              <span className="banco-mini-kpi__lbl">Plantillas</span>
            </div>
            <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Plantillas con unidades temáticas asignadas">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <IconoLucide icon={ListTree} size={16} />
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.conTemas}</span>
              <span className="banco-mini-kpi__lbl">Con temas</span>
            </div>
            <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Total de temas vinculados en plantillas">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <IconoLucide icon={CircleCheck} size={16} />
              </span>
              <span className="banco-mini-kpi__num">{resumenPlantillas.totalTemasSeleccionados}</span>
              <span className="banco-mini-kpi__lbl">Temas vinc.</span>
            </div>

            <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Estado del filtro de búsqueda">
              <span className="banco-mini-kpi__icon" aria-hidden="true">
                <IconoLucide icon={Search} size={16} />
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
      <PlantillasTabNavigation
        tabActiva={tabActiva}
        totalPlantillas={totalPlantillasTodas}
        generandoLote={generandoLote}
        totalExamenes={examenesGenerados.length}
        onChange={cambiarTab}
      />

      {/* ── PESTAÑA 1: DISEÑAR EXÁMENES ── */}
      <div id="plantillas-panel-diseno" role="tabpanel" aria-labelledby="plantillas-tab-diseno" tabIndex={0} hidden={tabActiva !== 'diseno'}>
        {tabActiva === 'diseno' && (
        <div className="plantillas-diseno-tab anim-fade-in">
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
      </div>

      {/* ── PESTAÑA 2: GENERAR PAQUETE PDF/OMR ── */}
      <div id="plantillas-panel-generacion" role="tabpanel" aria-labelledby="plantillas-tab-generacion" tabIndex={0} hidden={tabActiva !== 'generacion'}>
        {tabActiva === 'generacion' && (
        <div className="anim-fade-in">
          <GuiaGeneracionExamenesVisual />
          <PlantillasConsolaGeneracion
            plantillaId={plantillaId}
            setPlantillaId={setPlantillaId}
            plantillas={[...(Array.isArray(plantillas) ? plantillas : []), ...plantillasArchivadasGeneracion]}
            alumnos={alumnos}
            generando={generando}
            puedeGenerar={puedeGenerar}
            onGenerarExamen={generarExamen}
            generandoLote={generandoLote}
            plantillaSeleccionada={plantillaSeleccionada}
            periodos={[...periodos, ...periodosArchivados]}
            paginasExtraordinarioObjetivo={preferenciasPdf?.paginasPorTipo?.extraordinario ?? 4}
            puedeGenerarExamenes={puedeGenerarExamenes}
            onGenerarExamenesLote={generarExamenesLote}
            mensajeGeneracion={mensajeGeneracion}
            mensajeGeneracionEsError={mensajeGeneracionEsError}
            lotePdfUrl={lotePdfUrl}
            descargarPdfLote={descargarPdfLote}
            descargarZipLote={descargarZipLote}
            progresoLoteGeneracion={progresoLoteGeneracion}
            onPrevisualizarExtraordinario={previsualizarPdfConfirmado}
            onIrAHistorial={() => cambiarTab('historial')}
          />
        </div>
        )}
      </div>

      {/* ── PESTAÑA 3: HISTORIAL DE LOTES ── */}
      <div id="plantillas-panel-historial" role="tabpanel" aria-labelledby="plantillas-tab-historial" tabIndex={0} hidden={tabActiva !== 'historial'}>
        {tabActiva === 'historial' && (
        <div className="anim-fade-in">
          <GuiaHistorialLotesVisual />
          <PlantillasHistorialLotes
            cargandoExamenesGenerados={cargandoExamenesGenerados}
            errorExamenesGenerados={errorExamenesGenerados}
            errorLotesArchivados={errorLotesArchivados}
            onReintentarCarga={() => void cargarExamenesGenerados()}
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
            onDescargarZipPaquete={descargarZipPaquete}
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
            descargarDatasetOmr={descargarDatasetOmr}
            puedeAnalizarOmr={puedeAnalizarOmr}
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
    </div>
  );
}
