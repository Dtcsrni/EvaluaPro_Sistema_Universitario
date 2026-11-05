/**
 * SeccionSincronizacionEquipos
 *
 * Operación de sincronización entre computadoras mediante un servidor intermedio.
 */
import { useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { convertirFechaLocalAISO, formatearFechaSincronizacion } from './sincronizacionUtils';
import { registrarAccionDocente } from './telemetriaDocente';
import type { RespuestaSyncPull, RespuestaSyncPush } from './tipos';
import { mensajeDeError } from './utilidades';

type ReporteOperacion = {
  tipo: 'push' | 'pull';
  estado: 'info' | 'ok' | 'error';
  mensaje: string;
  ejecutadoEn: number;
  duracionMs: number;
  conteos?: Record<string, number>;
  cursor?: string | null;
  paquetesRecibidos?: number;
  pdfsGuardados?: number;
};

export function SeccionSincronizacionEquipos({
  onPushServidor,
  onPullServidor
}: {
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const [incluyePdfs, setIncluyePdfs] = useState(false);
  const [desde, setDesde] = useState('');
  const [limitePull, setLimitePull] = useState(20);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'ok' | 'warning' | 'error'>('info');
  const [ultimoCursor, setUltimoCursor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [reporte, setReporte] = useState<ReporteOperacion | null>(null);

  const limiteNormalizado = useMemo(() => {
    if (!Number.isFinite(limitePull)) return 20;
    return Math.max(1, Math.min(20, Math.floor(limitePull)));
  }, [limitePull]);

  async function enviarCambios() {
    const inicio = Date.now();
    try {
      setEnviando(true);
      setMensaje('');
      setTipoMensaje('info');
      setReporte(null);
      const desdeIso = convertirFechaLocalAISO(desde);
      const respuesta = await onPushServidor({
        incluirPdfs: incluyePdfs,
        ...(desdeIso ? { desde: desdeIso } : {})
      });
      const msg = respuesta.mensaje || 'Paquete enviado';
      const estado = msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok';
      setMensaje(msg);
      setTipoMensaje(estado);
      setUltimoCursor(respuesta.cursor || respuesta.exportadoEn || null);
      setReporte({
        tipo: 'push',
        estado,
        mensaje: msg,
        ejecutadoEn: Date.now(),
        duracionMs: Date.now() - inicio,
        conteos: respuesta.conteos,
        cursor: respuesta.cursor || respuesta.exportadoEn || null
      });
      registrarAccionDocente('sync_push_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo enviar');
      setMensaje(msg);
      setTipoMensaje('error');
      setReporte({ tipo: 'push', estado: 'error', mensaje: msg, ejecutadoEn: Date.now(), duracionMs: Date.now() - inicio });
      const accionSesion = accionToastSesionParaError(error, 'docente');
      if (accionSesion) {
        emitToast({
          level: 'error',
          title: 'Renueva tu sesión',
          message: 'La sesión debe renovarse para enviar cambios.',
          durationMs: 5200,
          action: accionSesion
        });
      }
      registrarAccionDocente('sync_push_servidor', false);
    } finally {
      setEnviando(false);
    }
  }

  async function traerCambios() {
    const inicio = Date.now();
    try {
      setTrayendo(true);
      setMensaje('');
      setTipoMensaje('info');
      setReporte(null);
      const desdeIso = convertirFechaLocalAISO(desde);
      const respuesta = await onPullServidor({
        ...(desdeIso ? { desde: desdeIso } : {}),
        limite: limiteNormalizado
      });
      const msg = respuesta.mensaje || 'Paquetes aplicados';
      const estado = msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok';
      setMensaje(msg);
      setTipoMensaje(estado);
      if (respuesta.ultimoCursor) {
        setUltimoCursor(respuesta.ultimoCursor);
      }
      setReporte({
        tipo: 'pull',
        estado,
        mensaje: msg,
        ejecutadoEn: Date.now(),
        duracionMs: Date.now() - inicio,
        cursor: respuesta.ultimoCursor,
        paquetesRecibidos: respuesta.paquetesRecibidos,
        pdfsGuardados: respuesta.pdfsGuardados
      });
      registrarAccionDocente('sync_pull_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron traer cambios');
      setMensaje(msg);
      setTipoMensaje('error');
      setReporte({ tipo: 'pull', estado: 'error', mensaje: msg, ejecutadoEn: Date.now(), duracionMs: Date.now() - inicio });
      const accionSesion = accionToastSesionParaError(error, 'docente');
      if (accionSesion) {
        emitToast({
          level: 'error',
          title: 'Renueva tu sesión',
          message: 'La sesión debe renovarse para recibir cambios.',
          durationMs: 5200,
          action: accionSesion
        });
      }
      registrarAccionDocente('sync_pull_servidor', false);
    } finally {
      setTrayendo(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main shell-main--sync-equipos">
        <h2 id="sync-equipos-heading" tabIndex={-1}>
          <Icono nombre="sincronizacion" /> Sincronización entre equipos
        </h2>
        <p className="nota">
          El servidor conserva los cambios para que los demás equipos puedan recibirlos después; no es necesario que estén conectados al mismo tiempo.
        </p>

        <div className="estado-datos-grid" role="group" aria-label="Parámetros de sincronización entre equipos">
          <label className="campo campo--checkbox">
            <input type="checkbox" checked={incluyePdfs} onChange={(e) => setIncluyePdfs(e.target.checked)} />
            Incluir PDFs en el envío (aumenta el tamaño)
          </label>
          <div className="campo">
            <label htmlFor="sync-equipos-desde">Cambios desde (opcional)</label>
            <input
              id="sync-equipos-desde"
              type="datetime-local"
              value={desde}
              aria-describedby="sync-equipos-desde-ayuda"
              onChange={(e) => setDesde(e.target.value)}
            />
            <small id="sync-equipos-desde-ayuda" className="ayuda">
              Usa la hora local del equipo. Se aplica al enviar y traer; si queda vacío, cada operación continúa desde su último cursor guardado.
            </small>
          </div>
          <div className="campo">
            <label htmlFor="sync-equipos-limite">Máximo de paquetes por recibir</label>
            <input
              id="sync-equipos-limite"
              type="number"
              min={1}
              max={20}
              step={1}
              value={limiteNormalizado}
              aria-describedby="sync-equipos-limite-ayuda"
              onChange={(e) => setLimitePull(Number(e.target.value || 20))}
            />
            <small id="sync-equipos-limite-ayuda" className="ayuda">
              Solo para «Traer cambios»: de 1 a 20 paquetes por consulta. El valor inicial es 20.
            </small>
          </div>
        </div>

        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={enviando} disabled={trayendo} onClick={enviarCambios}>
            {enviando ? 'Enviando...' : 'Enviar cambios (push)'}
          </Boton>
          <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={trayendo} disabled={enviando} onClick={traerCambios}>
            {trayendo ? 'Trayendo...' : 'Traer cambios (pull)'}
          </Boton>
        </div>

        {ultimoCursor && <div className="nota">Última marca de sincronización: {formatearFechaSincronizacion(ultimoCursor)}</div>}

        {reporte && (
          <div className="item-glass">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Última operación: {reporte.tipo.toUpperCase()}</div>
                <div className="nota">{formatearFechaSincronizacion(reporte.ejecutadoEn)} · {reporte.duracionMs} ms</div>
              </div>
              <span className={`estado-chip ${reporte.estado === 'error' ? 'error' : reporte.estado === 'ok' ? 'ok' : 'info'}`}>
                {reporte.estado === 'error' ? 'Error' : reporte.estado === 'ok' ? 'Completado' : 'Sin cambios'}
              </span>
            </div>
            {reporte.tipo === 'push' && reporte.conteos && (
              <div className="nota">
                {Object.entries(reporte.conteos)
                  .map(([clave, valor]) => `${clave}: ${valor}`)
                  .join(' | ')}
              </div>
            )}
            {reporte.tipo === 'pull' && (
              <div className="nota">
                Paquetes recibidos: {reporte.paquetesRecibidos ?? 0} · PDFs guardados: {reporte.pdfsGuardados ?? 0}
              </div>
            )}
          </div>
        )}

        {mensaje && <InlineMensaje tipo={tipoMensaje}>{mensaje}</InlineMensaje>}
      </div>

      <aside className="shell-aside" aria-label="Ayuda de sincronización entre equipos">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Operación recomendada entre computadoras">
            <p>
              <b>Push (enviar):</b> ejecútalo en la computadora que tiene los cambios más recientes.
            </p>
            <p>
              <b>Pull (traer):</b> ejecútalo en las demás computadoras para aplicar los cambios pendientes.
            </p>
            <ul className="lista">
              <li>Usa la misma cuenta docente en todos los equipos.</li>
              <li>Si hay lotes grandes, primero push sin PDFs y luego una corrida con PDFs.</li>
              <li>Antes de sesiones críticas, exporta una instantánea local completa (.ep-snapshot).</li>
            </ul>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}
