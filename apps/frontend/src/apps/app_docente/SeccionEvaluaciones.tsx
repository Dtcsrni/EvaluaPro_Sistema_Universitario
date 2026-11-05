/**
 * SeccionEvaluaciones
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import {
  ChartNoAxesColumnIncreasing,
  FileText,
  IconoLucide,
  UsersRound
} from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { GuiaEvaluacionesVisual } from './GuiaEvaluacionesVisual';
import { accionToastSesionParaError, ErrorRemoto } from '../../servicios_api/clienteComun';
import type { Alumno, Periodo } from './tipos';

type TabEvaluaciones = 'politica' | 'evidencias' | 'examenes' | 'resumen';

type Politica = {
  id?: string;
  codigo: string;
  version: number;
  nombre: string;
  descripcion?: string;
  familia: 'sv_excel_contract' | 'lisc_encuadre';
  parametros?: Record<string, unknown>;
  activa?: boolean;
  sistema?: boolean;
};

type ResumenEvaluacion = {
  politicaCodigo?: string;
  politicaVersion?: number;
  continuaPorCorte?: { c1?: number; c2?: number; c3?: number };
  examenesPorCorte?: { parcial1?: number; parcial2?: number; global?: number };
  bloqueContinuaDecimal?: number;
  bloqueExamenesDecimal?: number;
  finalDecimal?: number;
  finalRedondeada?: number;
  estado?: string;
  faltantes?: string[];
};

type EvidenciaEvaluacion = {
  id: string;
  titulo: string;
  calificacionDecimal: number | null;
  ponderacion: number;
  corte: number | null;
  fuente: 'manual' | 'classroom';
  archivadaEn?: string | null;
  updatedAt: string;
};

function mensajeErrorCambioEvaluaciones(error: unknown, accion: 'archivar' | 'restaurar', registro: 'la política' | 'la evidencia'): string {
  if (error instanceof ErrorRemoto) {
    const status = error.detalle.status;
    if (status === 401) return 'Tu sesión venció. Cierra sesión y vuelve a ingresar.';
    if (status === 403) return `No tienes permiso para ${accion} ${registro}.`;
    if (status === 404) return `${registro[0]?.toUpperCase()}${registro.slice(1)} ya no está disponible. Actualiza la vista.`;
    if (status === 409) return `${registro[0]?.toUpperCase()}${registro.slice(1)} cambió en otra operación. Actualiza la vista antes de volver a intentarlo.`;
  }

  return `No se pudo confirmar si se logró ${accion} ${registro}. Actualiza la vista y verifica su estado antes de volver a intentarlo.`;
}

function notificarErrorCambioEvaluaciones(error: unknown, accion: 'archivar' | 'restaurar', registro: 'la política' | 'la evidencia') {
  const action = accionToastSesionParaError(error, 'docente');
  emitToast({
    level: 'error',
    title: `No se pudo ${accion} ${registro}`,
    message: mensajeErrorCambioEvaluaciones(error, accion, registro),
    ...(action ? { action } : {})
  });
}

type ExamenGeneradoFuente = {
  id?: string;
  _id?: string;
  folio: string;
  periodoId?: string | null;
  alumnoId?: string | null;
  estado?: string;
  retentionStatus?: string;
  artifactsPurgedAt?: string | null;
};

function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

const POLITICAS_FALLBACK: Politica[] = [
  { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026', familia: 'lisc_encuadre', sistema: true },
  { codigo: 'POLICY_SV_EXCEL_2026', version: 1, nombre: 'SV Excel 2026', familia: 'sv_excel_contract', sistema: true }
];

const TABS_EVALUACIONES: Array<{ id: TabEvaluaciones; etiqueta: string }> = [
  { id: 'politica', etiqueta: 'Política' },
  { id: 'evidencias', etiqueta: 'Evidencias' },
  { id: 'examenes', etiqueta: 'Exámenes' },
  { id: 'resumen', etiqueta: 'Resumen' }
];

function formatearNumeroResumen(valor: unknown, decimales: number): string {
  if (typeof valor !== 'number' && typeof valor !== 'string') return '—';
  if (typeof valor === 'string' && valor.trim() === '') return '—';
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—';
}

function etiquetaFaltanteResumen(faltante: string): string {
  const faltanteExamen = faltante.match(/^examen\.(parcial1|parcial2|global)\.(componente|teorico|practica)$/);
  if (faltanteExamen) {
    const [, corteCodigo, componente] = faltanteExamen;
    const corte = corteCodigo === 'parcial1' ? 'Parcial 1' : corteCodigo === 'parcial2' ? 'Parcial 2' : 'Global';
    if (componente === 'componente') return `Captura los componentes del examen ${corte}.`;
    if (componente === 'teorico') return `Captura la calificación teórica del examen ${corte}.`;
    return `Registra al menos una práctica para el examen ${corte}.`;
  }

  const faltanteContinua = faltante.match(/^continua\.(c1|c2|c3)\.minima$/);
  if (faltanteContinua) return `La evaluación continua de ${faltanteContinua[1].toUpperCase()} no alcanza el mínimo configurado.`;
  return faltante;
}

export function SeccionEvaluaciones(params: {
  periodos: Periodo[];
  alumnos: Alumno[];
  puedeGestionar: boolean;
  cargandoPeriodos?: boolean;
  errorPeriodos?: boolean;
  onReintentarPeriodos?: () => void;
}) {
  const {
    periodos,
    alumnos,
    puedeGestionar,
    cargandoPeriodos = false,
    errorPeriodos = false,
    onReintentarPeriodos
  } = params;

  const [tabActiva, setTabActiva] = useState<TabEvaluaciones>('politica');
  const [tabEnFoco, setTabEnFoco] = useState(0);
  const [periodoId, setPeriodoId] = useState<string>('');
  const [alumnoId, setAlumnoId] = useState<string>('');
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [cargandoContexto, setCargandoContexto] = useState(false);
  const [errorContexto, setErrorContexto] = useState('');
  const [politicaCodigo, setPoliticaCodigo] = useState('POLICY_LISC_ENCUADRE_2026');
  const [politicaVersion, setPoliticaVersion] = useState('1');
  const solicitudesPolitica = useRef(new Map<string, string>());
  const solicitudesArchivoPolitica = useRef(new Map<string, string>());
  const secuenciaContexto = useRef(0);
  const secuenciaEvidencias = useRef(0);
  const secuenciaResumen = useRef(0);
  const [codigoEditor, setCodigoEditor] = useState('POLICY_PERSONALIZADA');
  const [nombreEditor, setNombreEditor] = useState('Política personalizada');
  const [descripcionEditor, setDescripcionEditor] = useState('');
  const [familiaEditor, setFamiliaEditor] = useState<'sv_excel_contract' | 'lisc_encuadre'>('lisc_encuadre');
  const [parametrosEditor, setParametrosEditor] = useState('{\n  "pesosGlobales": { "continua": 0.5, "examenes": 0.5 },\n  "pesosExamenes": { "parcial1": 0.2, "parcial2": 0.2, "global": 0.6 },\n  "pesosContinuaCortes": { "c1": 0.2, "c2": 0.2, "c3": 0.6 },\n  "pesosComponentesExamen": { "teorico": 0.6, "practicas": 0.4 },\n  "umbralAprobacion": 6\n}');
  const [resumen, setResumen] = useState<ResumenEvaluacion | null>(null);
  const [estadoResumen, setEstadoResumen] = useState<'sin-consultar' | 'consultando' | 'sin-datos' | 'error' | 'listo'>('sin-consultar');
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [evidencias, setEvidencias] = useState<EvidenciaEvaluacion[]>([]);
  const [cargandoEvidencias, setCargandoEvidencias] = useState(false);
  const [errorEvidencias, setErrorEvidencias] = useState('');
  const [evidenciaEditando, setEvidenciaEditando] = useState<EvidenciaEvaluacion | null>(null);
  const [intentoGuardarEvidencia, setIntentoGuardarEvidencia] = useState(false);
  const [evidenciaCamposTocados, setEvidenciaCamposTocados] = useState({ calificacion: false, ponderacion: false });
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<string>('');
  const [erroresGuardado, setErroresGuardado] = useState({ politica: '', definicionPolitica: '', evidencia: '', examen: '' });
  const [errorParametrosPolitica, setErrorParametrosPolitica] = useState('');

  function limpiarErrorGuardado(campo: keyof typeof erroresGuardado) {
    setErroresGuardado((errores) => ({ ...errores, [campo]: '' }));
  }

  function limpiarCapturaEvidencia() {
    setEvidenciaEditando(null);
    setEvidenciaTitulo('');
    setEvidenciaCalificacion('');
    setEvidenciaPonderacion('');
    setEvidenciaCorte('1');
    setEvidenciaMotivo('Corrección manual en EvaluaPro');
    setIntentoGuardarEvidencia(false);
    setEvidenciaCamposTocados({ calificacion: false, ponderacion: false });
  }

  function cambiarPeriodo(periodoIdNuevo: string) {
    setPeriodoId(periodoIdNuevo);
    setAlumnoId('');
    limpiarCapturaEvidencia();
  }

  function cambiarAlumno(alumnoIdNuevo: string) {
    setAlumnoId(alumnoIdNuevo);
    limpiarCapturaEvidencia();
  }

  const [evidenciaTitulo, setEvidenciaTitulo] = useState('');
  const [evidenciaCalificacion, setEvidenciaCalificacion] = useState('');
  const [evidenciaPonderacion, setEvidenciaPonderacion] = useState('');
  const [evidenciaCorte, setEvidenciaCorte] = useState('1');
  const [evidenciaMotivo, setEvidenciaMotivo] = useState('Corrección manual en EvaluaPro');

  const [corteExamen, setCorteExamen] = useState<'parcial1' | 'parcial2' | 'global'>('parcial1');
  const [teorico, setTeorico] = useState('');
  const [teoricoTocado, setTeoricoTocado] = useState(false);
  const [practicasCsv, setPracticasCsv] = useState('');
  const [folioExamenFuente, setFolioExamenFuente] = useState('');
  const [examenesFuente, setExamenesFuente] = useState<ExamenGeneradoFuente[]>([]);
  const [examenFuenteId, setExamenFuenteId] = useState('');
  const [examenFuenteSinCoincidencias, setExamenFuenteSinCoincidencias] = useState(false);
  const [buscandoFuente, setBuscandoFuente] = useState(false);
  const calificacionEvidenciaNumero = evidenciaCalificacion.trim() === '' ? Number.NaN : Number(evidenciaCalificacion);
  const ponderacionEvidenciaNumero = evidenciaPonderacion.trim() === '' ? Number.NaN : Number(evidenciaPonderacion);
  const errorCalificacionEvidencia = !Number.isFinite(calificacionEvidenciaNumero) || calificacionEvidenciaNumero < 0 || calificacionEvidenciaNumero > 10
    ? 'Ingresa una calificación de 0 a 10. El campo no puede quedar vacío.'
    : '';
  const errorPonderacionEvidencia = !Number.isFinite(ponderacionEvidenciaNumero) || ponderacionEvidenciaNumero < 0 || ponderacionEvidenciaNumero > 10
    ? 'Ingresa una ponderación de 0 a 10. El campo no puede quedar vacío.'
    : '';
  const mostrarErrorCalificacionEvidencia = Boolean(errorCalificacionEvidencia && (intentoGuardarEvidencia || evidenciaCamposTocados.calificacion));
  const mostrarErrorPonderacionEvidencia = Boolean(errorPonderacionEvidencia && (intentoGuardarEvidencia || evidenciaCamposTocados.ponderacion));
  const errorTituloEvidencia = evidenciaTitulo.trim().length > 0 && evidenciaTitulo.trim().length < 3
    ? 'Escribe al menos 3 caracteres o deja el campo vacío para usar «Evidencia».'
    : '';
  const errorMotivoEvidencia = evidenciaEditando && (evidenciaMotivo.trim().length < 3 || evidenciaMotivo.trim().length > 400)
    ? 'El motivo debe contener entre 3 y 400 caracteres.'
    : '';
  const teoricoExamenNumero = teorico.trim() === '' ? Number.NaN : Number(teorico);
  const errorTeoricoExamen = !Number.isFinite(teoricoExamenNumero) || teoricoExamenNumero < 0 || teoricoExamenNumero > 10
    ? 'Ingresa una calificación teórica de 0 a 10.'
    : '';
  const practicasTokens = practicasCsv.trim() === '' ? [] : practicasCsv.split(',').map((item) => item.trim());
  const practicasExamenNumeros = practicasTokens.map((item) => Number(item));
  const errorPracticasExamen = practicasTokens.length > 20
    ? 'Puedes registrar hasta 20 prácticas.'
    : practicasTokens.some((item) => item === '')
      ? 'Completa cada calificación separada por coma o elimina la coma sobrante.'
      : practicasExamenNumeros.some((item) => !Number.isFinite(item) || item < 0 || item > 10)
        ? 'Cada práctica debe tener una calificación de 0 a 10.'
        : '';

  useEffect(() => {
    secuenciaResumen.current += 1;
    setResumen(null);
    setEstadoResumen('sin-consultar');
    setCargandoResumen(false);
    setTeorico('');
    setTeoricoTocado(false);
    setPracticasCsv('');
    setFolioExamenFuente('');
    setExamenesFuente([]);
    setExamenFuenteId('');
    setExamenFuenteSinCoincidencias(false);
  }, [periodoId, alumnoId]);

  const alumnosDelPeriodo = useMemo(
    () => periodoId ? alumnos.filter((item) => String(item.periodoId) === String(periodoId)) : [],
    [alumnos, periodoId]
  );

  const cargarContexto = useCallback(async () => {
    const secuenciaActual = ++secuenciaContexto.current;
    if (!periodoId) {
      setPoliticas([]);
      setPoliticaCodigo('POLICY_LISC_ENCUADRE_2026');
      setPoliticaVersion('1');
      setErrorContexto('');
      setCargandoContexto(false);
      return;
    }

    setCargandoContexto(true);
    setErrorContexto('');
    setPoliticas([]);
    setPoliticaCodigo('POLICY_LISC_ENCUADRE_2026');
    setPoliticaVersion('1');
    try {
      const respuesta = await clienteApi.obtener<{
        politicas?: Politica[];
        configuracion?: { politicaCodigo?: string; politicaVersion?: number } | null;
      }>(`/evaluaciones/v2/contexto?periodoId=${encodeURIComponent(periodoId)}`);
      if (secuenciaActual !== secuenciaContexto.current) return;

      setPoliticas(Array.isArray(respuesta.politicas) ? respuesta.politicas : []);
      if (respuesta.configuracion?.politicaCodigo) setPoliticaCodigo(respuesta.configuracion.politicaCodigo);
      if (Number.isFinite(Number(respuesta.configuracion?.politicaVersion))) {
        setPoliticaVersion(String(respuesta.configuracion?.politicaVersion));
      }
    } catch {
      if (secuenciaActual !== secuenciaContexto.current) return;
      setPoliticas([]);
      setErrorContexto('No se pudo cargar la configuración de evaluación de este periodo. Reintenta antes de guardar.');
    } finally {
      if (secuenciaActual === secuenciaContexto.current) setCargandoContexto(false);
    }
  }, [periodoId]);

  const cargarEvidencias = useCallback(async () => {
    const secuenciaActual = ++secuenciaEvidencias.current;
    if (!periodoId || !alumnoId) {
      setEvidencias([]);
      setErrorEvidencias('');
      setCargandoEvidencias(false);
      return;
    }
    setCargandoEvidencias(true);
    setErrorEvidencias('');
    try {
      const filas: EvidenciaEvaluacion[] = [];
      const cursores = new Set<string>();
      let cursor: string | undefined;
      do {
        const query = new URLSearchParams({ periodoId, alumnoId, incluirArchivadas: 'true', limite: '100' });
        if (cursor) query.set('cursor', cursor);
        const pagina = await clienteApi.obtener<{ evidencias?: EvidenciaEvaluacion[]; nextCursor?: string | null }>(
          `/evaluaciones/evidencias?${query}`
        );
        filas.push(...(pagina.evidencias ?? []));
        cursor = pagina.nextCursor || undefined;
        if (cursor && cursores.has(cursor)) throw new Error('La paginación de evidencias repitió un cursor');
        if (cursor) cursores.add(cursor);
      } while (cursor);
      if (secuenciaActual !== secuenciaEvidencias.current) return;
      setEvidencias(filas);
    } catch {
      if (secuenciaActual !== secuenciaEvidencias.current) return;
      setEvidencias([]);
      setErrorEvidencias('No se pudieron cargar las evidencias. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      if (secuenciaActual === secuenciaEvidencias.current) setCargandoEvidencias(false);
    }
  }, [periodoId, alumnoId]);

  useEffect(() => {
    if (!periodoId && periodos.length > 0) {
      setPeriodoId(String(periodos[0]?._id || ''));
    }
  }, [periodos, periodoId]);

  useEffect(() => {
    if (!periodoId) return;
    void cargarContexto();
  }, [cargarContexto, periodoId]);

  useEffect(() => {
    if (tabActiva !== 'evidencias') return;
    void cargarEvidencias();
  }, [cargarEvidencias, tabActiva]);

  

  async function guardarPoliticaV2() {
    if (!periodoId || !politicaSeleccionada || politicaVersionError) return;
    setCargando(true);
    setEstado('');
    limpiarErrorGuardado('politica');
    try {
      await clienteApi.enviar('/evaluaciones/v2/politica', {
        periodoId,
        politicaCodigo,
        politicaVersion: politicaVersionNumero
      });
      setEstado('Configuración guardada');
      await cargarContexto();
    } catch {
      setErroresGuardado((errores) => ({ ...errores, politica: 'No se pudo guardar la política. Revisa la conexión e inténtalo de nuevo.' }));
    } finally {
      setCargando(false);
    }
  }

  async function guardarDefinicionPolitica() {
    let parametros: Record<string, unknown>;
    try {
      const datosJson: unknown = JSON.parse(parametrosEditor);
      if (!datosJson || typeof datosJson !== 'object' || Array.isArray(datosJson)) {
        setErrorParametrosPolitica('Los parámetros deben ser un objeto JSON. Corrígelo antes de guardar.');
        return;
      }
      parametros = datosJson as Record<string, unknown>;
    } catch {
      setErrorParametrosPolitica('El formato JSON no es válido. Corrígelo antes de guardar.');
      return;
    }
    setErrorParametrosPolitica('');
    limpiarErrorGuardado('definicionPolitica');
    setCargando(true);
    try {
      const datos = {
        codigo: codigoEditor.trim(),
        nombre: nombreEditor.trim(),
        descripcion: descripcionEditor.trim(),
        familia: familiaEditor,
        parametros
      };
      const claveSolicitud = JSON.stringify(datos);
      const clientRequestId = solicitudesPolitica.current.get(claveSolicitud) ?? crypto.randomUUID();
      solicitudesPolitica.current.set(claveSolicitud, clientRequestId);
      const payload = { ...datos, clientRequestId };
      const historial = await clienteApi.obtener<{ politicas?: Politica[] }>(
        '/evaluaciones/politicas?incluirVersiones=true&incluirArchivadas=true'
      );
      const existe = (historial.politicas ?? []).some((item) => item.codigo === payload.codigo && !item.sistema);
      if (existe) await clienteApi.actualizar(`/evaluaciones/politicas/${encodeURIComponent(payload.codigo)}`, payload);
      else await clienteApi.enviar('/evaluaciones/politicas', payload);
      solicitudesPolitica.current.delete(claveSolicitud);
      emitToast({ level: 'ok', title: 'Evaluaciones', message: existe ? 'Nueva versión de política creada' : 'Política creada' });
      await cargarContexto();
    } catch {
      setErroresGuardado((errores) => ({
        ...errores,
        definicionPolitica: 'No se pudo guardar la política. Verifica código, nombre y parámetros; cada grupo de pesos debe sumar 1.'
      }));
    } finally {
      setCargando(false);
    }
  }

  async function archivarPoliticaSeleccionada() {
    const politica = politicas.find((item) => item.codigo === politicaCodigo);
    if (!politica || politica.sistema || !politica.activa) return;
    setCargando(true);
    try {
      const clientRequestId = solicitudesArchivoPolitica.current.get(politica.codigo) ?? crypto.randomUUID();
      solicitudesArchivoPolitica.current.set(politica.codigo, clientRequestId);
      await clienteApi.enviar(`/evaluaciones/politicas/${encodeURIComponent(politica.codigo)}/archivar`, {
        clientRequestId,
        motivo: 'Archivada desde la interfaz docente',
        confirmarEliminacion: true
      });
      solicitudesArchivoPolitica.current.delete(politica.codigo);
      emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Política archivada mediante una nueva versión' });
      await cargarContexto();
    } catch (error) {
      notificarErrorCambioEvaluaciones(error, 'archivar', 'la política');
    } finally {
      setCargando(false);
    }
  }

  async function guardarEvidenciaV2() {
    if (!periodoId || !alumnoId || errorTituloEvidencia || errorMotivoEvidencia || errorCalificacionEvidencia || errorPonderacionEvidencia) return;
    setCargando(true);
    limpiarErrorGuardado('evidencia');
    try {
      const payload = {
        periodoId,
        alumnoId,
        titulo: evidenciaTitulo.trim() || 'Evidencia',
        calificacionDecimal: numeroSeguro(evidenciaCalificacion),
        ponderacion: numeroSeguro(evidenciaPonderacion),
        corte: numeroSeguro(evidenciaCorte)
      };
      if (evidenciaEditando) {
        await clienteApi.actualizar(`/evaluaciones/evidencias/${encodeURIComponent(evidenciaEditando.id)}`, {
          ...payload,
          expectedUpdatedAt: evidenciaEditando.updatedAt,
          motivoCambio: evidenciaMotivo,
          confirmarEscritura: true
        });
        setEvidenciaEditando(null);
        emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Evidencia actualizada con auditoría' });
      } else {
        await clienteApi.enviar('/evaluaciones/v2/evidencias', payload);
        emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Evidencia guardada' });
      }
      await cargarEvidencias();
    } catch {
      setErroresGuardado((errores) => ({ ...errores, evidencia: 'No se pudo guardar la evidencia. Revisa los datos e inténtalo de nuevo.' }));
    } finally {
      setCargando(false);
    }
  }

  function editarEvidencia(evidencia: EvidenciaEvaluacion) {
    if (evidencia.fuente !== 'manual' || evidencia.archivadaEn) return;
    setIntentoGuardarEvidencia(false);
    setEvidenciaCamposTocados({ calificacion: false, ponderacion: false });
    setEvidenciaEditando(evidencia);
    setEvidenciaTitulo(evidencia.titulo);
    setEvidenciaCalificacion(String(evidencia.calificacionDecimal ?? 0));
    setEvidenciaPonderacion(String(evidencia.ponderacion));
    setEvidenciaCorte(String(evidencia.corte ?? 1));
  }

  async function archivarOrestaurarEvidencia(evidencia: EvidenciaEvaluacion) {
    if (evidencia.fuente !== 'manual') return;
    const accion = evidencia.archivadaEn ? 'restaurar' : 'archivar';
    setCargando(true);
    try {
      await clienteApi.enviar(`/evaluaciones/evidencias/${encodeURIComponent(evidencia.id)}/${accion}`, {
        motivo: evidenciaMotivo,
        confirmarEscritura: true
      });
      await cargarEvidencias();
      emitToast({ level: 'ok', title: 'Evaluaciones', message: evidencia.archivadaEn ? 'Evidencia restaurada' : 'Evidencia archivada' });
    } catch (error) {
      notificarErrorCambioEvaluaciones(error, accion, 'la evidencia');
    } finally {
      setCargando(false);
    }
  }

  async function guardarComponenteExamenV2() {
    if (!periodoId || !alumnoId || errorTeoricoExamen || errorPracticasExamen) return;
    setCargando(true);
    limpiarErrorGuardado('examen');
    try {
      await clienteApi.enviar('/evaluaciones/v2/examenes/componentes', {
        periodoId,
        alumnoId,
        corte: corteExamen,
        teoricoDecimal: teoricoExamenNumero,
        practicas: practicasExamenNumeros,
        ...(examenFuenteId ? { examenGeneradoId: examenFuenteId } : {})
      });
      emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Componente de examen guardado' });
    } catch {
      setErroresGuardado((errores) => ({ ...errores, examen: 'No se pudo guardar el componente del examen. Revisa los datos e inténtalo de nuevo.' }));
    } finally {
      setCargando(false);
    }
  }

  async function buscarExamenFuente() {
    if (!periodoId || !folioExamenFuente.trim()) return;
    setBuscandoFuente(true);
    setExamenFuenteSinCoincidencias(false);
    setExamenesFuente([]);
    setExamenFuenteId('');
    setEstado('Buscando el examen fuente…');
    try {
      const query = new URLSearchParams({
        periodoId,
        folio: folioExamenFuente.trim(),
        limite: '5'
      });
      const respuesta = await clienteApi.obtener<{ examenes?: ExamenGeneradoFuente[] }>(`/examenes/generados?${query}`);
      const elegibles = (Array.isArray(respuesta.examenes) ? respuesta.examenes : []).filter((examen) => {
        const id = String(examen.id ?? examen._id ?? '').trim();
        const relacionValida = !examen.alumnoId || String(examen.alumnoId) === alumnoId;
        return id && String(examen.periodoId) === periodoId && relacionValida && !examen.artifactsPurgedAt;
      });
      setExamenesFuente(elegibles);
      if (elegibles.length === 1) setExamenFuenteId(String(elegibles[0].id ?? elegibles[0]._id));
      if (elegibles.length === 0) {
        setExamenFuenteSinCoincidencias(true);
        setEstado('No se encontró un examen fuente vigente de este periodo y alumno. Puedes guardar la captura sin vínculo.');
      } else {
        setEstado('Examen fuente localizado. Confirma el folio antes de guardar.');
      }
    } catch {
      setEstado('No se pudo buscar el examen fuente. Reintenta la búsqueda o borra el folio para guardar sin vínculo.');
      setExamenFuenteSinCoincidencias(false);
      setExamenesFuente([]);
      setExamenFuenteId('');
    } finally {
      setBuscandoFuente(false);
    }
  }

  async function consultarResumenV2() {
    if (!periodoId || !alumnoId) return;
    const secuenciaActual = ++secuenciaResumen.current;
    setCargandoResumen(true);
    setEstadoResumen('consultando');
    try {
      const respuesta = await clienteApi.obtener<{ resumen?: ResumenEvaluacion }>(
        `/evaluaciones/v2/alumnos/${encodeURIComponent(alumnoId)}/resumen?periodoId=${encodeURIComponent(periodoId)}`
      );
      if (secuenciaActual !== secuenciaResumen.current) return;
      setResumen(respuesta.resumen ?? null);
      setEstadoResumen(respuesta.resumen ? 'listo' : 'sin-datos');
    } catch {
      if (secuenciaActual !== secuenciaResumen.current) return;
      setResumen(null);
      setEstadoResumen('error');
    } finally {
      if (secuenciaActual === secuenciaResumen.current) setCargandoResumen(false);
    }
  }

  const listaPoliticas = politicas.length > 0 ? politicas : POLITICAS_FALLBACK;
  const etiquetaConteoPoliticas = listaPoliticas.length === 1 ? 'política activa' : 'políticas activas';
  const etiquetaKpiPoliticas = listaPoliticas.length === 1 ? 'Política' : 'Políticas';
  const etiquetaKpiAlumnos = alumnosDelPeriodo.length === 1 ? 'Alumno' : 'Alumnos';
  const sinPeriodosDisponibles = periodos.length === 0 && !cargandoPeriodos && !errorPeriodos;
  const etiquetaPeriodoVacia = cargandoPeriodos
    ? 'Cargando periodos…'
    : errorPeriodos
      ? 'No se pudieron cargar los periodos'
      : 'No hay periodos disponibles';
  const politicaSeleccionada = listaPoliticas.find((item) => item.codigo === politicaCodigo);
  const politicaVersionNumero = politicaVersion.trim() === '' ? Number.NaN : Number(politicaVersion);
  const politicaVersionError = !politicaSeleccionada
    ? 'Selecciona una política disponible antes de guardar.'
    : !Number.isInteger(politicaVersionNumero) || politicaVersionNumero < 1
      ? 'Escribe un número entero de versión igual o mayor que 1.'
      : politicaSeleccionada.sistema && politicaVersionNumero !== 1
      ? 'Las políticas del sistema solo tienen la versión 1.'
      : !politicaSeleccionada.sistema && politicaSeleccionada.activa === false
        ? 'Esta política está archivada y no se puede asignar.'
        : !politicaSeleccionada.sistema && politicaVersionNumero !== politicaSeleccionada.version
          ? `Solo se puede asignar la versión activa más reciente: v${politicaSeleccionada.version}.`
          : '';

  return (
    <div className="panel evaluaciones-panel">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head evaluaciones-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="icono-seccion-orb banco-panel__icon-orb evaluaciones-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={ChartNoAxesColumnIncreasing} size={28} />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill evaluaciones-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Métricas y Analítica Académica</span>
              </span>
              <span className="banco-counter-tag">{listaPoliticas.length} {etiquetaConteoPoliticas}</span>
            </div>
            <h2 className="banco-panel__title eyebrow">Evaluaciones y políticas</h2>
            <p className="nota">Configura políticas de evaluación, ponderaciones, evidencias continuas y consulta de consolidados.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis evaluaciones-header-kpis" role="group" aria-label="Resumen de evaluaciones">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Políticas de encuadre registradas">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={FileText} size={16} /></span>
            <span className="banco-mini-kpi__num">{listaPoliticas.length}</span>
            <span className="banco-mini-kpi__lbl">{etiquetaKpiPoliticas}</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Alumnos en el curso seleccionado">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={UsersRound} size={16} />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{periodoId ? alumnosDelPeriodo.length : '—'}</span>
            <span className="banco-mini-kpi__lbl">{etiquetaKpiAlumnos}</span>
          </div>

        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaEvaluacionesVisual />
      {estado && <InlineMensaje tipo="info">{estado}</InlineMensaje>}

      <div
        className="tabs evaluaciones-tabs"
        role="tablist"
        aria-label="Vistas de Evaluaciones"
        tabIndex={-1}
        onKeyDown={(event) => {
          let siguiente: number | undefined;
          if (event.key === 'ArrowRight') siguiente = (tabEnFoco + 1) % TABS_EVALUACIONES.length;
          if (event.key === 'ArrowLeft') siguiente = (tabEnFoco - 1 + TABS_EVALUACIONES.length) % TABS_EVALUACIONES.length;
          if (event.key === 'Home') siguiente = 0;
          if (event.key === 'End') siguiente = TABS_EVALUACIONES.length - 1;
          if (siguiente === undefined) return;
          event.preventDefault();
          setTabEnFoco(siguiente);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[siguiente]?.focus();
          // La activación es manual: Evidencias consulta datos al abrirse.
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setTabEnFoco(TABS_EVALUACIONES.findIndex((tab) => tab.id === tabActiva));
          }
        }}
      >
        {TABS_EVALUACIONES.map((tab, indice) => (
          <Boton
            key={tab.id}
            id={`evaluaciones-tab-${tab.id}`}
            role="tab"
            aria-selected={tabActiva === tab.id}
            aria-controls={`evaluaciones-panel-${tab.id}`}
            tabIndex={tabEnFoco === indice ? 0 : -1}
            variante={tabActiva === tab.id ? 'primario' : 'secundario'}
            type="button"
            onFocus={() => setTabEnFoco(indice)}
            onClick={() => {
              setTabActiva(tab.id);
              setTabEnFoco(indice);
            }}
          >
            {tab.etiqueta}
          </Boton>
        ))}
      </div>

      <div className="evaluaciones-selectores">
        <label className="campo">
          Periodo
          <select value={periodoId} disabled={periodos.length === 0} onChange={(event) => cambiarPeriodo(event.target.value)}>
            <option value="">{periodos.length === 0 ? etiquetaPeriodoVacia : 'Selecciona periodo'}</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {periodo.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Alumno
          <select value={alumnoId} disabled={!periodoId || alumnosDelPeriodo.length === 0} onChange={(event) => cambiarAlumno(event.target.value)}>
            <option value="">
              {periodos.length === 0
                ? etiquetaPeriodoVacia
                : !periodoId
                  ? 'Selecciona primero un periodo'
                  : alumnosDelPeriodo.length === 0
                    ? 'No hay alumnos en este periodo'
                    : 'Selecciona alumno'}
            </option>
            {alumnosDelPeriodo.map((alumno) => (
              <option key={alumno._id} value={alumno._id}>
                {alumno.nombreCompleto}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="nota" role="status" aria-live="polite">
        {!periodoId
          ? cargandoPeriodos
            ? 'Cargando periodos para consultar o registrar evaluaciones…'
            : errorPeriodos
              ? 'No se pudieron cargar los periodos. Reintenta para consultar o registrar evaluaciones.'
              : sinPeriodosDisponibles
                ? 'No hay periodos disponibles para configurar o consultar evaluaciones.'
            : 'Selecciona un periodo para cargar su lista de alumnos y consultar o registrar evaluaciones.'
          : tabActiva === 'politica'
          ? 'La política se configura para el periodo. El alumno seleccionado se conserva para las otras vistas y no afecta esta configuración.'
          : alumnoId
            ? `Contexto activo: ${alumnosDelPeriodo.find((alumno) => String(alumno._id) === alumnoId)?.nombreCompleto || 'alumno seleccionado'}.`
            : 'Selecciona un alumno del periodo para consultar o registrar sus evaluaciones.'}
      </p>
      {!periodoId && errorPeriodos && onReintentarPeriodos && (
        <Boton type="button" variante="secundario" onClick={onReintentarPeriodos}>
          Reintentar carga de periodos
        </Boton>
      )}

      <div id="evaluaciones-panel-politica" role="tabpanel" aria-labelledby="evaluaciones-tab-politica" tabIndex={0} hidden={tabActiva !== 'politica'}>
      {tabActiva === 'politica' && (
        <div className="evaluaciones-form item-glass anim-fade-in">
          {cargandoContexto && <p role="status" aria-live="polite">Cargando configuración del periodo…</p>}
          {errorContexto && (
            <div>
              <InlineMensaje tipo="error">{errorContexto}</InlineMensaje>
              <Boton type="button" variante="secundario" disabled={cargandoContexto} onClick={() => void cargarContexto()}>
                Reintentar cargar configuración
              </Boton>
            </div>
          )}
          <label className="campo">
            Política
            <select
              value={politicaCodigo}
              onChange={(event) => {
                const codigo = event.target.value;
                const seleccionada = listaPoliticas.find((item) => item.codigo === codigo);
                setPoliticaCodigo(codigo);
                if (seleccionada) {
                  setPoliticaVersion(String(seleccionada.version));
                  if (!seleccionada.sistema) {
                    setCodigoEditor(seleccionada.codigo);
                    setNombreEditor(seleccionada.nombre);
                    setDescripcionEditor(seleccionada.descripcion ?? '');
                    setFamiliaEditor(seleccionada.familia);
                    setParametrosEditor(JSON.stringify(seleccionada.parametros ?? {}, null, 2));
                  }
                }
              }}
            >
              {listaPoliticas.map((politica) => (
                <option key={`${politica.codigo}-${politica.version}`} value={politica.codigo}>
                  {politica.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Versión
            <input
              type="number"
              min={1}
              step={1}
              value={politicaVersion}
              onChange={(event) => setPoliticaVersion(event.target.value)}
              aria-invalid={Boolean(politicaVersionError)}
              aria-describedby={`ayuda-version-politica${politicaVersionError ? ' error-version-politica' : ''}`}
            />
          </label>
          <p id="ayuda-version-politica" className="ayuda">
            {politicaSeleccionada?.sistema
              ? 'Las políticas del sistema usan la versión 1.'
              : `Las políticas propias solo admiten su versión activa más reciente${politicaSeleccionada ? ` (v${politicaSeleccionada.version})` : ''}.`}
          </p>
          {politicaVersionError && <p id="error-version-politica" className="mensaje error" role="alert">{politicaVersionError}</p>}
          {erroresGuardado.politica && <InlineMensaje tipo="error">{erroresGuardado.politica}</InlineMensaje>}
          <div className="acciones">
            <Boton type="button" disabled={!puedeGestionar || !periodoId || !politicaSeleccionada || Boolean(politicaVersionError) || cargando || cargandoContexto || Boolean(errorContexto)} onClick={() => void guardarPoliticaV2()}>
              Guardar política
            </Boton>
            <Boton type="button" disabled={!puedeGestionar || cargando || cargandoContexto || Boolean(errorContexto) || !politicaSeleccionada || politicaSeleccionada.sistema || !politicaSeleccionada.activa} onClick={() => void archivarPoliticaSeleccionada()}>
              Archivar política seleccionada
            </Boton>
          </div>
          <fieldset className="evaluaciones-form__politica-editor">
            <legend>Crear política o publicar una nueva versión</legend>
            <label className="campo">Código
              <input value={codigoEditor} onChange={(event) => setCodigoEditor(event.target.value.toUpperCase())} maxLength={80} />
            </label>
            <label className="campo">Nombre
              <input value={nombreEditor} onChange={(event) => setNombreEditor(event.target.value)} maxLength={120} />
            </label>
            <label className="campo">Familia de cálculo
              <select
                value={familiaEditor}
                aria-describedby="ayuda-familia-politica"
                onChange={(event) => setFamiliaEditor(event.target.value as typeof familiaEditor)}
              >
                <option value="lisc_encuadre">LISC Encuadre</option>
                <option value="sv_excel_contract">SV Excel</option>
              </select>
            </label>
            <small id="ayuda-familia-politica">
              Al cambiar la familia no se convierten ni eliminan campos; revisa los parámetros antes de guardar.
            </small>
            <label className="campo">Descripción
              <input value={descripcionEditor} onChange={(event) => setDescripcionEditor(event.target.value)} maxLength={400} />
            </label>
            <label className="campo">Parámetros JSON
              <textarea
                rows={8}
                value={parametrosEditor}
                aria-invalid={errorParametrosPolitica ? true : undefined}
                aria-describedby={`ayuda-parametros-politica${errorParametrosPolitica ? ' error-parametros-politica' : ''}`}
                onChange={(event) => {
                  setParametrosEditor(event.target.value);
                  setErrorParametrosPolitica('');
                }}
              />
            </label>
            <small id="ayuda-parametros-politica">
              {familiaEditor === 'lisc_encuadre'
                ? 'Objeto JSON. Campos opcionales: pesosGlobales (continua, examenes), pesosExamenes (parcial1, parcial2, global), pesosContinuaCortes (c1, c2, c3), pesosComponentesExamen (teorico, practicas) y umbralAprobacion. Cada valor de peso va de 0 a 1 y cada grupo suma 1; el umbral va de 0 a 10.'
                : 'Objeto JSON. Campo opcional: pesosExamen con global y parciales. Cada valor va de 0 a 1 y ambos deben sumar 1.'}
            </small>
            {errorParametrosPolitica && (
              <div id="error-parametros-politica">
                <InlineMensaje tipo="error">{errorParametrosPolitica}</InlineMensaje>
              </div>
            )}
            {erroresGuardado.definicionPolitica && <InlineMensaje tipo="error">{erroresGuardado.definicionPolitica}</InlineMensaje>}
            <div className="acciones">
              <Boton type="button" disabled={!puedeGestionar || cargando || cargandoContexto || Boolean(errorContexto)} onClick={() => void guardarDefinicionPolitica()}>
                Guardar nueva versión
              </Boton>
            </div>
          </fieldset>
        </div>
      )}
      </div>

      <div id="evaluaciones-panel-evidencias" role="tabpanel" aria-labelledby="evaluaciones-tab-evidencias" tabIndex={0} hidden={tabActiva !== 'evidencias'}>
      {tabActiva === 'evidencias' && (
        <div className="evaluaciones-form item-glass anim-fade-in">
          <form
            className="evaluaciones-entry-form"
            aria-label="Registro de evidencia"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setIntentoGuardarEvidencia(true);
              limpiarErrorGuardado('evidencia');
              if (!puedeGestionar || !periodoId || !alumnoId || errorTituloEvidencia || errorMotivoEvidencia || errorCalificacionEvidencia || errorPonderacionEvidencia || cargando) return;
              void guardarEvidenciaV2();
            }}
          >
          <div className="campo">
            <label className="campo__label" htmlFor="evaluacion-evidencia-titulo">Título de la evidencia</label>
            <input
              id="evaluacion-evidencia-titulo"
              maxLength={180}
              aria-invalid={Boolean(errorTituloEvidencia)}
              aria-describedby={`ayuda-evidencia-titulo${errorTituloEvidencia ? ' error-evidencia-titulo' : ''}`}
              value={evidenciaTitulo}
              onChange={(event) => setEvidenciaTitulo(event.target.value)}
            />
            <small id="ayuda-evidencia-titulo">Escribe de 3 a 180 caracteres; si lo dejas vacío, se usará «Evidencia».</small>
            {errorTituloEvidencia && <small id="error-evidencia-titulo" className="mensaje error" role="alert">{errorTituloEvidencia}</small>}
          </div>
          <label className="campo">
            Calificación
            <input
              type="number"
              required
              min="0"
              max="10"
              step="0.01"
              aria-invalid={mostrarErrorCalificacionEvidencia}
              aria-describedby={`ayuda-evidencia-calificacion${mostrarErrorCalificacionEvidencia ? ' error-evidencia-calificacion' : ''}`}
              value={evidenciaCalificacion}
              onChange={(event) => setEvidenciaCalificacion(event.target.value)}
              onBlur={() => setEvidenciaCamposTocados((campos) => ({ ...campos, calificacion: true }))}
            />
            <small id="ayuda-evidencia-calificacion">Requerida. Ingresa una calificación dentro de la escala de 0 a 10.</small>
            {mostrarErrorCalificacionEvidencia && <small id="error-evidencia-calificacion" className="mensaje error" role="alert">{errorCalificacionEvidencia}</small>}
          </label>
          <label className="campo">
            Ponderación
            <input
              type="number"
              required
              min="0"
              max="10"
              step="0.01"
              aria-invalid={mostrarErrorPonderacionEvidencia}
              aria-describedby={`ayuda-evidencia-ponderacion${mostrarErrorPonderacionEvidencia ? ' error-evidencia-ponderacion' : ''}`}
              value={evidenciaPonderacion}
              onChange={(event) => setEvidenciaPonderacion(event.target.value)}
              onBlur={() => setEvidenciaCamposTocados((campos) => ({ ...campos, ponderacion: true }))}
            />
            <small id="ayuda-evidencia-ponderacion">Requerida. Peso relativo usado para promediar evidencias; rango permitido de 0 a 10.</small>
            {mostrarErrorPonderacionEvidencia && <small id="error-evidencia-ponderacion" className="mensaje error" role="alert">{errorPonderacionEvidencia}</small>}
          </label>
          <label className="campo">
            Corte
            <select value={evidenciaCorte} onChange={(event) => setEvidenciaCorte(event.target.value)}>
              <option value="1">C1</option>
              <option value="2">C2</option>
              <option value="3">C3</option>
            </select>
          </label>
          {evidenciaEditando && (
            <div className="campo">
              <label className="campo__label" htmlFor="evaluacion-evidencia-motivo">Motivo del cambio (obligatorio)</label>
              <input
                id="evaluacion-evidencia-motivo"
                required
                minLength={3}
                maxLength={400}
                aria-invalid={Boolean(errorMotivoEvidencia)}
                aria-describedby={`ayuda-motivo-evidencia${errorMotivoEvidencia ? ' error-motivo-evidencia' : ''}`}
                value={evidenciaMotivo}
                onChange={(event) => setEvidenciaMotivo(event.target.value)}
              />
              <small id="ayuda-motivo-evidencia">Describe el cambio para la auditoría (de 3 a 400 caracteres).</small>
              {errorMotivoEvidencia && <small id="error-motivo-evidencia" className="mensaje error" role="alert">{errorMotivoEvidencia}</small>}
            </div>
          )}
          {erroresGuardado.evidencia && <InlineMensaje tipo="error">{erroresGuardado.evidencia}</InlineMensaje>}
          <div className="acciones">
            <Boton type="submit" disabled={!puedeGestionar || !periodoId || !alumnoId || Boolean(errorTituloEvidencia) || Boolean(errorMotivoEvidencia) || cargando}>
              {evidenciaEditando ? 'Guardar cambios auditados' : 'Guardar evidencia'}
            </Boton>
            {evidenciaEditando && <Boton type="button" disabled={cargando} onClick={() => setEvidenciaEditando(null)}>Cancelar edición</Boton>}
          </div>
          </form>
          <section className="evaluaciones-evidencias-historial" aria-labelledby="evaluaciones-evidencias-historial-titulo">
            <h3 id="evaluaciones-evidencias-historial-titulo">Evidencias del alumno</h3>
            {!alumnoId && <p>Selecciona un alumno para consultar sus evidencias.</p>}
            {alumnoId && cargandoEvidencias && <p role="status" aria-live="polite">Cargando evidencias…</p>}
            {alumnoId && errorEvidencias && (
              <div>
                <InlineMensaje tipo="error">{errorEvidencias}</InlineMensaje>
                <Boton type="button" variante="secundario" onClick={() => void cargarEvidencias()}>Reintentar carga de evidencias</Boton>
              </div>
            )}
            {alumnoId && !cargandoEvidencias && !errorEvidencias && evidencias.length === 0 && <p>No hay evidencias para este alumno y periodo.</p>}
            {alumnoId && !cargandoEvidencias && !errorEvidencias && evidencias.map((evidencia) => (
              <article key={evidencia.id} className="evaluaciones-evidencia" data-evidencia-id={evidencia.id}>
                <div>
                  <strong>{evidencia.titulo}</strong>
                  <span> · Calificación: {evidencia.calificacionDecimal ?? 'Pendiente'} / 10 · Corte: {evidencia.corte ?? 'Sin asignar'} · Origen: {evidencia.fuente === 'manual' ? 'Manual' : 'Classroom'} · Estado: {evidencia.archivadaEn ? 'Archivada' : 'Activa'}</span>
                </div>
                {evidencia.fuente === 'manual' && <div className="acciones">
                  {!evidencia.archivadaEn && <Boton type="button" disabled={!puedeGestionar || cargando} onClick={() => editarEvidencia(evidencia)}>Editar</Boton>}
                  <Boton type="button" disabled={!puedeGestionar || cargando} onClick={() => void archivarOrestaurarEvidencia(evidencia)}>
                    {evidencia.archivadaEn ? 'Restaurar' : 'Archivar'}
                  </Boton>
                </div>}
              </article>
            ))}
          </section>
        </div>
      )}
      </div>

      <div id="evaluaciones-panel-examenes" role="tabpanel" aria-labelledby="evaluaciones-tab-examenes" tabIndex={0} hidden={tabActiva !== 'examenes'}>
      {tabActiva === 'examenes' && (
        <div className="evaluaciones-form item-glass anim-fade-in">
          <form
            className="evaluaciones-entry-form"
            aria-label="Registro de componente de examen"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!puedeGestionar || !periodoId || !alumnoId || errorTeoricoExamen || errorPracticasExamen || cargando || (corteExamen === 'global' && Boolean(folioExamenFuente.trim()) && !examenFuenteId && !examenFuenteSinCoincidencias)) return;
              void guardarComponenteExamenV2();
            }}
          >
          <label className="campo">
            Corte examen
            <select value={corteExamen} onChange={(event) => setCorteExamen(event.target.value as 'parcial1' | 'parcial2' | 'global')}>
              <option value="parcial1">Parcial 1</option>
              <option value="parcial2">Parcial 2</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label className="campo">
            Teórico
            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              required
              aria-invalid={Boolean(errorTeoricoExamen && teoricoTocado)}
              aria-describedby={`ayuda-examen-teorico${errorTeoricoExamen && teoricoTocado ? ' error-examen-teorico' : ''}`}
              value={teorico}
              onBlur={() => setTeoricoTocado(true)}
              onChange={(event) => {
                setTeorico(event.target.value);
                setTeoricoTocado(true);
                limpiarErrorGuardado('examen');
              }}
            />
            <small id="ayuda-examen-teorico">Obligatoria. Calificación teórica en escala de 0 a 10.</small>
            {errorTeoricoExamen && teoricoTocado && <small id="error-examen-teorico" className="mensaje error" role="alert">{errorTeoricoExamen}</small>}
          </label>
          <label className="campo">
            Prácticas (separadas por comas)
            <input
              aria-invalid={Boolean(errorPracticasExamen)}
              aria-describedby={`ayuda-examen-practicas${errorPracticasExamen ? ' error-examen-practicas' : ''}`}
              value={practicasCsv}
              onChange={(event) => {
                setPracticasCsv(event.target.value);
                limpiarErrorGuardado('examen');
              }}
            />
            <small id="ayuda-examen-practicas">Ingresa una calificación de 0 a 10 por práctica, separadas por coma; máximo 20. Déjalo vacío si aún no hay prácticas por registrar.</small>
            {errorPracticasExamen && <small id="error-examen-practicas" className="mensaje error" role="alert">{errorPracticasExamen}</small>}
          </label>
          {corteExamen === 'global' && (
            <div className="campo evaluaciones-fuente-examen">
              <label htmlFor="folio-examen-global-fuente">Folio del examen Global fuente (opcional)</label>
              <div className="acciones">
                <input
                  id="folio-examen-global-fuente"
                  value={folioExamenFuente}
                  onChange={(event) => {
                    setFolioExamenFuente(event.target.value);
                    setExamenesFuente([]);
                    setExamenFuenteId('');
                    setExamenFuenteSinCoincidencias(false);
                    setEstado('');
                  }}
                  autoComplete="off"
                  aria-describedby="ayuda-examen-global-fuente"
                />
                <Boton type="button" disabled={!periodoId || !alumnoId || !folioExamenFuente.trim() || buscandoFuente} onClick={() => void buscarExamenFuente()}>
                  {buscandoFuente ? 'Buscando…' : 'Buscar examen fuente'}
                </Boton>
              </div>
              <small id="ayuda-examen-global-fuente">Busca el folio impreso. Solo se vinculan exámenes del periodo y del alumno seleccionado, o exámenes del periodo aún sin alumno asignado.</small>
              {examenesFuente.length > 1 && (
                <label className="campo" htmlFor="examen-global-fuente-seleccionado">Examen fuente localizado</label>
              )}
              {examenesFuente.length > 1 && (
                <select id="examen-global-fuente-seleccionado" value={examenFuenteId} onChange={(event) => setExamenFuenteId(event.target.value)}>
                  <option value="">Selecciona folio</option>
                  {examenesFuente.map((examen) => {
                    const id = String(examen.id ?? examen._id ?? '');
                    return <option key={id} value={id}>{examen.folio} · {examen.estado ?? 'generado'}</option>;
                  })}
                </select>
              )}
              {examenFuenteId && examenesFuente.length === 1 && <span>Vinculado: {examenesFuente[0].folio}</span>}
              <span role="status" aria-live="polite">{estado}</span>
            </div>
          )}
          {erroresGuardado.examen && <InlineMensaje tipo="error">{erroresGuardado.examen}</InlineMensaje>}
          <div className="acciones">
            <Boton type="submit" disabled={!puedeGestionar || !periodoId || !alumnoId || Boolean(errorTeoricoExamen) || Boolean(errorPracticasExamen) || cargando || (corteExamen === 'global' && Boolean(folioExamenFuente.trim()) && !examenFuenteId && !examenFuenteSinCoincidencias)}>
              Guardar examen
            </Boton>
          </div>
          </form>
        </div>
      )}
      </div>

      <div id="evaluaciones-panel-resumen" role="tabpanel" aria-labelledby="evaluaciones-tab-resumen" tabIndex={0} hidden={tabActiva !== 'resumen'}>
      {tabActiva === 'resumen' && (
        <div className="panel item-glass anim-fade-in">
          <h4>Resumen alumno</h4>
          <div className="item-row">
            <Boton type="button" disabled={!periodoId || !alumnoId || cargando || cargandoResumen} onClick={() => void consultarResumenV2()}>
              {estadoResumen === 'consultando' ? 'Consultando…' : estadoResumen === 'error' ? 'Reintentar consulta' : 'Consultar resumen'}
            </Boton>
          </div>
          {!resumen && estadoResumen === 'sin-consultar' && <InlineMensaje tipo="info">Consulta el resumen para visualizar resultados del alumno.</InlineMensaje>}
          {!resumen && estadoResumen === 'consultando' && <p role="status" aria-live="polite">Consultando resumen…</p>}
          {!resumen && estadoResumen === 'sin-datos' && <InlineMensaje tipo="info">No hay un resumen disponible para este alumno y periodo.</InlineMensaje>}
          {!resumen && estadoResumen === 'error' && <InlineMensaje tipo="error">No se pudo consultar el resumen. Comprueba la conexión y vuelve a intentarlo.</InlineMensaje>}
          {resumen && (
            <section className="evaluaciones-resumen" aria-label="Resultados del alumno">
              <dl className="evaluaciones-resumen__politica">
                <div>
                  <dt>Política aplicada</dt>
                  <dd>{listaPoliticas.find((item) => item.codigo === resumen.politicaCodigo)?.nombre || (resumen.politicaCodigo ? 'Política no disponible' : '—')} v{formatearNumeroResumen(resumen.politicaVersion, 0)}</dd>
                </div>
              </dl>

              <div className="evaluaciones-resumen__cortes">
                <div className="evaluaciones-resumen__grupo" role="group" aria-labelledby="evaluaciones-resumen-continua">
                  <h5 id="evaluaciones-resumen-continua">Evaluación continua</h5>
                  <dl>
                    <div><dt>Corte 1</dt><dd>{formatearNumeroResumen(resumen.continuaPorCorte?.c1, 2)}</dd></div>
                    <div><dt>Corte 2</dt><dd>{formatearNumeroResumen(resumen.continuaPorCorte?.c2, 2)}</dd></div>
                    <div><dt>Corte 3</dt><dd>{formatearNumeroResumen(resumen.continuaPorCorte?.c3, 2)}</dd></div>
                  </dl>
                </div>
                <div className="evaluaciones-resumen__grupo" role="group" aria-labelledby="evaluaciones-resumen-examenes">
                  <h5 id="evaluaciones-resumen-examenes">Exámenes</h5>
                  <dl>
                    <div><dt>Parcial 1</dt><dd>{formatearNumeroResumen(resumen.examenesPorCorte?.parcial1, 2)}</dd></div>
                    <div><dt>Parcial 2</dt><dd>{formatearNumeroResumen(resumen.examenesPorCorte?.parcial2, 2)}</dd></div>
                    <div><dt>Global</dt><dd>{formatearNumeroResumen(resumen.examenesPorCorte?.global, 2)}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="evaluaciones-resumen__bloques" role="group" aria-label="Resultados por bloque">
                <div><span>Bloque de evaluación continua</span><strong>{formatearNumeroResumen(resumen.bloqueContinuaDecimal, 4)}</strong></div>
                <div><span>Bloque de exámenes</span><strong>{formatearNumeroResumen(resumen.bloqueExamenesDecimal, 4)}</strong></div>
              </div>

              <div className="evaluaciones-resumen__final" role="group" aria-labelledby="evaluaciones-resumen-final">
                <h5 id="evaluaciones-resumen-final">Calificación final</h5>
                <dl>
                  <div><dt>Redondeada</dt><dd>{formatearNumeroResumen(resumen.finalRedondeada, 0)}</dd></div>
                  <div><dt>Decimal</dt><dd>{formatearNumeroResumen(resumen.finalDecimal, 4)}</dd></div>
                </dl>
              </div>

              <p className="evaluaciones-resumen__estado"><span>Estado del cálculo</span><strong>{resumen.estado || 'Sin dato'}</strong></p>
              {Array.isArray(resumen.faltantes) && resumen.faltantes.length > 0 && (
                <div className="evaluaciones-resumen-faltantes">
                  <InlineMensaje tipo="warning">
                    {resumen.faltantes.length} {resumen.faltantes.length === 1 ? 'dato por completar:' : 'datos por completar:'}
                  </InlineMensaje>
                  <ul className="evaluaciones-resumen-faltantes__lista" aria-label="Datos por completar">
                    {resumen.faltantes.map((faltante, indice) => (
                      <li key={`${faltante}-${indice}`}>{etiquetaFaltanteResumen(faltante)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
