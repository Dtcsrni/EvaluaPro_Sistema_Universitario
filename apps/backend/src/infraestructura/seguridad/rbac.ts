/**
 * Catalogo central de roles y permisos (RBAC).
 *
 * Nota: Los permisos se usan tanto para enforcement (middleware)
 * como para devolver el perfil de accesos al frontend.
 */
export const PERMISOS = [
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
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'cuenta:leer',
  'cuenta:actualizar',
  'docentes:administrar'
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const ROLES = ['admin', 'docente', 'coordinador', 'auxiliar', 'lector'] as const;
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
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'cuenta:leer',
  'cuenta:actualizar'
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
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
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
  'analiticas:leer',
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
  'analiticas:leer',
  'sincronizacion:listar',
  'cuenta:leer'
];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  admin: [...PERMISOS],
  docente: PERMISOS_DOCENTE,
  coordinador: PERMISOS_COORDINADOR,
  auxiliar: PERMISOS_AUXILIAR,
  lector: PERMISOS_LECTOR
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

