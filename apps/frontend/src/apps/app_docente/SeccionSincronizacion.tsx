/**
 * SeccionSincronizacion
 *
 * Panel consolidado de estado, sincronizacion con portal y backups entre equipos.
 */
import { useMemo } from 'react';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { HelperPanel } from '../../ui/ux/componentes/HelperPanel';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { SeccionPaqueteSincronizacion } from './SeccionPaqueteSincronizacion';
import { SeccionSincronizacionEquipos } from './SeccionSincronizacionEquipos';
import { SeccionPublicar } from './SeccionPublicar';
import type { Periodo, Plantilla, Pregunta, Alumno, RegistroSincronizacion, RespuestaSyncPull, RespuestaSyncPush } from './tipos';
import { useEstadoSincronizacion } from './hooks/useEstadoSincronizacion';
import { formatearFechaSincronizacion, normalizarEstadoSincronizacion } from './sincronizacionUtils';

export function SeccionSincronizacion({
  periodos,
  periodosArchivados,
  alumnos,
  plantillas,
  preguntas,
  ultimaActualizacionDatos,
  docenteCorreo,
  onPublicar,
  onCodigo,
  onExportarPaquete,
  onImportarPaquete,
  onPushServidor,
  onPullServidor
}: {
  periodos: Periodo[];
  periodosArchivados: Periodo[];
  alumnos: Alumno[];
  plantillas: Plantilla[];
  preguntas: Pregunta[];
  ultimaActualizacionDatos: number | null;
  docenteCorreo?: string;
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigo?: string; expiraEn?: string }>;
  onExportarPaquete: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<{
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256?: string;
    exportadoEn: string;
    conteos: Record<string, number>;
  }>;
  onImportarPaquete: (payload: {
    paqueteBase64: string;
    checksumSha256?: string;
    dryRun?: boolean;
    docenteCorreo?: string;
    backupMeta?: {
      schemaVersion?: number;
      createdAt?: string;
      ttlMs?: number;
      expiresAt?: string;
      businessLogicFingerprint?: string;
    };
  }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const periodosSeguros = Array.isArray(periodos) ? periodos : [];
  const periodosArchivadosSeguros = Array.isArray(periodosArchivados) ? periodosArchivados : [];
  const alumnosSeguros = Array.isArray(alumnos) ? alumnos : [];
  const plantillasSeguras = Array.isArray(plantillas) ? plantillas : [];
  const preguntasSeguras = Array.isArray(preguntas) ? preguntas : [];

  const {
    ordenadas,
    historialFiltrado,
    sincronizacionReciente,
    estadoReciente,
    totalesEstado,
    fechaActualizacion,
    cargandoEstado,
    errorEstado,
    autoRefresh,
    filtroHistorial,
    setAutoRefresh,
    setFiltroHistorial,
    refrescarEstado
  } = useEstadoSincronizacion({ ultimaActualizacionDatos, limite: 12, autoRefreshMs: 45_000 });

  const resumenDatos = useMemo(
    () => ({
      materiasActivas: periodosSeguros.length,
      materiasArchivadas: periodosArchivadosSeguros.length,
      alumnos: alumnosSeguros.length,
      plantillas: plantillasSeguras.length,
      banco: preguntasSeguras.length
    }),
    [
      periodosSeguros.length,
      periodosArchivadosSeguros.length,
      alumnosSeguros.length,
      plantillasSeguras.length,
      preguntasSeguras.length
    ]
  );

  return (
    <div className="panel sincronizacion-shell">
      <div className="sincronizacion-header">
        <div>
          <h2>
            <Icono nombre="publicar" /> Sincronización, backups y estado de datos
          </h2>
          <p className="nota">Consolida sincronización con portal, paquetes entre computadoras y trazabilidad del estado operativo.</p>
        </div>
        <div className="sincronizacion-header__chipWrap" aria-live="polite">
          <span className={`estado-chip ${estadoReciente.clase}`}>{estadoReciente.texto}</span>
          <span className="nota">Último evento: {sincronizacionReciente ? formatearFechaSincronizacion(sincronizacionReciente.ejecutadoEn || sincronizacionReciente.createdAt) : 'Sin registros'}</span>
        </div>
      </div>

      <div className="sincronizacion-kpi" aria-live="polite">
        <div className="sincronizacion-kpi__item"><span>Materias activas</span><b>{resumenDatos.materiasActivas}</b></div>
        <div className="sincronizacion-kpi__item"><span>Materias archivadas</span><b>{resumenDatos.materiasArchivadas}</b></div>
        <div className="sincronizacion-kpi__item"><span>Alumnos</span><b>{resumenDatos.alumnos}</b></div>
        <div className="sincronizacion-kpi__item"><span>Plantillas</span><b>{resumenDatos.plantillas}</b></div>
        <div className="sincronizacion-kpi__item"><span>Banco</span><b>{resumenDatos.banco}</b></div>
        <div className="sincronizacion-kpi__item"><span>Última actualización local</span><b>{fechaActualizacion}</b></div>
      </div>

      <div className="estado-datos-grid sincronizacion-resumen-grid">
        <div className="item-glass estado-datos-card">
          <div className="estado-datos-header">
            <div>
              <div className="estado-datos-titulo">Estado de sincronización</div>
              <div className="nota">Monitorea las últimas operaciones de push, pull, publicar y backups.</div>
            </div>
            <span className={`estado-chip ${estadoReciente.clase}`}>{estadoReciente.texto}</span>
          </div>

          <div className="estado-datos-cifras">
            <div>
              <div className="estado-datos-numero">{totalesEstado.exitosas}</div>
              <div className="nota">Exitosas</div>
            </div>
            <div>
              <div className="estado-datos-numero">{totalesEstado.fallidas}</div>
              <div className="nota">Fallidas</div>
            </div>
            <div>
              <div className="estado-datos-numero">{totalesEstado.pendientes}</div>
              <div className="nota">Pendientes</div>
            </div>
          </div>

          <div className="sincronizacion-toolbar">
            <label className="campo">
              Buscar en historial
              <input
                value={filtroHistorial}
                onChange={(e) => setFiltroHistorial(e.target.value)}
                placeholder="Tipo, estado o fecha"
                disabled={ordenadas.length === 0}
              />
            </label>
            <div className="acciones sincronizacion-toolbar__actions">
              <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoEstado} onClick={refrescarEstado}>
                {cargandoEstado ? 'Actualizando...' : 'Actualizar estado'}
              </Boton>
              <label className="campo campo--checkbox sincronizacion-auto-refresh">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto-refresh 45s
              </label>
            </div>
          </div>

          <div className="estado-datos-lista sincronizacion-timeline">
            {(historialFiltrado.length ? historialFiltrado : [{} as RegistroSincronizacion]).slice(0, 8).map((item, idx) => {
              if (!item?.estado) {
                return (
                  <div key={`vacio-${idx}`} className="estado-datos-item">
                    <div className="nota">No hay historial disponible.</div>
                  </div>
                );
              }
              const estado = normalizarEstadoSincronizacion(item.estado);
              return (
                <div key={item._id || `sync-${idx}`} className="estado-datos-item">
                  <span className={`estado-chip ${estado.clase}`}>{estado.texto}</span>
                  <div>
                    <div className="estado-datos-item__titulo">{String(item.tipo || 'sincronizacion').toUpperCase()}</div>
                    <div className="nota">{formatearFechaSincronizacion(item.ejecutadoEn || item.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {errorEstado && <InlineMensaje tipo="warning">{errorEstado}</InlineMensaje>}
        </div>
      </div>

      <div className="sincronizacion-grid">
        <HelperPanel
          titulo="Sincronizacion segura entre computadoras"
          descripcion="Sigue siempre el mismo orden para evitar duplicados y perdida de cambios."
          pasos={[
            '1) Actualiza estado antes de iniciar.',
            '2) En equipo emisor: exporta o haz push.',
            '3) En equipo receptor: importa o haz pull y valida conteos.',
            '4) Revisa historial y resuelve conflictos antes de publicar.'
          ]}
          notas={<p className="nota">Si hay errores repetidos, detén la operación y revisa conectividad, reloj del sistema y permisos.</p>}
        />
        <SeccionPublicar periodos={periodosSeguros} onPublicar={onPublicar} onCodigo={onCodigo} />
        <SeccionPaqueteSincronizacion periodos={periodosSeguros} docenteCorreo={docenteCorreo} onExportar={onExportarPaquete} onImportar={onImportarPaquete} />
        <SeccionSincronizacionEquipos onPushServidor={onPushServidor} onPullServidor={onPullServidor} />
      </div>
    </div>
  );
}
