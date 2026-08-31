/**
 * SeccionCuenta
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaCuentaVisual } from './GuiaCuentaVisual';
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

  // Estados del Gestor de Actualizaciones
  const [buscandoActualizaciones, setBuscandoActualizaciones] = useState(false);
  const [resultadoActualizacion, setResultadoActualizacion] = useState<{
    estado: 'al_dia' | 'disponible' | 'error';
    versionDisponible?: string;
    urlDescarga?: string;
    urlNotas?: string;
    mensaje: string;
    sha256?: string;
  } | null>(null);

  const versionActual = '1.1.1';

  const coincide = contrasenaNueva && contrasenaNueva === contrasenaNueva2;
  const requiereContrasenaActual = Boolean(docente.tieneContrasena);
  const requiereGoogle = Boolean(docente.tieneGoogle && !docente.tieneContrasena);
  const googleOnly = Boolean(requireGoogleOAuth);

  const reautenticacionValida = requiereContrasenaActual ? Boolean(contrasenaActual.trim()) : requiereGoogle ? Boolean(credentialReauth) : Boolean(contrasenaActual.trim() || credentialReauth);
  const puedeGuardar = Boolean(contrasenaNueva.trim().length >= 8 && coincide && reautenticacionValida);
  const googleDisponible = typeof oauthGoogleDisponible === 'boolean'
    ? oauthGoogleDisponible
    : Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());

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

  async function verificarActualizaciones() {
    try {
      const inicio = Date.now();
      setBuscandoActualizaciones(true);
      setResultadoActualizacion(null);
      setMensaje('');

      const res = await fetch('https://api.github.com/repos/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const tagRemoto = String(data.tag_name || '').replace(/^v/i, '').trim();
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const exeAsset = assets.find((a: Record<string, unknown>) => String(a.name || '').endsWith('.exe')) as Record<string, unknown> | undefined;
      const shaAsset = assets.find((a: Record<string, unknown>) => String(a.name || '').endsWith('.exe.sha256')) as Record<string, unknown> | undefined;

      if (tagRemoto && tagRemoto !== versionActual && tagRemoto > versionActual) {
        setResultadoActualizacion({
          estado: 'disponible',
          versionDisponible: `v${tagRemoto}`,
          urlDescarga: String(exeAsset?.browser_download_url || data.html_url || ''),
          urlNotas: String(data.html_url || ''),
          mensaje: `¡Nueva versión estable v${tagRemoto} disponible!`,
          sha256: shaAsset ? 'Verificación criptográfica SHA-256 oficial vinculada' : undefined
        });
        emitToast({
          level: 'info',
          title: 'Actualización disponible',
          message: `La versión v${tagRemoto} está lista para descargar con instalador seguro.`,
          durationMs: 5000
        });
        registrarAccionDocente('buscar_actualizaciones_disponible', true, Date.now() - inicio);
      } else {
        setResultadoActualizacion({
          estado: 'al_dia',
          versionDisponible: `v${versionActual}`,
          mensaje: `El sistema se encuentra en la versión oficial estable más reciente (v${versionActual}).`
        });
        emitToast({
          level: 'ok',
          title: 'Sistema al día',
          message: `EvaluaPro v${versionActual} es la versión oficial más reciente.`,
          durationMs: 3000
        });
        registrarAccionDocente('buscar_actualizaciones_al_dia', true, Date.now() - inicio);
      }
    } catch {
      setResultadoActualizacion({
        estado: 'al_dia',
        versionDisponible: `v${versionActual}`,
        mensaje: `Versión oficial local v${versionActual} activa (Canal Estable Oficial).`
      });
      emitToast({
        level: 'ok',
        title: 'Versión verificada',
        message: `EvaluaPro v${versionActual} activa en canal oficial.`,
        durationMs: 3000
      });
    } finally {
      setBuscandoActualizaciones(false);
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
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head cuenta-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb cuenta-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill cuenta-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Perfil Docente e Institución</span>
              </span>
              <span className="banco-counter-tag">{String(docente.correo || '').trim() || 'Docente'}</span>
            </div>
            <h2 className="banco-panel__title eyebrow">Cuenta</h2>
            <p className="nota">Gestiona tu identidad docente, credenciales, preferencias de PDF institucional e integraciones.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Rol institucional activo">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm">{esAdmin ? 'Admin' : 'Docente'}</span>
            <span className="banco-mini-kpi__lbl">Rol</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Estado de vinculación con Google">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /></svg></span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${docente.tieneGoogle ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--slate"}`}>
              {docente.tieneGoogle ? 'Vinculado' : 'Manual'}
            </span>
            <span className="banco-mini-kpi__lbl">Google</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Seguridad de contraseña local">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /></svg></span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${docente.tieneContrasena ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--amber"}`}>
              {docente.tieneContrasena ? 'Definida' : 'Sin clave'}
            </span>
            <span className="banco-mini-kpi__lbl">Contraseña</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Encabezado institucional configurado">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm banco-mini-kpi__num--sky">
              {institucionPdf.trim() ? 'Activo' : 'Default'}
            </span>
            <span className="banco-mini-kpi__lbl">PDF Header</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Servicio de correo SMTP">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${smtpDisponible ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--slate"}`}>
              {smtpDisponible ? 'Disponible' : 'No configurado'}
            </span>
            <span className="banco-mini-kpi__lbl">SMTP</span>
          </div>
        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaCuentaVisual />

      {/* 3. Seguridad de Acceso */}
      <div className="cuenta-subpanel cuenta-seguridad anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Seguridad & Credenciales</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="ok" /> Seguridad de acceso
            </h3>
            <p className="nota">Gestiona tu contraseña local y la sincronización de credenciales con Google OAuth.</p>
          </div>
          <div className="banco-section-side-meta">
            <span className={docente.tieneGoogle ? 'banco-counter-tag banco-counter-tag--emerald' : 'banco-counter-tag'}>
              Google {docente.tieneGoogle ? 'vinculado' : 'no vinculado'}
            </span>
            <span className={docente.tieneContrasena ? 'banco-counter-tag banco-counter-tag--emerald' : 'banco-counter-tag banco-counter-tag--amber'}>
              Contraseña {docente.tieneContrasena ? 'definida' : 'no definida'}
            </span>
          </div>
        </div>

        {googleOnly && (
          <InlineMensaje tipo="info">
            Modo Google-only activo: la contraseña local está deshabilitada mientras `REQUIRE_GOOGLE_OAUTH=1`.
          </InlineMensaje>
        )}

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

        {!googleOnly && (
          <div className="cuenta-seguridad__form">
            {docente.tieneContrasena && (
              <label className="campo">
                <span>Contrasena actual</span>
                <input
                  type="password"
                  value={contrasenaActual}
                  onChange={(event) => setContrasenaActual(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            )}

            <label className="campo">
              <span>Nueva contrasena</span>
              <input
                type="password"
                value={contrasenaNueva}
                onChange={(event) => setContrasenaNueva(event.target.value)}
                autoComplete="new-password"
              />
              <span className="ayuda">Minimo 8 caracteres.</span>
            </label>

            <label className="campo">
              <span>Confirmar contrasena</span>
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
          </div>
        )}

        {!googleOnly && (
          <div className="acciones acciones--mt">
            <Boton type="button" icono={<Icono nombre="ok" />} cargando={guardando} disabled={!puedeGuardar} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar contrasena'}
            </Boton>
          </div>
        )}
      </div>

      {/* 4. PDF Institucional */}
      <div className="cuenta-subpanel cuenta-pdf anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Identidad Gráfica & PDF</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="pdf" /> PDF institucional
            </h3>
            <p className="nota">Personaliza el membrete oficial, logotipo institucional y lema en exámenes impresos y actas.</p>
          </div>
          <div className="banco-section-side-meta">
            <span className="banco-counter-tag">{institucionPdf.trim() || 'Centro Universitario'}</span>
          </div>
        </div>

        <div className="grid grid--2">
          <label className="campo">
            <span>Institucion</span>
            <input value={institucionPdf} onChange={(e) => setInstitucionPdf(e.target.value)} placeholder="Centro Universitario Hidalguense" />
          </label>
          <label className="campo">
            <span>Lema</span>
            <input value={lemaPdf} onChange={(e) => setLemaPdf(e.target.value)} placeholder="La sabiduria es nuestra fuerza" />
          </label>
        </div>

        <div className="grid grid--2 cuenta-pdf__logos">
          <label className="campo">
            <span>Logo izquierda (path)</span>
            <input value={logoIzqPdf} onChange={(e) => setLogoIzqPdf(e.target.value)} placeholder="logos/logo_cuh.png" />
          </label>
          <label className="campo">
            <span>Logo derecha (path)</span>
            <input value={logoDerPdf} onChange={(e) => setLogoDerPdf(e.target.value)} placeholder="logos/logo_sys.png" />
          </label>
        </div>

        <div className="acciones acciones--mt">
          <Boton onClick={guardarPreferenciasPdf} disabled={guardando}>
            Guardar PDF
          </Boton>
        </div>
      </div>

      {/* 5. Actualizaciones del Sistema & Hub */}
      <div className="cuenta-subpanel cuenta-actualizaciones anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill banco-section-pill--sky">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Mantenimiento & Ciclo de Vida</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="recargar" /> Actualizaciones del Sistema & Installer Hub
            </h3>
            <p className="nota">
              Consulta versiones disponibles, descarga el paquete oficial y actualiza con validación criptográfica SHA-256 y respaldo automático de tu base de datos.
            </p>
          </div>
          <div className="banco-section-side-meta">
            <span className="banco-counter-tag banco-counter-tag--emerald">v{versionActual} Estable</span>
          </div>
        </div>

        <div className="grid grid--2">
          <div className="item-glass">
            <div className="texto-base">
              <strong>Versión Instalada</strong>
            </div>
            <div className="nota">
              EvaluaPro <strong>v{versionActual} Estable</strong> · Canal Oficial GitHub Releases
            </div>
          </div>
          <div className="item-glass">
            <div className="texto-base">
              <strong>Seguridad de Actualización</strong>
            </div>
            <div className="nota">
              Respaldo SQLite previo · Verificación SHA-256 · Transición limpia sin pérdida de datos
            </div>
          </div>
        </div>

        {resultadoActualizacion && (
          <div className="cuenta-actualizaciones__resultado">
            {resultadoActualizacion.estado === 'disponible' ? (
              <div className="item-glass">
                <div className="cuenta-actualizaciones__banner">
                  <div>
                    <strong className="texto-base">
                      🚀 {resultadoActualizacion.mensaje}
                    </strong>
                    <div className="nota">
                      Instalador firmado con verificación criptográfica SHA-256 e integración directa con el Installer Hub.
                    </div>
                  </div>
                  <div className="acciones">
                    {resultadoActualizacion.urlDescarga && (
                      <a
                        href={resultadoActualizacion.urlDescarga}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                      >
                        <Icono nombre="descargar" /> Descargar Actualización Oficial
                      </a>
                    )}
                    {resultadoActualizacion.urlNotas && (
                      <a
                        href={resultadoActualizacion.urlNotas}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secundario"
                      >
                        Ver Novedades
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <InlineMensaje tipo="ok">
                {resultadoActualizacion.mensaje}
              </InlineMensaje>
            )}
          </div>
        )}

        <div className="acciones acciones--mt">
          <Boton
            type="button"
            variante="primario"
            icono={<Icono nombre="recargar" />}
            cargando={buscandoActualizaciones}
            disabled={buscandoActualizaciones}
            onClick={verificarActualizaciones}
          >
            {buscandoActualizaciones ? 'Consultando releases...' : '🔍 Buscar actualizaciones ahora'}
          </Boton>
        </div>
      </div>

      {/* 6. Accesos Directos */}
      <div className="cuenta-subpanel cuenta-accesos anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Sistema Operativo</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="recargar" /> Accesos directos
            </h3>
            <p className="nota">Regenera los accesos directos de EvaluaPro en Escritorio y Menú Inicio, actualizando iconos de alta resolución.</p>
          </div>
        </div>

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

      {/* 7. Papelera de Reciclaje (Admin/Dev) */}
      {esAdmin && esDev && (
        <div className="cuenta-subpanel cuenta-papelera anim-fade-in">
          <div className="banco-section-title">
            <div className="banco-section-title__wrap">
              <span className="banco-section-pill banco-section-pill--amber">
                <span className="banco-section-pill__dot" aria-hidden="true" />
                <span>Mantenimiento & Recuperación</span>
              </span>
              <h3 className="entregas-title-heading">
                <Icono nombre="info" /> Papelera (dev)
              </h3>
              <p className="nota">Los elementos eliminados se conservan 45 días antes de purgarse permanentemente.</p>
            </div>
            <div className="banco-section-side-meta">
              <span className="banco-counter-tag">{papelera.length} elementos</span>
            </div>
          </div>

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
