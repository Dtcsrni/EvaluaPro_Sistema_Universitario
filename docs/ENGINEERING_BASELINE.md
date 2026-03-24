# Engineering Baseline

Fecha de baseline: 2026-03-24
Version tecnica: `1.0.0`
Version visible GUI: `1.0.0b`

## Estado vigente
- Corte 2026-03-24:
  - el subsistema PDF fija una línea visual canónica compartida entre `pdf-lib-legacy` y `playwright-html-v1` mediante `pdfVisualBaseline.ts`
  - `examPrintTemplate.ts` elimina la deriva cromática multicolor y vuelve a la paleta compacta del baseline A050929D
  - `controladorGeneracionPdf.ts` invalida el cache de preview cuando cambia una pregunta real del banco o la firma visual/layout del renderer
  - la descarga de lote normaliza `loteId` en mayúsculas para evitar falsos `404` por variación de casing
  - cobertura nueva del corte:
    - `apps/backend/tests/pdf.visual.baseline.test.ts`
    - `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` (invalida cache por cambio de reactivo)
    - `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` (descarga de lote case-insensitive)
- Corte 2026-03-23:
  - `apps/backend/src/configuracion.ts` y `apps/portal_alumno_cloud/src/configuracion.ts` ya no cargan el `.env` raíz durante `NODE_ENV=test`
  - backend y portal extraen utilidades internas de configuración para centralizar carga de `.env`, flags booleanas, CSV y parseos numéricos sin duplicación accidental
  - frontend consolida la base de sus clientes HTTP JSON en `clienteComun`, reduciendo duplicación entre `clienteApi` y `clientePortal` sin cambiar contratos visibles
  - nuevo guard operativo `npm run workspace:hygiene` mide buckets regenerables y expone deuda real del árbol local/versionado antes de usar el modo estricto
  - `scripts/testing/check-diff-coverage.mjs` normaliza rutas relativas de `lcov` por app e ignora líneas estructurales no ejecutables, eliminando falsos rojos del gate TDD
  - `workspace:hygiene` toma `reports/qa/latest/manifest.json` como allowlist contractual de evidencia QA y deja visibles solo los residuos heredados fuera de ese subconjunto
  - el histórico QA no contractual bajo `reports/qa/latest/**` se elimina del árbol activo; el guard ya no bloquea por evidencia auxiliar/human-review/debug fuera del manifest
  - `omr_samples_tv3` se reclasifica como dataset sintético permitido en higiene del workspace (`manifest`, `ground_truth`, `quality_tags`, `images.zip`)
  - `workspace:hygiene:strict` queda operativo en verde con el árbol de trabajo actual
  - temporales heredados de raíz (`lint_output.txt`, `tmp_missing_dirs.txt`) y `test-results/.last-run.json` salen del árbol activo en este lote
  - la suite backend completa vuelve a pasar sin `403` espurios en `/api/autenticacion/registrar`
  - frontend añade cobertura contractual sobre `App.tsx`, `AppAdminNegocio.tsx` y `AppAlumno.tsx` para sostener el gate de diff coverage del siguiente commit en `main`
  - harness E2E responsive del frontend endurecido: servidor de prueba con `vite preview` y flag `VITE_DISABLE_PWA=1` para evitar recargas espurias del shell/PWA durante Playwright
  - carriles ampliados verificados en verde en este corte: `test:gui:responsive:e2e:ci`, `compliance:full:ci`, `qa:evidence:quick`, `qa:full`, `test:classroom:audit:ci`, `test:omr:tv3:gate:ci`, `test:ci` y `ci:policy:audit:remote`
  - ruleset remoto de `main` verificado con required checks: `Verificaciones Extendidas (Main/Release)` y `Installer Windows (MSI + Bundle)`
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- Baseline visual frontend 2026-03-22:
  - sistema visual desacoplado en `apps/frontend/src/styles/foundations.css`, `components.css` y `screens.css`
  - shells `docente`, `alumno` y `admin_negocio` convergen en una misma marca con matices por audiencia
  - componentes base de UX quedan preparados para escalar variantes sin tocar contratos de dominio
  - secciones operativas docentes prioritarias ya comparten lenguaje visual de panel, métricas y estados en `screens.css`
  - portal alumno y módulos docentes críticos (`Banco`, `Plantillas`, `Calificaciones`) ya comparten patrones visuales de resumen, detalle y flujo operativo
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
- OMR y PDF operan en TV4 como contrato canónico, preservando el baseline visual A050929D también entre renderers.
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
- Higiene del workspace en este corte:
  - guard nuevo disponible: `workspace:hygiene`, `workspace:hygiene:strict`
  - hallazgo dominante: `reports/qa/latest/**` contiene mezcla de evidencia contractual y outputs regenerables heredados
  - temporales heredados detectados en raíz: `lint_output.txt`, `tmp_missing_dirs.txt`

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

## Corte de validacion 2026-03-23
- Installer Hub multi-flavor alineado a documentación y build real:
  - `docente-local` queda como flavor recomendado por default
  - `scripts/build-installer-hub.ps1` ahora genera `dist/installer/installer-local-paths.json`
  - el manifiesto local expone `recommendedHubExecutablePath` con ruta absoluta utilizable en soporte/instalación local
- Validación específica del cambio:
  - `npm run test:installer-hub:contract` ✅
  - `npm run installer:hub:build` ✅
  - ejecutable recomendado verificado: `C:\Users\evega\EvaluaPro_Sistema_Universitario\dist\installer\EvaluaPro-InstallerHub-docente-local.exe`
- Gates mínimos ejecutados para estado real del repo:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test:frontend:ci` ✅
  - `npm run test:coverage:ci` ✅
  - `npm run test:tdd:enforcement:ci` ✅
  - `npm run test:backend:ci` ✅
  - `npm run test:portal:ci` ✅
  - `npm run perf:check` ✅
  - `npm run pipeline:contract:check` ✅
  - `npm run qa:clean-architecture:strict` ✅
  - `npm run workspace:hygiene:strict` ✅
- Cierre del blocker de este lote:
  - `test:tdd:enforcement:ci` vuelve a verde tras corregir la resolución de rutas `lcov` y excluir líneas estructurales no ejecutables del cálculo de diff coverage
  - backend/portal/frontend quedan nuevamente en verde sin bajar thresholds ni mover gates
  - la deuda de higiene visible en `reports/qa/latest/**` deja de bloquear el workspace al conservar solo el subconjunto contractual
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
- Validación incremental UX/UI 2026-03-22:
  - `ConfirmDialogProvider` queda como contrato frontend para confirmaciones accesibles y sin fallback a confirm nativo dentro de la app
  - `ToastPayload` incorpora `secondaryAction` y `eyebrow` para feedback más explícito
  - `admin_negocio` recibe baseline visual/responsive y ayuda contextual homogénea
  - nuevo gate responsive específico:
    - `npx playwright test -c tests/gui-responsive/playwright.admin.config.cjs` ✅
  - pruebas UX/frontend del corte:
    - `npm -C apps/frontend run test -- --reporter=verbose tests/ux.quality.test.tsx tests/gui.responsive.contract.test.tsx tests/ux.visual.test.tsx` ✅
  - snapshots/artefactos QA actualizados como nuevo baseline visual:
    - `apps/frontend/tests/__snapshots__/ux.visual.test.tsx.snap`
    - `reports/qa/latest/ux-visual.json`
- Validación incremental Classroom 2026-03-22:
  - comando reproducible `npm run test:classroom:audit:ci`
  - cobertura backend ampliada con `apps/backend/tests/integracion/classroom.audit.test.ts`
  - cobertura frontend ampliada con `apps/frontend/tests/centroClassroom.behavior.test.tsx`
  - dictamen técnico documentado en `docs/CLASSROOM_AUDIT_2026-03-22.md`
  - bloqueo operativo confirmado para E2E real por falta de credenciales Google/Classroom en el entorno actual
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

## Validación 2026-03-24
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:frontend:ci` ✅
- `npm run test:coverage:ci` ✅
- `npm run test:tdd:enforcement:ci` ✅
- `npm run test:backend:ci` ✅
- `npm run test:portal:ci` ✅
- `npm run perf:check` ✅
- `npm run pipeline:contract:check` ✅
- `npm -C apps/backend run test -- tests/pdf.layout.visual.guard.test.ts tests/pdf.paridad.test.ts tests/pdf.renderer.fallback.test.ts tests/pdf.visual.baseline.test.ts tests/integracion/plantillasCrudYPreview.test.ts tests/integracion/recoveryBundleGeneracion.test.ts tests/integracion/pdfImpresionContrato.test.ts` ✅

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
