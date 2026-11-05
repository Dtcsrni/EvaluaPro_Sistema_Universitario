/**
 * SeccionCuenta
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useId, useState, type FocusEvent } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import {
  eliminarFotoPerfilLocal,
  EVENTO_FOTO_PERFIL_DOCENTE,
  guardarFotoPerfilLocal,
  MAX_FOTO_PERFIL_BYTES,
  obtenerFotoPerfilLocal
} from './fotoPerfilDocente';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaCuentaVisual } from './GuiaCuentaVisual';
import { SeccionConfiguracionSincronizacion } from './SeccionConfiguracionSincronizacion';
import type { EstadoLeaseUI } from './SeccionLeaseSincronizacion';
import { compararVersiones, obtenerVersionTecnicaApp } from '../../ui/version/versionInfo';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Docente } from './tipos';
import { idCortoMateria, mensajeDeError } from './utilidades';

function esDataUrlImagen(valor: string) {
  return /^data:image\//i.test(String(valor || '').trim());
}

function esNumeroParEntre2y50(valor: string) {
  const paginas = Number(valor);
  return valor.trim() !== '' && Number.isInteger(paginas) && paginas >= 2 && paginas <= 50 && paginas % 2 === 0;
}

function anchoBotonGoogleCuenta() {
  if (typeof document === 'undefined') return 228;
  return Math.max(120, Math.min(228, document.documentElement.clientWidth - 128));
}

type ContextoMensajeCuenta = 'general' | 'foto' | 'seguridad' | 'pdf' | 'retencion' | 'accesos' | 'papelera';

export function SeccionCuenta({
  docente,
  onDocenteActualizado,
  esAdmin,
  esDev,
  oauthGoogleDisponible,
  smtpDisponible,
  requireGoogleOAuth,
  estadoLease,
  errorConsultaLease,
  onReintentarConsultaLease,
  onConfigurarCarpeta
}: {
  docente: Docente;
  onDocenteActualizado: (d: Docente) => void;
  esAdmin: boolean;
  esDev: boolean;
  oauthGoogleDisponible?: boolean;
  classroomDisponible?: boolean;
  smtpDisponible?: boolean;
  requireGoogleOAuth?: boolean;
  estadoLease: EstadoLeaseUI | null;
  errorConsultaLease?: boolean;
  onReintentarConsultaLease?: () => Promise<boolean>;
  onConfigurarCarpeta: (directorio: string) => Promise<EstadoLeaseUI>;
}) {
  const id = useId();
  const prefijoAnclas = `cuenta-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const anclas = {
    foto: `${prefijoAnclas}-foto`,
    sincronizacion: `${prefijoAnclas}-sincronizacion`,
    seguridad: `${prefijoAnclas}-seguridad`,
    pdf: `${prefijoAnclas}-pdf`,
    retencion: `${prefijoAnclas}-retencion`,
    actualizaciones: `${prefijoAnclas}-actualizaciones`,
    accesos: `${prefijoAnclas}-accesos`,
    papelera: `${prefijoAnclas}-papelera`
  };
  const formularioContrasenaId = `cuenta-form-contrasena-${id}`;
  const ayudaContrasenaActualId = `cuenta-contrasena-actual-ayuda-${id}`;
  const ayudaConfirmacionContrasenaId = `cuenta-contrasena-confirmacion-ayuda-${id}`;
  const errorConfirmacionId = `cuenta-contrasena-confirmacion-${id}`;
  const ayudaFotoPerfilId = `cuenta-foto-perfil-ayuda-${id}`;
  const errorFotoPerfilId = `${ayudaFotoPerfilId}-error`;
  const ayudaLogosPdfId = `cuenta-logos-pdf-ayuda-${id}`;
  const ayudaPaginasPdfId = `cuenta-paginas-ayuda-${id}`;
  const logoIzqPdfId = `cuenta-logo-izquierdo-${id}`;
  const logoDerPdfId = `cuenta-logo-derecho-${id}`;
  const errorLogoIzqPdfId = `${logoIzqPdfId}-error`;
  const errorLogoDerPdfId = `${logoDerPdfId}-error`;
  const logoIzqPdfLabelId = `${logoIzqPdfId}-label`;
  const logoDerPdfLabelId = `${logoDerPdfId}-label`;
  const logoIzqPdfStatusId = `${logoIzqPdfId}-status`;
  const logoDerPdfStatusId = `${logoDerPdfId}-status`;
  const retencionPdfEtiquetaId = `cuenta-retencion-pdf-etiqueta-${id}`;
  const retencionPdfAyudaId = `cuenta-retencion-pdf-ayuda-${id}`;
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [contrasenaNueva2, setContrasenaNueva2] = useState('');
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [contrasenasVisibles, setContrasenasVisibles] = useState({ actual: false, nueva: false, confirmacion: false });
  const ocultarContrasenaAlSalir = (event: FocusEvent<HTMLDivElement>, campo: keyof typeof contrasenasVisibles) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setContrasenasVisibles((actuales) => actuales[campo]
      ? { ...actuales, [campo]: false }
      : actuales);
  };
  const [credentialReauth, setCredentialReauth] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'ok' | 'warning' | 'error'>('info');
  const [contextoMensaje, setContextoMensaje] = useState<ContextoMensajeCuenta>('general');
  const [fotoPerfilLocalEstado, setFotoPerfilLocalEstado] = useState(() => ({
    docenteId: docente.id,
    valor: obtenerFotoPerfilLocal(docente.id)
  }));
  const [errorFotoPerfil, setErrorFotoPerfil] = useState('');
  const [erroresLogosPdf, setErroresLogosPdf] = useState<Record<'izquierda' | 'derecha', string>>({
    izquierda: '',
    derecha: ''
  });
  const [fotoCuentaFallida, setFotoCuentaFallida] = useState(false);
  const [fotoLocalFallida, setFotoLocalFallida] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [regenerandoAccesos, setRegenerandoAccesos] = useState(false);
  const [anchoGoogle, setAnchoGoogle] = useState(anchoBotonGoogleCuenta);

  useEffect(() => {
    const actualizarAnchoGoogle = () => setAnchoGoogle(anchoBotonGoogleCuenta());
    window.addEventListener('resize', actualizarAnchoGoogle);
    return () => window.removeEventListener('resize', actualizarAnchoGoogle);
  }, []);

  const [institucionPdf, setInstitucionPdf] = useState(docente.preferenciasPdf?.institucion ?? '');
  const [lemaPdf, setLemaPdf] = useState(docente.preferenciasPdf?.lema ?? '');
  const [paginasPorTipo, setPaginasPorTipo] = useState({
    parcial: String(docente.preferenciasPdf?.paginasPorTipo?.parcial ?? 2),
    global: String(docente.preferenciasPdf?.paginasPorTipo?.global ?? 4),
    extraordinario: String(docente.preferenciasPdf?.paginasPorTipo?.extraordinario ?? 4)
  });
  useEffect(() => {
    setPaginasPorTipo({
      parcial: String(docente.preferenciasPdf?.paginasPorTipo?.parcial ?? 2),
      global: String(docente.preferenciasPdf?.paginasPorTipo?.global ?? 4),
      extraordinario: String(docente.preferenciasPdf?.paginasPorTipo?.extraordinario ?? 4)
    });
  }, [docente.id, docente.preferenciasPdf?.paginasPorTipo]);
  const logoIzqInicial = docente.preferenciasPdf?.logos?.izquierdaPath ?? '';
  const logoDerInicial = docente.preferenciasPdf?.logos?.derechaPath ?? '';
  const [logoIzqPdf, setLogoIzqPdf] = useState(esDataUrlImagen(logoIzqInicial) ? logoIzqInicial : '');
  const [logoDerPdf, setLogoDerPdf] = useState(esDataUrlImagen(logoDerInicial) ? logoDerInicial : '');
  const [logoIzqPdfPath, setLogoIzqPdfPath] = useState(esDataUrlImagen(logoIzqInicial) ? '' : logoIzqInicial);
  const [logoDerPdfPath, setLogoDerPdfPath] = useState(esDataUrlImagen(logoDerInicial) ? '' : logoDerInicial);
  const [logoIzqPdfNombre, setLogoIzqPdfNombre] = useState('');
  const [logoDerPdfNombre, setLogoDerPdfNombre] = useState('');
  const [papelera, setPapelera] = useState<Array<Record<string, unknown>>>([]);
  const [papeleraCargada, setPapeleraCargada] = useState(false);
  const [errorCargaPapelera, setErrorCargaPapelera] = useState(false);
  const [cargandoPapelera, setCargandoPapelera] = useState(esAdmin && esDev);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [retencionParcialesMeses, setRetencionParcialesMeses] = useState<3 | 6 | 12 | null>(docente.retencionParcialesArchivadosMeses ?? null);

  // Estados del Gestor de Actualizaciones
  const [buscandoActualizaciones, setBuscandoActualizaciones] = useState(false);
  const [resultadoActualizacion, setResultadoActualizacion] = useState<{
    estado: 'al_dia' | 'disponible' | 'error';
    versionDisponible?: string;
    urlDescarga?: string;
    urlChecksum?: string;
    urlNotas?: string;
    mensaje: string;
  } | null>(null);

  const versionActual = obtenerVersionTecnicaApp();
  const fotoPerfilCuenta = String(docente.imagenPerfil || '').trim();
  const tieneFotoPerfilCuenta = /^(https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(fotoPerfilCuenta);
  const mostrarFotoCuenta = tieneFotoPerfilCuenta && !fotoCuentaFallida;
  const fotoPerfilLocal = fotoPerfilLocalEstado.docenteId === docente.id ? fotoPerfilLocalEstado.valor : null;

  useEffect(() => {
    setFotoCuentaFallida(false);
    setFotoLocalFallida(false);
    setFotoPerfilLocalEstado({ docenteId: docente.id, valor: obtenerFotoPerfilLocal(docente.id) });
  }, [docente.id, fotoPerfilCuenta]);

  const mensajeEstadoFotoPerfil = fotoCuentaFallida
    ? fotoPerfilLocal && !fotoLocalFallida
      ? 'La imagen vinculada no se pudo cargar; se muestra la foto local de respaldo, guardada solo en este equipo.'
      : 'La imagen vinculada no se pudo cargar. Puedes elegir una foto local de respaldo; solo se guardará en este equipo.'
    : tieneFotoPerfilCuenta
      ? 'Se usa la imagen vinculada a tu cuenta.'
      : 'La imagen se guarda en este equipo y no se envía al servidor.';

  function mostrarMensaje(
    texto: string,
    tipo: 'info' | 'ok' | 'warning' | 'error' = 'info',
    contexto: ContextoMensajeCuenta = 'general'
  ) {
    setMensaje(texto);
    setTipoMensaje(texto ? tipo : 'info');
    setContextoMensaje(contexto);
  }

  function mensajeEnContexto(contexto: ContextoMensajeCuenta) {
    if (!mensaje || contextoMensaje !== contexto) return null;
    return <InlineMensaje tipo={tipoMensaje}>{mensaje}</InlineMensaje>;
  }

  function emitirRecuperacionSesion(error: unknown) {
    const accion = accionToastSesionParaError(error, 'docente');
    if (!accion) return;
    emitToast({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'El detalle está en Cuenta. Cierra sesión y vuelve a entrar para renovar el acceso.',
      action: accion
    });
  }

  function seleccionarFotoPerfil(archivo?: File) {
    if (!archivo) return;
    setErrorFotoPerfil('');
    mostrarMensaje('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setErrorFotoPerfil('La imagen debe ser PNG, JPG o WebP.');
      return;
    }
    if (archivo.size > MAX_FOTO_PERFIL_BYTES) {
      setErrorFotoPerfil('La imagen no puede superar 1 MB.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const dataUrl = String(lector.result ?? '');
      try {
        guardarFotoPerfilLocal(docente.id, dataUrl);
        setFotoPerfilLocalEstado({ docenteId: docente.id, valor: dataUrl });
        setFotoLocalFallida(false);
        mostrarMensaje('La foto de perfil se guardó en este equipo.', 'ok', 'foto');
        window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
          detail: { docenteId: docente.id, foto: dataUrl }
        }));
      } catch (error) {
        setErrorFotoPerfil(error instanceof Error ? error.message : 'No se pudo guardar la foto en este equipo.');
      }
    };
    lector.onerror = () => setErrorFotoPerfil('No se pudo leer la imagen seleccionada.');
    lector.readAsDataURL(archivo);
  }

  function retirarFotoPerfil() {
    try {
      eliminarFotoPerfilLocal(docente.id);
      setFotoPerfilLocalEstado({ docenteId: docente.id, valor: null });
      setFotoLocalFallida(false);
      mostrarMensaje('La foto local se retiró; se mostrará el avatar docente predeterminado.', 'ok', 'foto');
      window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
        detail: { docenteId: docente.id, foto: null }
      }));
    } catch {
      mostrarMensaje('No se pudo retirar la foto de este equipo.', 'error', 'foto');
    }
  }

  const coincide = contrasenaNueva && contrasenaNueva === contrasenaNueva2;
  const contrasenaNuevaCorta = Boolean(contrasenaNueva && contrasenaNueva.trim().length < 8);
  const contrasenasNoCoinciden = Boolean(contrasenaNueva2 && !coincide);
  const ayudaContrasenaNuevaId = `cuenta-contrasena-nueva-ayuda-${id}`;
  const errorContrasenaNuevaId = `cuenta-contrasena-nueva-error-${id}`;
  const requiereContrasenaActual = Boolean(docente.tieneContrasena);
  const requiereGoogle = Boolean(docente.tieneGoogle && !docente.tieneContrasena);
  const googleOnly = Boolean(requireGoogleOAuth);
  const paginasPorTipoValidas = Object.values(paginasPorTipo).every(esNumeroParEntre2y50);

  const reautenticacionValida = requiereContrasenaActual ? Boolean(contrasenaActual.trim()) : requiereGoogle ? Boolean(credentialReauth) : Boolean(contrasenaActual.trim() || credentialReauth);
  const puedeGuardar = Boolean(contrasenaNueva.trim().length >= 8 && coincide && reautenticacionValida);
  const googleDisponible = typeof oauthGoogleDisponible === 'boolean'
    ? oauthGoogleDisponible
    : Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  const puedeCambiarContrasena = Boolean(!googleOnly && (
    docente.tieneContrasena || (docente.tieneGoogle && googleDisponible)
  ));
  const mensajeReautenticacionNoDisponible = !googleOnly && !puedeCambiarContrasena
    ? docente.tieneGoogle
      ? 'Google está vinculado, pero no está disponible para confirmar este cambio ahora. Pide a la persona administradora de EvaluaPro que revise la configuración de acceso.'
      : 'Falta un método para confirmar el cambio: contraseña local o Google vinculado. Pide a quien administra EvaluaPro que revise tu acceso.'
    : '';

  async function guardar() {
    try {
      const inicio = Date.now();
      setGuardando(true);
      mostrarMensaje('');

      const cuerpo: Record<string, unknown> = { contrasenaNueva };
      if (contrasenaActual.trim()) cuerpo.contrasenaActual = contrasenaActual;
      if (credentialReauth) cuerpo.credential = credentialReauth;

      await clienteApi.enviar('/autenticacion/definir-contrasena', cuerpo);
      mostrarMensaje('Contraseña actualizada.', 'ok', 'seguridad');
      registrarAccionDocente('definir_contrasena', true, Date.now() - inicio);
      setContrasenaNueva('');
      setContrasenaNueva2('');
      setContrasenaActual('');
      setCredentialReauth(null);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la contraseña.');
      mostrarMensaje(msg, 'error', 'seguridad');
      emitirRecuperacionSesion(error);
      registrarAccionDocente('definir_contrasena', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPreferenciasPdf() {
    if (!paginasPorTipoValidas) return;
    try {
      const inicio = Date.now();
      setGuardando(true);
      mostrarMensaje('');

      const cuerpo: Record<string, unknown> = {};
      if (institucionPdf.trim()) cuerpo.institucion = institucionPdf.trim();
      if (lemaPdf.trim()) cuerpo.lema = lemaPdf.trim();
      cuerpo.paginasPorTipo = {
        parcial: Number(paginasPorTipo.parcial),
        global: Number(paginasPorTipo.global),
        extraordinario: Number(paginasPorTipo.extraordinario)
      };
      const logoIzquierda = logoIzqPdf.trim() || logoIzqPdfPath.trim();
      const logoDerecha = logoDerPdf.trim() || logoDerPdfPath.trim();
      if (logoIzquierda || logoDerecha) {
        cuerpo.logos = {
          ...(logoIzquierda ? { izquierdaPath: logoIzquierda } : {}),
          ...(logoDerecha ? { derechaPath: logoDerecha } : {})
        };
      }

      const respuesta = await clienteApi.enviar<{ preferenciasPdf: Docente['preferenciasPdf'] }>('/autenticacion/preferencias/pdf', cuerpo);
      onDocenteActualizado({
        ...docente,
        preferenciasPdf: respuesta.preferenciasPdf
      });

      mostrarMensaje('Preferencias de PDF guardadas', 'ok', 'pdf');
      registrarAccionDocente('preferencias_pdf', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron guardar las preferencias de PDF');
      mostrarMensaje(msg, 'error', 'pdf');
      emitirRecuperacionSesion(error);
      registrarAccionDocente('preferencias_pdf', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRetencionParciales() {
    try {
      setGuardando(true);
      mostrarMensaje('');
      const respuesta = await clienteApi.enviar<{ retencionParcialesArchivadosMeses: 3 | 6 | 12 | null }>(
        '/autenticacion/preferencias/retencion-parciales',
        { meses: retencionParcialesMeses }
      );
      setRetencionParcialesMeses(respuesta.retencionParcialesArchivadosMeses);
      onDocenteActualizado({
        ...docente,
        retencionParcialesArchivadosMeses: respuesta.retencionParcialesArchivadosMeses
      });
      mostrarMensaje('Preferencia de retención guardada', 'ok', 'retencion');
      registrarAccionDocente('preferencia_retencion_parciales', true);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo guardar la preferencia de retención');
      mostrarMensaje(msg, 'error', 'retencion');
      emitirRecuperacionSesion(error);
      registrarAccionDocente('preferencia_retencion_parciales', false);
    } finally {
      setGuardando(false);
    }
  }

  function seleccionarLogoPdf(lado: 'izquierda' | 'derecha', archivo?: File): void {
    if (!archivo) return;
    setErroresLogosPdf((actuales) => ({ ...actuales, [lado]: '' }));
    mostrarMensaje('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setErroresLogosPdf((actuales) => ({ ...actuales, [lado]: 'La imagen debe ser PNG, JPG o WebP.' }));
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setErroresLogosPdf((actuales) => ({ ...actuales, [lado]: 'La imagen no puede superar 2 MB.' }));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const dataUrl = String(lector.result ?? '');
      if (!esDataUrlImagen(dataUrl)) {
        if (lado === 'izquierda') setLogoIzqPdfNombre('');
        else setLogoDerPdfNombre('');
        setErroresLogosPdf((actuales) => ({ ...actuales, [lado]: 'No se pudo leer la imagen seleccionada.' }));
        return;
      }
      if (lado === 'izquierda') {
        setLogoIzqPdf(dataUrl);
        setLogoIzqPdfPath('');
        setLogoIzqPdfNombre(archivo.name);
      } else {
        setLogoDerPdf(dataUrl);
        setLogoDerPdfPath('');
        setLogoDerPdfNombre(archivo.name);
      }
      mostrarMensaje('');
    };
    lector.onerror = () => {
      if (lado === 'izquierda') setLogoIzqPdfNombre('');
      else setLogoDerPdfNombre('');
      setErroresLogosPdf((actuales) => ({ ...actuales, [lado]: 'No se pudo leer la imagen seleccionada.' }));
    };
    lector.readAsDataURL(archivo);
  }

  async function regenerarAccesosDirectos() {
    try {
      const inicio = Date.now();
      setRegenerandoAccesos(true);
      mostrarMensaje('');
      await clienteApi.enviar('/autenticacion/accesos-directos/regenerar', {});
      mostrarMensaje('Accesos directos de EvaluaPro y Hub actualizados en Escritorio y Menú Inicio.', 'ok', 'accesos');
      registrarAccionDocente('regenerar_accesos_directos', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron regenerar los accesos directos');
      mostrarMensaje(msg, 'error', 'accesos');
      emitirRecuperacionSesion(error);
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
      mostrarMensaje('');

      const res = await fetch('https://api.github.com/repos/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const tagRemoto = String(data.tag_name || '').replace(/^v/i, '').trim();
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const exeAsset = assets.find((a: Record<string, unknown>) => String(a.name || '').endsWith('.exe')) as Record<string, unknown> | undefined;
      const shaAsset = assets.find((a: Record<string, unknown>) => String(a.name || '').endsWith('.exe.sha256')) as Record<string, unknown> | undefined;

      if (tagRemoto && compararVersiones(tagRemoto, versionActual) > 0) {
        setResultadoActualizacion({
          estado: 'disponible',
          versionDisponible: `v${tagRemoto}`,
          urlDescarga: String(exeAsset?.browser_download_url || data.html_url || ''),
          urlChecksum: typeof shaAsset?.browser_download_url === 'string' ? shaAsset.browser_download_url : undefined,
          urlNotas: String(data.html_url || ''),
          mensaje: `¡Nueva versión estable v${tagRemoto} disponible!`
        });
        registrarAccionDocente('buscar_actualizaciones_disponible', true, Date.now() - inicio);
      } else {
        setResultadoActualizacion({
          estado: 'al_dia',
          versionDisponible: `v${versionActual}`,
          mensaje: `El sistema se encuentra en la versión oficial estable más reciente (v${versionActual}).`
        });
        registrarAccionDocente('buscar_actualizaciones_al_dia', true, Date.now() - inicio);
      }
    } catch {
      const mensajeError = `No se pudo comprobar si hay actualizaciones. La versión instalada v${versionActual} sigue activa; vuelve a intentarlo.`;
      setResultadoActualizacion({
        estado: 'error',
        versionDisponible: `v${versionActual}`,
        mensaje: mensajeError
      });
    } finally {
      setBuscandoActualizaciones(false);
    }
  }

  const cargarPapelera = useCallback(async () => {
    if (!esAdmin || !esDev) return;
    setCargandoPapelera(true);
    setErrorCargaPapelera(false);
    try {
      const respuesta = await clienteApi.obtener<{ items: Array<Record<string, unknown>> }>('/papelera?limite=60');
      setPapelera(respuesta.items ?? []);
      setPapeleraCargada(true);
    } catch (error) {
      setErrorCargaPapelera(true);
      const msg = mensajeDeError(error, 'No se pudo cargar la papelera');
      mostrarMensaje(msg, 'error', 'papelera');
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
      mostrarMensaje(msg, 'error', 'papelera');
      emitirRecuperacionSesion(error);
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
          <div className="icono-seccion-orb banco-panel__icon-orb cuenta-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <Icono nombre="cuenta" size={28} />
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
        <div className="banco-header-kpis" role="group" aria-label="Resumen de la cuenta docente">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Rol institucional activo">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <Icono nombre="docente" size={16} />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm">{esAdmin ? 'Admin' : 'Docente'}</span>
            <span className="banco-mini-kpi__lbl">Rol</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Estado de vinculación con Google">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="classroom" size={16} /></span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${docente.tieneGoogle ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--slate"}`}>
              {docente.tieneGoogle ? 'Vinculado' : 'Sin vínculo'}
            </span>
            <span className="banco-mini-kpi__lbl">Google</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Seguridad de contraseña local">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="candado" size={16} /></span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${docente.tieneContrasena ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--amber"}`}>
              {docente.tieneContrasena ? 'Definida' : 'No definida'}
            </span>
            <span className="banco-mini-kpi__lbl">Contraseña</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Encabezado institucional configurado">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="pdf" size={16} /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm banco-mini-kpi__num--sky">
              {institucionPdf.trim() ? 'Personalizado' : 'Predeterminado'}
            </span>
            <span className="banco-mini-kpi__lbl">Membrete PDF</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Servicio de correo saliente para notificaciones (SMTP)">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <Icono nombre="correo" size={16} />
            </span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${smtpDisponible ? "banco-mini-kpi__num--emerald" : "banco-mini-kpi__num--slate"}`}>
              {smtpDisponible ? 'Disponible' : 'No configurado'}
            </span>
            <span className="banco-mini-kpi__lbl">Avisos por correo</span>
          </div>
        </div>
      </div>

      <nav className="cuenta-subpanel cuenta-seccion-nav" aria-label="Secciones de Cuenta">
        <p className="nota cuenta-seccion-nav__titulo">Ir directamente a</p>
        <div className="cuenta-seccion-nav__links">
          <a className="btn btn-secundario" href={`#${anclas.foto}`}>Foto de perfil</a>
          <a className="btn btn-secundario" href={`#${anclas.sincronizacion}`}>Sincronización</a>
          <a className="btn btn-secundario" href={`#${anclas.seguridad}`}>Seguridad</a>
          <a className="btn btn-secundario" href={`#${anclas.pdf}`}>PDF institucional</a>
          <a className="btn btn-secundario" href={`#${anclas.retencion}`}>Retención</a>
          <a className="btn btn-secundario" href={`#${anclas.actualizaciones}`}>Actualizaciones</a>
          <a className="btn btn-secundario" href={`#${anclas.accesos}`}>Accesos del escritorio</a>
          {esAdmin && esDev && <a className="btn btn-secundario" href={`#${anclas.papelera}`}>Papelera</a>}
        </div>
      </nav>

      <section className="cuenta-foto-perfil" aria-labelledby={anclas.foto}>
        <div className="cuenta-foto-perfil__avatar" aria-hidden="true">
          {mostrarFotoCuenta
            ? <img src={fotoPerfilCuenta} alt="" onError={() => setFotoCuentaFallida(true)} />
            : fotoPerfilLocal && !fotoLocalFallida
              ? <img src={fotoPerfilLocal} alt="" onError={() => setFotoLocalFallida(true)} />
              : <Icono nombre="cuenta" size={30} />}
        </div>
        <div className="cuenta-foto-perfil__contenido">
          <h3 id={anclas.foto} tabIndex={-1}>Foto de perfil</h3>
          <p className="nota">{mensajeEstadoFotoPerfil}</p>
          {(!tieneFotoPerfilCuenta || fotoCuentaFallida) && (
            <div className="cuenta-foto-perfil__acciones">
              <label className="chip cuenta-foto-perfil__cargar">
                <Icono nombre="publicar" size={16} />
                <span>{fotoPerfilLocal ? 'Cambiar foto' : 'Agregar foto'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-invalid={errorFotoPerfil ? 'true' : undefined}
                  aria-describedby={`${ayudaFotoPerfilId}${errorFotoPerfil ? ` ${errorFotoPerfilId}` : ''}`}
                  onChange={(event) => {
                    seleccionarFotoPerfil(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {errorFotoPerfil && <span className="ayuda error" id={errorFotoPerfilId} role="alert">{errorFotoPerfil}</span>}
              {fotoPerfilLocal && (
                <button type="button" className="chip" onClick={retirarFotoPerfil}>Quitar foto</button>
              )}
              <span className="nota" id={ayudaFotoPerfilId}>PNG, JPG o WebP · máximo 1 MB</span>
            </div>
          )}
          {mensajeEnContexto('foto')}
        </div>
      </section>

      {/* 2. Bento Visual Guide */}
      <GuiaCuentaVisual />

      {/* 3. Configuracion de sincronizacion */}
      <SeccionConfiguracionSincronizacion
        headingId={anclas.sincronizacion}
        estado={estadoLease}
        errorConsulta={errorConsultaLease}
        onReintentarConsulta={onReintentarConsultaLease}
        onConfigurar={onConfigurarCarpeta}
      />

      {/* 4. Seguridad de Acceso */}
      <div className="cuenta-subpanel cuenta-seguridad anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Seguridad y credenciales</span>
            </span>
            <h3 id={anclas.seguridad} tabIndex={-1} className="entregas-title-heading">
              <Icono nombre="ok" /> Seguridad de acceso
            </h3>
            <p className="nota">Gestiona tu contraseña local y las cuentas vinculadas para acceder a EvaluaPro.</p>
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
            El acceso está configurado solo con Google; no puedes establecer una contraseña local en esta instalación.
          </InlineMensaje>
        )}

        {mensajeReautenticacionNoDisponible && (
          <InlineMensaje tipo="info">{mensajeReautenticacionNoDisponible}</InlineMensaje>
        )}

        {Boolean(!googleOnly && docente.tieneGoogle && googleDisponible) && (
          <div className="auth-google auth-google--mb">
            <p className="nota">Vuelve a autenticarte con Google para confirmar el cambio de contraseña.</p>
            <GoogleLogin
              width={anchoGoogle}
              onSuccess={(cred) => {
                const credencialGoogle = cred.credential;
                if (!credencialGoogle) {
                  mostrarMensaje('No se recibió la credencial de Google.', 'error', 'seguridad');
                  return;
                }
                setCredentialReauth(credencialGoogle);
                mostrarMensaje('Reautenticación con Google lista.', 'info', 'seguridad');
              }}
              onError={() => mostrarMensaje('No se pudo reautenticar con Google.', 'error', 'seguridad')}
            />
            <div className="acciones acciones--mt">
              <button type="button" className="chip" disabled={!credentialReauth} onClick={() => setCredentialReauth(null)}>
                Limpiar verificación
              </button>
            </div>
          </div>
        )}

        {puedeCambiarContrasena && (
          <form
            id={formularioContrasenaId}
            className="cuenta-seguridad__form"
            aria-label="Cambiar contraseña"
            onSubmit={(event) => {
              event.preventDefault();
              if (puedeGuardar && !guardando) void guardar();
            }}
          >
            {docente.tieneContrasena && (
              <div className="campo">
                <label htmlFor={`cuenta-contrasena-actual-${id}`}>Contraseña actual (obligatoria)</label>
                <div className="cuenta-seguridad__password-control" onBlur={(event) => ocultarContrasenaAlSalir(event, 'actual')}>
                  <input
                    id={`cuenta-contrasena-actual-${id}`}
                    type={contrasenasVisibles.actual ? 'text' : 'password'}
                    required
                    value={contrasenaActual}
                    onChange={(event) => setContrasenaActual(event.target.value)}
                    autoComplete="current-password"
                    aria-describedby={ayudaContrasenaActualId}
                  />
                  <button
                    type="button"
                    className="cuenta-seguridad__password-toggle"
                    aria-label={`${contrasenasVisibles.actual ? 'Ocultar' : 'Mostrar'} contraseña actual`}
                    aria-controls={`cuenta-contrasena-actual-${id}`}
                    aria-pressed={contrasenasVisibles.actual}
                    onClick={() => setContrasenasVisibles((actual) => ({ ...actual, actual: !actual.actual }))}
                  ><Icono nombre={contrasenasVisibles.actual ? 'ojoCerrado' : 'ojo'} size={18} /></button>
                </div>
                <span className="ayuda" id={ayudaContrasenaActualId}>Se necesita para confirmar el cambio.</span>
              </div>
            )}

            <div className="campo">
              <label htmlFor={`cuenta-contrasena-nueva-${id}`}>Nueva contraseña</label>
              <div className="cuenta-seguridad__password-control" onBlur={(event) => ocultarContrasenaAlSalir(event, 'nueva')}>
                <input
                  id={`cuenta-contrasena-nueva-${id}`}
                  type={contrasenasVisibles.nueva ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={contrasenaNueva}
                  onChange={(event) => setContrasenaNueva(event.target.value)}
                  autoComplete="new-password"
                  aria-invalid={contrasenaNuevaCorta || undefined}
                  aria-describedby={`${ayudaContrasenaNuevaId}${contrasenaNuevaCorta ? ` ${errorContrasenaNuevaId}` : ''}`}
                />
                <button
                  type="button"
                  className="cuenta-seguridad__password-toggle"
                  aria-label={`${contrasenasVisibles.nueva ? 'Ocultar' : 'Mostrar'} nueva contraseña`}
                  aria-controls={`cuenta-contrasena-nueva-${id}`}
                  aria-pressed={contrasenasVisibles.nueva}
                  onClick={() => setContrasenasVisibles((actual) => ({ ...actual, nueva: !actual.nueva }))}
                ><Icono nombre={contrasenasVisibles.nueva ? 'ojoCerrado' : 'ojo'} size={18} /></button>
              </div>
              <span className="ayuda" id={ayudaContrasenaNuevaId}>Mínimo 8 caracteres.</span>
              {contrasenaNuevaCorta && <span className="ayuda error" id={errorContrasenaNuevaId}>La contraseña nueva es demasiado corta. Agrega caracteres hasta cumplir el mínimo.</span>}
            </div>

            <div className="campo">
              <label htmlFor={`cuenta-contrasena-confirmacion-input-${id}`}>Confirmar contraseña</label>
              <div className="cuenta-seguridad__password-control" onBlur={(event) => ocultarContrasenaAlSalir(event, 'confirmacion')}>
                <input
                  id={`cuenta-contrasena-confirmacion-input-${id}`}
                  type={contrasenasVisibles.confirmacion ? 'text' : 'password'}
                  required
                  value={contrasenaNueva2}
                  onChange={(event) => setContrasenaNueva2(event.target.value)}
                  autoComplete="new-password"
                  aria-invalid={contrasenasNoCoinciden || undefined}
                  aria-describedby={`${ayudaConfirmacionContrasenaId}${contrasenasNoCoinciden ? ` ${errorConfirmacionId}` : ''}`}
                />
                <button
                  type="button"
                  className="cuenta-seguridad__password-toggle"
                  aria-label={`${contrasenasVisibles.confirmacion ? 'Ocultar' : 'Mostrar'} confirmación de contraseña`}
                  aria-controls={`cuenta-contrasena-confirmacion-input-${id}`}
                  aria-pressed={contrasenasVisibles.confirmacion}
                  onClick={() => setContrasenasVisibles((actual) => ({ ...actual, confirmacion: !actual.confirmacion }))}
                ><Icono nombre={contrasenasVisibles.confirmacion ? 'ojoCerrado' : 'ojo'} size={18} /></button>
              </div>
              <span className="ayuda" id={ayudaConfirmacionContrasenaId}>Repite la nueva contraseña para confirmar el cambio.</span>
              {contrasenasNoCoinciden && <span className="ayuda error" id={errorConfirmacionId}>Las contraseñas no coinciden. Revísalas.</span>}
            </div>
            <div className="acciones acciones--mt">
              <Boton type="submit" icono={<Icono nombre="ok" />} cargando={guardando} disabled={!puedeGuardar}>
                {guardando ? 'Guardando…' : 'Guardar contraseña'}
              </Boton>
            </div>
          </form>
        )}
        {mensajeEnContexto('seguridad')}
      </div>

      {/* 4. PDF Institucional */}
      <div className="cuenta-subpanel cuenta-pdf anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Identidad gráfica y PDF</span>
            </span>
            <h3 id={anclas.pdf} tabIndex={-1} className="entregas-title-heading">
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
            <span>Institución</span>
            <input value={institucionPdf} onChange={(e) => setInstitucionPdf(e.target.value)} placeholder="Nombre de la institución" />
          </label>
          <label className="campo">
            <span>Lema</span>
            <input value={lemaPdf} onChange={(e) => setLemaPdf(e.target.value)} placeholder="Lema del PDF" />
          </label>
        </div>

        <p className="nota cuenta-pdf__pages-help" id={ayudaPaginasPdfId}>
          Número par entre 2 y 50. Cada hoja impresa cuenta con dos páginas.
        </p>
        <div className="grid grid--3">
          {([
            ['parcial', 'Parcial'],
            ['global', 'Global'],
            ['extraordinario', 'Extraordinario']
          ] as const).map(([tipo, etiqueta]) => {
            const campoId = `cuenta-paginas-${tipo}-${id}`;
            const etiquetaCampoId = `${campoId}-etiqueta`;
            const resumenId = `${campoId}-resumen`;
            const errorId = `${campoId}-error`;
            const paginas = paginasPorTipo[tipo];
            const valido = esNumeroParEntre2y50(paginas);
            const hojas = Number(paginas) / 2;
            return (
              <label className="campo" key={tipo}>
                <span id={etiquetaCampoId}>Páginas predeterminadas · {etiqueta}</span>
                <input
                  id={campoId}
                  type="number"
                  min={2}
                  max={50}
                  step={2}
                  value={paginas}
                  onChange={(event) => setPaginasPorTipo((actual) => ({ ...actual, [tipo]: event.target.value }))}
                  aria-labelledby={etiquetaCampoId}
                  aria-invalid={!valido || undefined}
                  aria-describedby={`${ayudaPaginasPdfId}${valido ? ` ${resumenId}` : ` ${errorId}`}`}
                />
                {!valido && <span className="ayuda error" id={errorId}>Escribe un número par entre 2 y 50.</span>}
                {valido && <span className="nota" id={resumenId}>{paginas} páginas = {hojas} {hojas === 1 ? 'hoja impresa' : 'hojas impresas'} (ambas caras).</span>}
              </label>
            );
          })}
        </div>

        <div className="grid grid--2 cuenta-pdf__logos">
          <div className="cuenta-pdf__logo-field">
            <div className="campo cuenta-file-picker">
              <span id={logoIzqPdfLabelId}>Imagen institucional izquierda</span>
              <input
                id={logoIzqPdfId}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-labelledby={logoIzqPdfLabelId}
                aria-invalid={erroresLogosPdf.izquierda ? 'true' : undefined}
                aria-describedby={`${ayudaLogosPdfId} ${logoIzqPdfStatusId}${erroresLogosPdf.izquierda ? ` ${errorLogoIzqPdfId}` : ''}`}
                onChange={(event) => {
                  const archivo = event.currentTarget.files?.[0];
                  if (!archivo) return;
                  seleccionarLogoPdf('izquierda', archivo);
                  event.currentTarget.value = '';
                }}
              />
              <label className="cuenta-file-picker__control" htmlFor={logoIzqPdfId}>
                <span className="cuenta-file-picker__button">Elegir imagen</span>
                <span id={logoIzqPdfStatusId} className="cuenta-file-picker__name" role="status" aria-live="polite">
                  {logoIzqPdfNombre ? `Archivo: ${logoIzqPdfNombre}` : logoIzqPdf ? 'Imagen cargada en preferencias' : logoIzqPdfPath ? 'Se usará la ruta alternativa' : 'Sin archivo seleccionado (opcional)'}
                </span>
              </label>
            </div>
            {erroresLogosPdf.izquierda && <small className="ayuda error" id={errorLogoIzqPdfId} role="alert">{erroresLogosPdf.izquierda}</small>}
            <label className="campo">
              <span>Ruta alternativa del logo izquierdo (opcional)</span>
              <input value={logoIzqPdfPath} onChange={(e) => { setLogoIzqPdfPath(e.target.value); setLogoIzqPdf(''); setLogoIzqPdfNombre(''); }} placeholder="logos/logo_cuh.png" />
            </label>
            {logoIzqPdf && <img className="cuenta-pdf__logo-preview" src={logoIzqPdf} alt="Vista previa del logo izquierdo" />}
          </div>
          <div className="cuenta-pdf__logo-field">
            <div className="campo cuenta-file-picker">
              <span id={logoDerPdfLabelId}>Imagen institucional derecha</span>
              <input
                id={logoDerPdfId}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-labelledby={logoDerPdfLabelId}
                aria-invalid={erroresLogosPdf.derecha ? 'true' : undefined}
                aria-describedby={`${ayudaLogosPdfId} ${logoDerPdfStatusId}${erroresLogosPdf.derecha ? ` ${errorLogoDerPdfId}` : ''}`}
                onChange={(event) => {
                  const archivo = event.currentTarget.files?.[0];
                  if (!archivo) return;
                  seleccionarLogoPdf('derecha', archivo);
                  event.currentTarget.value = '';
                }}
              />
              <label className="cuenta-file-picker__control" htmlFor={logoDerPdfId}>
                <span className="cuenta-file-picker__button">Elegir imagen</span>
                <span id={logoDerPdfStatusId} className="cuenta-file-picker__name" role="status" aria-live="polite">
                  {logoDerPdfNombre ? `Archivo: ${logoDerPdfNombre}` : logoDerPdf ? 'Imagen cargada en preferencias' : logoDerPdfPath ? 'Se usará la ruta alternativa' : 'Sin archivo seleccionado (opcional)'}
                </span>
              </label>
            </div>
            {erroresLogosPdf.derecha && <small className="ayuda error" id={errorLogoDerPdfId} role="alert">{erroresLogosPdf.derecha}</small>}
            <label className="campo">
              <span>Ruta alternativa del logo derecho (opcional)</span>
              <input value={logoDerPdfPath} onChange={(e) => { setLogoDerPdfPath(e.target.value); setLogoDerPdf(''); setLogoDerPdfNombre(''); }} placeholder="logos/logo_sys.png" />
            </label>
            {logoDerPdf && <img className="cuenta-pdf__logo-preview" src={logoDerPdf} alt="Vista previa del logo derecho" />}
          </div>
        </div>

        <p className="nota cuenta-pdf__logo-help" id={ayudaLogosPdfId}>PNG, JPG o WebP · máximo 2 MB por imagen. Estas imágenes se usarán automáticamente como logos predeterminados en nuevos exámenes.</p>

        <div className="acciones acciones--mt">
          <Boton onClick={guardarPreferenciasPdf} disabled={guardando || !paginasPorTipoValidas}>
            Guardar PDF
          </Boton>
        </div>
        {mensajeEnContexto('pdf')}
      </div>

      <div className="cuenta-subpanel cuenta-retencion anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Historial de materias</span>
            </span>
            <h3 id={anclas.retencion} tabIndex={-1} className="entregas-title-heading">
              <Icono nombre="pdf" /> Retención de parciales archivados
            </h3>
            <p className="nota" id={retencionPdfAyudaId}>Por defecto, los PDF de parciales archivados se conservan siempre. Si eliges 3, 6 o 12 meses, se eliminan solo esos PDF al vencer el plazo; el historial académico, las calificaciones y los demás exámenes permanecen.</p>
          </div>
        </div>
        <div className="grid grid--2">
          <label className="campo">
            <span id={retencionPdfEtiquetaId}>Tiempo de conservación de los PDF de parciales archivados</span>
            <select
              value={retencionParcialesMeses ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setRetencionParcialesMeses(value === '' ? null : Number(value) as 3 | 6 | 12);
              }}
              aria-labelledby={retencionPdfEtiquetaId}
              aria-describedby={retencionPdfAyudaId}
            >
              <option value="">Conservar siempre</option>
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">1 año</option>
            </select>
          </label>
        </div>
        <div className="acciones acciones--mt">
          <Boton onClick={guardarRetencionParciales} disabled={guardando}>
            Guardar retención
          </Boton>
        </div>
        {mensajeEnContexto('retencion')}
      </div>

      {/* 5. Actualizaciones de EvaluaPro e Installer Hub */}
      <div className="cuenta-subpanel cuenta-actualizaciones anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill banco-section-pill--sky">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Mantenimiento y actualizaciones</span>
            </span>
            <h3 id={anclas.actualizaciones} tabIndex={-1} className="entregas-title-heading">
              <Icono nombre="recargar" /> Buscar actualizaciones de EvaluaPro
            </h3>
            <p className="nota">
              Consulta la release pública y abre sus descargas y notas. Esta pantalla no instala la actualización, verifica el archivo ni crea un respaldo.
            </p>
          </div>
          <div className="banco-section-side-meta">
            <span className="banco-counter-tag banco-counter-tag--emerald">v{versionActual} Estable</span>
          </div>
        </div>

        <div className="grid grid--2">
          <div className="item-glass">
            <div className="texto-base">
                <strong>Versión instalada</strong>
            </div>
            <div className="nota">
              EvaluaPro <strong>v{versionActual} Estable</strong> · Canal Oficial GitHub Releases
            </div>
          </div>
          <div className="item-glass">
            <div className="texto-base">
                <strong>Alcance de esta pantalla</strong>
            </div>
            <div className="nota">
                Consulta GitHub Releases y enlaza al instalador; la instalación se realiza por separado con Installer Hub.
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
                      {resultadoActualizacion.mensaje}
                    </strong>
                    <div className="nota">
                      {resultadoActualizacion.urlChecksum
                        ? 'La release publica un archivo de checksum SHA-256. Ábrelo para verificar el instalador antes de ejecutarlo.'
                        : 'La release no publica un archivo .sha256 para este instalador. Revisa las instrucciones de instalación antes de ejecutarlo.'}
                    </div>
                  </div>
                  <p className="nota">Los enlaces externos abren en una pestaña o ventana nueva.</p>
                  <div className="acciones">
                    {resultadoActualizacion.urlDescarga && (
                      <a
                        href={resultadoActualizacion.urlDescarga}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Descargar actualización oficial (se abre en una pestaña o ventana nueva)"
                        className="btn btn-primary"
                      >
                        <Icono nombre="descargar" /> Descargar actualización oficial
                      </a>
                    )}
                    {resultadoActualizacion.urlNotas && (
                      <a
                        href={resultadoActualizacion.urlNotas}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Ver novedades (se abre en una pestaña o ventana nueva)"
                        className="btn btn-secundario"
                      >
                        Ver novedades
                      </a>
                    )}
                    {resultadoActualizacion.urlChecksum && (
                      <a
                        href={resultadoActualizacion.urlChecksum}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Ver checksum SHA-256 (se abre en una pestaña o ventana nueva)"
                        className="btn btn-secundario"
                      >
                        Ver checksum SHA-256
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <InlineMensaje tipo={resultadoActualizacion.estado === 'error' ? 'error' : 'ok'}>
                {resultadoActualizacion.mensaje}
              </InlineMensaje>
            )}
          </div>
        )}

        <div className="acciones acciones--mt">
          <span
            className="sr-only"
            role="status"
            aria-label="Estado de búsqueda de actualizaciones"
            aria-atomic="true"
          >
            {buscandoActualizaciones ? 'Consultando actualizaciones en GitHub Releases.' : ''}
          </span>
          <Boton
            type="button"
            variante="primario"
            icono={<Icono nombre="buscar" />}
            cargando={buscandoActualizaciones}
            disabled={buscandoActualizaciones}
            onClick={verificarActualizaciones}
          >
            {buscandoActualizaciones
              ? 'Consultando releases...'
              : resultadoActualizacion?.estado === 'error' ? 'Reintentar búsqueda' : 'Buscar actualizaciones ahora'}
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
            <h3 id={anclas.accesos} tabIndex={-1} className="entregas-title-heading">
              <Icono nombre="recargar" /> Accesos del escritorio
            </h3>
            <p className="nota">Reconstruye los accesos directos de EvaluaPro y Hub en Escritorio y Menú Inicio, y solicita a Windows actualizar sus iconos.</p>
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
        {mensajeEnContexto('accesos')}
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
              <h3 id={anclas.papelera} tabIndex={-1} className="entregas-title-heading">
                <Icono nombre="info" /> Papelera (dev)
              </h3>
              <p className="nota">Los elementos eliminados se conservan 45 días antes de purgarse permanentemente.</p>
            </div>
            <div className="banco-section-side-meta">
              <span className="banco-counter-tag">
                {!papeleraCargada && cargandoPapelera
                  ? 'Consultando papelera…'
                  : !papeleraCargada
                    ? 'No disponible'
                    : `${papelera.length} elementos${cargandoPapelera || errorCargaPapelera ? ' · última carga' : ''}`}
              </span>
            </div>
          </div>

          <div className="acciones acciones--mt">
            <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoPapelera} onClick={cargarPapelera}>
              {cargandoPapelera ? 'Cargando...' : 'Actualizar papelera'}
            </Boton>
          </div>

          {mensajeEnContexto('papelera')}
          {errorCargaPapelera && papeleraCargada && (
            <InlineMensaje tipo="info">No se pudo actualizar; se conservan los elementos de la última consulta correcta.</InlineMensaje>
          )}
          {!cargandoPapelera && papeleraCargada && !errorCargaPapelera && papelera.length === 0 && (
            <InlineMensaje tipo="info">No hay elementos en papelera.</InlineMensaje>
          )}
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

      {mensajeEnContexto('general')}
    </div>
  );
}
