/** Preferencia de la carpeta local que OneDrive sincroniza entre equipos. */
import { useEffect, useState } from 'react';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { mensajeDeError, esMensajeError } from './utilidades';
import type { EstadoLeaseUI } from './SeccionLeaseSincronizacion';

type WebView2Bridge = {
  postMessage: (mensaje: unknown) => void;
  addEventListener: (tipo: 'message', listener: (evento: MessageEvent<{ type?: string; path?: string; cancelled?: boolean }>) => void) => void;
  removeEventListener: (tipo: 'message', listener: (evento: MessageEvent<{ type?: string; path?: string; cancelled?: boolean }>) => void) => void;
};

function obtenerPuenteWebView2(): WebView2Bridge | undefined {
  return (window as Window & { chrome?: { webview?: WebView2Bridge } }).chrome?.webview;
}

export function SeccionConfiguracionSincronizacion({
  estado,
  onConfigurar
}: {
  estado: EstadoLeaseUI | null;
  onConfigurar: (directorio: string) => Promise<EstadoLeaseUI>;
}) {
  const [directorio, setDirectorio] = useState(estado?.directorio || '');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    setDirectorio(estado?.directorio || '');
  }, [estado?.directorio]);

  useEffect(() => {
    const puente = obtenerPuenteWebView2();
    if (!puente) return undefined;
    const recibirCarpeta = (evento: MessageEvent<{ type?: string; path?: string; cancelled?: boolean }>) => {
      if (evento.data?.type !== 'EVALUAPRO_SYNC_FOLDER_SELECTED') return;
      if (evento.data.cancelled) {
        setMensaje('Selección de carpeta cancelada.');
        return;
      }
      if (evento.data.path) {
        setDirectorio(evento.data.path);
        setMensaje('Carpeta seleccionada. Confirma para guardarla.');
      }
    };
    puente.addEventListener('message', recibirCarpeta);
    return () => puente.removeEventListener('message', recibirCarpeta);
  }, []);

  function seleccionarCarpeta() {
    const puente = obtenerPuenteWebView2();
    if (!puente) {
      setMensaje('En el navegador escribe la ruta local; en la aplicación de escritorio puedes abrir el selector de carpetas.');
      return;
    }
    puente.postMessage({ type: 'EVALUAPRO_SELECT_SYNC_FOLDER' });
  }

  async function guardarCarpeta() {
    const valor = directorio.trim();
    if (!valor) {
      setMensaje('Selecciona o escribe la carpeta local que OneDrive sincroniza.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    try {
      await onConfigurar(valor);
      setMensaje('Carpeta guardada. Selecciona esta misma carpeta en los demás equipos.');
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo guardar la carpeta'));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="cuenta-subpanel cuenta-sincronizacion anim-fade-in" data-testid="configuracion-sincronizacion">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Datos y sincronización</span>
          </span>
          <h3 className="entregas-title-heading"><Icono nombre="recargar" /> Carpeta de sincronización</h3>
          <p className="nota" id="sincronizacion-carpeta-ayuda">Define una sola carpeta local por cuenta. OneDrive se encarga de sincronizarla entre tus equipos; EvaluaPro solo guarda allí snapshots cifrados y metadatos de coordinación.</p>
        </div>
        <span className={`estado-chip ${estado?.configurado ? 'ok' : 'info'}`}>{estado?.configurado ? 'Configurada' : 'Pendiente'}</span>
      </div>

      {!estado ? <InlineMensaje tipo="info">Consultando la configuración de sincronización…</InlineMensaje> : (
        <>
          <div className="cuenta-sincronizacion__form">
            <label className="campo">Carpeta local sincronizada por OneDrive
              <input aria-describedby="sincronizacion-carpeta-ayuda sincronizacion-carpeta-nota" value={directorio} onChange={(event) => setDirectorio(event.target.value)} placeholder="C:\\Users\\tu_usuario\\OneDrive\\EvaluaPro" autoComplete="off" />
            </label>
            <div className="acciones cuenta-sincronizacion__acciones">
              <Boton type="button" variante="secundario" onClick={seleccionarCarpeta}>Elegir carpeta…</Boton>
              <Boton type="button" cargando={ocupado} onClick={guardarCarpeta}>Guardar carpeta</Boton>
            </div>
          </div>
          <p className="cuenta-sincronizacion__nota" id="sincronizacion-carpeta-nota">
            {estado.configurado ? <>Carpeta activa: <code>{estado.directorio}</code>{estado.origen === 'entorno' ? ' · configuración de entorno' : ' · seleccionada por el docente'}</> : 'Selecciona la misma carpeta sincronizada en cada equipo donde uses esta cuenta.'}
          </p>
          {mensaje && <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">{mensaje}</p>}
        </>
      )}
    </div>
  );
}
