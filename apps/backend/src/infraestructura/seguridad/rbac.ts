/**
 * Catalogo central de roles y permisos (RBAC).
 *
 * Nota: Los permisos se usan tanto para enforcement (middleware)
 * como para devolver el perfil de accesos al frontend.
 */
export const PERMISOS = [
  'alumnos:leer',
  'alumnos:gestionar',
  'alumnos:eliminar_dev',
  'periodos:leer',
  'periodos:gestionar',
  'periodos:archivar',
  'periodos:eliminar_dev',
  'banco:leer',
  'banco:gestionar',
  'banco:archivar',
  'plantillas:leer',
  'plantillas:gestionar',
  'plantillas:archivar',
  'plantillas:previsualizar',
  'plantillas:eliminar_dev',
  'examenes:leer',
  'examenes:generar',
  'examenes:archivar',
  'examenes:regenerar',
  'examenes:descargar',
  'entregas:gestionar',
  'omr:analizar',
  'calificaciones:calificar',
  'calificaciones:publicar',
  'evaluaciones:leer',
  'evaluaciones:gestionar',
  'classroom:conectar',
  'classroom:pull',
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'compliance:leer',
  'compliance:gestionar',
  'compliance:expurgar',
  'cuenta:leer',
  'cuenta:actualizar',
  'docentes:administrar',
  'comercial:tenants:leer',
  'comercial:tenants:gestionar',
  'comercial:planes:leer',
  'comercial:planes:gestionar',
  'comercial:suscripciones:leer',
  'comercial:suscripciones:gestionar',
  'comercial:licencias:leer',
  'comercial:licencias:gestionar',
  'comercial:licencias:revocar',
  'comercial:campanas:leer',
  'comercial:campanas:gestionar',
  'comercial:cupones:leer',
  'comercial:cupones:gestionar',
  'comercial:metricas:leer',
  'comercial:cobranza:leer',
  'comercial:cobranza:gestionar',
  'comercial:auditoria:leer',
  'recuperacion:leer',
  'recuperacion:reconstruir'
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const ROLES = [
  'admin',
  'docente',
  'coordinador',
  'auxiliar',
  'lector',
  'superadmin_negocio',
  'gestor_comercial',
  'finanzas',
  'soporte_comercial'
] as const;
export type Rol = (typeof ROLES)[number];

const PERMISOS_DOCENTE: Permiso[] = [
  'alumnos:leer',
  'alumnos:gestionar',
  'periodos:leer',
  'periodos:gestionar',
  'periodos:archivar',
  'banco:leer',
  'banco:gestionar',
  'banco:archivar',
  'plantillas:leer',
  'plantillas:gestionar',
  'plantillas:archivar',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:generar',
  'examenes:archivar',
  'examenes:regenerar',
  'examenes:descargar',
  'entregas:gestionar',
  'omr:analizar',
  'calificaciones:calificar',
  'calificaciones:publicar',
  'evaluaciones:leer',
  'evaluaciones:gestionar',
  'classroom:conectar',
  'classroom:pull',
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'compliance:leer',
  'compliance:gestionar',
  'cuenta:leer',
  'cuenta:actualizar',
  'recuperacion:leer',
  'recuperacion:reconstruir'
];

const PERMISOS_COORDINADOR: Permiso[] = [
  'alumnos:leer',
  'alumnos:gestionar',
  'periodos:leer',
  'periodos:gestionar',
  'periodos:archivar',
  'banco:leer',
  'banco:gestionar',
  'banco:archivar',
  'plantillas:leer',
  'plantillas:gestionar',
  'plantillas:archivar',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:generar',
  'examenes:archivar',
  'examenes:regenerar',
  'examenes:descargar',
  'entregas:gestionar',
  'evaluaciones:leer',
  'evaluaciones:gestionar',
  'classroom:conectar',
  'classroom:pull',
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'compliance:leer',
  'cuenta:leer',
  'cuenta:actualizar'
];

const PERMISOS_AUXILIAR: Permiso[] = [
  'alumnos:leer',
  'periodos:leer',
  'banco:leer',
  'plantillas:leer',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:descargar',
  'entregas:gestionar',
  'omr:analizar',
  'calificaciones:calificar',
  'evaluaciones:leer',
  'analiticas:leer',
  'compliance:leer',
  'cuenta:leer'
];

const PERMISOS_LECTOR: Permiso[] = [
  'alumnos:leer',
  'periodos:leer',
  'banco:leer',
  'plantillas:leer',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:descargar',
  'evaluaciones:leer',
  'analiticas:leer',
  'sincronizacion:listar',
  'compliance:leer',
  'cuenta:leer'
];

const PERMISOS_COMERCIAL_BASE: Permiso[] = [
  'comercial:tenants:leer',
  'comercial:planes:leer',
  'comercial:suscripciones:leer',
  'comercial:licencias:leer',
  'comercial:campanas:leer',
  'comercial:cupones:leer',
  'comercial:metricas:leer',
  'comercial:cobranza:leer',
  'comercial:auditoria:leer',
  'cuenta:leer'
];

const PERMISOS_GESTOR_COMERCIAL: Permiso[] = [
  ...PERMISOS_COMERCIAL_BASE,
  'comercial:tenants:gestionar',
  'comercial:planes:gestionar',
  'comercial:suscripciones:gestionar',
  'comercial:licencias:gestionar',
  'comercial:campanas:gestionar',
  'comercial:cupones:gestionar',
  'comercial:cobranza:gestionar'
];

const PERMISOS_FINANZAS: Permiso[] = [
  ...PERMISOS_COMERCIAL_BASE,
  'comercial:suscripciones:gestionar',
  'comercial:cupones:gestionar',
  'comercial:cobranza:gestionar'
];

const PERMISOS_SOPORTE_COMERCIAL: Permiso[] = [
  ...PERMISOS_COMERCIAL_BASE,
  'comercial:tenants:gestionar',
  'comercial:suscripciones:gestionar',
  'comercial:licencias:gestionar'
];

const PERMISOS_SUPERADMIN_NEGOCIO: Permiso[] = [...PERMISOS];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  admin: [...PERMISOS],
  docente: PERMISOS_DOCENTE,
  coordinador: PERMISOS_COORDINADOR,
  auxiliar: PERMISOS_AUXILIAR,
  lector: PERMISOS_LECTOR,
  superadmin_negocio: PERMISOS_SUPERADMIN_NEGOCIO,
  gestor_comercial: PERMISOS_GESTOR_COMERCIAL,
  finanzas: PERMISOS_FINANZAS,
  soporte_comercial: PERMISOS_SOPORTE_COMERCIAL
};

export function normalizarRoles(roles: unknown): Rol[] {
  const lista = Array.isArray(roles) ? roles.map((rol) => String(rol).trim()) : [];
  return lista.filter((rol): rol is Rol => (ROLES as readonly string[]).includes(rol));
}

export function permisosParaRoles(roles: unknown): Set<Permiso> {
  const rolesNormalizados = normalizarRoles(roles);
  const permisos = new Set<Permiso>();
  rolesNormalizados.forEach((rol) => {
    PERMISOS_POR_ROL[rol].forEach((permiso) => permisos.add(permiso));
  });
  return permisos;
}

export function permisosComoLista(roles: unknown): Permiso[] {
  return Array.from(permisosParaRoles(roles)).sort();
}

export function tienePermiso(roles: unknown, permiso: Permiso): boolean {
  return permisosParaRoles(roles).has(permiso);
}
