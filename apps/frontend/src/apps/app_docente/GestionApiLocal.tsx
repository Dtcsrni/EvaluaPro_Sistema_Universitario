import { useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';

type Inspeccion = { solicitudId: string; nombreCliente: string; permisosSolicitados: string[]; permisosDisponibles: string[]; expiraEn: string };
type Credencial = { id: string; nombre: string; permisos: string[]; createdAt: string; lastUsedAt: string | null; expiresAt: string; revokedAt: string | null };

export function GestionApiLocal() {
  const [codigo, setCodigo] = useState('');
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [credencialesCargadas, setCredencialesCargadas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function cargarCredenciales() {
    const respuesta = await clienteApi.obtener<{ credenciales: Credencial[] }>('/autenticacion/api-clientes/credenciales');
    setCredenciales(respuesta.credenciales ?? []);
    setCredencialesCargadas(true);
  }

  async function revisarSolicitud() {
    setOcupado(true);
    setMensaje('');
    setInspeccion(null);
    try {
      const resultado = await clienteApi.enviar<Inspeccion>('/autenticacion/api-clientes/solicitudes/inspeccionar', { codigo: codigo.trim().toUpperCase() });
      setInspeccion(resultado);
      setSeleccionados(resultado.permisosDisponibles);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo revisar la solicitud.');
    } finally { setOcupado(false); }
  }

  async function resolver(permitir: boolean) {
    if (!inspeccion) return;
    setOcupado(true);
    setMensaje('');
    try {
      await clienteApi.enviar('/autenticacion/api-clientes/solicitudes/resolver', {
        codigo: codigo.trim().toUpperCase(), permitir,
        ...(permitir ? { permisos: seleccionados } : {})
      });
      setMensaje(permitir ? 'Cliente API autorizado. La credencial se entrega una sola vez al cliente local.' : 'Solicitud denegada.');
      setInspeccion(null);
      setCodigo('');
      await cargarCredenciales();
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo resolver la solicitud.');
    } finally { setOcupado(false); }
  }

  async function revocar(credencialId: string) {
    setOcupado(true);
    try {
      await clienteApi.enviar(`/autenticacion/api-clientes/credenciales/${encodeURIComponent(credencialId)}/revocar`, {});
      await cargarCredenciales();
      setMensaje('Credencial revocada.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo revocar la credencial.');
    } finally { setOcupado(false); }
  }

  return (
    <section className="cuenta-subpanel" aria-labelledby="api-local-titulo">
      <h3 id="api-local-titulo">Acceso de clientes API locales</h3>
      <p className="nota">Autoriza una herramienta local con permisos limitados. El código vence en cinco minutos; el secreto no se muestra en esta pantalla.</p>
      <div className="cuenta-foto-perfil__acciones">
        <label htmlFor="api-local-codigo">Código de autorización</label>
        <input id="api-local-codigo" autoComplete="off" inputMode="text" maxLength={8} value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''))} />
        <Boton type="button" variante="secundario" cargando={ocupado} disabled={codigo.length !== 8} onClick={revisarSolicitud}>Revisar solicitud</Boton>
      </div>
      {inspeccion && <div role="group" aria-label="Consentimiento de API local">
        <p><strong>{inspeccion.nombreCliente}</strong> solicita acceso hasta {new Date(inspeccion.expiraEn).toLocaleTimeString()}.</p>
        <fieldset><legend>Permisos que concederás</legend>
          {inspeccion.permisosDisponibles.map((permiso) => <label key={permiso} className="cuenta-foto-perfil__acciones">
            <input type="checkbox" checked={seleccionados.includes(permiso)} onChange={(event) => setSeleccionados((actuales) => event.target.checked ? [...actuales, permiso] : actuales.filter((item) => item !== permiso))} />{permiso}
          </label>)}
        </fieldset>
        <Boton type="button" variante="primario" cargando={ocupado} disabled={!seleccionados.length} onClick={() => void resolver(true)}>Autorizar permisos seleccionados</Boton>{' '}
        <Boton type="button" variante="secundario" cargando={ocupado} onClick={() => void resolver(false)}>Denegar</Boton>
      </div>}
      {mensaje && <InlineMensaje tipo="info">{mensaje}</InlineMensaje>}
      <h4>Credenciales emitidas</h4>
      <Boton type="button" variante="secundario" cargando={ocupado} onClick={() => void cargarCredenciales().catch((error) => setMensaje(error instanceof Error ? error.message : 'No se pudieron cargar las credenciales.'))}>Actualizar lista</Boton>
      {credencialesCargadas && credenciales.filter((item) => !item.revokedAt).length === 0 && <p className="nota">No hay credenciales API activas.</p>}
      <ul>{credenciales.filter((item) => !item.revokedAt).map((item) => <li key={item.id}>
        <strong>{item.nombre}</strong> · {item.permisos.join(', ')} · vence {new Date(item.expiresAt).toLocaleDateString()}{' '}
        <Boton type="button" variante="secundario" cargando={ocupado} onClick={() => void revocar(item.id)}>Revocar</Boton>
      </li>)}</ul>
    </section>
  );
}
