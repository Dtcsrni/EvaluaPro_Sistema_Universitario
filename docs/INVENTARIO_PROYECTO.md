# Inventario Tecnico del Proyecto

Fecha de corte: 2026-03-20
Version tecnica objetivo: `1.0.0`
Version visible objetivo: `1.0.0b`

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

## 2.1) Footprint y clasificacion del corte 2026-03-20
- Runtime `prod` activo:
  - `evaluapro_sistema_universitario-api_docente_prod`: `1.62 GB`
  - `evaluapro_sistema_universitario-web_docente_prod`: `93.6 MB`
  - `mongo`: `1.29 GB`
  - volumenes Mongo activos: `212.9 MB`
- Runtime backend inspeccionado:
  - `/ms-playwright`: `364 MB`
  - `apps/backend/node_modules`: `160 MB`
  - wrapper/ejecutable de Chromium fijado por Docker Compose en `/usr/local/bin/evaluapro-chromium`
- Repo local bruto: `994.8 MB`.
- Repo operativo sin componentes regenerables: `113.27 MB`.
- Componentes regenerables/no operativos por defecto:
  - `node_modules/`
  - `reports/`
  - `logs/`
  - `test-results/`
  - datasets `omr_samples*`
  - build cache Docker
- Política de almacenamiento de exámenes generados:
  - solo persisten como `ExamenGenerado` las generaciones reales (`individual`, `lote`)
  - la preview no crea documentos persistentes y su caché temporal está acotada
  - el expurgo deja metadata mínima y elimina PDF principal, booklet/OMR, ZIPs y JSONs asociados
  - listados/detalles exponen `retentionStatus`, `artifactsPurgedAt` y `downloadAvailable`
- Operación Windows endurecida:
  - broker único `scripts/launcher-broker.ps1` para shortcuts, Hub y dashboard
  - manifiesto local `logs/installation.manifest.json` como verdad operativa de instalación
  - shortcuts oficiales esperados:
    - `EvaluaPro - Dev`
    - `EvaluaPro - Prod`
    - `EvaluaPro - Hub`
  - splash sincronizado contra bootstrap state por `runId`
  - singleton por instalación en tray/control-plane
- Licenciamiento portable local:
  - licencia firmada offline `portable-license.epl`
  - llaves públicas locales por `kid`
  - claims comerciales locales para administrador premium multi-equipo
  - step-up mínimo local:
    - TOTP
    - recovery codes de un uso
    - sesión elevada con cache sellada por máquina
    - estado reflejado en `licenseState` y `logs/installation.manifest.json`
- Tema/marca transversal:
  - preferencia compartida `ep.theme.preference`
  - modos `auto`, `light`, `dark` en frontend y dashboard
  - iconografía premium inicial para dashboard, favicon docente y Hub

## 3) Contratos activos
- API HTTP: `/api/*`
- Rutas versionadas retiradas del runtime
- OMR: contrato sin `engineUsed`
- PDF: contrato TV4 canonico con paginacion moderna y paridad estructural A050929D
- Sync: `schemaVersion: 2`, fingerprint `sync-v2-lww-updatedAt-schema2`
- Control plane local:
  - `/api/status` expone `installationState`, `shortcutState`, `licenseState`, `bootstrapState`
  - launchers Windows consumen bootstrap state por archivo en `logs/`

## 4) Gates de calidad
- `npm run lint`
- `npm run typecheck`
- `npm run test:frontend:ci`
- `npm run test:coverage:ci`
- `npm run test:tdd:enforcement:ci`
- `npm run test:backend:ci`
- `npm run test:portal:ci`
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
- Docker runtime docente adelgazado:
  - backend multistage sin toolchain de compilacion en runtime
  - runtime backend aislado al workspace `apps/backend`
  - Playwright instalado con `chromium --no-shell` y binario estable expuesto para PDF exacto
  - frontend servido como bundle estatico con `nginx`
  - contexto de build endurecido con exclusiones de QA/logs/datasets

## 7) Evidencia y release
- QA manifest: `reports/qa/latest/manifest.json`
- Gate arquitectura limpia: `reports/qa/latest/clean-architecture.json`
- Gate estable: `docs/RELEASE_GATE_STABLE.md`
- Paquete estable actual:
  - `docs/release/evidencias/1.0.0/manifest.json`
  - `docs/release/evidencias/1.0.0/timeline.md`
  - `docs/release/evidencias/1.0.0/metrics_snapshot.txt`
  - `docs/release/evidencias/1.0.0/integridad_sha256.json`
  - `docs/release/evidencias/1.0.0/rollback_readiness.json`
- Decision gate estable actual:
  - `reports/release/stable-gate/1.0.0/decision.json`
  - estado actual: `No-Go`
  - causa: gate humano de producción pendiente por falta de credenciales/IDs reales fuera del repo
- Evidencia Windows/local adicional:
  - `logs/installation.manifest.json`
  - `logs/bootstrap-state-*.json`
  - `C:\ProgramData\EvaluaPro\security\portable-license.epl`
  - `C:\ProgramData\EvaluaPro\security\stepup.config.json`
  - `C:\ProgramData\EvaluaPro\security\stepup.session.json`

## 8) Corte release blockers 2026-03-20
- Gates obligatorios `AGENTS.md`: todos en verde
  - `lint`
  - `typecheck`
  - `test:frontend:ci`
  - `test:coverage:ci`
  - `test:tdd:enforcement:ci`
  - `test:backend:ci`
  - `test:portal:ci`
  - `perf:check`
  - `pipeline:contract:check`
- Smokes/contratos específicos del corte:
  - `node --test scripts/tests/perf-contract.test.mjs`
  - `node --test scripts/tests/installer-hub-contract.test.mjs`
  - `node --test scripts/tests/dashboard-ui.test.mjs`
  - `node --test scripts/tests/windows-release-smoke.test.mjs`
  - `npm run test:installer-hub:contract`
  - `npm run test:dashboard:repair`
  - `npm run test:dashboard:ui`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Port 4519 -Force`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-installation-manifest.ps1 -Port 4519`
  - `npm run status`
- Acceptance Windows cerrada con dos niveles de evidencia:
  - repair aislado/agresivo en `InstallDir` temporal, sin Docker ni datos reales
  - validacion activa no destructiva sobre la instalacion local del equipo
- Contratos tecnicos reforzados para smoke/repair:
  - overrides de release local y modo simulado para Installer Hub
  - soporte de rutas aisladas de shortcuts/security root
  - manifiesto local enriquecido con `stepUpMethods`, `recoveryCodesRemaining`, `lastStepUpAt`
  - `installationState` reconoce instalaciones basadas en manifiesto aun sin registro MSI
- Promoción estable 1.0.0:
  - contrato `version` vs `displayVersion` implementado en GUI y manifiestos
  - validación automática de evidencia estable endurecida con `prod-flow-evidence`
  - rollback readiness formalizado como artefacto obligatorio
  - evidencia Windows previa reutilizada desde `docs/release/evidencias/1.0.0-beta.1/windows-release-smoke-2026-03-20.md`
  - la promoción queda bloqueada honestamente en `No-Go` hasta ejecutar el gate humano real de producción
- Follow-up CI/CD posterior al push inicial:
  - `CI Checks` corregido con pruebas de contrato del Installer Hub compatibles con Linux cuando el runner no soporta DPAPI.
  - `CI Portal Module` corregido con cobertura adicional del logger del portal.
  - `CI Frontend Module` corregido con cobertura adicional del sistema de tema y de la vista/helpers de versión.
  - el siguiente push de saneamiento debe dejar los tres workflows remotos sin deuda conocida.
