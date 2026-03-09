/**
 * SeccionCalificaciones
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { SeccionCalificar } from './SeccionCalificar';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr,
  SolicitudRevisionAlumno
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  normalizarTemplateVersionOmrDetectada,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from './utilidades';


export function SeccionCalificaciones({
  alumnos,
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
  const mapaAlumnos = useMemo(() => new Map(alumnos.map((item) => [String(item._id), String(item.nombreCompleto ?? '').trim()])), [alumnos]);
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
    return partes.length > 0 ? partes.join(' Â· ') : null;
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
        setManualMensaje(entregados.length === 0 ? 'No hay exÃ¡menes entregados para el alumno seleccionado.' : '');
      })
      .catch((error) => {
        if (cancelado) return;
        setExamenesManual([]);
        setExamenManualId('');
        setManualMensaje(mensajeDeError(error, 'No se pudo cargar la lista de exÃ¡menes entregados'));
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
      setManualMensaje('No se encontrÃ³ el examen seleccionado.');
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
        setManualMensaje('No se pudo construir la clave del examen para calificaciÃ³n manual.');
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
      setManualMensaje(mensajeDeError(error, 'No se pudo activar la calificaciÃ³n manual'));
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
      setManualMensaje('AÃºn no hay calificaciÃ³n guardada para el examen seleccionado.');
      return;
    }
    if (cargasCalificacionEnCursoRef.current.has(id)) return;
    const examenPersistido = examenesCalificadosPersistidos.find((item) => String(item._id ?? '').trim() === id);
    if (!examenPersistido) {
      emitToast({ level: 'warn', title: 'Examen', message: 'No se encontrÃ³ el examen calificado seleccionado.', durationMs: 3200 });
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
        setManualMensaje('AÃºn no hay calificaciÃ³n guardada para el examen seleccionado.');
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
      <div className="panel calificaciones-hero">
        <div className="calificaciones-hero__head">
          <h2>
            <Icono nombre="calificar" /> Calificaciones
          </h2>
          <p className="nota">
            Escanea por pÃ¡gina, revisa por examen y guarda solo cuando la revisiÃ³n estÃ© confirmada.
          </p>
        </div>
        <div className="calificaciones-kpi" aria-live="polite">
          <div className="calificaciones-kpi__item"><span>ExÃ¡menes en flujo</span><b>{revisionesSeguras.length}</b></div>
          <div className="calificaciones-kpi__item"><span>PÃ¡ginas procesadas</span><b>{totalPaginas}</b></div>
          <div className="calificaciones-kpi__item"><span>PÃ¡ginas pendientes</span><b>{paginasPendientes}</b></div>
          <div className="calificaciones-kpi__item"><span>Revisados/Calificados</span><b>{examenesListos}</b></div>
          <div className="calificaciones-kpi__item"><span>Solicitudes revisiÃ³n</span><b>{resumenSolicitudes.total}</b></div>
        </div>
        <div className="item-meta calificaciones-hero__meta">
          {examenIdActivo ? (
            <span className={`badge ${hayCambiosPendientesOmrActiva ? 'warning' : 'ok'}`}>
              {hayCambiosPendientesOmrActiva ? 'Examen activo con cambios pendientes' : 'Examen activo sin cambios pendientes'}
            </span>
          ) : <span className="badge">Sin examen activo</span>}
        </div>
        <div className="item-actions calificaciones-hero__actions">
          <label className="campo calificaciones-revisados-select">
            ExÃ¡menes revisados/calificados
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
                {opcionesExamenesRevisados.length === 0 ? 'Sin exÃ¡menes revisados/calificados' : 'Selecciona examen revisado/calificado'}
              </option>
              {opcionesExamenesRevisados.map((examen) => (
                <option key={examen.id} value={examen.id}>
                  {`Folio ${examen.folio} Â· ${examen.fuente === 'cola' ? `${examen.paginas} pÃ¡gina(s)` : 'calificado'}`}
                </option>
              ))}
            </select>
          </label>
          <Boton
            type="button"
            variante="secundario"
            disabled={revisionesSeguras.length === 0 && !resultado}
            onClick={onLimpiarColaEscaneos}
          >
            <Icono nombre="recargar" /> Limpiar cola de escaneos
          </Boton>
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
        <aside className="calificaciones-layout__aside" aria-label="Panel de calificaciÃ³n">
          <section className="panel calificaciones-manual-panel">
            <h3>
              <Icono nombre="alumno" /> SelecciÃ³n manual por entregado
            </h3>
            <p className="nota">Selecciona alumno y examen entregado para calificar manualmente cada pregunta.</p>
            <div className="item-meta">
              <span>ExÃ¡menes entregados del alumno: {examenesManual.length}</span>
              <span>Filtrados: {examenesManualFiltrados.length}</span>
            </div>
            <label className="campo">
              Alumno
              <select value={alumnoManualId} onChange={(event) => seleccionarAlumnoManual(event.target.value)}>
                <option value="">Selecciona</option>
                {alumnos.map((alumno) => (
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
                      .join(' Â· ')}
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
              <InlineMensaje tipo="info">No hay exÃ¡menes que coincidan con el folio buscado.</InlineMensaje>
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
                {activandoManual ? 'Activando modo manualâ€¦' : cargandoExamenesManual ? 'Cargandoâ€¦' : 'Usar examen para calificaciÃ³n manual'}
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
                  Limpiar selecciÃ³n manual
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
              examenEtiqueta={manualContexto ? `Folio ${manualContexto.folio}${manualContexto.plantillaTitulo ? ` Â· ${manualContexto.plantillaTitulo}` : ''}` : examenActivoEtiqueta}
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
                    .join(' Â· ')
                : null}
              soloLectura={Boolean(manualContexto?.soloLectura)}
              resumenPersistido={manualContexto?.resumenPersistido}
              onCalificar={onCalificar}
              puedeCalificar={puedeCalificar}
              avisarSinPermiso={avisarSinPermiso}
            />
          ) : null}
          {!mostrarSeccionCalificar ? (
            <InlineMensaje tipo="info">Confirma la revisiÃ³n OMR en la mesa superior para habilitar la calificaciÃ³n.</InlineMensaje>
          ) : null}
          <section className="panel calificaciones-revision-panel">
            <h3>
              <Icono nombre="info" /> Solicitudes de revisiÃ³n del alumno
            </h3>
            <div className="calificaciones-revision-panel__stats item-meta">
              <span>Pendientes: {resumenSolicitudes.pendientes}</span>
              <span>Atendidas: {resumenSolicitudes.atendidas}</span>
              <span>Rechazadas: {resumenSolicitudes.rechazadas}</span>
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
                <Icono nombre="recargar" /> {cargandoSolicitudes ? 'Sincronizandoâ€¦' : 'Sincronizar solicitudes'}
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
            {solicitudesSeguras.length === 0 && <InlineMensaje tipo="info">Sin solicitudes pendientes de revisiÃ³n.</InlineMensaje>}
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
                          Folio {solicitud.folio} Â· Pregunta {solicitud.numeroPregunta}
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
                      placeholder="Respuesta obligatoria para el alumno (mÃ­nimo 8 caracteres)"
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
                        <Icono nombre="ok" /> {resolviendoSolicitudId === solicitud._id ? 'Procesandoâ€¦' : 'Marcar atendida'}
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
                        <Icono nombre="salir" /> {resolviendoSolicitudId === solicitud._id ? 'Procesandoâ€¦' : 'Rechazar'}
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


