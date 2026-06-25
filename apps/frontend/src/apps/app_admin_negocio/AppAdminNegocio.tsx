/**
 * AppAdminNegocio
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 *
 * Mejoras de UX/UI: Aplicación de la guía de diseño avanzado (glassmorphism,
 * transparencias y animaciones de entrada).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clienteAdminNegocioApi } from './clienteAdminNegocioApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { HelperPanel } from '../../ui/ux/componentes/HelperPanel';

type Perfil = {
  docente?: {
    nombreCompleto?: string;
    correo?: string;
    permisos?: string[];
  };
};

type PlantillaNotificacion = {
  _id?: string;
  id?: string;
  clave?: string;
  evento?: string;
  canal?: string;
  idioma?: string;
  asunto?: string;
  contenido?: string;
  activo?: boolean;
};

type Vista =
  | 'dashboard'
  | 'tenants'
  | 'planes'
  | 'suscripciones'
  | 'licencias'
  | 'cupones'
  | 'campanas'
  | 'plantillas_notificacion'
  | 'cobranza'
  | 'auditoria';

type DashboardResumen = {
  margenBrutoMinimo?: number;
  totalTenants?: number;
  suscripcionesActivas?: number;
  suscripcionesPastDue?: number;
  mrrMxn?: number;
  cobranzaPendienteMxn?: number;
  conversionTrial?: number;
  churnMensual?: number;
};

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'planes', label: 'Planes' },
  { id: 'suscripciones', label: 'Suscripciones' },
  { id: 'licencias', label: 'Licencias' },
  { id: 'cupones', label: 'Cupones' },
  { id: 'campanas', label: 'Campanas' },
  { id: 'plantillas_notificacion', label: 'Plantillas Msg' },
  { id: 'cobranza', label: 'Cobranza' },
  { id: 'auditoria', label: 'Auditoria' }
];

const AYUDAS_VISTA: Record<Vista, { descripcion: string; pasos: string[] }> = {
  dashboard: {
    descripcion: 'Monitorea salud comercial, cobranza y desempeño del portafolio antes de ejecutar cambios.',
    pasos: ['Revisa KPIs críticos.', 'Entra a la capacidad que necesites ajustar.', 'Recarga después de una operación sensible.']
  },
  tenants: {
    descripcion: 'Crea y revisa tenants comerciales con datos mínimos operativos.',
    pasos: ['Define un identificador único.', 'Asocia un owner docente.', 'Registra contacto operativo.']
  },
  planes: {
    descripcion: 'Gestiona oferta comercial y estructura base de precios.',
    pasos: ['Usa IDs estables.', 'Mantén precios y margen coherentes.', 'Recarga para validar persistencia.']
  },
  suscripciones: {
    descripcion: 'Activa ciclos comerciales y estados de suscripción.',
    pasos: ['Vincula tenant y plan.', 'Elige ciclo y estado inicial.', 'Usa trial solo cuando aplique.']
  },
  licencias: {
    descripcion: 'Genera licencias operativas para despliegues controlados.',
    pasos: ['Confirma el tenant.', 'Genera la licencia.', 'Valida el resultado en datos crudos.']
  },
  cupones: {
    descripcion: 'Crea descuentos temporales con vigencia controlada.',
    pasos: ['Define código claro.', 'Ajusta el descuento.', 'Revisa vigencia al terminar.']
  },
  campanas: {
    descripcion: 'Configura campañas por canal disponible.',
    pasos: ['Selecciona el canal permitido.', 'Nombra la campaña.', 'Verifica capacidades SMTP antes de email.']
  },
  plantillas_notificacion: {
    descripcion: 'Administra mensajes de cobranza y comunicación recurrente.',
    pasos: ['Crea una plantilla base.', 'Edita asunto y contenido.', 'Mantén variables consistentes.']
  },
  cobranza: {
    descripcion: 'Opera links de cobro y el ciclo de mora desde una sola vista.',
    pasos: ['Genera la preferencia.', 'Abre el checkout si aplica.', 'Ejecuta el ciclo solo con contexto claro.']
  },
  auditoria: {
    descripcion: 'Consulta trazabilidad comercial y evidencia operativa.',
    pasos: ['Recarga antes de revisar.', 'Confirma filtros o contexto.', 'Usa los datos crudos como evidencia.']
  }
};

const ETIQUETAS_VISTA: Record<Vista, string> = {
  dashboard: 'Vista ejecutiva',
  tenants: 'Operación base',
  planes: 'Pricing',
  suscripciones: 'Ingresos',
  licencias: 'Activación',
  cupones: 'Promoción',
  campanas: 'Adquisición',
  plantillas_notificacion: 'Comunicaciones',
  cobranza: 'Recuperación',
  auditoria: 'Evidencia'
};

export function AppAdminNegocio() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [capacidadesIntegraciones, setCapacidadesIntegraciones] = useState<{ smtpBackend: boolean } | null>(null);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [data, setData] = useState<unknown>(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resumenDashboard, setResumenDashboard] = useState<DashboardResumen | null>(null);

  const [nuevoTenant, setNuevoTenant] = useState({
    tenantId: '',
    nombre: '',
    modalidad: 'saas',
    ownerDocenteId: '',
    contactoCorreo: '',
    contactoTelefono: ''
  });
  const [nuevoPlan, setNuevoPlan] = useState({
    planId: '',
    nombre: '',
    lineaPersona: 'docente',
    nivel: 1,
    precioMensual: 1000,
    precioAnual: 10000,
    costoMensualEstimado: 300
  });
  const [nuevaSuscripcion, setNuevaSuscripcion] = useState({
    tenantId: '',
    planId: '',
    ciclo: 'mensual',
    estado: 'trial',
    activarTrial35Dias: true
  });
  const [nuevoCupon, setNuevoCupon] = useState({
    codigo: '',
    tipoDescuento: 'porcentaje',
    valorDescuento: 10
  });
  const [nuevaCampana, setNuevaCampana] = useState({
    nombre: '',
    canal: 'email'
  });
  const [nuevaPlantillaNotificacion, setNuevaPlantillaNotificacion] = useState({
    clave: '',
    evento: 'cobranza_recordatorio',
    canal: 'email',
    idioma: 'es-MX',
    asunto: 'Recordatorio de pago - {{tenantNombre}}',
    contenido: 'Tu suscripcion EvaluaPro tiene {{diasVencidos}} dia(s) de atraso.'
  });
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');
  const [edicionPlantillaNotificacion, setEdicionPlantillaNotificacion] = useState({
    evento: 'cobranza_recordatorio',
    canal: 'email',
    idioma: 'es-MX',
    asunto: '',
    contenido: '',
    activo: true
  });
  const [nuevaLicencia, setNuevaLicencia] = useState({
    tenantId: '',
    tipo: 'onprem',
    canalRelease: 'stable'
  });
  const [nuevoCobroMp, setNuevoCobroMp] = useState({
    suscripcionId: '',
    titulo: 'Suscripcion EvaluaPro',
    monto: 1000
  });
  const [ultimoInitPoint, setUltimoInitPoint] = useState('');
  const [resumenCicloCobranza, setResumenCicloCobranza] = useState<null | {
    revisadas?: number;
    recordatorios?: number;
    suspensionesParciales?: number;
    suspensionesTotales?: number;
  }>(null);

  const permisos = useMemo(() => new Set(perfil?.docente?.permisos ?? []), [perfil]);
  const puedeVer = permisos.has('comercial:metricas:leer') || permisos.has('comercial:tenants:leer');
  const smtpDisponible = Boolean(capacidadesIntegraciones?.smtpBackend);
  const canalesDisponibles = useMemo(() => (smtpDisponible ? ['email', 'whatsapp', 'crm'] : ['whatsapp', 'crm']), [smtpDisponible]);
  const plantillasNotificacion = useMemo(() => {
    const payload = data as { plantillas?: PlantillaNotificacion[] } | null;
    return Array.isArray(payload?.plantillas) ? payload.plantillas : [];
  }, [data]);
  const ayudaVista = AYUDAS_VISTA[vista];

  const notificar = useCallback((level: 'ok' | 'error' | 'warn' | 'info', title: string, message: string) => {
    setMensaje(message);
    emitToast({
      level,
      title,
      message,
      eyebrow: 'Panel de negocio',
      durationMs: level === 'error' ? 5200 : 2800
    });
  }, []);

  const cargarPerfil = useCallback(async () => {
    try {
      const payload = await clienteAdminNegocioApi.obtener<Perfil>('/autenticacion/perfil');
      setPerfil(payload);
      setMensaje('');
    } catch {
      notificar('warn', 'Sesión comercial requerida', 'No hay sesion activa. Ingresa con tu cuenta Google y rol comercial.');
    }
  }, [notificar]);

  const cargarCapacidadesIntegraciones = useCallback(async () => {
    try {
      const payload = await clienteAdminNegocioApi.obtener<{ capacidadesIntegraciones?: { smtpBackend?: boolean } }>('/autenticacion/capacidades-integraciones');
      setCapacidadesIntegraciones({ smtpBackend: Boolean(payload?.capacidadesIntegraciones?.smtpBackend) });
    } catch {
      setCapacidadesIntegraciones({ smtpBackend: false });
    }
  }, []);

  const cargarVistaActual = useCallback(async (v: Vista) => {
    const rutas: Record<Vista, string> = {
      dashboard: '/admin-negocio/dashboard/resumen',
      tenants: '/admin-negocio/tenants',
      planes: '/admin-negocio/planes',
      suscripciones: '/admin-negocio/suscripciones',
      licencias: '/admin-negocio/licencias',
      cupones: '/admin-negocio/cupones',
      campanas: '/admin-negocio/campanas',
      plantillas_notificacion: '/admin-negocio/plantillas-notificacion',
      cobranza: '/admin-negocio/cobranza',
      auditoria: '/admin-negocio/auditoria'
    };

    setCargando(true);
    try {
      const payload = await clienteAdminNegocioApi.obtener<unknown>(rutas[v]);
      setData(payload);
      if (v === 'dashboard') {
        const dashboard = payload as { resumen?: DashboardResumen } | null;
        if (dashboard?.resumen) setResumenDashboard(dashboard.resumen);
      }
      setMensaje('');
    } catch (error) {
      notificar('error', 'Vista no disponible', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo cargar la vista'));
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  const cargarResumenDashboard = useCallback(async () => {
    try {
      const payload = await clienteAdminNegocioApi.obtener<{ resumen?: DashboardResumen }>('/admin-negocio/dashboard/resumen');
      if (payload?.resumen) setResumenDashboard(payload.resumen);
    } catch {
      // Evitar ruido visual: el resumen principal es complementario al resto del panel.
    }
  }, []);

  const formatearMoneda = useCallback((valor: number | undefined) => {
    const numero = Number(valor || 0);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(numero);
  }, []);

  const formatearPct = useCallback((valor: number | undefined) => `${(Number(valor || 0) * 100).toFixed(1)}%`, []);

  async function crearTenant() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/tenants', {
        tenantId: nuevoTenant.tenantId,
        nombre: nuevoTenant.nombre,
        modalidad: nuevoTenant.modalidad,
        ownerDocenteId: nuevoTenant.ownerDocenteId,
        tipoTenant: 'smb',
        pais: 'MX',
        moneda: 'MXN',
        configAislamiento: { estrategia: 'shared' },
        contacto: {
          correo: nuevoTenant.contactoCorreo || undefined,
          telefono: nuevoTenant.contactoTelefono || undefined
        }
      });
      notificar('ok', 'Tenant creado', 'El tenant se creó correctamente.');
      await cargarVistaActual('tenants');
    } catch (error) {
      notificar('error', 'No se pudo crear tenant', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear tenant'));
    }
  }

  async function crearPlan() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/planes', {
        ...nuevoPlan,
        moneda: 'MXN',
        margenObjetivoMinimo: 0.6,
        activo: true
      });
      notificar('ok', 'Plan creado', 'El plan se creó correctamente.');
      await cargarVistaActual('planes');
    } catch (error) {
      notificar('error', 'No se pudo crear plan', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear plan'));
    }
  }

  async function crearSuscripcion() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/suscripciones', {
        ...nuevaSuscripcion,
        pasarela: 'mercadopago'
      });
      notificar('ok', 'Suscripción creada', 'La suscripcion se creó correctamente.');
      await cargarVistaActual('suscripciones');
    } catch (error) {
      notificar('error', 'No se pudo crear suscripción', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear suscripcion'));
    }
  }

  async function crearCupon() {
    try {
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + 1000 * 60 * 60 * 24 * 30);
      await clienteAdminNegocioApi.enviar('/admin-negocio/cupones', {
        ...nuevoCupon,
        moneda: 'MXN',
        vigenciaInicio: ahora.toISOString(),
        vigenciaFin: fin.toISOString(),
        usoMaximo: 100,
        activo: true
      });
      notificar('ok', 'Cupón creado', 'El cupon se creó correctamente.');
      await cargarVistaActual('cupones');
    } catch (error) {
      notificar('error', 'No se pudo crear cupón', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear cupon'));
    }
  }

  async function crearCampana() {
    try {
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + 1000 * 60 * 60 * 24 * 20);
      await clienteAdminNegocioApi.enviar('/admin-negocio/campanas', {
        ...nuevaCampana,
        fechaInicio: ahora.toISOString(),
        fechaFin: fin.toISOString(),
        presupuestoMxn: 15000,
        estado: 'borrador'
      });
      notificar('ok', 'Campaña creada', 'La campana se creó correctamente.');
      await cargarVistaActual('campanas');
    } catch (error) {
      notificar('error', 'No se pudo crear campaña', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear campana'));
    }
  }

  async function crearPlantillaNotificacion() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/plantillas-notificacion', {
        ...nuevaPlantillaNotificacion,
        activo: true,
        variables: ['tenantNombre', 'tenantId', 'diasVencidos', 'estadoSuscripcion']
      });
      notificar('ok', 'Plantilla creada', 'La plantilla de notificación se creó correctamente.');
      await cargarVistaActual('plantillas_notificacion');
    } catch (error) {
      notificar('error', 'No se pudo crear plantilla', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear plantilla de notificacion'));
    }
  }

  const seleccionarPlantillaNotificacion = useCallback((id: string) => {
    const plantilla = plantillasNotificacion.find((item) => String(item._id || item.id || '') === id);
    if (!plantilla) return;
    setPlantillaSeleccionadaId(id);
    setEdicionPlantillaNotificacion({
      evento: String(plantilla.evento || 'cobranza_recordatorio'),
      canal: String(plantilla.canal || 'whatsapp'),
      idioma: String(plantilla.idioma || 'es-MX'),
      asunto: String(plantilla.asunto || ''),
      contenido: String(plantilla.contenido || ''),
      activo: Boolean(plantilla.activo ?? true)
    });
  }, [plantillasNotificacion]);

  async function actualizarPlantillaNotificacion() {
    if (!plantillaSeleccionadaId) {
      notificar('warn', 'Selecciona una plantilla', 'Elige una plantilla existente para editarla.');
      return;
    }
    try {
      await clienteAdminNegocioApi.enviar(`/admin-negocio/plantillas-notificacion/${plantillaSeleccionadaId}`, {
        ...edicionPlantillaNotificacion
      });
      notificar('ok', 'Plantilla actualizada', 'La plantilla se actualizó correctamente.');
      await cargarVistaActual('plantillas_notificacion');
    } catch (error) {
      notificar('error', 'No se pudo actualizar plantilla', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo actualizar plantilla'));
    }
  }

  async function generarLicencia() {
    try {
      const fin = new Date();
      fin.setFullYear(fin.getFullYear() + 1);
      await clienteAdminNegocioApi.enviar('/admin-negocio/licencias/generar', {
        ...nuevaLicencia,
        expiraEn: fin.toISOString()
      });
      notificar('ok', 'Licencia generada', 'La licencia se generó correctamente.');
      await cargarVistaActual('licencias');
    } catch (error) {
      notificar('error', 'No se pudo generar licencia', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo generar licencia'));
    }
  }

  async function crearPreferenciaMercadoPago() {
    try {
      const payload = await clienteAdminNegocioApi.enviar<{
        preferencia?: { initPoint?: string; sandboxInitPoint?: string; id?: string };
      }>('/admin-negocio/cobranza/mercadopago/preferencia', {
        suscripcionId: nuevoCobroMp.suscripcionId,
        titulo: nuevoCobroMp.titulo,
        monto: nuevoCobroMp.monto,
        moneda: 'MXN'
      });
      const url = String(payload?.preferencia?.initPoint || payload?.preferencia?.sandboxInitPoint || '').trim();
      setUltimoInitPoint(url);
      notificar('ok', 'Preferencia creada', url ? 'Preferencia creada. Abre el enlace para cobrar.' : 'Preferencia creada.');
      await cargarVistaActual('cobranza');
    } catch (error) {
      notificar('error', 'No se pudo crear preferencia', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear preferencia Mercado Pago'));
    }
  }

  async function ejecutarCicloCobranza() {
    try {
      const payload = await clienteAdminNegocioApi.enviar<{
        resumen?: {
          revisadas?: number;
          recordatorios?: number;
          suspensionesParciales?: number;
          suspensionesTotales?: number;
        };
      }>('/admin-negocio/cobranza/ciclo/ejecutar', {});
      setResumenCicloCobranza(payload.resumen || null);
      notificar('ok', 'Ciclo ejecutado', 'El ciclo de cobranza se ejecutó correctamente.');
      await cargarVistaActual('cobranza');
    } catch (error) {
      notificar('error', 'No se pudo ejecutar ciclo', clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo ejecutar ciclo de cobranza'));
    }
  }

  useEffect(() => {
    void cargarPerfil();
    void cargarCapacidadesIntegraciones();
  }, [cargarCapacidadesIntegraciones, cargarPerfil]);

  useEffect(() => {
    if (smtpDisponible) return;
    if (nuevaCampana.canal === 'email') {
      setNuevaCampana((prev) => ({ ...prev, canal: 'whatsapp' }));
    }
    if (nuevaPlantillaNotificacion.canal === 'email') {
      setNuevaPlantillaNotificacion((prev) => ({ ...prev, canal: 'whatsapp' }));
    }
    if (edicionPlantillaNotificacion.canal === 'email') {
      setEdicionPlantillaNotificacion((prev) => ({ ...prev, canal: 'whatsapp' }));
    }
  }, [smtpDisponible, nuevaCampana.canal, nuevaPlantillaNotificacion.canal, edicionPlantillaNotificacion.canal]);

  useEffect(() => {
    if (!puedeVer) return;
    void cargarVistaActual(vista);
  }, [cargarVistaActual, vista, puedeVer]);

  useEffect(() => {
    if (!puedeVer) return;
    void cargarResumenDashboard();
  }, [cargarResumenDashboard, puedeVer]);

  useEffect(() => {
    if (vista !== 'plantillas_notificacion') return;
    if (plantillasNotificacion.length === 0) {
      if (plantillaSeleccionadaId) setPlantillaSeleccionadaId('');
      return;
    }
    const existeSeleccion = plantillasNotificacion.some(
      (item) => String(item._id || item.id || '') === plantillaSeleccionadaId
    );
    if (!existeSeleccion) {
      seleccionarPlantillaNotificacion(String(plantillasNotificacion[0]._id || plantillasNotificacion[0].id || ''));
    }
  }, [vista, plantillasNotificacion, plantillaSeleccionadaId, seleccionarPlantillaNotificacion]);

  return (
    <div className="panel glass-card anim-fade-in cuenta-panel admin-negocio-shell superficie-app superficie-app--negocio" data-admin-negocio="true">
      <div className="admin-negocio-shell__header">
        <div>
          <p className="eyebrow">
            <Icono nombre="docente" /> Panel estratégico
          </p>
          <h2>Panel de Negocio EvaluaPro</h2>
          <p className="admin-negocio-shell__lead">
            Supervisa métricas comerciales, licencias y cobranza con una lectura más ejecutiva y controlada.
          </p>
          <p className="nota">
            Usuario: <b>{perfil?.docente?.nombreCompleto || 'Sin sesion'}</b> ({perfil?.docente?.correo || '-'})
          </p>
        </div>
        <div className="badge">Vista activa: {VISTAS.find((item) => item.id === vista)?.label || vista}</div>
      </div>

      {!puedeVer ? (
        <div className="subpanel">
          <InlineMensaje tipo="warning">
            Este panel requiere permisos comerciales. Ingresa con tu cuenta Google superadmin o asigna permisos comerciales a tu usuario.
          </InlineMensaje>
        </div>
      ) : (
        <>
          <div className="admin-negocio-shell__grid">
            <HelperPanel
              titulo={`Cómo operar ${VISTAS.find((item) => item.id === vista)?.label || vista}`}
              descripcion={ayudaVista.descripcion}
              pasos={ayudaVista.pasos}
              notas={<span className="ayuda">Usa los datos crudos como evidencia operativa y recarga después de cada acción crítica.</span>}
            />
          <div className="subpanel glass-card superadmin-overview">
            <div className="superadmin-overview__head">
              <div>
                <h3>Control Maestro Superadmin</h3>
                <p className="nota">
                  Esta vista amplía el dashboard operativo con poderes comerciales, licenciamiento, cobranza y auditoría.
                </p>
              </div>
              <button
                type="button"
                className="chip scale-hover"
                onClick={() => {
                  void cargarResumenDashboard();
                  void cargarVistaActual(vista);
                }}
              >
                Actualizar todo
              </button>
            </div>
            <div className="superadmin-kpis">
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Tenants</span>
                <b>{resumenDashboard?.totalTenants ?? 0}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Suscripciones activas</span>
                <b>{resumenDashboard?.suscripcionesActivas ?? 0}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Past due</span>
                <b>{resumenDashboard?.suscripcionesPastDue ?? 0}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>MRR</span>
                <b>{formatearMoneda(resumenDashboard?.mrrMxn)}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Cobranza pendiente</span>
                <b>{formatearMoneda(resumenDashboard?.cobranzaPendienteMxn)}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Conversión trial</span>
                <b>{formatearPct(resumenDashboard?.conversionTrial)}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Churn mensual</span>
                <b>{formatearPct(resumenDashboard?.churnMensual)}</b>
              </article>
              <article className="superadmin-kpi glass-card scale-hover">
                <span>Margen bruto mínimo</span>
                <b>{formatearPct(resumenDashboard?.margenBrutoMinimo)}</b>
              </article>
            </div>
            <div className="acciones acciones--mt">
              <button type="button" className="chip scale-hover" onClick={() => setVista('dashboard')}>
                Vista ejecutiva
              </button>
              <button type="button" className="chip scale-hover" onClick={() => setVista('licencias')}>
                Poder: licencias
              </button>
              <button type="button" className="chip scale-hover" onClick={() => setVista('cobranza')}>
                Poder: cobranza
              </button>
              <button type="button" className="chip scale-hover" onClick={() => setVista('auditoria')}>
                Poder: auditoría
              </button>
            </div>
          </div>

          <div className="admin-negocio-nav" role="navigation" aria-label="Vistas del panel de negocio">
            {VISTAS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-negocio-nav__item scale-hover${vista === item.id ? ' admin-negocio-nav__item--activo' : ''}`}
                disabled={cargando}
                data-tooltip={`Abrir ${item.label}`}
                onClick={() => setVista(item.id)}
              >
                <span className="admin-negocio-nav__title">{item.label}</span>
                <span className="admin-negocio-nav__meta">{ETIQUETAS_VISTA[item.id]}</span>
              </button>
            ))}
            <button
              type="button"
              className="admin-negocio-nav__item admin-negocio-nav__item--refresh scale-hover"
              onClick={() => {
                void cargarVistaActual(vista);
                void cargarResumenDashboard();
              }}
            >
              <span className="admin-negocio-nav__title">Recargar</span>
              <span className="admin-negocio-nav__meta">Sincroniza esta vista</span>
            </button>
          </div>

          {vista === 'tenants' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nuevo tenant</h3>
              <label className="campo">Tenant ID<input value={nuevoTenant.tenantId} onChange={(e) => setNuevoTenant({ ...nuevoTenant, tenantId: e.target.value })} /></label>
              <label className="campo">Nombre<input value={nuevoTenant.nombre} onChange={(e) => setNuevoTenant({ ...nuevoTenant, nombre: e.target.value })} /></label>
              <label className="campo">Owner Docente ID<input value={nuevoTenant.ownerDocenteId} onChange={(e) => setNuevoTenant({ ...nuevoTenant, ownerDocenteId: e.target.value })} /></label>
              <label className="campo">Correo contacto<input value={nuevoTenant.contactoCorreo} onChange={(e) => setNuevoTenant({ ...nuevoTenant, contactoCorreo: e.target.value })} /></label>
              <label className="campo">Teléfono contacto<input value={nuevoTenant.contactoTelefono} onChange={(e) => setNuevoTenant({ ...nuevoTenant, contactoTelefono: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearTenant()}>Crear tenant</button></div>
            </div>
          )}

          {vista === 'planes' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nuevo plan</h3>
              <label className="campo">Plan ID<input value={nuevoPlan.planId} onChange={(e) => setNuevoPlan({ ...nuevoPlan, planId: e.target.value })} /></label>
              <label className="campo">Nombre<input value={nuevoPlan.nombre} onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearPlan()}>Crear plan</button></div>
            </div>
          )}

          {vista === 'suscripciones' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nueva suscripcion</h3>
              <label className="campo">Tenant ID<input value={nuevaSuscripcion.tenantId} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, tenantId: e.target.value })} /></label>
              <label className="campo">Plan ID<input value={nuevaSuscripcion.planId} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, planId: e.target.value })} /></label>
              <label className="campo">Ciclo
                <select value={nuevaSuscripcion.ciclo} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, ciclo: e.target.value })}>
                  <option value="mensual">mensual</option>
                  <option value="anual">anual</option>
                </select>
              </label>
              <label className="campo">Estado
                <select value={nuevaSuscripcion.estado} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, estado: e.target.value })}>
                  <option value="trial">trial</option>
                  <option value="activo">activo</option>
                  <option value="past_due">past_due</option>
                  <option value="suspendido">suspendido</option>
                  <option value="cancelado">cancelado</option>
                </select>
              </label>
              <label className="campo">
                <input
                  type="checkbox"
                  checked={nuevaSuscripcion.activarTrial35Dias}
                  onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, activarTrial35Dias: e.target.checked })}
                />
                Activar trial 35 dias
              </label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearSuscripcion()}>Crear suscripcion</button></div>
            </div>
          )}

          {vista === 'cupones' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nuevo cupon</h3>
              <label className="campo">Codigo<input value={nuevoCupon.codigo} onChange={(e) => setNuevoCupon({ ...nuevoCupon, codigo: e.target.value })} /></label>
              <label className="campo">Valor descuento<input type="number" value={nuevoCupon.valorDescuento} onChange={(e) => setNuevoCupon({ ...nuevoCupon, valorDescuento: Number(e.target.value || 0) })} /></label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearCupon()}>Crear cupon</button></div>
            </div>
          )}

          {vista === 'campanas' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nueva campana</h3>
              <label className="campo">Nombre<input value={nuevaCampana.nombre} onChange={(e) => setNuevaCampana({ ...nuevaCampana, nombre: e.target.value })} /></label>
              <label className="campo">Canal
                <select value={nuevaCampana.canal} onChange={(e) => setNuevaCampana({ ...nuevaCampana, canal: e.target.value })}>
                  {canalesDisponibles.map((canal) => (
                    <option key={canal} value={canal}>{canal}</option>
                  ))}
                </select>
              </label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearCampana()}>Crear campana</button></div>
            </div>
          )}

          {vista === 'plantillas_notificacion' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Nueva plantilla de notificación</h3>
              {!smtpDisponible ? (
                <p className="nota">SMTP no configurado: el canal email está oculto y deshabilitado.</p>
              ) : null}
              <label className="campo">Clave<input value={nuevaPlantillaNotificacion.clave} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, clave: e.target.value })} /></label>
              <label className="campo">Evento
                <select value={nuevaPlantillaNotificacion.evento} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, evento: e.target.value })}>
                  <option value="cobranza_recordatorio">cobranza_recordatorio</option>
                  <option value="cobranza_suspension_parcial">cobranza_suspension_parcial</option>
                  <option value="cobranza_suspension_total">cobranza_suspension_total</option>
                </select>
              </label>
              <label className="campo">Canal
                <select value={nuevaPlantillaNotificacion.canal} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, canal: e.target.value })}>
                  {canalesDisponibles.map((canal) => (
                    <option key={canal} value={canal}>{canal}</option>
                  ))}
                </select>
              </label>
              <label className="campo">Idioma<input value={nuevaPlantillaNotificacion.idioma} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, idioma: e.target.value })} /></label>
              <label className="campo">Asunto<input value={nuevaPlantillaNotificacion.asunto} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, asunto: e.target.value })} /></label>
              <label className="campo">Contenido
                <textarea value={nuevaPlantillaNotificacion.contenido} onChange={(e) => setNuevaPlantillaNotificacion({ ...nuevaPlantillaNotificacion, contenido: e.target.value })} rows={4} />
              </label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void crearPlantillaNotificacion()}>Crear plantilla</button></div>
              <h3 className="admin-negocio__editor-title">Editor de plantilla existente</h3>
              <label className="campo">Plantilla
                <select value={plantillaSeleccionadaId} onChange={(e) => seleccionarPlantillaNotificacion(e.target.value)}>
                  {plantillasNotificacion.length === 0 ? <option value="">Sin plantillas</option> : null}
                  {plantillasNotificacion.map((item) => {
                    const id = String(item._id || item.id || '');
                    const nombre = `${item.clave || id} (${item.evento || '-'} / ${item.canal || '-'})`;
                    return <option key={id} value={id}>{nombre}</option>;
                  })}
                </select>
              </label>
              <label className="campo">Evento
                <select value={edicionPlantillaNotificacion.evento} onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, evento: e.target.value })}>
                  <option value="cobranza_recordatorio">cobranza_recordatorio</option>
                  <option value="cobranza_suspension_parcial">cobranza_suspension_parcial</option>
                  <option value="cobranza_suspension_total">cobranza_suspension_total</option>
                </select>
              </label>
              <label className="campo">Canal
                <select value={edicionPlantillaNotificacion.canal} onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, canal: e.target.value })}>
                  {canalesDisponibles.map((canal) => (
                    <option key={canal} value={canal}>{canal}</option>
                  ))}
                </select>
              </label>
              <label className="campo">Idioma<input value={edicionPlantillaNotificacion.idioma} onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, idioma: e.target.value })} /></label>
              <label className="campo">Asunto<input value={edicionPlantillaNotificacion.asunto} onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, asunto: e.target.value })} /></label>
              <label className="campo">Contenido
                <textarea value={edicionPlantillaNotificacion.contenido} onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, contenido: e.target.value })} rows={5} />
              </label>
              <label className="campo">
                <input
                  type="checkbox"
                  checked={edicionPlantillaNotificacion.activo}
                  onChange={(e) => setEdicionPlantillaNotificacion({ ...edicionPlantillaNotificacion, activo: e.target.checked })}
                />
                Activa
              </label>
              <div className="acciones">
                <button type="button" className="chip scale-hover" onClick={() => void actualizarPlantillaNotificacion()} disabled={!plantillaSeleccionadaId}>
                  Guardar cambios
                </button>
              </div>
            </div>
          )}

          {vista === 'licencias' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Generar licencia</h3>
              <label className="campo">Tenant ID<input value={nuevaLicencia.tenantId} onChange={(e) => setNuevaLicencia({ ...nuevaLicencia, tenantId: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip scale-hover" onClick={() => void generarLicencia()}>Generar licencia</button></div>
            </div>
          )}

          {vista === 'cobranza' && (
            <div className="subpanel glass-card anim-slide-up">
              <h3>Crear preferencia Mercado Pago</h3>
              <label className="campo">
                Suscripcion ID
                <input value={nuevoCobroMp.suscripcionId} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, suscripcionId: e.target.value })} />
              </label>
              <label className="campo">
                Titulo
                <input value={nuevoCobroMp.titulo} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, titulo: e.target.value })} />
              </label>
              <label className="campo">
                Monto MXN
                <input type="number" value={nuevoCobroMp.monto} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, monto: Number(e.target.value || 0) })} />
              </label>
              <div className="acciones">
                <button type="button" className="chip scale-hover" onClick={() => void crearPreferenciaMercadoPago()}>
                  Crear preferencia
                </button>
                <button type="button" className="chip scale-hover" onClick={() => void ejecutarCicloCobranza()}>
                  Ejecutar ciclo mora
                </button>
                {ultimoInitPoint ? (
                  <a className="chip scale-hover" href={ultimoInitPoint} target="_blank" rel="noreferrer">
                    Abrir checkout
                  </a>
                ) : null}
              </div>
              {resumenCicloCobranza ? (
                <p className="nota">
                  Revisadas: {resumenCicloCobranza.revisadas ?? 0} · Recordatorios: {resumenCicloCobranza.recordatorios ?? 0} ·
                  Suspensión parcial: {resumenCicloCobranza.suspensionesParciales ?? 0} ·
                  Suspensión total: {resumenCicloCobranza.suspensionesTotales ?? 0}
                </p>
              ) : null}
            </div>
          )}

          <div className="subpanel glass-card">
            <h3>Datos</h3>
            {cargando ? <p className="nota">Cargando...</p> : <pre className="admin-negocio__payload-json">{JSON.stringify(data, null, 2)}</pre>}
          </div>
          </div>
        </>
      )}

      {mensaje ? <p className="nota">{mensaje}</p> : null}
    </div>
  );
}
