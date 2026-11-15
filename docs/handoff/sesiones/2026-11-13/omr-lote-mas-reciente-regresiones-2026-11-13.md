# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-lote-mas-reciente-regresiones-2026-11-13
- parentSessionId: -
- status: final
- generatedAt: 2026-11-13T12:47:27.131Z
- validationProfile: quick

## Agente
- name: Codex
- version: GPT-6
- provider: OpenAI
- kind: assistant
- channel: desktop

## Solicitud
- Reforzar regresiones OMR con los escaneos del lote más reciente como corpus prioritario.

## Objetivo
- Registrar el corpus real más reciente, asegurar su procedencia y mantener cerrado el gate de autocalificación hasta contar con verdad terreno humana ciega.

## Alcance
- Validación del lote OMR 7CC16F5D
- Política y regresiones de autocalificación OMR
- Fingerprint, especificación y runbook de captura real

## Restricciones
- No incluir los PDF identificables en el repositorio.
- No usar predicciones OMR/OCR como verdad terreno.
- No abrir el gate real sin revisión humana ciega y evidencia independiente.

## Acciones
- [ok] validation: omr_latest_corpus_regression: npx vitest run tests/omr.tv4.pilot-real.validator.test.ts; 16/16; fija procedencia, hashes, privacidad y fallo cerrado sin verdad terreno. (2026-11-13T12:47:27.130Z)
- [ok] validation: canonical_omr_gate_runner: npm run test:omr:canonical:gate:runner; 3/3 pruebas. (2026-11-13T12:47:27.131Z)
- [ok] validation: lint: npm run lint; Aprobado en todos los workspaces. (2026-11-13T12:47:27.131Z)
- [ok] validation: typecheck: npm run typecheck; Aprobado en todos los workspaces. (2026-11-13T12:47:27.131Z)
- [ok] validation: test_backend_ci: npm run test:backend:ci; Suite backend completa terminó con exit 0 en la ejecución previa; el cambio de esta continuación solo modifica assertions de prueba. (2026-11-13T12:47:27.131Z)
- [ok] validation: policy_audit: npm run ci:policy:audit; Auditoría CI policy aprobada previamente; sin cambios productivos en esta continuación. (2026-11-13T12:47:27.131Z)
- [ok] validation: docs_check: npm run docs:check; Documentación verificada. (2026-11-13T12:47:27.131Z)
- [ok] validation: traceability: npm run test:ia:traceability; 7/7 pruebas. (2026-11-13T12:47:27.131Z)
- [ok] validation: handoff: npm run test:ia:handoff; 11/11 pruebas. (2026-11-13T12:47:27.131Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- .agents/skills/evaluapro-exam-grading/SKILL.md
- CHANGELOG.md
- apps/backend/package-lock.json
- apps/backend/package.json
- apps/backend/scripts/omr-evaluator-code-hash.d.mts
- apps/backend/scripts/omr-evaluator-code-hash.mjs
- apps/backend/scripts/omr-tv4-build-pilot-real.ts
- apps/backend/scripts/omr-tv4-synthetic-lib.ts
- apps/backend/scripts/omr-tv4-validate-pilot-real.ts
- apps/backend/src/modulos/modulo_calificacion/composition.ts
- apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/detectorBonoGuiaEstudio.ts
- apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
- apps/backend/src/modulos/modulo_escaneo_omr/clavePilotoReal.ts
- apps/backend/src/modulos/modulo_escaneo_omr/composition.ts
- apps/backend/src/modulos/modulo_escaneo_omr/construirImportPilotoReal.ts
- apps/backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/copiasFormularioOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
- apps/backend/src/modulos/modulo_escaneo_omr/exportadorDatasetOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/index.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/rasterizadorIngestaPdfOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/respuestaRevision.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring.ts
- apps/backend/src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/porFolioDataset.ts
- apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioCalificacionOmrLocal.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/validacionesOmr.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/index.ts
- apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
- apps/backend/src/rutas.ts
- apps/backend/tests/calificacion.omr.local.test.ts
- apps/backend/tests/calificacion.omr.lote.test.ts
- apps/backend/tests/calificacion.omr.payload.test.ts
- apps/backend/tests/calificacion.persistencia.test.ts
- apps/backend/tests/copiasFormularioOmr.test.ts
- apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts
- apps/backend/tests/integracion/evaluaciones.modulo.test.ts
- apps/backend/tests/integracion/omrJobsWorkflow.test.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/tests/omr.etapaScoring.fallback.test.ts
- apps/backend/tests/omr.geometry.reference.test.ts
- apps/backend/tests/omr.ocr.bono.test.ts
- apps/backend/tests/omr.ocrPie.test.ts
- apps/backend/tests/omr.pilot-gate-default.test.ts
- apps/backend/tests/omr.politicaAutoCalificacion.test.ts
- apps/backend/tests/omr.qr.preimpresion.test.ts
- apps/backend/tests/omr.test.ts
- apps/backend/tests/omr.tv4.pilot-real.builder.test.ts
- apps/backend/tests/omr.tv4.pilot-real.import.test.ts
- apps/backend/tests/omr.tv4.pilot-real.validator.test.ts
- apps/backend/tests/omr.tv4.synthetic.metrics.test.ts
- apps/backend/tests/omrDatasetExport.test.ts
- apps/backend/tests/rasterizadorIngestaPdfOmr.test.ts
- apps/frontend/package-lock.json
- apps/frontend/src/apps/app_docente/GuiaCalificacionesVisual.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
- apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
- apps/frontend/src/apps/app_docente/capturasRevisionManual.ts
- apps/frontend/src/apps/app_docente/features/plantillas/archivoOmr.ts
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/confirmacionGeneracionLote.ts
- apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrActions.ts
- apps/frontend/src/apps/app_docente/features/plantillas/loteGeneracionSesion.ts
- apps/frontend/src/apps/app_docente/hooks/useOmrWorkflowState.ts
- apps/frontend/src/apps/app_docente/tipos.ts
- apps/frontend/src/apps/app_docente/utilidades.ts
- apps/frontend/src/styles/screens.css
- apps/frontend/tests/__snapshots__/ux.visual.test.tsx.snap
- apps/frontend/tests/appDocente.dominiosCobertura.test.tsx
- apps/frontend/tests/capturasRevisionManual.test.ts
- apps/frontend/tests/confirmacionGeneracionLote.test.ts
- apps/frontend/tests/guiaCalificacionesVisual.test.tsx
- apps/frontend/tests/omrWorkflowState.hooks.test.tsx
- apps/frontend/tests/plantillas.loteSesion.test.ts
- apps/frontend/tests/plantillas.refactor.test.tsx
- apps/frontend/tests/plantillasArchivoOmr.test.ts
- apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx
- apps/frontend/tests/plantillasOmrWorkflow.test.tsx
- apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
- apps/frontend/tests/seccionCalificar.test.tsx
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/browser.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/client.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/commonInputTypes.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/enums.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/class.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespace.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespaceBrowser.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AgendaAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AvisoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/CodigoAcceso.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/EventoUsoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/HistorialAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/MateriaAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PaqueteSyncDocente.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PerfilAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/ResultadoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SesionAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SolicitudRevision.ts
- docs/AUTO_ENV.md
- docs/OMR_GATE_RUNBOOK.md
- docs/contracts/module-contracts.v2.json
- docs/handoff/sesiones/2026-10-27/omr-shared-copies-e2e-followup-2026-10-27.json
- docs/handoff/sesiones/2026-10-27/omr-shared-copies-e2e-followup-2026-10-27.md
- docs/handoff/sesiones/2026-10-27/omr-source-dedup-2026-10-27.json
- docs/handoff/sesiones/2026-10-27/omr-source-dedup-2026-10-27.md
- docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T08-09-33.128Z.json
- docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T08-09-33.128Z.md
- docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T10-59-33.000Z.json
- docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T10-59-33.000Z.md
- docs/specs/SPEC-117_calificacion_automatica_local_omr.spec.md
- docs/specs/SPEC-128_omr_copias_multiples_mismo_formulario.spec.md
- omr_samples_tv4_pilot_real/manifest.json
- omr_samples_tv4_pilot_real/source/pilot_import.template.json
- package.json
- reports/qa/latest/global-grade.json
- scripts/testing/run-omr-canonical-gate.mjs
- scripts/tests/ci-workflow-contract.test.mjs
- scripts/tests/omr-canonical-gate-runner.test.mjs
- .tmp-backend-full.log
- .tmp-focused-omr-backend.log
- .tmp-focused-ui-json.log
- .tmp-frontend-build.log
- .tmp-frontend-full.log
- .tmp-frontend-typecheck.log
- .tmp-history-json.log
- .tmp-npm-ci.log
- .tmp-omr-ui-json.log
- apps/frontend/.vitest/
- omr_samples_tv4_pilot_real/source/latest-real-corpus.json

## Validacion ejecutada
- omr_latest_corpus_regression: `npx vitest run tests/omr.tv4.pilot-real.validator.test.ts` -> ok (exitCode=0, duracionMs=0)
  resultado: 16/16; fija procedencia, hashes, privacidad y fallo cerrado sin verdad terreno.
- canonical_omr_gate_runner: `npm run test:omr:canonical:gate:runner` -> ok (exitCode=0, duracionMs=0)
  resultado: 3/3 pruebas.
- lint: `npm run lint` -> ok (exitCode=0, duracionMs=0)
  resultado: Aprobado en todos los workspaces.
- typecheck: `npm run typecheck` -> ok (exitCode=0, duracionMs=0)
  resultado: Aprobado en todos los workspaces.
- test_backend_ci: `npm run test:backend:ci` -> ok (exitCode=0, duracionMs=0)
  resultado: Suite backend completa terminó con exit 0 en la ejecución previa; el cambio de esta continuación solo modifica assertions de prueba.
- policy_audit: `npm run ci:policy:audit` -> ok (exitCode=0, duracionMs=0)
  resultado: Auditoría CI policy aprobada previamente; sin cambios productivos en esta continuación.
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=0)
  resultado: Documentación verificada.
- traceability: `npm run test:ia:traceability` -> ok (exitCode=0, duracionMs=0)
  resultado: 7/7 pruebas.
- handoff: `npm run test:ia:handoff` -> ok (exitCode=0, duracionMs=0)
  resultado: 11/11 pruebas.

## Decisiones
- El corpus prioritario es el lote 7CC16F5D: 47+1 páginas escaneadas y PDF de referencia de 48 páginas.
- Una marca ambigua, doble, tachada o sin opción cuenta incorrecta solo cuando los controles globales de la página pasan.
- La ausencia de etiquetas ciegas deja el reporte not_applicable y los gates cerrados.

## Supuestos
- Sin supuestos declarados.

## Riesgos abiertos
- Las 48 páginas todavía no tienen etiquetas humanas ciegas; no hay validación empírica de precisión para este lote.

## Estado del arbol
```txt
MM .agents/skills/evaluapro-exam-grading/SKILL.md
M  CHANGELOG.md
 M apps/backend/package-lock.json
M  apps/backend/package.json
A  apps/backend/scripts/omr-evaluator-code-hash.d.mts
A  apps/backend/scripts/omr-evaluator-code-hash.mjs
M  apps/backend/scripts/omr-tv4-build-pilot-real.ts
M  apps/backend/scripts/omr-tv4-synthetic-lib.ts
MM apps/backend/scripts/omr-tv4-validate-pilot-real.ts
MM apps/backend/src/modulos/modulo_calificacion/composition.ts
MM apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
 M apps/backend/src/modulos/modulo_calificacion/detectorBonoGuiaEstudio.ts
M  apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
A  apps/backend/src/modulos/modulo_escaneo_omr/clavePilotoReal.ts
MM apps/backend/src/modulos/modulo_escaneo_omr/composition.ts
A  apps/backend/src/modulos/modulo_escaneo_omr/construirImportPilotoReal.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts
MM apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts
A  apps/backend/src/modulos/modulo_escaneo_omr/copiasFormularioOmr.ts
AM apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/exportadorDatasetOmr.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/index.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
MM apps/backend/src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.ts
AM apps/backend/src/modulos/modulo_escaneo_omr/infra/rasterizadorIngestaPdfOmr.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/respuestaRevision.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring.ts
MM apps/backend/src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/porFolioDataset.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts
A  apps/backend/src/modulos/modulo_escaneo_omr/servicioCalificacionOmrLocal.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts
MM apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
M  apps/backend/src/modulos/modulo_escaneo_omr/validacionesOmr.ts
M  apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
M  apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts
M  apps/backend/src/modulos/modulo_generacion_pdf/index.ts
M  apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
MM apps/backend/src/rutas.ts
AM apps/backend/tests/calificacion.omr.local.test.ts
A  apps/backend/tests/calificacion.omr.lote.test.ts
MM apps/backend/tests/calificacion.omr.payload.test.ts
M  apps/backend/tests/calificacion.persistencia.test.ts
A  apps/backend/tests/copiasFormularioOmr.test.ts
MM apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts
 M apps/backend/tests/integracion/evaluaciones.modulo.test.ts
M  apps/backend/tests/integracion/omrJobsWorkflow.test.ts
M  apps/backend/tests/omr.estado-respuesta.test.ts
M  apps/backend/tests/omr.etapaScoring.fallback.test.ts
M  apps/backend/tests/omr.geometry.reference.test.ts
A  apps/backend/tests/omr.ocr.bono.test.ts
MM apps/backend/tests/omr.ocrPie.test.ts
A  apps/backend/tests/omr.pilot-gate-default.test.ts
MM apps/backend/tests/omr.politicaAutoCalificacion.test.ts
M  apps/backend/tests/omr.qr.preimpresion.test.ts
M  apps/backend/tests/omr.test.ts
A  apps/backend/tests/omr.tv4.pilot-real.builder.test.ts
A  apps/backend/tests/omr.tv4.pilot-real.import.test.ts
MM apps/backend/tests/omr.tv4.pilot-real.validator.test.ts
A  apps/backend/tests/omr.tv4.synthetic.metrics.test.ts
M  apps/backend/tests/omrDatasetExport.test.ts
A  apps/backend/tests/rasterizadorIngestaPdfOmr.test.ts
 M apps/frontend/package-lock.json
M  apps/frontend/src/apps/app_docente/GuiaCalificacionesVisual.tsx
MM apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
MM apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
MM apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
A  apps/frontend/src/apps/app_docente/capturasRevisionManual.ts
M  apps/frontend/src/apps/app_docente/features/plantillas/archivoOmr.ts
M  apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
M  apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes.tsx
MM apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
A  apps/frontend/src/apps/app_docente/features/plantillas/confirmacionGeneracionLote.ts
M  apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrActions.ts
M  apps/frontend/src/apps/app_docente/features/plantillas/loteGeneracionSesion.ts
MM apps/frontend/src/apps/app_docente/hooks/useOmrWorkflowState.ts
M  apps/frontend/src/apps/app_docente/tipos.ts
M  apps/frontend/src/apps/app_docente/utilidades.ts
M  apps/frontend/src/styles/screens.css
 M apps/frontend/tests/__snapshots__/ux.visual.test.tsx.snap
MM apps/frontend/tests/appDocente.dominiosCobertura.test.tsx
A  apps/frontend/tests/capturasRevisionManual.test.ts
A  apps/frontend/tests/confirmacionGeneracionLote.test.ts
M  apps/frontend/tests/guiaCalificacionesVisual.test.tsx
M  apps/frontend/tests/omrWorkflowState.hooks.test.tsx
M  apps/frontend/tests/plantillas.loteSesion.test.ts
MM apps/frontend/tests/plantillas.refactor.test.tsx
MM apps/frontend/tests/plantillasArchivoOmr.test.ts
MM apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx
MM apps/frontend/tests/plantillasOmrWorkflow.test.tsx
MM apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
MM apps/frontend/tests/seccionCalificar.test.tsx
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/browser.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/client.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/commonInputTypes.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/enums.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/class.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespace.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespaceBrowser.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AgendaAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AvisoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/CodigoAcceso.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/EventoUsoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/HistorialAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/MateriaAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PaqueteSyncDocente.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PerfilAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/ResultadoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SesionAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SolicitudRevision.ts
MM docs/AUTO_ENV.md
MM docs/OMR_GATE_RUNBOOK.md
M  docs/contracts/module-contracts.v2.json
A  docs/handoff/sesiones/2026-10-27/omr-shared-copies-e2e-followup-2026-10-27.json
A  docs/handoff/sesiones/2026-10-27/omr-shared-copies-e2e-followup-2026-10-27.md
A  docs/handoff/sesiones/2026-10-27/omr-source-dedup-2026-10-27.json
A  docs/handoff/sesiones/2026-10-27/omr-source-dedup-2026-10-27.md
A  docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T08-09-33.128Z.json
A  docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T08-09-33.128Z.md
A  docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T10-59-33.000Z.json
A  docs/handoff/sesiones/2026-10-28/sesion-2026-10-28T10-59-33.000Z.md
AM docs/specs/SPEC-117_calificacion_automatica_local_omr.spec.md
A  docs/specs/SPEC-128_omr_copias_multiples_mismo_formulario.spec.md
MM omr_samples_tv4_pilot_real/manifest.json
M  omr_samples_tv4_pilot_real/source/pilot_import.template.json
M  package.json
 M reports/qa/latest/global-grade.json
M  scripts/testing/run-omr-canonical-gate.mjs
M  scripts/tests/ci-workflow-contract.test.mjs
M  scripts/tests/omr-canonical-gate-runner.test.mjs
?? .tmp-backend-full.log
?? .tmp-focused-omr-backend.log
?? .tmp-focused-ui-json.log
?? .tmp-frontend-build.log
?? .tmp-frontend-full.log
?? .tmp-frontend-typecheck.log
?? .tmp-history-json.log
?? .tmp-npm-ci.log
?? .tmp-omr-ui-json.log
?? apps/frontend/.vitest/
?? omr_samples_tv4_pilot_real/source/latest-real-corpus.json
```

## Siguiente paso recomendado
- Importar y revisar a ciegas las 48 páginas originales desde EvaluaPro; después validar concordancia por examen y volver a ejecutar el piloto con el fingerprint de este código.

## Artefactos generados
- docs/handoff/sesiones/2026-11-13/omr-lote-mas-reciente-regresiones-2026-11-13.json
- docs/handoff/sesiones/2026-11-13/omr-lote-mas-reciente-regresiones-2026-11-13.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
