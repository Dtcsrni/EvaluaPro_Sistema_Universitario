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
  - `.github/workflows/ci-policy-audit.yml` (`CI Policy Audit`): auditoría consolidada de contrato/ruleset/políticas con artefacto de evidencia.
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

## Proteccion de rama main (Ruleset activo)
  - bloqueo de borrado de rama (`deletion`),
  - bloqueo de force-push (`non_fast_forward`),
  - pull request obligatorio sin aprobación mínima,
  - descarte de approvals stale al recibir nuevos commits,
  - resolucion de conversaciones no obligatoria,
  - branch actualizado obligatoriamente antes de merge (`strict required status checks policy`).
  - `Verificaciones Core (PR bloqueante)` (workflow `CI Checks`).
  - `Verificaciones Extendidas (Main/Release)` (workflow `CI Checks`, en `main/release`).
  - `Installer Windows (MSI + Bundle)` (workflow `CI Installer Windows`).
  - `Security CodeQL (JS/TS)` (workflow `Security CodeQL`).
  - los workflows modulares con filtros por `paths` no se marcan como required para evitar bloqueos por checks no disparados.
  - contrato de ruleset endurecido: se validan como obligatorios `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks` y se rechaza configurar `Backend Module`, `Frontend Module`, `Portal Module` o `Docs Module` como checks requeridos de merge.
  - validacion automatizada del ruleset con:
    - `npm run ruleset:check`
    - `npm run ruleset:apply` (idempotente, requiere token mantenedor).
  - auditoria consolidada de política CI:
    - `npm run ci:policy:audit` (contrato + ruleset policy tests + release policy tests + security policy tests)
    - `npm run ci:policy:audit:remote` (incluye además verificación del ruleset remoto en GitHub)

## Fallback y resiliencia
- Fallback de pipeline: aislamiento por workflow (degradacion por dominio, no falla sistémica de toda la malla).
- Hardening de dependencias nativas en backend module:
  - instalacion explicita de `sharp` linux-x64 antes de pruebas para evitar errores de runtime nativo en runners Linux.

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
   - fallback operativo: auditoria de secretos por proceso manual documentado en PR/release.
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

