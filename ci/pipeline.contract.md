# Pipeline Contract (Platform Agnostic)

## Purpose
Define a single CI/CD contract that any runner can execute 1:1 (GitHub Actions, GitLab CI, Jenkins, Azure, local orchestrator).

## Execution profiles

### Profile `core` (blocking for every PR/push)
1. `setup`
2. `contract-check`
3. `lint`
4. `typecheck`
5. `test`
6. `ux-quality-check`
7. `coverage-check`
8. `tdd-enforcement-check`
9. `build`
10. `docs-check`
11. `security-scan`
12. `legal-docs-check`
13. `pii-leak-check`
14. `retention-policy-check`

### Profile `extended` (blocking for `main`, `release/*`, `schedule`, or manual dispatch)
1. `setup`
2. `flujo-docente-check`
3. `dataset-prodlike-check`
4. `omr-tv3-extended-gate`
5. `docente-alumno-e2e-check`
6. `global-grade-check`
7. `pdf-print-check`
8. `ux-visual-check`
9. `perf-check`
10. `perf-business-check`
11. `clean-architecture-check`
12. `qa-manifest`
13. `dsr-flow-test`
14. `compliance-evidence`

### Profile `package`
1. `package`

## Modular execution (independent workflows)
Recommended module workflows:
- `CI Backend Module` -> backend lint/typecheck/test/coverage/tdd/build
- `CI Frontend Module` -> frontend lint/typecheck/test/ux/coverage
- `CI Portal Module` -> portal lint/typecheck/test/coverage/tdd/build
- `CI Docs Module` -> contract/docs/diagrams/routes checks

Policy:
- A module failure fails that module workflow only.
- Sibling module workflows continue and publish their own status.
- A global integrator workflow (`CI Checks`) remains the release-gating source of truth.

## Stage contract

### setup
- Install Node >=24
- Install dependencies with `npm ci`

### contract-check
- Command: `npm run pipeline:contract:check`

### lint
- Command: `npm run lint`

### typecheck
- Command: `npm run typecheck`

### test
- Commands:
  - `npm run test:backend:ci`
  - `npm run test:portal:ci`
  - `npm run test:frontend:ci`
  - `npm run test:client:proyectos:ci`

### ux-quality-check
- Command: `npm run test:ux-quality:ci`

### coverage-check
- Command: `npm run test:coverage:ci`

### tdd-enforcement-check
- Commands:
  - `npm run test:coverage:exclusions:debt`
  - `npm run test:coverage:diff`
- Default threshold: `DIFF_COVERAGE_MIN=90`

### flujo-docente-check
- Command: `npm run test:flujo-docente:ci`

### dataset-prodlike-check
- Command: `npm run test:dataset-prodlike:ci`
- Output: `reports/qa/latest/dataset-prodlike.json`

### omr-tv3-extended-gate
- Command: `npm run test:omr:tv3:gate:ci`
- Output: `reports/qa/latest/omr-tv3-gate-wrapper.json`

### docente-alumno-e2e-check
- Command: `npm run test:e2e:docente-alumno:ci`
- Output: `reports/qa/latest/e2e-docente-alumno.json`

### global-grade-check
- Command: `npm run test:global-grade:ci`
- Output: `reports/qa/latest/global-grade.json`

### pdf-print-check
- Commands:
  - `npm run test:pdf-print:ci`
  - `npm run test:pdf-visual:ci`
- Output: `reports/qa/latest/pdf-print.json`

### ux-visual-check
- Commands:
  - `npm run test:ux-quality:ci`
  - `npm run test:ux-visual:ci`
  - `npm run test:e2e:journeys:ci`
- Output: `reports/qa/latest/ux-visual.json`

### perf-check
- Command: `npm run perf:check`
- Runner prerequisite (Linux CI): `npm install --no-save --include=optional --os=linux --cpu=x64 sharp`
- Input: `docs/perf/baseline.json`
- Output: `reports/perf/latest.json`

### perf-business-check
- Command: `npm run perf:check:business`
- Input: `docs/perf/baseline.business.json`
- Output: `reports/perf/business.latest.json`

### clean-architecture-check
- Command: `npm run qa:clean-architecture:strict`
- Output: `reports/qa/latest/clean-architecture.json`

### docs-check
- Commands:
  - `npm run docs:check`
  - `npm run diagramas:check`
  - `npm run diagramas:render`
  - `npm run diagramas:consistencia:check`
  - `npm run routes:check`

### security-scan
- Commands:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
  - `npm audit --omit=dev --audit-level=critical --json > npm-audit-report.json`
  - `npm run security:audit`

### legal-docs-check
- Command: `npm run test:compliance:legal-docs`

### pii-leak-check
- Command: `npm run test:compliance:pii`

### retention-policy-check
- Command: `npm run test:compliance:retention`

### qa-manifest
- Command: `npm run test:qa:manifest`
- Output: `reports/qa/latest/manifest.json`

### dsr-flow-test
- Command: `npm run test:compliance:dsr-flow`
- Output: backend integration test evidence

### compliance-evidence
- Command: `npm run compliance:evidence:generate`
- Output:
  - `reports/qa/latest/compliance-manifest.json`
  - `reports/qa/latest/data-inventory.json`
  - `reports/qa/latest/security-controls-evidence.json`
  - `reports/qa/latest/legal-docs-version.json`

### build
- Command: `npm run build`

### package
- Build container images or archive artifacts for:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`

### beta-release
- Command:
  - `npm run release:validate:beta -- --version=<version> --head-sha=<sha> --base-ref=<baseRef>`
- Semantics:
  - publica prerelease beta solo cuando el diff del corte es significativo
  - no bloquea la promocion estable
  - reutiliza la misma evidencia de CI completa como prerrequisito operacional
- Outputs:
  - `reports/release/beta/<betaVersion>/decision.json`

## Caches
- `~/.npm`
- Optional build caches (`*.tsbuildinfo`, test cache) without mutating source

## Artifacts
- Build outputs per workspace
- Test reports
- `reports/perf/latest.json`
- `reports/perf/business.latest.json`
- `reports/qa/latest/**`

## Quality gates policy
- Every PR, when used, should pass `core`.
- Direct updates to `main` in non-stable stage should pass `core` whenever feasible.
- `main`/`release/*` should pass `core` + `extended` before stable promotion.
- `package` remains isolated in its own workflow.

## Exit criteria
- A PR, when used, is green only when all `core` stages pass.
- Mainline/release is green only when all `core` + `extended` stages pass.
- Stable release candidates require 10 consecutive green runs without flaky infra failures >10%.

## Stable release gate (post-CI)
Required:
1. 10 consecutive green CI runs.
2. Human production teacher flow completed.
3. Automated evidence package:
   - `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
4. Evidence committed under:
   - `docs/release/evidencias/<version>/`
