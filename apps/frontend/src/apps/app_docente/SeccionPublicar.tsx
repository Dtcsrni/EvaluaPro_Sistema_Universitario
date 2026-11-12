/**
 * SeccionPublicar
 *
 * Publicacion de resultados y generacion de codigo para portal alumno.
 */
import { useState } from 'react';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { etiquetaMateriaParaSelector, mensajeDeError } from './utilidades';

export type CodigoAccesoMetadata = {
  id: string;
  periodoId: string;
  expiraEn: string;
  usado: boolean;
  estado: 'vigente' | 'expirado' | 'usado';
  periodo?: { id: string; nombre: string };
};

export function SeccionPublicar({
  periodos,
  cargandoMaterias = false,
  errorMaterias = false,
  puedeLeerMaterias = true,
  onReintentarMaterias,
  onPublicar,
  onCodigo,
  onListarCodigos,
  onExpirarCodigo
}: {
  periodos: Periodo[];
  cargandoMaterias?: boolean;
  errorMaterias?: boolean;
  puedeLeerMaterias?: boolean;
  onReintentarMaterias?: () => Promise<void> | void;
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigoAccesoId?: string; codigo?: string; expiraEn?: string }>;
  onListarCodigos?: (periodoId: string) => Promise<{ codigosAcceso: CodigoAccesoMetadata[] }>;
  onExpirarCodigo?: (codigoAccesoId: string) => Promise<{ expirado: boolean; codigoAccesoId: string }>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'ok' | 'warning' | 'error'>('info');
  const [codigo, setCodigo] = useState('');
  const [codigoAccesoId, setCodigoAccesoId] = useState('');
  const [codigoSincronizado, setCodigoSincronizado] = useState(false);
  const [expiraEn, setExpiraEn] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [codigosAcceso, setCodigosAcceso] = useState<CodigoAccesoMetadata[]>([]);
  const [estadoConsultaCodigos, setEstadoConsultaCodigos] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [cargandoCodigos, setCargandoCodigos] = useState(false);
  const [codigoEnExpiracion, setCodigoEnExpiracion] = useState('');
  const confirm = useConfirmDialog();

  function notificarRecuperacionSesion(error: unknown) {
    const action = accionToastSesionParaError(error, 'docente');
    if (!action) return;
    emitToast({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'Cierra sesión y vuelve a entrar para renovar el acceso; después reintenta la acción.',
      action
    });
  }

  const puedeAccionar = Boolean(periodoId) && puedeLeerMaterias;
  const hayOperacionEnCurso = publicando || generando || cargandoCodigos || Boolean(codigoEnExpiracion);
  const estadoMaterias = !puedeLeerMaterias
    ? 'sin-permiso'
    : cargandoMaterias
      ? 'cargando'
      : errorMaterias
        ? 'error'
        : periodos.length === 0
          ? 'vacio'
          : null;

  function cambiarPeriodo(nuevoPeriodoId: string) {
    setPeriodoId(nuevoPeriodoId);
    setMensaje('');
    setTipoMensaje('info');
    setCodigo('');
    setCodigoAccesoId('');
    setCodigoSincronizado(false);
    setExpiraEn('');
    setCodigosAcceso([]);
    setEstadoConsultaCodigos('idle');
  }

  function formatearFecha(valor: string) {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : fecha.toLocaleString('es-MX');
  }

  async function listarCodigos(conservarMensaje = false): Promise<boolean> {
    if (!periodoId || !onListarCodigos) return false;
    setCargandoCodigos(true);
    setEstadoConsultaCodigos('loading');
    if (!conservarMensaje) setMensaje('');
    try {
      const respuesta = await onListarCodigos(periodoId);
      setCodigosAcceso(Array.isArray(respuesta.codigosAcceso) ? respuesta.codigosAcceso : []);
      setEstadoConsultaCodigos('loaded');
      return true;
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron consultar los códigos');
      setEstadoConsultaCodigos('error');
      const conservaListaAnterior = codigosAcceso.length > 0;
      setMensaje(conservaListaAnterior
        ? `${msg} Se conserva la lista de la última consulta correcta.`
        : msg);
      setTipoMensaje(conservaListaAnterior ? 'warning' : 'error');
      notificarRecuperacionSesion(error);
      return false;
    } finally {
      setCargandoCodigos(false);
    }
  }

  async function expirarCodigo(codigo: CodigoAccesoMetadata) {
    if (!onExpirarCodigo) return;
    const confirmado = await confirm({
      title: 'Expirar código de acceso',
      message: 'El código dejará de estar vigente en esta instalación. Después publica los resultados para enviar el cambio al Portal Alumno.',
      confirmLabel: 'Expirar aquí',
      tone: 'danger',
      details: [`Estado: ${codigo.estado}`, `Vencimiento: ${formatearFecha(codigo.expiraEn)}`]
    });
    if (!confirmado) return;
    setCodigoEnExpiracion(codigo.id);
    setMensaje('');
    try {
      const resultado = await onExpirarCodigo(codigo.id);
      const listaActualizada = await listarCodigos(true);
      if (codigo.id === codigoAccesoId) {
        setCodigo('');
        setCodigoAccesoId('');
        setCodigoSincronizado(false);
        setExpiraEn('');
      }
      setMensaje(resultado.expirado
        ? listaActualizada
          ? 'Código expirado en esta instalación. Publica los resultados para enviar el cambio al Portal Alumno.'
          : 'Código expirado en esta instalación, pero no se pudo actualizar la lista. Consulta los códigos para reintentar.'
        : 'El código ya no estaba vigente.');
      setTipoMensaje(listaActualizada ? 'ok' : 'warning');
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo expirar el código');
      setMensaje(msg);
      setTipoMensaje('error');
      notificarRecuperacionSesion(error);
    } finally {
      setCodigoEnExpiracion('');
    }
  }

  async function publicar() {
    if (!periodoId) return;
    try {
      const inicio = Date.now();
      setPublicando(true);
      setMensaje('');
      setTipoMensaje('info');
      await onPublicar(periodoId);
      if (codigo) setCodigoSincronizado(true);
      const nombreMateria = periodos.find((periodo) => periodo._id === periodoId);
      const materia = nombreMateria ? etiquetaMateriaParaSelector(nombreMateria) : 'la materia seleccionada';
      const msg = codigo
        ? `Resultados de ${materia} publicados. El código de acceso ya está disponible para compartir.`
        : `Resultados de ${materia} publicados en el Portal Alumno.`;
      setMensaje(msg);
      setTipoMensaje('ok');
      registrarAccionDocente('publicar_resultados', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo publicar');
      setMensaje(msg);
      setTipoMensaje('error');
      notificarRecuperacionSesion(error);
      registrarAccionDocente('publicar_resultados', false);
    } finally {
      setPublicando(false);
    }
  }

  async function generarCodigo() {
    if (!periodoId) return;
    let respuestaCodigo: { codigoAccesoId?: string; codigo?: string; expiraEn?: string } | undefined;
    try {
      const inicio = Date.now();
      setGenerando(true);
      setMensaje('');
      setTipoMensaje('info');
      setCodigo('');
      setCodigoAccesoId('');
      setCodigoSincronizado(false);
      setExpiraEn('');
      respuestaCodigo = await onCodigo(periodoId);
      setCodigo(respuestaCodigo.codigo ?? '');
      setCodigoAccesoId(respuestaCodigo.codigoAccesoId ?? '');
      setExpiraEn(respuestaCodigo.expiraEn ?? '');
      if (!respuestaCodigo.codigo) {
        const msg = 'La solicitud terminó, pero no se recibió el código. No lo compartas; vuelve a consultar o genera uno nuevo.';
        setMensaje(msg);
        setTipoMensaje('error');
        registrarAccionDocente('generar_codigo', false);
        return;
      }
      // El código se crea localmente; publicar sincroniza ese cambio con el Portal Alumno.
      try {
        await onPublicar(periodoId);
      } catch (error) {
        const detalle = mensajeDeError(error, 'No se pudieron publicar los resultados');
        const msg = `Código creado, pero aún no publicado en el Portal Alumno. No lo compartas; usa “Publicar resultados” y vuelve a intentarlo. ${detalle}`;
        setMensaje(msg);
        setTipoMensaje('error');
        notificarRecuperacionSesion(error);
        registrarAccionDocente('generar_codigo', false);
        return;
      }
      setCodigoSincronizado(true);
      const nombreMateria = periodos.find((periodo) => periodo._id === periodoId);
      const materia = nombreMateria ? etiquetaMateriaParaSelector(nombreMateria) : 'la materia seleccionada';
      setMensaje(`Código de acceso generado para ${materia}; resultados publicados. Ya puedes compartir el código junto con la matrícula.`);
      setTipoMensaje('ok');
      let listaActualizada = true;
      if (onListarCodigos) {
        listaActualizada = await listarCodigos(true);
        if (!listaActualizada) {
          const msg = 'Código generado y publicado, pero no se pudo actualizar la lista. Usa “Consultar códigos” para reintentar.';
          setMensaje(msg);
          setTipoMensaje('warning');
        }
      }
      registrarAccionDocente('generar_codigo', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar el código');
      setMensaje(msg);
      setTipoMensaje('error');
      notificarRecuperacionSesion(error);
      registrarAccionDocente('generar_codigo', false);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main shell-main--publicar">
        <h2 id="sync-publicacion-heading" tabIndex={-1}>
          <Icono nombre="publicar" /> Publicación y acceso al Portal Alumno
        </h2>
        <label className="campo">
          Materia para publicar
          <select value={periodoId} onChange={(event) => cambiarPeriodo(event.target.value)} disabled={hayOperacionEnCurso || !puedeLeerMaterias || periodos.length === 0} aria-describedby={estadoMaterias ? 'publicar-materias-estado' : undefined}>
            <option value="">Selecciona una materia…</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {etiquetaMateriaParaSelector(periodo)}
              </option>
            ))}
          </select>
        </label>
        {estadoMaterias && <div id="publicar-materias-estado" className="publicar-materias-recovery">
          {estadoMaterias === 'sin-permiso' && <InlineMensaje tipo="warning">No tienes permiso para consultar las materias disponibles para publicar.</InlineMensaje>}
          {estadoMaterias === 'cargando' && <InlineMensaje tipo="info">{periodos.length > 0 ? 'Actualizando materias disponibles… La lista cargada se conserva.' : 'Cargando materias disponibles…'}</InlineMensaje>}
          {estadoMaterias === 'error' && <>
            <InlineMensaje tipo={periodos.length > 0 ? 'warning' : 'error'}>{periodos.length > 0
              ? 'No se pudo actualizar la lista. Puedes usar las materias cargadas y volver a intentar.'
              : 'No se pudieron cargar las materias disponibles para publicar.'}</InlineMensaje>
            {onReintentarMaterias && <Boton type="button" variante="secundario" disabled={cargandoMaterias} cargando={cargandoMaterias} onClick={() => void onReintentarMaterias()}>Reintentar carga de materias</Boton>}
          </>}
          {estadoMaterias === 'vacio' && <InlineMensaje tipo="info">No hay materias activas para publicar. Crea o activa una materia en Materias.</InlineMensaje>}
        </div>}
        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={publicando} disabled={!puedeAccionar || generando || cargandoCodigos || Boolean(codigoEnExpiracion)} onClick={publicar}>
            {publicando ? 'Publicando…' : 'Publicar resultados'}
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="info" />}
            cargando={generando}
            disabled={!puedeAccionar || publicando || cargandoCodigos || Boolean(codigoEnExpiracion)}
            onClick={generarCodigo}
          >
            {generando ? 'Generando…' : 'Generar código de acceso'}
          </Boton>
        </div>
        <p className="texto-ayuda">
          Generar el código también publica los resultados para activarlo. Comparte el código junto con la matrícula del alumno.
        </p>
        {codigo && (
          <section className="item-glass sincronizacion-codigo-generado" aria-label="Código de acceso generado">
            <div className="estado-datos-header">
              <div>
                <h3 className="estado-datos-titulo">Código de acceso</h3>
                <code>{codigo}</code>
                {expiraEn && <p className="nota">Vence: {formatearFecha(expiraEn)}</p>}
              </div>
              <span className={`estado-chip ${codigoSincronizado ? 'ok' : 'warning'}`}>
                {codigoSincronizado ? 'Listo para compartir' : 'Pendiente de publicación'}
              </span>
            </div>
          </section>
        )}
        {onListarCodigos && (
          <section aria-labelledby="publicar-codigos-acceso-titulo" className="sincronizacion-codigos-acceso">
            <h3 id="publicar-codigos-acceso-titulo">Códigos de acceso</h3>
            <p className="texto-ayuda">La lista muestra vigencia y vencimiento, nunca los códigos secretos.</p>
            <div className="acciones">
              <Boton type="button" variante="secundario" disabled={!puedeAccionar || publicando || generando || cargandoCodigos || Boolean(codigoEnExpiracion)} cargando={cargandoCodigos} onClick={() => void listarCodigos()}>
                {cargandoCodigos ? 'Consultando…' : 'Consultar códigos'}
              </Boton>
            </div>
            {estadoConsultaCodigos === 'loading' && <InlineMensaje tipo="info">{codigosAcceso.length > 0
              ? 'Actualizando la consulta; se mantiene visible la última lista correcta.'
              : 'Consultando códigos de acceso…'}</InlineMensaje>}
            {estadoConsultaCodigos === 'idle' && <p className="nota">Selecciona “Consultar códigos” para revisar los accesos de esta materia.</p>}
            {estadoConsultaCodigos === 'loaded' && codigosAcceso.length === 0 && (
              <p className="nota" role="status">No hay códigos de acceso para esta materia.</p>
            )}
            {estadoConsultaCodigos !== 'idle' && codigosAcceso.length > 0 ? (
              <ul className="lista sincronizacion-codigos-acceso-lista">
                {codigosAcceso.map((item) => (
                  <li key={item.id} className="item-glass">
                    <span className={'estado-chip estado-chip--' + item.estado}>
                      {item.estado === 'vigente' ? 'Vigente' : item.estado === 'expirado' ? 'Expirado' : 'Usado'}
                    </span>
                    <span>Vencimiento: {formatearFecha(item.expiraEn)}</span>
                    {item.estado === 'vigente' && onExpirarCodigo && (
                      <Boton type="button" variante="secundario" disabled={hayOperacionEnCurso} cargando={codigoEnExpiracion === item.id} onClick={() => void expirarCodigo(item)}>
                        Expirar en esta instalación
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
        {mensaje && <InlineMensaje tipo={tipoMensaje}>{mensaje}</InlineMensaje>}
      </div>

      <aside className="shell-aside" aria-label="Ayuda y referencia">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Publicar resultados y dar acceso al portal">
            <p>
              Publica los resultados de la materia en el Portal Alumno y administra sus códigos temporales de acceso.
            </p>
            <ul className="lista">
              <li>
                <b>Materia:</b> selecciona qué resultados enviar.
              </li>
              <li>
                <b>Publicar resultados:</b> envía los resultados guardados de la materia al portal.
              </li>
              <li>
                <b>Generar código de acceso:</b> crea un código temporal y publica los resultados; compártelo con la matrícula del alumno.
              </li>
            </ul>
            <p>El reporte HTML para OneDrive se genera por separado desde Calificaciones.</p>
            <p>
              Ejemplo de mensaje a alumnos: &quot;Tu código es <code>ABC123</code>. Entra al portal y usa tu matrícula <code>2024-001</code>.&quot;
            </p>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}
