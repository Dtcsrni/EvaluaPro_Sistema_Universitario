/**
 * SeccionCuenta
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { tipoMensajeInline } from './mensajeInline';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Docente } from './tipos';
import { idCortoMateria, mensajeDeError } from './utilidades';
export function SeccionCuenta({
  docente,
  onDocenteActualizado,
  esAdmin,
  esDev,
  oauthGoogleDisponible,
  classroomDisponible,
  smtpDisponible,
  requireGoogleOAuth
}: {
  docente: Docente;
  onDocenteActualizado: (d: Docente) => void;
  esAdmin: boolean;
  esDev: boolean;
  oauthGoogleDisponible?: boolean;
  classroomDisponible?: boolean;
  smtpDisponible?: boolean;
  requireGoogleOAuth?: boolean;
}) {
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [contrasenaNueva2, setContrasenaNueva2] = useState('');
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [credentialReauth, setCredentialReauth] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [regenerandoAccesos, setRegenerandoAccesos] = useState(false);

  const [institucionPdf, setInstitucionPdf] = useState(docente.preferenciasPdf?.institucion ?? '');
  const [lemaPdf, setLemaPdf] = useState(docente.preferenciasPdf?.lema ?? '');
  const [logoIzqPdf, setLogoIzqPdf] = useState(docente.preferenciasPdf?.logos?.izquierdaPath ?? '');
  const [logoDerPdf, setLogoDerPdf] = useState(docente.preferenciasPdf?.logos?.derechaPath ?? '');
  const [papelera, setPapelera] = useState<Array<Record<string, unknown>>>([]);
  const [cargandoPapelera, setCargandoPapelera] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [oauthClientId, setOauthClientId] = useState(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  const [classroomClientId, setClassroomClientId] = useState(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  const [classroomClientSecret, setClassroomClientSecret] = useState('');
  const [classroomRedirectUri, setClassroomRedirectUri] = useState('http://localhost:4000/api/integraciones/classroom/oauth/callback');
  const [oauthRequerido, setOauthRequerido] = useState(true);
  const [copiandoComandoOauth, setCopiandoComandoOauth] = useState(false);
  const [probandoOauthClassroom, setProbandoOauthClassroom] = useState(false);

  const coincide = contrasenaNueva && contrasenaNueva === contrasenaNueva2;
  const requiereContrasenaActual = Boolean(docente.tieneContrasena);
  const requiereGoogle = Boolean(docente.tieneGoogle && !docente.tieneContrasena);
  const puedeConfigurarOauth = esAdmin;
  const googleOnly = Boolean(requireGoogleOAuth);

  const reautenticacionValida = requiereContrasenaActual ? Boolean(contrasenaActual.trim()) : requiereGoogle ? Boolean(credentialReauth) : Boolean(contrasenaActual.trim() || credentialReauth);
  const puedeGuardar = Boolean(contrasenaNueva.trim().length >= 8 && coincide && reautenticacionValida);
  const faltanCamposOauth = Boolean(
    !oauthClientId.trim() || !classroomClientId.trim() || !classroomClientSecret.trim() || !classroomRedirectUri.trim()
  );

  const comandoOauthClassroom = useMemo(() => {
    const escapar = (valor: string) => `'${String(valor || '').replace(/'/g, "''")}'`;
    const partes = [
      'pwsh -File scripts/configurar-oauth-classroom.ps1',
      `-GoogleOauthClientId ${escapar(oauthClientId.trim())}`,
      `-GoogleClassroomClientId ${escapar(classroomClientId.trim())}`,
      `-GoogleClassroomClientSecret ${escapar(classroomClientSecret.trim())}`,
      `-GoogleClassroomRedirectUri ${escapar(classroomRedirectUri.trim())}`,
      '-AlsoSetViteGoogleClientId'
    ];
    if (!oauthRequerido) {
      partes.push('-DisableRequireGoogleOAuth');
    }
    return partes.join(' ');
  }, [oauthClientId, classroomClientId, classroomClientSecret, classroomRedirectUri, oauthRequerido]);

  const googleDisponible = typeof oauthGoogleDisponible === 'boolean'
    ? oauthGoogleDisponible
    : Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  const classroomConfigDisponible = typeof classroomDisponible === 'boolean' ? classroomDisponible : true;
  const smtpConfigDisponible = Boolean(smtpDisponible);

  async function guardar() {
    try {
      const inicio = Date.now();
      setGuardando(true);
      setMensaje('');

      const cuerpo: Record<string, unknown> = { contrasenaNueva };
      if (contrasenaActual.trim()) cuerpo.contrasenaActual = contrasenaActual;
      if (credentialReauth) cuerpo.credential = credentialReauth;

      await clienteApi.enviar('/autenticacion/definir-contrasena', cuerpo);
      setMensaje('Contrasena actualizada');
      emitToast({ level: 'ok', title: 'Cuenta', message: 'Contrasena actualizada', durationMs: 2400 });
      registrarAccionDocente('definir_contrasena', true, Date.now() - inicio);
      setContrasenaNueva('');
      setContrasenaNueva2('');
      setContrasenaActual('');
      setCredentialReauth(null);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la contrasena');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'Cuenta',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('definir_contrasena', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPreferenciasPdf() {
    try {
      const inicio = Date.now();
      setGuardando(true);
      setMensaje('');

      const cuerpo: Record<string, unknown> = {};
      if (institucionPdf.trim()) cuerpo.institucion = institucionPdf.trim();
      if (lemaPdf.trim()) cuerpo.lema = lemaPdf.trim();
      if (logoIzqPdf.trim() || logoDerPdf.trim()) {
        cuerpo.logos = {
          ...(logoIzqPdf.trim() ? { izquierdaPath: logoIzqPdf.trim() } : {}),
          ...(logoDerPdf.trim() ? { derechaPath: logoDerPdf.trim() } : {})
        };
      }

      const respuesta = await clienteApi.enviar<{ preferenciasPdf: Docente['preferenciasPdf'] }>('/autenticacion/preferencias/pdf', cuerpo);
      onDocenteActualizado({
        ...docente,
        preferenciasPdf: respuesta.preferenciasPdf
      });

      setMensaje('Preferencias de PDF guardadas');
      emitToast({ level: 'ok', title: 'PDF', message: 'Preferencias guardadas', durationMs: 2400 });
      registrarAccionDocente('preferencias_pdf', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron guardar las preferencias de PDF');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'PDF',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('preferencias_pdf', false);
    } finally {
      setGuardando(false);
    }
  }

  async function regenerarAccesosDirectos() {
    try {
      const inicio = Date.now();
      setRegenerandoAccesos(true);
      setMensaje('');
      await clienteApi.enviar('/autenticacion/accesos-directos/regenerar', {});
      setMensaje('Accesos directos regenerados en el escritorio.');
      emitToast({
        level: 'ok',
        title: 'Accesos directos',
        message: 'Iconos y accesos regenerados correctamente.',
        durationMs: 3000
      });
      registrarAccionDocente('regenerar_accesos_directos', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron regenerar los accesos directos');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'Accesos directos',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('regenerar_accesos_directos', false);
    } finally {
      setRegenerandoAccesos(false);
    }
  }

  async function copiarComandoOauth() {
    try {
      if (faltanCamposOauth) {
        setMensaje('Completa Client ID/Secret y Redirect URI para generar el comando.');
        return;
      }
      setCopiandoComandoOauth(true);
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Tu navegador no permite copiar al portapapeles automáticamente.');
      }
      await navigator.clipboard.writeText(comandoOauthClassroom);
      emitToast({ level: 'ok', title: 'OAuth + Classroom', message: 'Comando copiado al portapapeles.', durationMs: 2500 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo copiar el comando de configuración.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'OAuth + Classroom', message: msg, durationMs: 5200 });
    } finally {
      setCopiandoComandoOauth(false);
    }
  }

  async function probarOauthClassroom() {
    try {
      setProbandoOauthClassroom(true);
      const respuesta = await clienteApi.obtener<{ url?: string }>('/evaluaciones/v2/classroom/oauth/iniciar');
      const url = String(respuesta.url || '').trim();
      if (!url) {
        throw new Error('La API no devolvio URL de autorizacion OAuth.');
      }
      window.open(url, 'oauth_classroom', 'width=980,height=760');
      emitToast({ level: 'ok', title: 'OAuth + Classroom', message: 'Abriendo Google OAuth...', durationMs: 2400 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo iniciar OAuth de Classroom.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'OAuth + Classroom', message: msg, durationMs: 5200 });
    } finally {
      setProbandoOauthClassroom(false);
    }
  }

  const cargarPapelera = useCallback(async () => {
    if (!esAdmin || !esDev) return;
    setCargandoPapelera(true);
    try {
      const respuesta = await clienteApi.obtener<{ items: Array<Record<string, unknown>> }>('/papelera?limite=60');
      setPapelera(respuesta.items ?? []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar la papelera');
      setMensaje(msg);
    } finally {
      setCargandoPapelera(false);
    }
  }, [esAdmin, esDev]);

  async function restaurarPapelera(idElemento: string) {
    setRestaurandoId(idElemento);
    try {
      await clienteApi.enviar(`/papelera/${encodeURIComponent(idElemento)}/restaurar`, {});
      emitToast({ level: 'ok', title: 'Papelera', message: 'Elemento restaurado', durationMs: 2200 });
      await cargarPapelera();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo restaurar');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Papelera', message: msg, durationMs: 4200 });
    } finally {
      setRestaurandoId(null);
    }
  }

  useEffect(() => {
    void cargarPapelera();
  }, [cargarPapelera]);

  function formatearFechaPapelera(valor?: unknown) {
    if (!valor) return '-';
    const d = new Date(String(valor));
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
  }

  function tituloPapelera(elemento: Record<string, unknown>) {
    const cuerpo = (elemento.payload as Record<string, unknown>) ?? {};
    const tipo = String(elemento.tipo ?? '');
    if (tipo === 'plantilla') return String((cuerpo.plantilla as Record<string, unknown>)?.titulo ?? '').trim();
    if (tipo === 'periodo') return String((cuerpo.periodo as Record<string, unknown>)?.nombre ?? '').trim();
    if (tipo === 'alumno') return String((cuerpo.alumno as Record<string, unknown>)?.nombreCompleto ?? '').trim();
    return '';
  }

  return (
    <div className="panel cuenta-panel">
      <h2>
        <Icono nombre="info" /> Cuenta
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> definir o cambiar tu contrasena para acceder con correo/contrasena.
        </p>
        <ul className="lista">
          <li>
            <b>Contrasena actual:</b> requerida si tu cuenta ya tenia contrasena.
          </li>
          <li>
            <b>Nueva contrasena:</b> minimo 8 caracteres.
          </li>
          <li>
            <b>Confirmar contrasena:</b> debe coincidir exactamente.
          </li>
          <li>
            <b>Reautenticacion:</b> si aparece Google, es la opcion recomendada para confirmar identidad.
          </li>
        </ul>
        <p>
          Ejemplo: nueva contrasena <code>MiClaveSegura2026</code> (no uses contrasenas obvias).
        </p>
      </AyudaFormulario>

      <div className="cuenta-resumen" aria-label="Estado de la cuenta">
        <div className="cuenta-resumen__item">
          <span>Google</span>
          <b>{docente.tieneGoogle ? 'Vinculado' : 'No vinculado'}</b>
        </div>
        <div className="cuenta-resumen__item">
          <span>Contraseña</span>
          <b>{docente.tieneContrasena ? 'Definida' : 'No definida'}</b>
        </div>
        <div className="cuenta-resumen__item">
          <span>Cuenta</span>
          <b>{String(docente.correo || '').trim() || 'Sin correo'}</b>
        </div>
        <div className="cuenta-resumen__item">
          <span>Rol</span>
          <b>{esAdmin ? 'Administrador' : 'Docente'}</b>
        </div>
        <div className="cuenta-resumen__item">
          <span>SMTP</span>
          <b>{smtpConfigDisponible ? 'Disponible' : 'No configurado'}</b>
        </div>
      </div>

      <div className="subpanel cuenta-seguridad">
        <h3>
          <Icono nombre="ok" /> Seguridad de acceso
        </h3>
        {googleOnly && (
          <InlineMensaje tipo="info">
            Modo Google-only activo: la contraseña local está deshabilitada mientras `REQUIRE_GOOGLE_OAUTH=1`.
          </InlineMensaje>
        )}
        <div className="meta">
          <span className={docente.tieneGoogle ? 'badge ok' : 'badge'}>
            <span className="dot" aria-hidden="true" /> Google {docente.tieneGoogle ? 'vinculado' : 'no vinculado'}
          </span>
          <span className={docente.tieneContrasena ? 'badge ok' : 'badge'}>
            <span className="dot" aria-hidden="true" /> Contraseña {docente.tieneContrasena ? 'definida' : 'no definida'}
          </span>
        </div>

        {Boolean(!googleOnly && docente.tieneGoogle && googleDisponible) && (
          <div className="auth-google auth-google--mb">
            <p className="nota">Reautenticacion con Google (recomendado).</p>
            <GoogleLogin
              onSuccess={(cred) => {
                const credencialGoogle = cred.credential;
                if (!credencialGoogle) {
                  setMensaje('No se recibio credencial de Google.');
                  return;
                }
                setCredentialReauth(credencialGoogle);
                setMensaje('Reautenticacion con Google lista.');
              }}
              onError={() => setMensaje('No se pudo reautenticar con Google.')}
            />
            <div className="acciones acciones--mt">
              <button type="button" className="chip" disabled={!credentialReauth} onClick={() => setCredentialReauth(null)}>
                Limpiar reauth
              </button>
            </div>
          </div>
        )}

        {!googleOnly && <div className="cuenta-seguridad__form">
          {docente.tieneContrasena && (
            <label className="campo">
              Contrasena actual
              <input
                type="password"
                value={contrasenaActual}
                onChange={(event) => setContrasenaActual(event.target.value)}
                autoComplete="current-password"
              />
            </label>
          )}

          <label className="campo">
            Nueva contrasena
            <input
              type="password"
              value={contrasenaNueva}
              onChange={(event) => setContrasenaNueva(event.target.value)}
              autoComplete="new-password"
            />
            <span className="ayuda">Minimo 8 caracteres.</span>
          </label>

          <label className="campo">
            Confirmar contrasena
            {contrasenaNueva2 && !coincide ? (
              <input
                type="password"
                value={contrasenaNueva2}
                onChange={(event) => setContrasenaNueva2(event.target.value)}
                autoComplete="new-password"
                aria-invalid="true"
              />
            ) : (
              <input
                type="password"
                value={contrasenaNueva2}
                onChange={(event) => setContrasenaNueva2(event.target.value)}
                autoComplete="new-password"
              />
            )}
            {contrasenaNueva2 && !coincide && <span className="ayuda error">Las contrasenas no coinciden.</span>}
          </label>
        </div>}

        {!googleOnly && (
          <div className="acciones">
            <Boton type="button" icono={<Icono nombre="ok" />} cargando={guardando} disabled={!puedeGuardar} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar contrasena'}
            </Boton>
          </div>
        )}
      </div>

      <div className="subpanel cuenta-pdf">
        <h3>
          <Icono nombre="pdf" /> PDF institucional
        </h3>
        <AyudaFormulario titulo="Como se usa">
          <p>
            Estas preferencias se usan para el <b>encabezado institucional</b> del PDF (solo pagina 1). Si no configuras nada,
            se usan los defaults del sistema.
          </p>
          <ul className="lista">
            <li>
              <b>Institucion:</b> ej. Centro Universitario Hidalguense
            </li>
            <li>
              <b>Lema:</b> ej. La sabiduria es nuestra fuerza
            </li>
            <li>
              <b>Logos:</b> ruta relativa (ej. <code>logos/logo_cuh.png</code>) o absoluta.
            </li>
          </ul>
        </AyudaFormulario>

        <label className="campo">
          Institucion
          <input value={institucionPdf} onChange={(e) => setInstitucionPdf(e.target.value)} placeholder="Centro Universitario Hidalguense" />
        </label>
        <label className="campo">
          Lema
          <input value={lemaPdf} onChange={(e) => setLemaPdf(e.target.value)} placeholder="La sabiduria es nuestra fuerza" />
        </label>
        <div className="grid grid--2 cuenta-pdf__logos">
          <label className="campo">
            Logo izquierda (path)
            <input value={logoIzqPdf} onChange={(e) => setLogoIzqPdf(e.target.value)} placeholder="logos/logo_cuh.png" />
          </label>
          <label className="campo">
            Logo derecha (path)
            <input value={logoDerPdf} onChange={(e) => setLogoDerPdf(e.target.value)} placeholder="logos/logo_sys.png" />
          </label>
        </div>

        <div className="acciones acciones--mt">
          <Boton onClick={guardarPreferenciasPdf} disabled={guardando}>
            Guardar PDF
          </Boton>
        </div>
      </div>

      <div className="subpanel cuenta-oauth">
        <h3>
          <Icono nombre="info" /> OAuth + Google Classroom
        </h3>
        <AyudaFormulario titulo="Configuracion operativa">
          <p>
            Configura las credenciales de Google para login y Classroom desde esta seccion. El sistema genera el comando
            automático para aplicar cambios en <code>.env</code>.
          </p>
          <ul className="lista">
            <li>
              <b>Google OAuth Client ID:</b> se usa para inicio de sesion Google.
            </li>
            <li>
              <b>Classroom Client ID / Secret:</b> se usan para sincronizacion Classroom.
            </li>
            <li>
              <b>Redirect URI:</b> debe coincidir exactamente con Google Console.
            </li>
          </ul>
        </AyudaFormulario>

        {!puedeConfigurarOauth && (
          <InlineMensaje tipo="info">Solo administradores pueden aplicar configuración operativa OAuth/Classroom.</InlineMensaje>
        )}

        <div className="grid grid--2">
          <label className="campo">
            Google OAuth Client ID
            <input
              value={oauthClientId}
              onChange={(event) => setOauthClientId(event.target.value)}
              placeholder="1234567890-xxxx.apps.googleusercontent.com"
              disabled={!puedeConfigurarOauth}
            />
          </label>

          <label className="campo">
            Google Classroom Client ID
            <input
              value={classroomClientId}
              onChange={(event) => setClassroomClientId(event.target.value)}
              placeholder="1234567890-xxxx.apps.googleusercontent.com"
              disabled={!puedeConfigurarOauth}
            />
          </label>
        </div>

        <div className="grid grid--2">
          <label className="campo">
            Google Classroom Client Secret
            <input
              type="password"
              value={classroomClientSecret}
              onChange={(event) => setClassroomClientSecret(event.target.value)}
              placeholder="GOCSPX-..."
              autoComplete="off"
              disabled={!puedeConfigurarOauth}
            />
          </label>

          <label className="campo">
            Google Classroom Redirect URI
            <input
              value={classroomRedirectUri}
              onChange={(event) => setClassroomRedirectUri(event.target.value)}
              placeholder="http://localhost:4000/api/integraciones/classroom/oauth/callback"
              disabled={!puedeConfigurarOauth}
            />
          </label>
        </div>

        <label className="campo campo--inline">
          <input
            type="checkbox"
            checked={oauthRequerido}
            onChange={(event) => setOauthRequerido(Boolean(event.target.checked))}
            disabled={!puedeConfigurarOauth}
          />
          <span>Habilitar y requerir OAuth Google (REQUIRE_GOOGLE_OAUTH=1)</span>
        </label>

        <label className="campo">
          Comando automatico (PowerShell)
          <textarea
            className="cuenta-oauth__comando"
            readOnly
            value={comandoOauthClassroom}
            rows={4}
            aria-label="Comando de configuración OAuth Classroom"
          />
          <span className="ayuda">Pega y ejecuta este comando en la raíz del proyecto para aplicar la configuración.</span>
        </label>

        <div className="acciones acciones--mt">
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="ok" />}
            disabled={!puedeConfigurarOauth || faltanCamposOauth || copiandoComandoOauth}
            cargando={copiandoComandoOauth}
            onClick={copiarComandoOauth}
          >
            {copiandoComandoOauth ? 'Copiando...' : 'Copiar comando de configuración'}
          </Boton>

          {classroomConfigDisponible && (
            <Boton
              type="button"
              icono={<Icono nombre="entrar" />}
              disabled={probandoOauthClassroom}
              cargando={probandoOauthClassroom}
              onClick={probarOauthClassroom}
            >
              {probandoOauthClassroom ? 'Probando...' : 'Probar conexión OAuth Classroom'}
            </Boton>
          )}
        </div>
      </div>

      <div className="subpanel cuenta-accesos">
        <h3>
          <Icono nombre="recargar" /> Accesos directos
        </h3>
        <p className="nota">
          Regenera los accesos de EvaluaPro en Escritorio y Menú Inicio, incluyendo la actualización de iconos.
        </p>
        <div className="acciones acciones--mt">
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            cargando={regenerandoAccesos}
            disabled={regenerandoAccesos}
            onClick={regenerarAccesosDirectos}
          >
            {regenerandoAccesos ? 'Regenerando...' : 'Regenerar accesos e iconos'}
          </Boton>
        </div>
      </div>

      {esAdmin && esDev && (
        <div className="subpanel cuenta-papelera">
          <h3>
            <Icono nombre="info" /> Papelera (dev)
          </h3>
          <p className="nota">Elementos eliminados se conservan 45 dias y luego se eliminan automaticamente.</p>
          <div className="acciones acciones--mt">
            <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoPapelera} onClick={cargarPapelera}>
              {cargandoPapelera ? 'Cargando...' : 'Actualizar papelera'}
            </Boton>
          </div>
          {!cargandoPapelera && papelera.length === 0 && <InlineMensaje tipo="info">No hay elementos en papelera.</InlineMensaje>}
          {papelera.length > 0 && (
            <div className="lista lista--compacta cuenta-papelera__lista">
              {papelera.map((item) => {
                const id = String(item._id ?? '');
                const tipo = String(item.tipo ?? 'desconocido');
                const entidadId = String(item.entidadId ?? '');
                const titulo = tituloPapelera(item) || `${tipo} ${idCortoMateria(entidadId || id)}`;
                const eliminadoEn = formatearFechaPapelera(item.eliminadoEn);
                const expiraEn = formatearFechaPapelera(item.expiraEn);
                return (
                  <div key={id} className="item-glass cuenta-papelera__item">
                    <div>
                      <div className="texto-base">{titulo}</div>
                      <div className="nota">Tipo: {tipo} · Eliminado: {eliminadoEn} · Expira: {expiraEn}</div>
                    </div>
                    <div className="acciones">
                      <Boton
                        type="button"
                        variante="secundario"
                        icono={<Icono nombre="ok" />}
                        disabled={!id || restaurandoId === id}
                        cargando={restaurandoId === id}
                        onClick={() => restaurarPapelera(id)}
                      >
                        {restaurandoId === id ? 'Restaurando...' : 'Restaurar'}
                      </Boton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mensaje && <InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje>}
    </div>
  );
}

