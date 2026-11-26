# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: update-screen-and-signature-2026-11-25
- parentSessionId: -
- status: final
- generatedAt: 2026-11-26T05:02:34.930Z
- validationProfile: quick

## Agente
- name: unknown
- version: unknown
- provider: unknown
- kind: unknown
- channel: unknown

## Solicitud
- Continuar la corrección del aviso de versión y llevar su botón a una pantalla local de actualización con progreso, verificación de firma, validación de salud y aviso de reinicio.

## Objetivo
- Hacer que el banner use el flujo del supervisor/Hub en navegador y escritorio y que las versiones de producto front/back permanezcan alineadas.

## Alcance
- UpdateAvailabilityBanner y pantalla /update
- Launcher supervisor, UpdateManager y comprobación Authenticode
- SPEC-091 y pruebas del flujo de actualización

## Restricciones
- Trabajo en worktree aislado codex/omr-autograding-stability-20261123
- No instalar ni publicar; no modificar las notas reales
- Preservar cambios OMR locales ajenos a este ajuste

## Acciones
- [omitido] validation: Ejecucion de lint (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de typecheck (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de test_frontend_ci (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de test_coverage_ci (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de test_tdd_enforcement_ci (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de test_backend_ci (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de test_portal_ci (2026-11-26T05:02:34.930Z)
- [omitido] validation: Ejecucion de perf_check (2026-11-26T05:02:34.930Z)
- [ok] validation: Ejecucion de pipeline_contract_check (2026-11-26T05:02:34.930Z)
- [falla] validation: Ejecucion de docs_check (2026-11-26T05:02:34.930Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- apps/backend/package-lock.json
- apps/backend/package.json
- apps/backend/scripts/omr-tv4-synthetic-lib.ts
- apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/respuestaPuntuableOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
- apps/backend/src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/calificacion.omr.local.test.ts
- apps/backend/tests/calificacion.omr.lote.test.ts
- apps/backend/tests/calificacion.omr.payload.test.ts
- apps/backend/tests/integracion/omrJobsWorkflow.test.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- apps/backend/tests/omr.core.decision.test.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/tests/omr.geometry.reference.test.ts
- apps/backend/tests/omr.jobs.policy.test.ts
- apps/backend/tests/omr.politicaAutoCalificacion.test.ts
- apps/backend/tests/omr.test.ts
- apps/backend/tests/omr.tv4.synthetic.metrics.test.ts
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
- apps/frontend/src/servicios_api/clienteApi.ts
- apps/frontend/src/servicios_api/clienteComun.ts
- apps/frontend/src/ui/version/UpdateAvailabilityBanner.tsx
- apps/frontend/tests/clienteApi.test.tsx
- apps/frontend/tests/clienteComun.test.ts
- apps/frontend/tests/plantillasOmrWorkflow.test.tsx
- apps/frontend/tests/updateAvailabilityBanner.test.tsx
- apps/portal_alumno_cloud/package-lock.json
- docs/specs/SPEC-091_actualizacion_app_y_installer_hub.spec.md
- docs/specs/SPEC-117_calificacion_automatica_local_omr.spec.md
- docs/specs/SPEC-150_bandeja-nativa-inicio-automatico.spec.md
- scripts/launcher-dashboard.mjs
- scripts/tests/update-api.test.mjs
- scripts/tests/update-manager.test.mjs
- scripts/update-manager.mjs
- apps/backend/scripts/omr-tv4-real-lot-replay.ts
- apps/backend/spa.traineddata
- apps/backend/tests/omr.tv4.real-lot-replay.test.ts
- docs/handoff/sesiones/2026-11-24/
- docs/handoff/sesiones/2026-11-26/
- scripts/reconnect.html
- scripts/update.html
- scripts/verify-update-installer-signature.ps1

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
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=3128)
  resultado: ✔ Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final (2.4542ms) | ▶ el guard del checkout candidato solo permite EOL sin cambios semánticos | ✔ acepta diferencias CRLF/LF sin contenido distinto (462.7097ms) | ✔ acepta EOL-only en JSON de evidencia fuera de la allowlist histórica (415.8378ms) | ... | npm notice run evaluapro@1.2.29 pipeline:contract:check | npm notice run node scripts/pipeline-contract-check.mjs
- docs_check: `npm run docs:check` -> falla (exitCode=1, duracionMs=1336)
  resultado: npm notice run evaluapro@1.2.29 docs:check | npm notice run node scripts/docs.mjs --check | [docs] desactualizado: docs/AUTO_ENV.md | [docs] corre: npm run docs:generate

## Decisiones
- El banner abre /update?run=1 en el supervisor, incluso desde WebView
- El instalador debe tener firma Authenticode válida y el mismo thumbprint del Hub instalado, además de SHA-256
- El reinicio solo se programa tras confirmación explícita y step-up; el botón cancelar también requiere step-up

## Supuestos
- Sin supuestos declarados.

## Riesgos abiertos
- Smoke de Windows con instalador firmado no ejecutado; integración/release e instalación local siguen pendientes
- La alineación de versión de producto front/back está en source/build contract; Hub usa una versión separada como componente

## Estado del arbol
```txt
M apps/backend/package-lock.json
 M apps/backend/package.json
 M apps/backend/scripts/omr-tv4-synthetic-lib.ts
 M apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
 M apps/backend/src/modulos/modulo_calificacion/respuestaPuntuableOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
 M apps/backend/tests/calificacion.omr.local.test.ts
 M apps/backend/tests/calificacion.omr.lote.test.ts
 M apps/backend/tests/calificacion.omr.payload.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/omr.consenso.robusto.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.estado-respuesta.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/omr.jobs.policy.test.ts
 M apps/backend/tests/omr.politicaAutoCalificacion.test.ts
 M apps/backend/tests/omr.test.ts
 M apps/backend/tests/omr.tv4.synthetic.metrics.test.ts
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
 M apps/frontend/src/servicios_api/clienteApi.ts
 M apps/frontend/src/servicios_api/clienteComun.ts
 M apps/frontend/src/ui/version/UpdateAvailabilityBanner.tsx
 M apps/frontend/tests/clienteApi.test.tsx
 M apps/frontend/tests/clienteComun.test.ts
 M apps/frontend/tests/plantillasOmrWorkflow.test.tsx
 M apps/frontend/tests/updateAvailabilityBanner.test.tsx
 M apps/portal_alumno_cloud/package-lock.json
 M docs/specs/SPEC-091_actualizacion_app_y_installer_hub.spec.md
 M docs/specs/SPEC-117_calificacion_automatica_local_omr.spec.md
 M docs/specs/SPEC-150_bandeja-nativa-inicio-automatico.spec.md
 M scripts/launcher-dashboard.mjs
 M scripts/tests/update-api.test.mjs
 M scripts/tests/update-manager.test.mjs
 M scripts/update-manager.mjs
?? apps/backend/scripts/omr-tv4-real-lot-replay.ts
?? apps/backend/spa.traineddata
?? apps/backend/tests/omr.tv4.real-lot-replay.test.ts
?? docs/handoff/sesiones/2026-11-24/
?? docs/handoff/sesiones/2026-11-26/
?? scripts/reconnect.html
?? scripts/update.html
?? scripts/verify-update-installer-signature.ps1
```

## Siguiente paso recomendado
- Integrar el worktree tras revisar los cambios OMR y ejecutar smoke Windows de actualización firmado antes de instalar/publicar.

## Artefactos generados
- docs/handoff/sesiones/2026-11-26/update-screen-and-signature-2026-11-25.json
- docs/handoff/sesiones/2026-11-26/update-screen-and-signature-2026-11-25.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
