# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: sesion-2026-05-26-hub-update-smoke
- parentSessionId: -
- status: final
- generatedAt: 2026-05-26T05:06:25.432Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: coding-agent
- channel: desktop

## Solicitud
- Continuar estabilizacion de EvaluaPro empezando por Installer Hub.

## Objetivo
- Cerrar una correccion local verificable en el runner E2E del Installer Hub docente-local y dejar trazabilidad sin declarar estable la aceptacion VM.

## Alcance
- Installer Hub docente-local
- Runner E2E real install|repair|update smoke|uninstall
- Documentacion de baseline, inventario, QA y changelog

## Restricciones
- No revertir WIP existente del arbol sucio
- No ejecutar E2E destructivo fuera de VM limpia
- Mantener aceptacion release-like como partial hasta tener report.json de VM

## Acciones
- [ok] diagnostico: Detectada deriva: docs prometian manifest/update-status.json pero Export-JsonArtifact enviaba update-status.json a raiz del reporte. (2026-05-26T05:05:00.000Z)
- [ok] cambio: Se agrego regression test contractual y se enruto update-status hacia manifest/ en el runner E2E docente. (2026-05-26T05:05:00.000Z)
- [ok] documentacion: Se actualizo CHANGELOG, ENGINEERING_BASELINE, INVENTARIO_PROYECTO y QA Installer Hub con el cierre local 2026-05-26. (2026-05-26T05:05:00.000Z)

## Archivos leidos
- README.md
- docs/README.md
- docs/IA_TRAZABILIDAD_AGENTES.md
- .github/copilot-instructions.md
- docs/DESIGN.md
- docs/INSTALLER_HUB.md
- docs/QA_INSTALLER_HUB_DOCENTE_2026-05-20.md
- scripts/tests/installer-hub-e2e-docente.ps1
- scripts/tests/installer-hub-contract.test.mjs

## Archivos cambiados
- CHANGELOG.md
- docs/ENGINEERING_BASELINE.md
- docs/INVENTARIO_PROYECTO.md
- docs/QA_INSTALLER_HUB_DOCENTE_2026-05-20.md
- docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
- scripts/tests/installer-hub-contract.test.mjs
- scripts/tests/installer-hub-e2e-docente.ps1

## Validacion ejecutada
- serena_status: `npm run ai:serena:status -- --json` -> ok (exitCode=0, duracionMs=1900)
  resultado: ready=true; commandAvailable=true
- caveman_status: `npm run ai:caveman:status` -> ok (exitCode=0, duracionMs=900)
  resultado: caveman.ready=true
- red_regression: `node --test scripts/tests/installer-hub-contract.test.mjs --test-name-pattern "Installer Hub tiene runner E2E real docente"` -> falla (exitCode=1, duracionMs=19400)
  resultado: Prueba roja esperada: faltaba $Name -match 'manifest|config|update-status'.
- powershell_parse: `[System.Management.Automation.Language.Parser]::ParseFile('scripts/tests/installer-hub-e2e-docente.ps1',...)` -> ok (exitCode=0, duracionMs=300)
  resultado: parse=ok
- installer_hub_contract: `npm run test:installer-hub:contract` -> ok (exitCode=0, duracionMs=157475)
  resultado: 47/47 pass; smoke activo valido broker, manifest, shortcuts y control plane.
- test_update: `npm run test:update` -> ok (exitCode=0, duracionMs=1724)
  resultado: 10/10 pass
- test_wix_policy: `npm run test:wix:policy` -> ok (exitCode=0, duracionMs=78)
  resultado: 3/3 pass
- env_doctor_windows: `npm run env:doctor:windows` -> ok (exitCode=0, duracionMs=3200)
  resultado: ok=true; Docker server=29.4.0; Compose v5.1.2; Playwright Chromium disponible
- installer_docente_baseline: `npm run installer:docente:baseline` -> ok (exitCode=0, duracionMs=1000)
  resultado: bundle docente-local existe; 74,921,037 bytes; runtimeTarget=wsl2-docker-minimal
- inventario_codigo: `npm run inventario:codigo` -> ok (exitCode=0, duracionMs=700)
  resultado: docs/INVENTARIO_CODIGO_EXHAUSTIVO.md regenerado; total 940
- traceability: `npm run test:ia:traceability` -> ok (exitCode=0, duracionMs=700)
  resultado: 7/7 pass

## Decisiones
- Corregir el runner, no la documentacion, porque el contrato de evidencia manifest/update-status.json ya era el correcto.
- Mantener E2E VM como partial aunque los gates locales esten verdes.

## Supuestos
- El arbol sucio incluye WIP previo de estabilizacion y no debe revertirse.
- El E2E destructivo debe correr solo en VM limpia con snapshot y permisos adecuados.

## Riesgos abiertos
- Aceptacion release-like sigue pendiente hasta ejecutar install|repair|update smoke|uninstall en VM limpia y revisar report.json.
- La shell actual no demuestra cierre de Hyper-V/WinRM para la VM.

## Estado del arbol
```txt
M .codex/hooks.json
 M .gitignore
M  .serena/project.yml
 M CHANGELOG.md
 M apps/backend/package.json
 M apps/backend/reports/qa/latest/e2e-docente-alumno.json
 M apps/backend/reports/qa/latest/global-grade.json
 M apps/backend/reports/qa/latest/pdf-print.json
 M apps/backend/tests/integracion/aislamientoDocente.test.ts
 M apps/backend/tests/integracion/archivarExamenGenerado.test.ts
 M apps/backend/tests/integracion/flujoExamen.test.ts
 M apps/backend/tests/integracion/periodosBorradoDuplicados.test.ts
 M apps/backend/tests/integracion/qrEscaneoOmr.test.ts
 M apps/backend/tests/integracion/regenerarExamenGenerado.test.ts
 M apps/backend/tests/omr.tv3.porFolioValidation.test.ts
 M apps/frontend/reports/qa/latest/ux-visual.json
 M docs/AUTO_DOCS_INDEX.md
 M docs/ENGINEERING_BASELINE.md
 M docs/INSTALLER_HUB.md
 M docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
 M docs/INVENTARIO_PROYECTO.md
 M docs/QA_INSTALLER_HUB_DOCENTE_2026-05-20.md
A  docs/handoff/sesiones/2026-05-25/sesion-2026-05-25-estabilizacion-gates-final.json
A  docs/handoff/sesiones/2026-05-25/sesion-2026-05-25-estabilizacion-gates-final.md
 M docs/tutoriales/installer-hub-docente-e2e.md
M  package.json
 M packaging/wix/BurnBootstrapperApp/bin/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.deps.json
 M packaging/wix/BurnBootstrapperApp/bin/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.dll
 M packaging/wix/BurnBootstrapperApp/bin/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.exe
 M packaging/wix/BurnBootstrapperApp/bin/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.pdb
 M packaging/wix/BurnBootstrapperApp/bin/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.runtimeconfig.json
 M packaging/wix/BurnBootstrapperApp/obj/EvaluaPro.BurnBootstrapperApp.csproj.nuget.dgspec.json
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.AssemblyInfo.cs
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.AssemblyInfoInputs.cache
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.GeneratedMSBuildEditorConfig.editorconfig
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.assets.cache
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.csproj.CoreCompileInputs.cache
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.csproj.FileListAbsolute.txt
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.dll
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.genruntimeconfig.cache
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.pdb
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp.sourcelink.json
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/EvaluaPro.BurnBootstrapperApp_MarkupCompile.cache
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/MainWindow.g.cs
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/ref/EvaluaPro.BurnBootstrapperApp.dll
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/refint/EvaluaPro.BurnBootstrapperApp.dll
 M packaging/wix/BurnBootstrapperApp/obj/Release/net8.0-windows/win-x64/singlefilehost.exe
 M packaging/wix/BurnBootstrapperApp/obj/project.assets.json
 M packaging/wix/BurnBootstrapperApp/obj/project.nuget.cache
 M reports/qa/latest/clean-architecture.json
 M reports/qa/latest/dataset-prodlike.json
 M reports/qa/latest/e2e-docente-alumno.json
 M reports/qa/latest/evaluaciones-e2e.json
 M reports/qa/latest/evaluaciones-policy.json
 M reports/qa/latest/global-grade.json
 M reports/qa/latest/manifest.json
 M reports/qa/latest/pdf-print.json
 M reports/qa/latest/ux-visual.json
 M scripts/README.md
 M scripts/ai-serena-policy-status.mjs
 M scripts/env-doctor.mjs
A  scripts/testing/run-backend-coverage-batches.mjs
A  scripts/tests/backend-coverage-batches.test.mjs
 M scripts/tests/env-doctor.test.mjs
 M scripts/tests/installer-hub-contract.test.mjs
 M scripts/tests/installer-hub-e2e-docente.ps1
?? .serena.precheckout-20260521/
?? docs/ESTABILIZACION_FALLOS_Y_APRENDIZAJES.md
?? docs/GUI_REDISENO_FIGMA.md
?? docs/handoff/sesiones/2026-05-21/sesion-2026-05-21T21-12-58.317Z.json
?? docs/handoff/sesiones/2026-05-21/sesion-2026-05-21T21-12-58.317Z.md
?? docs/handoff/sesiones/2026-05-21/sesion-2026-05-21T22-25-47.054Z.json
?? docs/handoff/sesiones/2026-05-21/sesion-2026-05-21T22-25-47.054Z.md
?? docs/handoff/sesiones/2026-05-22/
?? docs/handoff/sesiones/2026-05-25/sesion-2026-05-25-e2e-local-update-smoke.json
?? docs/handoff/sesiones/2026-05-25/sesion-2026-05-25-e2e-local-update-smoke.md
?? docs/handoff/sesiones/2026-05-26/
?? reports/qa/latest/prodlike-imported.json
?? scripts/tests/ai-serena-policy-status.test.mjs
```

## Siguiente paso recomendado
- Ejecutar el runner real en VM limpia con permisos/TrustedHosts o HTTPS configurados y validar report.json, logs, capturas y residuos post-uninstall.

## Artefactos generados
- docs/handoff/sesiones/2026-05-26/sesion-2026-05-26-hub-update-smoke.json
- docs/handoff/sesiones/2026-05-26/sesion-2026-05-26-hub-update-smoke.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
