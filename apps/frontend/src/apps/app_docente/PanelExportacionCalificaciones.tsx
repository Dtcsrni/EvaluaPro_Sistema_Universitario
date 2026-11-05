import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { etiquetaMateriaParaSelector, mensajeDeError } from './utilidades';

type FormatoReporte = 'csv' | 'xlsx' | 'html';
type CredencialAlumnoReporte = { matricula: string; nombre: string; clave: string };

const RETRASO_LIBERACION_URL_DESCARGA_MS = 1000;

function obtenerFechaGeneracionHtml(html: string): string | null {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const valor = documento.querySelector('time[datetime]')?.getAttribute('datetime');
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function PanelExportacionCalificaciones({
  periodos,
  periodoId,
  onPeriodoChange,
  puedeCalificar,
  oculto = false,
  cargandoPeriodos = false,
  errorPeriodos = false,
  onReintentarPeriodos
}: {
  periodos: Periodo[];
  periodoId: string;
  onPeriodoChange: (periodoId: string) => void;
  puedeCalificar: boolean;
  oculto?: boolean;
  cargandoPeriodos?: boolean;
  errorPeriodos?: boolean;
  onReintentarPeriodos?: () => void;
}) {
  const periodoReporteActual = periodos.find((periodo) => periodo._id === periodoId);
  const mostrarErrorPeriodos = errorPeriodos && !cargandoPeriodos;
  const [reporteDescargando, setReporteDescargando] = useState<FormatoReporte | null>(null);
  const [modoReporteHtml, setModoReporteHtml] = useState<'grupo' | 'individual'>('grupo');
  const [secretoCicloHtml, setSecretoCicloHtml] = useState('');
  const [mostrarSecretoCicloHtml, setMostrarSecretoCicloHtml] = useState(false);
  const [errorSecretoCicloHtml, setErrorSecretoCicloHtml] = useState(false);
  const secretoCicloHtmlRef = useRef<HTMLInputElement>(null);
  const [clavesReporte, setClavesReporte] = useState<CredencialAlumnoReporte[]>([]);
  const [mensajeClavesReporte, setMensajeClavesReporte] = useState('');
  const [errorCopiarClaveReporte, setErrorCopiarClaveReporte] = useState(false);
  const [matriculaMensajeClavesReporte, setMatriculaMensajeClavesReporte] = useState<string | null>(null);
  const mensajeCopiaClaveRef = useRef<HTMLDivElement>(null);
  const [mensajeReporte, setMensajeReporte] = useState('');
  const [mensajeReporteEsError, setMensajeReporteEsError] = useState(false);
  const [fechaGeneracionReporte, setFechaGeneracionReporte] = useState<string | null>(null);

  useEffect(() => {
    const mensaje = mensajeCopiaClaveRef.current;
    if (!matriculaMensajeClavesReporte || !mensajeClavesReporte || !mensaje) return;
    const bounds = mensaje.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      mensaje.scrollIntoView({ block: 'nearest' });
    }
  }, [matriculaMensajeClavesReporte, mensajeClavesReporte]);

  const descargarReporteCalificaciones = useCallback(async (formato: FormatoReporte) => {
    const periodoSeleccionado = String(periodoId || '').trim();
    if (!periodoSeleccionado) {
      setMensajeReporte('Selecciona un periodo de calificaciones antes de generar el reporte.');
      setMensajeReporteEsError(false);
      return;
    }
    if (formato === 'html' && modoReporteHtml === 'individual' && secretoCicloHtml.length < 20) {
      setErrorSecretoCicloHtml(true);
      secretoCicloHtmlRef.current?.focus();
      return;
    }
    const token = obtenerTokenDocente();
    if (!token) {
      setMensajeReporte('Sesión no válida. Vuelve a iniciar sesión.');
      setMensajeReporteEsError(true);
      return;
    }

    setReporteDescargando(formato);
    if (formato === 'html' && modoReporteHtml === 'individual') setMostrarSecretoCicloHtml(false);
    setMensajeReporte('');
    setMensajeReporteEsError(false);
    if (formato === 'html') {
      setFechaGeneracionReporte(null);
      setClavesReporte([]);
      setMensajeClavesReporte('');
      setErrorCopiarClaveReporte(false);
      setMatriculaMensajeClavesReporte(null);
    }
    try {
      let guardadoConSelector = false;
      let nuevasClavesReporte: CredencialAlumnoReporte[] = [];
      const nombreArchivo = `calificaciones-${periodoSeleccionado}.${formato}`;
      const selectorArchivo = (window as Window & {
        showSaveFilePicker?: (opciones: unknown) => Promise<{
          createWritable: () => Promise<{ write: (contenido: Blob) => Promise<void>; close: () => Promise<void> }>;
        }>;
      }).showSaveFilePicker;
      const destinoArchivo = formato === 'html' && selectorArchivo
        ? await selectorArchivo({
            suggestedName: nombreArchivo,
            types: [{ description: 'Reporte HTML', accept: { 'text/html': ['.html'] } }]
          })
        : null;
      const respuesta = await fetch(
        formato === 'html'
          ? `${clienteApi.baseApi}/analiticas/calificaciones-html`
          : `${clienteApi.baseApi}/analiticas/calificaciones-${formato}?periodoId=${encodeURIComponent(periodoSeleccionado)}`,
        formato === 'html'
          ? {
              method: 'POST',
              credentials: 'include',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                periodoId: periodoSeleccionado,
                modo: modoReporteHtml,
                ...(modoReporteHtml === 'individual' ? { secretoCiclo: secretoCicloHtml } : {})
              })
            }
          : { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!respuesta.ok) {
        const mensajeHttp = respuesta.status === 401
          ? 'La sesión venció. Vuelve a iniciar sesión antes de generar el reporte.'
          : respuesta.status === 403
            ? 'Tu cuenta no tiene permiso para generar este reporte.'
            : respuesta.status === 400
              ? 'Revisa los datos del reporte e inténtalo de nuevo.'
              : `No se pudo generar el reporte ${formato.toUpperCase()}. Inténtalo de nuevo más tarde.`;
        throw new Error(mensajeHttp);
      }

      let archivo: Blob;
      let fechaGeneracion: string | null = null;
      if (formato === 'html') {
        const reporte = await respuesta.json() as { html?: unknown; credenciales?: CredencialAlumnoReporte[] };
        if (typeof reporte.html !== 'string') throw new Error('El reporte HTML no tiene un formato válido.');
        fechaGeneracion = obtenerFechaGeneracionHtml(reporte.html);
        archivo = new Blob([reporte.html], { type: 'text/html;charset=utf-8' });
        nuevasClavesReporte = Array.isArray(reporte.credenciales) ? reporte.credenciales : [];
      } else {
        archivo = await respuesta.blob();
      }

      if (destinoArchivo) {
        const escritor = await destinoArchivo.createWritable();
        await escritor.write(archivo);
        await escritor.close();
        guardadoConSelector = true;
      } else {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        try {
          document.body.appendChild(enlace);
          enlace.click();
        } catch (error) {
          URL.revokeObjectURL(url);
          throw error;
        } finally {
          enlace.remove();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), RETRASO_LIBERACION_URL_DESCARGA_MS);
      }

      setClavesReporte(nuevasClavesReporte);
      if (formato === 'html') setFechaGeneracionReporte(fechaGeneracion);
      setMensajeReporte(formato === 'html'
        ? guardadoConSelector
          ? 'Reporte HTML guardado en la ubicación seleccionada. Si está en OneDrive, espera a que termine la sincronización antes de compartirlo.'
          : 'Reporte HTML descargado. Para publicarlo en OneDrive, guarda este archivo allí y, si ya existe uno, reemplázalo; espera a que termine la sincronización antes de compartirlo.'
        : `Descarga ${formato.toUpperCase()} solicitada en el navegador.`);
      setMensajeReporteEsError(false);
      registrarAccionDocente(`descargar_reporte_calificaciones_${formato}`, true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setClavesReporte([]);
        setMensajeReporte('No se guardó el reporte; el archivo existente, si lo había, quedó intacto.');
        setMensajeReporteEsError(false);
        return;
      }
      const mensaje = mensajeDeError(error, `No se pudo descargar el reporte ${formato.toUpperCase()}`);
      setMensajeReporte(mensaje);
      setMensajeReporteEsError(true);
      registrarAccionDocente(`descargar_reporte_calificaciones_${formato}`, false);
    } finally {
      setReporteDescargando(null);
      if (formato === 'html' && modoReporteHtml === 'individual') {
        setSecretoCicloHtml('');
        setMostrarSecretoCicloHtml(false);
      }
    }
  }, [modoReporteHtml, periodoId, secretoCicloHtml]);

  const cambiarPeriodo = (nuevoPeriodoId: string) => {
    onPeriodoChange(nuevoPeriodoId);
    setMensajeReporte('');
    setMensajeReporteEsError(false);
    setFechaGeneracionReporte(null);
    setClavesReporte([]);
    setMensajeClavesReporte('');
    setErrorCopiarClaveReporte(false);
    setMatriculaMensajeClavesReporte(null);
    setSecretoCicloHtml('');
    setMostrarSecretoCicloHtml(false);
    setErrorSecretoCicloHtml(false);
  };

  const cambiarModoHtml = (nuevoModo: 'grupo' | 'individual') => {
    setModoReporteHtml(nuevoModo);
    setMensajeReporte('');
    setMensajeReporteEsError(false);
    setFechaGeneracionReporte(null);
    setMostrarSecretoCicloHtml(false);
    setErrorSecretoCicloHtml(false);
    if (nuevoModo === 'grupo') {
      setClavesReporte([]);
      setMensajeClavesReporte('');
      setErrorCopiarClaveReporte(false);
      setMatriculaMensajeClavesReporte(null);
      setSecretoCicloHtml('');
    }
  };

  const copiarClaveReporte = async (clave: string, matricula: string) => {
    try {
      await navigator.clipboard.writeText(clave);
      setMensajeClavesReporte(`Clave de ${matricula} copiada. Envíala solo a ese alumno.`);
      setErrorCopiarClaveReporte(false);
      setMatriculaMensajeClavesReporte(matricula);
    } catch {
      setMensajeClavesReporte('No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.');
      setErrorCopiarClaveReporte(true);
      setMatriculaMensajeClavesReporte(matricula);
    }
  };

  return (
    <div hidden={oculto}>
      <div className="calificaciones-view-heading">
        <span className="calificaciones-kicker">Exportación de calificaciones</span>
        <h3>Reportes y exportación</h3>
        <p className="nota">Descarga o prepara el resultado cuando la revisión académica esté completa.</p>
      </div>
      <div className="calif-action-deck anim-fade-in">
        <div className="calif-deck-card calif-deck-card--reports">
          <div className="calif-deck-card__header">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Reporte del periodo</span>
            </span>
            <span className="banco-counter-tag">Formatos: HTML · XLSX · CSV</span>
          </div>
          <form
            className="calif-deck-card__body"
            aria-label="Reportes de calificaciones"
            onSubmit={(event) => {
              event.preventDefault();
              void descargarReporteCalificaciones('html');
            }}
          >
            <div className="campo calif-deck-card__field calif-deck-card__field--period">
              <label htmlFor="calificaciones-html-periodo">Periodo de calificaciones</label>
              <select
                id="calificaciones-html-periodo"
                value={periodoId}
                disabled={periodos.length === 0 || reporteDescargando !== null}
                aria-describedby={periodoReporteActual ? 'calificaciones-html-periodo-seleccionado' : undefined}
                onChange={(event) => cambiarPeriodo(event.target.value)}
              >
                <option value="">
                  {periodos.length === 0 && cargandoPeriodos
                    ? 'Cargando periodos…'
                    : periodos.length === 0 && mostrarErrorPeriodos
                      ? 'No se pudieron cargar los periodos'
                      : periodos.length === 0
                        ? 'No hay periodos disponibles'
                        : 'Selecciona un periodo...'}
                </option>
                {periodos.map((periodo) => (
                  <option key={periodo._id} value={periodo._id}>
                    {etiquetaMateriaParaSelector(periodo)}{periodo.activo === false ? ' · Archivada' : ''}
                  </option>
                ))}
              </select>
              {periodoReporteActual && (
                <small id="calificaciones-html-periodo-seleccionado" className="calif-deck-card__periodo-seleccionado" aria-live="polite">
                  Reporte para: <strong>{etiquetaMateriaParaSelector(periodoReporteActual)}{periodoReporteActual.activo === false ? ' · Archivada' : ''}</strong>
                </small>
              )}
            </div>
            {periodos.length === 0 && cargandoPeriodos && (
              <InlineMensaje tipo="info" leading={<Spinner />}>Cargando periodos de calificaciones…</InlineMensaje>
            )}
            {periodos.length === 0 && mostrarErrorPeriodos && (
              <div className="calif-deck-card__periodo-error">
                <InlineMensaje tipo="error">No se pudieron cargar los periodos de calificaciones. Reintenta la consulta para generar el reporte.</InlineMensaje>
                {onReintentarPeriodos && (
                  <Boton type="button" variante="secundario" disabled={cargandoPeriodos} onClick={onReintentarPeriodos}>
                    Reintentar carga de periodos
                  </Boton>
                )}
              </div>
            )}
            {periodos.length === 0 && !cargandoPeriodos && !mostrarErrorPeriodos && (
              <InlineMensaje tipo="info">No hay periodos disponibles para generar reportes de calificaciones.</InlineMensaje>
            )}
            {periodos.length > 0 && cargandoPeriodos && (
              <InlineMensaje tipo="info" leading={<Spinner />}>Actualizando periodos; puedes continuar con los que ya están disponibles.</InlineMensaje>
            )}
            {periodos.length > 0 && mostrarErrorPeriodos && (
              <div className="calif-deck-card__periodo-error">
                <InlineMensaje tipo="error">No se pudieron actualizar los periodos. La lista cargada sigue disponible.</InlineMensaje>
                {onReintentarPeriodos && (
                  <Boton type="button" variante="secundario" disabled={cargandoPeriodos} onClick={onReintentarPeriodos}>
                    Reintentar carga de periodos
                  </Boton>
                )}
              </div>
            )}
            <label className="campo calif-deck-card__field calif-deck-card__field--access">
              <span>Acceso del HTML</span>
              <select
                value={modoReporteHtml}
                disabled={reporteDescargando === 'html'}
                aria-describedby={modoReporteHtml === 'grupo' ? 'calificaciones-html-grupo-ayuda' : 'calificaciones-html-individual-ayuda'}
                onChange={(event) => cambiarModoHtml(event.target.value as 'grupo' | 'individual')}
              >
                <option value="grupo">Lista grupal</option>
                <option value="individual">Consulta individual</option>
              </select>
            </label>
            {modoReporteHtml === 'grupo' ? (
              <small id="calificaciones-html-grupo-ayuda" className="ayuda calif-deck-card__field--access-help">
                Incluye nombres, matrículas y calificaciones de todo el grupo, sin clave. Cualquier persona con permiso de lectura del archivo podrá ver la lista; confirma los destinatarios al compartirlo desde OneDrive.
              </small>
            ) : (
              <small id="calificaciones-html-individual-ayuda" className="ayuda calif-deck-card__field--access-help">
                Cada alumno consulta su fila con su matrícula y clave personal. La vista previa de OneDrive puede mostrar el código HTML sin ejecutar el formulario; para consultarlo, descarga el archivo y ábrelo en un navegador compatible.
              </small>
            )}
            {modoReporteHtml === 'individual' && (
              <div className="campo calif-deck-card__field calif-deck-card__field--secret">
                <label htmlFor="calificaciones-html-secreto-ciclo">Secreto maestro del ciclo (obligatorio)</label>
                <div className="calif-html-secret-control">
                  <input
                    id="calificaciones-html-secreto-ciclo"
                    ref={secretoCicloHtmlRef}
                    type={mostrarSecretoCicloHtml ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={20}
                    maxLength={256}
                    value={secretoCicloHtml}
                    disabled={reporteDescargando === 'html'}
                    required
                    aria-invalid={errorSecretoCicloHtml || undefined}
                    aria-describedby={`calificaciones-html-clave-ayuda${errorSecretoCicloHtml ? ' calificaciones-html-clave-error' : ''}`}
                    onInvalid={(event) => {
                      event.preventDefault();
                      setErrorSecretoCicloHtml(true);
                    }}
                    onChange={(event) => {
                      const secreto = event.target.value;
                      setSecretoCicloHtml(secreto);
                      setMensajeReporte('');
                      setMensajeReporteEsError(false);
                      setFechaGeneracionReporte(null);
                      setClavesReporte([]);
                      setMensajeClavesReporte('');
                      setMatriculaMensajeClavesReporte(null);
                      if (secreto.length >= 20) setErrorSecretoCicloHtml(false);
                    }}
                  />
                  <button
                    type="button"
                    className="calif-html-secret-toggle"
                    aria-label="Mostrar secreto maestro"
                    aria-controls="calificaciones-html-secreto-ciclo"
                    aria-pressed={mostrarSecretoCicloHtml}
                    disabled={reporteDescargando === 'html'}
                    onClick={() => setMostrarSecretoCicloHtml((visible) => !visible)}
                  ><Icono nombre="ojo" size={18} /></button>
                </div>
                <small id="calificaciones-html-clave-ayuda">Mínimo 20 caracteres; se recomienda uno aleatorio de 32 o más. Guárdalo de forma segura: no se conserva en EvaluaPro y debes volver a escribirlo para actualizar sin cambiar las claves. Si lo cambias, tendrás que redistribuir las nuevas claves.</small>
                {errorSecretoCicloHtml && (
                  <div id="calificaciones-html-clave-error">
                    <InlineMensaje tipo="error">Escribe un secreto de al menos 20 caracteres para generar las claves individuales.</InlineMensaje>
                  </div>
                )}
              </div>
            )}
            {!puedeCalificar && (
              <InlineMensaje tipo="warning">
                Tu cuenta no tiene el permiso requerido para generar reportes de calificaciones. Solicita acceso a la persona administradora de EvaluaPro.
              </InlineMensaje>
            )}
            <div className="calif-deck-card__btn-group calif-deck-card__btn-group--reports">
              <Boton type="submit" variante="primario" icono={<Icono nombre="descargar" />} cargando={reporteDescargando === 'html'} disabled={!periodoId || reporteDescargando !== null || !puedeCalificar}>
                Generar / actualizar HTML
              </Boton>
              <Boton type="button" variante="secundario" icono={<Icono nombre="descargar" />} cargando={reporteDescargando === 'csv'} disabled={!periodoId || reporteDescargando !== null || !puedeCalificar} onClick={() => void descargarReporteCalificaciones('csv')}>
                Descargar CSV
              </Boton>
              <Boton type="button" variante="secundario" icono={<Icono nombre="descargar" />} cargando={reporteDescargando === 'xlsx'} disabled={!periodoId || reporteDescargando !== null || !puedeCalificar} onClick={() => void descargarReporteCalificaciones('xlsx')}>
                Descargar XLSX
              </Boton>
            </div>
          </form>
          <p className="nota">El HTML es autónomo: no se actualiza solo. Vuelve a generarlo aquí y reemplaza el archivo de OneDrive para publicar cambios. Compártelo desde OneDrive con permiso de lectura.</p>
          {mensajeReporte && (
            <InlineMensaje tipo={mensajeReporteEsError ? 'error' : 'info'}>
              {mensajeReporte}
              {fechaGeneracionReporte && (
                <span> Fecha de generación: <time dateTime={fechaGeneracionReporte}>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fechaGeneracionReporte))}</time>.</span>
              )}
            </InlineMensaje>
          )}
          {clavesReporte.length > 0 && (
            <section className="calif-claves-reporte" aria-labelledby="claves-reporte-titulo">
              <div className="calif-deck-card__header">
                <h4 id="claves-reporte-titulo">Claves individuales para enviar</h4>
                <Boton type="button" variante="secundario" onClick={() => { setClavesReporte([]); setMensajeClavesReporte(''); setErrorCopiarClaveReporte(false); setMatriculaMensajeClavesReporte(null); }}>Ocultar claves</Boton>
              </div>
              <p className="nota">Cada clave abre únicamente la fila de esa matrícula. Envíala por separado; no compartas esta lista con el grupo.</p>
              <p className="calif-claves-reporte__count" aria-live="polite">
                {clavesReporte.length} {clavesReporte.length === 1 ? 'clave individual lista' : 'claves individuales listas'} para distribución manual.
              </p>
              <ul className="calif-claves-reporte__list" aria-label="Claves individuales por alumno">
                {clavesReporte.map((credencial) => (
                  <li className="calif-claves-reporte__item" key={credencial.matricula}>
                    <h5>{credencial.nombre || 'Sin nombre'}</h5>
                    <dl>
                      <div>
                        <dt>Matrícula</dt>
                        <dd><code>{credencial.matricula}</code></dd>
                      </div>
                      <div>
                        <dt>Clave personal</dt>
                        <dd><code>{credencial.clave}</code></dd>
                      </div>
                    </dl>
                    <Boton type="button" variante="secundario" aria-label={`Copiar clave de ${credencial.nombre || 'alumno'}, matrícula ${credencial.matricula}`} onClick={() => void copiarClaveReporte(credencial.clave, credencial.matricula)}>Copiar clave</Boton>
                    {mensajeClavesReporte && matriculaMensajeClavesReporte === credencial.matricula && (
                      <div ref={mensajeCopiaClaveRef} className="calif-claves-reporte__feedback">
                        <InlineMensaje tipo={errorCopiarClaveReporte ? 'error' : 'info'}>{mensajeClavesReporte}</InlineMensaje>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
