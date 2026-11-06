/**
 * ConsultaCalificaciones
 *
 * Responsabilidad: consulta rápida de calificaciones por alumno y examen.
 * Límites: no calcula notas; consume el resumen académico del periodo.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconoLucide, X } from '../../ui/iconosCatalogo';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import type { Periodo } from './tipos';
import { etiquetaMateriaParaSelector, mensajeDeError } from './utilidades';

export type FilaConsultaCalificacion = {
  alumnoId?: string;
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  grupo: string;
  parcial1: string;
  tareasYEjerciciosPrimerParcial: string;
  practicaPrimerParcial: string;
  examenPrimerParcialAutomatico: string;
  examenPrimerParcialLista: string;
  examenPrimerParcialListaVersion: number | null;
  continuaPrimerParcialLista: string;
  calificacionPrimerParcialLista: string;
  parcial2: string;
  global: string;
  final: string;
  observaciones: string;
  tareasYEjercicios2doParcial: string;
  tareasPuntosObtenidos: string;
  tareasPuntosPosibles: string;
  practica2doParcial: string;
  evaluacionContinua2doParcial: string;
  examen2doParcial: string;
  examen2doParcialAutomatico: string;
  calificacionSegundoParcial: string;
  examenGlobalComponente: string;
  examenGlobalLista: string;
  examenGlobalListaVersion: number | null;
  continuaTercerParcialLista: string;
  calificacionTercerParcial: string;
  ponderacionTercerParcialLista: string;
  subtotalPrimerSegundoParcialLista: string;
  ponderacionPrimerSegundoParcialesLista: string;
  calificacionFinalLibroLista: string;
  calificacionFinalBase10Lista: string;
  practica2doParcialVersion: number | null;
  examen2doParcialVersion: number | null;
  bonoExtracurricular?: string;
  bonoExtracurricularSolicitado?: string;
  bonoExtracurricularVersion?: number | null;
  bonoDistribucion?: Record<'examenGlobal' | 'continuaGlobal' | 'examenParcial2' | 'continuaParcial2' | 'examenParcial1' | 'continuaParcial1', number>;
  calificacionFinalCurso?: string;
  calificacionFinalCursoActa?: string;
  extraDisponible?: boolean;
  solicitaExtra?: boolean;
  solicitudExtraVersion?: number | null;
  resultadosExtraordinarios?: Array<{
    claseRegistro?: 'interno' | 'externo';
    examenGeneradoId?: string;
    loteId?: string | null;
    folio: string;
    calificacionSobre5: string;
    calificacionSobre10: string;
    estadoAprobatorio: 'Aprobatoria' | 'No aprobatoria';
    origen: string;
    fuenteArchivo?: string;
    documentoSha256?: string;
  }>;
};

type DatosResultadoExtraExterno = {
  folio: string;
  loteId: string;
  fuenteArchivo: string;
  documentoSha256: string;
  aciertos: string;
  totalReactivos: string;
  criteriosAplicados: string;
};
type CampoResultadoExtraExterno = keyof DatosResultadoExtraExterno;
type CampoResultadoExtraConError = Exclude<CampoResultadoExtraExterno, 'loteId' | 'documentoSha256'>;
type ErroresResultadoExtraExterno = Partial<Record<CampoResultadoExtraConError, string>>;

const RESUMEN_ERRORES_RESULTADO_EXTRA = 'Revisa los campos marcados antes de registrar el resultado.';

function validarResultadoExtraExterno(datos: DatosResultadoExtraExterno): ErroresResultadoExtraExterno {
  const errores: ErroresResultadoExtraExterno = {};
  const folio = datos.folio.trim();
  const aciertosVacio = !datos.aciertos.trim();
  const aciertos = Number(datos.aciertos);
  const totalVacio = !datos.totalReactivos.trim();
  const totalReactivos = Number(datos.totalReactivos);

  if (!folio) errores.folio = 'Escribe el folio visible del examen.';
  if (!datos.fuenteArchivo.trim() || !/^[a-f0-9]{64}$/i.test(datos.documentoSha256.trim())) {
    errores.fuenteArchivo = 'Selecciona un PDF válido y espera a que se calcule su SHA-256.';
  }
  if (aciertosVacio) errores.aciertos = 'Escribe los aciertos; captura 0 si no hubo respuestas correctas.';
  else if (!Number.isInteger(aciertos) || aciertos < 0) errores.aciertos = 'Escribe un número entero de aciertos igual o mayor que 0.';
  else if (!totalVacio && Number.isInteger(totalReactivos) && totalReactivos > 0 && aciertos > totalReactivos) {
    errores.aciertos = 'Los aciertos no pueden superar los reactivos evaluables.';
  }
  if (totalVacio || !Number.isInteger(totalReactivos) || totalReactivos < 1) {
    errores.totalReactivos = 'Escribe un total entero de al menos 1 reactivo evaluable.';
  }
  if (datos.criteriosAplicados.trim().length < 12) {
    errores.criteriosAplicados = 'Describe los criterios de revisión con al menos 12 caracteres.';
  }
  return errores;
}

type VistaPreviaBono = {
  alumnoId: string;
  bonoSolicitado: string;
  bonoAplicado: string;
  bonoDistribucion?: FilaConsultaCalificacion['bonoDistribucion'];
  parcial1: string;
  parcial2: string;
  parcial3: string;
  calificacionFinalCurso: string;
  regla: string;
  requiereConfirmacion: boolean;
};

export type ResumenConsultaCalificaciones = {
  periodoId: string;
  total: number;
  calificados: number;
  pendientes: number;
};

type FiltroConsulta = 'todos' | 'calificados' | 'pendientes';
type OrdenConsulta = 'alumno' | 'final-desc' | 'final-asc' | 'estado';
type SeccionDetalle = 'resumen' | 'primer' | 'segundo' | 'global' | 'libro';

const COMPONENTES_BONO: Array<{
  clave: NonNullable<FilaConsultaCalificacion['bonoDistribucion']> extends Record<infer K, number> ? K : never;
  etiqueta: string;
}> = [
  { clave: 'continuaGlobal', etiqueta: 'Continua · Global (tercer parcial)' },
  { clave: 'examenGlobal', etiqueta: 'Examen · Global (tercer parcial)' },
  { clave: 'continuaParcial2', etiqueta: 'Continua · Segundo parcial' },
  { clave: 'examenParcial2', etiqueta: 'Examen · Segundo parcial' },
  { clave: 'continuaParcial1', etiqueta: 'Continua · Primer parcial' },
  { clave: 'examenParcial1', etiqueta: 'Examen · Primer parcial' }
];

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function normalizarBusquedaResultado(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function etiquetaVisibleComponente(componente: string): string {
  return componente.replace(/Exámen/g, 'Examen').replace(/Practica/g, 'Práctica');
}

function tieneCalificacion(fila: FilaConsultaCalificacion): boolean {
  return [fila.parcial1, fila.parcial2, fila.global, fila.calificacionFinalCurso, fila.final].some((valor) => texto(valor ?? '') !== '');
}

function notaFinalCurso(fila: FilaConsultaCalificacion): string {
  return fila.calificacionFinalCurso || fila.final;
}

function nombreAlumno(fila: FilaConsultaCalificacion): string {
  return [fila.apellidoPaterno, fila.apellidoMaterno, fila.nombre].map(texto).filter(Boolean).join(' ') || 'Alumno sin nombre';
}

function mostrarNota(valor: string): string {
  const nota = texto(valor);
  if (!nota) return '—';

  const numero = Number(nota);
  if (!Number.isFinite(numero)) return nota;

  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
    useGrouping: false
  }).format(numero);
}

function numeroNota(valor: string): number {
  const numero = Number(texto(valor).replace(',', '.'));
  return Number.isFinite(numero) ? numero : -1;
}

export function ConsultaCalificaciones({
  periodos,
  periodoId,
  onPeriodoChange,
  onSeleccionarAlumno,
  onResumenChange
}: {
  periodos: Periodo[];
  periodoId: string;
  onPeriodoChange: (periodoId: string) => void;
  onSeleccionarAlumno: (alumnoId: string) => void;
  onResumenChange?: (resumen: ResumenConsultaCalificaciones) => void;
}) {
  const [filas, setFilas] = useState<FilaConsultaCalificacion[]>([]);
  const [periodoDatosId, setPeriodoDatosId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroConsulta>('todos');
  const [orden, setOrden] = useState<OrdenConsulta>('alumno');
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaConsultaCalificacion | null>(null);
  const idPanelDetalle = useId();
  const idsResultadoExtraExterno: Record<CampoResultadoExtraConError, string> = {
    folio: `${idPanelDetalle}-extra-folio`,
    fuenteArchivo: `${idPanelDetalle}-extra-pdf`,
    aciertos: `${idPanelDetalle}-extra-aciertos`,
    totalReactivos: `${idPanelDetalle}-extra-total`,
    criteriosAplicados: `${idPanelDetalle}-extra-criterios`
  };
  const botonDetalleOrigenRef = useRef<HTMLButtonElement | null>(null);
  const [seccionDetalle, setSeccionDetalle] = useState<SeccionDetalle>('primer');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [borradores, setBorradores] = useState({ examen1: '', practica: '', examen: '', global: '' });
  const [guardando, setGuardando] = useState<'examen1' | 'practica' | 'examen' | 'global' | 'extra' | 'resultadoExtra' | null>(null);
  const [calculandoHashExtra, setCalculandoHashExtra] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');
  const [erroresResultadoExtraExterno, setErroresResultadoExtraExterno] = useState<ErroresResultadoExtraExterno>({});
  const erroresResultadoExtraExternoRef = useRef<ErroresResultadoExtraExterno>(erroresResultadoExtraExterno);
  erroresResultadoExtraExternoRef.current = erroresResultadoExtraExterno;
  const [historialCapturas, setHistorialCapturas] = useState<Array<{ id: string; componente?: string | null; valorAnterior?: number | null; valorNuevo?: number | null; version?: number | null; canalCaptura: string; metodoCaptura: string; actorId: string; createdAt: string }>>([]);
  const [cargandoHistorialCapturas, setCargandoHistorialCapturas] = useState(false);
  const [errorHistorialCapturas, setErrorHistorialCapturas] = useState('');
  const [borradorBono, setBorradorBono] = useState('');
  const [vistaPreviaBono, setVistaPreviaBono] = useState<VistaPreviaBono | null>(null);
  const [procesandoBono, setProcesandoBono] = useState(false);
  const detalleRef = useRef<HTMLElement>(null);
  const filaSeleccionadaRef = useRef<FilaConsultaCalificacion | null>(null);
  const solicitudesCalificacionPendientes = useRef(new Map<string, string>());
  const solicitudBonoPendiente = useRef<{ clave: string; clientRequestId: string } | null>(null);
  const solicitudExtraPendiente = useRef<{ clave: string; clientRequestId: string } | null>(null);
  const solicitudResultadoExtraPendiente = useRef<{ clave: string; clientRequestId: string } | null>(null);
  const [resultadoExtraExterno, setResultadoExtraExterno] = useState({
    folio: '', loteId: '', fuenteArchivo: '', documentoSha256: '', aciertos: '', totalReactivos: '', criteriosAplicados: ''
  });
  const resultadoExtraExternoRef = useRef<DatosResultadoExtraExterno>(resultadoExtraExterno);
  resultadoExtraExternoRef.current = resultadoExtraExterno;

  function actualizarCampoResultadoExtraExterno(campo: CampoResultadoExtraExterno, valor: string) {
    const datosActualizados = { ...resultadoExtraExternoRef.current, [campo]: valor };
    resultadoExtraExternoRef.current = datosActualizados;
    setResultadoExtraExterno(datosActualizados);
    if (Object.keys(erroresResultadoExtraExternoRef.current).length > 0) {
      const errores = validarResultadoExtraExterno(datosActualizados);
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(Object.keys(errores).length > 0 ? RESUMEN_ERRORES_RESULTADO_EXTRA : '');
    }
  }

  filaSeleccionadaRef.current = filaSeleccionada;
  const alumnoSeleccionadoId = filaSeleccionada?.alumnoId;
  const periodoSeleccionado = periodos.find((periodo) => String(periodo._id) === periodoId);
  const descripcionMateria = !periodoId
    ? 'Elige una materia del catálogo; los filtros estarán disponibles después.'
    : periodoSeleccionado
      ? `Materia seleccionada: ${etiquetaMateriaParaSelector(periodoSeleccionado)}${periodoSeleccionado.activo === false ? ' · Archivada' : ''}`
      : 'La materia seleccionada ya no está disponible.';

  useEffect(() => {
    let cancelado = false;
    setFilaSeleccionada(null);
    if (!periodoId) {
      setFilas([]);
      setPeriodoDatosId('');
      setError('');
      setCargando(false);
      return () => {
        cancelado = true;
      };
    }

    setCargando(true);
    setPeriodoDatosId('');
    setError('');
    void clienteApi
      .obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`)
      .then((respuesta) => {
        if (cancelado) return;
        setFilas(Array.isArray(respuesta?.filas) ? respuesta.filas : []);
        setPeriodoDatosId(periodoId);
      })
      .catch((razon) => {
        if (cancelado) return;
        setFilas([]);
        setError(mensajeDeError(razon, 'No se pudo cargar la lista de calificaciones.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [intentoCarga, periodoId]);

  useEffect(() => {
    const fila = filaSeleccionadaRef.current;
    if (!fila || fila.alumnoId !== alumnoSeleccionadoId) return;
    setBorradores({ examen1: fila.examenPrimerParcialLista ?? '', practica: fila.practica2doParcial ?? '', examen: fila.examen2doParcial ?? '', global: fila.examenGlobalLista ?? '' });
    setBorradorBono(fila.bonoExtracurricularSolicitado || '');
    setVistaPreviaBono(null);
    setErrorGuardado('');
    detalleRef.current?.focus();
  }, [alumnoSeleccionadoId, periodoId]);

  useEffect(() => {
    if (filaSeleccionada?.alumnoId) detalleRef.current?.focus();
  }, [filaSeleccionada?.alumnoId]);

  function cerrarDetalle() {
    setFilaSeleccionada(null);
    const botonOrigen = botonDetalleOrigenRef.current;
    if (botonOrigen?.isConnected) botonOrigen.focus();
  }

  async function guardarComponente(componente: 'Practica 2do Parcial' | 'Exámen 1er Parcial' | 'Exámen 2do Parcial' | 'Exámen Global') {
    if (!filaSeleccionada || !periodoId) return;
    const esPractica = componente === 'Practica 2do Parcial';
    const esExamen1 = componente === 'Exámen 1er Parcial';
    const esExamen2 = componente === 'Exámen 2do Parcial';
    const esGlobal = componente === 'Exámen Global';
    const campo = esPractica ? 'practica' : esExamen1 ? 'examen1' : esGlobal ? 'global' : 'examen';
    const valorTexto = borradores[campo].trim().replace(',', '.');
    const valor = Number(valorTexto);
    const maximo = esPractica ? 10 : esExamen2 ? 5.25 : 5;
    if (!valorTexto || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
      setErrorGuardado(`La calificación de “${etiquetaVisibleComponente(componente)}” debe estar entre 0 y ${maximo}.`);
      return;
    }
    setGuardando(campo);
    setErrorGuardado('');
    const versionInicial = esPractica
      ? filaSeleccionada.practica2doParcialVersion
      : esExamen1 ? filaSeleccionada.examenPrimerParcialListaVersion
        : esGlobal ? filaSeleccionada.examenGlobalListaVersion : filaSeleccionada.examen2doParcialVersion;
    const claveSolicitud = [periodoId, filaSeleccionada.alumnoId, componente, valor, versionInicial ?? 'nueva'].join('|');
    let clientRequestId = solicitudesCalificacionPendientes.current.get(claveSolicitud);
    if (!clientRequestId) {
      clientRequestId = crypto.randomUUID();
      solicitudesCalificacionPendientes.current.set(claveSolicitud, clientRequestId);
    }
    const actualizarDesdeApi = async () => {
      const respuesta = await clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`);
      const actualizadas = Array.isArray(respuesta?.filas) ? respuesta.filas : [];
      setFilas(actualizadas);
      const filaActualizada = actualizadas.find((fila) => fila.alumnoId === filaSeleccionada.alumnoId);
      if (filaActualizada) setFilaSeleccionada(filaActualizada);
      return filaActualizada;
    };
    try {
      await clienteApi.enviar('/analiticas/lista-academica/calificaciones', {
        periodoId,
        alumnoId: filaSeleccionada.alumnoId,
        componente,
        calificacion: valor,
        canalCaptura: 'gui',
        clientRequestId,
        ...(versionInicial !== null ? { version: versionInicial } : {})
      });
      const filaActualizada = await actualizarDesdeApi();
      const calificacionActual = esPractica
        ? filaActualizada?.practica2doParcial
        : esExamen1 ? filaActualizada?.examenPrimerParcialLista
          : esGlobal ? filaActualizada?.examenGlobalLista : filaActualizada?.examen2doParcial;
      const versionActual = esPractica
        ? filaActualizada?.practica2doParcialVersion
        : esExamen1 ? filaActualizada?.examenPrimerParcialListaVersion
          : esGlobal ? filaActualizada?.examenGlobalListaVersion : filaActualizada?.examen2doParcialVersion;
      if (calificacionActual !== undefined && numeroNota(calificacionActual) === valor && (versionActual ?? 0) > (versionInicial ?? 0)) {
        solicitudesCalificacionPendientes.current.delete(claveSolicitud);
      }
    } catch (razon) {
      try {
        const filaActualizada = await actualizarDesdeApi();
        const calificacionActual = esPractica
          ? filaActualizada?.practica2doParcial
          : esExamen1 ? filaActualizada?.examenPrimerParcialLista
            : esGlobal ? filaActualizada?.examenGlobalLista : filaActualizada?.examen2doParcial;
        const versionActual = esPractica
          ? filaActualizada?.practica2doParcialVersion
          : esExamen1 ? filaActualizada?.examenPrimerParcialListaVersion
            : esGlobal ? filaActualizada?.examenGlobalListaVersion : filaActualizada?.examen2doParcialVersion;
        if (calificacionActual !== undefined && numeroNota(calificacionActual) === valor && (versionActual ?? 0) > (versionInicial ?? 0)) {
          solicitudesCalificacionPendientes.current.delete(claveSolicitud);
          return;
        }
      } catch {
        // Se muestra el error original si no fue posible reconciliar la escritura por API.
      }
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo guardar la calificación.');
    } finally {
      setGuardando(null);
    }
  }

  async function guardarSolicitudExtra(solicita: boolean) {
    if (!filaSeleccionada?.alumnoId || !periodoId || (solicita && !filaSeleccionada.extraDisponible)) return;
    const valor = solicita ? 1 : 0;
    const versionInicial = filaSeleccionada.solicitudExtraVersion ?? null;
    const clave = [periodoId, filaSeleccionada.alumnoId, valor, versionInicial ?? 'nueva'].join('|');
    if (solicitudExtraPendiente.current?.clave !== clave) {
      solicitudExtraPendiente.current = { clave, clientRequestId: crypto.randomUUID() };
    }
    const clientRequestId = solicitudExtraPendiente.current.clientRequestId;
    setGuardando('extra');
    setErrorGuardado('');
    try {
      await clienteApi.enviar('/analiticas/lista-academica/calificaciones', {
        periodoId,
        alumnoId: filaSeleccionada.alumnoId,
        componente: 'Solicitud Extra',
        calificacion: valor,
        canalCaptura: 'gui',
        clientRequestId,
        ...(versionInicial !== null ? { version: versionInicial } : {})
      });
      const respuesta = await clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`);
      const actualizadas = Array.isArray(respuesta?.filas) ? respuesta.filas : [];
      setFilas(actualizadas);
      const actualizada = actualizadas.find((fila) => fila.alumnoId === filaSeleccionada.alumnoId);
      if (actualizada) {
        setFilaSeleccionada(actualizada);
        if (actualizada.solicitaExtra === solicita && (actualizada.solicitudExtraVersion ?? 0) > (versionInicial ?? 0)) {
          solicitudExtraPendiente.current = null;
        }
      }
    } catch (razon) {
      try {
        const respuesta = await clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`);
        const actualizadas = Array.isArray(respuesta?.filas) ? respuesta.filas : [];
        setFilas(actualizadas);
        const actualizada = actualizadas.find((fila) => fila.alumnoId === filaSeleccionada.alumnoId);
        if (actualizada) {
          setFilaSeleccionada(actualizada);
          if (actualizada.solicitaExtra === solicita && (actualizada.solicitudExtraVersion ?? 0) > (versionInicial ?? 0)) {
            solicitudExtraPendiente.current = null;
            return;
          }
        }
      } catch {
        // Conserva la clave idempotente si no se pudo comprobar el resultado.
      }
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo guardar la solicitud de Extra.');
    } finally {
      setGuardando(null);
    }
  }

  async function guardarResultadoExtraExterno() {
    if (!filaSeleccionada?.alumnoId || !periodoId || !filaSeleccionada.solicitaExtra || !filaSeleccionada.extraDisponible) return;
    const folio = resultadoExtraExterno.folio.trim().toUpperCase();
    const aciertos = Number(resultadoExtraExterno.aciertos);
    const totalReactivos = Number(resultadoExtraExterno.totalReactivos);
    const errores = validarResultadoExtraExterno(resultadoExtraExterno);
    if (Object.keys(errores).length > 0) {
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(RESUMEN_ERRORES_RESULTADO_EXTRA);
      const primerCampo = (['folio', 'fuenteArchivo', 'aciertos', 'totalReactivos', 'criteriosAplicados'] as const)
        .find((campo) => errores[campo]);
      if (primerCampo) document.getElementById(idsResultadoExtraExterno[primerCampo])?.focus();
      return;
    }
    erroresResultadoExtraExternoRef.current = {};
    setErroresResultadoExtraExterno({});
    const payload = {
      periodoId, alumnoId: filaSeleccionada.alumnoId, solicitaExtra: true as const, folio,
      ...(resultadoExtraExterno.loteId.trim() ? { loteId: resultadoExtraExterno.loteId.trim().toUpperCase() } : {}),
      fuenteArchivo: resultadoExtraExterno.fuenteArchivo.trim(), documentoSha256: resultadoExtraExterno.documentoSha256.trim().toLowerCase(),
      aciertos, totalReactivos, criteriosAplicados: resultadoExtraExterno.criteriosAplicados.trim()
    };
    const clave = JSON.stringify(payload);
    if (solicitudResultadoExtraPendiente.current?.clave !== clave) {
      solicitudResultadoExtraPendiente.current = { clave, clientRequestId: crypto.randomUUID() };
    }
    const clientRequestId = solicitudResultadoExtraPendiente.current.clientRequestId;
    const recargar = async () => {
      const respuesta = await clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`);
      const actualizadas = Array.isArray(respuesta?.filas) ? respuesta.filas : [];
      setFilas(actualizadas);
      const actualizada = actualizadas.find((fila) => fila.alumnoId === filaSeleccionada.alumnoId);
      if (actualizada) setFilaSeleccionada(actualizada);
      return actualizada;
    };
    setGuardando('resultadoExtra');
    setErrorGuardado('');
    try {
      await clienteApi.enviar('/analiticas/lista-academica/resultados-extra-externos', { ...payload, clientRequestId });
      const actualizada = await recargar();
      if (actualizada?.resultadosExtraordinarios?.some((resultado) => resultado.claseRegistro === 'externo' && resultado.folio === folio)) {
        solicitudResultadoExtraPendiente.current = null;
        const datosVacios = { folio: '', loteId: '', fuenteArchivo: '', documentoSha256: '', aciertos: '', totalReactivos: '', criteriosAplicados: '' };
        resultadoExtraExternoRef.current = datosVacios;
        setResultadoExtraExterno(datosVacios);
        erroresResultadoExtraExternoRef.current = {};
        setErroresResultadoExtraExterno({});
      }
    } catch (razon) {
      try {
        const actualizada = await recargar();
        if (actualizada?.resultadosExtraordinarios?.some((resultado) => resultado.claseRegistro === 'externo' && resultado.folio === folio)) {
          solicitudResultadoExtraPendiente.current = null;
          erroresResultadoExtraExternoRef.current = {};
          setErroresResultadoExtraExterno({});
          setErrorGuardado('');
          return;
        }
      } catch {
        // Retiene clientRequestId para recuperar una escritura de resultado incierta.
      }
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo registrar el resultado externo.');
    } finally {
      setGuardando(null);
    }
  }

  async function seleccionarPdfExtra(file?: File) {
    if (!file) return;
    const datosSinPdf = { ...resultadoExtraExternoRef.current, fuenteArchivo: '', documentoSha256: '' };
    resultadoExtraExternoRef.current = datosSinPdf;
    setResultadoExtraExterno(datosSinPdf);
    if (!/\.pdf$/i.test(file.name) || file.size === 0) {
      const errores = { ...erroresResultadoExtraExternoRef.current, fuenteArchivo: 'Selecciona un PDF válido y no vacío.' };
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(RESUMEN_ERRORES_RESULTADO_EXTRA);
      return;
    }
    if (!globalThis.crypto?.subtle) {
      const errores = { ...erroresResultadoExtraExternoRef.current, fuenteArchivo: 'No se puede calcular SHA-256 en este navegador. Usa un contexto seguro y selecciona el PDF de nuevo.' };
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(RESUMEN_ERRORES_RESULTADO_EXTRA);
      return;
    }
    const erroresSinPdf = { ...erroresResultadoExtraExternoRef.current };
    delete erroresSinPdf.fuenteArchivo;
    erroresResultadoExtraExternoRef.current = erroresSinPdf;
    setErroresResultadoExtraExterno(erroresSinPdf);
    setCalculandoHashExtra(true);
    try {
      const bytes = await file.arrayBuffer();
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('El contenido seleccionado no tiene firma PDF.');
      const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const documentoSha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const datosActualizados = { ...resultadoExtraExternoRef.current, fuenteArchivo: file.name, documentoSha256 };
      resultadoExtraExternoRef.current = datosActualizados;
      setResultadoExtraExterno(datosActualizados);
      const errores = validarResultadoExtraExterno(datosActualizados);
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(Object.keys(errores).length > 0 ? RESUMEN_ERRORES_RESULTADO_EXTRA : '');
    } catch (razon) {
      const errores = { ...erroresResultadoExtraExternoRef.current, fuenteArchivo: razon instanceof Error ? razon.message : 'No se pudo leer el PDF para calcular su SHA-256 localmente.' };
      erroresResultadoExtraExternoRef.current = errores;
      setErroresResultadoExtraExterno(errores);
      setErrorGuardado(RESUMEN_ERRORES_RESULTADO_EXTRA);
    } finally {
      setCalculandoHashExtra(false);
    }
  }

  async function previsualizarBono() {
    if (!filaSeleccionada?.alumnoId || !periodoId) return;
    const bono = Number(borradorBono.trim().replace(',', '.'));
    if (!Number.isFinite(bono) || bono < 0 || bono > 1) {
      setErrorGuardado('El bono debe estar entre 0 y 1 punto.');
      return;
    }
    setProcesandoBono(true);
    setVistaPreviaBono(null);
    setErrorGuardado('');
    try {
      const respuesta = await clienteApi.enviar<{ preview: VistaPreviaBono }>('/analiticas/lista-academica/bono/preview', {
        periodoId,
        alumnoId: filaSeleccionada.alumnoId,
        bono
      });
      setVistaPreviaBono(respuesta.preview);
    } catch (razon) {
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo calcular la vista previa del bono.');
    } finally {
      setProcesandoBono(false);
    }
  }

  async function confirmarBono() {
    if (!filaSeleccionada?.alumnoId || !periodoId || !vistaPreviaBono || vistaPreviaBono.alumnoId !== filaSeleccionada.alumnoId) return;
    const bono = Number(borradorBono.trim().replace(',', '.'));
    if (!Number.isFinite(bono) || String(bono) !== vistaPreviaBono.bonoSolicitado) {
      setErrorGuardado('El importe cambió después de la vista previa. Vuelve a calcular antes de guardar.');
      setVistaPreviaBono(null);
      return;
    }
    setProcesandoBono(true);
    setErrorGuardado('');
    const versionInicial = filaSeleccionada.bonoExtracurricularVersion ?? null;
    const claveSolicitud = [periodoId, filaSeleccionada.alumnoId, bono, versionInicial ?? 'nueva'].join('|');
    if (solicitudBonoPendiente.current?.clave !== claveSolicitud) {
      solicitudBonoPendiente.current = { clave: claveSolicitud, clientRequestId: crypto.randomUUID() };
    }
    const clientRequestId = solicitudBonoPendiente.current.clientRequestId;
    const actualizarDesdeApi = async () => {
      const respuesta = await clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`);
      const actualizadas = Array.isArray(respuesta?.filas) ? respuesta.filas : [];
      setFilas(actualizadas);
      const actualizada = actualizadas.find((fila) => fila.alumnoId === filaSeleccionada.alumnoId);
      if (actualizada) setFilaSeleccionada(actualizada);
      return actualizada;
    };
    try {
      await clienteApi.enviar('/analiticas/lista-academica/calificaciones', {
        periodoId,
        alumnoId: filaSeleccionada.alumnoId,
        componente: 'Bono extracurricular',
        calificacion: bono,
        canalCaptura: 'gui',
        clientRequestId,
        ...(versionInicial !== null ? { version: versionInicial } : {})
      });
      solicitudBonoPendiente.current = null;
      await actualizarDesdeApi();
      setVistaPreviaBono(null);
    } catch (razon) {
      try {
        const filaActualizada = await actualizarDesdeApi();
        if (filaActualizada && numeroNota(filaActualizada.bonoExtracurricularSolicitado || '') === bono && (filaActualizada.bonoExtracurricularVersion ?? 0) > (versionInicial ?? 0)) {
          solicitudBonoPendiente.current = null;
          setVistaPreviaBono(null);
          return;
        }
      } catch {
        // Conserva el error original si no se pudo comprobar la escritura.
      }
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo guardar el bono.');
    } finally {
      setProcesandoBono(false);
    }
  }

  const filasFiltradas = useMemo(() => {
    const consulta = normalizarBusquedaResultado(busqueda);
    const resultado = filas.filter((fila) => {
      const calificado = tieneCalificacion(fila);
      if (filtro === 'calificados' && !calificado) return false;
      if (filtro === 'pendientes' && calificado) return false;
      if (!consulta) return true;
      return [nombreAlumno(fila), fila.matricula, fila.grupo].some((valor) => normalizarBusquedaResultado(valor).includes(consulta));
    });

    return resultado.sort((a, b) => {
      if (orden === 'final-desc' || orden === 'final-asc') {
        const notaA = texto(notaFinalCurso(a));
        const notaB = texto(notaFinalCurso(b));
        if (!notaA || !notaB) return notaA ? -1 : notaB ? 1 : 0;
        const diferencia = numeroNota(notaA) - numeroNota(notaB);
        return orden === 'final-desc' ? -diferencia : diferencia;
      }
      if (orden === 'estado') return Number(tieneCalificacion(a)) - Number(tieneCalificacion(b));
      return nombreAlumno(a).localeCompare(nombreAlumno(b), 'es', { sensitivity: 'base' });
    });
  }, [busqueda, filas, filtro, orden]);

  const totalCalificados = useMemo(() => filas.filter(tieneCalificacion).length, [filas]);
  const totalPendientes = filas.length - totalCalificados;
  const resumenFiltro = filtro === 'todos' ? 'Todos los alumnos' : filtro === 'calificados' ? 'Alumnos con calificación' : 'Alumnos sin calificación';
  const camposLibro = filaSeleccionada ? [
    ['AJ', 'Tareas y Ejercicios 1er Parcial (60%)', filaSeleccionada.tareasYEjerciciosPrimerParcial, 'escala del libro'],
    ['AK', 'Práctica 1er Parcial (40%)', filaSeleccionada.practicaPrimerParcial, 'escala del libro'],
    ['AL', 'Evaluación Continua 1er Parcial', filaSeleccionada.continuaPrimerParcialLista, '0–5'],
    ['AM', 'Examen 1er Parcial', filaSeleccionada.examenPrimerParcialLista, '0–5'],
    ['AN', 'Calificación Primer Parcial', filaSeleccionada.calificacionPrimerParcialLista, '0–10'],
    ['AO', 'Tareas y Ejercicios 2do Parcial', filaSeleccionada.tareasYEjercicios2doParcial, 'según evidencias Classroom'],
    ['AP', 'Práctica 2do Parcial', filaSeleccionada.practica2doParcial, '0–10'],
    ['AQ', 'Evaluación Continua 2do Parcial', filaSeleccionada.evaluacionContinua2doParcial, '0–5'],
    ['AR', 'Examen 2do Parcial', filaSeleccionada.examen2doParcial, '0–5.25'],
    ['AS', 'Calificación Segundo Parcial', filaSeleccionada.calificacionSegundoParcial, '0–10'],
    ['AT', 'Examen Global', filaSeleccionada.examenGlobalLista, '0–5'],
    ['AU', 'Evaluación Continua 3er Parcial (Proyecto)', filaSeleccionada.continuaTercerParcialLista, '0–5'],
    ['AV', 'Calificación Tercer Parcial', filaSeleccionada.calificacionTercerParcial, '0–10'],
    ['AW', 'Calificación Tercer Parcial ponderada (60%)', filaSeleccionada.ponderacionTercerParcialLista, 'ponderación del libro'],
    ['AX', 'Porcentaje 1er y Segundo Parcial (subtotal)', filaSeleccionada.subtotalPrimerSegundoParcialLista, 'fórmula del libro'],
    ['AY', 'Porcentaje 1er y Segundo Parcial (40%)', filaSeleccionada.ponderacionPrimerSegundoParcialesLista, 'ponderación del libro'],
    ['AZ', 'Calificación Final', filaSeleccionada.calificacionFinalLibroLista, '0–10'],
    ['BA', 'Calificación Final (Base 10)', filaSeleccionada.calificacionFinalBase10Lista, 'escala del libro'],
    ['BB', 'Bono extracurricular otorgado', filaSeleccionada.bonoExtracurricular ?? '', '0–1']
  ] as const : [];
  const camposLibroConDato = camposLibro.filter(([, , valor]) => texto(valor) !== '');
  const camposLibroSinDato = camposLibro.filter(([, , valor]) => texto(valor) === '');

  useEffect(() => {
    if (!periodoId || periodoDatosId !== periodoId || cargando || error) return;
    onResumenChange?.({ periodoId, total: filas.length, calificados: totalCalificados, pendientes: totalPendientes });
  }, [cargando, error, filas.length, onResumenChange, periodoDatosId, periodoId, totalCalificados, totalPendientes]);

  const mostrarResumen = Boolean(periodoId) && periodoDatosId === periodoId && !cargando && !error;
  const ayudaFiltros = !periodoId
    ? 'Selecciona una materia para activar los filtros.'
    : cargando
      ? 'Los filtros se activarán cuando termine la carga.'
      : error
        ? 'Reintenta la consulta para activar los filtros.'
        : '';

  return (
    <section className="calificaciones-consulta anim-fade-in" aria-labelledby="calificaciones-consulta-title">
      <div className="calificaciones-consulta__head">
        <div>
          <span className="calificaciones-kicker">Libro de calificaciones</span>
          <h3 id="calificaciones-consulta-title">Resultados por alumno</h3>
          <p className="nota">Consulta las columnas de la lista física y las calificaciones sincronizadas.</p>
        </div>
      </div>

      <div className="calificaciones-consulta__toolbar" role="group" aria-label="Controles de consulta">
        <div className="campo calificaciones-consulta__subject">
          <label htmlFor="calificaciones-consulta-materia">Materia</label>
          <select id="calificaciones-consulta-materia" aria-describedby="calificaciones-consulta-materia-ayuda" value={periodoId} onChange={(event) => onPeriodoChange(event.target.value)}>
            <option value="">Selecciona materia...</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {etiquetaMateriaParaSelector(periodo)}{periodo.activo === false ? ' · Archivada' : ''}
              </option>
            ))}
          </select>
          <small id="calificaciones-consulta-materia-ayuda" className="ayuda">{descripcionMateria}</small>
        </div>
        <div className="campo calificaciones-consulta__search">
          <label htmlFor="calificaciones-busqueda">Buscar alumno</label>
          <input
            id="calificaciones-busqueda"
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre o matrícula"
            aria-describedby="calificaciones-busqueda-ayuda"
            disabled={!periodoId || cargando}
          />
          <span className="ayuda" id="calificaciones-busqueda-ayuda">También puedes buscar por grupo.</span>
        </div>
        <label className="campo calificaciones-consulta__sort">
          <span>Ordenar</span>
          <select value={orden} onChange={(event) => setOrden(event.target.value as OrdenConsulta)} disabled={!periodoId || cargando}>
            <option value="alumno">Nombre del alumno</option>
            <option value="final-desc">Final: mayor a menor</option>
            <option value="final-asc">Final: menor a mayor</option>
            <option value="estado">Sin calificación primero</option>
          </select>
        </label>
        <div
          className="calificaciones-consulta__filters"
          role="group"
          aria-label="Filtrar alumnos"
          aria-disabled={!mostrarResumen}
          aria-describedby={!mostrarResumen ? 'calificaciones-consulta-filtros-ayuda' : undefined}
        >
          {(['todos', 'calificados', 'pendientes'] as const).map((opcion) => {
            const activo = filtro === opcion;
            const etiqueta = opcion === 'todos' ? 'Todos' : opcion === 'calificados' ? 'Con calificación' : 'Sin calificación';
            return (
              <button
                key={opcion}
                type="button"
                className={`calificaciones-consulta__filter${activo ? ' is-active' : ''}${!mostrarResumen ? ' is-unavailable' : ''}`}
                aria-pressed={activo}
                aria-disabled={!mostrarResumen}
                onClick={() => {
                  if (mostrarResumen) setFiltro(opcion);
                }}
              >
                {etiqueta}
              </button>
            );
          })}
          {!mostrarResumen && (
            <span id="calificaciones-consulta-filtros-ayuda" className="calificaciones-consulta__filters-hint">
              {ayudaFiltros}
            </span>
          )}
        </div>
      </div>
      {periodoSeleccionado?.activo === false && (
        <InlineMensaje tipo="info">Materia archivada: estás consultando el historial. Los cambios autorizados se guardan sin reactivar el curso.</InlineMensaje>
      )}

      {mostrarResumen && <div className="calificaciones-consulta__result-meta">
        <span role="status">{resumenFiltro} · {filasFiltradas.length} {filasFiltradas.length === 1 ? 'visible' : 'visibles'}</span>
        <span className="calificaciones-consulta__legend"><i className="is-final" aria-hidden="true" /> Calificación final destacada</span>
      </div>}

      {cargando && <InlineMensaje tipo="info">Cargando calificaciones del periodo...</InlineMensaje>}
      {!cargando && error && (
        <div className="calificaciones-consulta__load-error">
          <InlineMensaje tipo="error">No se pudo cargar la consulta: {error}</InlineMensaje>
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            onClick={() => {
              setCargando(true);
              setError('');
              setIntentoCarga((intento) => intento + 1);
            }}
          >
            Reintentar consulta
          </Boton>
        </div>
      )}
      {!cargando && !error && !periodoId && <InlineMensaje tipo="info">Selecciona una materia para consultar sus calificaciones.</InlineMensaje>}
      {mostrarResumen && filas.length === 0 && <InlineMensaje tipo="info">No hay alumnos registrados en esta materia.</InlineMensaje>}
      {mostrarResumen && filas.length > 0 && filasFiltradas.length === 0 && (
        <div className="calificaciones-consulta__no-results">
          <InlineMensaje tipo="info">
            {busqueda.trim()
              ? <>No hay alumnos que coincidan con «{busqueda.trim()}» con los filtros actuales.</>
              : 'No hay alumnos que coincidan con los filtros aplicados.'}
          </InlineMensaje>
          {busqueda.trim() && (
            <Boton type="button" variante="secundario" onClick={() => setBusqueda('')}>
              Limpiar búsqueda
            </Boton>
          )}
        </div>
      )}

      {mostrarResumen && filasFiltradas.length > 0 && (
        <div className="calificaciones-consulta__table-wrap">
          <table className="calificaciones-consulta__table">
            <caption className="sr-only">Calificaciones por alumno, corte y resultado final</caption>
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                <th scope="col">Grupo</th>
                <th scope="col">Parcial 1</th>
                <th scope="col">Parcial 2</th>
                <th scope="col">Global</th>
                <th scope="col">Bono</th>
                <th scope="col" className="is-final-column">Final</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((fila, indice) => {
                const alumno = nombreAlumno(fila);
                const calificado = tieneCalificacion(fila);
                const alumnoId = texto(fila.alumnoId);
                const detalleExpandido = Boolean(alumnoId) && texto(filaSeleccionada?.alumnoId) === alumnoId;
                return (
                  <tr key={texto(fila.alumnoId) || fila.matricula || `${alumno}-${fila.grupo}-${indice}`} className={!calificado ? 'is-pending' : undefined}>
                    <th scope="row" data-label="Alumno">
                      <span className="calificaciones-consulta__student">{alumno}</span>
                      <span className="calificaciones-consulta__matricula">{fila.matricula || 'Sin matrícula'}</span>
                    </th>
                    <td data-label="Grupo">{fila.grupo || '—'}</td>
                    {[fila.parcial1, fila.parcial2, fila.global].map((nota, index) => (
                      <td key={`${fila.matricula}-nota-${index}`} data-label={['Parcial 1', 'Parcial 2', 'Global'][index]}>
                        <span className={`calificaciones-consulta__score${texto(nota) ? '' : ' is-empty'}`}>{mostrarNota(nota)}</span>
                      </td>
                    ))}
                    <td data-label="Bono"><span className={`calificaciones-consulta__score${texto(fila.bonoExtracurricular) && numeroNota(fila.bonoExtracurricular ?? '') > 0 ? '' : ' is-empty'}`}>{mostrarNota(fila.bonoExtracurricular ?? '')}</span></td>
                    <td data-label="Final" className="is-final-column">
                      <span className={`calificaciones-consulta__final${texto(notaFinalCurso(fila)) ? '' : ' is-empty'}`}>{mostrarNota(notaFinalCurso(fila))}</span>
                    </td>
                    <td data-label="Estado">
                      <span className={`calificaciones-consulta__status ${calificado ? 'is-complete' : 'is-pending'}`}>
                        <span aria-hidden="true" className="calificaciones-consulta__status-dot" />
                        {calificado ? 'Con calificación' : 'Sin calificación'}
                      </span>
                    </td>
                    <td data-label="Acción" className="calificaciones-consulta__action-cell">
                      <Boton
                        type="button"
                        variante="secundario"
                        disabled={!alumnoId}
                        aria-label={`Ver detalle de ${alumno} · matrícula ${fila.matricula || 'sin matrícula'} · grupo ${fila.grupo || 'sin grupo'}`}
                        aria-expanded={detalleExpandido}
                        aria-controls={detalleExpandido ? idPanelDetalle : undefined}
                        onClick={(event) => {
                          botonDetalleOrigenRef.current = event.currentTarget;
                          setFilaSeleccionada(fila);
                          setSeccionDetalle('primer');
                        }}
                      >
                        Ver detalle
                      </Boton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filaSeleccionada && (
        <aside
          id={idPanelDetalle}
          ref={detalleRef}
          className="calificaciones-consulta__detail"
          tabIndex={-1}
          aria-labelledby="calificaciones-detalle-title"
          aria-describedby="calificaciones-detalle-description"
        >
          <div className="calificaciones-consulta__detail-head">
            <div>
              <span className="calificaciones-kicker">Detalle del alumno</span>
              <h4 id="calificaciones-detalle-title">{nombreAlumno(filaSeleccionada)}</h4>
              <p id="calificaciones-detalle-description">{filaSeleccionada.matricula || 'Sin matrícula'} · Grupo {filaSeleccionada.grupo || 'sin grupo'}</p>
            </div>
            <button type="button" className="calificaciones-consulta__close" onClick={cerrarDetalle} aria-label="Cerrar detalle">
              <IconoLucide icon={X} size={18} />
            </button>
          </div>
          <div className="calificaciones-consulta__detail-score">
            <span>Calificación final</span>
            <strong>{mostrarNota(notaFinalCurso(filaSeleccionada))}</strong>
          </div>
          <nav className="calificaciones-consulta__detail-nav" aria-label="Secciones del detalle académico">
            {([
              ['resumen', 'Resumen', 'info'], ['primer', 'Primer Parcial', 'evaluaciones'],
              ['segundo', 'Segundo Parcial', 'calificar'], ['global', 'Global y bono', 'publicar'],
              ['libro', 'Libro completo', 'periodos']
            ] as const).map(([id, label, icono]) => (
              <button key={id} type="button" aria-pressed={seccionDetalle === id} className={seccionDetalle === id ? 'is-active' : ''} onClick={() => setSeccionDetalle(id)}>
                <Icono nombre={icono} size={17} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="calificaciones-consulta__detail-panel" key={seccionDetalle}>
          {seccionDetalle === 'resumen' && <>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Parcial 1</dt><dd>{mostrarNota(filaSeleccionada.parcial1)}</dd></div>
              <div><dt>Parcial 2</dt><dd>{mostrarNota(filaSeleccionada.parcial2)}</dd></div>
              <div><dt>Global</dt><dd>{mostrarNota(filaSeleccionada.global)}</dd></div>
              <div><dt>Bono extracurricular aplicado</dt><dd>{mostrarNota(filaSeleccionada.bonoExtracurricular ?? '')}</dd></div>
              <div><dt>Final del curso</dt><dd>{mostrarNota(filaSeleccionada.calificacionFinalCurso || filaSeleccionada.final)}</dd></div>
              {filaSeleccionada.extraDisponible && <div><dt>Final para acta</dt><dd>{mostrarNota(filaSeleccionada.calificacionFinalCursoActa ?? '')}</dd></div>}
              <div><dt>Estado</dt><dd><span className={`calificaciones-consulta__status ${tieneCalificacion(filaSeleccionada) ? 'is-complete' : 'is-pending'}`}>{tieneCalificacion(filaSeleccionada) ? 'Con calificación' : 'Sin calificación'}</span></dd></div>
            </dl>
            {filaSeleccionada.extraDisponible && (
              <section aria-label="Solicitud de Extra" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--warning">
                <h5><Icono nombre="alerta" size={18} /> Solicitud de Extra</h5>
                <p className="nota">La elegibilidad usa la final del curso antes del redondeo: debe ser menor que 6. La solicitud solo se registra cuando el docente la marca.</p>
                <label className="campo"><input type="checkbox" checked={filaSeleccionada.solicitaExtra === true} disabled={guardando !== null} onChange={(event) => void guardarSolicitudExtra(event.target.checked)} /><span>El docente confirma que el alumno solicita presentar Extra</span></label>
                {filaSeleccionada.solicitaExtra && <div aria-label="Extra activado" role="group">
                  <p role="status">Solicitud registrada por el docente. Apartado Extra activado.</p>
                  {(filaSeleccionada.resultadosExtraordinarios ?? []).map((resultado) => <article key={`${resultado.claseRegistro ?? 'interno'}-${resultado.folio}`} aria-label={`Resultado Extra folio ${resultado.folio}`}>
                    <h6>Resultado extraordinario · {resultado.claseRegistro === 'externo' ? 'externo' : 'referencia'}</h6>
                    <p>Calificación {mostrarNota(resultado.calificacionSobre5)} / 5 · equivalente {mostrarNota(resultado.calificacionSobre10)} / 10 · {resultado.estadoAprobatorio}</p>
                    {resultado.claseRegistro === 'externo' ? <p>{resultado.loteId ? `Lote ${resultado.loteId} · ` : 'Lote sin verificar · '}folio {resultado.folio} · archivo {resultado.fuenteArchivo}</p> : <p>Lote {resultado.loteId} · folio {resultado.folio} · examen {resultado.examenGeneradoId}</p>}
                    {resultado.documentoSha256 && <p className="calificaciones-extra__sha256">SHA-256: {resultado.documentoSha256}</p>}{resultado.origen && <p>Origen: {resultado.origen}</p>}
                  </article>)}
                  {!(filaSeleccionada.resultadosExtraordinarios ?? []).some((resultado) => resultado.claseRegistro === 'externo') && <div role="group" aria-label="Registrar resultado de examen Extra externo" className="calificaciones-consulta__physical-grades">
                    <h6>Registrar examen Extra externo</h6><p className="nota">Registra la evidencia de un examen que no pertenece a un lote generado en EvaluaPro. No inventes el lote; déjalo vacío si la hoja no lo muestra.</p>
                    <div className="calificaciones-consulta__manual-editors">
                      <div className="calificaciones-consulta__manual-field">
                        <label className="campo" htmlFor={idsResultadoExtraExterno.folio}><span>Folio visible (obligatorio)</span><input id={idsResultadoExtraExterno.folio} required value={resultadoExtraExterno.folio} aria-invalid={erroresResultadoExtraExterno.folio ? 'true' : undefined} aria-describedby={erroresResultadoExtraExterno.folio ? `${idsResultadoExtraExterno.folio}-error` : undefined} onChange={(event) => actualizarCampoResultadoExtraExterno('folio', event.target.value)} /></label>
                        {erroresResultadoExtraExterno.folio && <small id={`${idsResultadoExtraExterno.folio}-error`} className="ayuda error">{erroresResultadoExtraExterno.folio}</small>}
                      </div>
                      <div className="calificaciones-consulta__manual-field">
                        <label className="campo"><span>Lote (opcional)</span><input value={resultadoExtraExterno.loteId} onChange={(event) => actualizarCampoResultadoExtraExterno('loteId', event.target.value)} /></label>
                      </div>
                      <div className="calificaciones-consulta__manual-field is-wide">
                        <label className="campo" htmlFor={idsResultadoExtraExterno.fuenteArchivo}><span>PDF fuente local (obligatorio)</span><input id={idsResultadoExtraExterno.fuenteArchivo} type="file" required accept="application/pdf,.pdf" aria-invalid={erroresResultadoExtraExterno.fuenteArchivo ? 'true' : undefined} aria-describedby={`${idsResultadoExtraExterno.fuenteArchivo}-ayuda${erroresResultadoExtraExterno.fuenteArchivo ? ` ${idsResultadoExtraExterno.fuenteArchivo}-error` : ''}`} disabled={calculandoHashExtra || guardando !== null} onChange={(event) => void seleccionarPdfExtra(event.target.files?.[0])} /></label>
                        <p id={`${idsResultadoExtraExterno.fuenteArchivo}-ayuda`} className="nota">El PDF se lee en este navegador para obtener el nombre y el SHA-256; no se sube ni se guarda otra copia.</p>
                        {erroresResultadoExtraExterno.fuenteArchivo && <small id={`${idsResultadoExtraExterno.fuenteArchivo}-error`} className="ayuda error">{erroresResultadoExtraExterno.fuenteArchivo}</small>}
                        {resultadoExtraExterno.fuenteArchivo && <p>Archivo: {resultadoExtraExterno.fuenteArchivo}{calculandoHashExtra ? ' · calculando SHA-256…' : ''}</p>}
                        {resultadoExtraExterno.documentoSha256 && <p className="calificaciones-extra__sha256">SHA-256 calculado en este dispositivo: {resultadoExtraExterno.documentoSha256}</p>}
                      </div>
                      <div className="calificaciones-consulta__manual-field">
                        <label className="campo" htmlFor={idsResultadoExtraExterno.aciertos}><span>Aciertos (obligatorio)</span><input id={idsResultadoExtraExterno.aciertos} type="number" min="0" step="1" required value={resultadoExtraExterno.aciertos} aria-invalid={erroresResultadoExtraExterno.aciertos ? 'true' : undefined} aria-describedby={`${idsResultadoExtraExterno.aciertos}-ayuda${erroresResultadoExtraExterno.aciertos ? ` ${idsResultadoExtraExterno.aciertos}-error` : ''}`} onChange={(event) => actualizarCampoResultadoExtraExterno('aciertos', event.target.value)} /></label>
                        <p id={`${idsResultadoExtraExterno.aciertos}-ayuda`} className="nota">Escribe un número entero; captura 0 si no hubo respuestas correctas.</p>
                        {erroresResultadoExtraExterno.aciertos && <small id={`${idsResultadoExtraExterno.aciertos}-error`} className="ayuda error">{erroresResultadoExtraExterno.aciertos}</small>}
                      </div>
                      <div className="calificaciones-consulta__manual-field">
                        <label className="campo" htmlFor={idsResultadoExtraExterno.totalReactivos}><span>Reactivos evaluables (obligatorio)</span><input id={idsResultadoExtraExterno.totalReactivos} type="number" min="1" step="1" required value={resultadoExtraExterno.totalReactivos} aria-invalid={erroresResultadoExtraExterno.totalReactivos ? 'true' : undefined} aria-describedby={`${idsResultadoExtraExterno.totalReactivos}-ayuda${erroresResultadoExtraExterno.totalReactivos ? ` ${idsResultadoExtraExterno.totalReactivos}-error` : ''}`} onChange={(event) => actualizarCampoResultadoExtraExterno('totalReactivos', event.target.value)} /></label>
                        <p id={`${idsResultadoExtraExterno.totalReactivos}-ayuda`} className="nota">Cantidad de reactivos incluidos en la evaluación, mínimo 1.</p>
                        {erroresResultadoExtraExterno.totalReactivos && <small id={`${idsResultadoExtraExterno.totalReactivos}-error`} className="ayuda error">{erroresResultadoExtraExterno.totalReactivos}</small>}
                      </div>
                      <div className="calificaciones-consulta__manual-field is-wide">
                        <label className="campo" htmlFor={idsResultadoExtraExterno.criteriosAplicados}><span>Criterios aplicados (obligatorio)</span><textarea id={idsResultadoExtraExterno.criteriosAplicados} required value={resultadoExtraExterno.criteriosAplicados} aria-invalid={erroresResultadoExtraExterno.criteriosAplicados ? 'true' : undefined} aria-describedby={`${idsResultadoExtraExterno.criteriosAplicados}-ayuda${erroresResultadoExtraExterno.criteriosAplicados ? ` ${idsResultadoExtraExterno.criteriosAplicados}-error` : ''}`} onChange={(event) => actualizarCampoResultadoExtraExterno('criteriosAplicados', event.target.value)} /></label>
                        <p id={`${idsResultadoExtraExterno.criteriosAplicados}-ayuda`} className="nota">Describe cómo se revisó el examen (mínimo 12 caracteres).</p>
                        {erroresResultadoExtraExterno.criteriosAplicados && <small id={`${idsResultadoExtraExterno.criteriosAplicados}-error`} className="ayuda error">{erroresResultadoExtraExterno.criteriosAplicados}</small>}
                      </div>
                    </div>
                    <Boton type="button" variante="secundario" disabled={guardando !== null || calculandoHashExtra} onClick={() => void guardarResultadoExtraExterno()}>{guardando === 'resultadoExtra' ? 'Registrando…' : calculandoHashExtra ? 'Validando PDF…' : 'Registrar resultado externo'}</Boton>
                  </div>}
                </div>}{errorGuardado && <InlineMensaje tipo="error">{errorGuardado}</InlineMensaje>}
              </section>
            )}
            {texto(filaSeleccionada.observaciones) && <p className="calificaciones-consulta__detail-note"><strong>Observaciones:</strong> {filaSeleccionada.observaciones}</p>}
            <div className="calificaciones-consulta__detail-actions"><Boton type="button" variante="primario" disabled={!texto(filaSeleccionada.alumnoId)} onClick={() => onSeleccionarAlumno(texto(filaSeleccionada.alumnoId))}>Abrir revisión manual</Boton><Boton type="button" variante="secundario" onClick={cerrarDetalle}>Seguir consultando</Boton></div>
          </>}
          {seccionDetalle === 'primer' && <section aria-label="Columnas físicas del Primer Parcial" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--primary">
            <h5>Lista física · Primer Parcial</h5>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Examen 1er Parcial manual · 0–5</dt><dd>{mostrarNota(filaSeleccionada.examenPrimerParcialLista)} <small>captura canónica</small></dd></div>
              <div><dt>Examen 1er Parcial automático · referencia</dt><dd>{mostrarNota(filaSeleccionada.examenPrimerParcialAutomatico)} <small>no sustituye la captura manual</small></dd></div>
            </dl>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Examen 1er Parcial · 0–5</span><input type="number" min="0" max="5" step="0.01" value={borradores.examen1} onChange={(event) => setBorradores((prev) => ({ ...prev, examen1: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Exámen 1er Parcial')}>{guardando === 'examen1' ? 'Guardando…' : 'Guardar examen'}</Boton>
            </div>
            {errorGuardado && <InlineMensaje tipo="error">{errorGuardado}</InlineMensaje>}
            <div className="calificaciones-consulta__detail-actions">
              <Boton type="button" variante="secundario" disabled={cargandoHistorialCapturas} cargando={cargandoHistorialCapturas} onClick={() => {
                const cargar = async () => {
                  setCargandoHistorialCapturas(true);
                  setErrorHistorialCapturas('');
                  try {
                    const query = new URLSearchParams();
                    query.set('periodoId', periodoId);
                    query.set('alumnoId', filaSeleccionada.alumnoId ?? '');
                    query.set('componente', 'Exámen 1er Parcial');
                    query.set('limite', '100');
                    const respuesta = await clienteApi.obtener<{ eventos?: typeof historialCapturas }>(`/analiticas/lista-academica/calificaciones/historial?${query}`);
                    setHistorialCapturas(respuesta.eventos ?? []);
                  } catch (error) {
                    setErrorHistorialCapturas(mensajeDeError(error, 'No se pudo consultar el historial de captura.'));
                  } finally {
                    setCargandoHistorialCapturas(false);
                  }
                };
                void cargar();
              }}>Consultar historial de captura</Boton>
            </div>
            {errorHistorialCapturas && <InlineMensaje tipo="error">{errorHistorialCapturas}</InlineMensaje>}
            {historialCapturas.length > 0 && <ol aria-label="Historial de captura del examen del primer parcial">
              {historialCapturas.map((evento) => <li key={evento.id}>
                {evento.valorAnterior === null ? 'Captura inicial' : `Cambio desde ${evento.valorAnterior ?? 'sin dato'}`} → {evento.valorNuevo ?? 'sin dato'} / {evento.version ?? '—'} · {evento.canalCaptura} · {new Date(evento.createdAt).toLocaleString('es-MX')}
              </li>)}
            </ol>}
          </section>}
          {seccionDetalle === 'segundo' && <section aria-label="Columnas físicas del Segundo Parcial" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--secondary">
            <h5>Lista física · Segundo Parcial</h5>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Tareas y Ejercicios 2do Parcial</dt><dd>{mostrarNota(filaSeleccionada.tareasYEjercicios2doParcial)} <small>({filaSeleccionada.tareasPuntosObtenidos || '—'} / {filaSeleccionada.tareasPuntosPosibles || '—'} puntos)</small></dd></div>
              <div><dt>Evaluación Continua 2do Parcial</dt><dd>{mostrarNota(filaSeleccionada.evaluacionContinua2doParcial)} <small>escala 0–5</small></dd></div>
              <div><dt>Examen 2do Parcial automático · referencia</dt><dd>{mostrarNota(filaSeleccionada.examen2doParcialAutomatico)} <small>no sustituye la captura manual</small></dd></div>
              <div><dt>Calificación Segundo Parcial</dt><dd>{mostrarNota(filaSeleccionada.calificacionSegundoParcial)}</dd></div>
            </dl>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Práctica 2do Parcial · 0–10</span><input type="number" min="0" max="10" step="0.01" value={borradores.practica} onChange={(event) => setBorradores((prev) => ({ ...prev, practica: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Practica 2do Parcial')}>{guardando === 'practica' ? 'Guardando…' : 'Guardar práctica'}</Boton>
              <label className="campo"><span>Examen 2do Parcial · 0–5.25</span><input type="number" min="0" max="5.25" step="0.01" value={borradores.examen} onChange={(event) => setBorradores((prev) => ({ ...prev, examen: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Exámen 2do Parcial')}>{guardando === 'examen' ? 'Guardando…' : 'Guardar examen'}</Boton>
            </div>
            <p className="nota">El bono extracurricular se registra en una sola columna y se distribuye por fórmula. Prioridad: Global (tercer parcial), segundo parcial y primer parcial; dentro de cada parcial, evaluación continua primero y examen después. Ningún parcial supera 10.</p>
            {errorGuardado && <InlineMensaje tipo="error">{errorGuardado}</InlineMensaje>}
          </section>}
          {seccionDetalle === 'global' && <>
          <section aria-label="Bono extracurricular" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--warning">
            <h5>Bono extracurricular</h5>
            <p className="nota">Captura el importe documentado (0–1). Se calcula primero una vista previa; solo se guarda al pulsar “Confirmar y guardar bono”. Si la calificación final base ya es 10, no se aplica.</p>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Bono solicitado · 0–1</span><input type="number" min="0" max="1" step="0.01" value={borradorBono} onChange={(event) => { setBorradorBono(event.target.value); setVistaPreviaBono(null); }} /></label>
              <Boton type="button" variante="secundario" disabled={procesandoBono || guardando !== null} onClick={() => void previsualizarBono()}>{procesandoBono && !vistaPreviaBono ? 'Calculando…' : 'Previsualizar bono'}</Boton>
            </div>
            {vistaPreviaBono && (
              <div className="calificaciones-consulta__bonus-preview" aria-live="polite">
                <p>Vista previa: aplicado {mostrarNota(vistaPreviaBono.bonoAplicado)} de {mostrarNota(vistaPreviaBono.bonoSolicitado)}. Parciales: P1 {mostrarNota(vistaPreviaBono.parcial1)}, P2 {mostrarNota(vistaPreviaBono.parcial2)}, Global {mostrarNota(vistaPreviaBono.parcial3)}. Final del curso {mostrarNota(vistaPreviaBono.calificacionFinalCurso)}.</p>
                <p>Distribución por prioridad:</p>
                {(() => {
                  const destinos = COMPONENTES_BONO
                    .map(({ clave, etiqueta }) => ({ etiqueta, puntos: vistaPreviaBono.bonoDistribucion?.[clave] ?? 0 }))
                    .filter(({ puntos }) => puntos > 0);
                  return destinos.length > 0
                    ? <ul>{destinos.map(({ etiqueta, puntos }) => <li key={etiqueta}>{etiqueta}: +{mostrarNota(String(puntos))}</li>)}</ul>
                    : <p>Sin puntos asignados: los componentes no tienen espacio disponible o faltan calificaciones.</p>;
                })()}
                <Boton type="button" variante="primario" disabled={procesandoBono || !vistaPreviaBono.requiereConfirmacion} onClick={() => void confirmarBono()}>{procesandoBono ? 'Guardando…' : 'Confirmar y guardar bono'}</Boton>
              </div>
            )}
            {errorGuardado && <InlineMensaje tipo="error">{errorGuardado}</InlineMensaje>}
          </section>
          <section aria-label="Columnas físicas del Tercer Parcial" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--success">
            <h5>Lista física · Tercer Parcial</h5>
            <p className="nota">Los dos componentes físicos se expresan en escala 0–5; su suma está limitada a 10.</p>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Examen Global · componente fuente 0–10</dt><dd>{mostrarNota(filaSeleccionada.examenGlobalComponente)}</dd></div>
              <div><dt>Examen Global · lista física 0–5</dt><dd>{mostrarNota(filaSeleccionada.examenGlobalLista)}</dd></div>
              <div><dt>Evaluación Continua 3er Parcial · 0–5</dt><dd>{mostrarNota(filaSeleccionada.continuaTercerParcialLista)}</dd></div>
              <div><dt>Calificación Tercer Parcial · máximo 10</dt><dd>{mostrarNota(filaSeleccionada.calificacionTercerParcial)}</dd></div>
            </dl>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Examen Global manual · 0–5</span><input type="number" min="0" max="5" step="0.01" value={borradores.global} onChange={(event) => setBorradores((prev) => ({ ...prev, global: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Exámen Global')}>{guardando === 'global' ? 'Guardando…' : 'Guardar Global'}</Boton>
            </div>
          </section>
          </>}
          {seccionDetalle === 'libro' && <section aria-label="Lista Excel · columnas AJ a BB" className="calificaciones-consulta__physical-grades calificaciones-consulta__accent-panel--secondary">
            <h5><Icono nombre="periodos" size={18} /> Lista Excel · columnas AJ–BB</h5>
            <p className="nota">Primero se muestran los valores disponibles. Las columnas sin fuente se agrupan aparte; “Sin dato” no equivale a cero. Las columnas genéricas sin significado no se presentan como datos académicos.</p>
            {camposLibroConDato.length > 0
              ? <dl className="calificaciones-consulta__detail-grid">{camposLibroConDato.map(([columna, nombre, valor, escala]) => <div key={columna}><dt>{columna} · {nombre}</dt><dd>{mostrarNota(valor)} <small>{escala}</small></dd></div>)}</dl>
              : <p className="nota" role="status">No hay valores registrados en las columnas del libro para este alumno.</p>}
            {camposLibroSinDato.length > 0 && (
              <details className="calificaciones-consulta__book-missing">
                <summary>Columnas sin dato ({camposLibroSinDato.length})</summary>
                <dl className="calificaciones-consulta__detail-grid">{camposLibroSinDato.map(([columna, nombre, , escala]) => <div key={columna}><dt>{columna} · {nombre}</dt><dd>Sin dato <small>{escala}</small></dd></div>)}</dl>
              </details>
            )}
          </section>}
          </div>
        </aside>
      )}
    </section>
  );
}
