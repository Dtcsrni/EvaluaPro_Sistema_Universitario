/**
 * SeccionRehidratacionLotes
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { Icono } from '../../ui/iconos';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Docente } from './tipos';

const DEFAULT_OMR_HUMAN_REVIEW_URL = 'http://127.0.0.1:4310';

type BundleRecuperable = {
  bundleHash: string;
  loteId: string;
  templateVersion?: number;
  examCount: number;
  questionBankCount: number;
  signatureValid: boolean;
  recoverable: boolean;
  causes: string[];
};

type VerificacionRecuperacion = {
  bundleHash?: string;
  manifestHash?: string;
  signatureValid: boolean;
  templateVersion?: number;
  examCount: number;
  questionBankCount: number;
  recoverable: boolean;
  causes: string[];
};

type ResultadoReconstruccion = {
  status: 'verificada' | 'reconstruida' | 'conflicto' | 'fallida';
  reconstructedExamIds: string[];
  reconstructedQuestionBankIds: string[];
  conflicts: Array<Record<string, unknown>>;
  bundleHash?: string;
  manifestHashes: string[];
};

type OperacionRecuperacion = { bundleHash: string; tipo: 'verificar' | 'reconstruir' } | null;
type EstadoCargaInventario = 'cargando' | 'cargado' | 'error';

function resumirConflicto(conflicto: Record<string, unknown>, index: number) {
  const examId = String(conflicto.examId ?? conflicto.id ?? '').trim();
  const folio = String(conflicto.folio ?? '').trim();
  const causa = String(conflicto.cause ?? conflicto.motivo ?? conflicto.reason ?? '').trim();
  return [examId || `conflicto-${index + 1}`, folio || undefined, causa || undefined].filter(Boolean).join(' | ');
}

function notificarRenovacionSesionSiAplica(error: unknown) {
  const action = accionToastSesionParaError(error, 'docente');
  if (!action) return;
  emitToast({
    level: 'error',
    title: 'Renueva tu sesión docente',
    message: 'Cierra sesión y vuelve a entrar para renovar el acceso; después reintenta la operación.',
    action,
    persistent: true
  });
}

function etiquetaEstadoReconstruccion(estado: ResultadoReconstruccion['status']) {
  const etiquetas: Record<ResultadoReconstruccion['status'], string> = {
    verificada: 'Verificada',
    reconstruida: 'Reconstruida',
    conflicto: 'Con conflictos',
    fallida: 'Fallida'
  };
  return etiquetas[estado];
}

function mensajeEstadoReconstruccion(estado: ResultadoReconstruccion['status']) {
  const mensajes: Record<ResultadoReconstruccion['status'], string> = {
    verificada: 'El paquete se verificó; no se informaron cambios de registros.',
    reconstruida: 'La reconstrucción quedó guardada sin conflictos estructurales.',
    conflicto: 'La reconstrucción detectó conflictos y no debe tratarse como completa.',
    fallida: 'La reconstrucción no se completó. Revisa el inventario y verifica de nuevo el paquete.'
  };
  return mensajes[estado];
}

export function SeccionRehidratacionLotes({
  docente,
  esAdmin,
  puedeUsar
}: {
  docente: Docente | null;
  esAdmin: boolean;
  puedeUsar: boolean;
}) {
  const [mostrarModuloEmbebido, setMostrarModuloEmbebido] = useState(false);
  const [bundles, setBundles] = useState<BundleRecuperable[]>([]);
  const [cargandoBundles, setCargandoBundles] = useState(puedeUsar);
  const [estadoCargaInventario, setEstadoCargaInventario] = useState<EstadoCargaInventario>(puedeUsar ? 'cargando' : 'cargado');
  const [bundleActivoHash, setBundleActivoHash] = useState<string>('');
  const [verificacionActual, setVerificacionActual] = useState<VerificacionRecuperacion | null>(null);
  const [reconstruccionActual, setReconstruccionActual] = useState<ResultadoReconstruccion | null>(null);
  const [operacionActual, setOperacionActual] = useState<OperacionRecuperacion>(null);
  const [errorOperacion, setErrorOperacion] = useState<string>('');

  const urlRevisionHumana = useMemo(() => {
    const valor = String(import.meta.env.VITE_OMR_HUMAN_REVIEW_URL || DEFAULT_OMR_HUMAN_REVIEW_URL).trim();
    return valor.replace(/\/+$/, '');
  }, []);
  const tipoAcceso = esAdmin ? 'Permiso de recuperación de lotes' : 'Plan de recuperación habilitado';
  const bundleActivo = useMemo(
    () => bundles.find((bundle) => bundle.bundleHash === bundleActivoHash) ?? null,
    [bundleActivoHash, bundles]
  );
  const puedeReconstruir = Boolean(bundleActivo?.signatureValid && bundleActivo.recoverable);
  const motivoBloqueoReconstruccion = bundleActivo && !puedeReconstruir
    ? !bundleActivo.signatureValid
      ? 'No se puede reconstruir este paquete porque su firma no es válida.'
      : 'Este paquete tiene observaciones que impiden reconstruirlo.'
    : '';
  const resumenInventario = estadoCargaInventario === 'cargando'
    ? 'Cargando…'
    : estadoCargaInventario === 'error'
      ? 'No se pudo cargar'
      : String(bundles.length);
  const resumenResultado = operacionActual?.tipo === 'verificar'
    ? 'Verificando paquete…'
    : operacionActual?.tipo === 'reconstruir'
      ? 'Reconstruyendo lote…'
      : reconstruccionActual
        ? reconstruccionActual.status === 'reconstruida'
          ? reconstruccionActual.conflicts.length
            ? 'Reconstrucción completada con conflictos'
            : 'Reconstrucción completada'
          : reconstruccionActual.status === 'conflicto'
            ? 'Conflictos detectados'
            : reconstruccionActual.status === 'fallida'
              ? 'Reconstrucción fallida'
              : 'Verificado; sin reconstrucción'
        : verificacionActual
          ? 'Verificado; sin reconstrucción'
          : errorOperacion
            ? estadoCargaInventario === 'error'
              ? 'No disponible'
              : 'Operación no completada'
            : 'Sin operación ejecutada';

  const cargarBundles = useCallback(async () => {
    setCargandoBundles(true);
    setEstadoCargaInventario('cargando');
    setErrorOperacion('');
    try {
      const respuesta = await clienteApi.obtener<{ items: BundleRecuperable[] }>('/recuperacion/bundles');
      const items = Array.isArray(respuesta.items) ? respuesta.items : [];
      setBundles(items);
      setEstadoCargaInventario('cargado');
      setBundleActivoHash((actual) => {
        if (actual && items.some((item) => item.bundleHash === actual)) return actual;
        return items[0]?.bundleHash ?? '';
      });
      registrarAccionDocente('rehidratacion_lotes_listar', true);
    } catch (error) {
      setEstadoCargaInventario('error');
      const mensaje = error instanceof Error ? error.message : 'No fue posible obtener los paquetes de recuperación.';
      setErrorOperacion(mensaje);
      notificarRenovacionSesionSiAplica(error);
      registrarAccionDocente('rehidratacion_lotes_listar', false);
    } finally {
      setCargandoBundles(false);
    }
  }, []);

  useEffect(() => {
    if (!puedeUsar) return;
    void cargarBundles();
  }, [cargarBundles, puedeUsar]);

  const abrirHerramienta = useCallback(() => {
    if (!urlRevisionHumana) {
      emitToast({
        level: 'warn',
        title: 'Recuperación del lote',
        message: 'No se encontró una dirección configurada para la herramienta visual de apoyo.',
        durationMs: 3600
      });
      return;
    }
    const nuevaVentana = window.open(urlRevisionHumana, '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      emitToast({
        level: 'warn',
        title: 'Recuperación del lote',
        message: 'El navegador bloqueó la nueva pestaña. Permite ventanas emergentes e inténtalo de nuevo.',
        durationMs: 4200
      });
      return;
    }
    registrarAccionDocente('rehidratacion_lote_open', true);
  }, [urlRevisionHumana]);

  const verificarBundle = useCallback(async () => {
    if (!bundleActivo) return;
    setOperacionActual({ bundleHash: bundleActivo.bundleHash, tipo: 'verificar' });
    setErrorOperacion('');
    setVerificacionActual(null);
    setReconstruccionActual(null);
    try {
      const respuesta = await clienteApi.enviar<VerificacionRecuperacion>('/recuperacion/verificar', {
        bundleHash: bundleActivo.bundleHash
      });
      setVerificacionActual(respuesta);
      registrarAccionDocente('rehidratacion_bundle_verificar', true);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible verificar el paquete seleccionado.';
      setErrorOperacion(mensaje);
      notificarRenovacionSesionSiAplica(error);
      registrarAccionDocente('rehidratacion_bundle_verificar', false);
    } finally {
      setOperacionActual(null);
    }
  }, [bundleActivo]);

  const reconstruirBundle = useCallback(async () => {
    if (!bundleActivo || !bundleActivo.signatureValid || !bundleActivo.recoverable) return;
    setOperacionActual({ bundleHash: bundleActivo.bundleHash, tipo: 'reconstruir' });
    setErrorOperacion('');
    setVerificacionActual(null);
    setReconstruccionActual(null);
    try {
      const respuesta = await clienteApi.enviar<ResultadoReconstruccion>('/recuperacion/bundle/reconstruir', {
        bundleHash: bundleActivo.bundleHash
      });
      setReconstruccionActual(respuesta);
      registrarAccionDocente('rehidratacion_bundle_reconstruir', true);
      await cargarBundles();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible reconstruir el lote seleccionado.';
      setErrorOperacion(mensaje);
      notificarRenovacionSesionSiAplica(error);
      registrarAccionDocente('rehidratacion_bundle_reconstruir', false);
    } finally {
      setOperacionActual(null);
    }
  }, [bundleActivo, cargarBundles]);

  if (!puedeUsar) {
    return (
      <section className="panel rehidratacion-panel">
        <InlineMensaje tipo="error">
          Esta capacidad de recuperación solo está disponible para cuentas con permiso de recuperación de lotes.
        </InlineMensaje>
      </section>
    );
  }

  return (
    <>
      <section className="panel rehidratacion-panel calificaciones-hero">
        <div className="calificaciones-hero__head">
          <h2>
            <Icono nombre="pdf" /> Recuperación de paquetes firmados
          </h2>
          <p className="nota">
            Recupera el banco de reactivos, las respuestas correctas, las variantes y los exámenes a partir de paquetes de
            recuperación firmados por versiones compatibles del sistema.
          </p>
        </div>
        <div className="calificaciones-kpi rehidratacion-kpi-grid" role="group" aria-label="Resumen de recuperación">
          <div className="calificaciones-kpi__item"><span>Tipo de acceso</span><b>{tipoAcceso}</b></div>
          <div className="calificaciones-kpi__item"><span>Uso esperado</span><b>Recuperación de contingencia</b></div>
          <div className="calificaciones-kpi__item"><span>Paquetes detectados</span><b>{resumenInventario}</b></div>
          <div className="calificaciones-kpi__item"><span>Estado de operación</span><b aria-live="polite">{resumenResultado}</b></div>
        </div>
        <div className="item-meta calificaciones-hero__meta">
          <span className="badge warning">No es un flujo de calificación diaria</span>
          <span className="badge ok">Usuario actual: {docente?.correo ?? 'sin sesion'}</span>
        </div>
      </section>

      <section className="panel rehidratacion-panel">
        <div className="calificaciones-human-review-panel__head">
          <div className="calificaciones-human-review-panel__title">
            <h3>
              <Icono nombre="escaneo" /> Verificar y recuperar un paquete
            </h3>
            <p className="nota">
              Selecciona un paquete firmado del inventario. Pulsa «Verificar paquete» para comprobar su firma y compatibilidad.
              Si aparece como recuperable, usa «Reconstruir lote» para restaurar el banco de reactivos, las variantes y los exámenes.
            </p>
          </div>
          <span className={bundleActivo?.recoverable ? 'badge ok' : 'badge warning'}>
            {bundleActivo ? `Paquete activo: ${bundleActivo.bundleHash}` : 'Sin paquete seleccionado'}
          </span>
        </div>

        <div className="item-actions rehidratacion-lotes__actions">
          <Boton type="button" variante="secundario" onClick={() => { setVerificacionActual(null); setReconstruccionActual(null); void cargarBundles(); }} cargando={cargandoBundles} disabled={Boolean(operacionActual)}>
            <Icono nombre="recargar" />
            {errorOperacion && !bundleActivo ? 'Reintentar carga' : 'Actualizar inventario'}
          </Boton>
          <Boton
            type="button"
            onClick={() => void verificarBundle()}
            cargando={operacionActual?.tipo === 'verificar' && operacionActual.bundleHash === bundleActivoHash}
            disabled={!bundleActivo || Boolean(operacionActual)}
          >
            <Icono nombre="info" />
            Verificar paquete
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            onClick={() => void reconstruirBundle()}
            cargando={operacionActual?.tipo === 'reconstruir' && operacionActual.bundleHash === bundleActivoHash}
            disabled={!bundleActivo || !puedeReconstruir || Boolean(operacionActual)}
          >
            <Icono nombre="calificar" />
            Reconstruir lote
          </Boton>
        </div>

        {errorOperacion ? <InlineMensaje tipo="error">{errorOperacion}</InlineMensaje> : null}
        {motivoBloqueoReconstruccion && <InlineMensaje tipo="warning">{motivoBloqueoReconstruccion}</InlineMensaje>}
        {operacionActual && (
          <p role="status" aria-live="polite">
            {operacionActual.tipo === 'verificar' ? 'Verificando el paquete seleccionado…' : 'Reconstruyendo el lote del paquete seleccionado…'}
          </p>
        )}

        <div className="calificaciones-kpi rehidratacion-kpi-grid" role="group" aria-label="Datos del paquete seleccionado">
          <div className="calificaciones-kpi__item">
            <span>Paquete activo</span>
            <b>{bundleActivo?.loteId ?? 'Sin seleccionar'}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Plantilla OMR</span>
            <b>{bundleActivo?.templateVersion ? `TV${bundleActivo.templateVersion}` : 'N/D'}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Exámenes</span>
            <b>{bundleActivo?.examCount ?? 0}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Reactivos</span>
            <b>{bundleActivo?.questionBankCount ?? 0}</b>
          </div>
        </div>

        {cargandoBundles && <p role="status" aria-live="polite">Cargando inventario de paquetes de recuperación…</p>}
        {!cargandoBundles && !errorOperacion && bundles.length === 0 && (
          <InlineMensaje tipo="info">
            No se encontraron paquetes de recuperación para esta cuenta. Si esperabas alguno, revisa los permisos y vuelve a actualizar el inventario.
          </InlineMensaje>
        )}
        {!cargandoBundles && bundles.length > 0 && (
          <div className="rehidratacion-lotes__grid" role="group" aria-label="Paquetes de recuperación disponibles">
            {bundles.map((bundle) => {
              const activo = bundle.bundleHash === bundleActivoHash;
              return (
                <div key={bundle.bundleHash} className="rehidratacion-lotes__bundle-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setBundleActivoHash(bundle.bundleHash);
                      setVerificacionActual(null);
                      setReconstruccionActual(null);
                      setErrorOperacion('');
                    }}
                    className={`item-glass rehidratacion-lotes__bundle${activo ? ' activo' : ''}`}
                    aria-pressed={activo}
                    disabled={Boolean(operacionActual)}
                  >
                    <span className="item-meta">
                      <span className={bundle.signatureValid ? 'badge ok' : 'badge warning'}>
                        {bundle.signatureValid ? 'Firma válida' : 'Firma no válida'}
                      </span>
                      <span className={bundle.recoverable ? 'badge ok' : 'badge warning'}>
                        {bundle.recoverable ? 'Recuperable' : 'No recuperable'}
                      </span>
                      <span className="badge">Plantilla OMR {bundle.templateVersion ? `v${bundle.templateVersion}` : 'sin dato'}</span>
                    </span>
                    <span className="rehidratacion-lotes__bundle-title">Lote {bundle.loteId}</span>
                    <span className="item-meta rehidratacion-lotes__bundle-meta">
                      <span>Huella del paquete: {bundle.bundleHash}</span>
                      <span>{bundle.examCount} exámenes</span>
                      <span>{bundle.questionBankCount} reactivos</span>
                    </span>
                  </button>
                  {bundle.causes.length ? (
                    <div className="rehidratacion-lotes__bundle-warnings">
                      <InlineMensaje tipo="warning">{bundle.causes.join(' | ')}</InlineMensaje>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {verificacionActual ? (
          <div className="subpanel rehidratacion-lotes__subpanel">
            <h4>Resultado de verificación</h4>
            <div className="item-meta">
              <span className={verificacionActual.signatureValid ? 'badge ok' : 'badge warning'}>
                {verificacionActual.signatureValid ? 'Firma válida' : 'Firma no válida'}
              </span>
              <span className={verificacionActual.recoverable ? 'badge ok' : 'badge warning'}>
                {verificacionActual.recoverable ? 'Recuperable' : 'No recuperable'}
              </span>
              <span>Template {verificacionActual.templateVersion ? `TV${verificacionActual.templateVersion}` : 'N/D'}</span>
                <span>{verificacionActual.examCount} exámenes</span>
              <span>{verificacionActual.questionBankCount} reactivos</span>
            </div>
            {verificacionActual.causes.length ? (
              <InlineMensaje tipo="warning">{verificacionActual.causes.join(' | ')}</InlineMensaje>
            ) : (
              <InlineMensaje tipo="ok">La firma y la estructura del paquete son consistentes para su reconstrucción.</InlineMensaje>
            )}
          </div>
        ) : null}

        {reconstruccionActual ? (
          <div className="subpanel rehidratacion-lotes__subpanel">
            <h4>Resultado de reconstrucción</h4>
            <div className="item-meta">
              <span className={reconstruccionActual.status === 'reconstruida' ? 'badge ok' : 'badge warning'}>
                Estado: {etiquetaEstadoReconstruccion(reconstruccionActual.status)}
              </span>
              <span>{reconstruccionActual.reconstructedExamIds.length} exámenes reconstruidos</span>
              <span>{reconstruccionActual.reconstructedQuestionBankIds.length} reactivos reconstruidos</span>
              <span>{reconstruccionActual.manifestHashes.length} manifiestos procesados</span>
            </div>
            {reconstruccionActual.status === 'fallida' ? (
              <InlineMensaje tipo="error">{mensajeEstadoReconstruccion(reconstruccionActual.status)}</InlineMensaje>
            ) : reconstruccionActual.conflicts.length || reconstruccionActual.status === 'conflicto' ? (
              <InlineMensaje tipo="warning">
                {reconstruccionActual.conflicts.length
                  ? `Se detectaron conflictos: ${reconstruccionActual.conflicts.slice(0, 3).map(resumirConflicto).join(' | ')}`
                  : mensajeEstadoReconstruccion(reconstruccionActual.status)}
              </InlineMensaje>
            ) : reconstruccionActual.status === 'verificada' ? (
              <InlineMensaje tipo="info">{mensajeEstadoReconstruccion(reconstruccionActual.status)}</InlineMensaje>
            ) : (
              <InlineMensaje tipo="ok">{mensajeEstadoReconstruccion(reconstruccionActual.status)}</InlineMensaje>
            )}
          </div>
        ) : null}
      </section>

      <details className="panel rehidratacion-panel calificaciones-human-review-panel rehidratacion-ayuda">
        <summary className="rehidratacion-ayuda__summary">
          <span className="rehidratacion-ayuda__title"><Icono nombre="escaneo" /> Apoyo visual (opcional)</span>
          <span className={mostrarModuloEmbebido ? 'badge ok' : 'badge warning'}>
            {mostrarModuloEmbebido ? 'Integrado activo' : 'Disponible'}
          </span>
        </summary>
        <p className="nota">
          Úsala cuando un lote necesite evidencia visual complementaria. La recuperación principal de paquetes firmados
          se realiza con las acciones de verificación y reconstrucción de esta sección.
        </p>

        <div className="calificaciones-human-review-panel__summary">
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Uso recomendado</span>
            <strong>Comparar la foto con el contenido visible cuando el paquete tenga observaciones o conflictos</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Entrada</span>
            <strong>Fotos del examen, evidencia por página y, cuando exista, el PDF fuente compatible</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Salida</span>
            <strong>Correcciones visuales y evidencia complementaria para lotes históricos atípicos</strong>
          </div>
        </div>

        <div className="item-meta calificaciones-human-review-panel__meta">
          <span>URL configurada: <code>{urlRevisionHumana}</code></span>
          <span>Úsala solo como apoyo; la recuperación principal se realiza en el servidor.</span>
        </div>

        <div className="item-actions calificaciones-human-review-panel__actions">
          <Boton
            type="button"
            onClick={() => {
              setMostrarModuloEmbebido((valorActual) => {
                const siguiente = !valorActual;
                registrarAccionDocente(siguiente ? 'rehidratacion_lote_embed_open' : 'rehidratacion_lote_embed_close', true);
                return siguiente;
              });
            }}
          >
            <Icono nombre="calificar" />
            {mostrarModuloEmbebido ? 'Ocultar módulo integrado' : 'Mostrar módulo integrado'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={abrirHerramienta}>
            <Icono nombre="entrar" />
            Abrir herramienta en una pestaña nueva
          </Boton>
        </div>

        {mostrarModuloEmbebido ? (
          <div className="calificaciones-human-review-panel__frame-wrap">
            <iframe
              className="calificaciones-human-review-panel__frame"
              title="Recuperación visual de apoyo"
              src={urlRevisionHumana}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <p className="nota">
          Si la herramienta visual no abre o no carga, comprueba que el servicio de apoyo esté en ejecución y que la URL configurada sea correcta.
        </p>
      </details>
    </>
  );
}
