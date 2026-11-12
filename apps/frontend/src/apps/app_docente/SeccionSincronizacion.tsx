/**
 * SeccionSincronizacion
 *
 * Panel consolidado de estado, sincronizacion con portal y backups entre equipos.
 */
import { useMemo } from 'react';
import { Icono } from '../../ui/iconos';
import { BookOpenText, CircleCheck, UsersRound, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { HelperPanel } from '../../ui/ux/componentes/HelperPanel';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaSincronizacionVisual } from './GuiaSincronizacionVisual';
import { SeccionPaqueteSincronizacion } from './SeccionPaqueteSincronizacion';
import { SeccionInstantaneaLocal, type MetodoInstantaneaLocal } from './SeccionInstantaneaLocal';
import { SeccionLeaseSincronizacion, type EstadoLeaseUI } from './SeccionLeaseSincronizacion';
import { SeccionSincronizacionEquipos } from './SeccionSincronizacionEquipos';
import { SeccionPublicar, type CodigoAccesoMetadata } from './SeccionPublicar';
import type { Periodo, Plantilla, Pregunta, Alumno, RegistroSincronizacion, RespuestaSyncPull, RespuestaSyncPush } from './tipos';
import { useEstadoSincronizacion } from './hooks/useEstadoSincronizacion';
import { formatearFechaSincronizacion, normalizarEstadoSincronizacion } from './sincronizacionUtils';

export function SeccionSincronizacion({
  periodos,
  cargandoMaterias,
  errorMaterias,
  puedeLeerMaterias,
  onReintentarMaterias,
  periodosArchivados,
  alumnos,
  plantillas,
  preguntas,
  ultimaActualizacionDatos,
  docenteCorreo,
  onPublicar,
  onCodigo,
  onListarCodigos,
  onExpirarCodigo,
  onExportarPaquete,
  onImportarPaquete,
  onExportarLocal,
  onImportarLocal,
  estadoLease,
  onAdquirirLease,
  onActualizarEstadoLease,
  onLiberarLease,
  onPublicarNube,
  onImportarNube,
  puedeUsarContrasena,
  puedeUsarGoogle,
  onPushServidor,
  onPullServidor
}: {
  periodos: Periodo[];
  cargandoMaterias?: boolean;
  errorMaterias?: boolean;
  puedeLeerMaterias?: boolean;
  onReintentarMaterias?: () => Promise<void> | void;
  periodosArchivados: Periodo[];
  alumnos: Alumno[];
  plantillas: Plantilla[];
  preguntas: Pregunta[];
  ultimaActualizacionDatos: number | null;
  docenteCorreo?: string;
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigoAccesoId?: string; codigo?: string; expiraEn?: string }>;
  onListarCodigos?: (periodoId: string) => Promise<{ codigosAcceso: CodigoAccesoMetadata[] }>;
  onExpirarCodigo?: (codigoAccesoId: string) => Promise<{ expirado: boolean; codigoAccesoId: string }>;
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
  onExportarLocal: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string }) => Promise<{ archivo: Blob; nombreArchivo: string; checksumSha256: string; exportadoEn: string; conteos: { baseDatosBytes: number; archivos: number; archivosBytes: number } }>;
  onImportarLocal: (payload: { cuerpo: Uint8Array }) => Promise<{ mensaje?: string; checksumSha256?: string; conteos?: { baseDatosBytes: number; archivos: number; archivosBytes: number }; requiereReinicioSesion?: boolean }>;
  estadoLease: EstadoLeaseUI | null;
  onAdquirirLease: () => Promise<EstadoLeaseUI>;
  onActualizarEstadoLease?: () => Promise<boolean>;
  onLiberarLease: () => Promise<unknown>;
  onPublicarNube: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string }) => Promise<{ checksumSha256?: string; conteos?: { baseDatosBytes: number; archivos: number; archivosBytes: number }; mensaje?: string }>;
  onImportarNube: (payload: { metodo: MetodoInstantaneaLocal; credencial?: string; dryRun: boolean }) => Promise<{ checksumSha256?: string; conteos?: { baseDatosBytes: number; archivos: number; archivosBytes: number }; mensaje?: string; requiereReinicioSesion?: boolean }>;
  puedeUsarContrasena: boolean;
  puedeUsarGoogle: boolean;
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
  const estadoResumen = cargandoEstado && ordenadas.length === 0
    ? 'Consultando historial'
    : errorEstado && ordenadas.length === 0
      ? 'No se pudo consultar'
      : errorEstado
        ? 'Historial desactualizado'
        : ordenadas.length === 0
      ? 'Sin operaciones recientes'
      : estadoReciente.texto;

  return (
    <div className="panel sincronizacion-shell">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head sincronizacion-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="icono-seccion-orb banco-panel__icon-orb sincronizacion-panel__icon-orb anim-icon-pulse" aria-hidden="true">
              <Icono nombre="sincronizacion" />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill sincronizacion-status-pill" role="status">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>{estadoResumen}</span>
              </span>
              <span className="banco-counter-tag">Datos locales cargados: {fechaActualizacion}</span>
            </div>
            <h2 className="banco-panel__title eyebrow">Sincronización y respaldos</h2>
            <p className="nota">Envía y recibe cambios del portal, transfiere paquetes entre equipos y administra respaldos completos.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis sincronizacion-header-kpis" role="group" aria-label="Resumen de datos y operaciones recientes">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Materias activas del ciclo actual">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={BookOpenText} size={16} /></span>
            <span className="banco-mini-kpi__num">{resumenDatos.materiasActivas}</span>
            <span className="banco-mini-kpi__lbl">Materias activas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Alumnos registrados en los datos locales">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={UsersRound} size={16} />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{resumenDatos.alumnos}</span>
            <span className="banco-mini-kpi__lbl">Alumnos registrados</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Plantillas de examen incluidas en los datos locales.">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={CircleCheck} size={16} /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{resumenDatos.plantillas}</span>
            <span className="banco-mini-kpi__lbl">Plantillas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip={`Operaciones exitosas entre los últimos ${ordenadas.length} eventos consultados`}>
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={CircleCheck} size={16} /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{totalesEstado.exitosas}</span>
            <span className="banco-mini-kpi__lbl">Éxitos recientes</span>
          </div>
        </div>
      </div>

      <nav className="banco-task-nav sincronizacion-task-nav" aria-label="Tareas de sincronización">
        <span className="banco-task-nav__label">Ir a:</span>
        <a className="boton secundario boton--sm" href="#sync-publicacion-heading">Publicar en Portal Alumno</a>
        <a className="boton secundario boton--sm" href="#sync-paquetes-heading">Exportar o importar paquete</a>
        <a className="boton secundario boton--sm" href="#sync-respaldo-heading">Respaldo completo</a>
        {estadoLease?.configurado && <a className="boton secundario boton--sm" href="#sync-coordinado-heading">Trabajo coordinado entre equipos</a>}
        <a className="boton secundario boton--sm" href="#sync-equipos-heading">Sincronización entre equipos</a>
      </nav>

      {/* 2. Bento Visual Guide */}
      <GuiaSincronizacionVisual />

      <div className="estado-datos-grid sincronizacion-resumen-grid">
        <div className="item-glass estado-datos-card">
          <div className="estado-datos-header">
            <div>
              <div className="estado-datos-titulo">Estado de sincronización</div>
              <div className="nota">Revisa los últimos envíos, recepciones, publicaciones y respaldos.</div>
            </div>
            <span className={'estado-chip ' + estadoReciente.clase} aria-hidden="true">{estadoReciente.texto}</span>
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
              <div className="nota">Mostrando {historialFiltrado.length} de {ordenadas.length} eventos recientes consultados</div>
            </div>

            {historialFiltrado.length === 0 ? (
              errorEstado ? null : cargandoEstado ? (
                <p className="nota" aria-hidden="true">Cargando eventos de sincronización…</p>
              ) : ordenadas.length === 0 ? (
                <p className="nota" role="status">Aún no hay operaciones de sincronización registradas.</p>
              ) : (
                <div className="sincronizacion-historial-vacio">
                  <p className="nota" role="status">No hay eventos recientes que coincidan con «{filtroHistorial.trim()}».</p>
                  <Boton type="button" variante="secundario" tamano="sm" onClick={() => setFiltroHistorial('')}>Limpiar filtro</Boton>
                </div>
              )
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

        <div className="sincronizacion-side-card">
          <HelperPanel
            titulo="Opciones de publicación y transferencia"
            descripcion="Cada opción mueve datos distintos: .ep-sync.json contiene registros exportables; .ep-snapshot transfiere la SQLite y los archivos locales transferibles."
            pasos={[
              'Publica calificaciones para que el alumnado las consulte en el portal.',
              'Exporta un paquete cifrado .ep-sync.json; puedes filtrar por materia y fecha e incluir PDFs.',
              'Transfiere la SQLite local y los archivos mediante la instantánea 1:1 .ep-snapshot.',
              'Sincroniza cambios entre equipos por nube o red local, según la modalidad configurada.'
            ]}
          />
        </div>
      </div>

      <SeccionPublicar
        periodos={periodosSeguros}
        cargandoMaterias={cargandoMaterias}
        errorMaterias={errorMaterias}
        puedeLeerMaterias={puedeLeerMaterias}
        onReintentarMaterias={onReintentarMaterias}
        onPublicar={onPublicar}
        onCodigo={onCodigo}
        onListarCodigos={onListarCodigos}
        onExpirarCodigo={onExpirarCodigo}
      />

      <SeccionPaqueteSincronizacion
        periodos={periodosSeguros}
        onExportar={onExportarPaquete}
        onImportar={onImportarPaquete}
        docenteCorreo={docenteCorreo}
      />

      <SeccionInstantaneaLocal
        onExportar={onExportarLocal}
        onImportar={onImportarLocal}
        puedeUsarContrasena={puedeUsarContrasena}
        puedeUsarGoogle={puedeUsarGoogle}
      />

      <SeccionLeaseSincronizacion
        estado={estadoLease}
        puedeUsarContrasena={puedeUsarContrasena}
        puedeUsarGoogle={puedeUsarGoogle}
        onAdquirir={onAdquirirLease}
        onActualizarEstado={onActualizarEstadoLease ?? (async () => false)}
        onLiberar={onLiberarLease}
        onPublicar={onPublicarNube}
        onImportar={onImportarNube}
      />

      <SeccionSincronizacionEquipos
        onPushServidor={onPushServidor}
        onPullServidor={onPullServidor}
      />
    </div>
  );
}
