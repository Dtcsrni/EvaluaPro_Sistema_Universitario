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

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del backend docente y sus contratos API.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../../../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../../../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-23.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
