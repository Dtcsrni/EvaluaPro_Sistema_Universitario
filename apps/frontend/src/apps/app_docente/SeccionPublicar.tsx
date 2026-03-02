/**
 * SeccionPublicar
 *
 * Publicacion de resultados y generacion de codigo para portal alumno.
 */
import { useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { AyudaFormulario } from './AyudaFormulario';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Periodo } from './tipos';
import { esMensajeError, etiquetaMateria, mensajeDeError } from './utilidades';

export function SeccionPublicar({
  periodos,
  onPublicar,
  onCodigo
}: {
  periodos: Periodo[];
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigo?: string; expiraEn?: string }>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [codigo, setCodigo] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const puedeAccionar = Boolean(periodoId);

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
      setCodigo(respuesta.codigo ?? '');
      setExpiraEn(respuesta.expiraEn ?? '');
      setMensaje('Código generado');
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
      <div className="panel shell-main">
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
