/**
 * SeccionAlumnos
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useEffect, useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Alumno, EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import {
  esCorreoDeDominioPermitidoFrontend,
  esMensajeError,
  etiquetaMateria,
  idCortoMateria,
  mensajeDeError,
  obtenerDominiosCorreoPermitidosFrontend,
  textoDominiosPermitidos
} from './utilidades';
export function SeccionAlumnos({
  alumnos,
  periodosActivos,
  periodosTodos,
  onRefrescar,
  permisos,
  puedeEliminarAlumnoDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  periodosActivos: Periodo[];
  periodosTodos: Periodo[];
  onRefrescar: () => void;
  permisos: PermisosUI;
  puedeEliminarAlumnoDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [matricula, setMatricula] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [correoAuto, setCorreoAuto] = useState(true);
  const [grupo, setGrupo] = useState('');
  const [periodoIdNuevo, setPeriodoIdNuevo] = useState('');
  const [periodoIdLista, setPeriodoIdLista] = useState('');
  const [ultimoGrupoUsado, setUltimoGrupoUsado] = useState('');
  const [ultimoPeriodoIdUsado, setUltimoPeriodoIdUsado] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoAlumnoId, setEliminandoAlumnoId] = useState<string | null>(null);
  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.alumnos.gestionar;
  const bloqueoEdicion = !puedeGestionar;

  function normalizarMatricula(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  const matriculaNormalizada = useMemo(() => normalizarMatricula(matricula), [matricula]);
  const matriculaValida = useMemo(() => {
    if (!matricula.trim()) return true;
    return /^CUH\d{9}$/.test(matriculaNormalizada);
  }, [matricula, matriculaNormalizada]);

  const dominiosPermitidos = obtenerDominiosCorreoPermitidosFrontend();
  const politicaDominiosTexto = dominiosPermitidos.length > 0 ? textoDominiosPermitidos(dominiosPermitidos) : '';
  const correoValido = !correo.trim() || esCorreoDeDominioPermitidoFrontend(correo, dominiosPermitidos);

  function claseBadgeGrupo(grupoAlumno: string): string {
    const clave = String(grupoAlumno || '').trim().toUpperCase();
    if (!clave) return 'badge-grupo--none';
    let hash = 0;
    for (let i = 0; i < clave.length; i += 1) {
      hash = (hash * 31 + clave.charCodeAt(i)) >>> 0;
    }
    return `badge-grupo--${hash % 8}`;
  }

  useEffect(() => {
    if (!Array.isArray(periodosActivos) || periodosActivos.length === 0) return;
    if (!periodoIdLista) setPeriodoIdLista(periodosActivos[0]._id);
  }, [periodosActivos, periodoIdLista]);

  useEffect(() => {
    const lista = Array.isArray(alumnos) ? alumnos : [];
    if (lista.length === 0) {
      if (!periodoIdNuevo && Array.isArray(periodosActivos) && periodosActivos.length > 0) {
        setPeriodoIdNuevo(periodosActivos[0]._id);
      }
      return;
    }
    const ultimo = [...lista].sort((a, b) => {
      const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (porFecha !== 0) return porFecha;
      return String(b._id).localeCompare(String(a._id));
    })[0];
    const periodoIdReciente = String(ultimo?.periodoId || '').trim();
    const grupoReciente = String(ultimo?.grupo || '').trim();
    if (!ultimoPeriodoIdUsado && periodoIdReciente) {
      setUltimoPeriodoIdUsado(periodoIdReciente);
      if (!periodoIdNuevo) setPeriodoIdNuevo(periodoIdReciente);
    }
    if (!ultimoGrupoUsado && grupoReciente) {
      setUltimoGrupoUsado(grupoReciente);
      if (!grupo) setGrupo(grupoReciente);
    }
  }, [alumnos, grupo, ultimoGrupoUsado, ultimoPeriodoIdUsado, periodoIdNuevo, periodosActivos]);

  const puedeCrear = Boolean(
    matricula.trim() &&
      matriculaValida &&
      nombres.trim() &&
      apellidos.trim() &&
      periodoIdNuevo &&
      correoValido &&
      !editandoId
  );

  const puedeGuardarEdicion = Boolean(
    editandoId && matricula.trim() && matriculaValida && nombres.trim() && apellidos.trim() && periodoIdNuevo && correoValido
  );

  const alumnosDeMateria = useMemo(() => {
    const lista = Array.isArray(alumnos) ? alumnos : [];
    if (!periodoIdLista) return [];
    return lista
      .filter((a) => a.periodoId === periodoIdLista)
      .sort((a, b) => {
        const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        if (porFecha !== 0) return porFecha;
        return String(b._id).localeCompare(String(a._id));
      });
  }, [alumnos, periodoIdLista]);

  const nombreMateriaSeleccionada = useMemo(() => {
    if (!periodoIdLista) return '';
    const periodo = periodosTodos.find((p) => p._id === periodoIdLista);
    return periodo ? etiquetaMateria(periodo) : '';
  }, [periodosTodos, periodoIdLista]);

  const gruposDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const alumno of alumnosDeMateria) {
      const g = String(alumno.grupo || '').trim();
      if (g) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [alumnosDeMateria]);

  const alumnosFiltrados = useMemo(() => {
    const txt = filtroAlumno.trim().toLowerCase();
    const grp = filtroGrupo.trim().toLowerCase();
    return alumnosDeMateria.filter((alumno) => {
      const nombre = String(alumno.nombreCompleto || '').toLowerCase();
      const matriculaAlumno = String(alumno.matricula || '').toLowerCase();
      const correoAlumno = String(alumno.correo || '').toLowerCase();
      const grupoAlumno = String(alumno.grupo || '').toLowerCase();
      const byText = !txt || nombre.includes(txt) || matriculaAlumno.includes(txt) || correoAlumno.includes(txt);
      const byGroup = !grp || grupoAlumno === grp;
      return byText && byGroup;
    });
  }, [alumnosDeMateria, filtroAlumno, filtroGrupo]);

  const resumenAlumnos = useMemo(() => {
    const total = alumnosDeMateria.length;
    const conCorreo = alumnosDeMateria.filter((a) => String(a.correo || '').trim()).length;
    const grupos = gruposDisponibles.length;
    return { total, conCorreo, grupos };
  }, [alumnosDeMateria, gruposDisponibles.length]);

  async function crearAlumno() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para gestionar alumnos.');
        return;
      }
      if (dominiosPermitidos.length > 0 && correo.trim() && !correoValido) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente('crear_alumno', false);
        return;
      }
      setCreando(true);
      setMensaje('');
      const creado = await enviarConPermiso<{ alumno?: Alumno }>(
        'alumnos:gestionar',
        '/alumnos',
        {
          matricula: matriculaNormalizada,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          ...(correo.trim() ? { correo: correo.trim() } : {}),
          ...(grupo.trim() ? { grupo: grupo.trim() } : {}),
          periodoId: periodoIdNuevo
        },
        'No tienes permiso para crear alumnos.'
      );
      const alumnoCreado = creado?.alumno;
      const idCreado = String(alumnoCreado?._id || '').trim();
      const idTexto = idCreado || 'sin-id';
      setMensaje(`Alumno creado (ID: ${idTexto})`);
      emitToast({ level: 'ok', title: 'Alumnos', message: `Alumno creado · ID: ${idTexto}`, durationMs: 2200 });
      registrarAccionDocente('crear_alumno', true, Date.now() - inicio);
      const periodoReciente = String(alumnoCreado?.periodoId || periodoIdNuevo || '').trim();
      const grupoReciente = String(alumnoCreado?.grupo || grupo || '').trim();
      if (periodoReciente) {
        setUltimoPeriodoIdUsado(periodoReciente);
        setPeriodoIdNuevo(periodoReciente);
      }
      setUltimoGrupoUsado(grupoReciente);
      setGrupo(grupoReciente);
      setMatricula('');
      setNombres('');
      setApellidos('');
      setCorreo('');
      setCorreoAuto(true);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo crear',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_alumno', false);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(alumno: Alumno) {
    setMensaje('');
    setEditandoId(alumno._id);
    setMatricula(alumno.matricula || '');
    setNombres(alumno.nombres || '');
    setApellidos(alumno.apellidos || '');
    setGrupo(alumno.grupo || '');
    setCorreoAuto(false);
    setCorreo(alumno.correo || (alumno.matricula ? `${normalizarMatricula(alumno.matricula)}@cuh.mx` : ''));
    setPeriodoIdNuevo(alumno.periodoId || '');
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setMensaje('');
    setMatricula('');
    setNombres('');
    setApellidos('');
    setCorreo('');
    setCorreoAuto(true);
    setGrupo('');
    setPeriodoIdNuevo('');
  }

  async function guardarEdicion() {
    if (!editandoId) return;

    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para editar alumnos.');
        return;
      }
      if (dominiosPermitidos.length > 0 && correo.trim() && !correoValido) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente('editar_alumno', false);
        return;
      }

      setGuardandoEdicion(true);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:gestionar',
        `/alumnos/${editandoId}/actualizar`,
        {
          matricula: matriculaNormalizada,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          ...(correo.trim() ? { correo: correo.trim() } : {}),
          ...(grupo.trim() ? { grupo: grupo.trim() } : {}),
          periodoId: periodoIdNuevo
        },
        'No tienes permiso para editar alumnos.'
      );

      setMensaje('Alumno actualizado');
      emitToast({ level: 'ok', title: 'Alumnos', message: 'Alumno actualizado', durationMs: 2200 });
      registrarAccionDocente('editar_alumno', true, Date.now() - inicio);
      setUltimoGrupoUsado(String(grupo || '').trim());
      setUltimoPeriodoIdUsado(String(periodoIdNuevo || '').trim());
      setEditandoId(null);
      setMatricula('');
      setNombres('');
      setApellidos('');
      setCorreo('');
      setCorreoAuto(true);
      setGrupo('');
      setPeriodoIdNuevo('');
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('editar_alumno', false);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function eliminarAlumnoDev(alumno: Alumno) {
    if (!puedeEliminarAlumnoDev) {
      avisarSinPermiso('No tienes permiso para eliminar alumnos en desarrollo.');
      return;
    }
    const confirmado = await confirm({
      title: 'Eliminar alumno',
      message: `Se eliminará al alumno "${alumno.nombreCompleto}" del entorno de desarrollo.`,
      details: ['También se borrarán exámenes asociados.', 'Esta acción es solo para limpieza técnica.'],
      confirmLabel: 'Sí, eliminar alumno',
      tone: 'danger'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setEliminandoAlumnoId(alumno._id);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:eliminar_dev',
        `/alumnos/${alumno._id}/eliminar`,
        {},
        'No tienes permiso para eliminar alumnos en desarrollo.'
      );
      setMensaje('Alumno eliminado');
      emitToast({ level: 'ok', title: 'Alumnos', message: 'Alumno eliminado', durationMs: 2200 });
      registrarAccionDocente('eliminar_alumno', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_alumno', false);
    } finally {
      setEliminandoAlumnoId(null);
    }
  }

  return (
    <div className="panel alumnos-panel">
      <h2>
        <Icono nombre="alumnos" /> Alumnos
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> registrar alumnos dentro de una materia para poder generar examenes, vincular folios y publicar resultados.
        </p>
        <ul className="lista">
          <li>
            <b>Matricula:</b> identificador del alumno con formato <code>CUH#########</code> (ej. <code>CUH512410168</code>).
          </li>
          <li>
            <b>Nombres/Apellidos:</b> como aparecen en lista oficial.
          </li>
          <li>
            <b>Correo:</b> opcional; si existe politica institucional, debe ser del dominio permitido.
          </li>
          <li>
            <b>Grupo:</b> opcional (ej. <code>3A</code>).
          </li>
          <li>
            <b>Materia:</b> obligatorio; selecciona la materia correspondiente.
          </li>
        </ul>
        <p>
          Ejemplo completo: matricula <code>CUH512410168</code>, nombres <code>Ana Maria</code>, apellidos <code>Gomez Ruiz</code>, grupo <code>3A</code>.
        </p>
      </AyudaFormulario>
      {editandoId && (
        <InlineMensaje tipo="info">
          Editando alumno. Modifica los campos y pulsa &quot;Guardar cambios&quot;.
        </InlineMensaje>
      )}
      <section className="alumnos-form">
        <div className="alumnos-form__grid">
          <label className="campo">
            Matricula
            <input
              value={matricula}
              onChange={(event) => {
                const valor = event.target.value;
                setMatricula(valor);
                if (correoAuto) {
                  const m = normalizarMatricula(valor);
                  setCorreo(m ? `${m}@cuh.mx` : '');
                }
              }}
              disabled={bloqueoEdicion}
            />
            <span className="ayuda">Formato: CUH######### (ej. CUH512410168).</span>
          </label>
          <label className="campo">
            Nombres
            <input value={nombres} onChange={(event) => setNombres(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Apellidos
            <input value={apellidos} onChange={(event) => setApellidos(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Correo
            <input
              value={correo}
              onChange={(event) => {
                setCorreoAuto(false);
                setCorreo(event.target.value);
              }}
              disabled={bloqueoEdicion}
            />
            {correoAuto && matriculaNormalizada && (
              <span className="ayuda">Sugerido automaticamente: {matriculaNormalizada}@cuh.mx</span>
            )}
            {dominiosPermitidos.length > 0 && <span className="ayuda">Opcional. Solo se permiten: {politicaDominiosTexto}</span>}
          </label>
          <label className="campo">
            Grupo
            <input
              value={grupo}
              onChange={(event) => {
                const nuevoGrupo = event.target.value;
                setGrupo(nuevoGrupo);
                setUltimoGrupoUsado(String(nuevoGrupo || '').trim());
              }}
              disabled={bloqueoEdicion}
            />
          </label>
          <label className="campo">
            Materia
            <select
              value={periodoIdNuevo}
              onChange={(event) => {
                const nuevoPeriodoId = event.target.value;
                setPeriodoIdNuevo(nuevoPeriodoId);
                setUltimoPeriodoIdUsado(String(nuevoPeriodoId || '').trim());
              }}
              disabled={bloqueoEdicion}
            >
              <option value="">Selecciona</option>
              {periodosActivos.map((periodo) => (
                <option key={periodo._id} value={periodo._id} title={periodo._id}>
                  {etiquetaMateria(periodo)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {matricula.trim() && !matriculaValida && (
          <InlineMensaje tipo="error">Matricula invalida. Usa el formato CUH#########.</InlineMensaje>
        )}
        {dominiosPermitidos.length > 0 && correo.trim() && !correoValido && (
          <InlineMensaje tipo="error">Correo no permitido por politicas. Usa un correo institucional.</InlineMensaje>
        )}
        <div className="acciones">
          {!editandoId ? (
            <Boton
              type="button"
              icono={<Icono nombre="nuevo" />}
              cargando={creando}
              disabled={!puedeCrear || bloqueoEdicion}
              onClick={crearAlumno}
            >
              {creando ? 'Creando…' : 'Crear alumno'}
            </Boton>
          ) : (
            <>
              <Boton
                type="button"
                icono={<Icono nombre="ok" />}
                cargando={guardandoEdicion}
                disabled={!puedeGuardarEdicion || bloqueoEdicion}
                onClick={guardarEdicion}
              >
                {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
              <Boton variante="secundario" type="button" onClick={cancelarEdicion}>
                Cancelar
              </Boton>
            </>
          )}
        </div>
      </section>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
      <h3>Alumnos de la materia</h3>
      <div className="alumnos-resumen" aria-live="polite">
        <div className="alumnos-resumen__item"><span>Total alumnos</span><b>{resumenAlumnos.total}</b></div>
        <div className="alumnos-resumen__item"><span>Con correo</span><b>{resumenAlumnos.conCorreo}</b></div>
        <div className="alumnos-resumen__item"><span>Grupos</span><b>{resumenAlumnos.grupos}</b></div>
      </div>
      <div className="alumnos-filtros">
        <label className="campo">
          Materia seleccionada
          <select value={periodoIdLista} onChange={(event) => setPeriodoIdLista(event.target.value)}>
            <option value="">Selecciona</option>
            {periodosTodos
              .filter((p) => p.activo !== false)
              .map((periodo) => (
                <option key={periodo._id} value={periodo._id} title={periodo._id}>
                  {etiquetaMateria(periodo)}
                </option>
              ))}
          </select>
          {Boolean(nombreMateriaSeleccionada) && (
            <span className="ayuda">Mostrando todos los alumnos de: {nombreMateriaSeleccionada}</span>
          )}
        </label>
        <label className="campo">
          Buscar alumno
          <input
            type="search"
            value={filtroAlumno}
            onChange={(event) => setFiltroAlumno(event.target.value)}
            placeholder="Nombre, matricula o correo"
          />
        </label>
        <label className="campo">
          Grupo
          <select value={filtroGrupo} onChange={(event) => setFiltroGrupo(event.target.value)}>
            <option value="">Todos</option>
            {gruposDisponibles.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="lista lista-items alumnos-lista">
        {!periodoIdLista && <li>Selecciona una materia para ver sus alumnos.</li>}
        {periodoIdLista && alumnosDeMateria.length === 0 && <li>No hay alumnos registrados en esta materia.</li>}
        {periodoIdLista && alumnosDeMateria.length > 0 && alumnosFiltrados.length === 0 && (
          <li>No hay alumnos que coincidan con los filtros.</li>
        )}
        {periodoIdLista &&
          alumnosFiltrados.map((alumno) => (
            <li key={alumno._id}>
              <div className="item-glass alumnos-lista__item">
                <div className="item-row">
                  <div>
                    <div className="item-title">
                      {alumno.matricula} - {alumno.nombreCompleto}
                    </div>
                    <div className="item-meta">
                      <span>ID: {idCortoMateria(alumno._id)}</span>
                      <span>
                        Grupo:{' '}
                        <span className={`badge badge-grupo ${claseBadgeGrupo(alumno.grupo || '')}`}>
                          {alumno.grupo ? alumno.grupo : '-'}
                        </span>
                      </span>
                      <span>Correo: {alumno.correo ? alumno.correo : '-'}</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <Boton variante="secundario" type="button" onClick={() => iniciarEdicion(alumno)} disabled={bloqueoEdicion}>
                      Editar
                    </Boton>
                    {puedeEliminarAlumnoDev && (
                      <Boton
                        variante="secundario"
                        type="button"
                        cargando={eliminandoAlumnoId === alumno._id}
                        onClick={() => void eliminarAlumnoDev(alumno)}
                        disabled={!puedeEliminarAlumnoDev}
                      >
                        Eliminar (DEV)
                      </Boton>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

