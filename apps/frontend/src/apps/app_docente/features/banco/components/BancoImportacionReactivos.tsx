import { useEffect, useMemo, useRef, useState } from 'react';
import { clienteApi } from '../../../clienteApiDocente';
import type { TemaBanco } from '../../../SeccionBanco.helpers';
import { mensajeDeError } from '../../../utilidades';
import { ErrorRemoto } from '../../../../../servicios_api/clienteApi';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';

type PreviewRow = {
  line: number;
  externalKey: string;
  operation: string;
  status: string;
  reactivoId?: string | null;
  detail?: { codigo?: string; mensaje?: string; reasons?: string[]; [key: string]: unknown };
};

type PreviewResponse = {
  importId: string;
  planHash: string;
  payload: Record<string, unknown>;
  summary: { create: number; noOp: number; newVersion: number; conflict: number; error: number; quarantined?: number };
  rows: PreviewRow[];
};

type ConfirmResponse = {
  reactivoIds: string[];
  draftReactivoIds?: string[];
  estado: string;
};

type ImportHistoryEntry = {
  importId: string;
  batchId: string;
  periodoId: string | null;
  estado: string;
  inputSha256: string;
  createdAt: string;
  summary: PreviewResponse['summary'];
  rows: PreviewRow[];
};

type TipoMensajeImportacion = 'info' | 'ok' | 'error';

function ImportSummary({ summary }: { summary: PreviewResponse['summary'] }) {
  return (
    <ul className="banco-reactivos-import__summary" aria-label="Resumen de la validación">
      <li className="is-positive">{summary.create} {summary.create === 1 ? 'reactivo nuevo' : 'reactivos nuevos'}</li>
      <li>{summary.newVersion} {summary.newVersion === 1 ? 'nueva versión' : 'nuevas versiones'}</li>
      <li>{summary.noOp} {summary.noOp === 1 ? 'reactivo sin cambios' : 'reactivos sin cambios'}</li>
      {summary.conflict > 0 && <li className="is-warning">{summary.conflict} {summary.conflict === 1 ? 'conflicto' : 'conflictos'}</li>}
      {summary.error > 0 && <li className="is-danger">{summary.error} {summary.error === 1 ? 'error' : 'errores'}</li>}
    </ul>
  );
}

function textoResumenImportacion(summary: PreviewResponse['summary']) {
  const nuevas = `${summary.create} ${summary.create === 1 ? 'reactivo nuevo' : 'reactivos nuevos'}`;
  const versiones = `${summary.newVersion} ${summary.newVersion === 1 ? 'versión nueva' : 'versiones nuevas'}`;
  const sinCambios = `${summary.noOp} ${summary.noOp === 1 ? 'reactivo sin cambios' : 'reactivos sin cambios'}`;
  const conflictos = `${summary.conflict} ${summary.conflict === 1 ? 'conflicto' : 'conflictos'}`;
  const cuarentena = Number(summary.quarantined ?? 0);
  return `${nuevas} · ${versiones} · ${sinCambios} · ${conflictos} · ${cuarentena} ${cuarentena === 1 ? 'reactivo en cuarentena' : 'reactivos en cuarentena'}`;
}

function etiquetaOperacionFila(operation: string) {
  switch (operation) {
    case 'create': return 'Crear reactivo';
    case 'noOp': return 'Sin cambios';
    case 'newVersion': return 'Crear nueva versión';
    case 'conflict': return 'Conflicto';
    case 'quarantine': return 'Enviar a cuarentena';
    default: return `Operación no reconocida (${operation || 'vacía'})`;
  }
}

function etiquetaEstadoFila(status: string) {
  switch (status) {
    case 'valid': return 'Lista para importar';
    case 'conflict': return 'Conflicto';
    case 'applied': return 'Aplicada';
    case 'quarantined': return 'En cuarentena';
    default: return `Estado no reconocido (${status || 'vacío'})`;
  }
}

function etiquetaEstadoImportacion(status: string) {
  switch (status) {
    case 'preview': return 'Vista previa';
    case 'confirmed': return 'Importación confirmada';
    case 'quarantined': return 'En cuarentena';
    default: return `Estado no reconocido (${status || 'vacío'})`;
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('es-MX', { maximumFractionDigits: 2 })} MB`;
  }
  return `${(bytes / 1024).toFixed(bytes < 1024 * 1024 ? 1 : 2)} KB`;
}

export function BancoImportacionReactivos({
  periodoId,
  temas,
  puedeGestionar,
  onRefrescar
}: {
  periodoId: string;
  temas: TemaBanco[];
  puedeGestionar: boolean;
  onRefrescar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<TipoMensajeImportacion>('info');
  const [reactivosPendientes, setReactivosPendientes] = useState<string[]>([]);
  const [reactivosEnRevision, setReactivosEnRevision] = useState<string[]>([]);
  const [historialImportaciones, setHistorialImportaciones] = useState<ImportHistoryEntry[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState('');
  const [recargaHistorial, setRecargaHistorial] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const temaIds = useMemo(() => temas.map((tema) => tema._id).filter(Boolean), [temas]);
  const tieneConflictos = Boolean(preview && (preview.summary.conflict > 0 || preview.summary.error > 0));
  const historialDeMateria = historialImportaciones.filter((item) => item.periodoId === periodoId);
  const pasoActual = reactivosPendientes.length > 0 || reactivosEnRevision.length > 0
    ? 3
    : preview || archivo || procesando ? 2 : 1;

  useEffect(() => {
    let vigente = true;
    setCargandoHistorial(true);
    setErrorHistorial('');
    void clienteApi.obtener<{ importaciones?: ImportHistoryEntry[] }>('/banco-preguntas/importaciones?limite=50')
      .then((resultado) => {
        if (vigente) {
          const importaciones = Array.isArray(resultado.importaciones) ? resultado.importaciones : [];
          setHistorialImportaciones(importaciones.map((item) => ({
            ...item,
            rows: Array.isArray(item.rows) ? item.rows : []
          })));
          setErrorHistorial('');
        }
      })
      .catch((error: unknown) => {
        if (vigente) {
          setErrorHistorial(mensajeDeError(error, 'No se pudo cargar el historial de importaciones.'));
        }
      })
      .finally(() => {
        if (vigente) setCargandoHistorial(false);
      });
    return () => { vigente = false; };
  }, [periodoId, recargaHistorial]);

  function mostrarMensaje(texto: string, tipo: TipoMensajeImportacion = 'info') {
    setMensaje(texto);
    setTipoMensaje(tipo);
  }

  function mostrarError(error: unknown, fallback: string) {
    mostrarMensaje(mensajeDeError(error, fallback), 'error');
  }

  function mostrarErrorPreview(error: unknown) {
    const codigo = error instanceof ErrorRemoto ? error.detalle.codigo : undefined;
    const mensajeOriginal = error instanceof Error ? error.message : '';
    if (codigo === 'REACTIVOS_PAYLOAD_INVALIDO' || /no cumple el contrato v1/i.test(mensajeOriginal)) {
      mostrarMensaje(
        'Formato no compatible. Corrige el archivo con la plantilla o el esquema y valida de nuevo.',
        'error'
      );
      return;
    }
    mostrarError(error, 'No se pudo validar el archivo.');
  }

  function seleccionarArchivo(file: File | null) {
    setArchivo(file);
    setPreview(null);
    mostrarMensaje(file ? 'Archivo listo para validar. El servidor aún no ha escrito nada.' : 'Se quitó el archivo. Selecciona uno para validar.');
  }

  async function copiarPlantilla() {
    const temaId = temaIds[0];
    if (!periodoId || !temaId) {
      mostrarMensaje('Crea al menos un tema activo antes de copiar la plantilla.', 'error');
      return;
    }
    const ejemplo = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `ia-${periodoId}-001`,
      target: { periodoId, temaIds: [temaId] },
      source: {
        kind: 'ai_generated',
        generator: 'ChatGPT',
        generatorModel: 'indicar-modelo',
        generatedAt: new Date().toISOString(),
        sourceDocumentSha256: null
      },
      items: [{
        externalKey: 'reactivo-001',
        temaId,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: 'Escribe aquí el enunciado.' },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({ key, value: `Opción ${key}`, isCorrect: index === 0 })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'generated', confidence: 0.8, notes: 'Describe la fuente y las dudas pendientes.' }
      }]
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(ejemplo, null, 2));
      mostrarMensaje('Plantilla JSON copiada. Conserva los IDs canónicos y cambia solo el contenido.', 'ok');
    } catch (error) {
      mostrarError(error, 'No se pudo copiar la plantilla JSON.');
    }
  }

  async function descargarSchema() {
    try {
      const schema = await clienteApi.obtener<Record<string, unknown>>('/banco-preguntas/importaciones/esquema');
      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/schema+json' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'reactivos-batch.v1.schema.json';
      enlace.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      mostrarMensaje('JSON Schema descargado.', 'ok');
    } catch (error) {
      mostrarError(error, 'No se pudo descargar el schema.');
    }
  }

  async function descargarPlantillaXlsx() {
    try {
      const response = await clienteApi.obtenerBinario('/banco-preguntas/importaciones/plantilla.xlsx');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'plantilla-reactivos-v1.xlsx';
      enlace.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      mostrarMensaje('Plantilla XLSX descargada. Conserva los IDs canónicos y no alteres los encabezados.', 'ok');
    } catch (error) {
      mostrarError(error, 'No se pudo descargar la plantilla XLSX.');
    }
  }

  async function previsualizar() {
    if (!archivo) return;
    try {
      setProcesando(true);
      mostrarMensaje('Validando estructura, IDs, duplicados y versiones…');
      const form = new FormData();
      form.append('archivo', archivo);
      const resultado = await clienteApi.enviarFormData<PreviewResponse>('/banco-preguntas/importaciones/preview', form);
      setPreview(resultado);
      mostrarMensaje(
        resultado.summary.conflict > 0 || resultado.summary.error > 0
          ? 'La validación terminó con incidencias. Corrige el archivo antes de confirmar.'
          : 'Validación lista. Confirma solo después de revisar el resumen.',
        resultado.summary.conflict > 0 || resultado.summary.error > 0 ? 'error' : 'ok'
      );
    } catch (error) {
      mostrarErrorPreview(error);
    } finally {
      setProcesando(false);
    }
  }

  async function confirmar() {
    if (!preview || tieneConflictos) return;
    try {
      setProcesando(true);
      const resultado = await clienteApi.enviar<ConfirmResponse>(
        `/banco-preguntas/importaciones/${encodeURIComponent(preview.importId)}/confirmar`,
        { planHash: preview.planHash, payload: preview.payload }
      );
      const borradores = resultado.draftReactivoIds ?? [];
      mostrarMensaje(
        borradores.length > 0
          ? `Importación confirmada: ${borradores.length} reactivo(s) esperan revisión.`
          : 'Importación confirmada sin cambios nuevos.',
        'ok'
      );
      setPreview(null);
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = '';
      setReactivosPendientes(borradores);
      setRecargaHistorial((actual) => actual + 1);
      onRefrescar();
    } catch (error) {
      mostrarError(error, 'No se pudo confirmar el plan. Vuelve a generar el preview.');
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(ids: string[], ruta: 'revisar' | 'publicar') {
    const resultados = await Promise.allSettled(
      ids.map((reactivoId) => clienteApi.enviar(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}/${ruta}`, {}))
    );
    return ids.filter((_, index) => resultados[index]?.status === 'rejected');
  }

  async function enviarARevision() {
    if (reactivosPendientes.length === 0) return;
    try {
      setProcesando(true);
      const ids = reactivosPendientes;
      const fallidos = await cambiarEstado(ids, 'revisar');
      const exitosos = ids.filter((id) => !fallidos.includes(id));
      setReactivosPendientes(fallidos);
      setReactivosEnRevision((actuales) => [...actuales, ...exitosos]);
      mostrarMensaje(fallidos.length > 0 ? `${fallidos.length} reactivo(s) requieren reintento.` : 'Reactivos enviados a revisión.', fallidos.length > 0 ? 'error' : 'ok');
      onRefrescar();
    } catch (error) {
      mostrarError(error, 'No se pudieron enviar los reactivos a revisión.');
    } finally {
      setProcesando(false);
    }
  }

  async function publicarPendientes() {
    if (reactivosEnRevision.length === 0) return;
    try {
      setProcesando(true);
      const ids = reactivosEnRevision;
      const fallidos = await cambiarEstado(ids, 'publicar');
      setReactivosEnRevision(fallidos);
      mostrarMensaje(fallidos.length > 0 ? `${fallidos.length} reactivo(s) requieren reintento.` : 'Reactivos publicados y disponibles para el banco OMR.', fallidos.length > 0 ? 'error' : 'ok');
      onRefrescar();
    } catch (error) {
      mostrarError(error, 'No se pudieron publicar los reactivos.');
    } finally {
      setProcesando(false);
    }
  }

  if (!puedeGestionar) return null;

  return (
    <section id="banco-importacion" tabIndex={-1} className="banco-reactivos-import" aria-labelledby="banco-reactivos-import-title">
      <div className="banco-reactivos-import__head">
        <div>
          <p className="banco-reactivos-import__eyebrow">Carga segura</p>
          <h2 id="banco-reactivos-import-title">Importar reactivos</h2>
          <p>Importa JSON, JSONL o XLSX. El servidor valida primero; nada se publica automáticamente.</p>
        </div>
        <div className="banco-reactivos-import__tools" role="group" aria-label="Herramientas de importación">
          <Boton variante="secundario" onClick={() => void copiarPlantilla()}>Copiar plantilla</Boton>
          <Boton variante="secundario" onClick={() => void descargarSchema()}>Descargar schema</Boton>
          <Boton variante="secundario" onClick={() => void descargarPlantillaXlsx()}>Descargar formato XLSX</Boton>
        </div>
      </div>

      <ol className="banco-reactivos-import__steps" aria-label="Pasos de importación">
        {(['Selecciona archivo', 'Valida la vista previa', 'Revisa y publica'] as const).map((titulo, index) => {
          const numeroPaso = index + 1;
          const estado = numeroPaso === pasoActual ? 'is-active' : numeroPaso < pasoActual ? 'is-complete' : '';
          return (
            <li key={titulo} className={estado} aria-current={numeroPaso === pasoActual ? 'step' : undefined}>
              <b aria-hidden="true">{numeroPaso}</b>
              <span>{titulo}</span>
              {numeroPaso === pasoActual && <span className="sr-only">Paso actual</span>}
            </li>
          );
        })}
      </ol>

      <div className="banco-reactivos-import__upload">
        <span id="banco-reactivos-import-file-label" className="banco-reactivos-import__file-label">Archivo de reactivos</span>
        <div className="banco-reactivos-import__file-picker">
          <input
            ref={inputRef}
            id="reactivos-json-file"
            className="sr-only banco-reactivos-import__file-input"
            type="file"
            aria-hidden="true"
            tabIndex={-1}
            accept=".json,.jsonl,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => seleccionarArchivo(event.target.files?.[0] ?? null)}
          />
          <Boton
            type="button"
            variante="secundario"
            className="banco-reactivos-import__file-trigger"
            aria-label="Seleccionar archivo de reactivos"
            aria-describedby="banco-reactivos-import-hint banco-reactivos-import-file"
            onClick={() => inputRef.current?.click()}
          >
            Elegir archivo
          </Boton>
        </div>
        <p className="banco-reactivos-import__hint" id="banco-reactivos-import-hint">Formatos JSON, JSONL o XLSX · contrato v1 · opciones A–E · IDs canónicos · asigna un tema por reactivo al mezclar temas</p>
        <p id="banco-reactivos-import-file" className="banco-reactivos-import__file" role="status" aria-atomic="true">
          {archivo ? <>Archivo seleccionado: <strong>{archivo.name}</strong> · {formatFileSize(archivo.size)}</> : 'Sin archivo seleccionado.'}
        </p>
        <Boton cargando={procesando} variante="primario" disabled={!archivo} onClick={() => void previsualizar()}>
          {procesando ? 'Validando…' : 'Validar archivo'}
        </Boton>
      </div>

      {mensaje && (tipoMensaje === 'error'
        ? <InlineMensaje tipo="error">{mensaje}</InlineMensaje>
        : <p className={`banco-reactivos-import__message${tipoMensaje === 'ok' ? ' ok' : ''}`} role="status">{mensaje}</p>)}

      {preview && (
        <div className="banco-reactivos-import__result">
          <div className="banco-reactivos-import__result-head">
            <div>
              <p className="banco-reactivos-import__eyebrow">Preview sin escritura</p>
              <h3>Resultado de la validación</h3>
            </div>
            <code title={preview.planHash}>Plan {preview.planHash.slice(0, 12)}…</code>
          </div>
          <ImportSummary summary={preview.summary} />
          <details className="banco-reactivos-import__details">
            <summary>Ver detalle por fila ({preview.rows.length})</summary>
            <ul>
              {preview.rows.map((row) => (
                <li key={`${row.line}-${row.externalKey}`}>
                  <span>Línea {row.line}</span> <code>{row.externalKey}</code> — {etiquetaOperacionFila(row.operation)} · {etiquetaEstadoFila(row.status)}
                  {typeof row.detail?.temaId === 'string' && <small> · Tema: {temas.find((tema) => tema._id === row.detail?.temaId)?.nombre ?? row.detail.temaId}</small>}
                  {row.detail?.codigo && <small> · {row.detail.codigo}{row.detail.mensaje ? `: ${row.detail.mensaje}` : ''}</small>}
                </li>
              ))}
            </ul>
          </details>
          <Boton cargando={procesando} variante="primario" disabled={tieneConflictos} onClick={() => void confirmar()}>
            {tieneConflictos ? 'Corrige las incidencias para continuar' : 'Confirmar importación'}
          </Boton>
        </div>
      )}

      {(reactivosPendientes.length > 0 || reactivosEnRevision.length > 0) && (
        <div className="banco-reactivos-import__queue">
          <div>
            <p className="banco-reactivos-import__eyebrow">Siguiente paso</p>
            <h3>Revisión de publicación</h3>
            <p>{reactivosPendientes.length + reactivosEnRevision.length} reactivo(s) están fuera de producción.</p>
          </div>
          <div className="banco-reactivos-import__queue-actions">
            {reactivosPendientes.length > 0 && <Boton variante="primario" cargando={procesando} onClick={() => void enviarARevision()}>Enviar a revisión ({reactivosPendientes.length})</Boton>}
            {reactivosEnRevision.length > 0 && <Boton variante="primario" cargando={procesando} onClick={() => void publicarPendientes()}>Publicar revisados ({reactivosEnRevision.length})</Boton>}
          </div>
        </div>
      )}

      <section className="banco-reactivos-import__history" aria-labelledby="banco-reactivos-import-history-title">
        <div>
          <p className="banco-reactivos-import__eyebrow">Trazabilidad</p>
          <h3 id="banco-reactivos-import-history-title">Historial de importaciones</h3>
        </div>
        {cargandoHistorial && <p role="status">Cargando historial…</p>}
        {!cargandoHistorial && errorHistorial ? (
          <>
            <p role="alert">No se pudo {historialDeMateria.length > 0 ? 'actualizar' : 'cargar'} el historial: {errorHistorial}</p>
            <Boton variante="secundario" onClick={() => setRecargaHistorial((actual) => actual + 1)}>Reintentar carga del historial</Boton>
          </>
        ) : null}
        {(cargandoHistorial || errorHistorial) && historialDeMateria.length > 0 && (
          <p className="nota" role="note">
            {cargandoHistorial
              ? 'Se muestran los últimos resultados cargados para esta materia mientras se actualiza el historial.'
              : 'La consulta falló; se conservan los últimos resultados cargados para esta materia.'}
          </p>
        )}
        {!cargandoHistorial && !errorHistorial && historialDeMateria.length === 0 && (
          <p>No hay importaciones registradas para esta materia.</p>
        )}
        {historialDeMateria.length > 0 && (
          <ul aria-label="Importaciones recientes">
            {historialDeMateria.map((item) => (
              <li key={item.importId}>
                <div>
                  <strong>{item.batchId}</strong>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span>Estado: {etiquetaEstadoImportacion(item.estado)}</span>
                  <span>{textoResumenImportacion(item.summary)}</span>
                </div>
                <details>
                  <summary>Ver filas ({item.rows.length})</summary>
                  <ul>
                    {item.rows.map((row) => (
                      <li key={`${item.importId}-${row.line}`}>
                        Línea {row.line}: {row.externalKey} — {etiquetaOperacionFila(row.operation)} ({etiquetaEstadoFila(row.status)})
                        {row.detail?.reasons?.length ? <small> — Revisión requerida: {row.detail.reasons.join(', ')}</small> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
