/**
 * ConsultaCalificaciones
 *
 * Responsabilidad: consulta rápida de calificaciones por alumno y examen.
 * Límites: no calcula notas; consume el resumen académico del periodo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import type { Periodo } from './tipos';
import { etiquetaMateria } from './utilidades';

export type FilaConsultaCalificacion = {
  alumnoId?: string;
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  grupo: string;
  parcial1: string;
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
  practica2doParcialVersion: number | null;
  examen2doParcialVersion: number | null;
  bonoExtracurricular?: string;
  bonoExtracurricularSolicitado?: string;
  bonoExtracurricularVersion?: number | null;
  bonoDistribucion?: Record<'examenGlobal' | 'continuaGlobal' | 'examenParcial2' | 'continuaParcial2' | 'examenParcial1' | 'continuaParcial1', number>;
  calificacionFinalCurso?: string;
};

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
  total: number;
  calificados: number;
  pendientes: number;
};

type FiltroConsulta = 'todos' | 'calificados' | 'pendientes';
type OrdenConsulta = 'alumno' | 'final-desc' | 'final-asc' | 'estado';

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
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroConsulta>('todos');
  const [orden, setOrden] = useState<OrdenConsulta>('alumno');
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaConsultaCalificacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [borradores, setBorradores] = useState({ practica: '', examen: '', global: '' });
  const [guardando, setGuardando] = useState<'practica' | 'examen' | 'global' | null>(null);
  const [errorGuardado, setErrorGuardado] = useState('');
  const [borradorBono, setBorradorBono] = useState('');
  const [vistaPreviaBono, setVistaPreviaBono] = useState<VistaPreviaBono | null>(null);
  const [procesandoBono, setProcesandoBono] = useState(false);
  const detalleRef = useRef<HTMLElement>(null);
  const solicitudBonoPendiente = useRef<{ clave: string; clientRequestId: string } | null>(null);
  const periodoSeleccionado = periodos.find((periodo) => String(periodo._id) === periodoId);

  useEffect(() => {
    let cancelado = false;
    setFilaSeleccionada(null);
    if (!periodoId) {
      setFilas([]);
      setError('');
      return () => {
        cancelado = true;
      };
    }

    setCargando(true);
    setError('');
    void clienteApi
      .obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`)
      .then((respuesta) => {
        if (cancelado) return;
        setFilas(Array.isArray(respuesta?.filas) ? respuesta.filas : []);
      })
      .catch((razon) => {
        if (cancelado) return;
        setFilas([]);
        setError(razon instanceof Error ? razon.message : 'No se pudo cargar la lista de calificaciones.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [periodoId]);

  useEffect(() => {
    if (!filaSeleccionada) return;
    setBorradores({ practica: filaSeleccionada.practica2doParcial ?? '', examen: filaSeleccionada.examen2doParcial ?? '', global: filaSeleccionada.examenGlobalLista ?? '' });
    setBorradorBono(filaSeleccionada.bonoExtracurricularSolicitado || '');
    setVistaPreviaBono(null);
    setErrorGuardado('');
    detalleRef.current?.focus();
  }, [filaSeleccionada]);

  async function guardarComponente(componente: 'Practica 2do Parcial' | 'Exámen 2do Parcial' | 'Exámen Global') {
    if (!filaSeleccionada || !periodoId) return;
    const esPractica = componente === 'Practica 2do Parcial';
    const esGlobal = componente === 'Exámen Global';
    const campo = esPractica ? 'practica' : esGlobal ? 'global' : 'examen';
    const valorTexto = borradores[campo].trim().replace(',', '.');
    const valor = Number(valorTexto);
    const maximo = esPractica ? 10 : esGlobal ? 5 : 5.25;
    if (!valorTexto || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
      setErrorGuardado(`La calificación de “${componente}” debe estar entre 0 y ${maximo}.`);
      return;
    }
    setGuardando(campo);
    setErrorGuardado('');
    const versionInicial = esPractica
      ? filaSeleccionada.practica2doParcialVersion
      : esGlobal ? filaSeleccionada.examenGlobalListaVersion : filaSeleccionada.examen2doParcialVersion;
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
        clientRequestId: crypto.randomUUID(),
        ...(versionInicial !== null ? { version: versionInicial } : {})
      });
      await actualizarDesdeApi();
    } catch (razon) {
      try {
        const filaActualizada = await actualizarDesdeApi();
        const calificacionActual = esPractica
          ? filaActualizada?.practica2doParcial
          : esGlobal ? filaActualizada?.examenGlobalLista : filaActualizada?.examen2doParcial;
        const versionActual = esPractica
          ? filaActualizada?.practica2doParcialVersion
          : esGlobal ? filaActualizada?.examenGlobalListaVersion : filaActualizada?.examen2doParcialVersion;
        if (calificacionActual !== undefined && numeroNota(calificacionActual) === valor && (versionActual ?? 0) > (versionInicial ?? 0)) return;
      } catch {
        // Se muestra el error original si no fue posible reconciliar la escritura por API.
      }
      setErrorGuardado(razon instanceof Error ? razon.message : 'No se pudo guardar la calificación.');
    } finally {
      setGuardando(null);
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
    const consulta = texto(busqueda).toLocaleLowerCase();
    const resultado = filas.filter((fila) => {
      const calificado = tieneCalificacion(fila);
      if (filtro === 'calificados' && !calificado) return false;
      if (filtro === 'pendientes' && calificado) return false;
      if (!consulta) return true;
      return [nombreAlumno(fila), fila.matricula, fila.grupo].join(' ').toLocaleLowerCase().includes(consulta);
    });

    return resultado.sort((a, b) => {
      if (orden === 'final-desc') return numeroNota(notaFinalCurso(b)) - numeroNota(notaFinalCurso(a));
      if (orden === 'final-asc') return numeroNota(notaFinalCurso(a)) - numeroNota(notaFinalCurso(b));
      if (orden === 'estado') return Number(tieneCalificacion(a)) - Number(tieneCalificacion(b));
      return nombreAlumno(a).localeCompare(nombreAlumno(b), 'es', { sensitivity: 'base' });
    });
  }, [busqueda, filas, filtro, orden]);

  const totalCalificados = useMemo(() => filas.filter(tieneCalificacion).length, [filas]);
  const totalPendientes = filas.length - totalCalificados;
  const resumenFiltro = filtro === 'todos' ? 'Todos los alumnos' : filtro === 'calificados' ? 'Alumnos calificados' : 'Alumnos pendientes';

  useEffect(() => {
    onResumenChange?.({ total: filas.length, calificados: totalCalificados, pendientes: totalPendientes });
  }, [filas.length, onResumenChange, totalCalificados, totalPendientes]);

  return (
    <section className="calificaciones-consulta anim-fade-in" aria-labelledby="calificaciones-consulta-title">
      <div className="calificaciones-consulta__head">
        <div>
          <span className="calificaciones-kicker">Libro de calificaciones</span>
          <h3 id="calificaciones-consulta-title">Resultados por alumno</h3>
          <p className="nota">Consulta las columnas de la lista física y las calificaciones sincronizadas.</p>
        </div>
        <div className="calificaciones-consulta__summary" aria-live="polite">
          <span><strong>{filas.length}</strong> alumnos</span>
          <span className="is-success"><strong>{totalCalificados}</strong> calificados</span>
          <span className={totalPendientes > 0 ? 'is-warning' : ''}><strong>{totalPendientes}</strong> pendientes</span>
        </div>
      </div>

      <div className="calificaciones-consulta__toolbar" aria-label="Controles de consulta">
        <label className="campo calificaciones-consulta__subject">
          <span>Materia</span>
          <select value={periodoId} onChange={(event) => onPeriodoChange(event.target.value)}>
            <option value="">Selecciona materia...</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {etiquetaMateria(periodo)}{periodo.activo === false ? ' (Archivada)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="campo calificaciones-consulta__search">
          <span>Buscar alumno</span>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre, matrícula o grupo"
            disabled={!periodoId || cargando}
          />
        </label>
        <label className="campo calificaciones-consulta__sort">
          <span>Ordenar</span>
          <select value={orden} onChange={(event) => setOrden(event.target.value as OrdenConsulta)} disabled={!periodoId || cargando}>
            <option value="alumno">Nombre del alumno</option>
            <option value="final-desc">Final: mayor a menor</option>
            <option value="final-asc">Final: menor a mayor</option>
            <option value="estado">Pendientes primero</option>
          </select>
        </label>
        <div className="calificaciones-consulta__filters" role="group" aria-label="Filtrar alumnos">
          {(['todos', 'calificados', 'pendientes'] as const).map((opcion) => {
            const activo = filtro === opcion;
            const etiqueta = opcion === 'todos' ? 'Todos' : opcion === 'calificados' ? 'Calificados' : 'Pendientes';
            return (
              <button
                key={opcion}
                type="button"
                className={`calificaciones-consulta__filter${activo ? ' is-active' : ''}`}
                aria-pressed={activo}
                onClick={() => setFiltro(opcion)}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>
      {periodoSeleccionado?.activo === false && (
        <InlineMensaje tipo="info">Materia archivada: estás consultando el historial. Los cambios autorizados se guardan sin reactivar el curso.</InlineMensaje>
      )}

      <div className="calificaciones-consulta__result-meta" aria-live="polite">
        <span>{resumenFiltro} · {filasFiltradas.length} visibles</span>
        <span className="calificaciones-consulta__legend"><i className="is-final" aria-hidden="true" /> Calificación final destacada</span>
      </div>

      {cargando && <InlineMensaje tipo="info">Cargando calificaciones del periodo...</InlineMensaje>}
      {!cargando && error && <InlineMensaje tipo="error">No se pudo cargar la consulta: {error}</InlineMensaje>}
      {!cargando && !error && !periodoId && <InlineMensaje tipo="info">Selecciona una materia para consultar sus calificaciones.</InlineMensaje>}
      {!cargando && !error && periodoId && filas.length === 0 && <InlineMensaje tipo="info">No hay alumnos registrados en esta materia.</InlineMensaje>}
      {!cargando && !error && periodoId && filas.length > 0 && filasFiltradas.length === 0 && <InlineMensaje tipo="info">No hay alumnos que coincidan con el filtro.</InlineMensaje>}

      {filasFiltradas.length > 0 && (
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
              {filasFiltradas.map((fila) => {
                const alumno = nombreAlumno(fila);
                const calificado = tieneCalificacion(fila);
                const alumnoId = texto(fila.alumnoId);
                return (
                  <tr key={fila.matricula || `${alumno}-${fila.grupo}`} className={!calificado ? 'is-pending' : undefined}>
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
                        {calificado ? 'Calificada' : 'Pendiente'}
                      </span>
                    </td>
                    <td data-label="Acción" className="calificaciones-consulta__action-cell">
                      <Boton
                        type="button"
                        variante="secundario"
                        disabled={!alumnoId}
                        aria-label={`Ver detalle de ${alumno}`}
                        onClick={() => setFilaSeleccionada(fila)}
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
            <button type="button" className="calificaciones-consulta__close" onClick={() => setFilaSeleccionada(null)} aria-label="Cerrar detalle">
              ×
            </button>
          </div>
          <div className="calificaciones-consulta__detail-score">
            <span>Calificación final</span>
            <strong>{mostrarNota(notaFinalCurso(filaSeleccionada))}</strong>
          </div>
          <dl className="calificaciones-consulta__detail-grid">
            <div><dt>Parcial 1</dt><dd>{mostrarNota(filaSeleccionada.parcial1)}</dd></div>
            <div><dt>Parcial 2</dt><dd>{mostrarNota(filaSeleccionada.parcial2)}</dd></div>
            <div><dt>Global</dt><dd>{mostrarNota(filaSeleccionada.global)}</dd></div>
            <div><dt>Bono extracurricular aplicado</dt><dd>{mostrarNota(filaSeleccionada.bonoExtracurricular ?? '')}</dd></div>
            <div><dt>Final del curso</dt><dd>{mostrarNota(filaSeleccionada.calificacionFinalCurso || filaSeleccionada.final)}</dd></div>
            <div><dt>Estado</dt><dd>{tieneCalificacion(filaSeleccionada) ? 'Calificada' : 'Pendiente'}</dd></div>
          </dl>
          <section aria-label="Columnas físicas del Segundo Parcial" className="calificaciones-consulta__physical-grades">
            <h5>Lista física · Segundo Parcial</h5>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Tareas y Ejercicios 2do Parcial</dt><dd>{mostrarNota(filaSeleccionada.tareasYEjercicios2doParcial)} <small>({filaSeleccionada.tareasPuntosObtenidos || '—'} / {filaSeleccionada.tareasPuntosPosibles || '—'} puntos)</small></dd></div>
              <div><dt>Evaluación Continua 2do Parcial</dt><dd>{mostrarNota(filaSeleccionada.evaluacionContinua2doParcial)} <small>escala 0–5</small></dd></div>
              <div><dt>Exámen 2do Parcial automático · referencia</dt><dd>{mostrarNota(filaSeleccionada.examen2doParcialAutomatico)} <small>no sustituye la captura manual</small></dd></div>
              <div><dt>Calificación Segundo Parcial</dt><dd>{mostrarNota(filaSeleccionada.calificacionSegundoParcial)}</dd></div>
            </dl>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Practica 2do Parcial · 0–10</span><input type="number" min="0" max="10" step="0.01" value={borradores.practica} onChange={(event) => setBorradores((prev) => ({ ...prev, practica: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Practica 2do Parcial')}>{guardando === 'practica' ? 'Guardando…' : 'Guardar práctica'}</Boton>
              <label className="campo"><span>Exámen 2do Parcial · 0–5.25</span><input type="number" min="0" max="5.25" step="0.01" value={borradores.examen} onChange={(event) => setBorradores((prev) => ({ ...prev, examen: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Exámen 2do Parcial')}>{guardando === 'examen' ? 'Guardando…' : 'Guardar examen'}</Boton>
            </div>
            <p className="nota">El bono extracurricular se registra en una sola columna y se distribuye por fórmula. Prioridad: Global (tercer parcial), segundo parcial y primer parcial; dentro de cada parcial, evaluación continua primero y examen después. Ningún parcial supera 10.</p>
            {errorGuardado && <InlineMensaje tipo="error">{errorGuardado}</InlineMensaje>}
          </section>
          <section aria-label="Bono extracurricular" className="calificaciones-consulta__physical-grades">
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
          </section>
          <section aria-label="Columnas físicas del Tercer Parcial" className="calificaciones-consulta__physical-grades">
            <h5>Lista física · Tercer Parcial</h5>
            <p className="nota">Los dos componentes físicos se expresan en escala 0–5; su suma está limitada a 10.</p>
            <dl className="calificaciones-consulta__detail-grid">
              <div><dt>Exámen Global · componente fuente 0–10</dt><dd>{mostrarNota(filaSeleccionada.examenGlobalComponente)}</dd></div>
              <div><dt>Exámen Global · lista física 0–5</dt><dd>{mostrarNota(filaSeleccionada.examenGlobalLista)}</dd></div>
              <div><dt>Evaluación Continua 3er Parcial · 0–5</dt><dd>{mostrarNota(filaSeleccionada.continuaTercerParcialLista)}</dd></div>
              <div><dt>Calificación Tercer Parcial · máximo 10</dt><dd>{mostrarNota(filaSeleccionada.calificacionTercerParcial)}</dd></div>
            </dl>
            <div className="calificaciones-consulta__manual-editors">
              <label className="campo"><span>Exámen Global manual · 0–5</span><input type="number" min="0" max="5" step="0.01" value={borradores.global} onChange={(event) => setBorradores((prev) => ({ ...prev, global: event.target.value }))} /></label>
              <Boton type="button" variante="secundario" disabled={guardando !== null} onClick={() => void guardarComponente('Exámen Global')}>{guardando === 'global' ? 'Guardando…' : 'Guardar Global'}</Boton>
            </div>
          </section>
          {texto(filaSeleccionada.observaciones) && (
            <p className="calificaciones-consulta__detail-note"><strong>Observaciones:</strong> {filaSeleccionada.observaciones}</p>
          )}
          <div className="calificaciones-consulta__detail-actions">
            <Boton
              type="button"
              variante="primario"
              disabled={!texto(filaSeleccionada.alumnoId)}
              onClick={() => onSeleccionarAlumno(texto(filaSeleccionada.alumnoId))}
            >
              Abrir revisión manual
            </Boton>
            <Boton type="button" variante="secundario" onClick={() => setFilaSeleccionada(null)}>
              Seguir consultando
            </Boton>
          </div>
        </aside>
      )}
    </section>
  );
}
