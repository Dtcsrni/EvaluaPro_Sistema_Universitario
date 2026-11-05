/**
 * SeccionAutenticacion
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ErrorRemoto, accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Check, LockKeyhole, Mail, ScanLine, TriangleAlert, IconoLucide } from '../../ui/iconosCatalogo';
import { TemaBoton } from '../../tema/TemaBoton';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { abrirVentanaVersion, obtenerVersionApp } from '../../ui/version/versionInfo';
import { clienteApi } from './clienteApiDocente';
import { tipoMensajeInline } from './mensajeInline';
import { registrarAccionDocente } from './telemetriaDocente';
import {
  exportarTrazaAutenticacion,
  nuevoIdFlujoAutenticacion,
  registrarEventoTrazabilidadAutenticacion
} from './trazaAutenticacion';
import {
  mensajeDeError
} from './utilidades';

function GoogleLoginConRespaldo({
  onSuccess,
  onError,
  onFallback,
  etiqueta = 'Acceder con Google',
  instrumentar = false
}: {
  onSuccess: (cred: { credential?: string }, flowId: string) => void;
  onError?: (flowId: string) => void;
  onFallback: () => void;
  etiqueta?: string;
  instrumentar?: boolean;
}) {
  const flowIdRef = useRef<string>('');
  if (!flowIdRef.current) flowIdRef.current = nuevoIdFlujoAutenticacion();
  const flowId = flowIdRef.current;

  useEffect(() => {
    if (!instrumentar) return;
    registrarEventoTrazabilidadAutenticacion({
      flowId,
      canal: 'google',
      etapa: 'widget_google_visible',
      resultado: 'exito'
    });
  }, [flowId, instrumentar]);

  return (
    <div className="auth-google-control">
      <div className="auth-google-provider">
        <GoogleLogin
          onSuccess={(cred) => {
            if (instrumentar) registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'callback_google', resultado: 'exito' });
            onSuccess(cred, flowId);
          }}
          onError={() => {
            if (instrumentar) registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'callback_google', resultado: 'error', codigo: 'PROVIDER_ERROR' });
            onError?.(flowId);
          }}
          useOneTap={false}
          theme="filled_blue"
          size="large"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      </div>
      <button type="button" className="auth-google-fallback" onClick={onFallback}>
        <span className="auth-google-fallback__mark" aria-hidden="true">G</span>
        {etiqueta}
      </button>
    </div>
  );
}

function GoogleDesktopLogin({ onCredential, onStart }: { onCredential: (credential: string) => void; onStart?: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState('');
  const [estadoEsError, setEstadoEsError] = useState(false);
  const flujoRef = useRef('');
  const cancelarRef = useRef(false);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => () => {
    const flowId = flujoRef.current;
    if (flowId) void clienteApi.enviar('/autenticacion/google-desktop/cancelar', { flowId }).catch(() => undefined);
    try { popupRef.current?.close(); } catch { /* ventana ya cerrada */ }
  }, []);

  async function iniciar() {
    if (ocupado) return;
    onStart?.();
    const webview = (window as Window & { chrome?: { webview?: { postMessage: (message: unknown) => void } } }).chrome?.webview;
    // El host WebView2 abre Google en el navegador del sistema; la versión web
    // abre una pestaña durante el gesto para evitar el bloqueo de popups.
    const popup = webview ? null : window.open('about:blank', '_blank', 'popup,width=520,height=720');
    if (!webview && !popup) {
      setEstado('Permite las ventanas emergentes para continuar con Google.');
      setEstadoEsError(true);
      return;
    }
    cancelarRef.current = false;
    popupRef.current = popup;
    setOcupado(true);
    setEstado('Conectando con Google…');
    setEstadoEsError(false);
    let flowId = '';
    try {
      const inicio = await clienteApi.enviar<{ flowId: string; url: string }>('/autenticacion/google-desktop/iniciar', {});
      flowId = inicio.flowId;
      flujoRef.current = flowId;
      if (webview) webview.postMessage({ type: 'EVALUAPRO_OPEN_EXTERNAL_URL', url: inicio.url });
      else popup?.location.replace(inicio.url);
      setEstado('Completa el acceso en la ventana de Google.');
      const limite = Date.now() + 10 * 60_000;
      while (Date.now() < limite) {
        if (cancelarRef.current) {
          setEstado('Acceso con Google cancelado.');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const resultado = await clienteApi.enviar<{ estado: string; credential?: string; codigo?: string }>(
          '/autenticacion/google-desktop/resultado', { flowId }
        );
        if (resultado.estado === 'pendiente') continue;
        if (resultado.estado === 'listo' && resultado.credential) {
          onCredential(resultado.credential);
          await clienteApi.enviar('/autenticacion/google-desktop/confirmar', { flowId });
          flujoRef.current = '';
          setEstado('Identidad de Google verificada.');
          return;
        }
        const mensajes: Record<string, string> = {
          GOOGLE_OAUTH_CANCELLED: 'Se canceló el acceso de Google. Puedes intentarlo de nuevo.',
          GOOGLE_EMAIL_NO_VERIFICADO: 'Google no confirmó este correo. Verifica la cuenta e inténtalo otra vez.',
          GOOGLE_DESKTOP_OAUTH_FAILED: 'Google no pudo confirmar tu identidad. Inténtalo de nuevo.'
        };
        setEstado(mensajes[resultado.codigo || ''] || 'El acceso de Google venció o no pudo completarse.');
        setEstadoEsError(true);
        flujoRef.current = '';
        return;
      }
      setEstado('El acceso de Google tardó demasiado. Inicia uno nuevo.');
      setEstadoEsError(true);
    } catch {
      setEstado('No se pudo iniciar el acceso con Google. Comprueba que EvaluaPro esté conectado e inténtalo otra vez.');
      setEstadoEsError(true);
    } finally {
      if (flowId) {
        void clienteApi.enviar('/autenticacion/google-desktop/cancelar', { flowId }).catch(() => undefined);
      }
      flujoRef.current = '';
      setOcupado(false);
      try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { /* noop */ }
      popupRef.current = null;
    }
  }

  return (
    <div className="auth-google-control">
      <button type="button" className="auth-google-fallback" onClick={() => void iniciar()} disabled={ocupado}>
        <span className="auth-google-fallback__mark" aria-hidden="true">G</span>
        {ocupado ? 'Esperando a Google…' : estadoEsError ? 'Reintentar con Google' : 'Acceder con Google'}
      </button>
      {ocupado && <button type="button" className="chip" onClick={() => { cancelarRef.current = true; setEstado('Cancelando acceso…'); }}>Cancelar</button>}
      {estado && (estadoEsError
        ? <InlineMensaje tipo="error">{estado}</InlineMensaje>
        : <p role="status" aria-live="polite" className="nota">{estado}</p>)}
    </div>
  );
}

export function SeccionAutenticacion({
  onIngresar,
  onReintentarGoogle,
  oauthGoogleDisponible,
  oauthGoogleBackendDisponible,
  oauthGoogleDesktopDisponible,
  oauthGoogleConsultando,
  oauthGoogleConsultaFallida,
  requireGoogleOAuth,
  passwordLoginAllowed,
  primerUso,
  modoInicial
}: {
  onIngresar: (token: string, persistente?: boolean, flowId?: string) => void;
  onReintentarGoogle?: () => Promise<boolean>;
  oauthGoogleDisponible?: boolean;
  oauthGoogleBackendDisponible?: boolean;
  oauthGoogleDesktopDisponible?: boolean;
  oauthGoogleConsultando?: boolean;
  oauthGoogleConsultaFallida?: boolean;
  smtpDisponible?: boolean;
  requireGoogleOAuth?: boolean;
  passwordLoginAllowed?: boolean;
  primerUso?: boolean;
  modoInicial?: 'ingresar' | 'registrar';
}) {
  const ayudaSesionRecordadaId = useId();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [codigoLicencia, setCodigoLicencia] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modo, setModo] = useState<'ingresar' | 'registrar'>(
    modoInicial ?? (primerUso ? 'registrar' : 'ingresar')
  );
  const [enviando, setEnviando] = useState(false);
  const [cooldownHasta, setCooldownHasta] = useState<number | null>(null);
  const [errorGoogleOauth, setErrorGoogleOauth] = useState(false);
  const temporizadorCooldown = useRef<number | null>(null);
  const [credentialRegistroGoogle, setCredentialRegistroGoogle] = useState<string | null>(null);
  const [crearContrasenaAhora, setCrearContrasenaAhora] = useState(true);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [credentialRecuperarGoogle, setCredentialRecuperarGoogle] = useState<string | null>(null);
  const [contrasenaRecuperar, setContrasenaRecuperar] = useState('');
  const [mostrarFormularioIngresar, setMostrarFormularioIngresar] = useState(false);
  const [mostrarFormularioRegistrar, setMostrarFormularioRegistrar] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mantenerSesion, setMantenerSesion] = useState(true);
  const [reintentandoGoogle, setReintentandoGoogle] = useState(false);
  const [diagnosticoGoogle, setDiagnosticoGoogle] = useState('');
  const [estadoDiagnostico, setEstadoDiagnostico] = useState('');

  function calcularFortalezaPassword(pwd: string) {
    if (!pwd) return { nivel: 0, texto: '' };
    if (pwd.length < 6) return { nivel: 1, texto: 'Muy corta' };
    if (pwd.length < 8) return { nivel: 2, texto: 'Mínimo 8 caracteres' };
    const tieneMayus = /[A-Z]/.test(pwd);
    const tieneNum = /[0-9]/.test(pwd);
    const tieneSimbolo = /[^A-Za-z0-9]/.test(pwd);
    const puntos = (tieneMayus ? 1 : 0) + (tieneNum ? 1 : 0) + (tieneSimbolo ? 1 : 0);
    if (puntos >= 2 && pwd.length >= 10) return { nivel: 4, texto: 'Excelente y segura' };
    if (puntos >= 1) return { nivel: 3, texto: 'Buena seguridad' };
    return { nivel: 2, texto: 'Aceptable' };
  }

  const fortaleza = calcularFortalezaPassword(contrasena);

  function datosErrorTrazabilidad(error: unknown) {
    const detalle = error instanceof ErrorRemoto ? error.detalle : undefined;
    const candidato = typeof detalle?.codigo === 'string' ? detalle.codigo.toUpperCase() : '';
    const codigo = /^[A-Z0-9_]{1,64}$/.test(candidato)
      ? candidato
      : typeof detalle?.status === 'number' ? `HTTP_${detalle.status}` : 'ERROR_CLIENTE';
    return {
      codigo,
      ...(typeof detalle?.status === 'number' ? { httpStatus: detalle.status } : {})
    };
  }

  async function copiarDiagnosticoAcceso() {
    if (!import.meta.env.DEV) return;
    try {
      await navigator.clipboard.writeText(exportarTrazaAutenticacion());
      setEstadoDiagnostico('Diagnóstico local copiado. No incluye credenciales ni datos personales.');
    } catch {
      setEstadoDiagnostico('No se pudo copiar el diagnóstico desde este navegador.');
    }
  }

  function hayGoogleConfigurado() {
    return Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  }

  function informarGoogleNoDisponible() {
    const msg = 'El acceso de Google no pudo cargarse. Verifica tu conexión e inténtalo nuevamente.';
    setMensaje(msg);
  }

  function informarRecuperacionSesionSiAplica(error: unknown) {
    const action = accionToastSesionParaError(error, 'docente');
    if (!action) return;
    emitToast({
      level: 'error',
      title: 'Sesión anterior activa',
      message: 'Cierra la sesión actual para volver a intentarlo.',
      action,
      persistent: true
    });
  }

  async function reintentarAccesoGoogle() {
    setReintentandoGoogle(true);
    setDiagnosticoGoogle('');
    try {
      const recuperado = await onReintentarGoogle?.();
      if (!recuperado) {
        setDiagnosticoGoogle('No se pudo confirmar la disponibilidad del inicio de sesión con Google. Revisa la conexión con EvaluaPro e inténtalo de nuevo.');
      }
    } catch {
      setDiagnosticoGoogle('No se pudo consultar la configuración de Google. Verifica la conexión con el backend e inténtalo de nuevo.');
    } finally {
      setReintentandoGoogle(false);
    }
  }

  const googleDisponible = typeof oauthGoogleDisponible === 'boolean' ? oauthGoogleDisponible : hayGoogleConfigurado();
  const googleLoginDisponible = googleDisponible || Boolean(oauthGoogleDesktopDisponible);
  const googleBackendNoDisponible = googleDisponible && oauthGoogleBackendDisponible === false;
  const googlePendienteDeConfirmacion = Boolean(oauthGoogleConsultando);
  const googleTemporalmenteNoDisponible = Boolean(oauthGoogleConsultaFallida) || (!googleLoginDisponible && oauthGoogleBackendDisponible === true);
  const esDev = import.meta.env.DEV;
  const googleOnly = Boolean(requireGoogleOAuth);
  const passwordDisponible = Boolean(passwordLoginAllowed !== false && !googleOnly);
  const formularioIngresoForzado = modo === 'ingresar' && (googleBackendNoDisponible || !googleDisponible);
  const mostrarFormulario = googleOnly
    ? modo === 'registrar' && Boolean(credentialRegistroGoogle)
    : modo === 'ingresar'
      ? (googleBackendNoDisponible || !googleDisponible || mostrarFormularioIngresar)
      : (googleBackendNoDisponible || !googleDisponible || mostrarFormularioRegistrar || Boolean(credentialRegistroGoogle));

  const ahora = Date.now();
  const cooldownMs = cooldownHasta ? Math.max(0, cooldownHasta - ahora) : 0;
  const cooldownActivo = cooldownMs > 0;

  useEffect(() => () => {
    if (temporizadorCooldown.current) window.clearTimeout(temporizadorCooldown.current);
  }, []);

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
    const flowId = nuevoIdFlujoAutenticacion();
    try {
      if (!passwordDisponible) {
        setMensaje('Esta instalación requiere inicio de sesión con Google.');
        return;
      }
      if (bloquearSiEnCurso()) return;
      const inicio = Date.now();
      setEnviando(true);
      setMensaje('');
      registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'contrasena', etapa: 'solicitud_api', resultado: 'iniciado' });
      const respuesta = await clienteApi.enviar<{ token: string }>(
        '/autenticacion/ingresar',
        { correo, contrasena },
        { headers: { 'X-Auth-Flow-ID': flowId } }
      );
      registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'contrasena', etapa: 'solicitud_api', resultado: 'exito', duracionMs: Date.now() - inicio });
      onIngresar(respuesta.token, mantenerSesion, flowId);
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

      if (!esNoRegistrado) informarRecuperacionSesionSiAplica(error);
      registrarAccionDocente('login', false);
      registrarEventoTrazabilidadAutenticacion({
        flowId,
        canal: 'contrasena',
        etapa: 'solicitud_api',
        resultado: 'error',
        ...datosErrorTrazabilidad(error)
      });
    } finally {
      setEnviando(false);
    }
  }

  async function ingresarConGoogle(credential: string, flowId: string) {
    const inicio = Date.now();
    try {
      if (bloquearSiEnCurso()) return;
      setEnviando(true);
      setMensaje('');
      registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'solicitud_api', resultado: 'iniciado' });
      const respuesta = await clienteApi.enviar<{ token: string }>(
        '/autenticacion/google',
        { credential },
        { headers: { 'X-Auth-Flow-ID': flowId } }
      );
      registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'solicitud_api', resultado: 'exito', duracionMs: Date.now() - inicio });
      onIngresar(respuesta.token, mantenerSesion, flowId);
      emitToast({ level: 'ok', title: 'Sesion', message: 'Bienvenido/a', durationMs: 2200 });
      registrarAccionDocente('login_google', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo ingresar con Google');
      setMensaje(msg);
      registrarEventoTrazabilidadAutenticacion({
        flowId,
        canal: 'google',
        etapa: 'solicitud_api',
        resultado: 'error',
        duracionMs: Date.now() - inicio,
        ...datosErrorTrazabilidad(error)
      });

      if (error instanceof ErrorRemoto && error.detalle?.status === 429) {
        iniciarCooldown(8_000);
      }

      const codigo = error instanceof ErrorRemoto ? error.detalle?.codigo : undefined;
      const esNoRegistrado = typeof codigo === 'string' && codigo.toUpperCase() === 'DOCENTE_NO_REGISTRADO';
      if (esNoRegistrado) {
        invitarARegistrarDesdeGoogle(credential);
      }

      if (!esNoRegistrado) informarRecuperacionSesionSiAplica(error);
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
      informarRecuperacionSesionSiAplica(error);
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
      if (!nombres.trim() || !apellidos.trim()) {
        const msg = 'Completa tus nombres y apellidos.';
        setMensaje(msg);
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
      onIngresar(respuesta.token, mantenerSesion);
      emitToast({ level: 'ok', title: 'Cuenta creada', message: 'Sesión iniciada', durationMs: 2800 });
      registrarAccionDocente(credentialRegistroGoogle ? 'registrar_google' : 'registrar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo registrar');
      setMensaje(msg);
      informarRecuperacionSesionSiAplica(error);
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
            <img src="/favicon-docente.svg" alt="EvaluaPro" className="auth-portal__brand-img" />
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
            aria-label={`Versión v${obtenerVersionApp()}. Abrir información de versión`}
            title="Abrir información de versión"
            onClick={() => abrirVentanaVersion('docente')}
          >
            v{obtenerVersionApp()}
          </button>
          <TemaBoton />
        </div>
      </header>

      <div className="auth-stage-layout">
        {/* Columna Izquierda: Showcase Gráfico y Mockup OMR */}
        <div className="auth-showcase">
          <div className="auth-showcase-badge">
            <span className="auth-pulse-dot" /> Suite Universitaria Local
          </div>

          <h2 className="auth-showcase-title">
            Evaluación docente y <span className="auth-gradient-text">calificación OMR</span>
          </h2>
          <p className="auth-showcase-desc">
            Organiza tus materias, genera exámenes impresos con QR y revisa hojas ópticas con ayuda de OMR.
          </p>

          {/* Mockup Gráfico 3D Flotante de Examen OMR */}
          <div className="auth-omr-mockup-card" aria-hidden="true">
            <div className="auth-omr-sheet">
              <div className="auth-omr-header-row">
                <div className="auth-omr-meta">
                  <span className="auth-omr-chip">EXAMEN PARCIAL · FOLIO: #EP-2026-A</span>
                  <div className="auth-omr-lines">
                    <span className="auth-omr-line auth-omr-line--title" />
                    <span className="auth-omr-line auth-omr-line--sub" />
                  </div>
                </div>
                <div className="auth-omr-qr-box">
            <svg className="auth-qr-svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14-2h2v2h-2v-2zm-4 0h2v4h-2v-4zm6 6h2v2h-2v-2zm-2-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm6 0h2v2h-2v-2zm-6-4h4v2h-4v-2zM5 5h2v2H5V5zm12 0h2v2h-2V5zM5 17h2v2H5v-2z"/>
                  </svg>
                </div>
              </div>

              <div className="auth-omr-bubbles-grid">
                <div className="auth-omr-row">
                  <span className="auth-omr-num">01.</span>
                  <div className="auth-omr-options">
                    <span className="auth-bubble auth-bubble--checked">A</span>
                    <span className="auth-bubble">B</span>
                    <span className="auth-bubble">C</span>
                    <span className="auth-bubble">D</span>
                  </div>
                  <span className="auth-omr-check-tag"><IconoLucide icon={Check} size={14} /> Leída</span>
                </div>
                <div className="auth-omr-row">
                  <span className="auth-omr-num">02.</span>
                  <div className="auth-omr-options">
                    <span className="auth-bubble">A</span>
                    <span className="auth-bubble">B</span>
                    <span className="auth-bubble auth-bubble--checked">C</span>
                    <span className="auth-bubble">D</span>
                  </div>
                  <span className="auth-omr-check-tag"><IconoLucide icon={Check} size={14} /> Leída</span>
                </div>
                <div className="auth-omr-row">
                  <span className="auth-omr-num">03.</span>
                  <div className="auth-omr-options">
                    <span className="auth-bubble">A</span>
                    <span className="auth-bubble auth-bubble--checked">B</span>
                    <span className="auth-bubble">C</span>
                    <span className="auth-bubble">D</span>
                  </div>
                  <span className="auth-omr-check-tag"><IconoLucide icon={Check} size={14} /> Leída</span>
                </div>
              </div>
            </div>

            {/* Badge Flotante KPI */}
            <div className="auth-floating-kpi">
              <div className="auth-floating-kpi__icon"><IconoLucide icon={ScanLine} size={20} /></div>
              <div>
                <strong>Lectura óptica de respuestas</strong>
                <span>Procesa las hojas y revisa los resultados.</span>
              </div>
            </div>
          </div>

          {/* 3 Tarjetas de Beneficios */}
          <div className="auth-features-grid" role="list" aria-label="Beneficios principales">
            <div className="auth-feature-pill" role="listitem">
              <div className="auth-feature-pill__icon">
                <Icono nombre="pdf" />
              </div>
              <div className="auth-feature-pill__body">
                <strong>Exámenes PDF con QR</strong>
                <p>Genera claves aleatorias con sellos de autenticidad.</p>
              </div>
            </div>

            <div className="auth-feature-pill" role="listitem">
              <div className="auth-feature-pill__icon">
                <Icono nombre="escaneo" />
              </div>
              <div className="auth-feature-pill__body">
                <strong>Calificación OMR por lotes</strong>
                <p>Procesa lotes de hojas escaneadas y revisa sus resultados.</p>
              </div>
            </div>

            <div className="auth-feature-pill" role="listitem">
              <div className="auth-feature-pill__icon">
                <Icono nombre="ok" />
              </div>
              <div className="auth-feature-pill__body">
                <strong>Almacenamiento local</strong>
                <p>La base de datos de EvaluaPro se guarda en SQLite en este equipo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Acceso y Registro */}
        <div className="auth-card-wrapper">
          <div className={`auth-card-clean ${modo === 'ingresar' ? 'auth-card--ingresar' : 'auth-card--registrar'}`}>
            <div className="auth-card-header">
              <div className="auth-tabs-segmented" role="group" aria-label="Modo de acceso">
                <button
                  className={modo === 'ingresar' ? 'auth-segmented-btn auth-segmented-btn--active' : 'auth-segmented-btn'}
                  type="button"
                  aria-pressed={modo === 'ingresar'}
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
                  <Icono nombre="entrar" /> Ingresar
                </button>
                <button
                  className={modo === 'registrar' ? 'auth-segmented-btn auth-segmented-btn--active' : 'auth-segmented-btn'}
                  type="button"
                  aria-pressed={modo === 'registrar'}
                  onClick={() => {
                    setModo('registrar');
                    setCrearContrasenaAhora(!googleOnly);
                    setMostrarFormularioRegistrar(false);
                    setNombres('');
                    setApellidos('');
                    setMensaje('');
                  }}
                >
                  <Icono nombre="nuevo" /> Registrar
                </button>
              </div>

              <p className="eyebrow">Acceso docente</p>
              <h2 className="auth-card-title">
                {modo === 'ingresar' ? 'Iniciar Sesión' : 'Registro Inicial Docente'}
              </h2>
              <p className="auth-card-desc">
                {modo === 'ingresar'
                  ? 'Accede a tus materias, exámenes y calificaciones.'
                  : 'Crea tu cuenta institucional local para gestionar tus grupos y evaluaciones.'}
              </p>
            </div>

          {mensaje && <div className="auth-form-feedback" id="auth-form-feedback"><InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje></div>}

          {googleOnly && (
            <InlineMensaje tipo="info">
              {modo === 'registrar'
                ? 'Modo Google-only activo: Completa tu registro vinculando tu cuenta institucional de Google.'
                : 'Esta instalación requiere inicio de sesión con Google. Si ya tenías cuenta con este correo, se vinculará al primer acceso.'}
            </InlineMensaje>
          )}

          {!googleLoginDisponible && modo === 'ingresar' && (
            <div className="auth-google-status" data-state={reintentandoGoogle || googlePendienteDeConfirmacion ? 'loading' : googleTemporalmenteNoDisponible ? 'error' : 'disabled'}>
              {reintentandoGoogle ? null : googlePendienteDeConfirmacion ? (
                <InlineMensaje tipo="info">Comprobando la disponibilidad del acceso con Google…</InlineMensaje>
              ) : googleTemporalmenteNoDisponible ? (
                <InlineMensaje tipo="error">
                  {diagnosticoGoogle || (oauthGoogleBackendDisponible === true
                    ? 'Google está habilitado en el servicio, pero no se pudo cargar el botón de acceso.'
                    : 'No fue posible consultar la disponibilidad de Google.')} Puedes continuar con correo y contraseña o volver a consultar.
                </InlineMensaje>
              ) : (
                <InlineMensaje tipo="info">
                  Google no está habilitado. {passwordDisponible
                    ? 'Usa el formulario para ingresar.'
                    : 'Contacta a la persona administradora de EvaluaPro.'}
                </InlineMensaje>
              )}
              {googleTemporalmenteNoDisponible && (
                <span
                  className="sr-only"
                  role="status"
                  aria-label="Estado de consulta de Google"
                  aria-atomic="true"
                >
                  {reintentandoGoogle ? 'Consultando la disponibilidad de Google.' : ''}
                </span>
              )}
              {googleTemporalmenteNoDisponible && (
                <button
                  type="button"
                  className="auth-google-retry"
                  onClick={() => void reintentarAccesoGoogle()}
                  disabled={reintentandoGoogle}
                  aria-busy={reintentandoGoogle}
                >
                  {reintentandoGoogle ? 'Consultando Google…' : 'Volver a consultar Google'}
                </button>
              )}
            </div>
          )}

          {googleLoginDisponible && modo === 'ingresar' && (
            <div className="auth-google-wrapper">
              {errorGoogleOauth && (
                <div className="cuenta-toggle-card anim-fade-in mb-15" role="alert">
                  <div className="cuenta-toggle-info">
                    <div className="cuenta-toggle-title">
                      <IconoLucide icon={TriangleAlert} size={18} /> No se pudo completar el acceso con Google
                    </div>
                    <div className="cuenta-toggle-desc">
                      Inténtalo de nuevo con Google o usa tu correo y contraseña. Si el problema continúa, contacta a soporte.
                    </div>
                    <div className="acciones acciones--mt">
                      <button
                        type="button"
                        className="boton boton--secundario"
                        onClick={() => {
                          setMostrarFormularioIngresar(true);
                          setErrorGoogleOauth(false);
                        }}
                      >
                        <IconoLucide icon={Mail} size={16} /> Usar correo y contraseña
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {oauthGoogleDesktopDisponible && <GoogleDesktopLogin
                onStart={() => setMensaje('')}
                onCredential={(credential) => void ingresarConGoogle(credential, nuevoIdFlujoAutenticacion())}
              />}
              {googleDisponible && !oauthGoogleDesktopDisponible && <GoogleLoginConRespaldo
                instrumentar
                onSuccess={(cred, flowId) => {
                  const token = cred.credential;
                  if (!token) {
                    registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'callback_google', resultado: 'error', codigo: 'CREDENTIAL_MISSING' });
                    setMensaje('No se recibió credencial de Google.');
                    return;
                  }
                  void ingresarConGoogle(token, flowId);
                }}
                onError={(flowId) => {
                  registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'google', etapa: 'callback_google', resultado: 'error', codigo: 'PROVIDER_ERROR' });
                  setErrorGoogleOauth(true);
                  setMensaje('');
                }}
                onFallback={informarGoogleNoDisponible}
              />}
              {esDev && (
                <div className="acciones acciones--mt">
                  <button type="button" className="chip" onClick={() => void copiarDiagnosticoAcceso()}>
                    Copiar diagnóstico de acceso
                  </button>
                  {estadoDiagnostico && <span role="status" aria-live="polite">{estadoDiagnostico}</span>}
                </div>
              )}
              {esDev && googleBackendNoDisponible && (
                <p className="nota nota--mt" role="status">
                  Google está visible, pero el servicio local no reporta su configuración OAuth. Revisa el archivo de configuración instalado y reinicia EvaluaPro.
                </p>
              )}
              {passwordDisponible && (
                <div className="auth-divider-row">
                  {!formularioIngresoForzado && (
                    <button
                      type="button"
                      className="chip"
                      aria-expanded={mostrarFormularioIngresar}
                      onClick={() => {
                        setMostrarFormularioIngresar((v) => !v);
                        setMensaje('');
                      }}
                    >
                      {mostrarFormularioIngresar ? 'Ocultar formulario' : 'Ingresar con correo y contraseña'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setMostrarRecuperar((v) => !v);
                      setMensaje('');
                    }}
                  >
                    {mostrarRecuperar ? 'Cerrar recuperación' : 'Restablecer contraseña'}
                  </button>
                </div>
              )}

              {passwordDisponible && mostrarRecuperar && (
                <div className="auth-recovery-box">
                  <p className="nota">Verifica con Google la cuenta vinculada para establecer una contraseña nueva.</p>
                  <GoogleLoginConRespaldo
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
                    onFallback={informarGoogleNoDisponible}
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
                  <div className="acciones mt-10">
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

          {googleLoginDisponible && modo === 'registrar' && !(mostrarFormularioRegistrar && passwordDisponible) && (
            <div className="auth-google-wrapper">
              {oauthGoogleDesktopDisponible && <GoogleDesktopLogin onCredential={(credential) => {
                const payload = decodificarPayloadJwt(credential);
                setCredentialRegistroGoogle(credential);
                setCrearContrasenaAhora(false);
                if (typeof payload?.email === 'string') setCorreo(payload.email);
                setMensaje('Google verificó tu identidad. Completa tus datos y registra la cuenta.');
              }} />}
              {googleDisponible && !oauthGoogleDesktopDisponible && <GoogleLoginConRespaldo
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
                onFallback={informarGoogleNoDisponible}
                etiqueta="Continuar con Google"
              />}
              <div className="auth-divider-row">
                <button
                  className="chip"
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
            </div>
          )}

          {googleDisponible && modo === 'registrar' && passwordDisponible && mostrarFormularioRegistrar && (
            <div className="auth-fallback-info">
              <p className="nota">Registro por formulario tradicional.</p>
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
          )}

          {mostrarFormulario && (
            <form className="auth-form-fields" aria-label={modo === 'ingresar' ? 'Acceso docente' : 'Registro docente'} aria-describedby={mensaje ? 'auth-form-feedback' : undefined} onSubmit={(e) => { e.preventDefault(); if (modo === 'ingresar') { if (puedeIngresar) ingresar(); } else { if (puedeRegistrar) registrar(); } }}>
              {modo === 'registrar' && (
                <div className="auth-row-2col">
                  <label className="campo auth-campo">
                    Nombres
                    <div className="auth-input-box auth-input-box--user">
                      <Icono nombre="alumno" size={16} className="auth-input-icon" />
                      <input
                        value={nombres}
                        onChange={(event) => setNombres(event.target.value)}
                        autoComplete="given-name"
                        placeholder="Ej. Juan Carlos"
                      />
                    </div>
                  </label>
                  <label className="campo auth-campo">
                    Apellidos
                    <div className="auth-input-box auth-input-box--user">
                      <Icono nombre="alumno" size={16} className="auth-input-icon" />
                      <input
                        value={apellidos}
                        onChange={(event) => setApellidos(event.target.value)}
                        autoComplete="family-name"
                        placeholder="Ej. Pérez López"
                      />
                    </div>
                  </label>
                </div>
              )}

              <label className="campo auth-campo">
                <span className="auth-field-label">
                  Correo{modo === 'ingresar' && <span className="auth-required-mark">(obligatorio)</span>}
                </span>
                <div className="auth-input-box auth-input-box--mail">
                  <Icono nombre="correo" size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    value={correo}
                    onChange={(event) => setCorreo(event.target.value)}
                    onInput={(event) => setCorreo((event.target as HTMLInputElement).value)}
                    autoComplete="email"
                    required={modo === 'ingresar'}
                    readOnly={modo === 'registrar' && Boolean(credentialRegistroGoogle)}
                  />
                  {correo.includes('@') && <Icono nombre="ok" size={16} className="auth-input-status" />}
                </div>
                {modo === 'registrar' && credentialRegistroGoogle && <span className="ayuda">Correo validado con Google.</span>}
              </label>

              {modo === 'registrar' && (
                <label className="campo auth-campo">
                  Clave o Código de Licencia (opcional / institucional)
                  <div className="auth-input-box auth-input-box--shield">
                    <Icono nombre="candado" size={16} className="auth-input-icon" />
                    <input
                      value={codigoLicencia}
                      onChange={(event) => setCodigoLicencia(event.target.value)}
                      onInput={(event) => setCodigoLicencia((event.target as HTMLInputElement).value)}
                      placeholder="Ej. LIC-2026-DOC-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <span className="ayuda">
                    Si cuentas con una clave institucional, ingrésala para activar tu licencia docente de inmediato.
                  </span>
                </label>
              )}

              {modo === 'registrar' && credentialRegistroGoogle && passwordDisponible && (
                <label className="campo auth-campo-checkbox">
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

              {passwordDisponible && (modo === 'ingresar' || !credentialRegistroGoogle || crearContrasenaAhora) && (
                <div className="campo auth-campo">
                  <label htmlFor="auth-password">
                    <span className="auth-field-label">
                      Contraseña{modo === 'ingresar' && <span className="auth-required-mark">(obligatoria)</span>}
                    </span>
                  </label>
                  <div className="auth-input-box auth-input-box--key">
                    <Icono nombre="candado" size={16} className="auth-input-icon" />
                    <input
                      id="auth-password"
                      type={mostrarPassword ? 'text' : 'password'}
                      value={contrasena}
                      onChange={(event) => setContrasena(event.target.value)}
                      onInput={(event) => setContrasena((event.target as HTMLInputElement).value)}
                      autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
                      required={modo === 'ingresar'}
                    />
                    <button
                      type="button"
                      className="auth-pwd-toggle"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={mostrarPassword}
                    >
                      <Icono nombre="ojo" size={18} />
                    </button>
                  </div>
                  {modo === 'registrar' && contrasena.length > 0 && (
                    <div className="auth-pwd-meter" data-nivel={fortaleza.nivel}>
                      <div className="auth-pwd-meter-bars" aria-hidden="true">
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 1 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 2 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 3 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 4 ? 'auth-pwd-bar--active' : ''}`} />
                      </div>
                      <span className="auth-pwd-meter-label" role="status" aria-live="polite">
                        {fortaleza.texto}
                      </span>
                    </div>
                  )}
                  {modo === 'registrar' && (
                    <span className="ayuda">Mínimo 8 caracteres.</span>
                  )}
                </div>
              )}

                <div className="auth-remember-row">
                  <label className="auth-remember-label">
                    <input
                      type="checkbox"
                      checked={mantenerSesion}
                      onChange={(event) => setMantenerSesion(event.target.checked)}
                      className="auth-remember-checkbox"
                      aria-describedby={ayudaSesionRecordadaId}
                    />
                    <span className="auth-remember-text">Mantener sesión iniciada en este equipo</span>
                  </label>
                  <span className="auth-remember-help" id={ayudaSesionRecordadaId}>Si lo compartes, desactívala.</span>
                </div>

                <div className="auth-submit-row">
                  <Boton
                    type="submit"
                    tamano="lg"
                    variante="primario"
                    icono={<Icono nombre={modo === 'ingresar' ? 'entrar' : 'nuevo'} />}
                    cargando={enviando}
                    disabled={cooldownActivo || (modo === 'ingresar' ? !puedeIngresar : !puedeRegistrar)}
                  >
                    {modo === 'ingresar' ? (enviando ? 'Ingresando…' : 'Ingresar') : enviando ? 'Creando cuenta…' : 'Crear cuenta'}
                  </Boton>
                </div>
            </form>
          )}

          <div className="auth-card-footer">
            <span className="auth-privacy-badge">
              <IconoLucide icon={LockKeyhole} size={16} /> Base de datos SQLite en este equipo
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
}
