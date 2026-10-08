import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { crearClaveLoteGeneracion, guardarLotePendiente, leerLotePendiente, validarResumenLoteGenerado } from './features/plantillas/loteGeneracionSesion';
import type { Periodo } from './tipos';
import { etiquetaMateria, mensajeDeError } from './utilidades';
import type { FilaConsultaCalificacion } from './ConsultaCalificaciones';

type PlantillaExtra = { _id: string; periodoId?: string; titulo: string; tipo?: string; numeroPaginas?: number; archivadoEn?: string };
type ExamenHistoricoExtra = { _id?: string; id?: string; folio: string; loteId?: string | null; alumnoId?: string | null; alumnoNombre?: string; estado?: string; tipoExamen?: string; generadoEn?: string };
type PaginaPreview = { numero: number; width: number; height: number; dataUrl: string };
type PreviewExtra = { layoutConfirmado?: boolean; numeroPaginas?: number; paginas?: PaginaPreview[]; totalUsados?: number; totalDisponibles?: number };
type ResumenLoteExtra = { loteId: string; totalAlumnos: number; totalPaginas: number; paginasPorExamen: number; pdfSha256: string; lotePdfUrl: string };

function nombreAlumno(fila: FilaConsultaCalificacion) {
  return [fila.apellidoPaterno, fila.apellidoMaterno, fila.nombre].filter(Boolean).join(' ') || 'Alumno sin nombre';
}

function decimal(valor?: string) {
  const numero = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(numero) ? new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false }).format(numero) : '—';
}

function uuid() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('El navegador no pudo generar una clave segura para la operación.');
  return globalThis.crypto.randomUUID();
}

export function ExtraordinariosCalificaciones({
  periodos, periodoId, onPeriodoChange, puedeCalificar, puedeGenerar, onAbrirRevision
}: {
  periodos: Periodo[];
  periodoId: string;
  onPeriodoChange: (id: string) => void;
  puedeCalificar: boolean;
  puedeGenerar: boolean;
  onAbrirRevision: (alumnoId: string) => void;
}) {
  const [filas, setFilas] = useState<FilaConsultaCalificacion[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaExtra[]>([]);
  const [examenesHistoricos, setExamenesHistoricos] = useState<ExamenHistoricoExtra[]>([]);
  const [cursorExamenes, setCursorExamenes] = useState<string | null>(null);
  const [cargandoMasExamenes, setCargandoMasExamenes] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [plantillaId, setPlantillaId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [preview, setPreview] = useState<PreviewExtra | null>(null);
  const [confirmoPreview, setConfirmoPreview] = useState(false);
  const [resultadoLote, setResultadoLote] = useState<ResumenLoteExtra | null>(null);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState('');
  const [alumnoExternoId, setAlumnoExternoId] = useState('');
  const [archivoHash, setArchivoHash] = useState({ nombre: '', sha256: '' });
  const [calculandoHash, setCalculandoHash] = useState(false);
  const [guardandoExterno, setGuardandoExterno] = useState(false);
  const [externo, setExterno] = useState({ folio: '', loteId: '', aciertos: '', totalReactivos: '', criteriosAplicados: '' });
  const claveExternoPendiente = useRef<{ payload: string; id: string } | null>(null);
  const solicitudesPendientes = useRef(new Map<string, { payload: string; id: string }>());
  const cargarFilas = useCallback(async () => {
    if (!periodoId) { setFilas([]); return; }
    setCargando(true);
    setError('');
    try {
      const [respuesta, historial] = await Promise.all([
        clienteApi.obtener<{ filas?: FilaConsultaCalificacion[] }>(`/analiticas/lista-academica?periodoId=${encodeURIComponent(periodoId)}`),
        clienteApi.obtener<{ examenes?: ExamenHistoricoExtra[]; nextCursor?: string | null }>(`/examenes/generados?periodoId=${encodeURIComponent(periodoId)}&limite=100`)
      ]);
      setFilas(Array.isArray(respuesta?.filas) ? respuesta.filas : []);
      setExamenesHistoricos((Array.isArray(historial?.examenes) ? historial.examenes : []).filter((examen) => examen.tipoExamen === 'extraordinario'));
      setCursorExamenes(historial?.nextCursor ?? null);
    } catch (razon) {
      setError(mensajeDeError(razon, 'No se pudo cargar la elegibilidad extraordinaria.'));
      setFilas([]);
      setExamenesHistoricos([]);
      setCursorExamenes(null);
    } finally {
      setCargando(false);
    }
  }, [periodoId]);

  async function cargarMasExamenes() {
    if (!periodoId || !cursorExamenes || cargandoMasExamenes) return;
    setCargandoMasExamenes(true);
    try {
      const pagina = await clienteApi.obtener<{ examenes?: ExamenHistoricoExtra[]; nextCursor?: string | null }>(
        `/examenes/generados?periodoId=${encodeURIComponent(periodoId)}&limite=100&cursor=${encodeURIComponent(cursorExamenes)}`
      );
      setExamenesHistoricos((actuales) => [...actuales, ...(pagina.examenes ?? []).filter((examen) => examen.tipoExamen === 'extraordinario')]);
      setCursorExamenes(pagina.nextCursor ?? null);
    } catch (razon) { setError(mensajeDeError(razon, 'No se pudo cargar la siguiente página del historial.')); }
    finally { setCargandoMasExamenes(false); }
  }

  useEffect(() => { void cargarFilas(); }, [cargarFilas]);

  useEffect(() => {
    let cancelado = false;
    if (!periodoId) { setPlantillas([]); return () => { cancelado = true; }; }
    setCargandoPlantillas(true);
    const query = `periodoId=${encodeURIComponent(periodoId)}`;
    void Promise.allSettled([
      clienteApi.obtener<{ plantillas?: PlantillaExtra[] }>(`/examenes/plantillas?${query}`),
      clienteApi.obtener<{ plantillas?: PlantillaExtra[] }>(`/examenes/plantillas?${query}&archivado=true`)
    ]).then((resultados) => {
      if (cancelado) return;
      const activas = resultados[0].status === 'fulfilled' ? resultados[0].value.plantillas ?? [] : [];
      const archivadas = resultados[1].status === 'fulfilled' ? resultados[1].value.plantillas ?? [] : [];
      const unicas = new Map([...activas, ...archivadas].map((item) => [item._id, item]));
      setPlantillas([...unicas.values()].filter((item) => item.periodoId === periodoId));
      setCargandoPlantillas(false);
    });
    return () => { cancelado = true; };
  }, [periodoId]);

  const elegibles = useMemo(() => filas.filter((fila) => fila.extraDisponible === true), [filas]);
  const solicitados = useMemo(() => elegibles.filter((fila) => fila.solicitaExtra === true), [elegibles]);
  const seleccionables = useMemo(() => new Set(solicitados.map((fila) => String(fila.alumnoId ?? ''))), [solicitados]);
  const resultadosHistoricos = useMemo(() => filas.flatMap((fila) => (fila.resultadosExtraordinarios ?? []).map((resultado) => ({ fila, resultado }))), [filas]);
  const alumnosExternosDisponibles = solicitados;

  useEffect(() => {
    setSeleccionados([]);
    setPreview(null);
    setConfirmoPreview(false);
    setResultadoLote(null);
  }, [periodoId]);

  useEffect(() => {
    setSeleccionados((actuales) => actuales.filter((id) => seleccionables.has(id)));
    setPreview(null);
    setConfirmoPreview(false);
  }, [seleccionables]);

  async function guardarSolicitud(fila: FilaConsultaCalificacion, solicita: boolean) {
    if (!fila.alumnoId || !periodoId || (!fila.extraDisponible && solicita) || !puedeCalificar) return;
    const payload = {
      periodoId, alumnoId: fila.alumnoId, componente: 'Solicitud Extra', calificacion: solicita ? 1 : 0,
      ...(fila.solicitudExtraVersion == null ? {} : { version: fila.solicitudExtraVersion })
    };
    const llave = JSON.stringify(payload);
    if (solicitudesPendientes.current.get(fila.alumnoId)?.payload !== llave) solicitudesPendientes.current.set(fila.alumnoId, { payload: llave, id: uuid() });
    const clientRequestId = solicitudesPendientes.current.get(fila.alumnoId)!.id;
    setError('');
    try {
      await clienteApi.enviar('/analiticas/lista-academica/calificaciones', { ...payload, clientRequestId });
      solicitudesPendientes.current.delete(fila.alumnoId);
      setEstado(solicita ? `Solicitud registrada para ${nombreAlumno(fila)}.` : `Solicitud retirada para ${nombreAlumno(fila)}.`);
      setSeleccionados((actuales) => solicita ? actuales : actuales.filter((id) => id !== fila.alumnoId));
      await cargarFilas();
    } catch (razon) {
      setError(mensajeDeError(razon, 'No se pudo guardar la solicitud de Extra.'));
    }
  }

  async function cargarPreview() {
    if (!plantillaId || !puedeGenerar) return;
    const token = obtenerTokenDocente();
    if (!token) { setError('Sesión docente no válida. Vuelve a iniciar sesión.'); return; }
    setPrevisualizando(true); setError(''); setPreview(null); setConfirmoPreview(false);
    try {
      const [resumen, respuestaPdf] = await Promise.all([
        clienteApi.obtener<PreviewExtra>(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar`),
        fetch(`${clienteApi.baseApi}/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar/pdf/visual?refresh=${Date.now()}`, {
          credentials: 'include', cache: 'no-store', headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (!respuestaPdf.ok) throw new Error(`No se pudo renderizar la vista previa (HTTP ${respuestaPdf.status}).`);
      const documento = await respuestaPdf.json() as { paginas?: PaginaPreview[] };
      if (!Array.isArray(documento.paginas) || documento.paginas.length === 0) throw new Error('La vista previa no contiene páginas visibles.');
      if (resumen.layoutConfirmado !== true) throw new Error('El diseño de la plantilla aún no está confirmado; revisa la plantilla antes de generar.');
      setPreview({ ...resumen, paginas: documento.paginas });
      setEstado(`Vista previa lista: ${documento.paginas.length} páginas.`);
    } catch (razon) {
      setError(mensajeDeError(razon, 'No se pudo preparar la vista previa del extraordinario.'));
    } finally { setPrevisualizando(false); }
  }

  async function generarLote() {
    const alumnoIds = [...new Set(seleccionados)].sort();
    if (!plantillaId || !alumnoIds.length || !preview || !confirmoPreview || !puedeGenerar || alumnoIds.some((id) => !seleccionables.has(id))) return;
    const clave = crearClaveLoteGeneracion(plantillaId, 'extraordinario', alumnoIds);
    const loteExistente = leerLotePendiente(clave);
    const loteId = loteExistente ?? uuid().split('-')[0].toUpperCase();
    guardarLotePendiente(clave, loteId);
    setGenerando(true); setError(''); setEstado('Validando elegibilidad y solicitud; no se crearán exámenes si falla algún alumno.');
    try {
      const lote = await clienteApi.enviar<ResumenLoteExtra>('/examenes/generados/lote', {
        plantillaId, confirmarMasivo: true, loteId, tipoExamen: 'extraordinario', alumnoIds
      });
      const paginasMaximas = Math.max(1, Number(plantillas.find((item) => item._id === plantillaId)?.numeroPaginas ?? preview.numeroPaginas ?? 1));
      validarResumenLoteGenerado(lote, alumnoIds.length, paginasMaximas);
      setResultadoLote(lote);
      setEstado(`Lote ${lote.loteId} completado: ${lote.totalAlumnos} exámenes generados.`);
      await cargarFilas();
    } catch (razon) {
      setError(mensajeDeError(razon, 'No se pudo completar el lote. La clave de lote se conserva para una recuperación idempotente.'));
    } finally { setGenerando(false); }
  }

  async function elegirPdf(file?: File) {
    setArchivoHash({ nombre: '', sha256: '' });
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || file.size === 0) { setError('Selecciona un PDF válido y no vacío.'); return; }
    if (!globalThis.crypto?.subtle) { setError('SHA-256 local requiere un navegador en contexto seguro.'); return; }
    setCalculandoHash(true); setError('');
    try {
      const bytes = await file.arrayBuffer();
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('El contenido seleccionado no tiene firma PDF.');
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      setArchivoHash({ nombre: file.name, sha256 });
    } catch (razon) { setError(razon instanceof Error ? razon.message : 'No se pudo calcular el SHA-256 del PDF en este navegador.'); }
    finally { setCalculandoHash(false); }
  }

  async function registrarExterno() {
    const fila = filas.find((item) => item.alumnoId === alumnoExternoId);
    const aciertos = Number(externo.aciertos); const totalReactivos = Number(externo.totalReactivos);
    if (!fila?.alumnoId || !fila.extraDisponible || !fila.solicitaExtra || !archivoHash.nombre || !/^[a-f0-9]{64}$/i.test(archivoHash.sha256)
      || !externo.folio.trim() || !Number.isInteger(aciertos) || !Number.isInteger(totalReactivos) || totalReactivos < 1 || aciertos < 0 || aciertos > totalReactivos
      || externo.criteriosAplicados.trim().length < 12 || !puedeCalificar) {
      setError('Confirma elegibilidad y solicitud; completa folio, PDF, aciertos, reactivos evaluables y criterios.'); return;
    }
    const payload = {
      periodoId, alumnoId: fila.alumnoId, solicitaExtra: true as const, folio: externo.folio.trim().toUpperCase(),
      ...(externo.loteId.trim() ? { loteId: externo.loteId.trim().toUpperCase() } : {}), fuenteArchivo: archivoHash.nombre,
      documentoSha256: archivoHash.sha256, aciertos, totalReactivos, criteriosAplicados: externo.criteriosAplicados.trim()
    };
    const canonico = JSON.stringify(payload);
    if (claveExternoPendiente.current?.payload !== canonico) claveExternoPendiente.current = { payload: canonico, id: uuid() };
    setGuardandoExterno(true); setError('');
    try {
      await clienteApi.enviar('/analiticas/lista-academica/resultados-extra-externos', { ...payload, clientRequestId: claveExternoPendiente.current.id });
      setEstado(`Resultado externo registrado para ${nombreAlumno(fila)}.`);
      setExterno({ folio: '', loteId: '', aciertos: '', totalReactivos: '', criteriosAplicados: '' });
      setArchivoHash({ nombre: '', sha256: '' }); setAlumnoExternoId(''); claveExternoPendiente.current = null;
      await cargarFilas();
    } catch (razon) { setError(mensajeDeError(razon, 'No se pudo registrar el resultado externo.')); }
    finally { setGuardandoExterno(false); }
  }

  async function descargarPdfLote() {
    if (!resultadoLote?.lotePdfUrl || !globalThis.URL?.createObjectURL) return;
    const token = obtenerTokenDocente();
    if (!token) { setError('Sesión docente no válida. Vuelve a iniciar sesión.'); return; }
    setDescargandoPdf(true); setError('');
    try {
      let respuesta = await fetch(`${clienteApi.baseApi}${resultadoLote.lotePdfUrl}`, {
        credentials: 'include', cache: 'no-store', headers: { Authorization: `Bearer ${token}` }
      });
      if (respuesta.status === 401) {
        const renovado = await clienteApi.intentarRefrescarToken();
        if (renovado) respuesta = await fetch(`${clienteApi.baseApi}${resultadoLote.lotePdfUrl}`, {
          credentials: 'include', cache: 'no-store', headers: { Authorization: `Bearer ${renovado}` }
        });
      }
      if (!respuesta.ok) throw new Error(`Descarga del lote rechazada (HTTP ${respuesta.status}).`);
      const hash = respuesta.headers.get('X-EvaluaPro-PDF-SHA256');
      if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || hash.toLowerCase() !== resultadoLote.pdfSha256.toLowerCase()) throw new Error('El SHA-256 descargado no coincide con el lote registrado.');
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement('a'); enlace.href = url; enlace.download = `lote-${resultadoLote.loteId}.pdf`;
      document.body.appendChild(enlace); enlace.click(); enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setEstado(`Descarga del lote ${resultadoLote.loteId} solicitada; SHA-256 verificado en la respuesta.`);
    } catch (razon) { setError(mensajeDeError(razon, 'No se pudo descargar el PDF del lote.')); }
    finally { setDescargandoPdf(false); }
  }

  return (
    <section className="calificaciones-workspace-view calificaciones-extra anim-fade-in" aria-labelledby="extraordinarios-heading">
      <header className="calificaciones-view-heading">
        <span className="calificaciones-kicker">Elegibilidad · generación · aplicación · resultado</span>
        <h3 id="extraordinarios-heading">Extraordinarios</h3>
        <p className="nota">Final menor que 6 habilita Extra. El redondeo para acta se presenta por separado; generar requiere solicitud explícita del docente.</p>
      </header>

      <label className="campo calificaciones-extra__periodo">
        <span>Materia y periodo</span>
        <select value={periodoId} onChange={(event) => onPeriodoChange(event.target.value)}>
          <option value="">Selecciona materia…</option>
          {periodos.map((item) => <option key={item._id} value={item._id}>{etiquetaMateria(item)}{item.activo === false ? ' (Archivada)' : ''}</option>)}
        </select>
      </label>

      {error && <InlineMensaje tipo="error">{error}</InlineMensaje>}
      {estado && <p className="calificaciones-extra__status" role="status">{estado}</p>}
      {cargando ? <p role="status">Cargando lista académica…</p> : !periodoId ? <InlineMensaje tipo="info">Selecciona una materia para consultar elegibilidad y resultados.</InlineMensaje> : (
        <>
          <div className="calificaciones-extra__summary" aria-live="polite">
            <span><strong>{elegibles.length}</strong> elegibles de {filas.length}</span>
            <span><strong>{solicitados.length}</strong> con solicitud</span>
            <span><strong>{resultadosHistoricos.length}</strong> resultados históricos</span>
          </div>

          <section className="calificaciones-extra__section" aria-labelledby="extra-alumnos-heading">
            <div className="calificaciones-extra__section-head">
              <div><h4 id="extra-alumnos-heading">Elegibilidad y solicitud</h4><p>La elegibilidad se calcula con la final exacta vigente.</p></div>
              <span>{seleccionados.length} seleccionados</span>
            </div>
            {filas.length === 0 ? <InlineMensaje tipo="info">No hay alumnos registrados en este periodo.</InlineMensaje> : (
              <ul className="calificaciones-extra__roster">
                {filas.map((fila) => {
                  const id = String(fila.alumnoId ?? ''); const elegible = fila.extraDisponible === true; const solicita = fila.solicitaExtra === true;
                  return <li key={id} className="calificaciones-extra__student">
                    <div className="calificaciones-extra__student-main">
                      {elegible && solicita && <input aria-label={`Seleccionar para generar Extra: ${nombreAlumno(fila)}`} type="checkbox" checked={seleccionados.includes(id)} onChange={(event) => setSeleccionados((actuales) => event.target.checked ? [...new Set([...actuales, id])] : actuales.filter((actual) => actual !== id))} />}
                      <div><strong>{nombreAlumno(fila)}</strong><small>{fila.matricula}{fila.grupo ? ` · Grupo ${fila.grupo}` : ''}</small></div>
                    </div>
                    <dl className="calificaciones-extra__metrics">
                      <div><dt>Final exacta</dt><dd>{decimal(fila.calificacionFinalCurso)}</dd></div>
                      <div><dt>Acta</dt><dd>{decimal(fila.calificacionFinalCursoActa)}</dd></div>
                      <div><dt>Elegibilidad</dt><dd>{elegible ? 'Elegible · < 6' : 'No elegible'}</dd></div>
                    </dl>
                    <div className="calificaciones-extra__actions">
                      <label className="campo-checkbox"><input type="checkbox" checked={solicita} disabled={!puedeCalificar || (!elegible && !solicita)} onChange={(event) => void guardarSolicitud(fila, event.target.checked)} /><span>Solicitud docente</span></label>
                      {id && <button type="button" className="calificaciones-extra__link" onClick={() => { setAlumnoExternoId(id); onAbrirRevision(id); }}>Abrir revisión OMR</button>}
                    </div>
                    {(fila.resultadosExtraordinarios ?? []).length > 0 && <div className="calificaciones-extra__history" aria-label={`Historial Extra de ${nombreAlumno(fila)}`}>
                      {(fila.resultadosExtraordinarios ?? []).map((resultado) => <article key={`${resultado.claseRegistro}-${resultado.folio}`}>
                        <strong>Resultado {resultado.claseRegistro === 'externo' ? 'externo' : 'interno'} · folio {resultado.folio}</strong>
                        <span>{decimal(resultado.calificacionSobre5)} / 5 · {decimal(resultado.calificacionSobre10)} / 10 · {resultado.estadoAprobatorio} (solo si supera 6)</span>
                        <small>{resultado.loteId ? `Lote ${resultado.loteId}` : 'Lote no verificado'} · origen: {resultado.origen || 'sin dato registrado'}</small>
                        {resultado.documentoSha256 && <code className="calificaciones-extra__sha256">SHA-256: {resultado.documentoSha256}</code>}
                      </article>)}
                    </div>}
                  </li>;
                })}
              </ul>
            )}
          </section>

          <section className="calificaciones-extra__section" aria-labelledby="extra-generacion-heading">
            <div className="calificaciones-extra__section-head"><div><h4 id="extra-generacion-heading">Preparar y generar</h4><p>La solicitud y elegibilidad se vuelven a comprobar en el servidor al enviar el lote.</p></div></div>
            <label className="campo"><span>Plantilla de examen</span><select value={plantillaId} disabled={cargandoPlantillas || generando} onChange={(event) => { setPlantillaId(event.target.value); setPreview(null); setConfirmoPreview(false); }}>
              <option value="">{cargandoPlantillas ? 'Cargando plantillas…' : 'Selecciona plantilla…'}</option>
              {plantillas.map((item) => <option key={item._id} value={item._id}>{item.titulo}{item.archivadoEn ? ' (Archivada)' : ''}</option>)}
            </select></label>
            <div className="calificaciones-extra__actions">
              <Boton type="button" variante="secundario" cargando={previsualizando} disabled={!plantillaId || !puedeGenerar || previsualizando} onClick={() => void cargarPreview()}>{preview ? 'Actualizar vista previa' : 'Revisar vista previa'}</Boton>
              <span>{seleccionados.length} alumnos elegibles y solicitantes seleccionados</span>
            </div>
            {preview && <div className="calificaciones-extra__preview">
              <p role="status">Vista previa validada · {preview.paginas?.length ?? preview.numeroPaginas ?? 0} páginas · {preview.totalUsados ?? '—'} de {preview.totalDisponibles ?? '—'} reactivos usados.</p>
              <div className="calificaciones-extra__pages">{preview.paginas?.map((pagina) => <figure key={pagina.numero}><img src={pagina.dataUrl} width={pagina.width} height={pagina.height} alt={`Vista previa, página ${pagina.numero}`} /><figcaption>Página {pagina.numero}</figcaption></figure>)}</div>
              <label className="campo-checkbox"><input type="checkbox" checked={confirmoPreview} onChange={(event) => setConfirmoPreview(event.target.checked)} /><span>Revisé el diseño y las páginas de la vista previa</span></label>
            </div>}
            <Boton type="button" variante="primario" cargando={generando} disabled={!puedeGenerar || generando || !seleccionados.length || !preview || !confirmoPreview} onClick={() => void generarLote()}>
              {generando ? 'Validando y generando…' : 'Generar lote Extra'}
            </Boton>
            {resultadoLote && <div className="calificaciones-extra__batch" role="status">
              <strong>Lote {resultadoLote.loteId} · {resultadoLote.totalAlumnos} exámenes · {resultadoLote.totalPaginas} páginas</strong>
              <code className="calificaciones-extra__sha256">SHA-256 PDF: {resultadoLote.pdfSha256}</code>
              <Boton type="button" variante="secundario" cargando={descargandoPdf} onClick={() => void descargarPdfLote()}>Descargar PDF del lote</Boton>
              <button type="button" onClick={() => onAbrirRevision(seleccionados[0])}>Continuar a captura y revisión OMR</button>
            </div>}
          </section>

          <section className="calificaciones-extra__section" aria-labelledby="extra-historial-heading">
            <div className="calificaciones-extra__section-head"><div><h4 id="extra-historial-heading">Exámenes Extra generados</h4><p>Incluye pendientes de aplicación o captura, además de los que ya tienen resultado.</p></div><span>{examenesHistoricos.length} cargados</span></div>
            {examenesHistoricos.length === 0 ? <p>No hay exámenes Extra generados en este periodo.</p> : <ul className="calificaciones-extra__history-list">
              {examenesHistoricos.map((examen) => <li key={examen._id ?? examen.id}>
                <strong>{examen.alumnoNombre || filas.find((fila) => fila.alumnoId === examen.alumnoId)?.matricula || 'Alumno'}</strong>
                <span>{examen.loteId ? `Lote ${examen.loteId} · ` : ''}folio {examen.folio}</span>
                <small>Estado: {examen.estado || 'sin estado registrado'}{examen.generadoEn ? ` · ${new Date(examen.generadoEn).toLocaleDateString('es-MX')}` : ''}</small>
                {examen.alumnoId && <button type="button" className="calificaciones-extra__link" onClick={() => onAbrirRevision(examen.alumnoId!)}>Abrir revisión del alumno</button>}
              </li>)}
            </ul>}
            {cursorExamenes && <Boton type="button" variante="secundario" cargando={cargandoMasExamenes} onClick={() => void cargarMasExamenes()}>Cargar más exámenes</Boton>}
          </section>

          <section className="calificaciones-extra__section" aria-labelledby="extra-externo-heading">
            <div className="calificaciones-extra__section-head"><div><h4 id="extra-externo-heading">Registrar examen externo</h4><p>Elige el PDF local solo para calcular su SHA-256. Confirma manualmente los datos visibles; no se leen respuestas del archivo.</p></div></div>
            <label className="campo"><span>Alumno solicitante elegible</span><select value={alumnoExternoId} onChange={(event) => setAlumnoExternoId(event.target.value)}><option value="">Selecciona alumno…</option>{alumnosExternosDisponibles.map((fila) => <option key={fila.alumnoId} value={fila.alumnoId}>{nombreAlumno(fila)}</option>)}</select></label>
            <div className="calificaciones-extra__form">
              <label className="campo"><span>PDF local</span><input type="file" accept="application/pdf,.pdf" disabled={calculandoHash || guardandoExterno} onChange={(event) => void elegirPdf(event.target.files?.[0])} /></label>
              {archivoHash.nombre && <p>Archivo: {archivoHash.nombre}{calculandoHash ? ' · calculando SHA-256…' : ''}</p>}
              {archivoHash.sha256 && <code className="calificaciones-extra__sha256">SHA-256 local: {archivoHash.sha256}</code>}
              <label className="campo"><span>Folio visible</span><input value={externo.folio} onChange={(event) => setExterno((actual) => ({ ...actual, folio: event.target.value }))} /></label>
              <label className="campo"><span>Lote documentado (opcional)</span><input value={externo.loteId} onChange={(event) => setExterno((actual) => ({ ...actual, loteId: event.target.value }))} /></label>
              <label className="campo"><span>Aciertos confirmados</span><input type="number" min="0" step="1" value={externo.aciertos} onChange={(event) => setExterno((actual) => ({ ...actual, aciertos: event.target.value }))} /></label>
              <label className="campo"><span>Reactivos evaluables</span><input type="number" min="1" step="1" value={externo.totalReactivos} onChange={(event) => setExterno((actual) => ({ ...actual, totalReactivos: event.target.value }))} /></label>
              <label className="campo"><span>Criterios aplicados</span><textarea value={externo.criteriosAplicados} onChange={(event) => setExterno((actual) => ({ ...actual, criteriosAplicados: event.target.value }))} /></label>
            </div>
            <Boton type="button" variante="secundario" cargando={guardandoExterno} disabled={!puedeCalificar || guardandoExterno || !alumnoExternoId || !archivoHash.sha256} onClick={() => void registrarExterno()}>Registrar resultado externo</Boton>
          </section>
        </>
      )}
    </section>
  );
}
