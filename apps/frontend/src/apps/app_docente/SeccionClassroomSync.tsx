import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Icono } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { clienteApi } from './clienteApiDocente';
import { mensajeDeError } from './utilidades';

type ClassroomEstado = { conectado: boolean; correoGoogle?: string | null };

export function SeccionClassroom({
  puedeClassroomConectar,
  puedeClassroomPull,
  puedeConsultarCalificaciones,
  classroomDisponible,
  onAbrirCalificaciones
}: {
  puedeClassroomConectar: boolean;
  puedeClassroomPull: boolean;
  puedeConsultarCalificaciones: boolean;
  classroomDisponible: boolean | undefined;
  onAbrirCalificaciones: () => void;
}) {
  const [estado, setEstado] = useState<ClassroomEstado | null>(null);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  const confirm = useConfirmDialog();

  const cargarEstado = useCallback(async () => {
    if (!puedeClassroomPull) {
      setEstado(null);
      return;
    }
    setCargandoEstado(true);
    try {
      const respuesta = await clienteApi.obtener<{ estado?: ClassroomEstado }>('/evaluaciones/v2/classroom/estado');
      setEstado(respuesta.estado ?? { conectado: false });
      setMensaje('');
      setMensajeEsError(false);
    } catch (error) {
      setEstado(null);
      setMensaje(mensajeDeError(error, 'No se pudo consultar la conexión con Classroom.'));
      setMensajeEsError(true);
    } finally {
      setCargandoEstado(false);
    }
  }, [puedeClassroomPull]);

  useEffect(() => { void cargarEstado(); }, [cargarEstado]);
  useEffect(() => {
    const alVolverAlFrente = () => { void cargarEstado(); };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') alVolverAlFrente();
    };
    window.addEventListener('focus', alVolverAlFrente);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      window.removeEventListener('focus', alVolverAlFrente);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [cargarEstado]);

  async function conectar() {
    setMensaje('');
    try {
      const respuesta = await clienteApi.obtener<{ url?: string }>('/evaluaciones/v2/classroom/oauth/iniciar');
      if (!respuesta.url) throw new Error('Classroom no devolvió la URL de autorización.');
      window.open(respuesta.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo iniciar la conexión con Classroom.'));
      setMensajeEsError(true);
    }
  }

  async function desconectar() {
    const confirmado = await confirm({
      title: 'Desconectar Google Classroom',
      message: 'La sincronización quedará deshabilitada hasta volver a conectar la cuenta.',
      confirmLabel: 'Desconectar',
      tone: 'warning'
    });
    if (!confirmado) return;
    setDesconectando(true);
    setMensaje('');
    try {
      await clienteApi.enviar('/evaluaciones/v2/classroom/oauth/desconectar', {});
      await cargarEstado();
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo desconectar Classroom.'));
      setMensajeEsError(true);
    } finally {
      setDesconectando(false);
    }
  }

  return (
    <section className="cuenta-panel anim-fade-in" aria-labelledby="classroom-sync-heading">
      <header className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill banco-section-pill--emerald"><span className="banco-section-pill__dot" aria-hidden="true" />Conexión y sincronización</span>
          <h2 id="classroom-sync-heading" className="entregas-title-heading"><Icono nombre="classroom" /> Google Classroom</h2>
          <p className="nota">Administra aquí la conexión. Cursos, alumnos vinculados, actividades e importación de calificaciones se revisan en Calificaciones; las entregas y notas fuente permanecen en Classroom.</p>
        </div>
      </header>

      {classroomDisponible === undefined && <InlineMensaje tipo="info">Consultando disponibilidad de Google Classroom…</InlineMensaje>}
      {classroomDisponible === false && <InlineMensaje tipo="warning">La integración con Google Classroom no está disponible en este entorno.</InlineMensaje>}
      {mensaje && <InlineMensaje tipo={mensajeEsError ? 'error' : 'info'}>{mensaje}</InlineMensaje>}

      <div className="cuenta-subpanel">
        <h3>Conexión de la cuenta</h3>
        {!puedeClassroomPull ? <div className="item-row item-glass">
          <div><b>Estado de conexión no disponible</b><div className="nota">Se requiere permiso de consulta de Classroom para ver la cuenta conectada.</div></div>
          {puedeClassroomConectar && <Boton type="button" variante="primario" disabled={!classroomDisponible} onClick={() => void conectar()}>Conectar Google Classroom</Boton>}
        </div> : cargandoEstado && estado === null ? <InlineMensaje tipo="info">Consultando el estado de conexión…</InlineMensaje> : estado?.conectado ? (
          <div className="item-row item-glass">
            <div><b>Cuenta conectada</b><div className="nota">{estado.correoGoogle || 'Cuenta Google autorizada'}</div></div>
            <Boton type="button" variante="secundario" disabled={!puedeClassroomConectar || desconectando} cargando={desconectando} onClick={() => void desconectar()}>Desconectar</Boton>
          </div>
        ) : estado === null ? <div className="item-row item-glass">
          <div><b>No se pudo verificar la conexión</b><div className="nota">Revisa el servicio e intenta consultar el estado nuevamente.</div></div>
          <Boton type="button" variante="secundario" disabled={cargandoEstado} cargando={cargandoEstado} onClick={() => void cargarEstado()}>Reintentar</Boton>
        </div> : (
          <div className="item-row item-glass">
            <div><b>Cuenta Classroom no conectada</b><div className="nota">Conecta la cuenta que contiene los cursos que vas a sincronizar.</div></div>
            <Boton type="button" variante="primario" disabled={!classroomDisponible || !puedeClassroomConectar} onClick={() => void conectar()}>Conectar Google Classroom</Boton>
          </div>
        )}
      </div>

      <div className="cuenta-subpanel">
        <h3>Datos sincronizados</h3>
        <p className="nota">EvaluaPro consulta y vincula información del curso para revisión docente. No crea copias de las actividades ni modifica entregas o calificaciones en Google Classroom.</p>
        {puedeConsultarCalificaciones ? (
          <Boton type="button" variante="primario" icono={<Icono nombre="calificar" />} onClick={onAbrirCalificaciones}>
            Revisar en Calificaciones
          </Boton>
        ) : <InlineMensaje tipo="info">Tu cuenta no tiene permiso para consultar el módulo de Calificaciones.</InlineMensaje>}
      </div>
    </section>
  );
}
