# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: sesion-asistencias-e2e-2026-09-23
- parentSessionId: -
- status: final
- generatedAt: 2026-09-23T07:53:37.486Z
- validationProfile: quick

## Agente
- name: unknown
- version: unknown
- provider: unknown
- kind: unknown
- channel: unknown

## Solicitud
- Corregir los bloqueos ajenos a OMR encontrados al continuar el E2E del pase de lista.

## Objetivo
- Resolver la aserción ambigua de Plantillas en el journey docente sin entrar en los pasos OMR reservados al hilo dedicado.

## Alcance
- tests/gui-responsive/journey-docente-integral.spec.ts

## Restricciones
- No modificar especificaciones, código ni pruebas del módulo OMR.
- Preservar cambios ajenos presentes en el checkout canónico.

## Acciones
- [pending] fix: Cambiar la aserción ambigua role=status por una consulta exacta al mensaje Plantilla creada, confirmado en el DOM capturado. (2026-09-23T07:53:37.486Z)
- [pending] validation: ESLint del journey aprobado y pruebas unitarias de Plantillas aprobadas: 14 de 14. (2026-09-23T07:53:37.486Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- apps/backend/prisma/schema.prisma
- apps/backend/reports/qa/latest/global-grade.json
- apps/backend/src/infraestructura/baseDatos/sqlite.ts
- apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
- apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
- apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
- apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
- apps/backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts
- apps/backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts
- apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
- apps/backend/src/modulos/modulo_escaneo_omr/README.md
- apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
- apps/backend/tests/integracion/asistencia.reglas.test.ts
- apps/backend/tests/integracion/listaAcademicaContratos.test.ts
- apps/backend/tests/integracion/omrJobsWorkflow.test.ts
- apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
- apps/backend/tests/omr.core.decision.test.ts
- apps/backend/tests/omr.geometry.reference.test.ts
- apps/backend/tests/pdf.canonico.test.ts
- apps/backend/tests/qr.examen.test.ts
- apps/backend/tests/utils/mongo.ts
- apps/frontend/package-lock.json
- apps/frontend/package.json
- apps/frontend/src/apps/app_docente/AppDocente.tsx
- apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
- apps/frontend/src/apps/app_docente/SeccionBanco.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
- apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
- apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
- apps/frontend/src/apps/app_docente/hooks/useRecordatorioPaseLista.ts
- apps/frontend/src/apps/app_docente/tipos.ts
- apps/frontend/src/apps/app_docente/utilidades.ts
- apps/frontend/src/styles.css
- apps/frontend/src/styles/cards.css
- apps/frontend/src/styles/screens.css
- apps/frontend/src/ui/iconos.tsx
- apps/frontend/src/ui/version/VersionInfoPage.tsx
- apps/frontend/tests/appDocente.previewConsolidado.test.tsx
- apps/frontend/tests/banco.refactor.test.tsx
- apps/frontend/tests/escaneo.refactor.test.tsx
- apps/frontend/tests/gui.responsive.contract.test.tsx
- apps/frontend/tests/plantillas.hooks.test.tsx
- apps/frontend/tests/plantillas.refactor.test.tsx
- apps/frontend/tests/seccionAsistencias.test.tsx
- apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
- apps/frontend/tests/utilidades.appDocente.test.ts
- apps/frontend/tests/versionInfo.helpers.test.tsx
- apps/frontend/tests/versionInfoPage.test.tsx
- apps/frontend/vite.config.ts
- config/version-catalog.json
- docs/AUTO_DOCS_INDEX.md
- docs/AUTO_ENV.md
- docs/WCAG_UI_POLICY.md
- docs/specs/SPEC-036_autenticacion_guardrails.spec.md
- docs/specs/SPEC-039_asistencias_seguimiento.spec.md
- docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
- docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
- scripts/serve-docente-static.mjs
- scripts/start-docente-native.mjs
- scripts/testing/start-frontend-e2e-server.mjs
- tests/gui-responsive/ciclo-completo.spec.ts
- tests/gui-responsive/journey-docente-integral.spec.ts
- tests/gui-responsive/playwright.ciclo.config.mjs
- apps/backend/scripts/omr-eval-real-dataset.mjs
- apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
- apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
- apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
- apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
- apps/backend/tests/calificacion.omr.estado.test.ts
- apps/backend/tests/integracion/reactivosIngesta.test.ts
- apps/backend/tests/listaAcademicaResumen.test.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/tests/reactivosCalibracion.test.ts
- apps/backend/tests/reactivosContrato.test.ts
- apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
- apps/frontend/src/apps/app_docente/fechaLocal.ts
- apps/frontend/src/ui/IconoLucide.tsx
- apps/frontend/src/ui/iconosCatalogo.ts
- apps/frontend/src/ui/version/changelog.ts
- apps/frontend/src/ui/version/legal/
- apps/frontend/tests/bancoImportacionReactivos.test.tsx
- apps/frontend/tests/changelog.test.ts
- apps/frontend/tests/fechaLocal.test.ts
- apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
- docs/GUIA_ICONOGRAFIA.md
- docs/contracts/
- docs/handoff/sesiones/2026-09-23/
- docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
- docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
- docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
- scripts/migrate-reactivos-backfill.mjs
- scripts/migrate-reactivos-sqlite.mjs
- scripts/tests/migrate-reactivos-sqlite.test.mjs
- storage/omr_debug/058868F3/
- storage/omr_debug/1458887E/
- storage/omr_debug/5AFC1D79/
- storage/omr_debug/780DC77D/
- storage/omr_debug/DCA5097F/
- storage/omr_debug/E2FAFF07/
- storage/omr_debug/EE26CF1C/
- tests/gui-responsive/banco-reactivos.spec.ts

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
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=552)
  resultado: > evaluapro@1.1.6 pipeline:contract:check | > node scripts/pipeline-contract-check.mjs | ✔ ext_perf_arquitectura prepara sharp antes de perf:check (1.8183ms) | ✔ ext_funcionales usa el gate OMR canónico (0.6103ms) | ... | ℹ duration_ms 94.3725 | pipeline contract OK
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=990)
  resultado: > evaluapro@1.1.6 docs:check | > node scripts/docs.mjs --check | [docs] ok

## Decisiones
- Limitar el selector al mensaje de éxito exacto para evitar conflicto con el status de Ajuste automático activo.
- Detener la validación del journey antes de sus siguientes etapas OMR, reservadas al hilo dedicado.

## Supuestos
- Sin supuestos declarados.

## Riesgos abiertos
- La auditoría SDD global continúa señalando rutas de prueba mal declaradas en SPEC-063 de OMR, fuera de este alcance.
- No se repitió el journey integral después del cambio de selector, porque las etapas siguientes comienzan generación y calificación OMR.

## Estado del arbol
```txt
M apps/backend/prisma/schema.prisma
 M apps/backend/reports/qa/latest/global-grade.json
 M apps/backend/src/infraestructura/baseDatos/sqlite.ts
 M apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
 M apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts
 M apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
 M apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/README.md
 M apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/pdf.canonico.test.ts
 M apps/backend/tests/qr.examen.test.ts
 M apps/backend/tests/utils/mongo.ts
 M apps/frontend/package-lock.json
 M apps/frontend/package.json
 M apps/frontend/src/apps/app_docente/AppDocente.tsx
 M apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
 M apps/frontend/src/apps/app_docente/SeccionBanco.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
 M apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
 M apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
 M apps/frontend/src/apps/app_docente/hooks/useRecordatorioPaseLista.ts
 M apps/frontend/src/apps/app_docente/tipos.ts
 M apps/frontend/src/apps/app_docente/utilidades.ts
 M apps/frontend/src/styles.css
 M apps/frontend/src/styles/cards.css
 M apps/frontend/src/styles/screens.css
 M apps/frontend/src/ui/iconos.tsx
 M apps/frontend/src/ui/version/VersionInfoPage.tsx
 M apps/frontend/tests/appDocente.previewConsolidado.test.tsx
 M apps/frontend/tests/banco.refactor.test.tsx
 M apps/frontend/tests/escaneo.refactor.test.tsx
 M apps/frontend/tests/gui.responsive.contract.test.tsx
 M apps/frontend/tests/plantillas.hooks.test.tsx
 M apps/frontend/tests/plantillas.refactor.test.tsx
 M apps/frontend/tests/seccionAsistencias.test.tsx
 M apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
 M apps/frontend/tests/utilidades.appDocente.test.ts
 M apps/frontend/tests/versionInfo.helpers.test.tsx
 M apps/frontend/tests/versionInfoPage.test.tsx
 M apps/frontend/vite.config.ts
 M config/version-catalog.json
 M docs/AUTO_DOCS_INDEX.md
 M docs/AUTO_ENV.md
 M docs/WCAG_UI_POLICY.md
 M docs/specs/SPEC-036_autenticacion_guardrails.spec.md
 M docs/specs/SPEC-039_asistencias_seguimiento.spec.md
 M docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
 M docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
 M scripts/serve-docente-static.mjs
 M scripts/start-docente-native.mjs
 M scripts/testing/start-frontend-e2e-server.mjs
 M tests/gui-responsive/ciclo-completo.spec.ts
 M tests/gui-responsive/journey-docente-integral.spec.ts
 M tests/gui-responsive/playwright.ciclo.config.mjs
?? apps/backend/scripts/omr-eval-real-dataset.mjs
?? apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
?? apps/backend/tests/calificacion.omr.estado.test.ts
?? apps/backend/tests/integracion/reactivosIngesta.test.ts
?? apps/backend/tests/listaAcademicaResumen.test.ts
?? apps/backend/tests/omr.consenso.robusto.test.ts
?? apps/backend/tests/omr.estado-respuesta.test.ts
?? apps/backend/tests/reactivosCalibracion.test.ts
?? apps/backend/tests/reactivosContrato.test.ts
?? apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
?? apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
?? apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
?? apps/frontend/src/apps/app_docente/fechaLocal.ts
?? apps/frontend/src/ui/IconoLucide.tsx
?? apps/frontend/src/ui/iconosCatalogo.ts
?? apps/frontend/src/ui/version/changelog.ts
?? apps/frontend/src/ui/version/legal/
?? apps/frontend/tests/bancoImportacionReactivos.test.tsx
?? apps/frontend/tests/changelog.test.ts
?? apps/frontend/tests/fechaLocal.test.ts
?? apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
?? docs/GUIA_ICONOGRAFIA.md
?? docs/contracts/
?? docs/handoff/sesiones/2026-09-23/
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? scripts/migrate-reactivos-backfill.mjs
?? scripts/migrate-reactivos-sqlite.mjs
?? scripts/tests/migrate-reactivos-sqlite.test.mjs
?? storage/omr_debug/058868F3/
?? storage/omr_debug/1458887E/
?? storage/omr_debug/5AFC1D79/
?? storage/omr_debug/780DC77D/
?? storage/omr_debug/DCA5097F/
?? storage/omr_debug/E2FAFF07/
?? storage/omr_debug/EE26CF1C/
?? tests/gui-responsive/banco-reactivos.spec.ts
```

## Siguiente paso recomendado
- Continuar y validar las etapas OMR en el hilo dedicado; si hace falta, ejecutar desde allí el journey integral completo.

## Artefactos generados
- docs/handoff/sesiones/2026-09-23/sesion-asistencias-e2e-2026-09-23.json
- docs/handoff/sesiones/2026-09-23/sesion-asistencias-e2e-2026-09-23.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
