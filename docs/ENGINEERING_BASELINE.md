# Engineering Baseline

Fecha de baseline: 2026-03-22
Version tecnica: `1.0.0`
Version visible GUI: `1.0.0b`

## Estado vigente
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- API canonica unificada en `/api/*`.
- Trazabilidad IA agnostica endurecida:
  - contrato canonico en `docs/handoff/trace.schema.json`
  - generacion dual por sesion (`.json` + `.md`)
  - semantica `draft|final`
  - `npm run ci:policy:audit` valida el contrato via `npm run test:ia:traceability`
- PWA frontend endurecida:
  - manifests `docente` y `alumno` con `id` estable y assets PNG/maskable dedicados
  - `window.__EVALUAPRO_PWA__` y `dataset` HTML publican modo, destino, versión e indicador `legacy`
  - `portal-sw.js` mantiene HTML y `/api/*` en red; solo cachea assets seguros del shell
- Dashboard local:
  - manifest PWA con `id` estable `/pwa/evaluapro/dashboard-local`, `launcherPreferred: true` y `offlineCapable: false`
  - `service worker` conserva `network-only` para navegación y `/api/*`
  - navegación `GET` ya no cae a una shell offline con acciones no ejecutables cuando el launcher local no existe
  - limpieza best-effort de SW/caches legacy para evitar PWAs Chromium obsoletas
- OMR y PDF operan en TV4 como contrato canonico, preservando el baseline visual A050929D.
- Sincronizacion con schema v2.
- Contrato CI alineado con gate `clean-architecture-check`.

## Footprint operativo 2026-03-19
- Runtime Docker `prod` adelgazado sin cambiar interfaces visibles:
  - `api_docente_prod`: `2.54 GB -> 1.98 GB -> 1.62 GB`
  - `web_docente_prod`: `312 MB -> 93.6 MB`
  - `mongo`: `1.29 GB` (sin cambio funcional)
- Runtime Docker total del stack activo:
  - antes: `4.36 GB`
  - despues del primer recorte: `3.58 GB`
  - despues del ajuste Playwright/runtime backend: `3.22 GB`
- Repo local:
  - bruto: `994.8 MB`
  - operativo sin caches/datasets regenerables: `113.27 MB`
- Runtime backend final inspeccionado:
  - `/ms-playwright`: `364 MB`
  - `node_modules` runtime backend: `160 MB`
  - smoke PDF Playwright dentro del contenedor: `14401 bytes`

## Corte de validacion 2026-03-20
- Versionado de promoción estable:
  - semver técnica consolidada en `1.0.0`
  - etiqueta visible unificada en `1.0.0b`
  - fuente única de verdad: `config/app-version.json`
  - frontend, dashboard, Hub y manifiesto local muestran `displayVersion`
- Estabilidad Windows release-blocker endurecida:
  - broker canónico de arranque `scripts/launcher-broker.ps1`
  - singleton por instalación para tray/launcher
  - splash orientado por bootstrap state real (`runId`)
  - shortcuts oficiales `Dev`, `Prod` y `Hub` regenerables post-install/post-repair
- Installer Hub como consola local de operación:
  - manifiesto `logs/installation.manifest.json`
  - clasificación de salud `ausente|incompleta|degradada|dañada|ok`
  - verificación/reparación/regeneración de accesos como contrato explícito
- Licencia portable local verificada:
  - archivo firmado `C:\ProgramData\EvaluaPro\security\portable-license.epl`
  - llaves públicas `C:\ProgramData\EvaluaPro\security\portable-license-public-keys.json`
  - titular emitido localmente: `I.S.C. Erick Renato Vega Ceron`
  - nivel: `Premium Administrador`
  - roles: `superadmin_negocio`, `admin`, `docente`, `developer`
  - step-up mínimo release-ready:
    - TOTP local obligatorio para acciones críticas
    - recovery codes de un uso
    - sesión elevada sellada por máquina
    - estado visible en manifiesto local y `licenseState`
- Rebrand inicial y contrato de tema:
  - dashboard + frontend comparten `ep.theme.preference`
  - soporte consistente `auto`, `light`, `dark`
  - iconografía/favicon premium inicial regenerada para dashboard/docente/hub
- Política de retención operativa activa para exámenes generados:
  - preview clásica endurecida con TTL `10 min`, limpieza cada `2 min` y máximo `10` archivos
  - `ExamenGenerado` conserva solo metadata mínima tras expurgo
  - retención por defecto configurada en `40` días
- Endpoint nuevo validado:
  - `POST /api/examenes/generados/purge`
- Pruebas nuevas validadas:
  - `tests/integracion/plantillasCrudYPreview.test.ts`
  - `tests/integracion/examenesRetention.test.ts`
- Smoke/contratos release Windows:
  - `scripts/tests/perf-contract.test.mjs`
  - `scripts/tests/installer-hub-contract.test.mjs`
  - `scripts/tests/dashboard-ui.test.mjs`
  - `scripts/tests/windows-release-smoke.test.mjs`
    - smoke aislado/agresivo sobre `InstallDir` temporal con repair headless
    - smoke no destructivo sobre la instalacion activa con broker + dashboard + status real
- Release Windows acceptance:
  - `repair` validado en entorno temporal aislado sin tocar Docker ni datos reales
  - `verify-installation` y `regenerate-shortcuts` validados sobre la instalacion activa
  - manifiesto local, shortcuts oficiales y `licenseState` verificados como contrato operativo compartido entre Hub y dashboard
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:frontend:ci` ✅
- `npm run test:coverage:ci` ✅
- `npm run test:tdd:enforcement:ci` ✅
- `npm run test:backend:ci` ✅
- `npm run test:portal:ci` ✅
- `npm run perf:check` ✅
- `npm run pipeline:contract:check` ✅
- `node --test scripts/tests/dashboard-sw.test.mjs scripts/tests/dashboard-pwa-contract.test.mjs scripts/tests/dashboard-ui.test.mjs` ✅
- `npm -C apps/frontend run test -- --run tests/pwa.contract.test.ts tests/portalSw.contract.test.ts` ✅
- `npm run test:release:policy` ✅
- `npm run test:ia:traceability` ✅
- `npm run release:validate:stable -- --version=1.0.0 --runs-fixture=docs/release/evidencias/1.0.0/ci-runs.fixture.json --installer-manifest=docs/release/evidencias/1.0.0/installer-release-manifest.fixture.json` ❌ esperado (`No-Go`)
- `node --test scripts/tests/perf-contract.test.mjs` ✅
- `node --test scripts/tests/installer-hub-contract.test.mjs` ✅
- `node --test scripts/tests/dashboard-ui.test.mjs` ✅
- `node --test scripts/tests/windows-release-smoke.test.mjs` ✅
- `npm run test:installer-hub:contract` ✅
- `npm run test:dashboard:repair` ✅
- `npm run test:dashboard:ui` ✅
- `npm -C apps/frontend run test -- tema.provider.test.ts` ✅
- `npm -C apps/frontend run test -- --reporter=verbose tests/versionInfoPage.test.tsx tests/versionInfo.helpers.test.tsx tests/tema.provider.test.ts` ✅
- `npm -C apps/frontend run test:coverage` ✅
- `npm -C apps/portal_alumno_cloud run test -- tests/logger.test.ts` ✅
- `npm -C apps/portal_alumno_cloud run test:coverage` ✅
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Port 4519 -Force` ✅
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-installation-manifest.ps1 -Port 4519` ✅
- `npm -C apps/backend run test -- tests/integracion/plantillasCrudYPreview.test.ts tests/integracion/examenesRetention.test.ts` ✅
- `node scripts/comercial/portable-license.mjs verify --license "C:\ProgramData\EvaluaPro\security\portable-license.epl" --public-keys "C:\ProgramData\EvaluaPro\security\portable-license-public-keys.json"` ✅
- `npm run status` ✅
- `htmlToPdfBuffer(...)` dentro de `api_docente_prod` ✅
  - validado con `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/local/bin/evaluapro-chromium`
- Validación incremental 2026-03-22:
  - retiro de exclusión TDD backend para `src/compartido/salud/rutasSalud.ts`
  - retiro de exclusión TDD frontend para `src/apps/app_alumno/**`
  - nuevo test `apps/backend/tests/rutasSalud.test.ts` cubre salud, readiness, métricas, version-info, IP local y QR
  - nuevo test `apps/frontend/tests/appAlumno.behavior.test.tsx` cubre login, cooldown, detalle, revisión, conformidad, PDF y cierre de sesión
  - `AppAlumno.tsx` corrige re-render al cerrar sesión local o por invalidación externa
- `npm run release:validate:stable -- --version=1.0.0 --repo=Dtcsrni/EvaluaPro_Sistema_Universitario` ❌ esperado (`No-Go`)
  - bloqueo real actualizado:
    - `ci-streak=7/10`
    - `gateHumanoProduccion.resultado=fallo`
    - falta `dist/installer/EvaluaPro-release-manifest.json`
- Resultado del corte:
  - todos los gates obligatorios de `AGENTS.md` quedaron en verde
  - la optimización PWA quedó validada con contratos específicos para manifest, SW y estado observable
  - smoke local de launcher/dashboard/Hub validado sobre instalación activa
  - smoke agresivo de repair validado en instalación temporal aislada
  - `perf:check` y cobertura backend estabilizados en Windows sin rebajar thresholds
  - follow-up de CI remoto cerrado localmente:
    - contract test del Installer Hub ya es portable entre Windows/Linux
    - diff coverage del portal y frontend cubierto en las rutas modificadas
    - smoke del Installer Windows ya tolera runners sin licencia portable preinstalada y compara `licenseState` de forma consistente con el manifiesto
  - deuda TDD reducida:
    - exclusiones resueltas: `backend-salud-rutas`, `frontend-app-alumno`
    - exclusiones temporales restantes con vencimiento `2026-03-31`: `5`
  - contrato de promoción estable `1.0.0` implementado y validado
  - decisión actual de release estable: `No-Go`
  - bloqueos restantes de release:
    - falta ejecutar el gate humano real en producción y regenerar la evidencia final con inputs reales
    - la racha CI remota volvió a `7/10`
    - falta regenerar el manifiesto `dist/installer/EvaluaPro-release-manifest.json`

## Verificacion minima
- `npm run lint`
- `npm run typecheck`
- `npm run test:frontend:ci`
- `npm run test:coverage:ci`
- `npm run perf:check`
- `npm run pipeline:contract:check`
- `npm run qa:clean-architecture:strict`
- `npm run test:wix:policy`
- `npm run test:ruleset:policy`
- `npm run test:release:policy`
- `npm run test:security:policy`

## Riesgos tecnicos activos
1. Complejidad residual en modulos UI grandes.
2. Rampa de cobertura frontend hacia metas semanales.
3. Costo de ejecucion en tests de integracion PDF/OMR bajo cobertura sigue siendo alto aunque ya estable.
4. Playwright sigue descargando `ffmpeg` durante la instalacion; se elimina del runtime final en la misma capa, pero el coste de build persiste.
5. La fase de rebrand sigue siendo parcial: quedó coherencia mínima de tema/iconografía, no un reemplazo total de todas las superficies.
6. El step-up comercial quedó release-ready con TOTP/recovery, pero passkeys/FIDO2 todavía están fuera de este corte.
7. Siguen activas `5` exclusiones temporales de cobertura backend con vencimiento `2026-03-31`.

## Reglas de gobernanza
1. No merge sin gates base en verde (`lint`, `typecheck`, tests, build).
2. `main` requiere checks: Core + Extended + Installer Windows + Security CodeQL.
3. Cambios de contrato en API/OMR/PDF/Sync deben incluir pruebas.
4. Todo cambio de arquitectura debe reflejarse en:
   - `docs/INVENTARIO_PROYECTO.md`
   - `docs/ENGINEERING_BASELINE.md`
   - `CHANGELOG.md`

## Requisitos verificables (resumen)
- RF: autenticacion, RBAC, gestion academica, flujo examen, OMR, calificacion, sincronizacion.
- RNF: seguridad de entrada, rate limit, observabilidad, performance, CI modular, contrato pipeline.
- Evidencia principal: tests automatizados + artefactos `reports/qa/latest/*`.
