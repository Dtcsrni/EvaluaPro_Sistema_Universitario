# modulo autenticacion

Módulo de dominio del backend docente (rutas, controlador, servicios, modelos y validaciones).

Ruta: `apps/backend/src/modulos/modulo_autenticacion`.

## Archivos clave
- `controladorAutenticacion.ts`
- `middlewareAutenticacion.ts`
- `middlewarePermisos.ts`
- `modeloDocente.ts`
- `modeloSesionDocente.ts`
- `rutasAutenticacion.ts`
- `seedAdmin.ts`
- `servicioGoogle.ts`
- `servicioHash.ts`
- `servicioSesiones.ts`
- `servicioTokens.ts`
- `validacionesAutenticacion.ts`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- Respetar multi-tenancy por docente y contratos de error/validación.

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.
