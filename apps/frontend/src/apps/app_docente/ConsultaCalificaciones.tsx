/**
 * ConsultaCalificaciones
 *
 * Responsabilidad: consulta operativa del libro de calificaciones por alumno.
 * Limites: no calcula ni persiste notas; delega la revisión al flujo de calificación.
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
  resultadoAutomaticoParcial2?: string;
  tareasEjerciciosParcial2?: string;
  puntosObtenidosParcial2?: number | null;
  puntosPosiblesParcial2?: number | null;
  actividadesCalificadasParcial2?: number;
  nombresActividadesParcial2?: string[];
  actividadesParcial2?: Array<{
    courseId: string;
    courseWorkId: string;
    titulo: string;
    puntosPosibles: number | null;
    puntosObtenidos: number | null;
    fechaLimite: string | null;
    estado: 'calificada' | 'faltante' | 'pendiente';
    faltanteConfirmado: boolean;
  }>;
  practicaParcial2?: string;
  examenManualParcial2?: string;
  bonoGuiaEstudioParcial2?: boolean;
  calificacionExamenConBonoParcial2?: string;
  evaluacionContinuaParcial2?: string;
  calificacionSegundoParcialFisica?: string;
  global: string;
  final: string;
  observaciones: string;
};

type Filtro = 'todos' | 'calificados' | 'pendientes';
type Orden = 'alumno' | 'final-desc' | 'final-asc' | 'estado';

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function nombreAlumno(fila: FilaConsultaCalificacion): string {
  return [fila.apellidoPaterno, fila.apellidoMaterno, fila.nombre].map(texto).filter(Boolean).join(' ') || 'Alumno sin nombre';
}

function estaCalificado(fila: FilaConsultaCalificacion): boolean {
  return [fila.parcial1, fila.parcial2, fila.global, fila.final, fila.tareasEjerciciosParcial2, fila.practicaParcial2, fila.calificacionSegundoParcialFisica]
    .some((valor) => texto(valor) !== '');
}

function notaNumero(valor: string): number {
  const numero = Number(texto(valor).replace(',', '.'));
  return Number.isFinite(numero) ? numero : -1;
}

function notaVisible(valor: string): string {
  const nota = texto(valor);
  if (!nota) return '—';
  const numero = Number(nota.replace(',', '.'));
  return Number.isFinite(numero)
    ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, useGrouping: false }).format(numero)
    : nota;
}

export function ConsultaCalificaciones({
  periodos,
  periodoId,
  actualizacion = 0,
  onPeriodoChange,
  onSeleccionarAlumno
}: {
  periodos: Periodo[];
  periodoId: string;
  actualizacion?: number;
  onPeriodoChange: (periodoId: string) => void;
  onSeleccionarAlumno: (alumnoId: string) => void;
}) {
  const [filas, setFilas] = useState<FilaConsultaCalificacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [orden, setOrden] = useState<Orden>('alumno');
  const [filaDetalle, setFilaDetalle] = useState<FilaConsultaCalificacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardandoCaptura, setGuardandoCaptura] = useState(false);
  const [faltanteGuardando, setFaltanteGuardando] = useState('');
  const [practicaCaptura, setPracticaCaptura] = useState('');
  const [examenCaptura, setExamenCaptura] = useState('');
  const [bonoGuia, setBonoGuia] = useState(false);
  const [mensajeCaptura, setMensajeCaptura] = useState('');
  const [errorCaptura, setErrorCaptura] = useState('');
  const [mensajeFaltante, setMensajeFaltante] = useState('');
  const [errorFaltante, setErrorFaltante] = useState('');
  const [error, setError] = useState('');
  const detalleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelado = false;
    setFilaDetalle(null);
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
        if (!cancelado) setFilas(Array.isArray(respuesta?.filas) ? respuesta.filas : []);
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
  }, [actualizacion, periodoId]);

  useEffect(() => {
    if (filaDetalle) detalleRef.current?.focus();
  }, [filaDetalle]);

  function abrirDetalle(fila: FilaConsultaCalificacion) {
    setFilaDetalle(fila);
    setPracticaCaptura(fila.practicaParcial2 ?? '');
    setExamenCaptura(fila.examenManualParcial2 ?? '');
    setBonoGuia(Boolean(fila.bonoGuiaEstudioParcial2));
    setMensajeCaptura('');
    setErrorCaptura('');
  }

  async function guardarCapturaParcial2() {
    if (!filaDetalle?.alumnoId || !periodoId) return;
    setGuardandoCaptura(true);
    setMensajeCaptura('');
    setErrorCaptura('');
    try {
      const practicaDecimal = practicaCaptura === '' ? null : Number(practicaCaptura);
      const examenDecimal = examenCaptura === '' ? null : Number(examenCaptura);
      const bonoGuiaEstudio = Boolean(bonoGuia && examenDecimal !== null);
      await clienteApi.actualizar(`/analiticas/lista-academica/${encodeURIComponent(filaDetalle.alumnoId)}/parcial2`, {
        periodoId,
        practicaDecimal,
        examenDecimal,
        bonoGuiaEstudio
      });
      const examenConBono = examenDecimal === null ? '' : String(Number((examenDecimal + (bonoGuiaEstudio ? 0.25 : 0)).toFixed(2)));
      const tareas = filaDetalle.tareasEjerciciosParcial2 ? Number(filaDetalle.tareasEjerciciosParcial2) : null;
      const continua = tareas !== null && practicaDecimal !== null ? String(Number(((tareas * 0.6 + practicaDecimal * 0.4) / 2).toFixed(2))) : '';
      const actualizada = {
        ...filaDetalle,
        practicaParcial2: practicaDecimal === null ? '' : String(practicaDecimal),
        examenManualParcial2: examenDecimal === null ? '' : String(examenDecimal),
        bonoGuiaEstudioParcial2: bonoGuiaEstudio,
        calificacionExamenConBonoParcial2: examenConBono,
        evaluacionContinuaParcial2: continua,
        calificacionSegundoParcialFisica: continua && examenConBono !== '' ? String(Number((Number(continua) + Number(examenConBono)).toFixed(2))) : ''
      };
      setFilaDetalle(actualizada);
      setFilas((actuales) => actuales.map((fila) => fila.alumnoId === actualizada.alumnoId ? actualizada : fila));
      setMensajeCaptura('Captura manual guardada. El resultado OMR permanece separado.');
    } catch (razon) {
      setErrorCaptura(razon instanceof Error ? razon.message : 'No se pudo guardar la captura manual.');
    } finally {
      setGuardandoCaptura(false);
    }
  }

  async function cambiarFaltanteParcial2(actividad: NonNullable<FilaConsultaCalificacion['actividadesParcial2']>[number], faltante: boolean) {
    if (!filaDetalle?.alumnoId || !periodoId) return;
    setFaltanteGuardando(actividad.courseWorkId);
    setErrorFaltante('');
    setMensajeFaltante('');
    try {
      const respuesta = await clienteApi.actualizar<{ fila?: FilaConsultaCalificacion }>(
        `/analiticas/lista-academica/${encodeURIComponent(filaDetalle.alumnoId)}/parcial2/faltantes`,
        { periodoId, courseId: actividad.courseId, courseWorkId: actividad.courseWorkId, faltante }
      );
      const filaActualizada = respuesta?.fila;
      if (!filaActualizada) throw new Error('El servidor no devolvió la lista recalculada. Recarga la consulta antes de continuar.');
      setFilaDetalle(filaActualizada);
      setFilas((actuales) => actuales.map((fila) => fila.alumnoId === filaActualizada.alumnoId ? filaActualizada : fila));
      setMensajeFaltante(faltante
        ? `Falta confirmada para “${actividad.titulo}”. Se considera 0 puntos en Tareas y Ejercicios 2do Parcial.`
        : `Se retiró la falta de “${actividad.titulo}”; el promedio fue recalculado.`);
    } catch (razon) {
      setErrorFaltante(razon instanceof Error ? razon.message : 'No se pudo actualizar la falta.');
    } finally {
      setFaltanteGuardando('');
    }
  }

  const calificados = useMemo(() => filas.filter(estaCalificado).length, [filas]);
  const visibles = useMemo(() => {
    const consulta = texto(busqueda).toLocaleLowerCase();
    const resultado = filas.filter((fila) => {
      const calificado = estaCalificado(fila);
      if (filtro === 'calificados' && !calificado) return false;
      if (filtro === 'pendientes' && calificado) return false;
      return !consulta || [nombreAlumno(fila), fila.matricula, fila.grupo].join(' ').toLocaleLowerCase().includes(consulta);
    });

    return resultado.sort((a, b) => {
      if (orden === 'final-desc') return notaNumero(b.final) - notaNumero(a.final);
      if (orden === 'final-asc') return notaNumero(a.final) - notaNumero(b.final);
      if (orden === 'estado') return Number(estaCalificado(a)) - Number(estaCalificado(b));
      return nombreAlumno(a).localeCompare(nombreAlumno(b), 'es', { sensitivity: 'base' });
    });
  }, [busqueda, filtro, filas, orden]);

  return (
    <section className="panel calificaciones-consulta" aria-labelledby="calificaciones-consulta-title">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">Libro de calificaciones</span>
          <h3 id="calificaciones-consulta-title">Consulta por alumno</h3>
        </div>
        <div className="calificaciones-consulta__summary" aria-live="polite">
          <span><strong>{filas.length}</strong> alumnos</span>
          <span><strong>{calificados}</strong> calificados</span>
          <span><strong>{filas.length - calificados}</strong> pendientes</span>
        </div>
      </div>

      <div className="calificaciones-consulta__toolbar" aria-label="Controles de consulta">
        <label className="campo">
          <span>Materia</span>
          <select value={periodoId} onChange={(event) => onPeriodoChange(event.target.value)}>
            <option value="">Selecciona materia...</option>
            {periodos.map((periodo) => <option key={periodo._id} value={periodo._id}>{etiquetaMateria(periodo)}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Buscar alumno</span>
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre, matrícula o grupo" disabled={!periodoId || cargando} />
        </label>
        <label className="campo">
          <span>Ordenar</span>
          <select value={orden} onChange={(event) => setOrden(event.target.value as Orden)} disabled={!periodoId || cargando}>
            <option value="alumno">Nombre del alumno</option>
            <option value="final-desc">Final: mayor a menor</option>
            <option value="final-asc">Final: menor a mayor</option>
            <option value="estado">Pendientes primero</option>
          </select>
        </label>
        <div className="calificaciones-consulta__filters" role="group" aria-label="Filtrar alumnos">
          {(['todos', 'calificados', 'pendientes'] as const).map((opcion) => (
            <button key={opcion} type="button" className={`boton secundario${filtro === opcion ? ' is-active' : ''}`} aria-pressed={filtro === opcion} onClick={() => setFiltro(opcion)}>
              {opcion === 'todos' ? 'Todos' : opcion === 'calificados' ? 'Calificados' : 'Pendientes'}
            </button>
          ))}
        </div>
      </div>

      {cargando && <InlineMensaje tipo="info">Cargando calificaciones del periodo...</InlineMensaje>}
      {!cargando && error && <InlineMensaje tipo="error">No se pudo cargar la consulta: {error}</InlineMensaje>}
      {!cargando && !error && !periodoId && <InlineMensaje tipo="info">Selecciona una materia para consultar sus calificaciones.</InlineMensaje>}
      {!cargando && !error && periodoId && filas.length === 0 && <InlineMensaje tipo="info">No hay alumnos registrados en esta materia.</InlineMensaje>}
      {!cargando && !error && periodoId && filas.length > 0 && visibles.length === 0 && <InlineMensaje tipo="info">No hay alumnos que coincidan con el filtro.</InlineMensaje>}

      {visibles.length > 0 && (
        <div className="calificaciones-consulta__table-wrap">
          <table className="calificaciones-consulta__table">
            <caption className="sr-only">Calificaciones por alumno y corte</caption>
            <thead><tr><th scope="col">Alumno</th><th scope="col">Grupo</th><th scope="col">Parcial 1</th><th scope="col">Resultado automático de examen 2do parcial (OMR)</th><th scope="col">Tareas y Ejercicios 2do Parcial</th><th scope="col">Practica 2do Parcial</th><th scope="col">Evaluación Continua 2do Parcial</th><th scope="col">Exámen 2do Parcial</th><th scope="col">Calificación Segundo Parcial</th><th scope="col">Global</th><th scope="col">Final</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead>
            <tbody>
              {visibles.map((fila) => {
                const calificado = estaCalificado(fila);
                const alumno = nombreAlumno(fila);
                return (
                  <tr key={fila.alumnoId || fila.matricula || `${alumno}-${fila.grupo}`}>
                    <th scope="row"><span className="calificaciones-consulta__student">{alumno}</span><span className="calificaciones-consulta__matricula">{fila.matricula || 'Sin matrícula'}</span></th>
                    <td>{fila.grupo || '—'}</td>
                    <td>{notaVisible(fila.parcial1)}</td>
                    <td>{notaVisible(fila.resultadoAutomaticoParcial2 ?? '')}</td>
                    <td title={fila.nombresActividadesParcial2?.join(', ') || undefined}>{notaVisible(fila.tareasEjerciciosParcial2 ?? '')}</td>
                    <td>{notaVisible(fila.practicaParcial2 ?? '')}</td><td>{notaVisible(fila.evaluacionContinuaParcial2 ?? '')}</td>
                    <td>{notaVisible(fila.calificacionExamenConBonoParcial2 ?? '')}</td><td>{notaVisible(fila.calificacionSegundoParcialFisica ?? '')}</td>
                    <td>{notaVisible(fila.global)}</td><td className="calificaciones-consulta__final">{notaVisible(fila.final)}</td>
                    <td><span className={`calificaciones-consulta__status ${calificado ? 'is-complete' : 'is-pending'}`}>{calificado ? 'Calificada' : 'Pendiente'}</span></td>
                    <td><Boton type="button" variante="secundario" disabled={!fila.alumnoId} aria-label={`Ver detalle de ${alumno}`} onClick={() => abrirDetalle(fila)}>Ver detalle</Boton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filaDetalle && (
        <aside ref={detalleRef} className="calificaciones-consulta__detail" tabIndex={-1} aria-labelledby="calificaciones-detalle-title">
          <div className="calificaciones-consulta__detail-head"><div><span className="calificaciones-kicker">Detalle del alumno</span><h4 id="calificaciones-detalle-title">{nombreAlumno(filaDetalle)}</h4><p>{filaDetalle.matricula || 'Sin matrícula'} · Grupo {filaDetalle.grupo || 'sin grupo'}</p></div><button type="button" className="calificaciones-consulta__close" onClick={() => setFilaDetalle(null)} aria-label="Cerrar detalle">×</button></div>
          <div className="calificaciones-consulta__detail-score"><span>Calificación final</span><strong>{notaVisible(filaDetalle.final)}</strong></div>
          <dl className="calificaciones-consulta__detail-grid"><div><dt>Parcial 1</dt><dd>{notaVisible(filaDetalle.parcial1)}</dd></div><div><dt>Resultado automático de examen 2do parcial (OMR)</dt><dd>{notaVisible(filaDetalle.resultadoAutomaticoParcial2 ?? '')}</dd></div><div><dt>Tareas y Ejercicios 2do Parcial</dt><dd>{notaVisible(filaDetalle.tareasEjerciciosParcial2 ?? '')}</dd></div><div><dt>Puntos considerados</dt><dd>{filaDetalle.puntosObtenidosParcial2 ?? '—'} / {filaDetalle.puntosPosiblesParcial2 ?? '—'}</dd></div><div><dt>Actividades con calificación publicada</dt><dd>{filaDetalle.actividadesCalificadasParcial2 ?? 0}</dd></div><div><dt>Practica 2do Parcial</dt><dd>{notaVisible(filaDetalle.practicaParcial2 ?? '')}</dd></div><div><dt>Evaluación Continua 2do Parcial</dt><dd>{notaVisible(filaDetalle.evaluacionContinuaParcial2 ?? '')}</dd></div><div><dt>Exámen 2do Parcial</dt><dd>{notaVisible(filaDetalle.calificacionExamenConBonoParcial2 ?? '')}</dd></div><div><dt>Calificación Segundo Parcial</dt><dd>{notaVisible(filaDetalle.calificacionSegundoParcialFisica ?? '')}</dd></div><div><dt>Global</dt><dd>{notaVisible(filaDetalle.global)}</dd></div><div><dt>Final</dt><dd>{notaVisible(filaDetalle.final)}</dd></div><div><dt>Estado</dt><dd>{estaCalificado(filaDetalle) ? 'Calificada' : 'Pendiente'}</dd></div></dl>
          <fieldset className="calificaciones-consulta__manual-capture">
            <legend>Evaluación Continua 2do Parcial · actividades de Classroom</legend>
            <p>Por defecto se acumulan todas las actividades seleccionadas en Classroom para “Tareas y Ejercicios 2do Parcial”. “Evaluación Continua 2do Parcial” conserva la fórmula de la lista original y se calcula junto con “Practica 2do Parcial”. Esta consulta no escribe calificaciones en Classroom.</p>
            {!filaDetalle.actividadesParcial2?.length && <p>No hay actividades incluidas en el promedio para este alumno.</p>}
            {filaDetalle.actividadesParcial2?.map((actividad) => {
              const vencida = Boolean(actividad.fechaLimite && Date.parse(actividad.fechaLimite) <= Date.now());
              const puedeMarcar = vencida && actividad.estado !== 'calificada' && Number(actividad.puntosPosibles) > 0;
              return (
                <div key={`${actividad.courseId}-${actividad.courseWorkId}`} className="calificaciones-consulta__activity">
                  <div><strong>{actividad.titulo || 'Actividad sin título'}</strong><span>Fecha límite: {actividad.fechaLimite ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(actividad.fechaLimite)) : 'No disponible'}</span><span>Puntos: {actividad.puntosObtenidos ?? '—'} / {actividad.puntosPosibles ?? '—'} · Estado: {actividad.estado === 'calificada' ? 'Calificada' : actividad.estado === 'faltante' ? 'Faltante (0 puntos)' : 'Pendiente'}</span></div>
                  <label className="calificaciones-consulta__bonus"><input type="checkbox" checked={actividad.faltanteConfirmado} disabled={Boolean(faltanteGuardando) || (!actividad.faltanteConfirmado && !puedeMarcar)} aria-label={`Marcar ${actividad.titulo} como faltante`} onChange={(event) => void cambiarFaltanteParcial2(actividad, event.target.checked)} />Confirmar faltante vencido (cuenta 0)</label>
                </div>
              );
            })}
          </fieldset>
          {errorFaltante && <InlineMensaje tipo="error">{errorFaltante}</InlineMensaje>}
          {mensajeFaltante && <InlineMensaje tipo="ok">{mensajeFaltante}</InlineMensaje>}
          <fieldset className="calificaciones-consulta__manual-capture">
            <legend>Captura manual para la lista física · Segundo parcial</legend>
            <p>El resultado OMR solo es referencia automática. Aquí se registra la nota del examen impreso.</p>
            <div className="calificaciones-consulta__manual-fields">
              <label className="campo"><span>Practica 2do Parcial (0–10)</span><input type="number" min="0" max="10" step="0.01" value={practicaCaptura} onChange={(event) => setPracticaCaptura(event.target.value)} /></label>
              <label className="campo"><span>Exámen 2do Parcial (0–5 antes del bono)</span><input type="number" min="0" max="5" step="0.01" value={examenCaptura} onChange={(event) => setExamenCaptura(event.target.value)} /></label>
              <label className="calificaciones-consulta__bonus"><input type="checkbox" checked={bonoGuia} onChange={(event) => setBonoGuia(event.target.checked)} disabled={examenCaptura === ''} />Bono de guía de estudio (+0.25)</label>
            </div>
            <p>Calificación del examen para la lista: {examenCaptura === '' ? '—' : notaVisible(String(Number((Number(examenCaptura) + (bonoGuia ? 0.25 : 0)).toFixed(2))) + (bonoGuia ? ' (incluye bono +0.25)' : ''))}</p>
            {errorCaptura && <InlineMensaje tipo="error">{errorCaptura}</InlineMensaje>}
            {mensajeCaptura && <InlineMensaje tipo="ok">{mensajeCaptura}</InlineMensaje>}
            <Boton type="button" variante="primario" disabled={guardandoCaptura || (practicaCaptura !== '' && (Number(practicaCaptura) < 0 || Number(practicaCaptura) > 10)) || (examenCaptura !== '' && (Number(examenCaptura) < 0 || Number(examenCaptura) > 5))} onClick={() => void guardarCapturaParcial2()}>{guardandoCaptura ? 'Guardando…' : 'Guardar captura manual'}</Boton>
          </fieldset>
          {texto(filaDetalle.observaciones) && <p><strong>Observaciones:</strong> {filaDetalle.observaciones}</p>}
          <div className="item-actions"><Boton type="button" variante="primario" disabled={!filaDetalle.alumnoId} onClick={() => onSeleccionarAlumno(texto(filaDetalle.alumnoId))}>Abrir revisión manual</Boton><Boton type="button" variante="secundario" onClick={() => setFilaDetalle(null)}>Seguir consultando</Boton></div>
        </aside>
      )}
    </section>
  );
}
