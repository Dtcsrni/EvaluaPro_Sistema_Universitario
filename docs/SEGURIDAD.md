# Seguridad (OWASP API Top 10 2023)

## Checklist base
- Autorizacion por objeto: cada docente solo accede a su grupo/periodo.
- Autenticacion simple y robusta: JWT para docentes y codigos temporales para alumnos.
- Validacion de payload: Zod en rutas criticas.
- Rate limiting: express-rate-limit.
- Sanitizacion de entradas: express-mongo-sanitize.
- Registro y auditoria: logs de cambios y accesos.
- Secretos fuera del repo: usar `.env` y secret managers.
- Transporte seguro: HTTPS en cloud y en red local confiable.
- Manejo de errores: sin filtrar detalles internos.
- Backup y retencion: politicas claras y purga controlada.
- Sync cloud protegido con API key.

## Recomendaciones adicionales
- Hash de contrasenas con Argon2/bcrypt.
- Codigo alumno: 12h y 1 uso (configurable).
- CORS restringido a origenes autorizados.
- Monitoreo de intentos fallidos y bloqueo temporal.
