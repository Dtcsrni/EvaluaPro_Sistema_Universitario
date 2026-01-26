# Roles, accesos y permisos (RBAC)

Este documento describe el sistema de roles/permisos para el backend docente y su uso en frontend.

## Resumen

- Los roles se asignan en `Docente.roles`.
- El token JWT incluye roles (emitido al login/registro/refresco).
- El API valida permisos en cada ruta protegida con middleware.
- El endpoint `/api/autenticacion/perfil` devuelve `roles` y `permisos` efectivos.
- El frontend oculta secciones según `permisos` (la validación real se hace en el backend).

## Roles disponibles

- `admin`: acceso total + gestión de docentes.
- `docente`: rol operativo completo (flujo estándar de creación, aplicación y calificación).
- `coordinador`: gestiona periodos/alumnos/banco/plantillas y generación; sin calificar ni OMR.
- `auxiliar`: lectura + entrega/OMR/calificación (apoyo de evaluación).
- `lector`: solo lectura (consulta de datos y reportes).

## Permisos disponibles

- `alumnos:leer`, `alumnos:gestionar`
- `periodos:leer`, `periodos:gestionar`, `periodos:archivar`
- `banco:leer`, `banco:gestionar`, `banco:archivar`
- `plantillas:leer`, `plantillas:gestionar`, `plantillas:archivar`, `plantillas:previsualizar`, `plantillas:eliminar_dev`
- `examenes:leer`, `examenes:generar`, `examenes:archivar`, `examenes:regenerar`, `examenes:descargar`
- `entregas:gestionar`
- `omr:analizar`
- `calificaciones:calificar`, `calificaciones:publicar`
- `analiticas:leer`
- `sincronizacion:listar`, `sincronizacion:exportar`, `sincronizacion:importar`, `sincronizacion:push`, `sincronizacion:pull`
- `cuenta:leer`, `cuenta:actualizar`
- `docentes:administrar`

## Mapeo de permisos por rol (resumen)

- `admin`: todos los permisos.
- `docente`: todos excepto `docentes:administrar` y `plantillas:eliminar_dev` (dev).
- `coordinador`: sin `omr:analizar`, `calificaciones:calificar` ni `calificaciones:publicar`.
- `auxiliar`: lectura + `entregas:gestionar`, `omr:analizar`, `calificaciones:calificar`.
- `lector`: solo lectura (sin escritura, sin OMR/calificación).

El detalle exacto se mantiene en `apps/backend/src/infraestructura/seguridad/rbac.ts`.

## Endpoints admin (gestión de docentes)

Requieren `docentes:administrar`:

- `GET /api/admin/docentes?activo=1&q=texto&limite=50&offset=0`
- `POST /api/admin/docentes/:docenteId` con body `{ roles?: string[], activo?: boolean }`

## Notas de seguridad

- El backend es la fuente de verdad y bloquea todo acceso sin permisos.
- El frontend muestra/oculta secciones y deshabilita acciones segun `permisos` (formularios, botones y acciones criticas).
- `plantillas:eliminar_dev` solo se permite en `NODE_ENV=development`.

## Contraste UI (WCAG)

- Script de verificacion: `scripts/contrast-check.mjs`
- Ejecucion: `node scripts/contrast-check.mjs`
- Revisa pares tipicos (texto/superficie, chips, estados, botones) en temas claro/oscuro.

## Ejemplo de respuesta de perfil

```json
{
  "docente": {
    "id": "...",
    "nombreCompleto": "Ejemplo",
    "correo": "docente@ejemplo.test",
    "roles": ["docente"],
    "permisos": ["periodos:leer", "periodos:gestionar", "..."]
  }
}
```
