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
import { GuiaSincronizacionVisual } from './GuiaSincronizacionVisual';
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
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head sincronizacion-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb sincronizacion-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill sincronizacion-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>{estadoReciente.texto}</span>
              </span>
              <span className="banco-counter-tag">Actualizado: {fechaActualizacion}</span>
            </div>
            <h2 className="banco-panel__title eyebrow"><Icono nombre="publicar" /> Sincronización, backups y estado de datos</h2>
            <p className="nota">Consolida sincronización con portal, paquetes entre computadoras y trazabilidad del estado operativo.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Materias activas y archivadas">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /></svg></span>
            <span className="banco-mini-kpi__num">{resumenDatos.materiasActivas}</span>
            <span className="banco-mini-kpi__lbl">Materias</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Total de alumnos matriculados">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{resumenDatos.alumnos}</span>
            <span className="banco-mini-kpi__lbl">Alumnos</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Plantillas y reactivos del banco">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{resumenDatos.plantillas}</span>
            <span className="banco-mini-kpi__lbl">Plantillas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Operaciones exitosas registradas">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 4 12 14.01 9 11.01" /></svg></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{totalesEstado.exitosas}</span>
            <span className="banco-mini-kpi__lbl">Exitosas</span>
          </div>
        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaSincronizacionVisual />

      <div className="estado-datos-grid sincronizacion-resumen-grid">
        <div className="item-glass estado-datos-card">
          <div className="estado-datos-header">
            <div>
              <div className="estado-datos-titulo">Estado de sincronización</div>
              <div className="nota">Monitorea las últimas operaciones de push, pull, publicar y backups.</div>
            </div>
            <span className={'estado-chip ' + estadoReciente.clase}>{estadoReciente.texto}</span>
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
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-actualizar (45s)
              </label>
            </div>
          </div>

          {errorEstado && <InlineMensaje tipo="error">{errorEstado}</InlineMensaje>}

          <div className="sincronizacion-historial-wrap">
            <div className="sincronizacion-historial-head">
              <div className="sincronizacion-historial-titulo">Historial reciente</div>
              <div className="nota">Mostrando {historialFiltrado.length} de {ordenadas.length} eventos</div>
            </div>

            {historialFiltrado.length === 0 ? (
              <p className="nota">No hay registros de sincronización que coincidan con el filtro.</p>
            ) : (
              <ul className="lista lista-items sincronizacion-historial-lista">
                {historialFiltrado.map((item: RegistroSincronizacion, idx: number) => {
                  const estadoItem = normalizarEstadoSincronizacion(item.estado);
                  const fecha = formatearFechaSincronizacion(item.ejecutadoEn || item.createdAt);
                  const tipo = String(item.tipo || 'evento').toUpperCase();
                  const resumen = String((item as unknown as { resumen?: string; mensaje?: string }).resumen || item.detalles || (item as unknown as { resumen?: string; mensaje?: string }).mensaje || '-');
                  return (
                    <li key={item._id || (item.tipo + '-' + idx)} className="item-glass sincronizacion-historial-item">
                      <div className="item-row">
                        <div>
                          <div className="item-title">{tipo}</div>
                          <div className="item-meta">
                            <span>{fecha}</span>
                            <span className={'estado-chip ' + estadoItem.clase}>{estadoItem.texto}</span>
                          </div>
                          <div className="item-sub">{resumen}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="item-glass sincronizacion-side-card">
          <HelperPanel
            titulo="Centro de backups y publicación"
            descripcion="Sincroniza directamente con el portal del alumno o exporta/importa paquetes cifrados entre computadoras sin conexión a internet."
            pasos={[
              'Publica calificaciones al portal web con un solo clic.',
              'Exporta paquetes .epbak para respaldar toda tu base de datos.',
              'Conecta dos laptops en la misma red local mediante PIN.'
            ]}
          />
        </div>
      </div>

      <SeccionPublicar
        periodos={periodosSeguros}
        onPublicar={onPublicar}
        onCodigo={onCodigo}
      />

      <SeccionPaqueteSincronizacion
        periodos={periodosSeguros}
        onExportar={onExportarPaquete}
        onImportar={onImportarPaquete}
        docenteCorreo={docenteCorreo}
      />

      <SeccionSincronizacionEquipos
        onPushServidor={onPushServidor}
        onPullServidor={onPullServidor}
      />
    </div>
  );
}
