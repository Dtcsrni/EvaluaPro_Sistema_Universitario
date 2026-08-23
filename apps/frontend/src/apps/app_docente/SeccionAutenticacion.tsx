/**
 * SeccionAutenticacion
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ErrorRemoto, accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { TemaBoton } from '../../tema/TemaBoton';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { abrirVentanaVersion, obtenerVersionApp } from '../../ui/version/versionInfo';
import { clienteApi } from './clienteApiDocente';
import { tipoMensajeInline } from './mensajeInline';
import { registrarAccionDocente } from './telemetriaDocente';
import {
  esCorreoDeDominioPermitidoFrontend,
  mensajeDeError,
  obtenerDominiosCorreoPermitidosFrontend,
  textoDominiosPermitidos
} from './utilidades';

export function SeccionAutenticacion({
  onIngresar,
  oauthGoogleDisponible,
  requireGoogleOAuth,
  passwordLoginAllowed,
  primerUso
}: {
  onIngresar: (token: string) => void;
  oauthGoogleDisponible?: boolean;
  smtpDisponible?: boolean;
  requireGoogleOAuth?: boolean;
  passwordLoginAllowed?: boolean;
  primerUso?: boolean;
}) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [codigoLicencia, setCodigoLicencia] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modo, setModo] = useState<'ingresar' | 'registrar'>('registrar');
  const [enviando, setEnviando] = useState(false);
  const [cooldownHasta, setCooldownHasta] = useState<number | null>(null);
  const temporizadorCooldown = useRef<number | null>(null);
  const [credentialRegistroGoogle, setCredentialRegistroGoogle] = useState<string | null>(null);
  const [crearContrasenaAhora, setCrearContrasenaAhora] = useState(true);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [credentialRecuperarGoogle, setCredentialRecuperarGoogle] = useState<string | null>(null);
  const [contrasenaRecuperar, setContrasenaRecuperar] = useState('');
  const [mostrarFormularioIngresar, setMostrarFormularioIngresar] = useState(false);
  const [mostrarFormularioRegistrar, setMostrarFormularioRegistrar] = useState(false);

  function hayGoogleConfigurado() {
    return Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  }

  const googleDisponible = typeof oauthGoogleDisponible === 'boolean' ? oauthGoogleDisponible : hayGoogleConfigurado();
  const esDev = import.meta.env.DEV;
  const googleOnly = Boolean(requireGoogleOAuth);
  const passwordDisponible = Boolean(passwordLoginAllowed !== false && !googleOnly);
  const mostrarFormulario = googleOnly
    ? modo === 'registrar' && Boolean(credentialRegistroGoogle)
    : modo === 'ingresar'
      ? (!googleDisponible || mostrarFormularioIngresar)
      : (!googleDisponible || mostrarFormularioRegistrar || Boolean(credentialRegistroGoogle));

  const dominiosPermitidos = obtenerDominiosCorreoPermitidosFrontend();
  const politicaDominiosTexto = dominiosPermitidos.length > 0 ? textoDominiosPermitidos(dominiosPermitidos) : '';
  const ahora = Date.now();
  const cooldownMs = cooldownHasta ? Math.max(0, cooldownHasta - ahora) : 0;
  const cooldownActivo = cooldownMs > 0;

  useEffect(() => () => {
    if (temporizadorCooldown.current) window.clearTimeout(temporizadorCooldown.current);
  }, []);

  function correoPermitido(correoAValidar: string) {
    return esCorreoDeDominioPermitidoFrontend(correoAValidar, dominiosPermitidos);
  }

  function decodificarPayloadJwt(jwt: string): Record<string, unknown> | null {
    const partes = String(jwt || '').split('.');
    if (partes.length < 2) return null;
    try {
      const base64 = partes[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(partes[1].length / 4) * 4, '=');
      const textoJson = atob(base64);
      return JSON.parse(textoJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function invitarARegistrar() {
    setModo('registrar');
    setMostrarFormularioRegistrar(true);
    setCredentialRegistroGoogle(null);
    setCrearContrasenaAhora(true);
    setNombres('');
    setApellidos('');
    setContrasena('');
    setMensaje('No existe una cuenta para ese correo. Completa tus datos para registrarte.');
  }

  function invitarARegistrarDesdeGoogle(credential: string) {
    const payload = decodificarPayloadJwt(credential);
    const correoGoogle = typeof payload?.email === 'string' ? payload.email : '';
    const nombreCompletoGoogle = typeof payload?.name === 'string' ? payload.name : '';
    const nombreGoogle = typeof payload?.given_name === 'string' ? payload.given_name : '';
    const apellidoGoogle = typeof payload?.family_name === 'string' ? payload.family_name : '';

    setModo('registrar');
    setMostrarFormularioRegistrar(false);
    setCredentialRegistroGoogle(credential);
    setCrearContrasenaAhora(false);
    setContrasena('');
    setCorreo(correoGoogle);

    if (nombreGoogle) setNombres(nombreGoogle);
    if (apellidoGoogle) setApellidos(apellidoGoogle);
    if (!nombreGoogle && !apellidoGoogle && nombreCompletoGoogle) {
      const partes = nombreCompletoGoogle
        .split(' ')
        .map((p) => p.trim())
        .filter(Boolean);
      if (partes.length >= 2) {
        setNombres(partes.slice(0, -1).join(' '));
        setApellidos(partes.slice(-1).join(' '));
      } else if (partes.length === 1) {
        setNombres(partes[0]);
      }
    }

    setMensaje('No existe una cuenta para ese correo. Completa tus datos para registrarte.');
  }

  function iniciarCooldown(ms: number) {
    const duracion = Math.max(1000, ms);
    const restante = Math.ceil(duracion / 1000);
    setCooldownHasta(Date.now() + duracion);
    setMensaje(`Demasiadas solicitudes. Espera ${restante}s e intenta de nuevo.`);
    if (temporizadorCooldown.current) {
      window.clearTimeout(temporizadorCooldown.current);
    }
    temporizadorCooldown.current = window.setTimeout(() => {
      setCooldownHasta(null);
    }, duracion);
  }

  function bloquearSiEnCurso() {
    if (enviando) return true;
    if (cooldownActivo) {
      const restante = Math.ceil(cooldownMs / 1000);
      setMensaje(`Espera ${restante}s antes de intentar de nuevo.`);
      return true;
    }
    return false;
  }

  async function ingresar() {
    try {
      if (!passwordDisponible) {
        setMensaje('Esta instalación requiere inicio de sesión con Google.');
        return;
      }
      if (bloquearSiEnCurso()) return;
      const inicio = Date.now();
      if (dominiosPermitidos.length > 0 && !correoPermitido(correo)) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente('login', false);
        return;
      }
      setEnviando(true);
      setMensaje('');
      const respuesta = await clienteApi.enviar<{ token: string }>('/autenticacion/ingresar', { correo, contrasena });
      onIngresar(respuesta.token);
      emitToast({ level: 'ok', title: 'Sesion', message: 'Bienvenido/a', durationMs: 2200 });
      registrarAccionDocente('login', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo ingresar');
      setMensaje(msg);

      if (error instanceof ErrorRemoto && error.detalle?.status === 429) {
        iniciarCooldown(8_000);
      }

      const codigo = error instanceof ErrorRemoto ? error.detalle?.codigo : undefined;
      const esNoRegistrado = typeof codigo === 'string' && codigo.toUpperCase() === 'DOCENTE_NO_REGISTRADO';
      if (esNoRegistrado) {
        invitarARegistrar();
      }

      emitToast({
        level: 'error',
        title: 'No se pudo ingresar',
        message: msg,
        durationMs: 5200,
        action: esNoRegistrado
          ? undefined
          : accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('login', false);
    } finally {
      setEnviando(false);
    }
  }

  async function ingresarConGoogle(credential: string) {
    try {
      if (bloquearSiEnCurso()) return;
      const inicio = Date.now();
      const payload = decodificarPayloadJwt(credential);
      const correoGoogle = typeof payload?.email === 'string' ? payload.email : undefined;
      if (correoGoogle && dominiosPermitidos.length > 0 && !correoPermitido(correoGoogle)) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente('login_google', false);
        return;
      }
      setEnviando(true);
      setMensaje('');
      const respuesta = await clienteApi.enviar<{ token: string }>('/autenticacion/google', { credential });
      onIngresar(respuesta.token);
      emitToast({ level: 'ok', title: 'Sesion', message: 'Bienvenido/a', durationMs: 2200 });
      registrarAccionDocente('login_google', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo ingresar con Google');
      setMensaje(msg);

      if (error instanceof ErrorRemoto && error.detalle?.status === 429) {
        iniciarCooldown(8_000);
      }

      const codigo = error instanceof ErrorRemoto ? error.detalle?.codigo : undefined;
      const esNoRegistrado = typeof codigo === 'string' && codigo.toUpperCase() === 'DOCENTE_NO_REGISTRADO';
      if (esNoRegistrado) {
        invitarARegistrarDesdeGoogle(credential);
      }

      emitToast({
        level: 'error',
        title: 'No se pudo ingresar',
        message: msg,
        durationMs: 5200,
        action: esNoRegistrado
          ? undefined
          : accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('login_google', false);
    } finally {
      setEnviando(false);
    }
  }

  async function recuperarConGoogle() {
    try {
      if (!passwordDisponible) {
        setMensaje('La recuperación por contraseña no está disponible en modo Google-only.');
        return;
      }
      if (bloquearSiEnCurso()) return;
      const inicio = Date.now();
      setEnviando(true);
      setMensaje('');
      if (!credentialRecuperarGoogle) {
        setMensaje('Reautentica con Google para recuperar.');
        return;
      }

      const payload = decodificarPayloadJwt(credentialRecuperarGoogle);
      const correoGoogle = typeof payload?.email === 'string' ? payload.email : undefined;
      if (correoGoogle && dominiosPermitidos.length > 0 && !correoPermitido(correoGoogle)) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente('recuperar_contrasena_google', false);
        return;
      }

      const respuesta = await clienteApi.enviar<{ token: string }>('/autenticacion/recuperar-contrasena-google', {
        credential: credentialRecuperarGoogle,
        contrasenaNueva: contrasenaRecuperar
      });
      onIngresar(respuesta.token);
      emitToast({ level: 'ok', title: 'Cuenta', message: 'Contraseña actualizada', durationMs: 2600 });
      registrarAccionDocente('recuperar_contrasena_google', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo recuperar la contraseña');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo recuperar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      if (error instanceof ErrorRemoto && error.detalle?.status === 429) {
        iniciarCooldown(8_000);
      }
      registrarAccionDocente('recuperar_contrasena_google', false);
    } finally {
      setEnviando(false);
    }
  }

  async function registrar() {
    try {
      if (bloquearSiEnCurso()) return;
      if (googleOnly && !credentialRegistroGoogle) {
        setMensaje('Primero autentícate con Google para crear tu cuenta.');
        return;
      }
      const inicio = Date.now();
      if (dominiosPermitidos.length > 0 && !correoPermitido(correo)) {
        const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
        registrarAccionDocente(credentialRegistroGoogle ? 'registrar_google' : 'registrar', false);
        return;
      }

      if (!nombres.trim() || !apellidos.trim()) {
        const msg = 'Completa tus nombres y apellidos.';
        setMensaje(msg);
        emitToast({ level: 'error', title: 'Datos incompletos', message: msg, durationMs: 4200 });
        registrarAccionDocente(credentialRegistroGoogle ? 'registrar_google' : 'registrar', false);
        return;
      }
      setEnviando(true);
      setMensaje('');
      const correoFinal = correo.trim();

      const debeEnviarContrasena = Boolean(
        contrasena.trim() && (!credentialRegistroGoogle || crearContrasenaAhora)
      );

      const respuesta = credentialRegistroGoogle
        ? await clienteApi.enviar<{ token: string }>('/autenticacion/registrar-google', {
            credential: credentialRegistroGoogle,
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            ...(debeEnviarContrasena ? { contrasena } : {}),
            ...(codigoLicencia.trim() ? { codigoLicencia: codigoLicencia.trim() } : {})
          })
        : await clienteApi.enviar<{ token: string }>('/autenticacion/registrar', {
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            correo: correoFinal,
            contrasena,
            ...(codigoLicencia.trim() ? { codigoLicencia: codigoLicencia.trim() } : {})
          });
      onIngresar(respuesta.token);
      emitToast({ level: 'ok', title: 'Cuenta creada', message: 'Sesión iniciada', durationMs: 2800 });
      registrarAccionDocente(credentialRegistroGoogle ? 'registrar_google' : 'registrar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo registrar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo registrar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      if (error instanceof ErrorRemoto && error.detalle?.status === 429) {
        iniciarCooldown(8_000);
      }
      registrarAccionDocente('registrar', false);
    } finally {
      setEnviando(false);
    }
  }

  const puedeIngresar = Boolean(correo.trim() && contrasena.trim());
  const puedeRegistrar = credentialRegistroGoogle
    ? Boolean(nombres.trim() && apellidos.trim() && correo.trim() && (crearContrasenaAhora ? contrasena.trim() : true))
    : Boolean(nombres.trim() && apellidos.trim() && correo.trim() && contrasena.trim());

  return (
    <section className="auth-portal card anim-entrada superficie-app superficie-app--docente">
      <header className="auth-portal__topbar">
        <div className="auth-portal__brand">
          <div className="auth-portal__logo">
            <Icono nombre="docente" />
          </div>
          <div>
            <h1 className="auth-portal__title">Plataforma Docente</h1>
            <span className="auth-portal__subtitle">EvaluaPro · Sistema Universitario</span>
          </div>
        </div>
        <div className="auth-portal__top-actions">
          <button
            type="button"
            className="chip chip-version"
            title="Abrir información de versión"
            onClick={() => abrirVentanaVersion('docente')}
          >
            v{obtenerVersionApp()}
          </button>
          <TemaBoton />
        </div>
      </header>

      <div className="auth-grid auth-grid--docente">
        <div className="auth-hero">
          <div className="auth-hero__header">
            <p className="eyebrow">
              <Icono nombre="docente" /> Acceso docente
            </p>
            <h2>Gestión y Evaluación Académica</h2>
            <p className="auth-subtitulo">
              Diseña evaluaciones estructuradas, automatiza la calificación con hojas OMR y gestiona tus cursos con total privacidad local.
            </p>
          </div>

          <div className="auth-hero-illustration" aria-hidden="true">
            <div className="auth-shield-glow">
              <svg className="auth-shield-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M60 12L96 28V64C96 88 60 108 60 108C60 108 24 88 24 64V28L60 12Z" stroke="url(#shield-grad-docente)" strokeWidth="3" fill="rgba(37, 99, 235, 0.12)" />
                <path d="M60 42L88 54L60 66L32 54L60 42Z" fill="url(#cap-grad-docente)" stroke="#00d2ff" strokeWidth="1.5" />
                <path d="M44 60V74C44 79 51 83 60 83C69 83 76 79 76 74V60" stroke="#00d2ff" strokeWidth="2" strokeLinecap="round" />
                <path d="M84 56V72" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="shield-grad-docente" x1="24" y1="12" x2="96" y2="108" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d2ff" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="cap-grad-docente" x1="32" y1="42" x2="88" y2="66" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563eb" />
                    <stop offset="1" stopColor="#00d2ff" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <ul className="auth-feature-list auth-beneficios" aria-label="Beneficios">
            <li className="auth-feature-card">
              <div className="auth-feature-card__icon">
                <Icono nombre="banco" />
              </div>
              <div className="auth-feature-card__body">
                <strong>Gestión de Cursos y Banco</strong>
                <p>Organiza materias, listas de alumnos y preguntas por competencias.</p>
              </div>
            </li>

            <li className="auth-feature-card">
              <div className="auth-feature-card__icon">
                <Icono nombre="escaneo" />
              </div>
              <div className="auth-feature-card__body">
                <strong>Calificación OMR Instantánea</strong>
                <p>Genera exámenes impresos y procesa hojas de respuestas ópticas al instante.</p>
              </div>
            </li>

            <li className="auth-feature-card">
              <div className="auth-feature-card__icon">
                <Icono nombre="ok" />
              </div>
              <div className="auth-feature-card__body">
                <strong>Privacidad y Datos Locales</strong>
                <p>Tus calificaciones se almacenan de forma segura en tu equipo sin dependencias externas.</p>
              </div>
            </li>
          </ul>
        </div>

        <div className={`auth-form ${modo === 'ingresar' ? 'auth-form--ingresar' : 'auth-form--registrar'}`}>
          <div className="auth-form-head">
            <div className="acciones auth-tabs">
              <button
                className={modo === 'ingresar' ? 'boton auth-tab auth-tab--activo' : 'boton secundario auth-tab'}
                type="button"
                onClick={() => {
                  setModo('ingresar');
                  setCredentialRegistroGoogle(null);
                  setCrearContrasenaAhora(!googleOnly);
                  setMostrarFormularioIngresar(false);
                  setNombres('');
                  setApellidos('');
                  setMensaje('');
                }}
              >
                Ingresar
              </button>
              <button
                className={modo === 'registrar' ? 'boton auth-tab auth-tab--activo' : 'boton secundario auth-tab'}
                type="button"
                onClick={() => {
                  setModo('registrar');
                  setCrearContrasenaAhora(!googleOnly);
                  setMostrarFormularioRegistrar(false);
                  setNombres('');
                  setApellidos('');
                  setMensaje('');
                }}
              >
                Registrar
              </button>
            </div>

            <h3 className="mt-12">
              {modo === 'ingresar'
                ? 'Bienvenido a EvaluaPro'
                : primerUso
                  ? 'Configuración inicial y activación de licencia'
                  : 'Registro docente y activación de licencia'}
            </h3>
            <p className="nota">
              {modo === 'ingresar'
                ? 'Ingresa con tu correo institucional o credenciales habituales.'
                : 'Crea tu cuenta institucional y establece tu clave de licencia para activar la plataforma.'}
            </p>
          </div>

          {modo === 'registrar' && (
            <div className="panel auth-panel" aria-label="Ayuda de registro">
              <p className="nota">
                Para registrar tu cuenta completa <b>nombres</b>, <b>apellidos</b> y <b>correo</b>. La contraseña requiere mínimo 8 caracteres.
              </p>
              {googleOnly && (
                <p className="nota">Modo Google-only activo: usa tu cuenta institucional para crear o vincular acceso.</p>
              )}
              {dominiosPermitidos.length > 0 && (
                <p className="nota">Correo institucional requerido: {politicaDominiosTexto}</p>
              )}
            </div>
          )}

          {googleOnly && (
            <InlineMensaje tipo="info">
              Esta instalación requiere inicio de sesión con Google. Si ya tenías cuenta con este correo institucional, se vinculará al primer acceso.
            </InlineMensaje>
          )}

          {!googleDisponible && esDev && (
            <InlineMensaje tipo="info">
              Inicio de sesión con Google deshabilitado en este entorno. Para habilitarlo en desarrollo, define
              {' '}VITE_GOOGLE_CLIENT_ID en el .env del root y reinicia Vite.
            </InlineMensaje>
          )}

          {googleDisponible && modo === 'ingresar' && (
            <div className="auth-google auth-google--mb auth-panel">
              <GoogleLogin
                onSuccess={(cred) => {
                  const token = cred.credential;
                  if (!token) {
                    setMensaje('No se recibió credencial de Google.');
                    return;
                  }
                  void ingresarConGoogle(token);
                }}
                onError={() => setMensaje('No se pudo iniciar sesión con Google.')}
                useOneTap
              />
              <p className="nota nota--mt">
                Acceso principal: Google (correo institucional).
              </p>
              {dominiosPermitidos.length > 0 && (
                <p className="nota nota--mt">Solo se permiten: {politicaDominiosTexto}</p>
              )}

              {passwordDisponible && (
                <div className="acciones acciones--mt">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setMostrarFormularioIngresar((v) => !v);
                      setMensaje('');
                    }}
                  >
                    {mostrarFormularioIngresar ? 'Ocultar formulario' : 'Ingresar con correo y contraseña'}
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setMostrarRecuperar((v) => !v);
                      setMensaje('');
                    }}
                  >
                    {mostrarRecuperar ? 'Cerrar recuperación' : 'Recuperar contraseña con Google'}
                  </button>
                </div>
              )}

              {passwordDisponible && mostrarRecuperar && (
                <div className="panel mt-10 auth-panel auth-panel--inset">
                  <p className="nota">Si tu cuenta tiene Google vinculado, puedes establecer una nueva contraseña.</p>
                  {dominiosPermitidos.length > 0 && (
                    <p className="nota nota--mt">Solo se permiten: {politicaDominiosTexto}</p>
                  )}
                  <GoogleLogin
                    onSuccess={(cred) => {
                      const token = cred.credential;
                      if (!token) {
                        setMensaje('No se recibió credencial de Google.');
                        return;
                      }
                      setCredentialRecuperarGoogle(token);
                      setMensaje('Google listo. Define tu nueva contraseña.');
                    }}
                    onError={() => setMensaje('No se pudo reautenticar con Google.')}
                  />
                  <label className="campo mt-10">
                    Nueva contraseña
                    <input
                      type="password"
                      value={contrasenaRecuperar}
                      onChange={(event) => setContrasenaRecuperar(event.target.value)}
                      autoComplete="new-password"
                    />
                    <span className="ayuda">Mínimo 8 caracteres.</span>
                  </label>
                  <div className="acciones">
                    <Boton
                      type="button"
                      icono={<Icono nombre="ok" />}
                      cargando={enviando}
                      disabled={!credentialRecuperarGoogle || contrasenaRecuperar.trim().length < 8}
                      onClick={recuperarConGoogle}
                    >
                      {enviando ? 'Actualizando…' : 'Actualizar contraseña'}
                    </Boton>
                  </div>
                </div>
              )}
            </div>
          )}

          {googleDisponible && modo === 'registrar' && !(mostrarFormularioRegistrar && passwordDisponible) && (
            <div className="auth-google auth-google--mb auth-panel">
              <GoogleLogin
                onSuccess={(cred) => {
                  const token = cred.credential;
                  if (!token) {
                    setMensaje('No se recibió credencial de Google.');
                    return;
                  }

                  const payload = decodificarPayloadJwt(token);
                  const correoGoogle = typeof payload?.email === 'string' ? payload.email : undefined;
                  const nombreCompletoGoogle = typeof payload?.name === 'string' ? payload.name : undefined;
                  const nombreGoogle = typeof payload?.given_name === 'string' ? payload.given_name : undefined;
                  const apellidoGoogle = typeof payload?.family_name === 'string' ? payload.family_name : undefined;

                  if (correoGoogle && dominiosPermitidos.length > 0 && !correoPermitido(correoGoogle)) {
                    const msg = `Solo se permiten correos institucionales: ${politicaDominiosTexto}`;
                    setMensaje(msg);
                    emitToast({ level: 'error', title: 'Correo no permitido', message: msg, durationMs: 5200 });
                    return;
                  }

                  if (correoGoogle) setCorreo(correoGoogle);

                  const nombresActual = nombres.trim();
                  const apellidosActual = apellidos.trim();

                  if (nombreGoogle && !nombresActual) setNombres(nombreGoogle);
                  if (apellidoGoogle && !apellidosActual) setApellidos(apellidoGoogle);
                  if (nombreCompletoGoogle && (!nombresActual || !apellidosActual)) {
                    const partes = nombreCompletoGoogle
                      .split(' ')
                      .map((p) => p.trim())
                      .filter(Boolean);
                    if (partes.length >= 2) {
                      if (!nombresActual) setNombres(partes.slice(0, -1).join(' '));
                      if (!apellidosActual) setApellidos(partes.slice(-1).join(' '));
                    } else if (partes.length === 1 && !nombresActual) {
                      setNombres(partes[0]);
                    }
                  }
                  setCredentialRegistroGoogle(token);
                  setCrearContrasenaAhora(false);
                  setContrasena('');
                  setMensaje('Correo tomado de Google. Completa tus datos para crear la cuenta.');
                }}
                onError={() => setMensaje('No se pudo obtener datos de Google.')}
              />
              <div className="acciones acciones--mt">
                <button
                  className={credentialRegistroGoogle ? 'chip' : 'chip'}
                  type="button"
                  onClick={() => {
                    setCredentialRegistroGoogle(null);
                    setCorreo('');
                    setCrearContrasenaAhora(true);
                    setMensaje('');
                  }}
                  disabled={!credentialRegistroGoogle}
                >
                  Cambiar correo
                </button>
                {passwordDisponible && (
                  <button
                    className="chip"
                    type="button"
                    onClick={() => {
                      setMostrarFormularioRegistrar(true);
                      setCredentialRegistroGoogle(null);
                      setCorreo('');
                      setNombres('');
                      setApellidos('');
                      setContrasena('');
                      setCrearContrasenaAhora(true);
                      setMensaje('');
                    }}
                  >
                    Registrar con correo y contraseña
                  </button>
                )}
              </div>
              <p className="nota nota--mt">
                Registro principal: Google (correo institucional).
              </p>
              {dominiosPermitidos.length > 0 && (
                <p className="nota nota--mt">Solo se permiten: {politicaDominiosTexto}</p>
              )}
            </div>
          )}

          {googleDisponible && modo === 'registrar' && passwordDisponible && mostrarFormularioRegistrar && (
            <div className="panel auth-panel auth-panel--inset">
              <p className="nota">
                Registro por formulario (fallback). Recomendado: usa Google para correo institucional.
              </p>
              <div className="acciones acciones--mt">
                <button
                  className="chip"
                  type="button"
                  onClick={() => {
                    setMostrarFormularioRegistrar(false);
                    setMensaje('');
                  }}
                >
                  Volver a Google
                </button>
              </div>
            </div>
          )}

          {modo === 'registrar' && mostrarFormulario && (
            <>
              <label className="campo auth-campo">
                Nombres
                <input
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  autoComplete="given-name"
                  placeholder="Ej. Juan Carlos"
                />
              </label>
              <label className="campo auth-campo">
                Apellidos
                <input
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  autoComplete="family-name"
                  placeholder="Ej. Perez Lopez"
                />
              </label>
            </>
          )}

          {mostrarFormulario && (
            <label className="campo auth-campo">
              Correo
              <input
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                autoComplete="email"
                readOnly={modo === 'registrar' && Boolean(credentialRegistroGoogle)}
              />
              {modo === 'registrar' && credentialRegistroGoogle && <span className="ayuda">Correo bloqueado por Google.</span>}
            </label>
          )}

          {modo === 'registrar' && mostrarFormulario && (
            <label className="campo auth-campo">
              Clave o Código de Licencia (opcional / institucional)
              <input
                value={codigoLicencia}
                onChange={(event) => setCodigoLicencia(event.target.value)}
                placeholder="Ej. LIC-2026-DOC-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="ayuda">
                Si cuentas con una clave institucional, ingrésala para activar tu licencia docente de inmediato.
              </span>
            </label>
          )}

          {modo === 'registrar' && credentialRegistroGoogle && mostrarFormulario && passwordDisponible && (
            <label className="campo auth-campo">
              Crear contraseña ahora (opcional)
              <span className="ayuda">Si no, podrás definirla después desde Cuenta.</span>
              <input
                type="checkbox"
                checked={crearContrasenaAhora}
                onChange={(event) => {
                  setCrearContrasenaAhora(event.target.checked);
                  if (!event.target.checked) setContrasena('');
                }}
              />
            </label>
          )}

          {mostrarFormulario && passwordDisponible && (modo === 'ingresar' || !credentialRegistroGoogle || crearContrasenaAhora) && (
            <label className="campo auth-campo">
              Contraseña
              {modo === 'ingresar' ? (
                <input
                  type="password"
                  value={contrasena}
                  onChange={(event) => setContrasena(event.target.value)}
                  autoComplete="current-password"
                />
              ) : (
                <input
                  type="password"
                  value={contrasena}
                  onChange={(event) => setContrasena(event.target.value)}
                  autoComplete="new-password"
                />
              )}
              {modo === 'registrar' && credentialRegistroGoogle && (
                <span className="ayuda">Mínimo 8 caracteres.</span>
              )}
            </label>
          )}

          {mostrarFormulario && (
            <div className="acciones auth-submit">
              <Boton
                type="button"
                tamano="lg"
                icono={<Icono nombre={modo === 'ingresar' ? 'entrar' : 'nuevo'} />}
                cargando={enviando}
                disabled={cooldownActivo || (modo === 'ingresar' ? !puedeIngresar : !puedeRegistrar)}
                onClick={modo === 'ingresar' ? ingresar : registrar}
              >
                {modo === 'ingresar' ? (enviando ? 'Ingresando…' : 'Ingresar') : enviando ? 'Creando…' : 'Crear cuenta'}
              </Boton>
            </div>
          )}

          {mensaje && <InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje>}
        </div>
      </div>
    </section>
  );
}
