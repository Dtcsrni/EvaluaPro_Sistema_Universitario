# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: evaluapro-stability-1.2.8-20261018
- parentSessionId: -
- status: draft
- generatedAt: 2026-10-19T04:50:22.503Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: assistant
- channel: Codex Desktop

## Solicitud
- Continuar la validación local de la release 1.2.8 y corregir el harness hasta lograr E2E visual verificable antes de CI/CD.

## Objetivo
- Demostrar que EvaluaPro 1.2.8 es estable mediante build, QA y E2E funcionales y visuales completos, corrigiendo los defectos encontrados.

## Alcance
- QA fail-closed local SPEC-118
- E2E visual del Installer Hub y proceso Burn/BA
- validación local de MSI y reporte de efectos del build

## Restricciones
- No enviar CI/CD hasta superar validaciones locales
- Preservar cambios ajenos del worktree
- No forzar el primer plano de toda la PC
- Usar un entorno de prueba sin producto real para la GUI

## Acciones
- [ok] implementation: Añadida asociación verificada de ventana al proceso hijo EvaluaPro.BurnBootstrapperApp.exe; corregido retorno de PID y guardado diagnóstico antes de aserciones UIA. (2026-10-19T00:45:00.420Z)
- [falla] validation: qa:full pasó; build MSI/Hub 1.2.8 y hashes pasaron; cuatro intentos de UI E2E fallaron en etapas del harness/captura, sin reportarse como aprobados. (2026-10-19T00:45:00.420Z)
- [ok] investigation: Los registros MsiInstaller muestran install/remove MSI local; ProductState actual reporta 1.2.8, sin estado inicial para atribución causal. Se creó SPEC-120 en draft para aislar estas transacciones. (2026-10-19T00:45:00.420Z)
- [ok] validation: Dos pasadas visuales consecutivas del bundle docente-local v1.2.8 pasaron: 36 verificaciones cada una, 0 fallidas, 9 capturas y proceso cerrado. También pasaron los contratos de CI/release, QA local completa y E2E responsiva docente. (2026-10-19T04:50:22.503Z)

## Archivos leidos
- AGENTS.md
- docs/POLITICA_SDD.md
- scripts/tests/installer-hub-ui-lifecycle.ps1
- scripts/tests/installer-hub-lifecycle-contract.test.mjs
- scripts/build-msi.ps1
- packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs

## Archivos cambiados
- scripts/tests/installer-hub-ui-lifecycle.ps1
- scripts/tests/installer-hub-lifecycle-contract.test.mjs
- scripts/tests/installer-hub-contract.test.mjs
- docs/specs/SPEC-119_installer_hub_inicio_visible_y_deteccion_local.spec.md
- docs/specs/SPEC-120_aislamiento_validacion_msi_local.spec.md
- .github/workflows/release-stable-gate.yml
- CHANGELOG.md
- ci/affected-test-map.json
- docs/specs/SPEC-117_checkout_candidato_normalizacion_eol.spec.md
- docs/specs/SPEC-122_estabilizacion_release_1_2_8.spec.md
- scripts/release/assert-candidate-clean.mjs
- scripts/tests/candidate-clean-guard.test.mjs
- scripts/pipeline-contract-check.mjs
- scripts/tests/ci-workflow-contract.test.mjs

## Validacion ejecutada
- qa_full: `npm run qa:full` -> ok (exitCode=0, duracionMs=0)
  resultado: Manifiesto final aprobado; 8 reportes QA requeridos validaron ok:true.
- installer_hub_build: `npm run installer:hub:build` -> ok (exitCode=0, duracionMs=0)
  resultado: Bundles y MSI 1.2.8 generados para saas-completo y docente-local; SHA-256 lateral verificado.
- focused_suites: `node --test scripts/tests/qa-full-runner.test.mjs scripts/tests/ci-workflow-contract.test.mjs scripts/tests/installer-hub-lifecycle-contract.test.mjs scripts/tests/module-contract-check.test.mjs` -> ok (exitCode=0, duracionMs=0)
  resultado: 106/106 pruebas pasaron con dependencias enlazadas temporalmente.
- installer_contracts: `node --test scripts/tests/installer-hub-contract.test.mjs scripts/tests/installer-hub-lifecycle-contract.test.mjs scripts/tests/ci-workflow-contract.test.mjs` -> ok (exitCode=0, duracionMs=0)
  resultado: 190 aprobadas, 18 omitidas, 0 fallidas; incluye contratos de lifecycle y de instalador.
- ia_policy: `npm run sdd:audit && npm run test:ia:traceability && npm run test:ia:handoff` -> ok (exitCode=0, duracionMs=0)
  resultado: Auditoría SDD y contratos de trazabilidad/handoff aprobados.
- installer_ui_e2e: `powershell -File scripts/tests/installer-hub-ui-lifecycle.ps1 -RootPath <worktree> -ReportDir <temp>` -> falla (exitCode=1, duracionMs=0)
  resultado: Cuatro intentos terminaron en asociación PID, array anidado, StatusTextBlock ausente y captura denegada por primer plano. No hubo captura aprobada.
- candidate_clean_guard: `node --test scripts/tests/candidate-clean-guard.test.mjs` -> ok (exitCode=0, duracionMs=2394)
  resultado: 7/7 pruebas: EOL-only permitido; contenido semántico, cambios staged, rutas extra y untracked rechazados.
- pipeline_contract: `node scripts/pipeline-contract-check.mjs` -> ok (exitCode=0, duracionMs=2316)
  resultado: 73/73 contratos de workflow y seguridad pasaron.
- release_and_installer_contracts: `npm run test:release:policy && npm run test:installer-hub:contract` -> ok (exitCode=0, duracionMs=23175)
  resultado: Release: 59/59; Installer Hub: 156 aprobadas, 12 skips previstos, 0 fallidas.
- qa_full_current_worktree: `npm run qa:full` -> ok (exitCode=0, duracionMs=61000)
  resultado: 8 reportes requeridos y gates locales aprobados; el manifiesto registra workingTreeClean=false, por lo que no constituye evidencia de promoción estable.
- responsive_docente_e2e: `npm run test:gui:responsive:e2e:docente -- --reporter=line` -> ok (exitCode=0, duracionMs=53200)
  resultado: 7/7 pruebas docentes en desktop y mobile; grupos archivados, sesión y pantallas operativas.
- module_contracts: `node --test scripts/tests/qa-full-runner.test.mjs scripts/tests/module-contract-check.test.mjs scripts/tests/clean-architecture-check.test.mjs` -> ok (exitCode=0, duracionMs=14772)
  resultado: 32/32 pruebas de QA runner, arquitectura y contratos modulares pasaron.

## Decisiones
- Mantener los gates locales antes de CI/CD
- No declarar estable la versión sin dos E2E visuales consecutivos sobre el mismo bundle
- No forzar SetForegroundWindow para eludir el foco protegido por Windows

## Supuestos
- Sin supuestos declarados.

## Riesgos abiertos
- Aún no se han ejecutado CI Checks, CI Installer Windows ni Stable Gate sobre el SHA final comprometido y sincronizado.
- El manifiesto QA generado localmente informa workingTreeClean=false porque el candidato sigue sin commit; no puede usarse para promoción estable.
- La publicación estable 1.2.8 no se ha verificado ni debe declararse hasta que el Stable Gate y E2E remotos pasen.

## Estado del arbol
```txt
M  .github/workflows/release-stable-gate.yml
M  CHANGELOG.md
 M apps/backend/reports/qa/latest/global-grade.json
M  apps/backend/src/modulos/modulo_integraciones_classroom/servicioJobsImportacionClassroom.ts
M  apps/frontend/src/styles/cards.css
M  apps/frontend/src/styles/screens.css
M  ci/affected-test-map.json
M  docs/contracts/module-contracts.v2.json
M  docs/specs/SPEC-109_aislamiento_regeneracion_examen_en_cobertura.spec.md
M  docs/specs/SPEC-115_checkout_limpio_stable_gate.spec.md
M  docs/specs/SPEC-116_aislamiento_salidas_e2e_gate_estable.spec.md
A  docs/specs/SPEC-117_checkout_candidato_normalizacion_eol.spec.md
A  docs/specs/SPEC-118_qa_local_bloquea_reportes_fallidos.spec.md
A  docs/specs/SPEC-119_installer_hub_inicio_visible_y_deteccion_local.spec.md
A  docs/specs/SPEC-120_aislamiento_validacion_msi_local.spec.md
A  docs/specs/SPEC-121_version_dinamica_resumen_installer_hub.spec.md
A  docs/specs/SPEC-122_estabilizacion_release_1_2_8.spec.md
M  package.json
M  packaging/wix/BurnBootstrapperApp/MainWindow.xaml
M  packaging/wix/BurnBootstrapperApp/MainWindow.xaml.cs
 M reports/qa/latest/clean-architecture.json
 M reports/qa/latest/dataset-prodlike.json
 M reports/qa/latest/e2e-docente-alumno.json
 M reports/qa/latest/evaluaciones-e2e.json
 M reports/qa/latest/evaluaciones-policy.json
 M reports/qa/latest/global-grade.json
 M reports/qa/latest/gui-docente-alumnos-desktop-lg.png
 M reports/qa/latest/gui-docente-alumnos-mobile.png
 M reports/qa/latest/gui-docente-banco-desktop-lg.png
 M reports/qa/latest/gui-docente-banco-mobile.png
 M reports/qa/latest/gui-docente-calificaciones-desktop-lg.png
 M reports/qa/latest/gui-docente-calificaciones-mobile.png
 M reports/qa/latest/gui-docente-cuenta-desktop-lg.png
 M reports/qa/latest/gui-docente-cuenta-mobile.png
 M reports/qa/latest/gui-docente-entrega-desktop-lg.png
 M reports/qa/latest/gui-docente-entrega-mobile.png
 M reports/qa/latest/gui-docente-evaluaciones-desktop-lg.png
 M reports/qa/latest/gui-docente-evaluaciones-mobile.png
 M reports/qa/latest/gui-docente-login-desktop-lg.png
 M reports/qa/latest/gui-docente-login-mobile.png
 M reports/qa/latest/gui-docente-periodos-desktop-lg.png
 M reports/qa/latest/gui-docente-periodos-mobile.png
 M reports/qa/latest/gui-docente-plantillas-desktop-lg.png
 M reports/qa/latest/gui-docente-plantillas-mobile.png
 M reports/qa/latest/gui-docente-rehidratacion-desktop-lg.png
 M reports/qa/latest/gui-docente-rehidratacion-mobile.png
 M reports/qa/latest/gui-docente-sincronizacion-desktop-lg.png
 M reports/qa/latest/gui-docente-sincronizacion-mobile.png
 M reports/qa/latest/manifest.json
 M reports/qa/latest/module-contracts.json
 M reports/qa/latest/pdf-print.json
 M reports/qa/latest/ux-visual.json
M  scripts/build-msi.ps1
M  scripts/pipeline-contract-check.mjs
A  scripts/release/assert-candidate-clean.mjs
A  scripts/release/required-qa-artifacts.mjs
M  scripts/release/validate-stable-promotion.mjs
M  scripts/testing/run-backend-coverage-batches.mjs
A  scripts/testing/run-qa-full.mjs
A  scripts/testing/validate-qa-reports.mjs
M  scripts/tests/backend-coverage-batches.test.mjs
A  scripts/tests/candidate-clean-guard.test.mjs
M  scripts/tests/ci-workflow-contract.test.mjs
M  scripts/tests/installer-hub-contract.test.mjs
M  scripts/tests/installer-hub-lifecycle-contract.test.mjs
M  scripts/tests/installer-hub-ui-lifecycle.ps1
M  scripts/tests/module-contract-check.test.mjs
A  scripts/tests/qa-full-runner.test.mjs
M  tests/gui-responsive/responsive-docente.spec.ts
?? docs/handoff/sesiones/2026-10-19/
```

## Siguiente paso recomendado
- Revisar el payload staged, crear un commit limpio, regenerar QA con manifest ligado al SHA comprometido, obtener aprobación explícita para el push exacto, sincronizar con main remoto y ejecutar los gates remotos completos antes de promover 1.2.8 estable.

## Artefactos generados
- dist/installer/EvaluaPro-release-manifest.json
- %TEMP%/EvaluaPro-1.2.8-installer-ui-pass1-20261018/installer-hub-ui-automation-report.json
- %TEMP%/EvaluaPro-1.2.8-installer-ui-pass2-20261018/installer-hub-ui-automation-report.json
- %TEMP%/EvaluaPro-1.2.8-installer-ui-pass3-20261018/installer-hub-ui-automation-report.json
- %TEMP%/EvaluaPro-1.2.8-installer-ui-pass4-20261018/installer-hub-ui-automation-report.json
- %TEMP%/EvaluaPro/qa-1.2.8-local/installer-hub-ui/resume-E-v2-pass1/installer-hub-ui-automation-report.json
- %TEMP%/EvaluaPro/qa-1.2.8-local/installer-hub-ui/resume-E-v2-pass2/installer-hub-ui-automation-report.json

## Completitud semantica
- isComplete: false
- CI remoto y Stable Gate sobre el SHA final
- promoción/publicación estable verificada
