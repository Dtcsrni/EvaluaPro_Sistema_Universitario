/**
 * SeccionInstantaneaLocal
 *
 * Responsabilidad: exportar e importar el estado local completo del docente.
 * El archivo incluye SQLite y artefactos generados, no configuracion secreta.
 */
import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { limpiarTokenDocente } from '../../servicios_api/clienteApi';
import { registrarAccionDocente } from './telemetriaDocente';
import { esMensajeError, mensajeDeError } from './utilidades';

export type MetodoInstantaneaLocal = 'contrasena' | 'google';

type ConteosInstantanea = { baseDatosBytes: number; archivos: number; archivosBytes: number };

function construirSolicitud(archivo: ArrayBuffer, metodo: MetodoInstantaneaLocal, credencial: string, dryRun: boolean) {
  const cabecera = new TextEncoder().encode(JSON.stringify({ metodo, ...(credencial ? { credencial } : {}), dryRun }));
  if (cabecera.length > 4096) throw new Error('La credencial es demasiado larga');
  const cuerpo = new Uint8Array(4 + cabecera.length + archivo.byteLength);
  new DataView(cuerpo.buffer).setUint32(0, cabecera.length);
  cuerpo.set(cabecera, 4);
  cuerpo.set(new Uint8Array(archivo), 4 + cabecera.length);
  return cuerpo;
}

function formatearBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SeccionInstantaneaLocal({
  puedeUsarContrasena,
  puedeUsarGoogle,
  onExportar,
  onImportar
}: {
  puedeUsarContrasena: boolean;
  puedeUsarGoogle: boolean;
  onExportar: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string }) => Promise<{ archivo: Blob; nombreArchivo: string; checksumSha256: string; exportadoEn: string; conteos: ConteosInstantanea }>;
  onImportar: (payload: { cuerpo: Uint8Array }) => Promise<{ mensaje?: string; checksumSha256?: string; conteos?: ConteosInstantanea; requiereReinicioSesion?: boolean }>;
}) {
  const confirmar = useConfirmDialog();
  const metodoInicial: MetodoInstantaneaLocal = puedeUsarContrasena ? 'contrasena' : 'google';
  const [metodo, setMetodo] = useState<MetodoInstantaneaLocal>(metodoInicial);
  const [credencial, setCredencial] = useState('');
  const [credencialGoogle, setCredencialGoogle] = useState('');
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ultimoArchivo, setUltimoArchivo] = useState('');
  const [ultimoChecksum, setUltimoChecksum] = useState('');
  const [ultimoResumen, setUltimoResumen] = useState<ConteosInstantanea | null>(null);

  useEffect(() => {
    if (metodo === 'contrasena' && !puedeUsarContrasena && puedeUsarGoogle) setMetodo('google');
    if (metodo === 'google' && !puedeUsarGoogle && puedeUsarContrasena) setMetodo('contrasena');
  }, [metodo, puedeUsarContrasena, puedeUsarGoogle]);

  const hayMetodoDisponible = puedeUsarContrasena || puedeUsarGoogle;

  function descargar(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  async function exportar() {
    const credencialActual = metodo === 'google' ? credencialGoogle : credencial;
    if (!credencialActual) {
      setMensaje(metodo === 'google' ? 'Reautentica la cuenta Google para proteger el archivo.' : 'Escribe la contraseña actual de tu cuenta docente.');
      return;
    }
    const inicio = Date.now();
    setExportando(true);
    setMensaje('');
    try {
      const resultado = await onExportar({ metodo, ...(credencialActual ? { credencial: credencialActual } : {}) });
      descargar(resultado.archivo, resultado.nombreArchivo);
      setUltimoArchivo(resultado.nombreArchivo);
      setUltimoChecksum(resultado.checksumSha256);
      setUltimoResumen(resultado.conteos);
      setMensaje(`Instantánea exportada (${formatearBytes(resultado.conteos.baseDatosBytes)} de SQLite y ${resultado.conteos.archivos} archivos).`);
      emitToast({ level: 'ok', title: 'Sincronización local', message: 'Archivo .ep-snapshot descargado', durationMs: 2800 });
      registrarAccionDocente('sync_instantanea_local_exportar', true, Date.now() - inicio);
    } catch (error) {
      const texto = mensajeDeError(error, 'No se pudo exportar la instantánea');
      setMensaje(texto);
      emitToast({ level: 'error', title: 'No se pudo exportar', message: texto, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
      registrarAccionDocente('sync_instantanea_local_exportar', false);
    } finally {
      setCredencial('');
      setCredencialGoogle('');
      setExportando(false);
    }
  }

  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    const credencialActual = metodo === 'google' ? credencialGoogle : credencial;
    if (!credencialActual) {
      setMensaje(metodo === 'google' ? 'Reautentica la cuenta Google antes de importar.' : 'Escribe la contraseña actual de tu cuenta docente antes de importar.');
      return;
    }
    const inicio = Date.now();
    setImportando(true);
    setMensaje('');
    setUltimoArchivo(archivo.name);
    try {
      const bytes = await archivo.arrayBuffer();
      const validar = await onImportar({ cuerpo: construirSolicitud(bytes, metodo, credencialActual, true) });
      const conteos = validar.conteos;
      const detalle = conteos ? `SQLite: ${formatearBytes(conteos.baseDatosBytes)}; archivos: ${conteos.archivos} (${formatearBytes(conteos.archivosBytes)})` : 'Contenido local completo';
      const aceptado = await confirmar({
        title: 'Reemplazar datos locales',
        message: 'La importación reemplazará la base SQLite y los archivos generados de esta computadora.',
        details: [detalle, 'Se creará un respaldo automático antes del reemplazo.', 'Después deberás iniciar sesión nuevamente.'],
        confirmLabel: 'Sí, reemplazar e importar',
        tone: 'warning'
      });
      if (!aceptado) {
        setMensaje('Importación cancelada. No se modificaron datos.');
        registrarAccionDocente('sync_instantanea_local_importar_cancelado', true, Date.now() - inicio);
        return;
      }
      const resultado = await onImportar({ cuerpo: construirSolicitud(bytes, metodo, credencialActual, false) });
      setUltimoChecksum(resultado.checksumSha256 || '');
      setUltimoResumen(resultado.conteos || conteos || null);
      setMensaje(resultado.mensaje || 'Instantánea importada 1:1.');
      emitToast({ level: 'ok', title: 'Sincronización local', message: 'Datos importados; inicia sesión nuevamente', durationMs: 3200 });
      registrarAccionDocente('sync_instantanea_local_importar', true, Date.now() - inicio);
      if (resultado.requiereReinicioSesion) {
        limpiarTokenDocente();
        window.setTimeout(() => window.location.reload(), 900);
      }
    } catch (error) {
      const texto = mensajeDeError(error, 'No se pudo importar la instantánea');
      setMensaje(texto);
      emitToast({ level: 'error', title: 'No se pudo importar', message: texto, durationMs: 5600, action: accionToastSesionParaError(error, 'docente') });
      registrarAccionDocente('sync_instantanea_local_importar', false);
    } finally {
      setCredencial('');
      setCredencialGoogle('');
      setImportando(false);
    }
  }

  return (
    <div className="panel paquete-sincronizacion-panel">
      <h2><Icono nombre="recargar" /> Sincronización local 1:1</h2>
      <p className="nota">Mueve todos los datos docentes de esta instalación mediante un único archivo cifrado. OneDrive, USB o cualquier carpeta solo transportan el archivo; no se sincroniza la SQLite en vivo.</p>

      {!hayMetodoDisponible && <InlineMensaje tipo="warning">No hay un método de desbloqueo configurado para esta instalación. Un administrador debe configurar Google OAuth y el secreto compartido de snapshots, o habilitar el acceso mediante contraseña.</InlineMensaje>}

      {hayMetodoDisponible && <>
      <div className="grid">
        <label className="campo">
          Protección del archivo
          <select value={metodo} onChange={(event) => setMetodo(event.target.value as MetodoInstantaneaLocal)}>
            {puedeUsarContrasena && <option value="contrasena">Contraseña de la cuenta docente</option>}
            {puedeUsarGoogle && <option value="google">Cuenta Google vinculada</option>}
          </select>
        </label>
        {metodo === 'contrasena' && (
          <label className="campo">
            Contraseña actual
            <input type="password" value={credencial} onChange={(event) => setCredencial(event.target.value)} autoComplete="current-password" />
          </label>
        )}
      </div>

      {metodo === 'google' && puedeUsarGoogle && (
        <div className="campo">
          <span>Reautenticación para desbloqueo</span>
          <GoogleLogin
            onSuccess={(respuesta) => setCredencialGoogle(respuesta.credential || '')}
            onError={() => setMensaje('No se pudo validar la cuenta Google. Revisa la conexión e inténtalo nuevamente.')}
            useOneTap={false}
            theme="filled_blue"
            size="medium"
            text="continue_with"
          />
          {credencialGoogle && <span className="nota">Cuenta Google validada para esta operación.</span>}
        </div>
      )}

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="publicar" />} cargando={exportando} onClick={exportar}>
          {exportando ? 'Preparando...' : 'Exportar archivo cifrado'}
        </Boton>
        <label className={importando ? 'boton boton--secundario boton--disabled' : 'boton boton--secundario'}>
          <Icono nombre="entrar" /> {importando ? 'Validando...' : 'Importar archivo 1:1'}
          <input type="file" accept=".ep-snapshot,application/octet-stream" onChange={importar} disabled={importando} className="input-file-oculto" />
        </label>
      </div>

      {ultimoResumen && <InlineMensaje tipo="info">Último archivo: {ultimoArchivo || '-'} · SQLite {formatearBytes(ultimoResumen.baseDatosBytes)} · {ultimoResumen.archivos} archivos · checksum {ultimoChecksum ? `${ultimoChecksum.slice(0, 12)}…` : '-'}</InlineMensaje>}
      {mensaje && <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">{mensaje}</p>}
      </>}
    </div>
  );
}
