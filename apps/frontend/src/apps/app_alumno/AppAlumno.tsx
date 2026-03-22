/**
 * App alumno: consulta de resultados en la nube.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearClientePortal,
  guardarTokenAlumno,
  limpiarTokenAlumno,
  obtenerTokenAlumno
} from '../../servicios_api/clientePortal';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, IlustracionSinResultados, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { CampoTexto } from '../../ui/ux/componentes/CampoTexto';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { HelperPanel } from '../../ui/ux/componentes/HelperPanel';
import { obtenerSessionId } from '../../ui/ux/sesion';
import { TemaBoton } from '../../tema/TemaBoton';
import { abrirVentanaVersion, obtenerVersionApp } from '../../ui/version/versionInfo';
import {
  accionCerrarSesion,
  accionToastSesionParaError,
  mensajeUsuarioDeErrorConSugerencia,
  onSesionInvalidada
} from '../../servicios_api/clienteComun';

const clientePortal = crearClientePortal();
const basePortal = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:8080/api/portal';

type Resultado = {
  folio: string;
  tipoExamen: string;
  totalReactivos?: number;
  aciertos?: number;
  calificacionExamenFinalTexto: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
  versionPolitica?: number;
  bloqueContinuaDecimal?: number;
  bloqueExamenesDecimal?: number;
  finalDecimal?: number;
  finalRedondeada?: number;
  respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  comparativaRespuestas?: Array<{
    numeroPregunta: number;
    correcta: string | null;
    detectada: string | null;
    coincide: boolean;
    confianza?: number;
  }>;
  omrCapturas?: Array<{
    numeroPagina: number;
    formato: 'jpg' | 'jpeg' | 'png' | 'webp';
    imagenBase64: string;
    calidad?: number;
    sugerencias?: string[];
  }>;
  omrAuditoria?: {
    estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    revisionConfirmada?: boolean;
    calidadPagina?: number;
    confianzaPromedioPagina?: number;
    ratioAmbiguas?: number;
    motivosRevision?: string[];
  };
};

type PerfilAlumno = {
  matricula?: string;
  nombreCompleto?: string;
  grupo?: string;
};

type MateriaAlumno = {
  materiaId?: string;
  nombre?: string;
  estado?: string;
};

type AgendaAlumno = {
  agendaId?: string;
  titulo?: string;
  descripcion?: string;
  fecha?: string;
  tipo?: string;
};

type AvisoAlumno = {
  avisoId?: string;
  titulo?: string;
  mensaje?: string;
  severidad?: string;
  publicadoEn?: string;
};

type HistorialAlumno = {
  historialId?: string;
  folio?: string;
  tipoExamen?: string;
  calificacionTexto?: string;
  fecha?: string;
};

export function AppAlumno() {
  const version = obtenerVersionApp();
  const [token, setToken] = useState(() => obtenerTokenAlumno());
  const [codigo, setCodigo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [detalleAbiertoFolio, setDetalleAbiertoFolio] = useState<string | null>(null);
  const [detallesPorFolio, setDetallesPorFolio] = useState<Record<string, Resultado>>({});
  const [cargandoDetallePorFolio, setCargandoDetallePorFolio] = useState<Record<string, boolean>>({});
  const [errorDetallePorFolio, setErrorDetallePorFolio] = useState<Record<string, string>>({});
  const [seleccionRevisionPorFolio, setSeleccionRevisionPorFolio] = useState<Record<string, Record<number, boolean>>>({});
  const [comentarioRevisionPorFolio, setComentarioRevisionPorFolio] = useState<Record<string, string>>({});
  const [conformidadPorFolio, setConformidadPorFolio] = useState<Record<string, boolean>>({});
  const [cargando, setCargando] = useState(false);
  const [perfil, setPerfil] = useState<PerfilAlumno | null>(null);
  const [materias, setMaterias] = useState<MateriaAlumno[]>([]);
  const [agenda, setAgenda] = useState<AgendaAlumno[]>([]);
  const [avisos, setAvisos] = useState<AvisoAlumno[]>([]);
  const [historial, setHistorial] = useState<HistorialAlumno[]>([]);
  const intentosFallidosRef = useRef(0);
  const [cooldownHasta, setCooldownHasta] = useState(0);

  const obtenerSesionId = useCallback(() => obtenerSessionId('sesionAlumnoId'), []);

  const cerrarSesion = useCallback(() => {
    limpiarTokenAlumno();
    setToken(null);
    setResultados([]);
    setMensaje('');
    emitToast({ level: 'info', title: 'Sesion', message: 'Sesion cerrada', durationMs: 2200 });
    void clientePortal.registrarEventosUso({
      eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'logout', exito: true }]
    });
  }, [obtenerSesionId]);

  useEffect(() => {
    return onSesionInvalidada((tipo) => {
      if (tipo !== 'alumno') return;
      cerrarSesion();
    });
  }, [cerrarSesion]);

  function mensajeDeError(error: unknown, fallback: string) {
    return mensajeUsuarioDeErrorConSugerencia(error, fallback);
  }

  async function ingresar() {
    if (Date.now() < cooldownHasta) {
      const s = Math.max(1, Math.ceil((cooldownHasta - Date.now()) / 1000));
      const msg = `Espera ${s}s antes de intentar de nuevo.`;
      setMensaje(msg);
      emitToast({ level: 'warn', title: 'Espera un momento', message: msg, durationMs: Math.min(5200, 800 + s * 250) });
      return;
    }
    try {
      const inicio = Date.now();
      setCargando(true);
      setMensaje('');
      const respuesta = await clientePortal.enviar<{ token: string }>('/ingresar', { codigo, matricula });
      guardarTokenAlumno(respuesta.token);
      setToken(respuesta.token);
      intentosFallidosRef.current = 0;
      setCooldownHasta(0);
      emitToast({ level: 'ok', title: 'Bienvenido', message: 'Sesion iniciada', durationMs: 2200 });
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'login',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
      await cargarResultados();
    } catch (error) {
      const nuevo = intentosFallidosRef.current + 1;
      intentosFallidosRef.current = nuevo;
      if (nuevo >= 3) {
        const base = 15_000;
        const extra = Math.min(120_000, base * Math.pow(2, Math.min(4, nuevo - 3)));
        setCooldownHasta(Date.now() + extra);
      }
      const msg = mensajeDeError(error, 'No se pudo ingresar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo ingresar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'login', exito: false }]
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarResultados() {
    try {
      const inicio = Date.now();
      setCargando(true);
      const respuesta = await clientePortal.obtener<{ resultados: Resultado[] }>('/resultados');
      setResultados(respuesta.resultados);
      const detallesIniciales = (respuesta.resultados || []).reduce(
        (acumulado, resultado) => {
          const tieneDetalle = Array.isArray(resultado.comparativaRespuestas) || Boolean(resultado.omrAuditoria);
          if (tieneDetalle && resultado.folio) acumulado[resultado.folio] = resultado;
          return acumulado;
        },
        {} as Record<string, Resultado>
      );
      if (Object.keys(detallesIniciales).length > 0) {
        setDetallesPorFolio((prev) => ({ ...prev, ...detallesIniciales }));
      }
      await cargarContextoAcademico();
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'cargar_resultados',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar resultados');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudieron cargar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'cargar_resultados', exito: false }]
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarContextoAcademico() {
    try {
      const [perfilResp, materiasResp, agendaResp, avisosResp, historialResp] = await Promise.all([
        clientePortal.obtener<{ ok: boolean; data?: { perfil?: PerfilAlumno | null } }>('/perfil'),
        clientePortal.obtener<{ ok: boolean; data?: { materias?: MateriaAlumno[] } }>('/materias'),
        clientePortal.obtener<{ ok: boolean; data?: { agenda?: AgendaAlumno[] } }>('/agenda'),
        clientePortal.obtener<{ ok: boolean; data?: { avisos?: AvisoAlumno[] } }>('/avisos'),
        clientePortal.obtener<{ ok: boolean; data?: { historial?: HistorialAlumno[] } }>('/historial')
      ]);
      setPerfil((perfilResp?.data?.perfil ?? null) as PerfilAlumno | null);
      setMaterias(Array.isArray(materiasResp?.data?.materias) ? materiasResp.data.materias : []);
      setAgenda(Array.isArray(agendaResp?.data?.agenda) ? agendaResp.data.agenda.slice(0, 6) : []);
      setAvisos(Array.isArray(avisosResp?.data?.avisos) ? avisosResp.data.avisos.slice(0, 6) : []);
      setHistorial(Array.isArray(historialResp?.data?.historial) ? historialResp.data.historial.slice(0, 10) : []);
    } catch {
      // Best-effort: contexto académico no bloquea consulta principal.
    }
  }

  function estadoRevision(resultado: Resultado | undefined) {
    const estado = resultado?.omrAuditoria?.estadoAnalisis;
    const revisionConfirmada = Boolean(resultado?.omrAuditoria?.revisionConfirmada);
    if (!estado) return { clase: '', texto: 'Sin auditoria OMR' };
    if (estado === 'rechazado_calidad') return { clase: 'error', texto: 'OMR rechazado por calidad' };
    if (revisionConfirmada) return { clase: 'ok', texto: 'Revision manual confirmada' };
    if (estado === 'requiere_revision') return { clase: 'warning', texto: 'Pendiente de revision manual' };
    return { clase: 'ok', texto: 'OMR validado automaticamente' };
  }

  async function onToggleDetalle(folio: string) {
    if (!folio) return;
    if (detalleAbiertoFolio === folio) {
      setDetalleAbiertoFolio(null);
      return;
    }
    setDetalleAbiertoFolio(folio);
    if (detallesPorFolio[folio]) return;

    try {
      setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: true }));
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: '' }));
      const respuesta = await clientePortal.obtener<{ resultado: Resultado }>(`/resultados/${folio}`);
      if (respuesta?.resultado) {
        setDetallesPorFolio((prev) => ({ ...prev, [folio]: respuesta.resultado }));
      }
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el detalle del examen');
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: msg }));
      emitToast({
        level: 'error',
        title: 'Detalle no disponible',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
    } finally {
      setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: false }));
    }
  }

  async function solicitarRevision(folio: string) {
    const seleccion = seleccionRevisionPorFolio[folio] ?? {};
    const preguntas = Object.entries(seleccion)
      .filter(([, activa]) => Boolean(activa))
      .map(([numero]) => Number(numero))
      .filter((numero) => Number.isInteger(numero) && numero > 0);
    if (preguntas.length === 0) {
      emitToast({ level: 'warn', title: 'Sin selección', message: 'Marca al menos una pregunta para solicitar revisión.' });
      return;
    }
    const comentario = (comentarioRevisionPorFolio[folio] ?? '').trim();
    if (comentario.length < 12) {
      emitToast({
        level: 'warn',
        title: 'Comentario obligatorio',
        message: 'Explica brevemente el motivo de revisión (mínimo 12 caracteres).'
      });
      return;
    }
    try {
      await clientePortal.enviar('/solicitudes-revision', {
        folio,
        solicitudes: preguntas.map((numeroPregunta) => ({ numeroPregunta, comentario }))
      });
      emitToast({ level: 'ok', title: 'Solicitud enviada', message: 'Tu solicitud de revisión fue registrada.' });
    } catch (error) {
      emitToast({
        level: 'error',
        title: 'No se pudo enviar',
        message: mensajeDeError(error, 'No se pudo registrar la solicitud de revisión'),
        action: accionToastSesionParaError(error, 'alumno')
      });
    }
  }

  async function enviarConformidad(folio: string) {
    try {
      await clientePortal.enviar('/solicitudes-revision/conformidad', { folio, conformidad: true });
      setConformidadPorFolio((prev) => ({ ...prev, [folio]: true }));
      emitToast({ level: 'ok', title: 'Conformidad enviada', message: 'Se registró tu conformidad con resultados.' });
    } catch (error) {
      emitToast({
        level: 'error',
        title: 'No se pudo registrar conformidad',
        message: mensajeDeError(error, 'No se pudo registrar la conformidad'),
        action: accionToastSesionParaError(error, 'alumno')
      });
    }
  }

  const puedeIngresar = Boolean(codigo.trim() && matricula.trim());
  // Valida sin bloquear el flujo (hay códigos reales con '-' / '_' y longitudes variables).
  const codigoValido = !codigo.trim() || /^[a-zA-Z0-9_-]{3,24}$/.test(codigo.trim());
  const matriculaValida = !matricula.trim() || /^[A-Za-z0-9._-]{3,32}$/.test(matricula.trim());
  const cooldownActivo = Date.now() < cooldownHasta;

  return (
    <section className="card anim-entrada portal-alumno-shell">
      <div className="cabecera">
        <p className="eyebrow">
          <Icono nombre="alumno" /> Portal Alumno
        </p>
        <div className="cabecera__acciones">
          <button
            type="button"
            className="chip chip-version"
            title="Abrir información de versión"
            onClick={() => abrirVentanaVersion('alumno')}
          >
            v{version}
          </button>
          <TemaBoton />
          {token && (
            <button className="boton secundario" type="button" onClick={cerrarSesion}>
              <Icono nombre="salir" /> Salir
            </button>
          )}
        </div>
      </div>
      {!token && (
        <div className="auth-grid">
          <div className="auth-hero auth-hero--alumno">
            <p className="eyebrow">Acceso</p>
            <h2>
              <Icono nombre="alumno" /> Consulta de resultados
            </h2>
            {cooldownActivo && (
              <InlineMensaje tipo="info">Por seguridad, espera unos segundos antes de reintentar.</InlineMensaje>
            )}
            <p className="auth-subtitulo">Ingresa con el codigo de acceso que te compartio tu docente y tu matricula.</p>
            <ul className="auth-beneficios" aria-label="Beneficios">
              <li>
                <Icono nombre="ok" /> Consulta rapida y segura.
              </li>
              <li>
                <Icono nombre="pdf" /> Descarga tu PDF cuando este disponible.
              </li>
              <li>
                <Icono nombre="info" /> Si no aparece, intenta recargar.
              </li>
            </ul>
            <div className="portal-alumno-badges" aria-hidden="true">
              <span className="portal-alumno-badge"><Icono nombre="ok" /> Verificado</span>
              <span className="portal-alumno-badge"><Icono nombre="pdf" /> PDF</span>
              <span className="portal-alumno-badge"><Icono nombre="info" /> Historial</span>
            </div>
            <div className="auth-ilustracion" aria-hidden="true">
              <div className="auth-blob" />
              <div className="auth-blob auth-blob--2" />
            </div>
          </div>

          <div className="auth-form">
            {mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}
            {cargando && (
              <p className="mensaje" role="status">
                <Spinner /> Cargando…
              </p>
            )}

            <CampoTexto
              etiqueta="Codigo de acceso"
              value={codigo}
              onChange={(event) => {
                const limpio = event.target.value.replace(/\s+/g, '').toUpperCase();
                setCodigo(limpio);
              }}
              placeholder="ABC123"
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              error={!codigoValido && codigo.trim() ? 'Usa 3-24 caracteres (letras/numeros/guion/guion_bajo).' : undefined}
            />
            <CampoTexto
              etiqueta="Matricula"
              value={matricula}
              onChange={(event) => {
                const limpio = event.target.value.replace(/\s+/g, '');
                setMatricula(limpio);
              }}
              placeholder="2024-001"
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={!matriculaValida && matricula.trim() ? 'Usa 3-32 caracteres (letras/numeros/punto/guion/guion_bajo).' : undefined}
            />
            <p className="nota">
              Si no ves resultados tras ingresar, intenta &quot;Recargar&quot;. Si el codigo expiro, solicita uno nuevo al docente.
            </p>
            <Boton
              type="button"
              icono={<Icono nombre="entrar" />}
              cargando={cargando}
              disabled={!puedeIngresar || cargando || cooldownActivo}
              onClick={ingresar}
            >
              Consultar
            </Boton>
            <HelperPanel
              titulo="Como consultar sin errores"
              descripcion="Sigue esta secuencia para evitar bloqueos por codigo o matricula."
              pasos={[
                'Usa el codigo de acceso mas reciente compartido por tu docente.',
                'Escribe tu matricula sin espacios y revisa que tenga el formato esperado.',
                'Si no hay resultados, pulsa Recargar antes de volver a ingresar.'
              ]}
              notas={
                <InlineMensaje tipo="info">
                  Si necesitas aclarar una respuesta, abre el detalle del folio y usa “Solicitar revision de marcadas”.
                </InlineMensaje>
              }
            />
          </div>
        </div>
      )}

      {token && mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}

      {token && cargando && (
        <p className="mensaje" role="status">
          <Spinner /> Cargando…
        </p>
      )}

      {token && resultados.length === 0 && !cargando && (
        <div className="resultado">
          <h3>
            <Icono nombre="info" /> Sin resultados
          </h3>
          <IlustracionSinResultados />
          <p>Si acabas de ingresar, intenta recargar.</p>
          <button className="boton secundario" type="button" onClick={cargarResultados}>
            <Icono nombre="recargar" /> Recargar
          </button>
        </div>
      )}

      {token && resultados.length > 0 && (
        <div className="resultado">
          <h3>
            <Icono nombre="ok" /> Resultados disponibles
          </h3>
          <div className="guia-grid">
            <div className="item-glass portal-alumno-card">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--perfil"><Icono nombre="alumno" /></span> Perfil
              </div>
              <div className="item-meta">
                <span>{perfil?.nombreCompleto || '-'}</span>
                <span>Matrícula: {perfil?.matricula || '-'}</span>
                <span>Grupo: {perfil?.grupo || '-'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--materias"><Icono nombre="periodos" /></span> Materias
              </div>
              <div className="item-meta">
                <span>Total: {materias.length}</span>
                <span>{materias.slice(0, 2).map((m) => m.nombre).filter(Boolean).join(' · ') || '-'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--agenda"><Icono nombre="info" /></span> Agenda
              </div>
              <div className="item-meta">
                <span>Eventos: {agenda.length}</span>
                <span>{agenda[0]?.titulo || '-'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--avisos"><Icono nombre="alerta" /></span> Avisos
              </div>
              <div className="item-meta">
                <span>Activos: {avisos.length}</span>
                <span>{avisos[0]?.titulo || '-'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--historial"><Icono nombre="recargar" /></span> Historial
              </div>
              <div className="item-meta">
                <span>Registros: {historial.length}</span>
                <span>{historial[0]?.folio || '-'}</span>
              </div>
            </div>
          </div>
          <HelperPanel
            titulo="Interpretacion de resultados"
            descripcion="Puedes revisar cada reactivo comparando la clave correcta con tu respuesta detectada."
            pasos={[
              'Abre “Ver detalle” en el folio que quieres revisar.',
              'Marca solo las preguntas que quieras impugnar y envia la solicitud.',
              'Cuando termines, marca conformidad para cerrar el flujo de revision.'
            ]}
          />
          <ul className="lista lista-items">
            {resultados.map((resultado) => (
              <li key={resultado.folio}>
                <div className="item-glass portal-resultado-card">
                  <div className="item-row">
                    <div>
                      <div className="item-title portal-card-title">
                        <span className="portal-card-icon portal-card-icon--folio"><Icono nombre="calificar" /></span> Folio {resultado.folio}
                      </div>
                      <div className="item-meta">
                        <span>Tipo: {resultado.tipoExamen}</span>
                        <span>Examen: {resultado.calificacionExamenFinalTexto}</span>
                        {resultado.calificacionParcialTexto && <span>Parcial: {resultado.calificacionParcialTexto}</span>}
                        {resultado.calificacionGlobalTexto && <span>Global: {resultado.calificacionGlobalTexto}</span>}
                        {typeof resultado.finalDecimal === 'number' && <span>Final decimal: {resultado.finalDecimal.toFixed(4)}</span>}
                        {typeof resultado.finalRedondeada === 'number' && <span>Final redondeada: {resultado.finalRedondeada.toFixed(0)}</span>}
                      </div>
                    </div>
                    <div className="item-actions">
                      <button className="boton secundario" type="button" onClick={() => void onToggleDetalle(resultado.folio)}>
                        <Icono nombre={detalleAbiertoFolio === resultado.folio ? 'chevron' : 'info'} />{' '}
                        {detalleAbiertoFolio === resultado.folio ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const inicio = Date.now();
                          try {
                            const respuesta = await fetch(`${basePortal}/examen/${resultado.folio}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (!respuesta.ok) {
                              emitToast({
                                level: 'error',
                                title: 'PDF no disponible',
                                message: `HTTP ${respuesta.status}`,
                                durationMs: 5200,
                                action: respuesta.status === 401 ? accionCerrarSesion('alumno') : undefined
                              });
                              void clientePortal.registrarEventosUso({
                                eventos: [
                                  {
                                    sessionId: obtenerSesionId(),
                                    pantalla: 'alumno',
                                    accion: 'ver_pdf',
                                    exito: false,
                                    meta: { folio: resultado.folio, status: respuesta.status }
                                  }
                                ]
                              });
                              return;
                            }
                            const blob = await respuesta.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank', 'noopener,noreferrer');
                            void clientePortal.registrarEventosUso({
                              eventos: [
                                {
                                  sessionId: obtenerSesionId(),
                                  pantalla: 'alumno',
                                  accion: 'ver_pdf',
                                  exito: true,
                                  duracionMs: Date.now() - inicio,
                                  meta: { folio: resultado.folio }
                                }
                              ]
                            });
                          } catch (error) {
                            emitToast({
                              level: 'error',
                              title: 'Error al abrir PDF',
                              message: mensajeDeError(error, 'Error al abrir PDF'),
                              durationMs: 5200,
                              action: accionToastSesionParaError(error, 'alumno')
                            });
                            void clientePortal.registrarEventosUso({
                              eventos: [
                                {
                                  sessionId: obtenerSesionId(),
                                  pantalla: 'alumno',
                                  accion: 'ver_pdf',
                                  exito: false,
                                  meta: { folio: resultado.folio }
                                }
                              ]
                            });
                          }
                        }}
                      >
                        <Icono nombre="pdf" /> Ver PDF
                      </button>
                    </div>
                  </div>
                  {detalleAbiertoFolio === resultado.folio && (
                    <div className="alumno-detalle">
                      {cargandoDetallePorFolio[resultado.folio] && (
                        <p className="mensaje" role="status">
                          <Spinner /> Cargando detalle del examen...
                        </p>
                      )}
                      {errorDetallePorFolio[resultado.folio] && (
                        <InlineMensaje tipo="error">{errorDetallePorFolio[resultado.folio]}</InlineMensaje>
                      )}
                      {!cargandoDetallePorFolio[resultado.folio] && !errorDetallePorFolio[resultado.folio] && (
                        <>
                          {(() => {
                            const detalle = detallesPorFolio[resultado.folio] ?? resultado;
                            const estado = estadoRevision(detalle);
                            const comparativa = Array.isArray(detalle.comparativaRespuestas) ? detalle.comparativaRespuestas : [];
                            const aciertos = comparativa.filter((item) => item.coincide).length;
                            const total = comparativa.length;
                            return (
                              <>
                                <div className="item-meta">
                                  <span>Reactivos: {detalle.totalReactivos ?? total ?? '-'}</span>
                                  <span>Aciertos detectados: {typeof detalle.aciertos === 'number' ? detalle.aciertos : aciertos}</span>
                                  {typeof detalle.versionPolitica === 'number' && <span>Política v{detalle.versionPolitica}</span>}
                                  {typeof detalle.bloqueContinuaDecimal === 'number' && (
                                    <span>Bloque continua: {detalle.bloqueContinuaDecimal.toFixed(4)}</span>
                                  )}
                                  {typeof detalle.bloqueExamenesDecimal === 'number' && (
                                    <span>Bloque exámenes: {detalle.bloqueExamenesDecimal.toFixed(4)}</span>
                                  )}
                                  {typeof detalle.finalDecimal === 'number' && <span>Final decimal: {detalle.finalDecimal.toFixed(4)}</span>}
                                  {typeof detalle.finalRedondeada === 'number' && (
                                    <span>Final redondeada: {detalle.finalRedondeada.toFixed(0)}</span>
                                  )}
                                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                                </div>
                                {detalle.omrAuditoria?.motivosRevision && detalle.omrAuditoria.motivosRevision.length > 0 && (
                                  <InlineMensaje tipo="info">
                                    Motivos de revision: {detalle.omrAuditoria.motivosRevision.join(' | ')}
                                  </InlineMensaje>
                                )}
                                <div className="alumno-detalle-tabla-wrap">
                                  {comparativa.length === 0 ? (
                                    <InlineMensaje tipo="info">
                                      Aun no hay comparativa de respuestas para este examen.
                                    </InlineMensaje>
                                  ) : (
                                    <table className="alumno-detalle-tabla">
                                      <thead>
                                        <tr>
                                          <th>Pregunta</th>
                                          <th>Clave correcta</th>
                                          <th>Tu respuesta</th>
                                          <th>Estado</th>
                                          <th>Solicitar revisión</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {comparativa.map((item) => (
                                          <tr key={`${resultado.folio}-q-${item.numeroPregunta}`}>
                                            <td>{item.numeroPregunta}</td>
                                            <td>{item.correcta ?? '-'}</td>
                                            <td>{item.detectada ?? '-'}</td>
                                            <td>
                                              <span className={`badge ${item.coincide ? 'ok' : 'error'}`}>
                                                {item.coincide ? 'Correcta' : 'Incorrecta'}
                                              </span>
                                            </td>
                                            <td>
                                              <label>
                                                <input
                                                  type="checkbox"
                                                  checked={Boolean(seleccionRevisionPorFolio[resultado.folio]?.[item.numeroPregunta])}
                                                  onChange={(event) => {
                                                    setSeleccionRevisionPorFolio((prev) => {
                                                      const folioActual = { ...(prev[resultado.folio] ?? {}) };
                                                      folioActual[item.numeroPregunta] = event.target.checked;
                                                      return { ...prev, [resultado.folio]: folioActual };
                                                    });
                                                  }}
                                                />{' '}
                                                Revisar
                                              </label>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                                {comparativa.length > 0 && (
                                  <div className="item-actions alumno-revision-actions">
                                    <textarea
                                      className="alumno-revision-comentario"
                                      value={comentarioRevisionPorFolio[resultado.folio] ?? ''}
                                      onChange={(event) =>
                                        setComentarioRevisionPorFolio((prev) => ({ ...prev, [resultado.folio]: event.target.value }))
                                      }
                                      placeholder="Comentario obligatorio: explica por qué solicitas revisión"
                                      rows={2}
                                    />
                                    <button className="boton secundario" type="button" onClick={() => void solicitarRevision(resultado.folio)}>
                                      <Icono nombre="info" /> Solicitar revisión de marcadas
                                    </button>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(conformidadPorFolio[resultado.folio])}
                                        onChange={(event) =>
                                          setConformidadPorFolio((prev) => ({ ...prev, [resultado.folio]: event.target.checked }))
                                        }
                                      />{' '}
                                      En conformidad con resultados
                                    </label>
                                    <button
                                      className="boton secundario"
                                      type="button"
                                      disabled={!conformidadPorFolio[resultado.folio]}
                                      onClick={() => void enviarConformidad(resultado.folio)}
                                    >
                                      <Icono nombre="ok" /> Enviar conformidad
                                    </button>
                                  </div>
                                )}
                                {Array.isArray(detalle.omrCapturas) && detalle.omrCapturas.length > 0 && (
                                  <div className="panel alumno-detalle" aria-label="Capturas OMR por página">
                                    <h4>Capturas OMR por página</h4>
                                    <div className="guia-grid">
                                      {detalle.omrCapturas
                                        .slice()
                                        .sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina))
                                        .map((captura) => (
                                          <div className="item-glass" key={`${resultado.folio}-captura-${captura.numeroPagina}`}>
                                            <div className="item-meta">
                                              <span>Página {captura.numeroPagina}</span>
                                              {typeof captura.calidad === 'number' && <span>Calidad: {(captura.calidad * 100).toFixed(0)}%</span>}
                                            </div>
                                            <img
                                              className="preview"
                                              alt={`Captura OMR página ${captura.numeroPagina}`}
                                              src={`data:image/${captura.formato};base64,${captura.imagenBase64}`}
                                            />
                                            {Array.isArray(captura.sugerencias) && captura.sugerencias.length > 0 && (
                                              <InlineMensaje tipo="info">{captura.sugerencias.join(' | ')}</InlineMensaje>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
