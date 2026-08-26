/**
 * SeccionCalificaciones
 *
 * Responsabilidad: Gestión de actas de calificaciones, visualización de métricas,
 * encuadre institucional y firmas digitales de alumnos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import { SeccionEscaneo } from './SeccionEscaneo';
import { SeccionCalificar } from './SeccionCalificar';
import { GuiaCalificacionesVisual } from './GuiaCalificacionesVisual';
import type {
  Alumno,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  SolicitudRevisionAlumno
} from './tipos';
import {
  construirClaveCorrectaExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarTemplateVersionOmrDetectada
} from './utilidades';

export function SeccionCalificaciones({
  periodos = [],
  alumnos = [],
  onAnalizar,
  onPrevisualizar,
  resultado,
  onActualizar,
  onActualizarPregunta,
  respuestasPaginaEditable,
  revisionOmrConfirmada,
  hayCambiosPendientesOmrActiva = false,
  onConfirmarRevisionOmr,
  revisionesOmr,
  examenIdActivo,
  paginaActiva,
  onSeleccionarRevision,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  claveCorrectaParaCalificar,
  ordenPreguntasParaCalificar,
  examenId,
  alumnoId,
  marcaActualizacionCalificados = 0,
  resultadoParaCalificar,
  respuestasParaCalificar,
  respuestasCombinadasRevision = [],
  onCalificar,
  solicitudesRevision = [],
  onSincronizarSolicitudesRevision = async () => ({}),
  onResolverSolicitudRevision = async () => ({}),
  onLimpiarColaEscaneos = () => {},
  onCargarRevisionHistoricaCalificada,
  permisos,
  avisarSinPermiso
}: {
  periodos?: Periodo[];
  alumnos: Alumno[];
  onAnalizar: (
    folio: string,
    numeroPagina: number,
    imagenBase64: string,
    contexto?: { nombreArchivo?: string }
  ) => Promise<ResultadoAnalisisOmr>;
  onPrevisualizar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  }) => Promise<{ preview: PreviewCalificacion }>;
  resultado: ResultadoOmr | null;
  onActualizar: (respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => void;
  onActualizarPregunta: (numeroPregunta: number, opcion: string | null) => void;
  respuestasPaginaEditable: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  revisionOmrConfirmada: boolean;
  hayCambiosPendientesOmrActiva?: boolean;
  onConfirmarRevisionOmr: (confirmada: boolean) => void;
  revisionesOmr: RevisionExamenOmr[];
  examenIdActivo: string | null;
  paginaActiva: number | null;
  onSeleccionarRevision: (examenId: string, numeroPagina: number) => void;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  claveCorrectaParaCalificar?: Record<number, string>;
  ordenPreguntasParaCalificar?: number[];
  examenId: string | null;
  alumnoId: string | null;
  marcaActualizacionCalificados?: number;
  resultadoParaCalificar: ResultadoOmr | null;
  respuestasParaCalificar: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  respuestasCombinadasRevision?: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    evaluacionContinua?: number;
    proyecto?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 1 | 3 | 4;
      motivosRevision: string[];
      revisionConfirmada: boolean;
      qrTexto?: string;
    };
  }) => Promise<unknown>;
  solicitudesRevision?: SolicitudRevisionAlumno[];
  onSincronizarSolicitudesRevision?: () => Promise<unknown>;
  onResolverSolicitudRevision?: (id: string, estado: 'atendida' | 'rechazada', respuestaDocente?: string) => Promise<unknown>;
  onLimpiarColaEscaneos?: () => void;
  onCargarRevisionHistoricaCalificada?: (payload: {
    examenId: string;
    folio: string;
    alumnoId: string | null;
    numeroPagina: number;
    respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
    paginas?: Array<{
      numeroPagina: number;
      respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
      resultado: ResultadoOmr;
      imagenBase64?: string;
    }>;
    claveCorrectaPorNumero: Record<number, string>;
    ordenPreguntas: number[];
    resultado: ResultadoOmr;
  }) => void;
  permisos: PermisosUI;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  type ExamenEntregado = {
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

  const puedeAnalizar = permisos.omr.analizar;
  const puedeCalificar = permisos.calificaciones.calificar;
  const revisionesSeguras = useMemo(() => (Array.isArray(revisionesOmr) ? revisionesOmr : []), [revisionesOmr]);
  const totalPaginas = revisionesSeguras.reduce((acumulado, examen) => acumulado + examen.paginas.length, 0);
  const paginasPendientes = revisionesSeguras.reduce(
    (acumulado, examen) => acumulado + examen.paginas.filter((pagina) => pagina.resultado.estadoAnalisis !== 'ok').length,
    0
  );
  const examenesListos = revisionesSeguras.filter((examen) => examen.revisionConfirmada).length;
  const examenesRevisados = useMemo(
    () => revisionesSeguras.filter((examen) => examen.revisionConfirmada && Array.isArray(examen.paginas) && examen.paginas.length > 0),
    [revisionesSeguras]
  );
  const [examenesCalificadosPersistidos, setExamenesCalificadosPersistidos] = useState<ExamenEntregado[]>([]);
  const [examenesPorId, setExamenesPorId] = useState<Map<string, ExamenEntregado>>(new Map());
  const [periodoReporteId, setPeriodoReporteId] = useState('');
  const [reporteDescargando, setReporteDescargando] = useState<'csv' | 'xlsx' | null>(null);
  const [mensajeReporte, setMensajeReporte] = useState('');

  useEffect(() => {
    if (!periodoReporteId && periodos.length > 0) {
      setPeriodoReporteId(String(periodos[0]?._id ?? '').trim());
      return;
    }
    if (periodoReporteId && !periodos.some((periodo) => String(periodo?._id ?? '').trim() === periodoReporteId)) {
      setPeriodoReporteId('');
    }
  }, [periodoReporteId, periodos]);

  const descargarReporteCalificaciones = useCallback(
    async (formato: 'csv' | 'xlsx') => {
      const periodoId = String(periodoReporteId || '').trim();
      if (!periodoId) {
        setMensajeReporte('Selecciona una materia antes de descargar el reporte.');
        return;
      }
      const token = obtenerTokenDocente();
      if (!token) {
        setMensajeReporte('Sesión no válida. Vuelve a iniciar sesión.');
        return;
      }

      try {
        setReporteDescargando(formato);
        setMensajeReporte('');
        const respuesta = await fetch(
          `${clienteApi.baseApi}/analiticas/calificaciones-${formato}?periodoId=${encodeURIComponent(periodoId)}`,
          { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }
        );
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const archivo = await respuesta.blob();
        const tipo = formato === 'csv' ? 'csv' : 'xlsx';
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `calificaciones-${periodoId}.${tipo}`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
        setMensajeReporte(`Reporte ${formato.toUpperCase()} descargado.`);
        registrarAccionDocente(`descargar_reporte_calificaciones_${formato}`, true);
      } catch (error) {
        const mensaje = mensajeDeError(error, `No se pudo descargar el reporte ${formato.toUpperCase()}`);
        setMensajeReporte(mensaje);
        emitToast({
          level: 'error',
          title: 'Reporte no disponible',
          message: mensaje,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
        registrarAccionDocente(`descargar_reporte_calificaciones_${formato}`, false);
      } finally {
        setReporteDescargando(null);
      }
    },
    [periodoReporteId]
  );
  const solicitudesSeguras = useMemo(
    () => (Array.isArray(solicitudesRevision) ? solicitudesRevision : []),
    [solicitudesRevision]
  );
  const [examenRevisadoSeleccionadoId, setExamenRevisadoSeleccionadoId] = useState('');
  const [respuestaPorSolicitudId, setRespuestaPorSolicitudId] = useState<Record<string, string>>({});
  const [alumnoManualId, setAlumnoManualId] = useState('');
  const [examenesManual, setExamenesManual] = useState<ExamenEntregado[]>([]);
  const [plantillasPorId, setPlantillasPorId] = useState<Map<string, Plantilla>>(new Map());
  const [filtroFolioManual, setFiltroFolioManual] = useState('');
  const [examenManualId, setExamenManualId] = useState('');
  const [cargandoExamenesManual, setCargandoExamenesManual] = useState(false);
  const [activandoManual, setActivandoManual] = useState(false);
  const [manualMensaje, setManualMensaje] = useState('');
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  // States for Encuadre Académico
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [encuadreEstado, setEncuadreEstado] = useState<any>(null);
  const [loadingEncuadre, setLoadingEncuadre] = useState(false);
  const [errorEncuadre, setErrorEncuadre] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardandoEncuadre, setGuardandoEncuadre] = useState(false);

  // Form fields for Encuadre
  const [instNombre, setInstNombre] = useState('Centro Universitario Hidalguense');
  const [instLema, setInstLema] = useState('LA SABIDURIA ES NUESTRA FUERZA');
  const [logoBase64, setLogoBase64] = useState('');
  const [logoCarreraBase64, setLogoCarreraBase64] = useState('');
  const [carrera, setCarrera] = useState('Licenciatura en Ingeniería en Sistemas Computacionales');
  const [clave, setClave] = useState('ISCF213');
  const [area, setArea] = useState('Área de Ingeniería');
  const [ejeFormacion, setEjeFormacion] = useState('Profesional');
  const [horasDocente, setHorasDocente] = useState(50);
  const [horasIndependientes, setHorasIndependientes] = useState(100);
  const [creditos, setCreditos] = useState(6.25);
  const [objetivoGeneral, setObjetivoGeneral] = useState('');
  const [cicloLectivo, setCicloLectivo] = useState('Del 18 de mayo al 26 de junio de 2026');
  
  // Weights
  const [pctExamenes, setPctExamenes] = useState(50);
  const [pctEvalContinua, setPctEvalContinua] = useState(50);
  const [pond1er, setPond1er] = useState(20);
  const [pond2do, setPond2do] = useState(20);
  const [pondGlobal, setPondGlobal] = useState(60);
  const [pondEscrito, setPondEscrito] = useState(60);
  const [pondPractica, setPondPractica] = useState(40);

  const cargarEstadoEncuadre = useCallback((periodoId: string) => {
    if (!periodoId) {
      setEncuadreEstado(null);
      return;
    }
    setLoadingEncuadre(true);
    setErrorEncuadre(null);
    clienteApi.obtener(`/evaluaciones/encuadre/estado/${periodoId}`)
      .then((res: any) => {
        setEncuadreEstado(res?.inicializado === false ? null : res);
        setLoadingEncuadre(false);
      })
      .catch((err: any) => {
        setEncuadreEstado(null);
        setLoadingEncuadre(false);
        if (err.status !== 404) {
          setErrorEncuadre(err.message || 'Error al obtener estado de firmas');
        }
      });
  }, []);

  useEffect(() => {
    if (selectedPeriodoId) {
      cargarEstadoEncuadre(selectedPeriodoId);
    } else if (periodos.length > 0) {
      const firstId = String(periodos[0]._id || '');
      setSelectedPeriodoId(firstId);
      cargarEstadoEncuadre(firstId);
    }
  }, [selectedPeriodoId, periodos, cargarEstadoEncuadre]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInicializarEncuadre = async () => {
    if (!selectedPeriodoId) return;
    setGuardandoEncuadre(true);
    setErrorEncuadre(null);
    try {
      await clienteApi.enviar('/evaluaciones/encuadre/inicializar', {
        periodoId: selectedPeriodoId,
        carrera,
        clave,
        area,
        horasDocente,
        horasIndependientes,
        creditos,
        objetivoGeneral,
        cicloLectivo,
        institucionNombre: instNombre,
        institucionLema: instLema,
        logoBase64,
        logoCarreraBase64,
        porcentajeExamenes: pctExamenes,
        porcentajeEvalContinua: pctEvalContinua,
        ponderacion1erParcial: pond1er,
        ponderacion2doParcial: pond2do,
        ponderacionGlobal: pondGlobal,
        ponderacionExamenEscrito: pondEscrito,
        ponderacionPractica: pondPractica,
        ejeFormacion
      });
      emitToast({ level: 'ok', title: 'Encuadre', message: 'Encuadre digital inicializado y notificado por correo.' });
      setMostrarFormulario(false);
      cargarEstadoEncuadre(selectedPeriodoId);
    } catch (err: any) {
      setErrorEncuadre(err.message || 'Error al inicializar el encuadre');
    } finally {
      setGuardandoEncuadre(false);
    }
  };

  const [resolviendoSolicitudId, setResolviendoSolicitudId] = useState('');
  const [mensajeRevision, setMensajeRevision] = useState('');
  const [filtroSolicitudes, setFiltroSolicitudes] = useState('');
  const bancoPorPeriodoRef = useRef<Map<string, Pregunta[]>>(new Map());
  const cargasCalificacionEnCursoRef = useRef<Set<string>>(new Set());
  const examenesSinCalificacionRef = useRef<Set<string>>(new Set());
  const ultimoIntentoCalificacionRef = useRef<Map<string, number>>(new Map());
  const [manualContexto, setManualContexto] = useState<{
    examenId: string;
    alumnoId: string;
    folio: string;
    tipoExamenEtiqueta?: string;
    plantillaTitulo?: string;
    soloLectura?: boolean;
    resumenPersistido?: {
      aciertos: number;
      totalReactivos: number;
      calificacionFinalSobre5: number;
    };
    claveCorrectaPorNumero: Record<number, string>;
    ordenPreguntas: number[];
    respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  } | null>(null);
  const mostrarSeccionCalificar = Boolean(
    manualContexto || (revisionOmrConfirmada && examenId && alumnoId)
  );
  function seleccionarAlumnoManual(valor: string) {
    if (valor === alumnoManualId) return;
    setAlumnoManualId(valor);
    setCargandoExamenesManual(Boolean(valor));
    setExamenesManual([]);
    setFiltroFolioManual('');
    setExamenManualId('');
    setManualMensaje('');
    setManualContexto(null);
  }

  function etiquetarTipoExamen(tipo?: string | null) {
    const valor = String(tipo ?? '').trim().toLowerCase();
    if (valor === 'parcial') return 'Parcial 1';
    if (valor === 'global') return 'Global final';
    return '';
  }

  const examenManualSeleccionado = useMemo(
    () => examenesManual.find((item) => item._id === examenManualId) ?? null,
    [examenesManual, examenManualId]
  );

  const resumenExamenManual = useMemo(() => {
    if (!examenManualSeleccionado) {
      return { tipo: '-', plantilla: '-', estado: '-' };
    }
    const plantilla = plantillasPorId.get(String(examenManualSeleccionado.plantillaId ?? '').trim());
    const tipo =
      etiquetarTipoExamen(String(examenManualSeleccionado.tipoExamen ?? '').trim()) ||
      etiquetarTipoExamen(String(plantilla?.tipo ?? '').trim()) ||
      '-';
    const plantillaTitulo =
      String(examenManualSeleccionado.plantillaTitulo ?? '').trim() ||
      String(plantilla?.titulo ?? '').trim() ||
      '-';
    const estado = String(examenManualSeleccionado.estado ?? 'entregado').trim() || 'entregado';
    return { tipo, plantilla: plantillaTitulo, estado };
  }, [examenManualSeleccionado, plantillasPorId]);
  const mapaAlumnos = useMemo(
    () => new Map((Array.isArray(alumnos) ? alumnos : []).map((item) => [String(item._id), String(item.nombreCompleto ?? '').trim()])),
    [alumnos]
  );
  const resumenSolicitudes = useMemo(() => {
    const pendientes = solicitudesSeguras.filter((s) => s.estado === 'pendiente').length;
    const atendidas = solicitudesSeguras.filter((s) => s.estado === 'atendida').length;
    const rechazadas = solicitudesSeguras.filter((s) => s.estado === 'rechazada').length;
    return { pendientes, atendidas, rechazadas, total: solicitudesSeguras.length };
  }, [solicitudesSeguras]);
  const solicitudesFiltradas = useMemo(() => {
    const q = String(filtroSolicitudes ?? '').trim().toLowerCase();
    if (!q) return solicitudesSeguras;
    return solicitudesSeguras.filter((solicitud) => {
      const texto = [
        solicitud.folio,
        solicitud.numeroPregunta,
        solicitud.comentario,
        solicitud.estado,
        solicitud.externoId
      ]
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  }, [filtroSolicitudes, solicitudesSeguras]);
  const examenActivoMeta = useMemo(() => {
    const id = String(examenId ?? '').trim();
    if (!id) return null;
    return examenesPorId.get(id) ?? null;
  }, [examenId, examenesPorId]);
  const tipoExamenActivoEtiqueta = useMemo(() => {
    const tipo = String(examenActivoMeta?.tipoExamen ?? '').trim();
    const plantilla = plantillasPorId.get(String(examenActivoMeta?.plantillaId ?? '').trim());
    return etiquetarTipoExamen(tipo) || etiquetarTipoExamen(String(plantilla?.tipo ?? '').trim()) || null;
  }, [examenActivoMeta, plantillasPorId]);
  const examenActivoEtiqueta = useMemo(() => {
    const folio = String(examenActivoMeta?.folio ?? '').trim();
    const plantillaTitulo = String(examenActivoMeta?.plantillaTitulo ?? '').trim();
    const partes = [folio ? `Folio ${folio}` : '', plantillaTitulo || ''].filter((parte) => parte.length > 0);
    return partes.length > 0 ? partes.join(' · ') : null;
  }, [examenActivoMeta]);
  const alumnoActivoNombre = useMemo(() => {
    const id = String(alumnoId ?? examenActivoMeta?.alumnoId ?? '').trim();
    if (!id) return null;
    return mapaAlumnos.get(id) ?? null;
  }, [alumnoId, examenActivoMeta?.alumnoId, mapaAlumnos]);

  useEffect(() => {
    let cancelado = false;
    void clienteApi
      .obtener<{ plantillas?: Plantilla[] }>('/examenes/plantillas')
      .then((payload) => {
        if (cancelado) return;
        const lista = Array.isArray(payload?.plantillas) ? payload.plantillas : [];
        const mapa = new Map<string, Plantilla>();
        for (const plantilla of lista) {
          const id = String(plantilla?._id ?? '').trim();
          if (!id) continue;
          mapa.set(id, plantilla);
        }
        setPlantillasPorId(mapa);
      })
      .catch(() => {
        if (!cancelado) setPlantillasPorId(new Map());
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const examenesManualFiltrados = useMemo(() => {
    const filtro = String(filtroFolioManual ?? '').trim().toUpperCase();
    if (!filtro) return examenesManual;
    return examenesManual.filter((examen) => String(examen?.folio ?? '').toUpperCase().includes(filtro));
  }, [examenesManual, filtroFolioManual]);

  const opcionesExamenesRevisados = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        folio: string;
        paginas: number;
        fuente: 'cola' | 'calificado';
      }
    >();
    for (const examen of examenesRevisados) {
      mapa.set(examen.examenId, {
        id: examen.examenId,
        folio: String(examen.folio ?? '').trim() || examen.examenId,
        paginas: Array.isArray(examen.paginas) ? examen.paginas.length : 0,
        fuente: 'cola'
      });
    }
    for (const examen of examenesCalificadosPersistidos) {
      const id = String(examen._id ?? '').trim();
      if (!id || mapa.has(id)) continue;
      mapa.set(id, {
        id,
        folio: String(examen.folio ?? '').trim() || id,
        paginas: 0,
        fuente: 'calificado'
      });
    }
    return Array.from(mapa.values());
  }, [examenesCalificadosPersistidos, examenesRevisados]);

  useEffect(() => {
    let cancelado = false;
    examenesSinCalificacionRef.current.clear();
    ultimoIntentoCalificacionRef.current.clear();
    void clienteApi
      .obtener<{ examenes?: ExamenEntregado[] }>('/examenes/generados?limite=200')
      .then((payload) => {
        if (cancelado) return;
        const lista = Array.isArray(payload?.examenes) ? payload.examenes : [];
        const mapa = new Map<string, ExamenEntregado>();
        for (const examen of lista) {
          const id = String(examen?._id ?? '').trim();
          if (!id) continue;
          mapa.set(id, examen);
        }
        setExamenesPorId(mapa);
        const calificados = lista
          .filter((item) => String(item?.estado ?? '').trim().toLowerCase() === 'calificado')
          .sort((a, b) => {
            const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
            const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
            return bTime - aTime;
          });
        setExamenesCalificadosPersistidos(calificados);
      })
      .catch(() => {
        if (!cancelado) {
          setExamenesCalificadosPersistidos([]);
          setExamenesPorId(new Map());
        }
      });
    return () => {
      cancelado = true;
    };
  }, [marcaActualizacionCalificados]);

  useEffect(() => {
    if (!examenIdActivo) return;
    if (!opcionesExamenesRevisados.some((item) => item.id === examenIdActivo)) return;
    if (examenRevisadoSeleccionadoId === examenIdActivo) return;
    setExamenRevisadoSeleccionadoId(examenIdActivo);
  }, [examenIdActivo, examenRevisadoSeleccionadoId, opcionesExamenesRevisados]);

  useEffect(() => {
    if (!examenRevisadoSeleccionadoId) return;
    if (opcionesExamenesRevisados.some((item) => item.id === examenRevisadoSeleccionadoId)) return;
    setExamenRevisadoSeleccionadoId('');
  }, [examenRevisadoSeleccionadoId, opcionesExamenesRevisados]);

  useEffect(() => {
    if (!examenManualId) return;
    if (examenesManualFiltrados.some((item) => item._id === examenManualId)) return;
    setExamenManualId('');
  }, [examenManualId, examenesManualFiltrados]);

  useEffect(() => {
    if (!alumnoManualId) {
      setCargandoExamenesManual(false);
      return;
    }
    let cancelado = false;
    void clienteApi
      .obtener<{ examenes?: ExamenEntregado[] }>(
        `/examenes/generados?alumnoId=${encodeURIComponent(alumnoManualId)}&limite=200`
      )
      .then((payload) => {
        if (cancelado) return;
        const lista = Array.isArray(payload?.examenes) ? payload.examenes : [];
        const entregados = lista.filter((item) => {
          const estado = String(item?.estado ?? '').toLowerCase();
          return estado === 'entregado' || estado === 'calificado';
        });
        entregados.sort((a, b) => {
          const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
          const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
          return bTime - aTime;
        });
        setExamenesManual(entregados);
        setExamenManualId((prev) => (entregados.some((item) => item._id === prev) ? prev : ''));
        setManualMensaje(entregados.length === 0 ? 'No hay exámenes entregados para el alumno seleccionado.' : '');
      })
      .catch((error) => {
        if (cancelado) return;
        setExamenesManual([]);
        setExamenManualId('');
        setManualMensaje(mensajeDeError(error, 'No se pudo cargar la lista de exámenes entregados'));
      })
      .finally(() => {
        if (!cancelado) setCargandoExamenesManual(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alumnoManualId]);

  const obtenerBancoPreguntas = useCallback(async (periodoId: string) => {
    const llave = String(periodoId ?? '').trim();
    if (llave && bancoPorPeriodoRef.current.has(llave)) {
      return bancoPorPeriodoRef.current.get(llave) ?? [];
    }

    const banco = await clienteApi.obtener<{ preguntas: Pregunta[] }>(
      `/banco-preguntas${llave ? `?periodoId=${encodeURIComponent(llave)}` : ''}`
    );
    const preguntas = Array.isArray(banco?.preguntas) ? banco.preguntas : [];
    if (llave) {
      bancoPorPeriodoRef.current.set(llave, preguntas);
    }
    return preguntas;
  }, []);

  async function activarManualDesdeEntregado() {
    if (activandoManual) return;
    if (!examenManualId) {
      setManualMensaje('Selecciona un examen entregado.');
      return;
    }
    const examenSeleccionado = examenesManual.find((item) => item._id === examenManualId);
    if (!examenSeleccionado) {
      setManualMensaje('No se encontró el examen seleccionado.');
      return;
    }
    try {
      setActivandoManual(true);
      setManualMensaje('');
      const detalle = await clienteApi.obtener<{ examen?: ExamenGeneradoClave & { _id?: string; alumnoId?: string | null; folio?: string; periodoId?: string } }>(
        `/examenes/generados/folio/${encodeURIComponent(examenSeleccionado.folio)}`
      );
      const examenDetalle = detalle?.examen;
      if (!examenDetalle) {
        setManualMensaje('No se pudo cargar el detalle del examen.');
        return;
      }

      const periodoId = String((examenDetalle as { periodoId?: unknown })?.periodoId ?? '').trim();
      const preguntasBanco = await obtenerBancoPreguntas(periodoId);
      const clave = construirClaveCorrectaExamen(examenDetalle, preguntasBanco);
      if (clave.ordenPreguntas.length === 0) {
        setManualMensaje('No se pudo construir la clave del examen para calificación manual.');
        return;
      }

      setManualContexto({
        examenId: String(examenDetalle._id ?? examenSeleccionado._id),
        alumnoId: String(examenDetalle.alumnoId ?? examenSeleccionado.alumnoId ?? alumnoManualId),
        folio: String(examenDetalle.folio ?? examenSeleccionado.folio),
        tipoExamenEtiqueta:
          etiquetarTipoExamen(String(examenSeleccionado.tipoExamen ?? '').trim()) ||
          etiquetarTipoExamen(String(plantillasPorId.get(String(examenSeleccionado.plantillaId ?? '').trim())?.tipo ?? '').trim()) ||
          undefined,
        plantillaTitulo:
          String(examenSeleccionado.plantillaTitulo ?? '').trim() ||
          String(plantillasPorId.get(String(examenSeleccionado.plantillaId ?? '').trim())?.titulo ?? '').trim() ||
          undefined,
        soloLectura: false,
        claveCorrectaPorNumero: clave.claveCorrectaPorNumero,
        ordenPreguntas: clave.ordenPreguntas,
        respuestasDetectadas: clave.ordenPreguntas.map((numeroPregunta) => ({ numeroPregunta, opcion: null, confianza: 0 }))
      });
      setManualMensaje('Modo manual activado para el examen seleccionado.');
    } catch (error) {
      setManualMensaje(mensajeDeError(error, 'No se pudo activar la calificación manual'));
    } finally {
      setActivandoManual(false);
    }
  }

  const cargarExamenCalificadoPersistido = useCallback(async (examenId: string) => {
    const id = String(examenId ?? '').trim();
    const ahora = Date.now();
    const ultimoIntento = Number(ultimoIntentoCalificacionRef.current.get(id) ?? 0);
    if (id && ahora - ultimoIntento < 5000) return;
    if (!id) return;
    if (examenesSinCalificacionRef.current.has(id)) {
      setManualMensaje('Aún no hay calificación guardada para el examen seleccionado.');
      return;
    }
    if (cargasCalificacionEnCursoRef.current.has(id)) return;
    const examenPersistido = examenesCalificadosPersistidos.find((item) => String(item._id ?? '').trim() === id);
    if (!examenPersistido) {
      emitToast({ level: 'warn', title: 'Examen', message: 'No se encontró el examen calificado seleccionado.', durationMs: 3200 });
      return;
    }
    try {
      ultimoIntentoCalificacionRef.current.set(id, ahora);
      cargasCalificacionEnCursoRef.current.add(id);
      setActivandoManual(true);
      setManualMensaje('');
      const [detalle, calificacionPayload] = await Promise.all([
        clienteApi.obtener<{ examen?: ExamenGeneradoClave & { _id?: string; alumnoId?: string | null; folio?: string; periodoId?: string } }>(
          `/examenes/generados/folio/${encodeURIComponent(String(examenPersistido.folio ?? '').trim())}`
        ),
        clienteApi.obtener<{
          calificacion?: {
            respuestasDetectadas?: Array<{ numeroPregunta?: number; opcion?: string | null; confianza?: number }>;
            aciertos?: number;
            totalReactivos?: number;
            calificacionExamenFinalTexto?: string;
            paginasOmr?: Array<{ numeroPagina?: number; imagenBase64?: string }>;
          };
        }>(`/calificaciones/examen/${encodeURIComponent(id)}`)
      ]);
      const examenDetalle = detalle?.examen;
      if (!examenDetalle) {
        setManualMensaje('No se pudo cargar el detalle del examen calificado.');
        return;
      }

      const periodoId = String((examenDetalle as { periodoId?: unknown })?.periodoId ?? '').trim();
      const preguntasBanco = await obtenerBancoPreguntas(periodoId);
      const clave = construirClaveCorrectaExamen(examenDetalle, preguntasBanco);
      if (clave.ordenPreguntas.length === 0) {
        setManualMensaje('No se pudo reconstruir la clave del examen calificado.');
        return;
      }

      const respuestasDetectadas = Array.isArray(calificacionPayload?.calificacion?.respuestasDetectadas)
        ? calificacionPayload.calificacion!.respuestasDetectadas!
            .map((item) => ({
              numeroPregunta: Number(item?.numeroPregunta),
              opcion: String(item?.opcion ?? '').trim().toUpperCase() || null,
              confianza: Number.isFinite(Number(item?.confianza)) ? Number(item?.confianza) : 0
            }))
            .filter((item) => Number.isFinite(item.numeroPregunta) && item.numeroPregunta > 0)
        : [];
      const respuestasPorNumero = new Map(respuestasDetectadas.map((item) => [item.numeroPregunta, item]));
      const imagenesPorPagina = new Map<number, string>();
      const paginasOmr = Array.isArray(calificacionPayload?.calificacion?.paginasOmr)
        ? calificacionPayload.calificacion!.paginasOmr!
        : [];
      for (const pagina of paginasOmr) {
        const numeroPagina = Number(pagina?.numeroPagina ?? 0);
        const imagen = String(pagina?.imagenBase64 ?? '').trim();
        if (!Number.isFinite(numeroPagina) || numeroPagina <= 0 || !imagen) continue;
        imagenesPorPagina.set(numeroPagina, imagen);
      }
      const respuestasCompletas = clave.ordenPreguntas.map((numeroPregunta) => {
        const detectada = respuestasPorNumero.get(Number(numeroPregunta));
        return {
          numeroPregunta: Number(numeroPregunta),
          opcion: detectada?.opcion ?? null,
          confianza: Number.isFinite(Number(detectada?.confianza)) ? Number(detectada?.confianza) : 0
        };
      });
      const paginasExamen = Array.isArray((examenDetalle as { paginas?: unknown }).paginas)
        ? ((examenDetalle as {
            paginas?: Array<{ numero?: unknown; preguntasDel?: unknown; preguntasAl?: unknown }>;
          }).paginas ?? [])
            .map((pagina) => ({
              numeroPagina: Number(pagina?.numero),
              preguntasDel: Number(pagina?.preguntasDel),
              preguntasAl: Number(pagina?.preguntasAl)
            }))
            .filter((pagina) => Number.isFinite(pagina.numeroPagina) && pagina.numeroPagina > 0)
            .sort((a, b) => a.numeroPagina - b.numeroPagina)
        : [];
      const paginasReconstruidas = paginasExamen.length
        ? paginasExamen.map((pagina) => {
            const templateVersionDetectada = normalizarTemplateVersionOmrDetectada(
              (examenDetalle as { mapaOmr?: { templateVersion?: unknown } }).mapaOmr?.templateVersion
            );
            const rangoValido =
              Number.isFinite(pagina.preguntasDel) &&
              Number.isFinite(pagina.preguntasAl) &&
              pagina.preguntasDel > 0 &&
              pagina.preguntasAl >= pagina.preguntasDel;
            const respuestasPagina = rangoValido
              ? respuestasCompletas.filter((item) => {
                  const numero = Number(item.numeroPregunta);
                  return numero >= pagina.preguntasDel && numero <= pagina.preguntasAl;
                })
              : [];
            const confianzaPagina =
              respuestasPagina.length > 0
                ? respuestasPagina.reduce((acc, item) => acc + Number(item.confianza || 0), 0) / respuestasPagina.length
                : 0;
            return {
              numeroPagina: pagina.numeroPagina,
              respuestas: respuestasPagina,
              resultado: {
                respuestasDetectadas: respuestasPagina,
                advertencias: [],
                qrTexto: String(examenDetalle.folio ?? examenPersistido.folio),
                calidadPagina: 1,
                estadoAnalisis: 'ok' as const,
                motivosRevision: [],
                templateVersionDetectada,
                confianzaPromedioPagina: confianzaPagina,
                ratioAmbiguas: 0
              },
              imagenBase64: imagenesPorPagina.get(pagina.numeroPagina)
            };
          })
        : [];

      const aciertosPersistidos = Number(calificacionPayload?.calificacion?.aciertos ?? 0);
      const totalReactivosPersistidos = Number(calificacionPayload?.calificacion?.totalReactivos ?? 0);
      const calificacionFinalPersistida = Number(calificacionPayload?.calificacion?.calificacionExamenFinalTexto ?? 0);
      setManualContexto({
        examenId: String(examenDetalle._id ?? id),
        alumnoId: String(examenDetalle.alumnoId ?? examenPersistido.alumnoId ?? ''),
        folio: String(examenDetalle.folio ?? examenPersistido.folio),
        tipoExamenEtiqueta:
          etiquetarTipoExamen(String(examenPersistido.tipoExamen ?? '').trim()) ||
          etiquetarTipoExamen(String(plantillasPorId.get(String(examenPersistido.plantillaId ?? '').trim())?.tipo ?? '').trim()) ||
          undefined,
        plantillaTitulo:
          String(examenPersistido.plantillaTitulo ?? '').trim() ||
          String(plantillasPorId.get(String(examenPersistido.plantillaId ?? '').trim())?.titulo ?? '').trim() ||
          undefined,
        soloLectura: true,
        resumenPersistido: {
          aciertos: Number.isFinite(aciertosPersistidos) ? aciertosPersistidos : 0,
          totalReactivos: Number.isFinite(totalReactivosPersistidos) ? totalReactivosPersistidos : 0,
          calificacionFinalSobre5: Number.isFinite(calificacionFinalPersistida) ? calificacionFinalPersistida : 0
        },
        claveCorrectaPorNumero: clave.claveCorrectaPorNumero,
        ordenPreguntas: clave.ordenPreguntas,
        respuestasDetectadas: respuestasCompletas
      });
      const promedioConfianza =
        respuestasCompletas.length > 0
          ? respuestasCompletas.reduce((acc, item) => acc + Number(item.confianza || 0), 0) / respuestasCompletas.length
          : 0;
      const paginaInicial = paginasReconstruidas[0]?.numeroPagina ?? 1;
      const respuestasPaginaInicial =
        paginasReconstruidas.find((pagina) => pagina.numeroPagina === paginaInicial)?.respuestas ?? respuestasCompletas;
      const resultadoPaginaInicial =
        paginasReconstruidas.find((pagina) => pagina.numeroPagina === paginaInicial)?.resultado ?? {
          templateVersionDetectada: normalizarTemplateVersionOmrDetectada(
            (examenDetalle as { mapaOmr?: { templateVersion?: unknown } }).mapaOmr?.templateVersion
          ),
          respuestasDetectadas: respuestasCompletas,
          advertencias: [],
          qrTexto: String(examenDetalle.folio ?? examenPersistido.folio),
          calidadPagina: 1,
          estadoAnalisis: 'ok' as const,
          motivosRevision: [],
          confianzaPromedioPagina: promedioConfianza,
          ratioAmbiguas: 0
        };
      onCargarRevisionHistoricaCalificada?.({
        examenId: String(examenDetalle._id ?? id),
        folio: String(examenDetalle.folio ?? examenPersistido.folio),
        alumnoId: String(examenDetalle.alumnoId ?? examenPersistido.alumnoId ?? '').trim() || null,
        numeroPagina: paginaInicial,
        respuestas: respuestasPaginaInicial,
        paginas: paginasReconstruidas,
        claveCorrectaPorNumero: clave.claveCorrectaPorNumero,
        ordenPreguntas: clave.ordenPreguntas,
        resultado: resultadoPaginaInicial
      });
      setManualMensaje('Examen calificado cargado en modo solo lectura.');
    } catch (error) {
      const status = Number((error as { detalle?: { status?: unknown } } | null | undefined)?.detalle?.status ?? NaN);
      if (status === 404) {
        examenesSinCalificacionRef.current.add(id);
        setManualMensaje('Aún no hay calificación guardada para el examen seleccionado.');
        return;
      }
      setManualMensaje(mensajeDeError(error, 'No se pudo cargar el examen calificado'));
    } finally {
      cargasCalificacionEnCursoRef.current.delete(id);
      setActivandoManual(false);
    }
  }, [examenesCalificadosPersistidos, obtenerBancoPreguntas, onCargarRevisionHistoricaCalificada, plantillasPorId]);

  useEffect(() => {
    const id = String(examenRevisadoSeleccionadoId ?? '').trim();
    if (!id) return;
    const opcion = opcionesExamenesRevisados.find((item) => item.id === id);
    if (!opcion || opcion.fuente !== 'calificado') return;
    if (manualContexto && manualContexto.soloLectura && String(manualContexto.examenId ?? '').trim() === id) return;
    void cargarExamenCalificadoPersistido(id);
  }, [cargarExamenCalificadoPersistido, examenRevisadoSeleccionadoId, manualContexto, opcionesExamenesRevisados]);

  async function sincronizarSolicitudesRevision() {
    if (cargandoSolicitudes) return;
    try {
      setCargandoSolicitudes(true);
      setMensajeRevision('');
      await onSincronizarSolicitudesRevision();
      setMensajeRevision('Solicitudes sincronizadas correctamente.');
    } catch (error) {
      setMensajeRevision(mensajeDeError(error, 'No se pudieron sincronizar las solicitudes'));
    } finally {
      setCargandoSolicitudes(false);
    }
  }

  async function resolverSolicitud(solicitud: SolicitudRevisionAlumno, estado: 'atendida' | 'rechazada') {
    if (!solicitud._id || resolviendoSolicitudId) return;
    const respuesta = String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim();
    if (respuesta.length < 8) return;
    try {
      setResolviendoSolicitudId(solicitud._id);
      setMensajeRevision('');
      await onResolverSolicitudRevision(solicitud._id, estado, respuesta);
      setRespuestaPorSolicitudId((prev) => ({ ...prev, [solicitud.externoId]: '' }));
      setMensajeRevision(`Solicitud ${estado === 'atendida' ? 'atendida' : 'rechazada'} correctamente.`);
      await onSincronizarSolicitudesRevision();
    } catch (error) {
      setMensajeRevision(mensajeDeError(error, 'No se pudo resolver la solicitud'));
    } finally {
      setResolviendoSolicitudId('');
    }
  }

  return (
    <>
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head calif-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb calif-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <Icono nombre="calificar" />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill calif-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Mesa de Calificación y Escrutinio OMR</span>
              </span>
              <span className="banco-counter-tag">{revisionesSeguras.length} exámenes</span>
            </div>
            <h2 className="banco-panel__title eyebrow"><Icono nombre="calificar" /> Calificaciones</h2>
            <p className="nota">Escanea por página, revisa por examen y guarda solo cuando la revisión esté confirmada.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Exámenes en flujo de escaneo">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="pdf" /></span>
            <span className="banco-mini-kpi__num">{revisionesSeguras.length}</span>
            <span className="banco-mini-kpi__lbl">En flujo</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Páginas totales analizadas">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="escaneo" /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{totalPaginas}</span>
            <span className="banco-mini-kpi__lbl">Procesadas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip="Páginas con revisión pendiente">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="alerta" /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--amber">{paginasPendientes}</span>
            <span className="banco-mini-kpi__lbl">Pendientes</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Exámenes con calificación confirmada">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="ok" /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{examenesListos}</span>
            <span className="banco-mini-kpi__lbl">Calificados</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--reactivos anim-kpi-hover" data-tooltip="Solicitudes de revisión enviadas por alumnos">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="info" /></span>
            <span className="banco-mini-kpi__num">{resumenSolicitudes.total}</span>
            <span className="banco-mini-kpi__lbl">Solicitudes</span>
          </div>
        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaCalificacionesVisual />

      {/* Bento Action Deck: Exportación & Escrutinio */}
      <div className="calif-action-deck anim-fade-in">
        <div className="calif-deck-card calif-deck-card--reports">
          <div className="calif-deck-card__header">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Actas & Exportación</span>
            </span>
            <span className="banco-counter-tag">Formatos: CSV · XLSX</span>
          </div>
          <div className="calif-deck-card__body">
            <label className="campo calif-deck-card__field">
              <span>Materia del reporte</span>
              <select value={periodoReporteId} onChange={(event) => setPeriodoReporteId(event.target.value)}>
                <option value="">Selecciona materia...</option>
                {periodos.map((periodo) => (
                  <option key={periodo._id} value={periodo._id}>
                    {etiquetaMateria(periodo)}
                  </option>
                ))}
              </select>
            </label>
            <div className="calif-deck-card__btn-group">
              <Boton
                type="button"
                variante="secundario"
                icono={<Icono nombre="descargar" />}
                cargando={reporteDescargando === 'csv'}
                disabled={!periodoReporteId || reporteDescargando !== null || !puedeCalificar}
                onClick={() => void descargarReporteCalificaciones('csv')}
              >
                Descargar CSV
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                icono={<Icono nombre="descargar" />}
                cargando={reporteDescargando === 'xlsx'}
                disabled={!periodoReporteId || reporteDescargando !== null || !puedeCalificar}
                onClick={() => void descargarReporteCalificaciones('xlsx')}
              >
                Descargar XLSX
              </Boton>
            </div>
          </div>
          {mensajeReporte && <InlineMensaje tipo={esMensajeError(mensajeReporte) ? 'error' : 'info'}>{mensajeReporte}</InlineMensaje>}
        </div>

        <div className="calif-deck-card calif-deck-card--history">
          <div className="calif-deck-card__header">
            <span className="banco-section-pill banco-section-pill--amber">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Escrutinio & Custodia</span>
            </span>
            <span className="banco-counter-tag">
              {examenIdActivo ? (hayCambiosPendientesOmrActiva ? '⚠️ Cambios pendientes' : '✓ Examen activo') : 'Sin examen activo'}
            </span>
          </div>
          <div className="calif-deck-card__body">
            <label className="campo calif-deck-card__field">
              <span>Exámenes revisados/calificados</span>
              <select
                value={examenRevisadoSeleccionadoId}
                onChange={(event) => {
                  const examenIdDestino = String(event.target.value ?? '').trim();
                  setExamenRevisadoSeleccionadoId(examenIdDestino);
                  if (!examenIdDestino) return;
                  const examen = examenesRevisados.find((item) => item.examenId === examenIdDestino);
                  if (!examen || !Array.isArray(examen.paginas) || examen.paginas.length === 0) {
                    void cargarExamenCalificadoPersistido(examenIdDestino);
                    return;
                  }
                  const paginaInicio =
                    [...examen.paginas]
                      .filter((pagina) => Number.isFinite(Number(pagina.numeroPagina)))
                      .sort((a, b) => {
                        const actualizadoA = Number((a as { actualizadoEn?: unknown }).actualizadoEn ?? 0);
                        const actualizadoB = Number((b as { actualizadoEn?: unknown }).actualizadoEn ?? 0);
                        if (actualizadoB !== actualizadoA) return actualizadoB - actualizadoA;
                        return Number(b.numeroPagina) - Number(a.numeroPagina);
                      })
                      .map((pagina) => Number(pagina.numeroPagina))[0] ?? null;
                  if (!Number.isFinite(Number(paginaInicio))) return;
                  onSeleccionarRevision(examen.examenId, Number(paginaInicio));
                }}
                disabled={opcionesExamenesRevisados.length === 0}
              >
                <option value="">
                  {opcionesExamenesRevisados.length === 0 ? 'Sin exámenes revisados/calificados' : 'Selecciona examen revisado/calificado...'}
                </option>
                {opcionesExamenesRevisados.map((examen) => (
                  <option key={examen.id} value={examen.id}>
                    {`Folio ${examen.folio} · ${examen.fuente === 'cola' ? `${examen.paginas} página(s)` : 'calificado'}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="calif-deck-card__btn-group">
              <Boton
                type="button"
                variante="secundario"
                icono={<Icono nombre="recargar" />}
                disabled={revisionesSeguras.length === 0 && !resultado}
                onClick={onLimpiarColaEscaneos}
              >
                Limpiar cola
              </Boton>
            </div>
          </div>
        </div>
      </div>
      <div className="calificaciones-layout" data-calificaciones-layout="true">
        <div className="calificaciones-layout__main">
          <SeccionEscaneo
            alumnos={alumnos}
            onAnalizar={onAnalizar}
            onPrevisualizar={onPrevisualizar}
            resultado={resultado}
            onActualizar={onActualizar}
            onActualizarPregunta={onActualizarPregunta}
            respuestasPaginaEditable={respuestasPaginaEditable}
            respuestasCombinadas={respuestasCombinadasRevision}
            claveCorrectaPorNumero={claveCorrectaPorNumero}
            ordenPreguntasClave={ordenPreguntasClave}
            revisionOmrConfirmada={revisionOmrConfirmada}
            hayCambiosPendientesOmrActiva={hayCambiosPendientesOmrActiva}
            onConfirmarRevisionOmr={onConfirmarRevisionOmr}
            revisionesOmr={revisionesOmr}
            examenIdActivo={examenIdActivo}
            paginaActiva={paginaActiva}
            onSeleccionarRevision={onSeleccionarRevision}
            puedeAnalizar={puedeAnalizar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
        </div>
        <aside className="calificaciones-layout__aside" aria-label="Panel de calificación">
          <section className="panel calificaciones-encuadre-panel anim-fade-in">
            <div className="banco-section-title">
              <div className="banco-section-title__wrap">
                <span className="banco-section-pill">
                  <span className="banco-section-pill__dot" aria-hidden="true" />
                  <span>Instrumentación Académica</span>
                </span>
                <h3 className="entregas-title-heading">
                  <Icono nombre="pdf" /> Encuadre Académico y Firmas
                </h3>
                <p className="nota">Configura el formato de encuadre digital y notifica a los alumnos para su firma desde su correo institucional.</p>
              </div>
            </div>
            
            <label className="campo">
              Materia / Periodo
              <select value={selectedPeriodoId} onChange={(e) => setSelectedPeriodoId(e.target.value)}>
                <option value="">Selecciona materia</option>
                {periodos.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>

            {loadingEncuadre && <p className="nota">Cargando estado del encuadre...</p>}
            {errorEncuadre && <div className="alert alert--danger">{errorEncuadre}</div>}

            {encuadreEstado ? (
              <div className="encuadre-status-box">
                <div className="status-header">
                  <span className="badge ok">Encuadre Inicializado</span>
                  <span className="font-uppercase">Estado: {encuadreEstado.estado}</span>
                </div>
                
                <div className="firmas-list encuadre-firmas-list-container">
                  <strong>Estado de Firmas:</strong>
                  {Array.isArray(encuadreEstado.firmas) && encuadreEstado.firmas.map((f: any) => (
                    <div key={f.id} className="firma-row encuadre-firma-row-item">
                      <div>
                        <span className="encuadre-firma-rol-label">{f.rol}</span>
                        <span>{f.nombreFirmante}</span>
                      </div>
                      <span className={`badge ${f.firmado ? 'ok' : 'warning'} encuadre-firma-badge-status`}>
                        {f.firmado ? '✓ Firmado' : '⌛ Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="encuadre-actions-container">
                  <a href={`/api/evaluaciones-publicas/encuadre/pdf/${encuadreEstado.firmas?.[0]?.tokenFirma}`} target="_blank" rel="noreferrer" className="btn btn--secondary btn-sm encuadre-btn-sm">
                    Ver PDF Oficial ↗
                  </a>
                  <button type="button" className="btn btn--primary btn-sm encuadre-btn-sm" onClick={() => setMostrarFormulario(true)}>
                    Reconfigurar Encuadre
                  </button>
                </div>
              </div>
            ) : (
              selectedPeriodoId && !loadingEncuadre && (
                <div className="encuadre-margin-top-1rem">
                  <InlineMensaje tipo="info">No se ha generado el encuadre para esta asignatura.</InlineMensaje>
                  <button type="button" className="btn btn--primary w-full encuadre-margin-top-point75rem" onClick={() => setMostrarFormulario(true)}>
                    Configurar y Generar Encuadre
                  </button>
                </div>
              )
            )}

            {mostrarFormulario && (
              <div className="encuadre-form-overlay encuadre-form-overlay-box">
                <h4 className="encuadre-form-title-h4">Configuración de Formato y Ponderaciones</h4>
                
                <label className="campo">
                  Nombre Institución
                  <input value={instNombre} onChange={(e) => setInstNombre(e.target.value)} />
                </label>
                <label className="campo">
                  Lema Institucional
                  <input value={instLema} onChange={(e) => setInstLema(e.target.value)} />
                </label>
                
                <div className="encuadre-grid-2col-layout">
                  <label className="campo">
                    Logo Principal (Izquierdo)
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleLogoChange(e, setLogoBase64)} className="encuadre-file-input-field" />
                  </label>
                  <label className="campo">
                    Logo Carrera (Derecho)
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleLogoChange(e, setLogoCarreraBase64)} className="encuadre-file-input-field" />
                  </label>
                </div>

                <label className="campo">
                  Carrera / Licenciatura
                  <input value={carrera} onChange={(e) => setCarrera(e.target.value)} />
                </label>

                <div className="encuadre-grid-2col-layout">
                  <label className="campo">
                    Clave Asignatura
                    <input value={clave} onChange={(e) => setClave(e.target.value)} />
                  </label>
                  <label className="campo">
                    Área
                    <input value={area} onChange={(e) => setArea(e.target.value)} />
                  </label>
                </div>

                <div className="encuadre-grid-3col-layout">
                  <label className="campo">
                    Hrs Docente
                    <input type="number" value={horasDocente} onChange={(e) => setHorasDocente(Number(e.target.value))} />
                  </label>
                  <label className="campo">
                    Hrs Indep.
                    <input type="number" value={horasIndependientes} onChange={(e) => setHorasIndependientes(Number(e.target.value))} />
                  </label>
                  <label className="campo">
                    Créditos
                    <input type="number" step="0.01" value={creditos} onChange={(e) => setCreditos(Number(e.target.value))} />
                  </label>
                </div>

                <label className="campo">
                  Eje Formación
                  <input value={ejeFormacion} onChange={(e) => setEjeFormacion(e.target.value)} />
                </label>

                <label className="campo">
                  Objetivo General Asignatura
                  <textarea value={objetivoGeneral} onChange={(e) => setObjetivoGeneral(e.target.value)} rows={3} placeholder="Describe el objetivo académico principal..." />
                </label>

                <label className="campo">
                  Ciclo Lectivo / Horario
                  <input value={cicloLectivo} onChange={(e) => setCicloLectivo(e.target.value)} />
                </label>

                <div className="encuadre-divider-dashed-line">
                  <h5 className="encuadre-form-subtitle-h5">Ponderaciones del Periodo (%)</h5>
                  <div className="encuadre-grid-2col-layout">
                    <label className="campo">
                      Exámenes Bloque (%)
                      <input type="number" value={pctExamenes} onChange={(e) => setPctExamenes(Number(e.target.value))} />
                    </label>
                    <label className="campo">
                      Eval. Continua (%)
                      <input type="number" value={pctEvalContinua} onChange={(e) => setPctEvalContinua(Number(e.target.value))} />
                    </label>
                  </div>
                  <div className="encuadre-grid-3col-layout">
                    <label className="campo">
                      1er Parcial
                      <input type="number" value={pond1er} onChange={(e) => setPond1er(Number(e.target.value))} />
                    </label>
                    <label className="campo">
                      2do Parcial
                      <input type="number" value={pond2do} onChange={(e) => setPond2do(Number(e.target.value))} />
                    </label>
                    <label className="campo">
                      Global Final
                      <input type="number" value={pondGlobal} onChange={(e) => setPondGlobal(Number(e.target.value))} />
                    </label>
                  </div>
                  <div className="encuadre-grid-2col-layout">
                    <label className="campo">
                      Examen Escrito (%)
                      <input type="number" value={pondEscrito} onChange={(e) => setPondEscrito(Number(e.target.value))} />
                    </label>
                    <label className="campo">
                      Prácticas/Proyecto (%)
                      <input type="number" value={pondPractica} onChange={(e) => setPondPractica(Number(e.target.value))} />
                    </label>
                  </div>
                </div>

                <div className="encuadre-flex-gap-1rem">
                  <button type="button" className="btn btn--primary w-full" disabled={guardandoEncuadre} onClick={handleInicializarEncuadre}>
                    {guardandoEncuadre ? 'Generando PDF y Notificando...' : 'Generar y Enviar a Firmar'}
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={() => setMostrarFormulario(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="panel calificaciones-manual-panel anim-fade-in">
            <div className="banco-section-title">
              <div className="banco-section-title__wrap">
                <span className="banco-section-pill">
                  <span className="banco-section-pill__dot" aria-hidden="true" />
                  <span>Calificación Directa</span>
                </span>
                <h3 className="entregas-title-heading">
                  <Icono nombre="alumno" /> Selección manual por entregado
                </h3>
                <p className="nota">Selecciona alumno y examen entregado para calificar manualmente cada pregunta.</p>
              </div>
              <div className="banco-section-side-meta">
                <span className="banco-counter-tag">Entregados: {examenesManual.length}</span>
                <span className="banco-counter-tag banco-counter-tag--cyan">Filtrados: {examenesManualFiltrados.length}</span>
              </div>
            </div>
            <div className="item-meta">
              <span>Exámenes entregados del alumno: {examenesManual.length}</span>
              <span>Filtrados: {examenesManualFiltrados.length}</span>
            </div>
            <label className="campo">
              Alumno
              <select value={alumnoManualId} onChange={(event) => seleccionarAlumnoManual(event.target.value)}>
                <option value="">Selecciona</option>
                {(Array.isArray(alumnos) ? alumnos : []).map((alumno) => (
                  <option key={alumno._id} value={alumno._id}>
                    {alumno.matricula} - {alumno.nombreCompleto}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Buscar folio
              <input
                value={filtroFolioManual}
                onChange={(event) => setFiltroFolioManual(event.target.value)}
                placeholder="Ej. FOLIO-000123"
                disabled={!alumnoManualId || cargandoExamenesManual || examenesManual.length === 0}
              />
            </label>
            <label className="campo">
              Examen entregado
              <select
                value={examenManualId}
                onChange={(event) => setExamenManualId(event.target.value)}
                disabled={!alumnoManualId || cargandoExamenesManual}
              >
                <option value="">Selecciona</option>
                {examenesManualFiltrados.map((examen) => (
                  <option key={examen._id} value={examen._id}>
                    {[
                      examen.folio,
                      etiquetarTipoExamen(examen.tipoExamen) || etiquetarTipoExamen(plantillasPorId.get(String(examen.plantillaId ?? '').trim())?.tipo),
                      String(examen.plantillaTitulo ?? '').trim() || String(plantillasPorId.get(String(examen.plantillaId ?? '').trim())?.titulo ?? '').trim(),
                      String(examen.estado ?? 'entregado')
                    ]
                      .filter((valor) => String(valor ?? '').trim().length > 0)
                      .join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            {examenManualSeleccionado && (
              <div className="item-meta">
                <span>Tipo: {resumenExamenManual.tipo}</span>
                <span>Plantilla: {resumenExamenManual.plantilla}</span>
                <span>Estado: {resumenExamenManual.estado}</span>
              </div>
            )}
            {filtroFolioManual && examenesManualFiltrados.length === 0 && (
              <InlineMensaje tipo="info">No hay exámenes que coincidan con el folio buscado.</InlineMensaje>
            )}
            <div className="item-actions calificaciones-manual-panel__actions">
              <Boton
                type="button"
                variante="secundario"
                disabled={!alumnoManualId || !examenManualId || cargandoExamenesManual || activandoManual || !puedeCalificar}
                onClick={() => {
                  if (!puedeCalificar) {
                    avisarSinPermiso('No tienes permiso para calificar manualmente.');
                    return;
                  }
                  void activarManualDesdeEntregado();
                }}
              >
                {activandoManual ? 'Activando modo manual...' : cargandoExamenesManual ? 'Cargando...' : 'Usar examen para calificación manual'}
              </Boton>
              {manualContexto && (
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() => {
                    setManualContexto(null);
                    setManualMensaje('Modo manual desactivado.');
                  }}
                >
                  Limpiar selección manual
                </Boton>
              )}
            </div>
            {manualMensaje && (
              <InlineMensaje tipo={esMensajeError(manualMensaje) ? 'error' : 'info'}>{manualMensaje}</InlineMensaje>
            )}
          </section>
          {mostrarSeccionCalificar ? (
            <SeccionCalificar
              examenId={manualContexto?.examenId ?? examenId}
              alumnoId={manualContexto?.alumnoId ?? alumnoId}
              examenEtiqueta={manualContexto ? `Folio ${manualContexto.folio}${manualContexto.plantillaTitulo ? ` · ${manualContexto.plantillaTitulo}` : ''}` : examenActivoEtiqueta}
              alumnoNombre={manualContexto ? (mapaAlumnos.get(String(manualContexto.alumnoId ?? '').trim()) ?? null) : alumnoActivoNombre}
              resultadoOmr={manualContexto ? null : resultadoParaCalificar}
              revisionOmrConfirmada={manualContexto ? true : revisionOmrConfirmada}
              respuestasDetectadas={manualContexto?.respuestasDetectadas ?? respuestasParaCalificar}
              claveCorrectaPorNumero={manualContexto?.claveCorrectaPorNumero ?? claveCorrectaParaCalificar ?? claveCorrectaPorNumero}
              ordenPreguntasClave={manualContexto?.ordenPreguntas ?? ordenPreguntasParaCalificar ?? ordenPreguntasClave}
              etiquetaTipoExamen={manualContexto?.tipoExamenEtiqueta ?? tipoExamenActivoEtiqueta}
              contextoManual={manualContexto
                ? [
                    manualContexto.soloLectura ? 'Modo solo lectura (calificado)' : 'Modo manual activo',
                    `Folio ${manualContexto.folio}`,
                    manualContexto.tipoExamenEtiqueta ? `Tipo ${manualContexto.tipoExamenEtiqueta}` : '',
                    manualContexto.plantillaTitulo ? `Plantilla ${manualContexto.plantillaTitulo}` : ''
                  ]
                    .filter((parte) => String(parte ?? '').trim().length > 0)
                    .join(' · ')
                : null}
              soloLectura={Boolean(manualContexto?.soloLectura)}
              resumenPersistido={manualContexto?.resumenPersistido}
              onCalificar={onCalificar}
              puedeCalificar={puedeCalificar}
              avisarSinPermiso={avisarSinPermiso}
            />
          ) : null}
          {!mostrarSeccionCalificar ? (
            <InlineMensaje tipo="info">Confirma la revisión OMR en la mesa superior para habilitar la calificación.</InlineMensaje>
          ) : null}
          <section className="panel calificaciones-revision-panel anim-fade-in">
            <div className="banco-section-title">
              <div className="banco-section-title__wrap">
                <span className="banco-section-pill banco-section-pill--amber">
                  <span className="banco-section-pill__dot" aria-hidden="true" />
                  <span>Buzón de Aclaraciones</span>
                </span>
                <h3 className="entregas-title-heading">
                  <Icono nombre="info" /> Solicitudes de revisión del alumno
                </h3>
                <p className="nota">Atiende solicitudes de aclaración enviadas por los alumnos desde su portal.</p>
              </div>
              <div className="banco-section-side-meta">
                <span className="banco-counter-tag banco-counter-tag--amber">Pendientes: {resumenSolicitudes.pendientes}</span>
                <span className="banco-counter-tag banco-counter-tag--emerald">Atendidas: {resumenSolicitudes.atendidas}</span>
                <span className="banco-counter-tag">Rechazadas: {resumenSolicitudes.rechazadas}</span>
              </div>
            </div>
            <div className="item-actions calificaciones-revision-panel__toolbar">
              <button
                type="button"
                className="boton secundario"
                disabled={cargandoSolicitudes || resolviendoSolicitudId.length > 0}
                onClick={() => {
                  if (!puedeCalificar) {
                    avisarSinPermiso('No tienes permiso para revisar solicitudes.');
                    return;
                  }
                  void sincronizarSolicitudesRevision();
                }}
              >
                <Icono nombre="recargar" /> {cargandoSolicitudes ? 'Sincronizando...' : 'Sincronizar solicitudes'}
              </button>
            </div>
            <label className="campo">
              Buscar solicitud
              <input
                value={filtroSolicitudes}
                onChange={(event) => setFiltroSolicitudes(event.target.value)}
                placeholder="Folio, estado, pregunta o comentario"
                disabled={solicitudesSeguras.length === 0}
              />
            </label>
            {mensajeRevision && (
              <InlineMensaje tipo={esMensajeError(mensajeRevision) ? 'error' : 'info'}>{mensajeRevision}</InlineMensaje>
            )}
            {solicitudesSeguras.length === 0 && <InlineMensaje tipo="info">Sin solicitudes pendientes de revisión.</InlineMensaje>}
            {solicitudesSeguras.length > 0 && solicitudesFiltradas.length === 0 && (
              <InlineMensaje tipo="info">No hay solicitudes que coincidan con el filtro.</InlineMensaje>
            )}
            <ul className="lista lista-items">
              {solicitudesFiltradas.map((solicitud) => (
                <li key={solicitud._id ?? solicitud.externoId}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">
                          Folio {solicitud.folio} · Pregunta {solicitud.numeroPregunta}
                        </div>
                        <div className="item-meta">
                          <span className={`badge ${solicitud.estado === 'pendiente' ? 'warning' : solicitud.estado === 'atendida' ? 'ok' : 'error'}`}>
                            {solicitud.estado}
                          </span>
                          {solicitud.comentario && <span>Comentario: {solicitud.comentario}</span>}
                          {solicitud.conformidadAlumno && <span>Alumno en conformidad</span>}
                          {solicitud.firmaDocente && <span>Firma: {solicitud.firmaDocente}</span>}
                        </div>
                      </div>
                    </div>
                    <textarea
                      className="calificaciones-revision-panel__respuesta"
                      rows={2}
                      placeholder="Respuesta obligatoria para el alumno (mínimo 8 caracteres)"
                      value={respuestaPorSolicitudId[solicitud.externoId] ?? ''}
                      onChange={(event) =>
                        setRespuestaPorSolicitudId((prev) => ({ ...prev, [solicitud.externoId]: event.target.value }))
                      }
                    />
                    <div className="item-actions calificaciones-revision-panel__actions">
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={
                          !solicitud._id ||
                          String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim().length < 8 ||
                          resolviendoSolicitudId.length > 0
                        }
                        onClick={() => {
                          void resolverSolicitud(solicitud, 'atendida');
                        }}
                      >
                        <Icono nombre="ok" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando...' : 'Marcar atendida'}
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={
                          !solicitud._id ||
                          String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim().length < 8 ||
                          resolviendoSolicitudId.length > 0
                        }
                        onClick={() => {
                          void resolverSolicitud(solicitud, 'rechazada');
                        }}
                      >
                        <Icono nombre="salir" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando...' : 'Rechazar'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}


