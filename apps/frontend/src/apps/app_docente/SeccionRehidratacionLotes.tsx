import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { Icono } from '../../ui/iconos';
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

function resumirConflicto(conflicto: Record<string, unknown>, index: number) {
  const examId = String(conflicto.examId ?? conflicto.id ?? '').trim();
  const folio = String(conflicto.folio ?? '').trim();
  const causa = String(conflicto.cause ?? conflicto.motivo ?? conflicto.reason ?? '').trim();
  return [examId || `conflicto-${index + 1}`, folio || undefined, causa || undefined].filter(Boolean).join(' | ');
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
  const [cargandoBundles, setCargandoBundles] = useState(false);
  const [bundleActivoHash, setBundleActivoHash] = useState<string>('');
  const [verificacionActual, setVerificacionActual] = useState<VerificacionRecuperacion | null>(null);
  const [reconstruccionActual, setReconstruccionActual] = useState<ResultadoReconstruccion | null>(null);
  const [procesandoHash, setProcesandoHash] = useState<string>('');
  const [errorOperacion, setErrorOperacion] = useState<string>('');

  const urlRevisionHumana = useMemo(() => {
    const valor = String(import.meta.env.VITE_OMR_HUMAN_REVIEW_URL || DEFAULT_OMR_HUMAN_REVIEW_URL).trim();
    return valor.replace(/\/+$/, '');
  }, []);
  const tipoAcceso = esAdmin ? 'Administrador' : 'Docente con plan de recuperacion habilitado';
  const bundleActivo = useMemo(
    () => bundles.find((bundle) => bundle.bundleHash === bundleActivoHash) ?? null,
    [bundleActivoHash, bundles]
  );

  const cargarBundles = useCallback(async () => {
    setCargandoBundles(true);
    setErrorOperacion('');
    try {
      const respuesta = await clienteApi.obtener<{ items: BundleRecuperable[] }>('/recuperacion/bundles');
      const items = Array.isArray(respuesta.items) ? respuesta.items : [];
      setBundles(items);
      setBundleActivoHash((actual) => {
        if (actual && items.some((item) => item.bundleHash === actual)) return actual;
        return items[0]?.bundleHash ?? '';
      });
      registrarAccionDocente('rehidratacion_lotes_listar', true);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible obtener los bundles de recuperacion.';
      setErrorOperacion(mensaje);
      emitToast({
        level: 'error',
        title: 'Rehidratacion del lote',
        message: mensaje,
        durationMs: 4200
      });
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
        title: 'Rehidratacion del lote',
        message: 'No se encontro una URL configurada para la herramienta visual de apoyo.',
        durationMs: 3600
      });
      return;
    }
    const nuevaVentana = window.open(urlRevisionHumana, '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      emitToast({
        level: 'warn',
        title: 'Rehidratacion del lote',
        message: 'El navegador bloqueo la nueva pestana. Permite popups e intenta de nuevo.',
        durationMs: 4200
      });
      return;
    }
    registrarAccionDocente('rehidratacion_lote_open', true);
  }, [urlRevisionHumana]);

  const verificarBundle = useCallback(async () => {
    if (!bundleActivo) return;
    setProcesandoHash(bundleActivo.bundleHash);
    setErrorOperacion('');
    setRecontruccionNull();
    try {
      const respuesta = await clienteApi.enviar<VerificacionRecuperacion>('/recuperacion/verificar', {
        bundleHash: bundleActivo.bundleHash
      });
      setVerificacionActual(respuesta);
      emitToast({
        level: respuesta.recoverable ? 'ok' : 'warn',
        title: 'Verificacion de bundle',
        message: respuesta.recoverable
          ? 'El bundle es recuperable y paso las validaciones.'
          : 'El bundle presenta observaciones y no es recuperable en su estado actual.',
        durationMs: 3600
      });
      registrarAccionDocente('rehidratacion_bundle_verificar', true);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible verificar el bundle seleccionado.';
      setErrorOperacion(mensaje);
      emitToast({
        level: 'error',
        title: 'Verificacion de bundle',
        message: mensaje,
        durationMs: 4200
      });
      registrarAccionDocente('rehidratacion_bundle_verificar', false);
    } finally {
      setProcesandoHash('');
    }
  }, [bundleActivo]);

  const reconstruirBundle = useCallback(async () => {
    if (!bundleActivo) return;
    setProcesandoHash(bundleActivo.bundleHash);
    setErrorOperacion('');
    try {
      const respuesta = await clienteApi.enviar<ResultadoReconstruccion>('/recuperacion/bundle/reconstruir', {
        bundleHash: bundleActivo.bundleHash
      });
      setReconstruccionActual(respuesta);
      emitToast({
        level: respuesta.status === 'reconstruida' ? 'ok' : respuesta.status === 'conflicto' ? 'warn' : 'error',
        title: 'Reconstruccion de lote',
        message:
          respuesta.status === 'reconstruida'
            ? 'El lote fue reconstruido y persistido correctamente.'
            : respuesta.status === 'conflicto'
              ? 'La reconstruccion detecto conflictos y no sobreescribio material inconsistente.'
              : 'La reconstruccion del lote fallo.',
        durationMs: 4200
      });
      registrarAccionDocente('rehidratacion_bundle_reconstruir', true);
      await cargarBundles();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible reconstruir el lote seleccionado.';
      setErrorOperacion(mensaje);
      emitToast({
        level: 'error',
        title: 'Reconstruccion de lote',
        message: mensaje,
        durationMs: 4200
      });
      registrarAccionDocente('rehidratacion_bundle_reconstruir', false);
    } finally {
      setProcesandoHash('');
    }
  }, [bundleActivo, cargarBundles]);

  if (!puedeUsar) {
    return (
      <section className="panel">
        <InlineMensaje tipo="error">
          Esta capacidad de rehidratacion solo esta disponible para administradores o docentes con recuperacion de lotes habilitada.
        </InlineMensaje>
      </section>
    );
  }

  function setRecontruccionNull() {
    setReconstruccionActual(null);
  }

  return (
    <>
      <section className="panel calificaciones-hero">
        <div className="calificaciones-hero__head">
          <h2>
            <Icono nombre="pdf" /> Rehidratacion canonica del lote
          </h2>
          <p className="nota">
            Recupera banco de reactivos, respuestas correctas, permutaciones y examenes sinteticos a partir de lotes de fotos
            generados por versiones recientes y compatibles del sistema.
          </p>
        </div>
        <div className="calificaciones-kpi" aria-live="polite">
          <div className="calificaciones-kpi__item"><span>Tipo de acceso</span><b>{tipoAcceso}</b></div>
          <div className="calificaciones-kpi__item"><span>Uso esperado</span><b>Recuperacion forense</b></div>
          <div className="calificaciones-kpi__item"><span>Bundles detectados</span><b>{bundles.length}</b></div>
          <div className="calificaciones-kpi__item"><span>Salida objetivo</span><b>Banco y examenes rehidratados</b></div>
        </div>
        <div className="item-meta calificaciones-hero__meta">
          <span className="badge warning">No es un flujo de calificacion diaria</span>
          <span className="badge ok">Usuario actual: {docente?.correo ?? 'sin sesion'}</span>
        </div>
      </section>

      <section className="panel">
        <div className="calificaciones-human-review-panel__head">
          <div className="calificaciones-human-review-panel__title">
            <h3>
              <Icono nombre="escaneo" /> Recuperacion operativa desde bundles firmados
            </h3>
            <p className="nota">
              Este flujo usa los `recoveryBundle` y `recoveryManifest` ya firmados por el sistema. Primero verifica
              integridad y recuperabilidad. Despues reconstruye banco, variantes y examenes dentro del sistema.
            </p>
          </div>
          <span className={bundleActivo?.recoverable ? 'badge ok' : 'badge warning'}>
            {bundleActivo ? `Bundle activo: ${bundleActivo.bundleHash}` : 'Sin bundle seleccionado'}
          </span>
        </div>

        <div className="item-actions" style={{ marginBottom: 16 }}>
          <Boton type="button" variante="secundario" onClick={() => void cargarBundles()} cargando={cargandoBundles}>
            <Icono nombre="recargar" />
            Actualizar inventario
          </Boton>
          <Boton
            type="button"
            onClick={() => void verificarBundle()}
            cargando={procesandoHash === bundleActivoHash}
            disabled={!bundleActivo}
          >
            <Icono nombre="info" />
            Verificar bundle
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            onClick={() => void reconstruirBundle()}
            cargando={procesandoHash === bundleActivoHash}
            disabled={!bundleActivo}
          >
            <Icono nombre="calificar" />
            Reconstruir lote
          </Boton>
        </div>

        {errorOperacion ? <InlineMensaje tipo="error">{errorOperacion}</InlineMensaje> : null}

        <div className="calificaciones-kpi" aria-live="polite">
          <div className="calificaciones-kpi__item">
            <span>Bundle activo</span>
            <b>{bundleActivo?.loteId ?? 'Sin seleccionar'}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Template</span>
            <b>{bundleActivo?.templateVersion ? `TV${bundleActivo.templateVersion}` : 'N/D'}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Examenes</span>
            <b>{bundleActivo?.examCount ?? 0}</b>
          </div>
          <div className="calificaciones-kpi__item">
            <span>Reactivos</span>
            <b>{bundleActivo?.questionBankCount ?? 0}</b>
          </div>
        </div>

        {bundles.length ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {bundles.map((bundle) => {
              const activo = bundle.bundleHash === bundleActivoHash;
              return (
                <button
                  key={bundle.bundleHash}
                  type="button"
                  className={`item-glass${activo ? ' activo' : ''}`}
                  onClick={() => {
                    setBundleActivoHash(bundle.bundleHash);
                    setVerificacionActual(null);
                    setReconstruccionActual(null);
                    setErrorOperacion('');
                  }}
                  style={{
                    textAlign: 'left',
                    border: activo ? '1px solid var(--accent, #1ea7ff)' : undefined,
                    padding: 16,
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <div className="item-meta">
                    <span className={bundle.signatureValid ? 'badge ok' : 'badge warning'}>
                      {bundle.signatureValid ? 'Firma valida' : 'Firma invalida'}
                    </span>
                    <span className={bundle.recoverable ? 'badge ok' : 'badge warning'}>
                      {bundle.recoverable ? 'Recuperable' : 'Con observaciones'}
                    </span>
                    <span className="badge">Template {bundle.templateVersion ? `TV${bundle.templateVersion}` : 'N/D'}</span>
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{bundle.loteId}</div>
                  <div className="item-meta" style={{ marginTop: 8 }}>
                    <span>Bundle hash: {bundle.bundleHash}</span>
                    <span>{bundle.examCount} examenes</span>
                    <span>{bundle.questionBankCount} reactivos</span>
                  </div>
                  {bundle.causes.length ? (
                    <div style={{ marginTop: 8 }}>
                      <InlineMensaje tipo="warning">{bundle.causes.join(' | ')}</InlineMensaje>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <InlineMensaje tipo="info">
            No hay bundles recuperables visibles para esta cuenta. Si esperabas alguno, verifica permisos, tenant y plan activo.
          </InlineMensaje>
        )}

        {verificacionActual ? (
          <div className="subpanel" style={{ marginTop: 16 }}>
            <h4>Resultado de verificacion</h4>
            <div className="item-meta">
              <span className={verificacionActual.signatureValid ? 'badge ok' : 'badge warning'}>
                {verificacionActual.signatureValid ? 'Firma valida' : 'Firma invalida'}
              </span>
              <span className={verificacionActual.recoverable ? 'badge ok' : 'badge warning'}>
                {verificacionActual.recoverable ? 'Recuperable' : 'No recuperable'}
              </span>
              <span>Template {verificacionActual.templateVersion ? `TV${verificacionActual.templateVersion}` : 'N/D'}</span>
              <span>{verificacionActual.examCount} examenes</span>
              <span>{verificacionActual.questionBankCount} reactivos</span>
            </div>
            {verificacionActual.causes.length ? (
              <InlineMensaje tipo="warning">{verificacionActual.causes.join(' | ')}</InlineMensaje>
            ) : (
              <InlineMensaje tipo="ok">La firma y la estructura del bundle son consistentes para reconstruccion.</InlineMensaje>
            )}
          </div>
        ) : null}

        {reconstruccionActual ? (
          <div className="subpanel" style={{ marginTop: 16 }}>
            <h4>Resultado de reconstruccion</h4>
            <div className="item-meta">
              <span className={reconstruccionActual.status === 'reconstruida' ? 'badge ok' : 'badge warning'}>
                Estado: {reconstruccionActual.status}
              </span>
              <span>{reconstruccionActual.reconstructedExamIds.length} examenes reconstruidos</span>
              <span>{reconstruccionActual.reconstructedQuestionBankIds.length} reactivos reconstruidos</span>
              <span>{reconstruccionActual.manifestHashes.length} manifests procesados</span>
            </div>
            {reconstruccionActual.conflicts.length ? (
              <InlineMensaje tipo="warning">
                Se detectaron conflictos: {reconstruccionActual.conflicts.slice(0, 3).map(resumirConflicto).join(' | ')}
              </InlineMensaje>
            ) : (
              <InlineMensaje tipo="ok">La reconstruccion fue persistida sin conflictos estructurales.</InlineMensaje>
            )}
          </div>
        ) : null}
      </section>

      <section className="panel calificaciones-human-review-panel">
        <div className="calificaciones-human-review-panel__head">
          <div className="calificaciones-human-review-panel__title">
            <h3>
              <Icono nombre="escaneo" /> Apoyo visual para lotes historicos
            </h3>
            <p className="nota">
              Usa esta herramienta solo cuando el lote necesite evidencia visual complementaria. El flujo principal de esta
              seccion ya no depende de revision manual para reconstruir bundles firmados consistentes.
            </p>
          </div>
          <span className={mostrarModuloEmbebido ? 'badge ok' : 'badge warning'}>
            {mostrarModuloEmbebido ? 'Modulo embebido activo' : 'Modulo visual disponible'}
          </span>
        </div>

        <div className="calificaciones-human-review-panel__summary">
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Uso recomendado</span>
            <strong>Comparar foto real contra contenido visible cuando el bundle tenga observaciones o conflicto</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Entrada</span>
            <strong>Fotos del examen, evidencia por pagina y, cuando exista, PDF fuente compatible</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Salida</span>
            <strong>Correcciones visuales y evidencia complementaria para lotes historicos atipicos</strong>
          </div>
        </div>

        <div className="item-meta calificaciones-human-review-panel__meta">
          <span>URL configurada: <code>{urlRevisionHumana}</code></span>
          <span>Utilizala solo como apoyo; la recuperacion primaria ya vive en el backend.</span>
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
            {mostrarModuloEmbebido ? 'Ocultar modulo embebido' : 'Mostrar modulo embebido'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={abrirHerramienta}>
            <Icono nombre="entrar" />
            Abrir herramienta en pestana nueva
          </Boton>
        </div>

        {mostrarModuloEmbebido ? (
          <div className="calificaciones-human-review-panel__frame-wrap">
            <iframe
              className="calificaciones-human-review-panel__frame"
              title="Rehidratacion visual de apoyo"
              src={urlRevisionHumana}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <InlineMensaje tipo="info">
          Si la herramienta visual no abre o no carga dentro del portal, inicia el servidor local con{' '}
          <code>npm -C apps/backend run omr:tv3:review:ui</code>.
        </InlineMensaje>
      </section>
    </>
  );
}
