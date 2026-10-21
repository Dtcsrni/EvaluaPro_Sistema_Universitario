# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: installer-related-bundle-20261021
- parentSessionId: -
- status: draft
- generatedAt: 2026-10-21T19:59:42.539Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: assistant
- channel: Codex Desktop

## Solicitud
- Revisar el informe y las evidencias del fallo del Installer Hub en Windows 11, corregir el defecto reproducible y preparar regresión para la siguiente versión.

## Objetivo
- Evitar que un upgrade se marque como fallido o limpie residuos después de que el MSI se instaló correctamente cuando Burn planifica dos veces la desinstalación de un bundle relacionado.

## Alcance
- Análisis del informe ZIP y logs Burn/MSI/BA
- Bootstrapper Application y manejo de related bundles
- Fixture Burn PerUser de versión previa
- CI Installer Windows y pruebas de contrato

## Restricciones
- No alterar la instalación local existente ni su base de datos compartida.
- No publicar el branch sin aprobación que identifique SHA, remote y branch.
- La validación E2E final debe ejecutarse en Windows 11 limpio o runner Windows.

## Acciones
- [ok] investigation: Correlacionados los logs del MSI, del bundle candidato y del bundle anterior; el checksum del manifiesto coincide con los 12 artefactos del ZIP. (2026-10-21T19:58:10.466Z)
- [ok] implementation: Deduplicación por identidad durante PlanRelatedBundle, tolerancia acotada del HRESULT tras uninstall exitoso, preservación de payload/datos si solo falla limpieza, y E2E de bundle anterior PerUser. (2026-10-21T19:58:10.466Z)
- [pending] validation: CI Windows compiló el bundle y pasó los contract-checks, pero la fixture PerUser falló antes de ejecutar la E2E porque PowerShell trató `$FixtureVersion` y `$fixtureVersion` como la misma variable. Se aisló y corrigió el bug guardando primero la versión solicitada; hay un nuevo contract-check. Requiere repetir CI Windows para validar instalación runtime. (2026-10-21T20:26:12Z)

## Archivos leidos
- AGENTS.md
- docs/IA_TRAZABILIDAD_AGENTES.md
- docs/POLITICA_SDD.md
- docs/handoff/CONTRATO_TRAZABILIDAD_IA.md
- docs/specs/SPEC-123_installer_related_bundle_idempotence.spec.md
- packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs
- scripts/tests/installer-hub-e2e-docente.ps1
- scripts/tests/installer-upgrade-e2e-contract.test.mjs
- EvaluaPro-informe-fallo-2026-10-21.zip (12/12 hashes verificados)

## Archivos cambiados
- CHANGELOG.md
- .github/workflows/ci-installer-windows.yml
- packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs
- packaging/wix/tests/SameVersionRelatedBundleFixture.wxs
- scripts/tests/build-same-version-related-bundle-fixture.ps1
- scripts/tests/installer-hub-contract.test.mjs
- scripts/tests/installer-hub-e2e-docente.ps1
- scripts/tests/installer-upgrade-e2e-contract.test.mjs
- docs/specs/SPEC-123_installer_related_bundle_idempotence.spec.md

## Validacion ejecutada
- lint: `npm run lint` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- typecheck: `npm run typecheck` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_frontend_ci: `npm run test:frontend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_coverage_ci: `npm run test:coverage:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_tdd_enforcement_ci: `npm run test:tdd:enforcement:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_backend_ci: `npm run test:backend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_portal_ci: `npm run test:portal:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- perf_check: `npm run perf:check` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=3439)
  resultado: ✔ Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final (1.8754ms) | ▶ el guard del checkout candidato solo permite EOL sin cambios semánticos | ✔ acepta diferencias CRLF/LF sin contenido distinto (505.7087ms) | ✔ acepta EOL-only en JSON de evidencia fuera de la allowlist histórica (470.6435ms) | ... | npm notice run evaluapro@1.2.8 pipeline:contract:check | npm notice run node scripts/pipeline-contract-check.mjs
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=1161)
  resultado: [docs] ok | npm notice run evaluapro@1.2.8 docs:check | npm notice run node scripts/docs.mjs --check

## Decisiones
- El defecto inmediato se reproduce con dos detecciones y dos planes Uninstall del mismo GUID; el primero termina 0 y el segundo falla al abrir una ruta de Package Cache ya eliminada.
- La causa original de la duplicación no está demostrada; el fix evita ejecutar dos uninstall y conserva el estado si otra limpieza falla.
- No ejecutar el instalador E2E en esta PC: está instalada EvaluaPro 1.2.8 y el runner requiere entorno QA aislado.

## Supuestos
- Windows 11 es el sistema objetivo y fue confirmado tanto por el usuario como por Win32_OperatingSystem.

## Riesgos abiertos
- Falta E2E runtime en windows-latest para confirmar fixture corregida, alcance PerUser, registro, UI, payload y preservación SQLite en ejecución real.
- No hay bundle candidato EXE en el checkout local.
- El PR #254 está abierto; el commit de corrección del generador de fixture debe publicarse y someterse a otra ejecución CI.

## Estado del arbol
_arbol limpio_

## Siguiente paso recomendado
- Con autorización, publicar el commit exacto 1ef58823e87d4c23ac3e3c45157c2bac0c16bdab en origin/codex/installerhub-related-bundle-main, abrir PR para ejecutar CI Installer Windows y revisar el reporte E2E antes de integrar o liberar.

## Artefactos generados
- EvaluaPro-informe-fallo-2026-10-21.zip: manifiesto SHA-256 verificado, 12/12 archivos coinciden.
- E2E de Windows 11 runtime pendiente; no se generó candidato local.

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
