/**
 * SeccionPeriodos
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { registrarAccionDocente } from './telemetriaDocente';
import type { EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import { esMensajeError, etiquetaMateria, idCortoMateria, mensajeDeError, patronNombreMateria } from './utilidades';

export function SeccionPeriodos({
  periodos,
  onRefrescar,
  onVerArchivadas,
  permisos,
  puedeEliminarMateriaDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  periodos: Periodo[];
  onRefrescar: () => void;
  onVerArchivadas: () => void;
  permisos: PermisosUI;
  puedeEliminarMateriaDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [grupos, setGrupos] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [creando, setCreando] = useState(false);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardandoEdicionId, setGuardandoEdicionId] = useState<string | null>(null);
  const [edicionNombre, setEdicionNombre] = useState('');
  const [edicionFechaInicio, setEdicionFechaInicio] = useState('');
  const [edicionFechaFin, setEdicionFechaFin] = useState('');
  const [edicionGrupos, setEdicionGrupos] = useState('');
  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.periodos.gestionar;
  const puedeArchivar = permisos.periodos.archivar;
  const bloqueoEdicion = !puedeGestionar;

  function formatearFecha(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString();
  }

  function formatearFechaInput(valor?: string) {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalizarNombreMateria(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function normalizarTextoCorto(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  const nombreValido = useMemo(() => {
    const limpio = normalizarTextoCorto(nombre);
    if (!limpio) return false;
    if (limpio.length < 3 || limpio.length > 80) return false;
    return patronNombreMateria.test(limpio);
  }, [nombre]);

  const nombreNormalizado = useMemo(() => normalizarNombreMateria(nombre), [nombre]);
  const nombreDuplicado = useMemo(() => {
    if (!nombreNormalizado) return false;
    return periodos.some((p) => normalizarNombreMateria(p.nombre) === nombreNormalizado);
  }, [nombreNormalizado, periodos]);

  const gruposNormalizados = useMemo(
    () =>
      (grupos || '')
        .split(',')
        .map((item) => normalizarTextoCorto(item))
        .filter(Boolean),
    [grupos]
  );
  const gruposDuplicados = useMemo(() => {
    const vistos = new Set<string>();
    for (const grupo of gruposNormalizados) {
      const clave = grupo.toLowerCase();
      if (vistos.has(clave)) return true;
      vistos.add(clave);
    }
    return false;
  }, [gruposNormalizados]);
  const gruposValidos = useMemo(() => {
    if (gruposNormalizados.length > 50) return false;
    return gruposNormalizados.every((g) => g.length >= 1 && g.length <= 40);
  }, [gruposNormalizados]);

  const puedeCrear = Boolean(
    nombreValido &&
      fechaInicio &&
      fechaFin &&
      fechaFin >= fechaInicio &&
      !nombreDuplicado &&
      gruposValidos &&
      !gruposDuplicados
  );

  const nombreEdicionValido = useMemo(() => {
    const limpio = normalizarTextoCorto(edicionNombre);
    if (!limpio) return false;
    if (limpio.length < 3 || limpio.length > 80) return false;
    return patronNombreMateria.test(limpio);
  }, [edicionNombre]);

  const nombreEdicionNormalizado = useMemo(() => normalizarNombreMateria(edicionNombre), [edicionNombre]);
  const nombreEdicionDuplicado = useMemo(() => {
    if (!editandoId || !nombreEdicionNormalizado) return false;
    return periodos.some((p) => p._id !== editandoId && normalizarNombreMateria(p.nombre) === nombreEdicionNormalizado);
  }, [editandoId, nombreEdicionNormalizado, periodos]);

  const gruposEdicionNormalizados = useMemo(
    () =>
      (edicionGrupos || '')
        .split(',')
        .map((item) => normalizarTextoCorto(item))
        .filter(Boolean),
    [edicionGrupos]
  );
  const gruposEdicionDuplicados = useMemo(() => {
    const vistos = new Set<string>();
    for (const grupo of gruposEdicionNormalizados) {
      const clave = grupo.toLowerCase();
      if (vistos.has(clave)) return true;
      vistos.add(clave);
    }
    return false;
  }, [gruposEdicionNormalizados]);
  const gruposEdicionValidos = useMemo(() => {
    if (gruposEdicionNormalizados.length > 50) return false;
    return gruposEdicionNormalizados.every((g) => g.length >= 1 && g.length <= 40);
  }, [gruposEdicionNormalizados]);

  const puedeGuardarEdicion = Boolean(
    editandoId &&
      nombreEdicionValido &&
      edicionFechaInicio &&
      edicionFechaFin &&
      edicionFechaFin >= edicionFechaInicio &&
      !nombreEdicionDuplicado &&
      gruposEdicionValidos &&
      !gruposEdicionDuplicados
  );

  const resumenMaterias = useMemo(() => {
    const totalMaterias = periodos.length;
    const totalGrupos = periodos.reduce((acc, item) => acc + (Array.isArray(item.grupos) ? item.grupos.length : 0), 0);
    const hoy = new Date();
    const proximasAFinalizar = periodos.filter((item) => {
      const fecha = item.fechaFin ? new Date(item.fechaFin) : null;
      if (!fecha || Number.isNaN(fecha.getTime())) return false;
      const diffDias = (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
      return diffDias >= 0 && diffDias <= 14;
    }).length;
    return { totalMaterias, totalGrupos, proximasAFinalizar };
  }, [periodos]);

  async function crearPeriodo() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para gestionar materias.');
        return;
      }
      setCreando(true);
      setMensaje('');
      await enviarConPermiso(
        'periodos:gestionar',
        '/periodos',
        {
          nombre: normalizarTextoCorto(nombre),
          fechaInicio,
          fechaFin,
          grupos: gruposNormalizados
        },
        'No tienes permiso para crear materias.'
      );
      setMensaje('Materia creada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia creada', durationMs: 2200 });
      registrarAccionDocente('crear_periodo', true, Date.now() - inicio);
      setNombre('');
      setFechaInicio('');
      setFechaFin('');
      setGrupos('');
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo crear',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_periodo', false);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(periodo: Periodo) {
    setEditandoId(periodo._id);
    setEdicionNombre(String(periodo.nombre || ''));
    setEdicionFechaInicio(formatearFechaInput(periodo.fechaInicio));
    setEdicionFechaFin(formatearFechaInput(periodo.fechaFin));
    setEdicionGrupos(Array.isArray(periodo.grupos) ? periodo.grupos.join(', ') : '');
    setMensaje('');
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setGuardandoEdicionId(null);
    setEdicionNombre('');
    setEdicionFechaInicio('');
    setEdicionFechaFin('');
    setEdicionGrupos('');
  }

  async function guardarEdicion(periodo: Periodo) {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para gestionar materias.');
        return;
      }
      if (!puedeGuardarEdicion) return;
      setGuardandoEdicionId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:gestionar',
        `/periodos/${periodo._id}/actualizar`,
        {
          nombre: normalizarTextoCorto(edicionNombre),
          fechaInicio: edicionFechaInicio,
          fechaFin: edicionFechaFin,
          grupos: gruposEdicionNormalizados
        },
        'No tienes permiso para editar materias.'
      );
      setMensaje('Materia actualizada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_periodo', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_periodo', false);
    } finally {
      setGuardandoEdicionId(null);
    }
  }

  async function archivarMateria(periodo: Periodo) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para archivar materias.');
      return;
    }
    const confirmado = await confirm({
      title: 'Archivar materia',
      message: `La materia "${etiquetaMateria(periodo)}" dejará de mostrarse en la lista activa.`,
      details: ['Los datos se conservarán.', 'Seguirá disponible en “Materias archivadas”.'],
      confirmLabel: 'Sí, archivar',
      tone: 'warning'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setArchivandoId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:archivar',
        `/periodos/${periodo._id}/archivar`,
        {},
        'No tienes permiso para archivar materias.'
      );
      setMensaje('Materia archivada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia archivada', durationMs: 2200 });
      registrarAccionDocente('archivar_periodo', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo archivar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('archivar_periodo', false);
    } finally {
      setArchivandoId(null);
    }
  }

  async function eliminarMateriaDev(periodo: Periodo) {
    if (!puedeEliminarMateriaDev) {
      avisarSinPermiso('No tienes permiso para eliminar materias en desarrollo.');
      return;
    }
    const confirmado = await confirm({
      title: 'Eliminar materia en desarrollo',
      message: `Se eliminará "${etiquetaMateria(periodo)}" con su información relacionada.`,
      details: ['Se borrarán alumnos, banco, plantillas y exámenes asociados.', 'No uses esta acción en operación normal.'],
      confirmLabel: 'Sí, eliminar materia',
      tone: 'danger'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setEliminandoId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:eliminar_dev',
        `/periodos/${periodo._id}/eliminar`,
        {},
        'No tienes permiso para eliminar materias en desarrollo.'
      );
      setMensaje('Materia eliminada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia eliminada', durationMs: 2200 });
      registrarAccionDocente('eliminar_periodo', true, Date.now() - inicio);
      await Promise.resolve().then(() => onRefrescar());
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_periodo', false);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="panel materias-panel">
      <div className="materias-panel__head">
        <div>
          <h2>
            <Icono nombre="periodos" /> Materias
          </h2>
          <p className="nota">Administra la estructura académica activa, sus rangos operativos y la agrupación por grupos.</p>
        </div>
      </div>
      <div className="acciones">
        <Boton variante="secundario" type="button" onClick={onVerArchivadas}>
          Ver materias archivadas
        </Boton>
      </div>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> definir cada <b>materia</b> (unidad de trabajo) a la que pertenecen alumnos, plantillas, examenes y publicaciones.
        </p>
        <ul className="lista">
          <li>
            <b>Nombre:</b> nombre de la materia (ej. <code>Algebra I</code>, <code>Programacion</code>, <code>Fisica</code>).
          </li>
          <li>
            <b>Fecha inicio/fin:</b> rango de la materia; normalmente dura aproximadamente 30 dias. La fecha fin debe ser mayor o igual a la inicio.
          </li>
          <li>
            <b>Grupos:</b> lista opcional separada por comas.
          </li>
        </ul>
        <p>
          Ejemplos de grupos: <code>3A,3B,3C</code> o <code>A1,B1</code>.
        </p>
        <p>
          Reglas: nombre entre 3 y 80 caracteres; grupos unicos (max 50) y cada grupo max 40 caracteres.
        </p>
      </AyudaFormulario>
      <div className="materias-resumen" aria-live="polite">
        <div className="materias-resumen__item">
          <span>Materias activas</span>
          <b>{resumenMaterias.totalMaterias}</b>
        </div>
        <div className="materias-resumen__item">
          <span>Grupos vinculados</span>
          <b>{resumenMaterias.totalGrupos}</b>
        </div>
        <div className="materias-resumen__item">
          <span>Por cerrar (14 dias)</span>
          <b>{resumenMaterias.proximasAFinalizar}</b>
        </div>
      </div>
      <section className="materias-form">
        <div className="materias-form__grid">
          <label className="campo">
            Nombre de la materia
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Fecha inicio
            <input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Fecha fin
            <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} disabled={bloqueoEdicion} />
          </label>
        </div>
        <label className="campo">
          Grupos (separados por coma)
          <input value={grupos} onChange={(event) => setGrupos(event.target.value)} disabled={bloqueoEdicion} />
        </label>
        {nombre.trim() && !nombreValido && (
          <InlineMensaje tipo="warning">El nombre debe tener entre 3 y 80 caracteres para poder crear la materia.</InlineMensaje>
        )}
        {nombre.trim() && nombreDuplicado && (
          <InlineMensaje tipo="error">Ya existe una materia con ese nombre. Cambia el nombre para crearla.</InlineMensaje>
        )}
        {fechaInicio && fechaFin && fechaFin < fechaInicio && (
          <InlineMensaje tipo="error">La fecha fin debe ser igual o posterior a la fecha inicio.</InlineMensaje>
        )}
        {!gruposValidos && grupos.trim() && (
          <InlineMensaje tipo="warning">Revisa grupos: máximo 50 y hasta 40 caracteres por grupo para poder crear la materia.</InlineMensaje>
        )}
        {gruposDuplicados && <InlineMensaje tipo="warning">Hay grupos repetidos; corrígelo para poder crear la materia.</InlineMensaje>}
        <div className="acciones">
          <Boton
            type="button"
            icono={<Icono nombre="nuevo" />}
            cargando={creando}
            disabled={!puedeCrear || bloqueoEdicion}
            onClick={crearPeriodo}
          >
            {creando ? 'Creando…' : 'Crear materia'}
          </Boton>
        </div>
      </section>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
      <h3>Materias activas</h3>
      {periodos.length === 0 ? (
        <InlineMensaje tipo="info">Aún no hay materias activas. Crea la primera para habilitar banco, plantillas y alumnos.</InlineMensaje>
      ) : (
        <ul className="lista lista-items materias-lista">
          {periodos.map((periodo) => (
            <li key={periodo._id}>
              <div className="item-glass materias-lista__item">
                <div className="item-row">
                  <div>
                    {editandoId === periodo._id ? (
                      <div className="lista materias-edicion">
                        <label className="campo">
                          Nombre de la materia
                          <input
                            value={edicionNombre}
                            onChange={(event) => setEdicionNombre(event.target.value)}
                            disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                          />
                        </label>
                        {edicionNombre.trim() && !nombreEdicionValido && (
                          <InlineMensaje tipo="warning">El nombre debe tener entre 3 y 80 caracteres.</InlineMensaje>
                        )}
                        {nombreEdicionDuplicado && (
                          <InlineMensaje tipo="error">Ya existe una materia activa con ese nombre.</InlineMensaje>
                        )}
                        <label className="campo">
                          Fecha inicio
                          <input
                            type="date"
                            value={edicionFechaInicio}
                            onChange={(event) => setEdicionFechaInicio(event.target.value)}
                            disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                          />
                        </label>
                        <label className="campo">
                          Fecha fin
                          <input
                            type="date"
                            value={edicionFechaFin}
                            onChange={(event) => setEdicionFechaFin(event.target.value)}
                            disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                          />
                        </label>
                        {edicionFechaInicio && edicionFechaFin && edicionFechaFin < edicionFechaInicio && (
                          <InlineMensaje tipo="error">La fecha fin debe ser igual o posterior a la fecha inicio.</InlineMensaje>
                        )}
                        <label className="campo">
                          Grupos (separados por coma)
                          <input
                            value={edicionGrupos}
                            onChange={(event) => setEdicionGrupos(event.target.value)}
                            disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                          />
                        </label>
                        {!gruposEdicionValidos && edicionGrupos.trim() && (
                          <InlineMensaje tipo="warning">Revisa grupos: máximo 50 y hasta 40 caracteres por grupo.</InlineMensaje>
                        )}
                        {gruposEdicionDuplicados && <InlineMensaje tipo="warning">Hay grupos repetidos.</InlineMensaje>}
                      </div>
                    ) : (
                      <>
                        <div className="item-title" title={periodo._id}>
                          {etiquetaMateria(periodo)}
                        </div>
                        <div className="item-meta">
                          <span>ID: {idCortoMateria(periodo._id)}</span>
                          <span>Inicio: {formatearFecha(periodo.fechaInicio)}</span>
                          <span>Fin: {formatearFecha(periodo.fechaFin)}</span>
                          <span>
                            Grupos:{' '}
                            {Array.isArray(periodo.grupos) && periodo.grupos.length > 0 ? periodo.grupos.join(', ') : '-'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="item-actions">
                    {editandoId === periodo._id ? (
                      <>
                        <Boton
                          type="button"
                          cargando={guardandoEdicionId === periodo._id}
                          onClick={() => void guardarEdicion(periodo)}
                          disabled={!puedeGuardarEdicion || !puedeGestionar}
                        >
                          Guardar cambios
                        </Boton>
                        <Boton variante="secundario" type="button" onClick={cancelarEdicion} disabled={guardandoEdicionId === periodo._id}>
                          Cancelar
                        </Boton>
                      </>
                    ) : (
                      <>
                        <Boton variante="secundario" type="button" onClick={() => iniciarEdicion(periodo)} disabled={bloqueoEdicion}>
                          Editar
                        </Boton>
                        <Boton
                          variante="secundario"
                          type="button"
                          cargando={archivandoId === periodo._id}
                          onClick={() => archivarMateria(periodo)}
                          disabled={!puedeArchivar}
                        >
                          Archivar
                        </Boton>
                        {puedeEliminarMateriaDev && (
                          <Boton
                            variante="secundario"
                            type="button"
                            cargando={eliminandoId === periodo._id}
                            onClick={() => void eliminarMateriaDev(periodo)}
                            disabled={!puedeEliminarMateriaDev}
                          >
                            Eliminar (DEV)
                          </Boton>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SeccionPeriodosArchivados({
  periodos,
  onVerActivas
}: {
  periodos: Periodo[];
  onVerActivas: () => void;
}) {

  function formatearFechaHora(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString();
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="periodos" /> Materias archivadas
      </h2>
      <div className="acciones">
        <Boton variante="secundario" type="button" onClick={onVerActivas}>
          Volver a materias activas
        </Boton>
      </div>

      <AyudaFormulario titulo="Que significa archivar">
        <p>
          Archivar una materia la marca como <b>inactiva</b> para que no aparezca en listas de trabajo diarias.
          Los datos quedan guardados (solo se ocultan), y se registra un resumen de lo asociado.
        </p>
      </AyudaFormulario>

      {periodos.length === 0 ? (
        <InlineMensaje tipo="info">No hay materias archivadas.</InlineMensaje>
      ) : (
        <ul className="lista lista-items">
          {periodos.map((periodo) => (
            <li key={periodo._id}>
              <div className="item-glass">
                <div className="item-row">
                  <div>
                    <div className="item-title" title={periodo._id}>
                      {etiquetaMateria(periodo)}
                    </div>
                    <div className="item-meta">
                      <span>ID: {idCortoMateria(periodo._id)}</span>
                      <span>Creada: {formatearFechaHora(periodo.createdAt)}</span>
                      <span>Archivada: {formatearFechaHora(periodo.archivadoEn)}</span>
                    </div>
                    {periodo.resumenArchivado && (
                      <div className="item-sub">
                        Resumen: alumnos {periodo.resumenArchivado.alumnos ?? 0}, banco {periodo.resumenArchivado.bancoPreguntas ?? 0},
                        plantillas {periodo.resumenArchivado.plantillas ?? 0}, generados {periodo.resumenArchivado.examenesGenerados ?? 0},
                        calificaciones {periodo.resumenArchivado.calificaciones ?? 0}, codigos {periodo.resumenArchivado.codigosAcceso ?? 0}
                      </div>
                    )}
                  </div>
                  <div className="item-actions"></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
