# DevOps Baseline

Fecha de baseline: 2026-02-13.

## Topología operativa (local + cloud mínimo)
1. Local docente (Docker Compose):
- `mongo_local`
- `api_docente_local`
- `web_docente_local`
- `mongo_express_local` (opcional)
2. Perfil prod local:
- `api_docente_prod`
- `web_docente_prod`
3. Cloud mínimo:
- `apps/portal_alumno_cloud` desplegable en servicio gestionado.

## Entrega y verificación
- Comandos raíz disponibles para CI:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:ci`
  - `npm run test:coverage:exclusions:debt`
  - `npm run test:coverage:diff`
- Contrato agnóstico de pipeline:
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`
- Workflows separados por responsabilidad:
  - `.github/workflows/ci.yml` (`CI Checks`): quality gates bloqueantes.
  - `.github/workflows/ci-policy-audit.yml` (`CI Policy Audit`): auditoría consolidada de contrato/ruleset/políticas, incluyendo trazabilidad IA, con artefacto de evidencia.
  - `.github/workflows/package.yml` (`Package Images`): empaquetado Docker + `image-digests.txt`.
  - `.github/workflows/autogen-docs.yml` (`Auto-Generate Docs`): autogeneracion y versionado de docs/diagramas.
  - `.github/workflows/ci-backend.yml` (`CI Backend Module`): pipeline aislado de backend.
  - `.github/workflows/ci-frontend.yml` (`CI Frontend Module`): pipeline aislado de frontend.
  - `.github/workflows/ci-portal.yml` (`CI Portal Module`): pipeline aislado de portal alumno cloud.
  - `.github/workflows/ci-docs.yml` (`CI Docs Module`): pipeline aislado de docs/diagramas/rutas.

## Aislamiento operativo CI (modular)
- Un fallo en un modulo no cancela la ejecucion de los demas workflows modulares.
- Los modulos no exitosos reportan fallo localizado y los modulos sanos siguen entregando señal en verde.
- `CI Checks` se mantiene como señal integradora global para release gating.

## Politica actual de rama main
  - el ruleset remoto `main-v1b-minimo` permanece definido, pero con `enforcement` deshabilitado.
  - no hay pull request obligatorio para publicar en `main` durante la etapa no estable.
  - los workflows `CI Checks`, `CI Installer Windows` y `Security CodeQL` siguen siendo referencia de calidad recomendada, no bloqueo de push.
  - los workflows modulares con filtros por `paths` se mantienen como señal diagnóstica por dominio.
  - cuando el proyecto entre a fase estable, se puede reactivar el ruleset y volver a exigir PR + checks requeridos.

## Fallback y resiliencia
- Fallback de pipeline: aislamiento por workflow (degradacion por dominio, no falla sistémica de toda la malla).
- Hardening de dependencias nativas en backend module:
  - instalacion explicita de `sharp` linux-x64 antes de pruebas para evitar errores de runtime nativo en runners Linux.
- Politica versionada de Dependabot:
  - `.github/dependabot.yml` deshabilita PRs automaticas de versionado (`open-pull-requests-limit: 0`) para preservar la operacion de rama unica sobre `main`.
  - Los bumps de mantenimiento quedan bajo integracion manual programada.
  - Las alertas/security updates siguen gobernadas por GitHub y no dependen de abrir ramas de versionado recurrentes.

## Enforcements TDD activos
- Diff coverage bloqueante en CI (`DIFF_COVERAGE_MIN=90`).
- Registro de deuda temporal de exclusiones de coverage:
  - `docs/tdd-exclusions-debt.json`
- Verificador bloqueante de deuda vencida:
  - `npm run test:coverage:exclusions:debt`

## Seguridad de configuración
- Local: `.env` y `.env.example`.
- Cloud: secretos en secret manager del proveedor.
- Validación de entorno:
  - `npm run security:env:check`
 - SAST:
   - `.github/workflows/security-codeql.yml` (`Security CodeQL`).
 - Secret scanning:
   - habilitar en GitHub Advanced Security cuando el plan lo permita.
   - fallback operativo: auditoria de secretos por proceso manual documentado en release/handoff.
 - Compliance:
   - `npm run test:compliance:policy`
   - `npm run test:compliance:dsr-flow`
   - `npm run compliance:evidence:generate`

## Observabilidad mínima
- Health:
  - backend: `/api/salud`, `/api/salud/live`, `/api/salud/ready`
  - portal: `/api/portal/salud`, `/api/portal/salud/live`, `/api/portal/salud/ready`
- Métricas Prometheus:
  - backend: `/api/salud/metrics`
  - portal: `/api/portal/metrics`
- Logging estructurado JSON con `requestId`.

## Criterio de salida Fase 0/Fase 1
- Baseline versionado + contrato pipeline utilizable en cualquier runner.

## Estado operativo del corte (2026-02-13)
- Security scan estricto activo:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
  - `npm audit --audit-level=high --json > npm-audit-report.json`
- Evidencias operativas centralizadas en `docs/INVENTARIO_PROYECTO.md`.
- Trazabilidad multi-sesion de agentes centralizada en:
  - `AGENTS.md`
  - `docs/IA_TRAZABILIDAD_AGENTES.md`
  - `docs/handoff/trace.schema.json`
- Validación dedicada del contrato IA:
  - `npm run test:ia:traceability`
