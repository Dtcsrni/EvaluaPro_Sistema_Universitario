# Seguridad

Estado de controles de seguridad implementados en el sistema.

## Controles activos
- Autenticacion docente por JWT + sesion refrescable.
- Rutas docentes protegidas revalidan `activo` y roles persistidos al usar JWT para bloquear tokens vigentes de cuentas desactivadas o con privilegios reducidos.
- Autorizacion por permisos (RBAC) en rutas protegidas.
- Validacion strict de payloads con Zod.
- Rate limit configurable (general, credenciales, refresh).
- Hardening HTTP:
  - Helmet
  - `x-powered-by` deshabilitado
- Sanitizacion de entrada para prevenir operadores inseguros en consultas.
- Manejo central de errores sin fuga de detalle interno.
- API key para operaciones internas de sync/push/pull con portal cloud.
- Modulo de cumplimiento (`/api/compliance/*`) para estado, ARCO/DSR, expurgo y auditoria.
- SAST con CodeQL en CI:
  - workflow `.github/workflows/security-codeql.yml`
  - check requerido: `Security CodeQL (JS/TS)` para merge a `main`.

## Seguridad OMR y calificacion
- OMR entrega estado de analisis (`ok`, `requiere_revision`, `rechazado_calidad`).
- Calificacion registra auditoria OMR (`omrAuditoria`).
- Si hay `respuestasDetectadas`, los aciertos se derivan de esas respuestas (evita sobreescritura manual inconsistente).

## Seguridad de datos
- Segregacion por docente en consultas y mutaciones.
- Aislamiento multi-tenant verificado por pruebas de integracion.
- Codigos de acceso alumno con expiracion y control de uso.

## Recomendaciones operativas
- En produccion, definir secretos via gestor seguro (no `.env` en texto plano compartido).
- Rotar API keys y secretos JWT periodicamente.
- Restringir CORS por ambiente.
- Ejecutar `npm run test:ci` antes de desplegar.
- Ejecutar `npm run test:security:policy` al cambiar workflows de seguridad.
- Ejecutar `npm run test:compliance:policy` y `npm run test:compliance:dsr-flow` antes de release.
- Monitorear logs de errores y de accesos fallidos.
- Habilitar secret scanning en GitHub Advanced Security cuando el plan lo permita; si no, registrar fallback manual en checklist de release.

## Riesgos conocidos
- Captura OMR depende de calidad de imagen fisica (enfoque, iluminacion, encuadre).
- El modo `requiere_revision` debe formar parte del procedimiento operativo docente.
