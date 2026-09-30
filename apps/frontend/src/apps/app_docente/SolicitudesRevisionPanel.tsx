import { Icono } from '../../ui/iconos';
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
          <h3 className="entregas-title-heading">
            <Icono nombre="info" /> Solicitudes de revisión del alumno
          </h3>
          <p className="nota">Atiende solicitudes de aclaración enviadas por los alumnos desde su portal.</p>
        </div>
        <div className="banco-section-side-meta">
          <span className="banco-counter-tag banco-counter-tag--amber">Pendientes: {resumen.pendientes}</span>
          <span className="banco-counter-tag banco-counter-tag--emerald">Atendidas: {resumen.atendidas}</span>
          <span className="banco-counter-tag">Rechazadas: {resumen.rechazadas}</span>
        </div>
      </div>
      <div className="item-actions calificaciones-revision-panel__toolbar">
        <button
          type="button"
          className="boton secundario"
          disabled={cargando || resolviendoSolicitudId.length > 0}
          onClick={() => {
            if (!puedeCalificar) {
              avisarSinPermiso('No tienes permiso para revisar solicitudes.');
              return;
            }
            void onSincronizar();
          }}
        >
          <Icono nombre="recargar" /> {cargando ? 'Sincronizando...' : 'Sincronizar solicitudes'}
        </button>
      </div>
      <label className="campo">
        Buscar solicitud
        <input
          value={filtro}
          onChange={(event) => onCambiarFiltro(event.target.value)}
          placeholder="Folio, estado, pregunta o comentario"
          disabled={solicitudes.length === 0}
        />
      </label>
      {mensaje && <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'info'}>{mensaje}</InlineMensaje>}
      {solicitudes.length === 0 && <InlineMensaje tipo="info">Sin solicitudes pendientes de revisión.</InlineMensaje>}
      {solicitudes.length > 0 && solicitudesFiltradas.length === 0 && (
        <InlineMensaje tipo="info">No hay solicitudes que coincidan con el filtro.</InlineMensaje>
      )}
      <ul className="lista lista-items">
        {solicitudesFiltradas.map((solicitud) => {
          const respuesta = String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim();
          const bloqueado = respuesta.length < 8 || resolviendoSolicitudId.length > 0;
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
                <textarea
                  className="calificaciones-revision-panel__respuesta"
                  rows={2}
                  placeholder="Respuesta obligatoria para el alumno (mínimo 8 caracteres)"
                  value={respuestaPorSolicitudId[solicitud.externoId] ?? ''}
                  onChange={(event) =>
                    onCambiarRespuesta((previo) => ({ ...previo, [solicitud.externoId]: event.target.value }))
                  }
                />
                <div className="item-actions calificaciones-revision-panel__actions">
                  <button
                    className="boton secundario"
                    type="button"
                    disabled={!solicitud._id || bloqueado}
                    onClick={() => void onResolver(solicitud, 'atendida')}
                  >
                    <Icono nombre="ok" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando...' : 'Marcar atendida'}
                  </button>
                  <button
                    className="boton secundario"
                    type="button"
                    disabled={!solicitud._id || bloqueado}
                    onClick={() => void onResolver(solicitud, 'rechazada')}
                  >
                    <Icono nombre="salir" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando...' : 'Rechazar'}
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
