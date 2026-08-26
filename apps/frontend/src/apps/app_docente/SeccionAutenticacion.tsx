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
  primerUso,
  modoInicial
}: {
  onIngresar: (token: string, persistente?: boolean) => void;
  oauthGoogleDisponible?: boolean;
  smtpDisponible?: boolean;
  requireGoogleOAuth?: boolean;
  passwordLoginAllowed?: boolean;
  primerUso?: boolean;
  modoInicial?: 'ingresar' | 'registrar';
}) {
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

  function calcularFortalezaPassword(pwd: string) {
    if (!pwd) return { nivel: 0, texto: '', color: '#94a3b8' };
    if (pwd.length < 6) return { nivel: 1, texto: 'Muy corta', color: '#f87171' };
    if (pwd.length < 8) return { nivel: 2, texto: 'Mínimo 8 caracteres', color: '#fbbf24' };
    const tieneMayus = /[A-Z]/.test(pwd);
    const tieneNum = /[0-9]/.test(pwd);
    const tieneSimbolo = /[^A-Za-z0-9]/.test(pwd);
    const puntos = (tieneMayus ? 1 : 0) + (tieneNum ? 1 : 0) + (tieneSimbolo ? 1 : 0);
    if (puntos >= 2 && pwd.length >= 10) return { nivel: 4, texto: 'Excelente y segura', color: '#34d399' };
    if (puntos >= 1) return { nivel: 3, texto: 'Buena seguridad', color: '#38bdf8' };
    return { nivel: 2, texto: 'Aceptable', color: '#fbbf24' };
  }

  const fortaleza = calcularFortalezaPassword(contrasena);

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
      onIngresar(respuesta.token, mantenerSesion);
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
      onIngresar(respuesta.token, mantenerSesion);
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
      onIngresar(respuesta.token, mantenerSesion);
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
            <span className="auth-pulse-dot" /> Suite Universitaria Local · v{obtenerVersionApp()}
          </div>

          <h2 className="auth-showcase-title">
            Evaluación docente y <span className="auth-gradient-text">calificación OMR instantánea</span>
          </h2>
          <p className="auth-showcase-desc">
            Diseña materias, genera exámenes impresos con código QR de vinculación y procesa hojas ópticas en segundos con total privacidad local.
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
                  <span className="auth-omr-check-tag">✓ 100%</span>
                </div>
                <div className="auth-omr-row">
                  <span className="auth-omr-num">02.</span>
                  <div className="auth-omr-options">
                    <span className="auth-bubble">A</span>
                    <span className="auth-bubble">B</span>
                    <span className="auth-bubble auth-bubble--checked">C</span>
                    <span className="auth-bubble">D</span>
                  </div>
                  <span className="auth-omr-check-tag">✓ 100%</span>
                </div>
                <div className="auth-omr-row">
                  <span className="auth-omr-num">03.</span>
                  <div className="auth-omr-options">
                    <span className="auth-bubble">A</span>
                    <span className="auth-bubble auth-bubble--checked">B</span>
                    <span className="auth-bubble">C</span>
                    <span className="auth-bubble">D</span>
                  </div>
                  <span className="auth-omr-check-tag">✓ 100%</span>
                </div>
              </div>
            </div>

            {/* Badge Flotante KPI */}
            <div className="auth-floating-kpi">
              <div className="auth-floating-kpi__icon">⚡</div>
              <div>
                <strong>Reconocimiento Óptico OMR</strong>
                <span>Calificación precisa en &lt; 1 seg</span>
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
                <strong>Calificación OMR Masiva</strong>
                <p>Procesa lotes de hojas escaneadas al instante.</p>
              </div>
            </div>

            <div className="auth-feature-pill" role="listitem">
              <div className="auth-feature-pill__icon">
                <Icono nombre="ok" />
              </div>
              <div className="auth-feature-pill__body">
                <strong>Privacidad Local Total</strong>
                <p>Tu información vive segura en SQLite (evaluapro.db).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Acceso y Registro */}
        <div className="auth-card-wrapper">
          <div className={`auth-card-clean ${modo === 'ingresar' ? 'auth-card--ingresar' : 'auth-card--registrar'}`}>
            <div className="auth-card-header">
              <div className="auth-tabs-segmented">
                <button
                  className={modo === 'ingresar' ? 'auth-segmented-btn auth-segmented-btn--active' : 'auth-segmented-btn'}
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
                  <Icono nombre="entrar" /> Ingresar
                </button>
                <button
                  className={modo === 'registrar' ? 'auth-segmented-btn auth-segmented-btn--active' : 'auth-segmented-btn'}
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
                  <Icono nombre="nuevo" /> Registrar
                </button>
              </div>

              <p className="eyebrow">Acceso docente</p>
              <h2 className="auth-card-title">
                {modo === 'ingresar' ? 'Iniciar Sesión' : 'Registro Inicial Docente'}
              </h2>
              <p className="auth-card-desc">
                {modo === 'ingresar'
                  ? 'Ingresa tus credenciales para acceder a tus materias, exámenes y calificaciones.'
                  : 'Crea tu cuenta institucional local para gestionar tus grupos y evaluaciones.'}
              </p>
            </div>

          {mensaje && <InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje>}

          {googleOnly && (
            <InlineMensaje tipo="info">
              {modo === 'registrar'
                ? 'Modo Google-only activo: Completa tu registro vinculando tu cuenta institucional de Google.'
                : 'Esta instalación requiere inicio de sesión con Google. Si ya tenías cuenta con este correo institucional, se vinculará al primer acceso.'}
            </InlineMensaje>
          )}

          {!googleDisponible && esDev && (
            <InlineMensaje tipo="info">
              Inicio de sesión con Google deshabilitado en este entorno.
            </InlineMensaje>
          )}

          {googleDisponible && modo === 'ingresar' && (
            <div className="auth-google-wrapper">
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
              {dominiosPermitidos.length > 0 && (
                <p className="nota nota--mt">Solo se permiten: {politicaDominiosTexto}</p>
              )}

              {passwordDisponible && (
                <div className="auth-divider-row">
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
                <div className="auth-recovery-box">
                  <p className="nota">Si tu cuenta tiene Google vinculado, establece tu nueva contraseña.</p>
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

          {googleDisponible && modo === 'registrar' && !(mostrarFormularioRegistrar && passwordDisponible) && (
            <div className="auth-google-wrapper">
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
              {dominiosPermitidos.length > 0 && (
                <p className="nota nota--mt">Solo se permiten: {politicaDominiosTexto}</p>
              )}
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
            <form className="auth-form-fields" onSubmit={(e) => { e.preventDefault(); if (modo === 'ingresar') { if (puedeIngresar) ingresar(); } else { if (puedeRegistrar) registrar(); } }}>
              {modo === 'registrar' && (
                <div className="auth-row-2col">
                  <label className="campo auth-campo">
                    Nombres
                    <div className="auth-input-box auth-input-box--user">
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
                Correo
                <div className="auth-input-box auth-input-box--mail">
                  <input
                    type="email"
                    value={correo}
                    onChange={(event) => setCorreo(event.target.value)}
                    onInput={(event) => setCorreo((event.target as HTMLInputElement).value)}
                    autoComplete="email"
                    placeholder="docente@universidad.edu.mx"
                    readOnly={modo === 'registrar' && Boolean(credentialRegistroGoogle)}
                  />
                  {correo.includes('@') && <span className="auth-input-status" aria-hidden="true" />}
                </div>
                {modo === 'registrar' && credentialRegistroGoogle && <span className="ayuda">Correo validado con Google.</span>}
              </label>

              {modo === 'registrar' && (
                <label className="campo auth-campo">
                  Clave o Código de Licencia (opcional / institucional)
                  <div className="auth-input-box auth-input-box--shield">
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
                <label className="campo auth-campo">
                  Contraseña
                  <div className="auth-input-box auth-input-box--key">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      value={contrasena}
                      onChange={(event) => setContrasena(event.target.value)}
                      onInput={(event) => setContrasena((event.target as HTMLInputElement).value)}
                      autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="auth-pwd-toggle"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      title={mostrarPassword ? 'Ocultar' : 'Mostrar'}
                      aria-label={mostrarPassword ? 'Ocultar' : 'Mostrar'}
                      tabIndex={-1}
                    >
                      {mostrarPassword ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                  {modo === 'registrar' && contrasena.length > 0 && (
                    <div className="auth-pwd-meter" data-nivel={fortaleza.nivel} aria-hidden="true">
                      <div className="auth-pwd-meter-bars">
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 1 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 2 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 3 ? 'auth-pwd-bar--active' : ''}`} />
                        <span className={`auth-pwd-bar ${fortaleza.nivel >= 4 ? 'auth-pwd-bar--active' : ''}`} />
                      </div>
                      <span className="auth-pwd-meter-label">
                        {fortaleza.texto}
                      </span>
                    </div>
                  )}
                  {modo === 'registrar' && (
                    <span className="ayuda">Mínimo 8 caracteres.</span>
                  )}
                </label>
              )}

                <div className="auth-remember-row">
                  <label
                    className="auth-remember-label"
                    data-tooltip="Mantiene tu sesión activa en este equipo para no tener que ingresar tus datos cada vez"
                    title="Mantiene tu sesión activa en este equipo para no tener que ingresar tus datos cada vez"
                  >
                    <input
                      type="checkbox"
                      checked={mantenerSesion}
                      onChange={(event) => setMantenerSesion(event.target.checked)}
                      className="auth-remember-checkbox"
                    />
                    <span className="auth-remember-text">Mantener sesión iniciada en este equipo</span>
                  </label>
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
              🔒 Datos 100% locales en tu equipo (SQLite) · v{obtenerVersionApp()}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
}
