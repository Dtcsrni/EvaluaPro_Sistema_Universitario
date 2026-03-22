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
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { convertirFechaLocalAISO } from './sincronizacionUtils';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { esMensajeError, etiquetaMateria, mensajeDeError } from './utilidades';

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
    return 'Backup invalido: falta backupMeta.expiresAt';
  }

  const expiresAtMs = new Date(expiresAtRaw).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return 'Backup invalido: backupMeta.expiresAt no es una fecha valida';
  }

  if (Date.now() > expiresAtMs) {
    return 'Backup expirado: genera un nuevo backup antes de importar';
  }

  if (fingerprint && fingerprint !== BACKUP_LOGIC_FINGERPRINT) {
    return 'Backup invalidado: cambio de logica de negocio detectado; exporta un backup nuevo';
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
  const [ultimoResumen, setUltimoResumen] = useState<Record<string, number> | null>(null);
  const [ultimoExportEn, setUltimoExportEn] = useState<string | null>(null);
  const [ultimoArchivoExportado, setUltimoArchivoExportado] = useState<string | null>(null);
  const [ultimoArchivoImportado, setUltimoArchivoImportado] = useState<string | null>(null);
  const [ultimoChecksum, setUltimoChecksum] = useState<string | null>(null);
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
      setUltimoResumen(null);

      const payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean } = { incluirPdfs };
      if (periodoId) payload.periodoId = periodoId;
      const desdeIso = convertirFechaLocalAISO(desde);
      if (desdeIso) payload.desde = desdeIso;

      const resp = await onExportar(payload);
      setUltimoResumen(resp.conteos);
      setUltimoExportEn(resp.exportadoEn);
      setUltimoChecksum(resp.checksumSha256 || null);

      const nombre = `sincronizacion_${(resp.exportadoEn || new Date().toISOString()).replace(/[:.]/g, '-')}.ep-sync.json`;
      const backupMeta = construirBackupMeta(resp.exportadoEn);
      descargarJson(nombre, {
        version: BACKUP_FORMAT_VERSION,
        exportadoEn: resp.exportadoEn,
        checksumSha256: resp.checksumSha256,
        checksumGzipSha256: resp.checksumGzipSha256,
        conteos: resp.conteos,
        paqueteBase64: resp.paqueteBase64,
        backupMeta,
        ...(docenteCorreo ? { docenteCorreo } : {})
      });
      setUltimoArchivoExportado(nombre);

      setMensaje('Paquete exportado (descarga iniciada)');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete exportado', durationMs: 2400 });
      registrarAccionDocente('sync_paquete_exportar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo exportar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo exportar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
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
      setUltimoArchivoImportado(archivo.name);
      setUltimoTamanoImportadoKb(Math.max(1, Math.round(archivo.size / 1024)));

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
        throw new Error('Archivo invalido: no contiene paqueteBase64');
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
        message: 'El paquete es válido y está listo para aplicarse en esta computadora.',
        details: resumen
          ? resumen
              .split('\n')
              .map((linea) => linea.trim())
              .filter(Boolean)
          : ['Se aplicarán los cambios detectados en el respaldo.'],
        confirmLabel: 'Sí, importar paquete',
        tone: 'warning'
      });
      if (!confirmado) {
        setMensaje('Importacion cancelada');
        registrarAccionDocente('sync_paquete_importar_cancelado', true, Date.now() - inicio);
        return;
      }

      const resp = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        ...(json?.backupMeta ? { backupMeta: json.backupMeta } : {}),
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      setMensaje((resp as { mensaje?: string })?.mensaje || 'Paquete importado');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete importado', durationMs: 2600 });
      registrarAccionDocente('sync_paquete_importar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo importar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo importar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_paquete_importar', false);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="recargar" /> Backups y exportaciones
      </h2>
      <AyudaFormulario titulo="Como funciona">
        <p>
          <b>Objetivo:</b> mover materias, alumnos, banco, plantillas y examenes entre computadoras por archivo.
        </p>
        <ul className="lista">
          <li>
            <b>Exportar:</b> genera un archivo <code>.ep-sync.json</code> compatible entre instalaciones.
          </li>
          <li>
            <b>Importar:</b> valida checksum en <code>dry-run</code> antes de aplicar.
          </li>
          <li>
            <b>Conflictos:</b> se usa LWW por <code>updatedAt</code> (el registro mas nuevo prevalece).
          </li>
        </ul>
      </AyudaFormulario>

      {(ultimoExportEn || ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="subpanel">
          <h3>Resumen de backup</h3>
          <div className="item-glass">
            <div className="estado-datos-lista">
              <div className="estado-datos-item">
                <span className="estado-chip info">Ultimo export</span>
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
                <span className="estado-chip info">Checksum</span>
                <div className="nota">{ultimoChecksum ? `${ultimoChecksum.slice(0, 12)}...` : '-'}</div>
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
          Desde (opcional)
          <input type="datetime-local" value={desde} onChange={(event) => setDesde(event.target.value)} placeholder="YYYY-MM-DDThh:mm" />
        </label>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluirPdfs} onChange={(e) => setIncluirPdfs(e.target.checked)} />
          Incluir PDFs (mas pesado)
        </label>
      </div>

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="publicar" />} cargando={exportando} onClick={exportar}>
          {exportando ? 'Exportando...' : 'Exportar backup'}
        </Boton>
        <label className={importando ? 'boton boton--secundario boton--disabled' : 'boton boton--secundario'}>
          <Icono nombre="entrar" /> {importando ? 'Importando...' : 'Importar backup'}
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
          Registros en ultimo export ({conteoTotalUltimoResumen} total):{' '}
          {Object.entries(ultimoResumen)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')}
        </InlineMensaje>
      )}

      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}
