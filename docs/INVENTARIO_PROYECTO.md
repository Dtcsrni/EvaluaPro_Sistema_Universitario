# Inventario Tecnico del Proyecto

Fecha de corte: 2026-02-19
Version objetivo: `1.0.0-beta.0`

## 1) Alcance
- Monorepo completo: `apps/*`, `scripts/*`, `docs/*`, `ci/*`, `.github/workflows/*`.
- Contrato unico moderno sin rutas/versiones heredadas.

## 2) Estructura actual
- Apps:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- CI/CD:
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`
  - `.github/workflows/ci.yml`
  - `.github/workflows/ci-frontend.yml`
  - `.github/workflows/package.yml`
- QA:
  - `reports/qa/latest/*`
  - `reports/perf/latest.json`

## 3) Contratos activos
- API HTTP: `/api/*`
- Rutas versionadas retiradas del runtime
- OMR: contrato sin `engineUsed`
- PDF: contrato TV4 canonico con paginacion moderna y paridad estructural A050929D
- Sync: `schemaVersion: 2`, fingerprint `sync-v2-lww-updatedAt-schema2`

## 4) Gates de calidad
- `npm run lint`
- `npm run typecheck`
- `npm run test:frontend:ci`
- `npm run test:coverage:ci`
- `npm run perf:check`
- `npm run pipeline:contract:check`
- `npm run qa:clean-architecture:strict`

## 5) CI workflows
- `CI Checks`: core + extended
- `CI Frontend Module`: frontend aislado
- `Package Images`: empaquetado Docker

## 6) Estado de limpieza
- Sin middleware de versionado/adopcion antiguos.
- Sin rutas productivas `v2`.
- Sin archivos de rollout/adopcion retirados.
- Sin servicio PDF antiguo en runtime.

## 7) Evidencia y release
- QA manifest: `reports/qa/latest/manifest.json`
- Gate arquitectura limpia: `reports/qa/latest/clean-architecture.json`
- Gate estable: `docs/RELEASE_GATE_STABLE.md`
