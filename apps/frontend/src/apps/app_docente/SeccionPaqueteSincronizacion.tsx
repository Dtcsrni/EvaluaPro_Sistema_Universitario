/**
 * SeccionPaqueteSincronizacion
 *
 * Exportacion/importacion manual de paquetes para mover datos entre computadoras.
 */
import { useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { IconoLucide, PackageOpen } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { convertirFechaLocalAISO } from './sincronizacionUtils';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { etiquetaMateria, mensajeDeError } from './utilidades';

const BACKUP_FORMAT_VERSION = 2;
const BACKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BACKUP_LOGIC_FINGERPRINT = 'sync-v2-lww-updatedAt-schema2';

type BackupMeta = {
  schemaVersion: number;
  createdAt: string;
  ttlMs: number;
  expiresAt: string;
  businessLogicFingerprint: string;
};

type RespuestaExportar = {
  paqueteBase64: string;
  checksumSha256: string;
  checksumGzipSha256?: string;
  cifrado?: boolean;
  exportadoEn: string;
  conteos: Record<string, number>;
};

function construirBackupMeta(baseIso?: string): BackupMeta {
  const createdAt = baseIso || new Date().toISOString();
  const createdAtMs = new Date(createdAt).getTime();
  const seguroMs = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
  const expiresAt = new Date(seguroMs + BACKUP_TTL_MS).toISOString();
  return {
    schemaVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    ttlMs: BACKUP_TTL_MS,
    expiresAt,
    businessLogicFingerprint: BACKUP_LOGIC_FINGERPRINT,
  };
}

function validarBackupMeta(metaRaw: unknown): string | null {
  if (!metaRaw || typeof metaRaw !== 'object') return null;
  const meta = metaRaw as Partial<BackupMeta>;
  const expiresAtRaw = String(meta.expiresAt || '').trim();
  const fingerprint = String(meta.businessLogicFingerprint || '').trim();

  if (!expiresAtRaw) {
    return 'El paquete no es válido: falta su fecha de vencimiento.';
  }

  const expiresAtMs = new Date(expiresAtRaw).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return 'El paquete no es válido: la fecha de vencimiento no tiene un formato válido.';
  }

  if (Date.now() > expiresAtMs) {
    return 'Este paquete venció. Exporta uno nuevo antes de importarlo.';
  }

  if (fingerprint && fingerprint !== BACKUP_LOGIC_FINGERPRINT) {
    return 'Este paquete ya no es compatible con las reglas actuales. Exporta uno nuevo antes de importarlo.';
  }

  return null;
}

export function SeccionPaqueteSincronizacion({
  periodos,
  docenteCorreo,
  onExportar,
  onImportar
}: {
  periodos: Periodo[];
  docenteCorreo?: string;
  onExportar: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaExportar>;
  onImportar: (payload: {
    paqueteBase64: string;
    checksumSha256?: string;
    dryRun?: boolean;
    docenteCorreo?: string;
    backupMeta?: BackupMeta;
  }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
}) {
  const confirm = useConfirmDialog();
  const [periodoId, setPeriodoId] = useState('');
  const [desde, setDesde] = useState('');
  const [incluirPdfs, setIncluirPdfs] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  const [ultimoResumen, setUltimoResumen] = useState<Record<string, number> | null>(null);
  const [ultimoExportEn, setUltimoExportEn] = useState<string | null>(null);
  const [ultimoArchivoExportado, setUltimoArchivoExportado] = useState<string | null>(null);
  const [ultimoArchivoImportado, setUltimoArchivoImportado] = useState<string | null>(null);
  const [ultimoChecksum, setUltimoChecksum] = useState<string | null>(null);
  const [ultimoBackupCifrado, setUltimoBackupCifrado] = useState<boolean | null>(null);
  const [ultimoTamanoImportadoKb, setUltimoTamanoImportadoKb] = useState<number | null>(null);

  const conteoTotalUltimoResumen = useMemo(() => {
    if (!ultimoResumen) return 0;
    return Object.values(ultimoResumen).reduce((acc, valor) => acc + (Number(valor) || 0), 0);
  }, [ultimoResumen]);

  function descargarJson(nombreArchivo: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportar() {
    try {
      const inicio = Date.now();
      setExportando(true);
      setMensaje('');
      setMensajeEsError(false);
      setUltimoResumen(null);

      const payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean } = { incluirPdfs };
      if (periodoId) payload.periodoId = periodoId;
      const desdeIso = convertirFechaLocalAISO(desde);
      if (desdeIso) payload.desde = desdeIso;

      const resp = await onExportar(payload);
      setUltimoResumen(resp.conteos);
      setUltimoExportEn(resp.exportadoEn);
      setUltimoChecksum(resp.checksumSha256 || null);
      setUltimoBackupCifrado(resp.cifrado ?? true);

      const nombre = `sincronizacion_${(resp.exportadoEn || new Date().toISOString()).replace(/[:.]/g, '-')}.ep-sync.json`;
      const backupMeta = construirBackupMeta(resp.exportadoEn);
      descargarJson(nombre, {
        version: BACKUP_FORMAT_VERSION,
        exportadoEn: resp.exportadoEn,
        checksumSha256: resp.checksumSha256,
        checksumGzipSha256: resp.checksumGzipSha256,
        cifrado: resp.cifrado ?? true,
        conteos: resp.conteos,
        paqueteBase64: resp.paqueteBase64,
        backupMeta,
        ...(docenteCorreo ? { docenteCorreo } : {})
      });
      setUltimoArchivoExportado(nombre);

      setMensaje('Paquete exportado (descarga iniciada)');
      setMensajeEsError(false);
      registrarAccionDocente('sync_paquete_exportar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo exportar el paquete');
      setMensaje(msg);
      setMensajeEsError(true);
      const accionSesion = accionToastSesionParaError(error, 'docente');
      if (accionSesion) {
        emitToast({
          level: 'error',
          title: 'Renueva tu sesión',
          message: 'La sesión debe renovarse para continuar.',
          durationMs: 5200,
          action: accionSesion
        });
      }
      registrarAccionDocente('sync_paquete_exportar', false);
    } finally {
      setExportando(false);
    }
  }

  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;

    try {
      const inicio = Date.now();
      setImportando(true);
      setMensaje('');
      setMensajeEsError(false);

      const texto = await archivo.text();
      const json = JSON.parse(texto) as {
        paqueteBase64?: string;
        checksumSha256?: string;
        conteos?: Record<string, number>;
        docenteCorreo?: string;
        backupMeta?: BackupMeta;
      };

      const paqueteBase64 = String(json?.paqueteBase64 || '').trim();
      const checksumSha256 = String(json?.checksumSha256 || '').trim();
      const correoArchivo = typeof json?.docenteCorreo === 'string' ? json.docenteCorreo.trim() : '';
      const correoFinal = correoArchivo || docenteCorreo || '';
      if (!paqueteBase64) {
        throw new Error('El archivo no es válido: falta el paquete de datos esperado.');
      }

      const errorMeta = validarBackupMeta(json?.backupMeta);
      if (errorMeta) {
        throw new Error(errorMeta);
      }

      const validacion = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        dryRun: true,
        ...(json?.backupMeta ? { backupMeta: json.backupMeta } : {}),
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });

      const conteos = (validacion as { conteos?: Record<string, number> })?.conteos;
      const resumen = conteos
        ? `\n\nContenido detectado:\n${Object.entries(conteos)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n')}`
        : '';
      const confirmado = await confirm({
        title: 'Importar paquete de sincronización',
        message: 'El paquete pasó la validación y está listo para aplicarse en esta computadora.',
        details: resumen
          ? resumen
              .split('\n')
              .map((linea) => linea.trim())
              .filter(Boolean)
          : ['Se aplicarán en esta computadora los cambios detectados en el paquete.'],
        confirmLabel: 'Sí, importar paquete',
        tone: 'warning'
      });
      if (!confirmado) {
        setMensaje('Importación cancelada');
        setMensajeEsError(false);
        registrarAccionDocente('sync_paquete_importar_cancelado', true, Date.now() - inicio);
        return;
      }

      const resp = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        ...(json?.backupMeta ? { backupMeta: json.backupMeta } : {}),
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      setUltimoArchivoImportado(archivo.name);
      setUltimoTamanoImportadoKb(Math.max(1, Math.round(archivo.size / 1024)));
      setMensaje((resp as { mensaje?: string })?.mensaje || 'Paquete importado');
      setMensajeEsError(false);
      registrarAccionDocente('sync_paquete_importar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo importar el paquete');
      setMensaje(msg);
      setMensajeEsError(true);
      const accionSesion = accionToastSesionParaError(error, 'docente');
      if (accionSesion) {
        emitToast({
          level: 'error',
          title: 'Renueva tu sesión',
          message: 'La sesión debe renovarse para continuar.',
          durationMs: 5200,
          action: accionSesion
        });
      }
      registrarAccionDocente('sync_paquete_importar', false);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="panel paquete-sincronizacion-panel">
      <h2 id="sync-paquetes-heading" tabIndex={-1}>
        <IconoLucide icon={PackageOpen} /> Paquetes entre equipos
      </h2>
      <AyudaFormulario titulo="Cómo funciona">
        <p>
          <b>Objetivo:</b> mover materias, alumnos, reactivos y plantillas entre computadoras mediante un archivo.
        </p>
        <ul className="lista">
          <li>
            <b>Exportar:</b> genera un paquete <code>.ep-sync.json</code> compatible entre instalaciones.
          </li>
          <li>
            <b>Importar:</b> verifica la integridad y muestra un resumen antes de aplicar los cambios.
          </li>
          <li>
            <b>Conflictos:</b> prevalece el registro con la fecha de modificación más reciente (<code>updatedAt</code>).
          </li>
        </ul>
      </AyudaFormulario>

      {(ultimoExportEn || ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="subpanel">
          <h3>Resumen del paquete</h3>
          <div className="item-glass">
            <div className="estado-datos-lista">
              <div className="estado-datos-item">
                <span className="estado-chip info">Última exportación</span>
                <div className="nota">{ultimoExportEn ? new Date(ultimoExportEn).toLocaleString() : '-'}</div>
              </div>
              <div className="estado-datos-item">
                <span className="estado-chip info">Archivo exportado</span>
                <div className="nota">{ultimoArchivoExportado || '-'}</div>
              </div>
              <div className="estado-datos-item">
                <span className="estado-chip info">Archivo importado</span>
                <div className="nota">{ultimoArchivoImportado || '-'}</div>
              </div>
              <div className="estado-datos-item">
                <span className="estado-chip info">Verificación SHA-256</span>
                <div className="nota">{ultimoChecksum ? `${ultimoChecksum.slice(0, 12)}...` : '-'}</div>
              </div>
              <div className="estado-datos-item">
                <span className="estado-chip info">Protección</span>
                <div className="nota">{ultimoBackupCifrado === null ? '-' : ultimoBackupCifrado ? 'Cifrado autenticado' : 'Formato anterior sin cifrar'}</div>
              </div>
              <div className="estado-datos-item">
                <span className="estado-chip info">Tamaño importado</span>
                <div className="nota">{ultimoTamanoImportadoKb ? `${ultimoTamanoImportadoKb} KB` : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <label className="campo">
        Materia (opcional)
        <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
          <option value="">Todas</option>
          {periodos.map((periodo) => (
            <option key={periodo._id} value={periodo._id} title={periodo._id}>
              {etiquetaMateria(periodo)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid">
        <label className="campo">
          Cambios desde (opcional)
          <input
            type="datetime-local"
            value={desde}
            aria-describedby="sync-paquete-desde-ayuda"
            onChange={(event) => setDesde(event.target.value)}
          />
          <small id="sync-paquete-desde-ayuda" className="ayuda">
            Incluye cambios modificados desde esta fecha y hora, según la hora local del equipo. Déjalo vacío para no filtrar por fecha.
          </small>
        </label>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluirPdfs} onChange={(e) => setIncluirPdfs(e.target.checked)} />
          Incluir archivos PDF (aumenta el tamaño del paquete)
        </label>
      </div>

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="publicar" />} cargando={exportando} onClick={exportar}>
          {exportando ? 'Exportando paquete…' : 'Exportar paquete'}
        </Boton>
        <label className={importando ? 'boton boton--secundario boton--disabled' : 'boton boton--secundario'}>
          <Icono nombre="entrar" /> {importando ? 'Importando paquete…' : 'Importar paquete'}
          <input
            type="file"
            accept="application/json,.json,.ep-sync.json,.seu-sync.json"
            onChange={importar}
            disabled={importando}
            className="input-file-oculto"
          />
        </label>
      </div>

      {ultimoResumen && (
        <InlineMensaje tipo="info">
          Registros en el último paquete exportado ({conteoTotalUltimoResumen} en total):{' '}
          {Object.entries(ultimoResumen)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')}
        </InlineMensaje>
      )}

      {mensaje && (
        <p className={mensajeEsError ? 'mensaje error' : 'mensaje ok'} role={mensajeEsError ? 'alert' : 'status'}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
