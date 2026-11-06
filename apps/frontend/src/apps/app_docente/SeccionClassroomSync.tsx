import { useCallback, useEffect, useRef, useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Icono } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { clienteApi } from './clienteApiDocente';
import { mensajeDeError } from './utilidades';

type ClassroomEstado = {
  conectado: boolean;
  correoGoogle?: string | null;
  correoLogin?: string | null;
  identidadCoincidente?: boolean;
};

function validarUrlAutorizacionClassroom(valor: string | undefined): string {
  if (!valor) throw new Error('Classroom no devolvió la URL de autorización. Vuelve a solicitarla.');
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('Google devolvió un enlace de autorización no válido. Vuelve a solicitarlo.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com' || url.username || url.password) {
    throw new Error('Google devolvió un enlace de autorización no válido. Vuelve a solicitarlo.');
  }
  return url.toString();
}

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
  const [cargandoEstado, setCargandoEstado] = useState(puedeClassroomPull);
  const [preparandoAutorizacion, setPreparandoAutorizacion] = useState(false);
  const [urlAutorizacion, setUrlAutorizacion] = useState<string | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const [errorConsultaEstado, setErrorConsultaEstado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  const secuenciaEstado = useRef(0);
  const confirm = useConfirmDialog();

  const cargarEstado = useCallback(async () => {
    const secuenciaActual = ++secuenciaEstado.current;
    if (!puedeClassroomPull) {
      setEstado(null);
      setErrorConsultaEstado(false);
      setCargandoEstado(false);
      return;
    }
    setCargandoEstado(true);
    try {
      const respuesta = await clienteApi.obtener<{ estado?: ClassroomEstado }>('/evaluaciones/v2/classroom/estado');
      if (secuenciaActual !== secuenciaEstado.current) return;
      const estadoActual = respuesta.estado ?? { conectado: false };
      setEstado(estadoActual);
      setErrorConsultaEstado(false);
      if (estadoActual.conectado) setUrlAutorizacion(null);
      setMensaje('');
      setMensajeEsError(false);
    } catch (error) {
      if (secuenciaActual !== secuenciaEstado.current) return;
      setErrorConsultaEstado(true);
      setMensaje(mensajeDeError(error, 'No se pudo consultar la conexión con Classroom.'));
      setMensajeEsError(true);
    } finally {
      if (secuenciaActual === secuenciaEstado.current) setCargandoEstado(false);
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

  async function prepararConexion() {
    if (preparandoAutorizacion) return;
    setPreparandoAutorizacion(true);
    setUrlAutorizacion(null);
    setMensaje('');
    setMensajeEsError(false);
    try {
      const respuesta = await clienteApi.obtener<{ url?: string }>('/evaluaciones/v2/classroom/oauth/iniciar');
      setUrlAutorizacion(validarUrlAutorizacionClassroom(respuesta.url));
      setMensaje('Enlace listo. Vence en 10 minutos. Continúa con Google. Si vence o cancelas, solicita otro enlace.');
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo iniciar la conexión con Classroom.'));
      setMensajeEsError(true);
    } finally {
      setPreparandoAutorizacion(false);
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
    setUrlAutorizacion(null);
    setMensaje('');
    try {
      const respuesta = await clienteApi.enviar<{ estado?: ClassroomEstado }>('/evaluaciones/v2/classroom/oauth/desconectar', {});
      setEstado(respuesta.estado ?? { conectado: false });
      setErrorConsultaEstado(false);
      await cargarEstado();
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo desconectar Classroom.'));
      setMensajeEsError(true);
    } finally {
      setDesconectando(false);
    }
  }

  const enlaceAutorizacion = urlAutorizacion && !cargandoEstado && classroomDisponible && puedeClassroomConectar ? (
    <a className="boton classroom-auth-link classroom-sync__primary-action" href={urlAutorizacion} target="_blank" rel="noopener noreferrer">
      Continuar con Google (se abre en una pestaña nueva)
    </a>
  ) : null;

  return (
    <section className="cuenta-panel anim-fade-in" aria-labelledby="classroom-sync-heading">
      <header className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill banco-section-pill--emerald"><span className="banco-section-pill__dot" aria-hidden="true" />Conexión y sincronización</span>
          <h2 id="classroom-sync-heading" className="entregas-title-heading"><Icono nombre="classroom" /> Google Classroom</h2>
          <p className="nota">Conecta la cuenta que usarás en Google Classroom. Cursos, alumnos y calificaciones se revisan en Calificaciones; Classroom conserva las entregas originales.</p>
        </div>
      </header>

      {classroomDisponible === undefined && <InlineMensaje tipo="info">Consultando disponibilidad de Google Classroom…</InlineMensaje>}
      {classroomDisponible === false && <InlineMensaje tipo="warning">La integración con Google Classroom no está disponible en este entorno.</InlineMensaje>}
      {mensaje && <InlineMensaje tipo={mensajeEsError ? 'error' : 'info'}>{mensaje}</InlineMensaje>}
      {cargandoEstado && estado !== null && <InlineMensaje tipo="info">Actualizando el estado de conexión…</InlineMensaje>}

      <div className="cuenta-subpanel">
        <h3>Conexión de la cuenta</h3>
        {!puedeClassroomPull ? <div className="item-row item-glass">
          <div><b>Estado de conexión no disponible</b><div className="nota">Se requiere permiso de consulta de Classroom para ver la cuenta conectada.</div></div>
          {puedeClassroomConectar && <div className="classroom-conexion__acciones">
            <Boton type="button" variante={urlAutorizacion ? 'secundario' : 'primario'} disabled={!classroomDisponible || cargandoEstado} cargando={preparandoAutorizacion} onClick={() => void prepararConexion()}>{preparandoAutorizacion ? 'Preparando conexión…' : urlAutorizacion ? 'Solicitar otro enlace' : 'Conectar Google Classroom'}</Boton>
            {enlaceAutorizacion}
          </div>}
        </div> : cargandoEstado && estado === null ? <InlineMensaje tipo="info">Consultando el estado de conexión…</InlineMensaje> : estado?.conectado ? (
          <div className="item-row item-glass">
            <div>
              <b>Cuenta conectada</b>
              <div className="nota">{estado.correoGoogle || 'Cuenta Google autorizada'}</div>
              {errorConsultaEstado && <div className="nota" role="status">Último estado confirmado: conectada. No se pudo actualizar; vuelve a consultar para verificar si cambió.</div>}
              {!puedeClassroomConectar && <div className="nota">Tu cuenta puede consultar esta conexión, pero no tiene permiso para administrarla.</div>}
            </div>
            {(errorConsultaEstado || puedeClassroomConectar) && <div className="classroom-conexion__acciones">
              {errorConsultaEstado && <Boton type="button" variante="secundario" disabled={cargandoEstado} cargando={cargandoEstado} onClick={() => void cargarEstado()}>Reintentar consulta</Boton>}
              {puedeClassroomConectar && <Boton type="button" variante="secundario" disabled={desconectando} cargando={desconectando} onClick={() => void desconectar()}>Desconectar</Boton>}
            </div>}
          </div>
        ) : estado === null ? <div className="item-row item-glass">
          <div><b>No se pudo verificar la conexión</b><div className="nota">No hay un estado confirmado. Selecciona Reintentar para consultar de nuevo.</div></div>
          <Boton type="button" variante="secundario" disabled={cargandoEstado} cargando={cargandoEstado} onClick={() => void cargarEstado()}>Reintentar</Boton>
        </div> : (
          <div className="item-row item-glass">
            <div>
              <b>Cuenta Classroom no conectada</b>
              {errorConsultaEstado && <div className="nota" role="status">Último estado confirmado: no conectada. No se pudo actualizar; vuelve a consultar para verificar si cambió.</div>}
              <p className="nota classroom-login-guidance">{puedeClassroomConectar
                ? 'Autoriza con la misma cuenta que usas en EvaluaPro. Google puede sugerirla; las demás cuentas se rechazan.'
                : 'Tu cuenta puede consultar el estado, pero no tiene permiso para vincular Google Classroom. Solicita acceso a quien administra los permisos de EvaluaPro.'}</p>
              <div className="classroom-login-identity">
                <span>Cuenta de inicio en EvaluaPro</span>
                <strong dir="ltr">{estado.correoLogin || 'Inicia sesión con tu cuenta Google docente'}</strong>
              </div>
              {estado.correoGoogle && estado.identidadCoincidente === false && (
                <div className="nota">El vínculo previo con {estado.correoGoogle} no coincide y no se usará.</div>
              )}
            </div>
            {(errorConsultaEstado || puedeClassroomConectar) && <div className="classroom-conexion__acciones">
              {errorConsultaEstado && <Boton type="button" variante="secundario" disabled={cargandoEstado} cargando={cargandoEstado} onClick={() => void cargarEstado()}>Reintentar consulta</Boton>}
              {puedeClassroomConectar && <Boton type="button" className={urlAutorizacion ? 'classroom-sync__renew-action' : 'classroom-sync__primary-action'} variante={urlAutorizacion ? 'secundario' : 'primario'} disabled={!classroomDisponible || cargandoEstado} cargando={preparandoAutorizacion} onClick={() => void prepararConexion()}>
                {preparandoAutorizacion ? 'Preparando conexión…' : urlAutorizacion ? 'Solicitar otro enlace' : 'Conectar Google Classroom'}
              </Boton>}
              {puedeClassroomConectar && enlaceAutorizacion}
            </div>}
          </div>
        )}
      </div>

      <div className="cuenta-subpanel">
        <h3>Datos sincronizados</h3>
        <p className="nota">EvaluaPro consulta y vincula información del curso para revisión docente. No crea copias de las actividades ni modifica entregas o calificaciones en Google Classroom.</p>
        {puedeConsultarCalificaciones ? (
          <Boton type="button" className="classroom-sync__primary-action" variante="primario" icono={<Icono nombre="calificar" />} onClick={onAbrirCalificaciones}>
            Revisar en Calificaciones
          </Boton>
        ) : <InlineMensaje tipo="info">Tu cuenta no tiene permiso para consultar el módulo de Calificaciones.</InlineMensaje>}
      </div>
    </section>
  );
}
