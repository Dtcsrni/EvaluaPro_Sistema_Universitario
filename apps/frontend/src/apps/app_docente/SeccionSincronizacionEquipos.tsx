/**
 * SeccionSincronizacionEquipos
 *
 * Operacion de sincronizacion entre computadoras via servidor intermedio.
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
    return Math.max(1, Math.min(200, Math.floor(limitePull)));
  }, [limitePull]);

  async function enviarCambios() {
    const inicio = Date.now();
    try {
      setEnviando(true);
      setMensaje('');
      const desdeIso = convertirFechaLocalAISO(desde);
      const respuesta = await onPushServidor({
        incluirPdfs: incluyePdfs,
        ...(desdeIso ? { desde: desdeIso } : {})
      });
      const msg = respuesta.mensaje || 'Paquete enviado';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      setUltimoCursor(respuesta.cursor || respuesta.exportadoEn || null);
      setReporte({
        tipo: 'push',
        mensaje: msg,
        ejecutadoEn: Date.now(),
        duracionMs: Date.now() - inicio,
        conteos: respuesta.conteos,
        cursor: respuesta.cursor || respuesta.exportadoEn || null
      });
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_push_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo enviar');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo enviar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
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
      const desdeIso = convertirFechaLocalAISO(desde);
      const respuesta = await onPullServidor({
        ...(desdeIso ? { desde: desdeIso } : {}),
        limite: limiteNormalizado
      });
      const msg = respuesta.mensaje || 'Paquetes aplicados';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      if (respuesta.ultimoCursor) {
        setUltimoCursor(respuesta.ultimoCursor);
      }
      setReporte({
        tipo: 'pull',
        mensaje: msg,
        ejecutadoEn: Date.now(),
        duracionMs: Date.now() - inicio,
        cursor: respuesta.ultimoCursor,
        paquetesRecibidos: respuesta.paquetesRecibidos,
        pdfsGuardados: respuesta.pdfsGuardados
      });
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_pull_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron traer cambios');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo traer cambios',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_pull_servidor', false);
    } finally {
      setTrayendo(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main">
        <h2>
          <Icono nombre="recargar" /> Sincronizacion entre equipos
        </h2>
        <p className="nota">
          Usa un servidor intermedio para mantener una sola fuente de verdad por docente, sin requerir que los equipos esten en linea al mismo tiempo.
        </p>

        <div className="estado-datos-grid" role="group" aria-label="Parametros de sincronizacion entre equipos">
          <label className="campo campo--checkbox">
            <input type="checkbox" checked={incluyePdfs} onChange={(e) => setIncluyePdfs(e.target.checked)} />
            Incluir PDFs en push (mas pesado)
          </label>
          <label className="campo">
            Desde (opcional)
            <input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="campo">
            Limite de paquetes pull
            <input
              type="number"
              min={1}
              max={200}
              step={1}
              value={limiteNormalizado}
              onChange={(e) => setLimitePull(Number(e.target.value || 20))}
            />
          </label>
        </div>

        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={enviando} onClick={enviarCambios}>
            {enviando ? 'Enviando...' : 'Enviar cambios (push)'}
          </Boton>
          <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={trayendo} onClick={traerCambios}>
            {trayendo ? 'Trayendo...' : 'Traer cambios (pull)'}
          </Boton>
        </div>

        {ultimoCursor && <div className="nota">Ultima marca de sincronizacion: {formatearFechaSincronizacion(ultimoCursor)}</div>}

        {reporte && (
          <div className="item-glass" aria-live="polite">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Ultima operacion: {reporte.tipo.toUpperCase()}</div>
                <div className="nota">{formatearFechaSincronizacion(reporte.ejecutadoEn)} · {reporte.duracionMs} ms</div>
              </div>
              <span className={`estado-chip ${tipoMensaje === 'error' ? 'error' : tipoMensaje === 'ok' ? 'ok' : 'info'}`}>
                {tipoMensaje === 'error' ? 'Error' : tipoMensaje === 'ok' ? 'Ok' : 'Info'}
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

      <aside className="shell-aside" aria-label="Ayuda de sincronizacion entre equipos">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Operacion recomendada entre computadoras">
            <p>
              <b>Push:</b> ejecutalo en la computadora que tiene los cambios mas recientes.
            </p>
            <p>
              <b>Pull:</b> ejecutalo en las computadoras restantes para aplicar cambios pendientes.
            </p>
            <ul className="lista">
              <li>Usa la misma cuenta docente en todos los equipos.</li>
              <li>Si hay lotes grandes, primero push sin PDFs y luego una corrida con PDFs.</li>
              <li>Antes de sesiones criticas, exporta backup local por archivo.</li>
            </ul>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}
