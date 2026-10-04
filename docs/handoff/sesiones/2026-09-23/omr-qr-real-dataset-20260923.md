# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-qr-real-dataset-20260923
- parentSessionId: -
- status: final
- generatedAt: 2026-09-23T10:47:17.856Z
- validationProfile: quick

## Agente
- name: unknown
- version: unknown
- provider: unknown
- kind: unknown
- channel: unknown

## Solicitud
- Continuar la mejora del OMR sobre el dataset fotográfico real, incluyendo detección QR y cotejo obligatorio contra los PDF fuente preimpresión.

## Objetivo
- Aplicar rescate cromático conservador y medir su efecto en las 38 páginas; verificar que cada respuesta emitida siga las etiquetas visuales; determinar si los QR del dataset son legibles comparándolos con los dos PDF fuente.

## Alcance
- Evaluación completa del dataset Mobile Devices y control de exámenes vacíos.
- Comparación del QR de 38 fotos contra los 32 payloads de los PDF adjuntos.
- Actualización de SPEC-062 y registro de evidencia de esta sesión.

## Restricciones
- No usar la clave para escoger respuestas detectadas; solo para medir calificación.
- No convertir abstenciones o marcas dobles en letras para elevar cobertura.
- Preservar los cambios preexistentes del checkout compartido.
- No declarar exactitud independiente a partir de las etiquetas visuales disponibles.

## Acciones
- [ok] validation: Ejecucion de omr_full_real_dataset (2026-09-23T10:47:17.856Z)
- [falla] validation: Ejecucion de omr_qr_preprint_reference_audit (2026-09-23T10:47:17.856Z)
- [ok] validation: Ejecucion de omr_focused_vitest (2026-09-23T10:47:17.856Z)
- [ok] validation: Ejecucion de omr_lint_tsc_diffcheck (2026-09-23T10:47:17.856Z)
- [ok] validation: Ejecucion de pipeline_contract_check (2026-09-23T10:47:17.856Z)
- [falla] validation: Ejecucion de docs_check (2026-09-23T10:47:17.856Z)

## Archivos leidos
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/scripts/omr-qr-preprint-check.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Archivos cambiados
- apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Validacion ejecutada
- omr_full_real_dataset: `npx tsx scripts/omr-eval-real-dataset.mjs` -> ok (exitCode=0, duracionMs=879616)
  resultado: 38 paginas procesadas; 499/499 estados; 458/472 etiquetas con letra automatica, 458 concordantes; 2 paginas vacias. QR 0/38.
- omr_qr_preprint_reference_audit: `node --experimental-strip-types scripts/omr-qr-preprint-check.ts --pdf <dos PDF fuente> --benchmark-report <reporte> --dpi 300` -> falla (exitCode=1, duracionMs=0)
  resultado: Duracion no capturada. Gate correctamente rechazado: 0/8 y 0/24 PDF rasterizados con payload exacto; 0/38 fotos con lectura/coincidencia.
- omr_focused_vitest: `node ../../node_modules/vitest/vitest.mjs run tests/omr.estado-respuesta.test.ts tests/omr.consenso.robusto.test.ts tests/omr.cv.engine.test.ts tests/omr.core.decision.test.ts` -> ok (exitCode=0, duracionMs=1460)
  resultado: 4 archivos y 55 pruebas aprobadas.
- omr_lint_tsc_diffcheck: `npx eslint <tres archivos OMR> --max-warnings=0; npx tsc --noEmit --project tsconfig.json --pretty false; git diff --check` -> ok (exitCode=0, duracionMs=10400)
  resultado: ESLint, TypeScript directo y git diff --check aprobados.
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=0)
  resultado: Aprobado por el perfil quick del generador de handoff.
- docs_check: `npm run docs:check` -> falla (exitCode=1, duracionMs=0)
  resultado: Preexistente: docs/AUTO_ENV.md desactualizado; el chequeo indica ejecutar npm run docs:generate.

## Decisiones
- Mantener lectura QR y mapeo de contingencia como métricas distintas; no atribuir identidad por una similitud sin margen validado.
- Los dos PDF fuente adjuntos no se aprueban para impresión: la página rasterizada completa no decodifica en 32/32 páginas.
- El QR de las fotos no puede rescatarse con fiabilidad cuando la propia referencia preimpresión falla; regenerar el PDF con la plantilla corregida y volver a imprimir antes de validar QR fotográfico.

## Supuestos
- Las etiquetas visuales del informe son la referencia disponible para concordancia, pero no se ha establecido una verdad terreno independiente y ciega.

## Riesgos abiertos
- 14 reactivos con etiqueta visual conocida siguen sin letra automática; la cobertura no es 100%.
- Los QR de las referencias y fotografías permanecen ilegibles; su recuperación requiere una nueva referencia impresa válida, no solo otro umbral del decoder.
- El checkout contiene numerosos cambios ajenos a esta sesión; no deben mezclarse ni revertirse.

## Estado del arbol
```txt
M apps/backend/package.json
 M apps/backend/prisma/schema.prisma
 M apps/backend/reports/qa/latest/global-grade.json
 M apps/backend/src/infraestructura/baseDatos/sqlite.ts
 M apps/backend/src/infraestructura/seguridad/rbac.ts
 M apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
 M apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts
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
 M apps/backend/src/modulos/modulo_hidratacion_cursos/controladorHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/validacionesHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/hidratacionCursos.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/integracion/rolesPermisos.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/pdf.canonico.test.ts
 M apps/backend/tests/pdf.layout.visual.guard.test.ts
 M apps/backend/tests/pdf.paridad.test.ts
 M apps/backend/tests/qr.examen.test.ts
 M apps/backend/tests/sincronizacion.test.ts
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
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
 M apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts
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
 M scripts/build-msi.ps1
 M scripts/serve-docente-static.mjs
 M scripts/start-docente-native.mjs
 M scripts/testing/start-frontend-e2e-server.mjs
 M scripts/tests/installer-hub-contract.test.mjs
 M tests/gui-responsive/ciclo-completo.spec.ts
 M tests/gui-responsive/journey-docente-integral.spec.ts
 M tests/gui-responsive/playwright.ciclo.config.mjs
?? apps/backend/scripts/omr-eval-real-dataset.mjs
?? apps/backend/scripts/omr-qr-preprint-check.ts
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
?? apps/backend/tests/omr.qr.preimpresion.test.ts
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
?? apps/frontend/tests/permisosBanco.hooks.test.tsx
?? apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
?? docs/GUIA_ICONOGRAFIA.md
?? docs/contracts/
?? docs/handoff/sesiones/2026-09-23/
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? output/qa/omr-plantilla-sync-20260923.layout.json
?? output/qa/omr-plantilla-sync-20260923.pdf
?? scripts/migrate-reactivos-backfill.mjs
?? scripts/migrate-reactivos-sqlite.mjs
?? scripts/tests/migrate-reactivos-backfill.test.mjs
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
- Regenerar muestras de ambos lotes con el renderer actual; exigir preflight QR exacto en todas las páginas antes de imprimir, capturar fotos nuevas y reevaluar lectura directa y rescate geométrico. En paralelo, continuar la investigación conservadora de los 14 reactivos pendientes sin usar la clave como detector.

## Artefactos generados
- C:/Users/evega/AppData/Local/Temp/omr-full-color-rescue-20260923.json
- C:/Users/evega/AppData/Local/Temp/omr-color-targeted-20260923.json
- C:/Users/evega/AppData/Local/Temp/omr-color-empty-controls-20260923.json

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
