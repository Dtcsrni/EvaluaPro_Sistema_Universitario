# Checklist de Seguridad Operativa

## Configuración y secretos
- [ ] Secretos de cloud almacenados en secret manager (no en repositorio).
- [ ] `.env` local no versionado.
- [ ] `.env.example` actualizado y sin secretos reales.
- [ ] Rotación de `JWT_SECRETO` y API keys documentada.

## Red y hardening
- [ ] CORS restringido por entorno.
- [ ] `helmet` activo.
- [ ] `x-powered-by` deshabilitado.
- [ ] Rate limit activo en rutas sensibles.

## Pipeline y dependencias
- [ ] `npm audit --audit-level=high` en pipeline.
- [ ] `security-scan` ejecuta `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`.
- [ ] `security-scan` publica `npm-audit-report.json` como artefacto CI.
- [ ] Política mensual de actualización de dependencias.
- [ ] Bloqueo de merge con gates mínimos.

## Datos y privacidad
- [ ] Logs sin exposición de secretos/tokens.
- [ ] Request IDs presentes para trazabilidad.
- [ ] Validación estricta de payloads en endpoints sensibles.
- [ ] Endpoints `/api/compliance/*` operativos y auditables.
- [ ] Flujo ARCO probado (`test:compliance:dsr-flow`).
- [ ] Gate de fuga PII en repositorio (`test:compliance:pii`) en verde.
- [ ] Exportaciones de lista académica incluyen manifiesto de integridad SHA-256.
- [ ] Verificación de hash previa a distribución de CSV/DOCX.

## Operación y respuesta
- [ ] Health y readiness monitoreados.
- [ ] Métricas y alertas mínimas operativas.
- [ ] Alertas mínimas activas desde `ops/observabilidad/alert.rules.yml`.
- [ ] Runtime Docker validado por CLI (`docker version` / `docker context`) y no por dependencia a GUI.
- [ ] Runbook de incidentes disponible (`docs/RUNBOOK_OPERACION.md`).
- [ ] Gate de promoción estable con docente humano en producción ejecutado y evidenciado en `docs/release/evidencias/<version>/`.
