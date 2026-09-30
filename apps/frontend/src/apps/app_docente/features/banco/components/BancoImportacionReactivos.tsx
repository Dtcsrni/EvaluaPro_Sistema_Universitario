import { useEffect, useMemo, useRef, useState } from 'react';
import { clienteApi } from '../../../clienteApiDocente';
import type { TemaBanco } from '../../../SeccionBanco.helpers';

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

function ImportSummary({ summary }: { summary: PreviewResponse['summary'] }) {
  return (
    <div className="banco-reactivos-import__summary" aria-label="Resumen de la validación">
      <span className="is-positive">{summary.create} nuevas</span>
      <span>{summary.newVersion} nuevas versiones</span>
      <span>{summary.noOp} sin cambios</span>
      {summary.conflict > 0 && <span className="is-warning">{summary.conflict} conflictos</span>}
      {summary.error > 0 && <span className="is-danger">{summary.error} errores</span>}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
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
  const [reactivosPendientes, setReactivosPendientes] = useState<string[]>([]);
  const [reactivosEnRevision, setReactivosEnRevision] = useState<string[]>([]);
  const [historialImportaciones, setHistorialImportaciones] = useState<ImportHistoryEntry[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [recargaHistorial, setRecargaHistorial] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const temaIds = useMemo(() => temas.map((tema) => tema._id).filter(Boolean), [temas]);
  const tieneConflictos = Boolean(preview && (preview.summary.conflict > 0 || preview.summary.error > 0));
  const pasoActual = preview ? 2 : reactivosPendientes.length > 0 || reactivosEnRevision.length > 0 ? 3 : 1;

  useEffect(() => {
    let vigente = true;
    setCargandoHistorial(true);
    void clienteApi.obtener<{ importaciones?: ImportHistoryEntry[] }>('/banco-preguntas/importaciones?limite=50')
      .then((resultado) => {
        if (vigente) setHistorialImportaciones(Array.isArray(resultado.importaciones) ? resultado.importaciones : []);
      })
      .catch(() => {
        if (vigente) setHistorialImportaciones([]);
      })
      .finally(() => {
        if (vigente) setCargandoHistorial(false);
      });
    return () => { vigente = false; };
  }, [periodoId, recargaHistorial]);

  function mostrarError(error: unknown, fallback: string) {
    setMensaje(error instanceof Error ? error.message : fallback);
  }

  function seleccionarArchivo(file: File | null) {
    setArchivo(file);
    setPreview(null);
    if (file) setMensaje('Archivo listo para validar. El servidor aún no ha escrito nada.');
  }

  async function copiarPlantilla() {
    const temaId = temaIds[0];
    if (!periodoId || !temaId) {
      setMensaje('Crea al menos un tema activo antes de copiar la plantilla.');
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
      setMensaje('Plantilla JSON copiada. Conserva los IDs canónicos y cambia solo el contenido.');
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
      setMensaje('JSON Schema descargado.');
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
      setMensaje('Plantilla XLSX descargada. Conserva los IDs canónicos y no alteres los encabezados.');
    } catch (error) {
      mostrarError(error, 'No se pudo descargar la plantilla XLSX.');
    }
  }

  async function previsualizar() {
    if (!archivo) return;
    try {
      setProcesando(true);
      setMensaje('Validando estructura, IDs, duplicados y versiones…');
      const form = new FormData();
      form.append('archivo', archivo);
      const resultado = await clienteApi.enviarFormData<PreviewResponse>('/banco-preguntas/importaciones/preview', form);
      setPreview(resultado);
      setMensaje(
        resultado.summary.conflict > 0 || resultado.summary.error > 0
          ? 'La validación terminó con incidencias. Corrige el archivo antes de confirmar.'
          : 'Validación lista. Confirma solo después de revisar el resumen.'
      );
    } catch (error) {
      mostrarError(error, 'No se pudo validar el archivo.');
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
      setMensaje(
        borradores.length > 0
          ? `Importación confirmada: ${borradores.length} reactivo(s) esperan revisión.`
          : 'Importación confirmada sin cambios nuevos.'
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
      setMensaje(fallidos.length > 0 ? `${fallidos.length} reactivo(s) requieren reintento.` : 'Reactivos enviados a revisión.');
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
      setMensaje(fallidos.length > 0 ? `${fallidos.length} reactivo(s) requieren reintento.` : 'Reactivos publicados y disponibles para el banco OMR.');
      onRefrescar();
    } catch (error) {
      mostrarError(error, 'No se pudieron publicar los reactivos.');
    } finally {
      setProcesando(false);
    }
  }

  if (!puedeGestionar) return null;

  return (
    <section className="banco-reactivos-import" aria-labelledby="banco-reactivos-import-title">
      <div className="banco-reactivos-import__head">
        <div>
          <p className="banco-reactivos-import__eyebrow">Carga segura</p>
          <h2 id="banco-reactivos-import-title">Importar reactivos</h2>
          <p>Importa JSON, JSONL o XLSX. El servidor valida primero; nada se publica automáticamente.</p>
        </div>
        <div className="banco-reactivos-import__tools" aria-label="Herramientas de importación">
          <button type="button" className="button button-secondary" onClick={() => void copiarPlantilla()}>Copiar plantilla</button>
          <button type="button" className="button button-secondary" onClick={() => void descargarSchema()}>Descargar schema</button>
          <button type="button" className="button button-secondary" onClick={() => void descargarPlantillaXlsx()}>Descargar formato XLSX</button>
        </div>
      </div>

      <div className="banco-reactivos-import__steps" aria-label="Pasos de importación">
        <span className={pasoActual === 1 ? 'is-active' : 'is-complete'}><b>1</b> Selecciona archivo</span>
        <span className={pasoActual === 2 ? 'is-active' : pasoActual > 2 ? 'is-complete' : ''}><b>2</b> Valida el preview</span>
        <span className={pasoActual === 3 ? 'is-active' : ''}><b>3</b> Revisa y publica</span>
      </div>

      <div className="banco-reactivos-import__upload">
        <label htmlFor="reactivos-json-file">Archivo de reactivos</label>
        <input
          ref={inputRef}
          id="reactivos-json-file"
          type="file"
          accept=".json,.jsonl,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => seleccionarArchivo(event.target.files?.[0] ?? null)}
        />
        <p className="banco-reactivos-import__hint">Contrato v1 · cinco opciones A–E · IDs canónicos · asigna un tema por reactivo al mezclar temas · JSON, JSONL o XLSX</p>
        {archivo && <p className="banco-reactivos-import__file"><strong>{archivo.name}</strong> · {formatFileSize(archivo.size)}</p>}
        <button type="button" className="button button-primary" disabled={!archivo || procesando} onClick={() => void previsualizar()}>
          {procesando ? 'Validando…' : 'Validar archivo'}
        </button>
      </div>

      {preview && (
        <div className="banco-reactivos-import__result" aria-live="polite">
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
                  <span>Línea {row.line}</span> <code>{row.externalKey}</code> — {row.operation}
                  {typeof row.detail?.temaId === 'string' && <small> · Tema: {temas.find((tema) => tema._id === row.detail?.temaId)?.nombre ?? row.detail.temaId}</small>}
                  {row.detail?.codigo && <small> · {row.detail.codigo}{row.detail.mensaje ? `: ${row.detail.mensaje}` : ''}</small>}
                </li>
              ))}
            </ul>
          </details>
          <button type="button" className="button button-primary" disabled={procesando || tieneConflictos} onClick={() => void confirmar()}>
            {tieneConflictos ? 'Corrige las incidencias para continuar' : 'Confirmar importación'}
          </button>
        </div>
      )}

      {(reactivosPendientes.length > 0 || reactivosEnRevision.length > 0) && (
        <div className="banco-reactivos-import__queue" aria-live="polite">
          <div>
            <p className="banco-reactivos-import__eyebrow">Siguiente paso</p>
            <h3>Revisión de publicación</h3>
            <p>{reactivosPendientes.length + reactivosEnRevision.length} reactivo(s) están fuera de producción.</p>
          </div>
          <div className="banco-reactivos-import__queue-actions">
            {reactivosPendientes.length > 0 && <button type="button" className="button button-primary" disabled={procesando} onClick={() => void enviarARevision()}>Enviar a revisión ({reactivosPendientes.length})</button>}
            {reactivosEnRevision.length > 0 && <button type="button" className="button button-primary" disabled={procesando} onClick={() => void publicarPendientes()}>Publicar revisados ({reactivosEnRevision.length})</button>}
          </div>
        </div>
      )}

      <section className="banco-reactivos-import__history" aria-labelledby="banco-reactivos-import-history-title">
        <div>
          <p className="banco-reactivos-import__eyebrow">Trazabilidad</p>
          <h3 id="banco-reactivos-import-history-title">Historial de importaciones</h3>
        </div>
        {cargandoHistorial ? <p role="status">Cargando historial…</p> : historialImportaciones.filter((item) => item.periodoId === periodoId).length === 0 ? (
          <p>No hay importaciones registradas para esta materia.</p>
        ) : (
          <ul aria-label="Importaciones recientes">
            {historialImportaciones.filter((item) => item.periodoId === periodoId).map((item) => (
              <li key={item.importId}>
                <div>
                  <strong>{item.batchId}</strong>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span>Estado: {item.estado}</span>
                  <span>{item.summary.create} nuevas · {item.summary.newVersion} versiones · {item.summary.noOp} sin cambios · {item.summary.conflict} conflictos · {item.summary.quarantined ?? 0} en cuarentena</span>
                </div>
                <details>
                  <summary>Ver filas ({item.rows.length})</summary>
                  <ul>
                    {item.rows.map((row) => (
                      <li key={`${item.importId}-${row.line}`}>
                        Línea {row.line}: {row.externalKey} — {row.operation} ({row.status})
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

      {mensaje && <p className="banco-reactivos-import__message" role="status">{mensaje}</p>}
    </section>
  );
}
