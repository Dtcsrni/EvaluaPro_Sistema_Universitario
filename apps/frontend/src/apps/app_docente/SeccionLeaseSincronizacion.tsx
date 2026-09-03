/** Coordinacion de escritura entre equipos mediante lease temporal. */
import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { esMensajeError, mensajeDeError } from './utilidades';
import type { MetodoInstantaneaLocal } from './SeccionInstantaneaLocal';

export type EstadoLeaseUI = {
  configurado: boolean;
  directorio?: string;
  origen?: 'docente' | 'entorno';
  proveedor: 'carpeta-sincronizada';
  ttlMs: number;
  modo: 'escritura' | 'solo_lectura' | 'disponible';
  lease?: { leaseId: string; equipoId: string; adquiridoEn: string; ultimoHeartbeatEn: string; expiraEn: string; propio: boolean };
  snapshot?: { archivo: string; checksumSha256: string; exportadoEn: string; publicadoEn: string; conteos: { baseDatosBytes: number; archivos: number; archivosBytes: number } };
};

type Conteos = { baseDatosBytes: number; archivos: number; archivosBytes: number };

export function SeccionLeaseSincronizacion({
  estado,
  puedeUsarContrasena,
  puedeUsarGoogle,
  onAdquirir,
  onLiberar,
  onPublicar,
  onImportar
}: {
  estado: EstadoLeaseUI | null;
  puedeUsarContrasena: boolean;
  puedeUsarGoogle: boolean;
  onAdquirir: () => Promise<EstadoLeaseUI>;
  onLiberar: () => Promise<unknown>;
  onPublicar: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string }) => Promise<{ checksumSha256?: string; conteos?: Conteos; mensaje?: string }>;
  onImportar: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string; dryRun: boolean }) => Promise<{ checksumSha256?: string; conteos?: Conteos; mensaje?: string; requiereReinicioSesion?: boolean }>;
}) {
  const confirmar = useConfirmDialog();
  const [metodo, setMetodo] = useState<MetodoInstantaneaLocal>(puedeUsarContrasena ? 'contrasena' : 'google');
  const [credencial, setCredencial] = useState('');
  const [credencialGoogle, setCredencialGoogle] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (metodo === 'contrasena' && !puedeUsarContrasena && puedeUsarGoogle) setMetodo('google');
    if (metodo === 'google' && !puedeUsarGoogle && puedeUsarContrasena) setMetodo('contrasena');
  }, [metodo, puedeUsarContrasena, puedeUsarGoogle]);

  const credencialActual = metodo === 'google' ? credencialGoogle : credencial;


  async function adquirir() {
    setOcupado(true);
    setMensaje('');
    try { await onAdquirir(); setMensaje('Control de edición adquirido en este equipo.'); }
    catch (error) { const texto = mensajeDeError(error, 'No se pudo adquirir el control de edición'); setMensaje(texto); emitToast({ level: 'error', title: 'Control ocupado', message: texto, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') }); }
    finally { setOcupado(false); }
  }

  async function liberar() {
    setOcupado(true);
    try { await onLiberar(); setMensaje('Control liberado. Otro equipo podrá trabajar con los datos.'); }
    catch (error) { setMensaje(mensajeDeError(error, 'No se pudo liberar el control')); }
    finally { setOcupado(false); }
  }

  async function publicar() {
    if (!credencialActual) { setMensaje(metodo === 'google' ? 'Reautentica la cuenta Google antes de publicar.' : 'Escribe la contraseña actual antes de publicar.'); return; }
    setOcupado(true);
    try { const resultado = await onPublicar({ metodo, credencial: credencialActual }); setMensaje(resultado.mensaje || 'Instantánea publicada y control liberado.'); emitToast({ level: 'ok', title: 'Sincronización en nube', message: 'Datos publicados; el equipo queda desbloqueado.', durationMs: 3200 }); }
    catch (error) { setMensaje(mensajeDeError(error, 'No se pudo publicar la instantánea')); }
    finally { setCredencial(''); setCredencialGoogle(''); setOcupado(false); }
  }

  async function importar() {
    if (!credencialActual) { setMensaje(metodo === 'google' ? 'Reautentica la cuenta Google antes de importar.' : 'Escribe la contraseña actual antes de importar.'); return; }
    setOcupado(true);
    try {
      const validar = await onImportar({ metodo, credencial: credencialActual, dryRun: true });
      const conteos = validar.conteos;
      const detalle = conteos ? `SQLite: ${Math.round(conteos.baseDatosBytes / 1024)} KB; archivos: ${conteos.archivos}` : 'Instantánea remota válida';
      const aceptado = await confirmar({ title: 'Traer datos de la nube', message: 'Se reemplazarán los datos locales de este equipo por la última instantánea publicada.', details: [detalle, 'Se conservará un respaldo local antes del reemplazo.', 'Al finalizar se liberará el control y deberás iniciar sesión nuevamente.'], confirmLabel: 'Sí, traer datos', tone: 'warning' });
      if (!aceptado) { setMensaje('Importación cancelada.'); return; }
      const resultado = await onImportar({ metodo, credencial: credencialActual, dryRun: false });
      setMensaje(resultado.mensaje || 'Datos importados desde la nube y control liberado.');
      emitToast({ level: 'ok', title: 'Sincronización en nube', message: 'Datos importados; inicia sesión nuevamente.', durationMs: 3200 });
      if (resultado.requiereReinicioSesion) window.location.reload();
    } catch (error) { setMensaje(mensajeDeError(error, 'No se pudo traer la instantánea')); }
    finally { setCredencial(''); setCredencialGoogle(''); setOcupado(false); }
  }

  if (!estado || !estado.configurado) return null;
  const leaseActivo = estado.modo === 'escritura' && Boolean(estado.lease?.propio);
  const hayMetodoDisponible = puedeUsarContrasena || puedeUsarGoogle;
  const expiraTexto = estado.lease ? new Date(estado.lease.expiraEn).toLocaleTimeString() : '';

  return (
    <div className="panel paquete-sincronizacion-panel" data-testid="sincronizacion-coordinada">
      <h2><Icono nombre="recargar" /> Trabajo coordinado entre equipos</h2>
      <p className="nota">La carpeta configurada de OneDrive transporta snapshots cifrados. Solo el equipo con el control temporal puede modificar y publicar datos.</p>
      {!hayMetodoDisponible && <InlineMensaje tipo="warning">No hay un método de desbloqueo configurado para publicar o traer snapshots. Configura Google OAuth con el secreto compartido o habilita la contraseña docente.</InlineMensaje>}
      <p className="nota" data-testid="sincronizacion-carpeta">Carpeta: <code>{estado.directorio}</code>{estado.origen === 'entorno' ? ' · configuración de entorno' : ' · seleccionada por el docente'}</p>
      {estado.modo === 'solo_lectura' && estado.lease && <InlineMensaje tipo="info">Otro equipo tiene el control hasta aproximadamente las {expiraTexto}. Este equipo permanece en solo lectura.</InlineMensaje>}
      {estado.modo === 'disponible' && <InlineMensaje tipo="info">No hay otro equipo trabajando. Adquiere el control para editar y sincronizar.</InlineMensaje>}
      {leaseActivo && <InlineMensaje tipo="ok">Control activo en este equipo; se renueva automáticamente. Expira aproximadamente a las {expiraTexto}.</InlineMensaje>}

      {hayMetodoDisponible && <div className="grid">
        <label className="campo">Protección de publicación
          <select value={metodo} onChange={(event) => setMetodo(event.target.value as MetodoInstantaneaLocal)}>
            {puedeUsarContrasena && <option value="contrasena">Contraseña de la cuenta docente</option>}
            {puedeUsarGoogle && <option value="google">Cuenta Google vinculada</option>}
          </select>
        </label>
        {metodo === 'contrasena' && <label className="campo">Contraseña actual<input type="password" value={credencial} onChange={(event) => setCredencial(event.target.value)} autoComplete="current-password" /></label>}
      </div>}
      {hayMetodoDisponible && metodo === 'google' && puedeUsarGoogle && <div className="campo"><span>Reautenticación para proteger la instantánea</span><GoogleLogin onSuccess={(respuesta) => setCredencialGoogle(respuesta.credential || '')} onError={() => setMensaje('No se pudo validar la cuenta Google.')} useOneTap={false} theme="filled_blue" size="medium" text="continue_with" />{credencialGoogle && <span className="nota">Cuenta Google validada para esta operación.</span>}</div>}

      <div className="acciones">
        {!leaseActivo && <Boton type="button" disabled={!hayMetodoDisponible} cargando={ocupado} onClick={adquirir}>Tomar control de edición</Boton>}
        {leaseActivo && <>
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={ocupado} onClick={publicar}>Publicar y liberar</Boton>
          <Boton type="button" variante="secundario" cargando={ocupado} onClick={importar}>Traer última instantánea</Boton>
          <Boton type="button" variante="secundario" cargando={ocupado} onClick={liberar}>Liberar sin publicar</Boton>
        </>}
      </div>
      {estado.snapshot && <InlineMensaje tipo="info">Última publicación: {new Date(estado.snapshot.publicadoEn).toLocaleString()} · checksum {estado.snapshot.checksumSha256.slice(0, 12)}…</InlineMensaje>}
      {mensaje && <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">{mensaje}</p>}
    </div>
  );
}
