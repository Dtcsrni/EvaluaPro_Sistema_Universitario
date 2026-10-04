# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-x-real-samples-2026-09-28
- parentSessionId: -
- status: final
- generatedAt: 2026-09-28T22:01:36.006Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: coding-agent
- channel: desktop

## Solicitud
- Continuar la paridad GUI/API de EvaluaPro validando el soporte OMR para X y palomitas con evidencia real.

## Objetivo
- Preparar evidencia visual real y trazable de marcas OMR tipo X sin calificar ni escribir notas, y actualizar el backlog de especificaciones.

## Alcance
- PDF CamScanner local de 48 páginas
- SPEC-062 REQ-038
- SPEC-070 matriz de cobertura
- flujo GUI/API de corrección OMR

## Restricciones
- No registrar calificaciones ni crear jobs en producción.
- No copiar el PDF completo ni incluir datos de identidad en el dataset de QA.
- No afirmar reconocimiento automático hasta evaluar el motor con casos etiquetados y palomitas reales.

## Acciones
- [ok] validation: Ejecucion de pdf_inventory_and_visual_review (2026-09-28T22:01:36.006Z)
- [ok] validation: Ejecucion de omr_dataset_integrity (2026-09-28T22:01:36.006Z)
- [ok] validation: Ejecucion de sdd_audit (2026-09-28T22:01:36.006Z)
- [ok] validation: Ejecucion de backend_omr_review_tests (2026-09-28T22:01:36.006Z)
- [ok] validation: Ejecucion de frontend_omr_review_tests (2026-09-28T22:01:36.006Z)

## Archivos leidos
- AGENTS.md
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- docs/specs/SPEC-070_api_first_automatizacion_docente.spec.md
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/consensoRespuesta.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.ts
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
- output/qa/omr-camera-camscanner-20260924/README.md

## Archivos cambiados
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- docs/specs/SPEC-070_api_first_automatizacion_docente.spec.md
- output/qa/omr-mark-shapes-20260928/README.md
- output/qa/omr-mark-shapes-20260928/manifest.json
- output/qa/omr-mark-shapes-20260928/labels.jsonl
- output/qa/omr-mark-shapes-20260928/review.jpg
- output/qa/omr-mark-shapes-20260928/page03-q15-x-C.jpg
- output/qa/omr-mark-shapes-20260928/page03-q16-ambiguous_crossed.jpg
- output/qa/omr-mark-shapes-20260928/page03-q17-x-A.jpg
- output/qa/omr-mark-shapes-20260928/page03-q18-x-B.jpg
- output/qa/omr-mark-shapes-20260928/page03-q19-x-C.jpg
- output/qa/omr-mark-shapes-20260928/page03-q20-x-D.jpg
- output/qa/omr-mark-shapes-20260928/page03-q21-x-B.jpg
- output/qa/omr-mark-shapes-20260928/page03-q22-ambiguous_crossed.jpg

## Validacion ejecutada
- pdf_inventory_and_visual_review: `pdfplumber inspect + Pillow local extraction` -> ok (exitCode=0, duracionMs=4200)
  resultado: 48 páginas, 96 imágenes, texto embebido cero; se inspeccionó la página 3 completa y el resto en hojas de contacto.
- omr_dataset_integrity: `Python: validar 8 etiquetas, crops y SHA-256 fuente` -> ok (exitCode=0, duracionMs=240)
  resultado: 6 X, 2 ambiguas, cero palomitas; hash del PDF coincide. Un primer comando de validación tenía una aserción incorrecta sobre el tipo de campo samples y se corrigió antes del resultado válido.
- sdd_audit: `npm run sdd:audit` -> ok (exitCode=0, duracionMs=845)
  resultado: Auditoría exitosa; todas las especificaciones cumplen política.
- backend_omr_review_tests: `npm -C apps/backend run test -- --run tests/omr.estado-respuesta.test.ts tests/integracion/omrJobsWorkflow.test.ts` -> ok (exitCode=0, duracionMs=130370)
  resultado: 2 archivos y 24 pruebas pasaron; suite con base de pruebas aislada.
- frontend_omr_review_tests: `npm -C apps/frontend run test -- --run tests/plantillasOmrWorkflow.test.tsx` -> ok (exitCode=0, duracionMs=1370)
  resultado: 1 archivo y 3 pruebas pasaron.

## Decisiones
- Guardar solo recortes de burbujas de la página 3; anotar seis X claras y dos marcas sobrecargadas como ambiguas.
- No atribuir ground truth independiente a etiquetas manuales.
- Mantener reconocimiento automático X/palomita como pendiente de SPEC-062; pedir ejemplo real de palomita.

## Supuestos
- Sin supuestos declarados.

## Riesgos abiertos
- El OMR no se ejecutó sobre las muestras reales; el flujo de reconocimiento automático sigue sin verificar.
- No se encontró ejemplo inequívoco de palomita en el PDF inspeccionado.
- Los tests existentes validan el flujo general de revisión manual, no el detector de X/palomita.

## Estado del arbol
```txt
M .github/workflows/autogen-docs.yml
 M .github/workflows/ci-backend.yml
 M .github/workflows/ci-docs.yml
 M .github/workflows/ci-frontend.yml
 M .github/workflows/ci-installer-windows.yml
 M .github/workflows/ci-policy-audit.yml
 M .github/workflows/ci-portal.yml
 M .github/workflows/ci.yml
 M .github/workflows/pages-marketing.yml
 M .github/workflows/release-beta.yml
 M .github/workflows/release-stable-gate.yml
 M .github/workflows/security-codeql.yml
 M AGENTS.md
 M CHANGELOG.md
 M apps/backend/package-lock.json
 M apps/backend/package.json
 M apps/backend/prisma/schema.prisma
 M apps/backend/reports/qa/latest/global-grade.json
 M apps/backend/scripts/omr-sweep-geometria.ts
 M apps/backend/src/compartido/robustez/soporteRetry.ts
 M apps/backend/src/compartido/robustez/utilitariosControlador.ts
 M apps/backend/src/infraestructura/baseDatos/sqlite.ts
 M apps/backend/src/infraestructura/seguridad/rbac.ts
 M apps/backend/src/modulos/modulo_alumnos/controladorAlumnos.ts
 M apps/backend/src/modulos/modulo_alumnos/rutasAlumnos.ts
 M apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionDocx.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/validacionesAnaliticas.ts
 M apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
 M apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts
 M apps/backend/src/modulos/modulo_autenticacion/middlewareAutenticacion.ts
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
 M apps/backend/src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/porFolioDataset.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/validacionesOmr.ts
 M apps/backend/src/modulos/modulo_evaluaciones/controladorEvaluaciones.ts
 M apps/backend/src/modulos/modulo_evaluaciones/modeloPoliticaCalificacion.ts
 M apps/backend/src/modulos/modulo_evaluaciones/rutasEvaluaciones.ts
 M apps/backend/src/modulos/modulo_evaluaciones/servicioPoliticasCalificacion.ts
 M apps/backend/src/modulos/modulo_evaluaciones/validacionesEvaluaciones.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/gestionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/recoveryManifest.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/configuracionLayoutEnv.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/rutasGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/controladorHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/validacionesHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/controladorIntegracionesClassroom.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/validacionesClassroom.ts
 M apps/backend/src/modulos/modulo_listas_institucionales/servicioListasInstitucionales.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/application/usecases/generarCodigoAcceso.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/application/usecases/publicarResultados.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/infra/omrCapturas.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/validacionesSincronizacion.ts
 M apps/backend/src/modulos/modulo_temarios/controladorTemarios.ts
 M apps/backend/src/modulos/modulo_temarios/rutasTemarios.ts
 M apps/backend/src/modulos/modulo_temarios/validacionesTemarios.ts
 M apps/backend/src/modulos/modulo_vinculacion_entrega/controladorVinculacionEntrega.ts
 M apps/backend/src/modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega.ts
 M apps/backend/src/modulos/modulo_vinculacion_entrega/validacionesVinculacion.ts
 M apps/backend/tests/analiticas.xlsx.sv.contract.test.ts
 M apps/backend/tests/bancoPreguntas.controlador.test.ts
 M apps/backend/tests/calificacion.omr.payload.test.ts
 M apps/backend/tests/integracion/_flujoDocenteHelper.ts
 M apps/backend/tests/integracion/aislamientoDocente.test.ts
 M apps/backend/tests/integracion/alumnosEdicion.test.ts
 M apps/backend/tests/integracion/archivarExamenGenerado.test.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/autenticacion.googleOnly.test.ts
 M apps/backend/tests/integracion/classroom.v2.test.ts
 M apps/backend/tests/integracion/evaluaciones.modulo.test.ts
 M apps/backend/tests/integracion/examenesRetention.test.ts
 M apps/backend/tests/integracion/flujoDocenteGlobalE2E.test.ts
 M apps/backend/tests/integracion/flujoDocenteParcialE2E.test.ts
 M apps/backend/tests/integracion/flujoExamen.test.ts
 M apps/backend/tests/integracion/hidratacionCursos.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
 M apps/backend/tests/integracion/listasInstitucionales.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/periodosBorradoDuplicados.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/integracion/plantillasDuplicadas.test.ts
 M apps/backend/tests/integracion/qrEscaneoOmr.test.ts
 M apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts
 M apps/backend/tests/integracion/recuperacionExamenes.test.ts
 M apps/backend/tests/integracion/regenerarExamenGenerado.test.ts
 M apps/backend/tests/integracion/rolesPermisos.test.ts
 M apps/backend/tests/integracion/temario.pdf.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/omr.politicaAutoCalificacion.test.ts
 M apps/backend/tests/omr.test.ts
 M apps/backend/tests/pdf.canonico.test.ts
 M apps/backend/tests/pdf.layout.visual.guard.test.ts
 M apps/backend/tests/pdf.numeroPaginasPlantilla.test.ts
 M apps/backend/tests/pdf.paridad.test.ts
 M apps/backend/tests/qr.examen.test.ts
 M apps/backend/tests/recovery.manifest.test.ts
 M apps/backend/tests/setup.ts
 M apps/backend/tests/sincronizacion.test.ts
 M apps/backend/tests/utils/mongo.ts
 M apps/frontend/package-lock.json
 M apps/frontend/package.json
 M apps/frontend/src/App.tsx
 M apps/frontend/src/apps/app_docente/AppDocente.tsx
 M apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
 M apps/frontend/src/apps/app_docente/SeccionBanco.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
 M apps/frontend/src/apps/app_docente/SeccionClassroom.tsx
 M apps/frontend/src/apps/app_docente/SeccionEntregaInterna.tsx
 M apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
 M apps/frontend/src/apps/app_docente/SeccionEvaluaciones.tsx
 M apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
 M apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
 M apps/frontend/src/apps/app_docente/SeccionPublicar.tsx
 M apps/frontend/src/apps/app_docente/SeccionRegistroEntrega.tsx
 M apps/frontend/src/apps/app_docente/SeccionSincronizacion.tsx
 M apps/frontend/src/apps/app_docente/SeccionTemarios.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasGenerados.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions.ts
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrActions.ts
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
 M apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts
 M apps/frontend/src/apps/app_docente/hooks/useRecordatorioPaseLista.ts
 M apps/frontend/src/apps/app_docente/tipos.ts
 M apps/frontend/src/apps/app_docente/utilidades.ts
 M apps/frontend/src/styles.css
 M apps/frontend/src/styles/cards.css
 M apps/frontend/src/styles/screens.css
 M apps/frontend/src/tipos/tesseract-js.d.ts
 M apps/frontend/src/ui/iconos.tsx
 M apps/frontend/src/ui/version/VersionInfoPage.tsx
 M apps/frontend/tests/app.selector.test.tsx
 M apps/frontend/tests/appDocente.previewConsolidado.test.tsx
 M apps/frontend/tests/banco.refactor.test.tsx
 M apps/frontend/tests/escaneo.refactor.test.tsx
 M apps/frontend/tests/gui.responsive.contract.test.tsx
 M apps/frontend/tests/plantillas.hooks.test.tsx
 M apps/frontend/tests/plantillas.refactor.test.tsx
 M apps/frontend/tests/plantillasOmrWorkflow.test.tsx
 M apps/frontend/tests/seccionAsistencias.test.tsx
 M apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
 M apps/frontend/tests/seccionCalificar.test.tsx
 M apps/frontend/tests/seccionClassroom.test.tsx
 M apps/frontend/tests/seccionEntrega.test.tsx
 M apps/frontend/tests/seccionEvaluaciones.test.tsx
 M apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx
 M apps/frontend/tests/seccionPublicar.test.tsx
 M apps/frontend/tests/seccionTemarios.test.tsx
 M apps/frontend/tests/utilidades.appDocente.test.ts
 M apps/frontend/tests/versionInfo.helpers.test.tsx
 M apps/frontend/tests/versionInfoPage.test.tsx
 M apps/frontend/vite.config.ts
 M apps/portal_alumno_cloud/package-lock.json
 M apps/portal_alumno_cloud/package.json
 M apps/portal_alumno_cloud/prisma/schema.prisma
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
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/sqlite.ts
 M apps/portal_alumno_cloud/tests/utils/mongo.ts
 M config/version-catalog.json
 M docs/AUTO_ENV.md
 M docs/IA_SKILLS_MCP_POLICY.md
 M docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
 M docs/VERSIONADO.md
 M docs/WCAG_UI_POLICY.md
 M docs/diagramas/rendered/arquitectura/arquitectura-despliegue.svg
 M docs/diagramas/rendered/arquitectura/arquitectura-logica.svg
 M docs/diagramas/rendered/c4/arquitectura-c4-component-integraciones.svg
 M docs/diagramas/rendered/c4/arquitectura-c4-component.svg
 M docs/diagramas/rendered/c4/arquitectura-c4-container.svg
 M docs/diagramas/rendered/c4/arquitectura-c4-context.svg
 M docs/diagramas/rendered/datos/modelo-datos-cloud.svg
 M docs/diagramas/rendered/datos/modelo-datos-local.svg
 M docs/diagramas/rendered/flujos/flujo-examen.svg
 M docs/specs/SPEC-036_autenticacion_guardrails.spec.md
 M docs/specs/SPEC-039_asistencias_seguimiento.spec.md
 M docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
 M docs/specs/SPEC-046_google_classroom_sync.spec.md
 M docs/specs/SPEC-053_guardrails_google_oauth_runtime.spec.md
 M docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
 M docs/specs/e2e_playwright_screen_functional_matrix.spec.md
 M docs/specs/flujo_docente_alumno_integral.spec.md
 M docs/specs/listas_institucionales_por_plantilla.spec.md
 M docs/specs/release_stable_installer_firma.spec.md
 M package-lock.json
 M package.json
 M packaging/app-host/App.xaml.cs
 M packaging/app-host/MainWindow.xaml.cs
 M packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj
 M packaging/wix/README.md
 M reports/qa/latest/clean-architecture.json
 M reports/qa/latest/dataset-prodlike.json
 M reports/qa/latest/e2e-docente-alumno.json
 M reports/qa/latest/evaluaciones-e2e.json
 M reports/qa/latest/evaluaciones-policy.json
 M reports/qa/latest/global-grade.json
 M reports/qa/latest/manifest.json
 M reports/qa/latest/pdf-print.json
 M reports/qa/latest/ux-visual.json
 M scripts/build-msi.ps1
 D scripts/build-native-dist.ps1
 M scripts/docente-bundle-guard.mjs
 M scripts/perf-collect-business.ts
 M scripts/release/validate-stable-promotion.mjs
 M scripts/routes-check.mjs
 M scripts/runtime-env.mjs
 M scripts/sdd-audit.mjs
 M scripts/serve-docente-static.mjs
 M scripts/start-docente-native.mjs
 M scripts/testing/generar-qa-manifest.mjs
 M scripts/testing/run-backend-coverage-batches.mjs
 M scripts/testing/run-backend-test-batches.mjs
 M scripts/testing/start-frontend-e2e-server.mjs
 M scripts/testing/windows-release-smoke-ownership.mjs
 M scripts/tests/app-host-health.contract.test.mjs
 M scripts/tests/app-host-shutdown.contract.test.mjs
 M scripts/tests/backend-test-batches.test.mjs
 M scripts/tests/ci-workflow-contract.test.mjs
 M scripts/tests/installer-hub-contract.test.mjs
 M scripts/tests/installer-hub-lifecycle-contract.test.mjs
 M scripts/tests/native-startup.contract.test.mjs
 M scripts/tests/omr-version-policy.test.mjs
 M scripts/tests/release-stable-promotion.test.mjs
 M scripts/tests/runtime-env.test.mjs
 M scripts/tests/sdd-audit.test.mjs
 M scripts/tests/seed-docente-dummy.mjs
 M scripts/tests/wcag-guard.contract.test.mjs
 M scripts/tests/windows-release-smoke-ownership.test.mjs
 M scripts/tests/windows-release-smoke.test.mjs
 M scripts/tests/wix-version-policy.test.mjs
 M tests/gui-responsive/ciclo-completo.spec.ts
 M tests/gui-responsive/journey-docente-integral.spec.ts
 M tests/gui-responsive/playwright.ciclo.config.mjs
?? .agents/skills/evaluapro-exam-batch-qa/
?? .agents/skills/evaluapro-exam-workflow/
?? .agents/skills/evaluapro-reactivo-review/
?? .agents/skills/evaluapro-topic-blueprint/
?? .codex/trace-omr-x-session.json
?? apps/backend/prisma.config.mjs
?? apps/backend/scripts/omr-eval-real-dataset.mjs
?? apps/backend/scripts/omr-qr-preprint-check.ts
?? apps/backend/src/modulos/modulo_analiticas/servicioBonoExtracurricular.ts
?? apps/backend/src/modulos/modulo_analiticas/servicioListaFisicaParcial2.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosXlsx.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
?? apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/cicloVidaLotes.ts
?? apps/backend/src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.ts
?? apps/backend/src/modulos/modulo_generacion_pdf/domain/validacionLotePdf.ts
?? apps/backend/src/modulos/modulo_integraciones_classroom/calculoAcumuladoTareas.ts
?? apps/backend/tests/bonoExtracurricular.test.ts
?? apps/backend/tests/calculoAcumuladoTareas.test.ts
?? apps/backend/tests/calificacion.omr.estado.test.ts
?? apps/backend/tests/integracion/_reactivosHelper.ts
?? apps/backend/tests/integracion/codigosAccesoApi.test.ts
?? apps/backend/tests/integracion/entregasApiLifecycle.test.ts
?? apps/backend/tests/integracion/evaluacionesEvidenciasPaginacionApi.test.ts
?? apps/backend/tests/integracion/examenesGeneradosPaginacionApi.test.ts
?? apps/backend/tests/integracion/examenesLotesApi.test.ts
?? apps/backend/tests/integracion/publicacionCodigoAccesoActivo.test.ts
?? apps/backend/tests/integracion/reactivosIngesta.test.ts
?? apps/backend/tests/integracion/temasBancoLifecycle.test.ts
?? apps/backend/tests/listaAcademicaResumen.test.ts
?? apps/backend/tests/listaFisicaParcial2.persistencia.test.ts
?? apps/backend/tests/listaFisicaParcial2.test.ts
?? apps/backend/tests/listaFisicaParcial2.validaciones.test.ts
?? apps/backend/tests/omr.consenso.robusto.test.ts
?? apps/backend/tests/omr.dataset-grain.test.ts
?? apps/backend/tests/omr.estado-respuesta.test.ts
?? apps/backend/tests/omr.ocrPie.test.ts
?? apps/backend/tests/omr.qr.preimpresion.test.ts
?? apps/backend/tests/pdf.ink-sparing-staple.test.ts
?? apps/backend/tests/pdf.lote.integridad.test.ts
?? apps/backend/tests/reactivosCalibracion.test.ts
?? apps/backend/tests/reactivosContrato.test.ts
?? apps/backend/tests/validacionesClassroom.test.ts
?? apps/frontend/src/apps/app_docente/ClassroomEnCalificaciones.tsx
?? apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
?? apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
?? apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
?? apps/frontend/src/apps/app_docente/features/plantillas/loteGeneracionSesion.ts
?? apps/frontend/src/apps/app_docente/fechaLocal.ts
?? apps/frontend/src/apps/app_docente/ocrTexto.ts
?? apps/frontend/src/ui/IconoLucide.tsx
?? apps/frontend/src/ui/iconosCatalogo.ts
?? apps/frontend/src/ui/version/changelog.ts
?? apps/frontend/src/ui/version/legal/
?? apps/frontend/tests/bancoImportacionReactivos.test.tsx
?? apps/frontend/tests/changelog.test.ts
?? apps/frontend/tests/classroomEnCalificaciones.mapeoCortes.test.tsx
?? apps/frontend/tests/classroomEnCalificaciones.test.tsx
?? apps/frontend/tests/fechaLocal.test.ts
?? apps/frontend/tests/ocrTexto.test.ts
?? apps/frontend/tests/permisosBanco.hooks.test.tsx
?? apps/frontend/tests/plantillas.loteSesion.test.ts
?? apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx
?? apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
?? apps/portal_alumno_cloud/prisma.config.mjs
?? docs/GUIA_ICONOGRAFIA.md
?? docs/contracts/
?? docs/handoff/sesiones/2026-09-23/
?? docs/handoff/sesiones/2026-09-24/
?? docs/handoff/sesiones/2026-09-25/
?? docs/handoff/sesiones/2026-09-27/
?? docs/handoff/sesiones/2026-09-28/
?? docs/qa/
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? docs/specs/SPEC-064_actualizacion_dependencias_toolchains.spec.md
?? docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md
?? docs/specs/SPEC-066_sqlite_test_isolation.spec.md
?? docs/specs/SPEC-067_classroom_preview_payload.spec.md
?? docs/specs/SPEC-068_generacion_lotes_pdf_integridad.spec.md
?? docs/specs/SPEC-069_benchmark_paralelismo_backend.spec.md
?? docs/specs/SPEC-070_api_first_automatizacion_docente.spec.md
?? docs/specs/SPEC-071_ingesta_clasificacion_lotes_omr.spec.md
?? global.json
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip.sha256
?? output/qa/omr-camera-camscanner-20260924/
?? output/qa/omr-mark-shapes-20260928/
?? output/qa/omr-plantilla-sync-20260923.layout.json
?? output/qa/omr-plantilla-sync-20260923.pdf
?? output/qa/qa_omr_plantilla_20260925/
?? scripts/api/
?? scripts/migrate-calificaciones-lista-idempotencia-sqlite.mjs
?? scripts/migrate-calificaciones-lista-manual-sqlite.mjs
?? scripts/migrate-evidencias-evaluacion-sqlite.mjs
?? scripts/migrate-examen-lote-artefactos-pdf-sqlite.mjs
?? scripts/migrate-examen-lotes-ciclo-vida-sqlite.mjs
?? scripts/migrate-reactivos-backfill.mjs
?? scripts/migrate-reactivos-sqlite.mjs
?? scripts/migrate-temarios-auditoria-sqlite.mjs
?? scripts/migrate-temas-banco-auditoria-sqlite.mjs
?? scripts/testing/benchmark-backend-concurrency.mjs
?? scripts/tests/api-resource-lifecycle.test.mjs
?? scripts/tests/backend-concurrency-benchmark.test.mjs
?? scripts/tests/dependency-toolchain-policy.test.mjs
?? scripts/tests/docente-bundle-guard.test.mjs
?? scripts/tests/evaluapro-client.test.mjs
?? scripts/tests/migrate-calificaciones-lista-idempotencia-sqlite.test.mjs
?? scripts/tests/migrate-calificaciones-lista-manual-sqlite.test.mjs
?? scripts/tests/migrate-evidencias-evaluacion-sqlite.test.mjs
?? scripts/tests/migrate-examen-lote-artefactos-pdf-sqlite.test.mjs
?? scripts/tests/migrate-examen-lotes-ciclo-vida-sqlite.test.mjs
?? scripts/tests/migrate-reactivos-backfill.test.mjs
?? scripts/tests/migrate-reactivos-sqlite.test.mjs
?? scripts/tests/migrate-temarios-auditoria-sqlite.test.mjs
?? scripts/tests/migrate-temas-banco-auditoria-sqlite.test.mjs
?? storage/omr_debug/058868F3/
?? storage/omr_debug/1458887E/
?? storage/omr_debug/5AFC1D79/
?? storage/omr_debug/780DC77D/
?? storage/omr_debug/DCA5097F/
?? storage/omr_debug/E2FAFF07/
?? storage/omr_debug/EE26CF1C/
?? tests/gui-responsive/banco-reactivos.spec.ts
?? tests/gui-responsive/plantillas-pdf-edge.spec.ts
?? tests/gui-responsive/playwright.pdf-edge.config.mjs
```

## Siguiente paso recomendado
- Con el ejemplo de palomita si está disponible, ejecutar un benchmark OMR no persistente sobre los recortes y agregar pruebas de detección/abstención antes de habilitar reconocimiento automático.

## Artefactos generados
- Sin artefactos generados.

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
