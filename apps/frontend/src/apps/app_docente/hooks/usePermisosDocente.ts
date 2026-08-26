/**
 * usePermisosDocente
 *
 * Responsabilidad: Hook transversal del shell docente.
 * Limites: Mantener estado derivado predecible y efectos idempotentes.
 */
import { useCallback, useMemo } from 'react';
import type { Docente } from '../tipos';

function valorVerdadero(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const texto = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'si', 'yes', 'paid', 'active', 'activo', 'activa', 'vigente'].includes(texto);
}

const NIVELES_PAGO = new Set(['pro', 'premium', 'enterprise', 'business', 'institucional', 'paid']);
const ESTADOS_PAGO = ['active', 'activo', 'activa', 'paid', 'vigente', 'trialing'];

function itemTieneBanderaPago(item: Record<string, unknown>): boolean {
  return (
    valorVerdadero(item.esDePago) ||
    valorVerdadero(item.paid) ||
    valorVerdadero(item.activa) ||
    valorVerdadero(item.activo) ||
    valorVerdadero(item.active) ||
    valorVerdadero(item.vigente)
  );
}

function normalizarTextosPlan(...values: unknown[]): string[] {
  return values.map((valor) => String(valor ?? '').trim().toLowerCase()).filter(Boolean);
}

function textosIndicanPlanPago(textos: string[]): boolean {
  return textos.some((texto) => NIVELES_PAGO.has(texto)) || textos.some((texto) => ESTADOS_PAGO.includes(texto));
}

function docenteTienePlanPagoActivo(docente: Docente | null): boolean {
  const extendido = (docente ?? {}) as Docente & {
    plan?: Record<string, unknown>;
    suscripcion?: Record<string, unknown>;
    licencia?: Record<string, unknown>;
    planCodigo?: unknown;
    planNivel?: unknown;
    suscripcionActiva?: unknown;
    pagoActivo?: unknown;
  };
  if (valorVerdadero(extendido.suscripcionActiva) || valorVerdadero(extendido.pagoActivo)) return true;
  const contenedores = [extendido.plan, extendido.suscripcion, extendido.licencia].filter(Boolean) as Array<Record<string, unknown>>;
  for (const item of contenedores) {
    if (itemTieneBanderaPago(item)) return true;
    const textos = normalizarTextosPlan(item.codigo, item.nivel, item.tier, item.plan, item.status, item.estado);
    if (textosIndicanPlanPago(textos)) return true;
  }
  return textosIndicanPlanPago(normalizarTextosPlan(extendido.planCodigo, extendido.planNivel));
}

export function usePermisosDocente(docente: Docente | null) {
  const esDev = import.meta.env.DEV;
  const esAdmin = Boolean(docente?.roles?.includes('admin'));
  const permisosDocente = useMemo(() => new Set(docente?.permisos ?? []), [docente?.permisos]);
  const puede = useCallback((permiso: string) => permisosDocente.has(permiso), [permisosDocente]);
  const permisoRecuperacion =
    puede('omr:rehidratar_lotes') ||
    puede('omr:rehidratar_lote') ||
    puede('rehidratacion:usar') ||
    puede('recuperacion:lotes:usar');
  const planPagoActivo = docenteTienePlanPagoActivo(docente);
  const puedeRehidratarLotes = esAdmin || permisoRecuperacion || planPagoActivo;

  const permisosUI = useMemo(
    () => ({
      periodos: {
        leer: puede('periodos:leer'),
        gestionar: puede('periodos:gestionar'),
        archivar: puede('periodos:archivar')
      },
      alumnos: {
        leer: puede('alumnos:leer'),
        gestionar: puede('alumnos:gestionar')
      },
      banco: {
        leer: puede('banco:leer'),
        gestionar: puede('banco:gestionar'),
        archivar: puede('banco:archivar')
      },
      plantillas: {
        leer: puede('plantillas:leer'),
        gestionar: puede('plantillas:gestionar'),
        archivar: puede('plantillas:archivar'),
        previsualizar: puede('plantillas:previsualizar')
      },
      examenes: {
        leer: puede('examenes:leer'),
        generar: puede('examenes:generar'),
        archivar: puede('examenes:archivar'),
        regenerar: puede('examenes:regenerar'),
        descargar: puede('examenes:descargar')
      },
      entregas: { gestionar: puede('entregas:gestionar') },
      omr: { analizar: puede('omr:analizar') },
      calificaciones: { calificar: puede('calificaciones:calificar') },
      rehidratacion: { usar: puedeRehidratarLotes },
      evaluaciones: { leer: puede('evaluaciones:leer'), gestionar: puede('evaluaciones:gestionar') },
      classroom: { conectar: puede('classroom:conectar'), pull: puede('classroom:pull') },
      publicar: { publicar: puede('calificaciones:publicar') },
      sincronizacion: {
        listar: puede('sincronizacion:listar'),
        exportar: puede('sincronizacion:exportar'),
        importar: puede('sincronizacion:importar'),
        push: puede('sincronizacion:push'),
        pull: puede('sincronizacion:pull')
      },
      cuenta: { leer: puede('cuenta:leer'), actualizar: puede('cuenta:actualizar') },
      asistencias: {
        leer: puede('asistencias:leer') || puede('asistencias:gestionar') || puede('periodos:leer'),
        gestionar: puede('asistencias:gestionar') || puede('periodos:gestionar')
      },
      temarios: {
        leer: puede('temarios:leer') || puede('temarios:gestionar') || puede('periodos:leer'),
        gestionar: puede('temarios:gestionar') || puede('periodos:gestionar')
      }
    }),
    [puede, puedeRehidratarLotes]
  );

  const puedeEliminarMateriaDev = esDev && esAdmin && puede('periodos:eliminar_dev');
  const puedeEliminarAlumnoDev = esDev && esAdmin && puede('alumnos:eliminar_dev');

  const itemsVista = useMemo(() => {
    const puedeCalificar = puede('calificaciones:calificar') || puede('omr:analizar');
    const puedePublicar = puede('sincronizacion:listar') || puede('calificaciones:publicar');
    const items = [
      { id: 'periodos', label: 'Materias', icono: 'periodos' as const, mostrar: puede('periodos:leer') },
      { id: 'alumnos', label: 'Alumnos', icono: 'alumnos' as const, mostrar: puede('alumnos:leer') },
      { id: 'asistencias', label: 'Asistencias', icono: 'asistencias' as const, mostrar: puede('asistencias:leer') || puede('asistencias:gestionar') || puede('periodos:leer') },
      { id: 'temarios', label: 'Temarios', icono: 'temarios' as const, mostrar: puede('temarios:leer') || puede('temarios:gestionar') || puede('periodos:leer') },
      { id: 'banco', label: 'Banco', icono: 'banco' as const, mostrar: puede('banco:leer') },
      { id: 'plantillas', label: 'Diseño de Exámenes', icono: 'plantillas' as const, mostrar: puede('plantillas:leer') },
      { id: 'entrega', label: 'Entrega', icono: 'recepcion' as const, mostrar: puede('entregas:gestionar') },
      { id: 'calificaciones', label: 'Calificaciones', icono: 'calificar' as const, mostrar: puedeCalificar },
      { id: 'rehidratacion', label: 'Rehidratacion', icono: 'pdf' as const, mostrar: puedeRehidratarLotes },
      { id: 'evaluaciones', label: 'Evaluaciones', icono: 'evaluaciones' as const, mostrar: puede('evaluaciones:leer') },
      { id: 'classroom', label: 'Classroom', icono: 'classroom' as const, mostrar: Boolean(puede('classroom:conectar') || puede('classroom:pull') || puede('periodos:leer')) },
      { id: 'publicar', label: 'Sincronización', icono: 'sincronizacion' as const, mostrar: puedePublicar },
      { id: 'cuenta', label: 'Cuenta', icono: 'cuenta' as const, mostrar: puede('cuenta:leer') }
    ];
    return items.filter((item) => item.mostrar);
  }, [puede, puedeRehidratarLotes]);

  return {
    puede,
    permisosUI,
    itemsVista,
    esAdmin,
    esDev,
    puedeEliminarMateriaDev,
    puedeEliminarAlumnoDev
  };
}
