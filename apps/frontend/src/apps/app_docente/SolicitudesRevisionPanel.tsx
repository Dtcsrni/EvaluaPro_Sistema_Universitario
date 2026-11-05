import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import type { SolicitudRevisionAlumno } from './tipos';
import { esMensajeError } from './utilidades';

type ResumenSolicitudes = {
  pendientes: number;
  atendidas: number;
  rechazadas: number;
};

type SolicitudesRevisionPanelProps = {
  solicitudes: SolicitudRevisionAlumno[];
  solicitudesFiltradas: SolicitudRevisionAlumno[];
  resumen: ResumenSolicitudes;
  cargando: boolean;
  estadoCarga?: 'inactivo' | 'cargando' | 'error' | 'listo';
  solicitudesCargadas?: boolean;
  errorCarga?: string;
  onReintentarCarga?: () => void;
  resolviendoSolicitudId: string;
  mensaje: string;
  filtro: string;
  respuestaPorSolicitudId: Record<string, string>;
  puedeCalificar: boolean;
  onCambiarFiltro: (valor: string) => void;
  onCambiarRespuesta: (actualizar: (previo: Record<string, string>) => Record<string, string>) => void;
  onSincronizar: () => Promise<void>;
  onResolver: (solicitud: SolicitudRevisionAlumno, estado: 'atendida' | 'rechazada') => Promise<void>;
  avisarSinPermiso: (mensaje: string) => void;
};

export function SolicitudesRevisionPanel({
  solicitudes,
  solicitudesFiltradas,
  resumen,
  cargando,
  estadoCarga = 'listo',
  solicitudesCargadas = true,
  errorCarga = '',
  onReintentarCarga,
  resolviendoSolicitudId,
  mensaje,
  filtro,
  respuestaPorSolicitudId,
  puedeCalificar,
  onCambiarFiltro,
  onCambiarRespuesta,
  onSincronizar,
  onResolver,
  avisarSinPermiso
}: SolicitudesRevisionPanelProps) {
  return (
    <section className="panel calificaciones-revision-panel anim-fade-in">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill banco-section-pill--amber">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Buzón de Aclaraciones</span>
          </span>
          <h3 id="calificaciones-aclaraciones-heading" tabIndex={-1} className="entregas-title-heading">
            <Icono nombre="info" /> Solicitudes de revisión del alumno
          </h3>
          <p className="nota">Atiende solicitudes de aclaración enviadas por los alumnos desde su portal.</p>
        </div>
        {solicitudesCargadas && <div className="banco-section-side-meta">
          <span className="banco-counter-tag banco-counter-tag--amber">Pendientes: {resumen.pendientes}</span>
          <span className="banco-counter-tag banco-counter-tag--emerald">Atendidas: {resumen.atendidas}</span>
          <span className="banco-counter-tag">Rechazadas: {resumen.rechazadas}</span>
        </div>}
      </div>
      <div className="item-actions calificaciones-revision-panel__toolbar">
        <button
          type="button"
          className="boton secundario"
          disabled={cargando || (estadoCarga === 'cargando' && !solicitudesCargadas) || resolviendoSolicitudId.length > 0}
          onClick={() => {
            if (!puedeCalificar) {
              avisarSinPermiso('No tienes permiso para revisar solicitudes.');
              return;
            }
            void onSincronizar();
          }}
        >
          <Icono nombre="recargar" /> {cargando ? 'Sincronizando...' : estadoCarga === 'cargando' && !solicitudesCargadas ? 'Cargando solicitudes…' : 'Sincronizar solicitudes'}
        </button>
      </div>
      {estadoCarga === 'cargando' && !solicitudesCargadas && <p role="status">Cargando solicitudes de revisión…</p>}
      {estadoCarga === 'cargando' && solicitudesCargadas && <p role="status">Actualizando solicitudes de revisión…</p>}
      {errorCarga && <>
        <InlineMensaje tipo="error">{errorCarga}</InlineMensaje>
        {onReintentarCarga && <div className="item-actions">
          <Boton type="button" variante="secundario" onClick={onReintentarCarga} disabled={estadoCarga === 'cargando'} cargando={estadoCarga === 'cargando'}>
            Reintentar carga de solicitudes
          </Boton>
        </div>}
      </>}
      {solicitudesCargadas && <div className="campo">
        <label className="campo__label" htmlFor="calificaciones-revision-busqueda">Buscar solicitud</label>
        <input
          id="calificaciones-revision-busqueda"
          value={filtro}
          onChange={(event) => onCambiarFiltro(event.target.value)}
          placeholder="Folio o palabra clave"
          aria-describedby="calificaciones-revision-busqueda-ayuda"
          disabled={solicitudes.length === 0}
        />
        <small id="calificaciones-revision-busqueda-ayuda" className="ayuda">Busca por folio, estado, pregunta o comentario.</small>
      </div>}
      {mensaje && <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'info'}>{mensaje}</InlineMensaje>}
      {solicitudesCargadas && solicitudes.length === 0 && <InlineMensaje tipo="info">Sin solicitudes pendientes de revisión.</InlineMensaje>}
      {solicitudesCargadas && solicitudes.length > 0 && solicitudesFiltradas.length === 0 && (
        <InlineMensaje tipo="info">No hay solicitudes que coincidan con el filtro.</InlineMensaje>
      )}
      <ul className="lista lista-items">
        {solicitudesCargadas && solicitudesFiltradas.map((solicitud) => {
          const respuesta = String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim();
          const bloqueado = respuesta.length < 8 || resolviendoSolicitudId.length > 0;
          const idCampoRespuesta = `solicitud-revision-respuesta-${solicitud._id ?? solicitud.externoId}`;
          const idAyudaRespuesta = `${idCampoRespuesta}-ayuda`;
          const identidadSolicitud = `folio ${solicitud.folio}, pregunta ${solicitud.numeroPregunta}`;
          const procesandoSolicitud = resolviendoSolicitudId === solicitud._id;
          return (
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
                <div className="campo calificaciones-revision-panel__campo">
                  <label className="campo__label" htmlFor={idCampoRespuesta}>Respuesta para el alumno</label>
                  <textarea
                    id={idCampoRespuesta}
                    className="calificaciones-revision-panel__respuesta"
                    rows={2}
                    required
                    aria-label={`Respuesta para el alumno, ${identidadSolicitud}`}
                    aria-describedby={idAyudaRespuesta}
                    placeholder="Escribe la respuesta que recibirá el alumno"
                    value={respuestaPorSolicitudId[solicitud.externoId] ?? ''}
                    onChange={(event) =>
                      onCambiarRespuesta((previo) => ({ ...previo, [solicitud.externoId]: event.target.value }))
                    }
                  />
                  <small id={idAyudaRespuesta} className="ayuda">Obligatoria. Escribe al menos 8 caracteres; se enviará al alumno.</small>
                </div>
                <div className="item-actions calificaciones-revision-panel__actions">
                  <button
                    className="boton secundario"
                    type="button"
                    disabled={!solicitud._id || bloqueado}
                    aria-label={`${procesandoSolicitud ? 'Procesando...' : 'Marcar atendida'}, ${identidadSolicitud}`}
                    onClick={() => void onResolver(solicitud, 'atendida')}
                  >
                    <Icono nombre="ok" /> {procesandoSolicitud ? 'Procesando...' : 'Marcar atendida'}
                  </button>
                  <button
                    className="boton secundario"
                    type="button"
                    disabled={!solicitud._id || bloqueado}
                    aria-label={`${procesandoSolicitud ? 'Procesando...' : 'Rechazar'}, ${identidadSolicitud}`}
                    onClick={() => void onResolver(solicitud, 'rechazada')}
                  >
                    <Icono nombre="salir" /> {procesandoSolicitud ? 'Procesando...' : 'Rechazar'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
