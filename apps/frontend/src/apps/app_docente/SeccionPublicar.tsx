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
import { AyudaFormulario } from './AyudaFormulario';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { esMensajeError, etiquetaMateria, mensajeDeError } from './utilidades';

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
  onPublicar,
  onCodigo,
  onListarCodigos,
  onExpirarCodigo
}: {
  periodos: Periodo[];
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigoAccesoId?: string; codigo?: string; expiraEn?: string }>;
  onListarCodigos?: (periodoId: string) => Promise<{ codigosAcceso: CodigoAccesoMetadata[] }>;
  onExpirarCodigo?: (codigoAccesoId: string) => Promise<{ expirado: boolean; codigoAccesoId: string }>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [codigo, setCodigo] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [codigosAcceso, setCodigosAcceso] = useState<CodigoAccesoMetadata[]>([]);
  const [cargandoCodigos, setCargandoCodigos] = useState(false);
  const [codigoEnExpiracion, setCodigoEnExpiracion] = useState('');
  const confirm = useConfirmDialog();

  const puedeAccionar = Boolean(periodoId);

  async function listarCodigos() {
    if (!periodoId || !onListarCodigos) return;
    setCargandoCodigos(true);
    try {
      const respuesta = await onListarCodigos(periodoId);
      setCodigosAcceso(Array.isArray(respuesta.codigosAcceso) ? respuesta.codigosAcceso : []);
      setMensaje('Códigos de acceso actualizados');
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron consultar los códigos');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudieron consultar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setCargandoCodigos(false);
    }
  }

  async function expirarCodigo(codigo: CodigoAccesoMetadata) {
    if (!onExpirarCodigo) return;
    const confirmado = await confirm({
      title: 'Expirar código de acceso',
      message: 'El código dejará de estar vigente en EvaluaPro. Después tendrás que publicar los resultados por separado para transmitir el cambio al portal.',
      confirmLabel: 'Expirar código',
      tone: 'danger',
      details: [`Código ${codigo.id}`, `Vence: ${new Date(codigo.expiraEn).toLocaleString()}`]
    });
    if (!confirmado) return;
    setCodigoEnExpiracion(codigo.id);
    try {
      const resultado = await onExpirarCodigo(codigo.id);
      await listarCodigos();
      setMensaje(resultado.expirado ? 'Código expirado localmente; publica los resultados para sincronizar el cambio al portal' : 'El código ya no estaba vigente');
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo expirar el código');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo expirar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setCodigoEnExpiracion('');
    }
  }

  async function publicar() {
    try {
      const inicio = Date.now();
      setPublicando(true);
      setMensaje('');
      await onPublicar(periodoId);
      setMensaje('Resultados publicados');
      emitToast({ level: 'ok', title: 'Publicacion', message: 'Resultados publicados', durationMs: 2800 });
      registrarAccionDocente('publicar_resultados', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo publicar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo publicar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('publicar_resultados', false);
    } finally {
      setPublicando(false);
    }
  }

  async function generarCodigo() {
    try {
      const inicio = Date.now();
      setGenerando(true);
      setMensaje('');
      const respuesta = await onCodigo(periodoId);
      // El código se crea en la base local; publicar después vuelve a
      // sincronizarlo con el read-model del portal. La operación es
      // idempotente y evita entregar códigos que el alumno no puede usar.
      await onPublicar(periodoId);
      setCodigo(respuesta.codigo ?? '');
      setExpiraEn(respuesta.expiraEn ?? '');
      setMensaje('Código generado');
      if (onListarCodigos) {
        const lista = await onListarCodigos(periodoId);
        setCodigosAcceso(Array.isArray(lista.codigosAcceso) ? lista.codigosAcceso : []);
      }
      emitToast({ level: 'ok', title: 'Codigo', message: 'Codigo generado', durationMs: 2200 });
      registrarAccionDocente('generar_codigo', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar codigo');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo generar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('generar_codigo', false);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main shell-main--publicar">
        <h2>
          <Icono nombre="publicar" /> Publicar en portal
        </h2>
        <label className="campo">
          Materia
          <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
            <option value="">Selecciona</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id} title={periodo._id}>
                {etiquetaMateria(periodo)}
              </option>
            ))}
          </select>
        </label>
        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={publicando} disabled={!puedeAccionar} onClick={publicar}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="info" />}
            cargando={generando}
            disabled={!puedeAccionar}
            onClick={generarCodigo}
          >
            {generando ? 'Generando…' : 'Generar codigo'}
          </Boton>
        </div>
        {codigo && (
          <p>
            Código generado: {codigo} {expiraEn ? `(expira ${new Date(expiraEn).toLocaleString()})` : ''}
          </p>
        )}
        {onListarCodigos && (
          <section aria-label="Códigos de acceso de la materia" className="sincronizacion-codigos-acceso">
            <div className="acciones">
              <Boton type="button" variante="secundario" disabled={!puedeAccionar || cargandoCodigos} cargando={cargandoCodigos} onClick={listarCodigos}>
                {cargandoCodigos ? 'Consultando…' : 'Consultar códigos'}
              </Boton>
            </div>
            {codigosAcceso.length > 0 ? (
              <ul className="lista sincronizacion-codigos-acceso-lista">
                {codigosAcceso.map((item) => (
                  <li key={item.id} className="item-glass">
                    <span className={'estado-chip estado-chip--' + item.estado}>{item.estado}</span>
                    <span>Expira: {new Date(item.expiraEn).toLocaleString()}</span>
                    {item.estado === 'vigente' && onExpirarCodigo && (
                      <Boton type="button" variante="secundario" disabled={Boolean(codigoEnExpiracion)} cargando={codigoEnExpiracion === item.id} onClick={() => void expirarCodigo(item)}>
                        Expirar localmente
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {codigosAcceso.length > 0 && <p className="texto-ayuda">La lista no muestra los códigos secretos. Expirar localmente no actualiza el portal hasta que publiques los resultados.</p>}
          </section>
        )}
        {mensaje && (
          <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
            {mensaje}
          </p>
        )}
      </div>

      <aside className="shell-aside" aria-label="Ayuda y referencia">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Para que sirve y como llenarlo">
            <p>
              <b>Proposito:</b> enviar los resultados de la materia al portal alumno y emitir un codigo de acceso para consulta.
            </p>
            <ul className="lista">
              <li>
                <b>Materia:</b> selecciona la materia a publicar.
              </li>
              <li>
                <b>Publicar:</b> sincroniza resultados de la materia hacia el portal.
              </li>
              <li>
                <b>Generar codigo:</b> crea un codigo temporal; compartelo con alumnos junto con su matricula.
              </li>
            </ul>
            <p>
              Ejemplo de mensaje a alumnos: &quot;Tu codigo es <code>ABC123</code>. Entra al portal y usa tu matricula <code>2024-001</code>.&quot;
            </p>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}
