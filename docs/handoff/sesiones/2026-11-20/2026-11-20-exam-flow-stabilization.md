# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: 2026-11-20-exam-flow-stabilization
- parentSessionId: -
- status: final
- generatedAt: 2026-11-20T16:44:15.276Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: assistant
- channel: desktop

## Solicitud
- Estabilizar el flujo prioritario de banco, generación de exámenes y diagnósticos API locales antes de CI.

## Objetivo
- Cerrar las regresiones de capacidad compartida, presupuesto PDF, orden/nombre de lotes, iniciales, scopes y UI responsive con validación local reproducible.

## Alcance
- Generación y descarga PDF
- Variantes deterministas y recuperación de lotes
- Banco de reactivos responsive y rehidratación
- Contrato de scopes API e iniciales de alumnos
- Validación local

## Restricciones
- No aumentar versión por corrección
- No registrar secretos ni credenciales
- No integrar sin CI verde y evidencia OMR física
- Excluir archivos auxiliares temporales del commit

## Acciones
- [omitido] validation: Ejecucion de lint (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de typecheck (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de test_frontend_ci (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de test_coverage_ci (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de test_tdd_enforcement_ci (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de test_backend_ci (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de test_portal_ci (2026-11-20T16:44:15.276Z)
- [omitido] validation: Ejecucion de perf_check (2026-11-20T16:44:15.276Z)
- [ok] validation: Ejecucion de pipeline_contract_check (2026-11-20T16:44:15.276Z)
- [ok] validation: Ejecucion de docs_check (2026-11-20T16:44:15.276Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- apps/backend/prisma/schema.prisma
- apps/backend/src/infraestructura/baseDatos/sqlite.ts
- apps/backend/src/modulos/modulo_alumnos/controladorAlumnos.ts
- apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/gestionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
- apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
- apps/backend/src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.ts
- apps/backend/src/modulos/modulo_papelera/controladorPapelera.ts
- apps/backend/src/modulos/modulo_recuperacion_examenes/servicioRecuperacionExamenes.ts
- apps/backend/tests/contrato/validaciones.test.ts
- apps/backend/tests/integracion/_flujoDocenteHelper.ts
- apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts
- apps/backend/tests/integracion/examenesRetention.test.ts
- apps/backend/tests/integracion/omrJobsWorkflow.test.ts
- apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
- apps/backend/tests/integracion/qrEscaneoOmr.test.ts
- apps/backend/tests/integracion/reactivosIngesta.test.ts
- apps/backend/tests/omr.geometry.reference.test.ts
- apps/backend/tests/pdf.ecofont.test.ts
- apps/backend/tests/pdf.layout.visual.guard.test.ts
- apps/backend/tests/pdf.numeroPaginasPlantilla.test.ts
- apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasFormulario.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions.ts
- apps/frontend/src/styles/screens.css
- apps/frontend/tests/plantillas.hooks.test.tsx
- docs/specs/SPEC-038_alumnos_roster_management.spec.md
- docs/specs/SPEC-068_generacion_lotes_pdf_integridad.spec.md
- scripts/tests/omr-version-policy.test.mjs
- apps/backend/src/modulos/modulo_alumnos/ordenListaAlumnos.ts
- apps/backend/tests/lotePdf.naming.test.ts
- apps/backend/tests/pdf.orden-capacidad.test.ts
- apps/backend/tmp_pdf_visual_check.ts
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasDescargaEstado.tsx
- apps/frontend/tests/plantillas.descarga.estado.test.tsx
- scripts/migrate-alumnos-orden-lista-sqlite.mjs
- scripts/tests/migrate-alumnos-orden-lista-sqlite.test.mjs

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
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=4653)
  resultado: ✔ Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final (2.4785ms) | ▶ el guard del checkout candidato solo permite EOL sin cambios semánticos | ✔ acepta diferencias CRLF/LF sin contenido distinto (674.9999ms) | ✔ acepta EOL-only en JSON de evidencia fuera de la allowlist histórica (638.5861ms) | ... | npm notice run evaluapro@1.2.25 pipeline:contract:check | npm notice run node scripts/pipeline-contract-check.mjs
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=1505)
  resultado: [docs] ok | npm notice run evaluapro@1.2.25 docs:check | npm notice run node scripts/docs.mjs --check

## Decisiones
- La política shared conserva orden común de opciones y adapta selección/conteo por alumno cuando el presupuesto lo exige.
- Los exámenes parciales se limitan a 2 páginas y los globales a 4; el renderer valida el límite.
- El trabajo local puede publicarse para CI, pero la integración queda pendiente de gates y evidencia real OMR.

## Supuestos
- Los tests de integración usan loopback local autorizado; el primer intento sin elevación falló por restricción del sandbox, no por aserción.

## Riesgos abiertos
- No hay capturas físicas en el corpus piloto OMR; solo pasó el corpus sintético del worktree.
- No se ejecutó el conjunto completo de backend, portal y coverage CI.

## Estado del arbol
```txt
M apps/backend/prisma/schema.prisma
 M apps/backend/src/infraestructura/baseDatos/sqlite.ts
 M apps/backend/src/modulos/modulo_alumnos/controladorAlumnos.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/evaluatorCodeFingerprint.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/gestionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.ts
 M apps/backend/src/modulos/modulo_papelera/controladorPapelera.ts
 M apps/backend/src/modulos/modulo_recuperacion_examenes/servicioRecuperacionExamenes.ts
 M apps/backend/tests/contrato/validaciones.test.ts
 M apps/backend/tests/integracion/_flujoDocenteHelper.ts
 M apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts
 M apps/backend/tests/integracion/examenesRetention.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/integracion/qrEscaneoOmr.test.ts
 M apps/backend/tests/integracion/reactivosIngesta.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/pdf.ecofont.test.ts
 M apps/backend/tests/pdf.layout.visual.guard.test.ts
 M apps/backend/tests/pdf.numeroPaginasPlantilla.test.ts
 M apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasFormulario.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions.ts
 M apps/frontend/src/styles/screens.css
 M apps/frontend/tests/plantillas.hooks.test.tsx
 M docs/specs/SPEC-038_alumnos_roster_management.spec.md
 M docs/specs/SPEC-068_generacion_lotes_pdf_integridad.spec.md
 M scripts/tests/omr-version-policy.test.mjs
?? apps/backend/src/modulos/modulo_alumnos/ordenListaAlumnos.ts
?? apps/backend/tests/lotePdf.naming.test.ts
?? apps/backend/tests/pdf.orden-capacidad.test.ts
?? apps/backend/tmp_pdf_visual_check.ts
?? apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasDescargaEstado.tsx
?? apps/frontend/tests/plantillas.descarga.estado.test.tsx
?? scripts/migrate-alumnos-orden-lista-sqlite.mjs
?? scripts/tests/migrate-alumnos-orden-lista-sqlite.test.mjs
```

## Siguiente paso recomendado
- Crear commit y publicar la rama autorizada para CI; inspeccionar los checks remotos y no fusionar hasta pasar gates y validar con capturas OMR reales.

## Artefactos generados
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.json
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
